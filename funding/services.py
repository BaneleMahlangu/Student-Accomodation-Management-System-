from decimal import Decimal

from django.db import connection, transaction

from accounts.models import User
from accommodations.availability import sync_room_status
from accommodations.models import Bed, Room
from bookings.models import Booking
from contracts.rent import calculate_rent_schedule
from notifications.services import create_notification

from .models import FundingPayment


def apply_funding_payment_delta(funding_payment, amount_delta, payment_reference="", *, is_refund=False):
    """Persist a payment or refund adjustment through the database routine when available."""
    amount_delta = Decimal(str(amount_delta)).quantize(Decimal("0.01"))
    current_paid = funding_payment.amount_paid
    amount_due = funding_payment.amount_due
    if amount_delta == 0:
        raise ValueError("A payment adjustment must be greater than zero.")
    if is_refund:
        if amount_delta > 0 or abs(amount_delta) > current_paid:
            raise ValueError("A refund cannot exceed the amount already paid.")
    elif amount_delta < 0 or amount_delta > amount_due - current_paid:
        raise ValueError("A payment cannot exceed the outstanding balance.")

    if connection.vendor == "mysql":
        with connection.cursor() as cursor:
            cursor.callproc(
                "studenthaven_adjust_funding_payment",
                [funding_payment.pk, amount_delta, payment_reference or "", int(is_refund)],
            )
        funding_payment.refresh_from_db()
        return funding_payment

    funding_payment.amount_paid = current_paid + amount_delta
    remaining_balance = max(Decimal("0.00"), amount_due - funding_payment.amount_paid)
    if is_refund:
        funding_payment.payment_status = (
            FundingPayment.PaymentStatus.REFUNDED
            if funding_payment.amount_paid <= 0
            else FundingPayment.PaymentStatus.PENDING
            if remaining_balance > 0
            else FundingPayment.PaymentStatus.SUCCESSFUL
        )
        funding_payment.funding_status = (
            FundingPayment.FundingStatus.PENDING
            if funding_payment.amount_paid <= 0
            else FundingPayment.FundingStatus.PARTIALLY_FUNDED
            if remaining_balance > 0
            else FundingPayment.FundingStatus.VERIFIED
        )
        update_fields = ["amount_paid", "payment_status", "funding_status", "updated_at"]
    else:
        funding_payment.payment_status = (
            FundingPayment.PaymentStatus.SUCCESSFUL
            if remaining_balance == 0
            else FundingPayment.PaymentStatus.PENDING
        )
        funding_payment.funding_status = (
            FundingPayment.FundingStatus.VERIFIED
            if remaining_balance == 0
            else FundingPayment.FundingStatus.PARTIALLY_FUNDED
        )
        funding_payment.payment_reference = payment_reference[:100]
        update_fields = ["amount_paid", "payment_status", "funding_status", "payment_reference", "updated_at"]
    funding_payment.save(update_fields=update_fields)
    return funding_payment


def first_rent_installment_due(funding_payment):
    """Return the first scheduled rent charge for the signed accommodation stay."""
    contract = funding_payment.contract
    schedule = calculate_rent_schedule(contract.start_date, contract.end_date, contract.monthly_fee)
    return schedule[0]["amount"] if schedule else funding_payment.amount_due


@transaction.atomic
def finalize_booking_after_initial_rent(funding_payment):
    """Confirm a room booking after the first scheduled rent installment is paid.

    Later rent installments remain due under the signed monthly schedule. A
    missing bed does not undo a real payment; the caller escalates allocation
    to an administrator.
    """
    application = funding_payment.application
    contract = funding_payment.contract
    existing = Booking.objects.filter(application=application).first()
    if existing:
        return existing, False

    if not contract or contract.status != contract.Status.SIGNED:
        return None, False

    room = Room.objects.select_for_update().get(id=application.room_id)
    sync_room_status(room)
    if room.status != Room.RoomStatus.AVAILABLE:
        return None, False

    bed = (
        Bed.objects.select_for_update()
        .filter(room=room, status=Bed.BedStatus.AVAILABLE)
        .order_by("id")
        .first()
    )
    if not bed:
        return None, False
    bed.status = Bed.BedStatus.RESERVED
    bed.save(update_fields=["status"])

    booking, created = Booking.objects.get_or_create(
        application=application,
        defaults={
            "booking_number": f"SH-B-{application.application_number}",
            "contract": contract,
            "student": funding_payment.student,
            "property": application.property,
            "room": room,
            "bed": bed,
            "start_date": contract.start_date,
            "end_date": contract.end_date,
            "monthly_fee": contract.monthly_fee,
            "status": Booking.Status.CONFIRMED,
        },
    )
    if not created:
        return booking, False

    sync_room_status(room)

    create_notification(
        recipient=funding_payment.student,
        actor=funding_payment.student,
        notification_type="BOOKING_CONFIRMED",
        title="Booking confirmed",
        message=f"Your booking {booking.booking_number} is confirmed for {booking.property.name}, room {booking.room.room_number}.",
        application=application,
        extra_data={
            "booking_number": booking.booking_number,
            "property": booking.property.name,
            "room": booking.room.room_number,
            "bed": booking.bed.bed_number,
            "start_date": booking.start_date.isoformat(),
            "end_date": booking.end_date.isoformat(),
        },
    )
    create_notification(
        recipient=funding_payment.student,
        actor=funding_payment.student,
        notification_type="CHECK_IN_AVAILABLE",
        title="Check-in details will be available before arrival",
        message=f"Your booking starts on {booking.start_date:%d %B %Y}. Student Haven will let you know when check-in opens.",
        application=application,
        extra_data={"booking_number": booking.booking_number, "check_in_date": booking.start_date.isoformat()},
    )

    landlord = application.property.landlord
    if landlord:
        create_notification(
            recipient=landlord,
            actor=funding_payment.student,
            notification_type="BOOKING_CONFIRMED",
            title="A booking has been confirmed",
            message=f"A funded booking is confirmed for room {booking.room.room_number} at {booking.property.name}.",
            application=application,
            extra_data={"booking_number": booking.booking_number, "property_id": booking.property_id},
        )
    return booking, True


def notify_admin_payment_allocation_needed(funding_payment, transaction_reference):
    for admin in User.objects.filter(role=User.Role.ADMINISTRATOR, is_active=True):
        create_notification(
            recipient=admin,
            notification_type="PAYMENT_SUCCESSFUL",
            title="Paid application needs room allocation review",
            message=(
                f"PayFast confirmed payment {transaction_reference} for "
                f"{funding_payment.application.application_number}, but no bed was available to confirm the booking."
            ),
            application=funding_payment.application,
            extra_data={"payment_reference": transaction_reference},
        )
    create_notification(
        recipient=funding_payment.student,
        notification_type="PAYMENT_SUCCESSFUL",
        title="Payment received; booking confirmation is being reviewed",
        message="Your payment was confirmed. Staff will contact you to confirm room allocation before your booking is finalized.",
        application=funding_payment.application,
        extra_data={"payment_reference": transaction_reference},
    )
