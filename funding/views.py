import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Q

from accounts.models import User
from accommodations.availability import sync_room_status
from accommodations.models import Room
from applications.models import Application
from bookings.models import Booking
from bookings.serializers import BookingSerializer
from contracts.models import Contract
from analytics.services import record_audit_event
from notifications.services import create_notification

from .payfast import (
    checkout_fields,
    confirm_itn_with_payfast,
    is_valid_itn_signature,
    is_valid_payfast_ip,
    payfast_is_configured,
    payfast_mode,
    process_url,
)
from .services import (
    apply_funding_payment_delta,
    finalize_booking_after_initial_rent,
    first_rent_installment_due,
    notify_admin_payment_allocation_needed,
)

from .models import (
    FundingPayment,
    PaymentTransaction,
    SponsorshipApplication,
    SponsorshipProgram,
)

from .serializers import (
    FundingPaymentSerializer,
    PaymentTransactionSerializer,
    SponsorshipApplicationSerializer,
    SponsorshipDecisionSerializer,
    SponsorshipProgramSerializer,
    SponsorshipProgramWriteSerializer,
)


class PaymentAmountInputSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=False)


class StudentFundingPaymentView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, application_id):

        if request.user.role != "STUDENT":
            return Response(
                {
                    "success": False,
                    "message": (
                        "Only students can view "
                        "funding and payment information."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        application = get_object_or_404(
            Application,
            id=application_id,
        )

        if application.student_id != request.user.id:
            return Response(
                {
                    "success": False,
                    "message": "Access denied.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        funding_payment = get_object_or_404(
            FundingPayment,
            application=application,
            student=request.user,
        )

        serializer = FundingPaymentSerializer(
            funding_payment
        )

        return Response(
            {
                "success": True,
                "funding_payment": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class AdminFundingRecordsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.ADMINISTRATOR and not request.user.is_superuser:
            return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)

        records = FundingPayment.objects.select_related(
            "student", "application__property", "contract"
        ).prefetch_related("transactions").order_by("-updated_at")
        funding_status = request.query_params.get("funding_status", "")
        payment_status = request.query_params.get("payment_status", "")
        search = request.query_params.get("search", "").strip()
        if funding_status in FundingPayment.FundingStatus.values:
            records = records.filter(funding_status=funding_status)
        if payment_status in FundingPayment.PaymentStatus.values:
            records = records.filter(payment_status=payment_status)
        if search:
            records = records.filter(
                Q(student__email__icontains=search)
                | Q(student__first_name__icontains=search)
                | Q(student__last_name__icontains=search)
                | Q(application__application_number__icontains=search)
                | Q(application__property__name__icontains=search)
                | Q(contract__contract_number__icontains=search)
            )

        serialized = []
        for record in records[:500]:
            item = FundingPaymentSerializer(record).data
            item.update({
                "student_name": record.student.get_full_name(),
                "student_email": record.student.email,
                "application_number": record.application.application_number,
                "property_name": record.application.property.name,
                "contract_number": record.contract.contract_number,
            })
            serialized.append(item)
        return Response({"success": True, "count": records.count(), "records": serialized})

    def patch(self, request, record_id):
        if request.user.role != User.Role.ADMINISTRATOR and not request.user.is_superuser:
            return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)

        record = get_object_or_404(FundingPayment.objects.select_related("student", "application", "contract"), id=record_id)
        next_status = request.data.get("funding_status")
        note = str(request.data.get("review_note", "")).strip()
        if next_status not in FundingPayment.FundingStatus.values:
            return Response({"success": False, "message": "Choose a valid funding status."}, status=status.HTTP_400_BAD_REQUEST)
        if not note:
            return Response({"success": False, "message": "Add a review note to explain the funding decision."}, status=status.HTTP_400_BAD_REQUEST)
        if len(note) > 1500:
            return Response({"success": False, "message": "Review notes must be 1,500 characters or fewer."}, status=status.HTTP_400_BAD_REQUEST)

        previous_status = record.funding_status
        record.funding_status = next_status
        timestamp = timezone.localtime().strftime("%Y-%m-%d %H:%M")
        record.funding_notes = "\n".join(part for part in [record.funding_notes.strip(), f"Admin review ({timestamp}): {note}"] if part)
        record.save(update_fields=["funding_status", "funding_notes", "updated_at"])
        record_audit_event(
            actor=request.user,
            action="FUNDING_STATUS_UPDATED",
            entity_type="funding_payment",
            entity_id=record.id,
            summary=f"Funding status for {record.application.application_number} changed from {previous_status} to {next_status}",
            metadata={"from_status": previous_status, "to_status": next_status},
            request=request,
        )
        create_notification(
            recipient=record.student,
            actor=request.user,
            notification_type="FUNDING_UPDATED",
            title="Funding status updated",
            message=f"Your funding review is now marked {record.get_funding_status_display()}.",
            application=record.application,
            extra_data={"funding_status": next_status, "application_number": record.application.application_number},
        )
        item = FundingPaymentSerializer(record).data
        item.update({
            "student_name": record.student.get_full_name(),
            "student_email": record.student.email,
            "application_number": record.application.application_number,
            "property_name": record.application.property.name,
            "contract_number": record.contract.contract_number,
        })
        return Response({"success": True, "record": item, "message": "Funding review saved."})


def _is_administrator(user):
    return user.role == User.Role.ADMINISTRATOR or user.is_superuser


class SponsorshipProgramsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.STUDENT:
            return Response({"success": False, "message": "Student access is required."}, status=status.HTTP_403_FORBIDDEN)
        today = timezone.localdate()
        programs = SponsorshipProgram.objects.filter(is_active=True).filter(
            Q(application_deadline__isnull=True) | Q(application_deadline__gte=today)
        ).annotate(
            application_count_annotated=Count("applications", distinct=True),
            beneficiary_count_annotated=Count("applications", filter=Q(applications__status=SponsorshipApplication.Status.APPROVED), distinct=True),
        )
        own_applications = {
            application.program_id: application
            for application in SponsorshipApplication.objects.filter(student=request.user)
        }
        data = []
        for program in programs:
            item = dict(SponsorshipProgramSerializer(program).data)
            application = own_applications.get(program.id)
            item["my_application_id"] = application.id if application else None
            item["my_application_status"] = application.status if application else ""
            item["application_deadline_passed"] = bool(program.application_deadline and program.application_deadline < today)
            data.append(item)
        return Response({"success": True, "count": len(data), "programs": data})


class StudentSponsorshipApplicationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.STUDENT:
            return Response({"success": False, "message": "Student access is required."}, status=status.HTTP_403_FORBIDDEN)
        applications = SponsorshipApplication.objects.filter(student=request.user).select_related("program").order_by("-submitted_at")
        return Response({"success": True, "applications": SponsorshipApplicationSerializer(applications, many=True).data})


class StudentSponsorshipApplyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, program_id):
        if request.user.role != User.Role.STUDENT:
            return Response({"success": False, "message": "Student access is required."}, status=status.HTTP_403_FORBIDDEN)
        statement = str(request.data.get("statement", "")).strip()
        if len(statement) > 5000:
            return Response({"success": False, "message": "Your statement must be 5,000 characters or fewer."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            program = get_object_or_404(SponsorshipProgram.objects.select_for_update(), id=program_id, is_active=True)
            today = timezone.localdate()
            if program.application_deadline and program.application_deadline < today:
                return Response({"success": False, "message": "The application deadline has passed."}, status=status.HTTP_409_CONFLICT)
            if program.maximum_beneficiaries is not None:
                awarded_count = program.applications.filter(status=SponsorshipApplication.Status.APPROVED).count()
                if awarded_count >= program.maximum_beneficiaries:
                    return Response({"success": False, "message": "All beneficiary places for this programme have been allocated."}, status=status.HTTP_409_CONFLICT)
            if SponsorshipApplication.objects.filter(program=program, student=request.user).exists():
                return Response({"success": False, "message": "You have already applied to this programme."}, status=status.HTTP_409_CONFLICT)
            application = SponsorshipApplication.objects.create(program=program, student=request.user, statement=statement)

        record_audit_event(
            actor=request.user,
            action="SPONSORSHIP_APPLICATION_SUBMITTED",
            entity_type="sponsorship_application",
            entity_id=application.id,
            summary=f"Student applied to {program.name}",
            metadata={"status": application.status},
            request=request,
        )
        return Response({"success": True, "application": SponsorshipApplicationSerializer(application).data}, status=status.HTTP_201_CREATED)


class AdminSponsorshipProgramsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_administrator(request.user):
            return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)
        programs = SponsorshipProgram.objects.annotate(
            application_count_annotated=Count("applications", distinct=True),
            beneficiary_count_annotated=Count("applications", filter=Q(applications__status=SponsorshipApplication.Status.APPROVED), distinct=True),
        ).order_by("-created_at")
        return Response({"success": True, "programs": SponsorshipProgramSerializer(programs, many=True).data})

    def post(self, request):
        if not _is_administrator(request.user):
            return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)
        serializer = SponsorshipProgramWriteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        program = serializer.save(created_by=request.user)
        record_audit_event(
            actor=request.user,
            action="SPONSORSHIP_PROGRAM_CREATED",
            entity_type="sponsorship_program",
            entity_id=program.id,
            summary=f"Created funding programme {program.name}",
            metadata={"is_active": program.is_active},
            request=request,
        )
        return Response({"success": True, "program": SponsorshipProgramSerializer(program).data}, status=status.HTTP_201_CREATED)


class AdminSponsorshipProgramDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, program_id):
        if not _is_administrator(request.user):
            return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)
        program = get_object_or_404(SponsorshipProgram, id=program_id)
        serializer = SponsorshipProgramWriteSerializer(program, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        updated = serializer.save()
        record_audit_event(
            actor=request.user,
            action="SPONSORSHIP_PROGRAM_UPDATED",
            entity_type="sponsorship_program",
            entity_id=updated.id,
            summary=f"Updated funding programme {updated.name}",
            metadata={"is_active": updated.is_active},
            request=request,
        )
        return Response({"success": True, "program": SponsorshipProgramSerializer(updated).data})


class AdminSponsorshipApplicationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_administrator(request.user):
            return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)
        applications = SponsorshipApplication.objects.select_related(
            "program", "student", "student__student_profile"
        )
        selected_status = request.query_params.get("status", "")
        search = request.query_params.get("search", "").strip()
        if selected_status in SponsorshipApplication.Status.values:
            applications = applications.filter(status=selected_status)
        if search:
            applications = applications.filter(
                Q(student__email__icontains=search)
                | Q(student__first_name__icontains=search)
                | Q(student__last_name__icontains=search)
                | Q(program__name__icontains=search)
                | Q(program__sponsor_name__icontains=search)
            )
        applications = applications.order_by("status", "submitted_at")[:1000]
        return Response({"success": True, "applications": SponsorshipApplicationSerializer(applications, many=True).data})

    def patch(self, request, application_id):
        if not _is_administrator(request.user):
            return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)
        serializer = SponsorshipDecisionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        decision = serializer.validated_data

        with transaction.atomic():
            application = get_object_or_404(
                SponsorshipApplication.objects.select_for_update().select_related("program", "student"),
                id=application_id,
            )
            program = SponsorshipProgram.objects.select_for_update().get(id=application.program_id)
            next_status = decision["status"]
            if next_status == SponsorshipApplication.Status.APPROVED and program.maximum_beneficiaries is not None:
                approved_count = program.applications.filter(status=SponsorshipApplication.Status.APPROVED).exclude(id=application.id).count()
                if approved_count >= program.maximum_beneficiaries:
                    return Response({"success": False, "message": "All beneficiary places for this programme have already been allocated."}, status=status.HTTP_409_CONFLICT)

            previous_status = application.status
            application.status = next_status
            application.review_note = decision["review_note"]
            application.reviewed_by = request.user
            application.reviewed_at = timezone.now()
            if next_status == SponsorshipApplication.Status.APPROVED:
                application.award_amount = decision.get("award_amount") or program.amount
                application.award_conditions = decision.get("award_conditions", "") or program.conditions
                application.award_period_start = decision.get("award_period_start") or program.funding_period_start
                application.award_period_end = decision.get("award_period_end") or program.funding_period_end
                if application.award_period_end < application.award_period_start:
                    return Response({"success": False, "message": "The award end date must be on or after its start date."}, status=status.HTTP_400_BAD_REQUEST)
            else:
                application.award_amount = None
                application.award_conditions = ""
                application.award_period_start = None
                application.award_period_end = None
            application.save(update_fields=[
                "status", "review_note", "award_amount", "award_conditions", "award_period_start",
                "award_period_end", "reviewed_by", "reviewed_at", "updated_at",
            ])

        record_audit_event(
            actor=request.user,
            action="SPONSORSHIP_APPLICATION_REVIEWED",
            entity_type="sponsorship_application",
            entity_id=application.id,
            summary=f"{program.name} application for {application.student.get_full_name()} marked {next_status}",
            metadata={"from_status": previous_status, "to_status": next_status},
            request=request,
        )
        create_notification(
            recipient=application.student,
            actor=request.user,
            notification_type="FUNDING_UPDATED",
            title="Bursary or sponsorship application updated",
            message=f"Your application for {program.name} is now {application.get_status_display().lower()}.",
            extra_data={"sponsorship_application_id": application.id, "program_id": program.id, "status": next_status},
        )
        return Response({"success": True, "application": SponsorshipApplicationSerializer(application).data})


class StudentPaymentView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, application_id):

        if request.user.role != "STUDENT":
            return Response(
                {
                    "success": False,
                    "message": "Student access required.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if not settings.DEBUG or not settings.PAYMENT_SIMULATOR_ENABLED:
            return Response(
                {
                    "success": False,
                    "message": "Simulated payments are disabled. Use the configured secure payment checkout; no payment was taken.",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        booking_created = False
        payment_transaction = None
        transaction_reference = None
        booking = None
        funding_payment = None
        application = None

        with transaction.atomic():

            funding_payment = (
                FundingPayment.objects
                .select_for_update()
                .select_related(
                    "application",
                    "contract",
                    "student",
                )
                .filter(
                    application_id=application_id,
                    student=request.user,
                )
                .first()
            )

            if not funding_payment:
                return Response(
                    {
                        "success": False,
                        "message": (
                            "Funding payment record "
                            "was not found."
                        ),
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            if (
                funding_payment.application.student_id
                != request.user.id
            ):
                return Response(
                    {
                        "success": False,
                        "message": "Access denied.",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            contract = (
                Contract.objects
                .select_for_update()
                .get(
                    application_id=application_id
                )
            )

            if contract.status != Contract.Status.SIGNED:
                return Response(
                    {
                        "success": False,
                        "message": (
                            "The contract must be signed "
                            "before payment can create "
                            "a booking."
                        ),
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            balance = (
                funding_payment.amount_due
                - funding_payment.amount_paid
            )
            amount_serializer = PaymentAmountInputSerializer(data=request.data)
            if not amount_serializer.is_valid():
                return Response(
                    {"success": False, "message": "Enter a payment amount greater than zero with no more than two decimal places."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            amount_to_pay = amount_serializer.validated_data.get("amount", balance)
            if amount_to_pay > balance:
                return Response(
                    {"success": False, "message": f"The payment cannot exceed the outstanding balance of R {balance:,.2f}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # =================================================
            # PAYMENT WAS ALREADY COMPLETED
            # =================================================

            if balance <= 0:
                booking, _created = finalize_booking_after_initial_rent(funding_payment)
                if not booking:
                    notify_admin_payment_allocation_needed(
                        funding_payment,
                        funding_payment.payment_reference or "previously confirmed payment",
                    )
                    return Response(
                        {
                            "success": False,
                            "message": "Your payment is already recorded, but no bed remains available in this room. Student Haven has been notified to review your allocation.",
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

                booking_serializer = BookingSerializer(booking)

                return Response(
                    {
                        "success": True,
                        "message": (
                            "This sandbox balance is settled and the booking is confirmed for testing. No real payment was taken."
                        ),
                        "booking": (
                            booking_serializer.data
                        ),
                        "funding_payment": (
                            FundingPaymentSerializer(
                                funding_payment
                            ).data
                        ),
                    },
                    status=status.HTTP_200_OK,
                )

            application = funding_payment.application
            room = None
            available_bed = None
            will_confirm_booking = (
                not Booking.objects.filter(application_id=application_id).exists()
                and funding_payment.amount_paid + amount_to_pay >= first_rent_installment_due(funding_payment)
            )
            if will_confirm_booking:
                room = Room.objects.select_for_update().get(id=application.room_id)
                sync_room_status(room)
                available_bed = room.beds.select_for_update().filter(status="AVAILABLE").order_by("id").first()
                if room.status != Room.RoomStatus.AVAILABLE or not available_bed:
                    return Response(
                        {"success": False, "message": "No bed remains available in the selected room. Contact StudentHaven before paying the first month's rent."},
                        status=status.HTTP_409_CONFLICT,
                    )

            # =================================================
            # CREATE PAYMENT TRANSACTION
            # =================================================

            transaction_reference = (
                f"SH-PAY-"
                f"{uuid.uuid4().hex[:12].upper()}"
            )

            payment_transaction = (
                PaymentTransaction.objects.create(
                    funding_payment=funding_payment,
                    transaction_reference=(
                        transaction_reference
                    ),
                    provider="SANDBOX",
                    amount=amount_to_pay,
                    currency=funding_payment.currency,
                    status=(
                        PaymentTransaction.Status.PROCESSING
                    ),
                )
            )

            # =================================================
            # SANDBOX PAYMENT SUCCESS
            # =================================================

            payment_transaction.status = (
                PaymentTransaction.Status.SUCCESSFUL
            )

            payment_transaction.processed_at = (
                timezone.now()
            )

            payment_transaction.save(
                update_fields=[
                    "status",
                    "processed_at",
                    "updated_at",
                ]
            )

            apply_funding_payment_delta(
                funding_payment,
                amount_to_pay,
                transaction_reference,
            )
            remaining_balance = max(Decimal("0.00"), funding_payment.amount_due - funding_payment.amount_paid)
            fully_paid = remaining_balance == 0

            first_month_paid = funding_payment.amount_paid >= first_rent_installment_due(funding_payment)
            if first_month_paid and not Booking.objects.filter(application=application).exists():
                booking, booking_created = finalize_booking_after_initial_rent(funding_payment)
                if not booking:
                    notify_admin_payment_allocation_needed(funding_payment, transaction_reference)

            if not fully_paid:
                create_notification(
                    recipient=request.user,
                    actor=request.user,
                    notification_type="PAYMENT_SUCCESSFUL",
                    title="Partial payment recorded",
                    message=f"A sandbox installment of R {amount_to_pay:,.2f} was recorded. R {remaining_balance:,.2f} remains due. No live payment was taken.",
                    application=funding_payment.application,
                    extra_data={"transaction_reference": transaction_reference, "amount": str(amount_to_pay), "balance": str(remaining_balance), "currency": funding_payment.currency},
                )
                message = (
                    f"Sandbox installment recorded. R {remaining_balance:,.2f} remains due."
                    + (" Your booking is confirmed because the first month is paid." if booking else " Pay the first month's rent to confirm your room booking.")
                    + " No real payment was taken."
                )
                return Response({
                    "success": True,
                    "message": message,
                    "booking": BookingSerializer(booking).data if booking else None,
                    "funding_payment": FundingPaymentSerializer(funding_payment).data,
                }, status=status.HTTP_201_CREATED)
            if not booking:
                booking, booking_created = finalize_booking_after_initial_rent(funding_payment)
                if not booking:
                    notify_admin_payment_allocation_needed(funding_payment, transaction_reference)

        # =====================================================
        # PAYMENT SUCCESSFUL NOTIFICATION
        # =====================================================

        create_notification(
            recipient=request.user,
            actor=request.user,
            notification_type="PAYMENT_SUCCESSFUL",
            title="Sandbox payment recorded",
            message=(
                f"A simulated sandbox payment of R {amount_to_pay:,.2f} was recorded. No live payment was taken."
            ),
            application=application,
            extra_data={
                "transaction_reference": (
                    transaction_reference
                ),
                "amount": str(amount_to_pay),
                "currency": (
                    funding_payment.currency
                ),
                "payment_status": (
                    funding_payment.payment_status
                ),
                "funding_status": (
                    funding_payment.funding_status
                ),
            },
        )

        # =====================================================
        # BOOKING CONFIRMED NOTIFICATION
        # =====================================================

        if booking_created and booking:

            create_notification(
                recipient=request.user,
                actor=request.user,
                notification_type=(
                    "BOOKING_CONFIRMED"
                ),
                title="Booking confirmed",
                message=(
                    f"Your accommodation booking "
                    f"{booking.booking_number} has "
                    f"been confirmed successfully."
                ),
                application=application,
                extra_data={
                    "booking_number": (
                        booking.booking_number
                    ),
                    "property": (
                        booking.property.name
                        if booking.property
                        else None
                    ),
                    "room": (
                        booking.room.room_number
                        if booking.room
                        else None
                    ),
                    "bed": (
                        booking.bed.bed_number
                        if booking.bed
                        else None
                    ),
                    "start_date": (
                        booking.start_date.isoformat()
                        if booking.start_date
                        else None
                    ),
                    "end_date": (
                        booking.end_date.isoformat()
                        if booking.end_date
                        else None
                    ),
                },
            )

            # =================================================
            # CHECK-IN AVAILABLE NOTIFICATION
            # =================================================

            create_notification(
                recipient=request.user,
                actor=request.user,
                notification_type=(
                    "CHECK_IN_AVAILABLE"
                ),
                title="Check-in available",
                message=(
                    "Your accommodation booking is "
                    "confirmed. Check-in will be available "
                    f"from {booking.start_date.strftime('%d %B %Y')}."
                ),
                application=application,
                extra_data={
                    "booking_number": (
                        booking.booking_number
                    ),
                    "check_in_date": (
                        booking.start_date.isoformat()
                    ),
                },
            )

        return Response(
            {
                "success": True,
                "message": (
                    "Sandbox payment recorded and the contract balance is settled. No real payment was taken."
                    if booking
                    else "Sandbox payment recorded. Staff must review room allocation before confirming the booking. No real payment was taken."
                ),
                "booking": BookingSerializer(booking).data if booking else None,
                "funding_payment": (
                    FundingPaymentSerializer(
                        funding_payment
                    ).data
                ),
            },
            status=status.HTTP_201_CREATED,
        )


class PayFastConfigurationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.STUDENT:
            return Response({"success": False, "message": "Student access required."}, status=status.HTTP_403_FORBIDDEN)
        mode = payfast_mode()
        configured = payfast_is_configured()
        if mode == "disabled":
            message = "PayFast is not enabled on this installation. Configure PAYFAST_MODE and the merchant settings to use checkout."
        elif not configured:
            message = "PayFast details are incomplete. Configure the merchant ID, merchant key and public HTTPS notification URL."
        elif mode == "live" and settings.DEBUG:
            message = "Live PayFast checkout is disabled while Django DEBUG is on."
            configured = False
        else:
            message = "PayFast sandbox checkout is ready." if mode == "sandbox" else "PayFast secure checkout is ready."
        return Response({
            "success": True,
            "enabled": configured,
            "mode": mode,
            "checkout_url": process_url() if configured else None,
            "local_simulation_enabled": bool(settings.DEBUG and settings.PAYMENT_SIMULATOR_ENABLED),
            "message": message,
        })


class PayFastCheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, application_id):
        if request.user.role != User.Role.STUDENT:
            return Response({"success": False, "message": "Student access required."}, status=status.HTTP_403_FORBIDDEN)
        mode = payfast_mode()
        if not payfast_is_configured():
            return Response({"success": False, "message": "PayFast is not fully configured. No payment was started."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if mode == "live" and settings.DEBUG:
            return Response({"success": False, "message": "Live checkout is blocked while Django DEBUG is on."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if mode == "live" and not settings.FRONTEND_BASE_URL.startswith("https://"):
            return Response({"success": False, "message": "Live checkout requires an HTTPS Student Haven address."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        with transaction.atomic():
            funding_payment = FundingPayment.objects.select_for_update().select_related(
                "application__property", "application__room", "student", "contract",
            ).filter(application_id=application_id, student=request.user).first()
            if not funding_payment:
                return Response({"success": False, "message": "Funding payment record was not found."}, status=status.HTTP_404_NOT_FOUND)
            contract = funding_payment.contract
            if contract.status != Contract.Status.SIGNED:
                return Response({"success": False, "message": "The accommodation contract must be signed before checkout."}, status=status.HTTP_409_CONFLICT)
            balance = funding_payment.amount_due - funding_payment.amount_paid
            if balance <= 0:
                return Response({"success": False, "message": "There is no outstanding balance to pay."}, status=status.HTTP_409_CONFLICT)
            amount_serializer = PaymentAmountInputSerializer(data=request.data)
            if not amount_serializer.is_valid():
                return Response({"success": False, "message": "Enter a payment amount greater than zero with no more than two decimal places."}, status=status.HTTP_400_BAD_REQUEST)
            amount_to_pay = amount_serializer.validated_data.get("amount", balance)
            if amount_to_pay > balance:
                return Response({"success": False, "message": f"The payment cannot exceed the outstanding balance of R {balance:,.2f}."}, status=status.HTTP_400_BAD_REQUEST)
            if funding_payment.currency != "ZAR":
                return Response({"success": False, "message": "PayFast checkout is currently available for ZAR balances only."}, status=status.HTTP_409_CONFLICT)
            if mode == "live" and amount_to_pay < Decimal("5.00"):
                return Response({"success": False, "message": "PayFast live transactions must be at least R5.00."}, status=status.HTTP_400_BAD_REQUEST)
            remaining_after_payment = balance - amount_to_pay
            if mode == "live" and Decimal("0.00") < remaining_after_payment < Decimal("5.00"):
                return Response({"success": False, "message": "Choose an amount that either settles the balance or leaves at least R5.00 for a later PayFast payment."}, status=status.HTTP_400_BAD_REQUEST)

            will_confirm_booking = (
                not Booking.objects.filter(application_id=application_id).exists()
                and funding_payment.amount_paid + amount_to_pay >= first_rent_installment_due(funding_payment)
            )
            if will_confirm_booking:
                room = Room.objects.select_for_update().get(id=funding_payment.application.room_id)
                sync_room_status(room)
                available_bed = room.beds.select_for_update().filter(status="AVAILABLE").order_by("id").first()
                if room.status != Room.RoomStatus.AVAILABLE or not available_bed:
                    return Response(
                        {"success": False, "message": "No bed remains available in the selected room. Contact StudentHaven before paying the first month's rent."},
                        status=status.HTTP_409_CONFLICT,
                    )

            expected_provider = "PAYFAST" if mode == "live" else "PAYFAST_SANDBOX"
            pending_transactions = PaymentTransaction.objects.select_for_update().filter(
                funding_payment=funding_payment,
                provider__in=["PAYFAST", "PAYFAST_SANDBOX"],
                status=PaymentTransaction.Status.PROCESSING,
            ).order_by("-created_at")
            pending_transaction = pending_transactions.first()
            if pending_transaction and (
                pending_transaction.provider != expected_provider
                or pending_transaction.amount != amount_to_pay
            ):
                return Response({"success": False, "message": "An earlier PayFast checkout is still processing with different payment settings or balance. Finish or cancel that checkout before starting another."}, status=status.HTTP_409_CONFLICT)
            transaction_record = pending_transaction
            if not transaction_record:
                reference = f"SH-PF-{uuid.uuid4().hex[:16].upper()}"
                transaction_record = PaymentTransaction.objects.create(
                    funding_payment=funding_payment,
                    transaction_reference=reference,
                    provider=expected_provider,
                    amount=amount_to_pay,
                    currency=funding_payment.currency,
                    status=PaymentTransaction.Status.PROCESSING,
                )
            funding_payment.payment_status = FundingPayment.PaymentStatus.PROCESSING
            funding_payment.payment_reference = transaction_record.transaction_reference
            funding_payment.save(update_fields=["payment_status", "payment_reference", "updated_at"])

            return Response({
                "success": True,
                "checkout_url": process_url(),
                "form_fields": checkout_fields(transaction=transaction_record, funding_payment=funding_payment),
                "transaction_reference": transaction_record.transaction_reference,
                "amount": str(transaction_record.amount),
            }, status=status.HTTP_200_OK)


class PayFastCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, application_id):
        if request.user.role != User.Role.STUDENT:
            return Response({"success": False, "message": "Student access required."}, status=status.HTTP_403_FORBIDDEN)
        with transaction.atomic():
            funding_payment = FundingPayment.objects.select_for_update().filter(
                application_id=application_id, student=request.user,
            ).first()
            if not funding_payment:
                return Response({"success": False, "message": "Funding payment record was not found."}, status=status.HTTP_404_NOT_FOUND)
            pending = PaymentTransaction.objects.select_for_update().filter(
                funding_payment=funding_payment,
                provider__in=["PAYFAST", "PAYFAST_SANDBOX"],
                status=PaymentTransaction.Status.PROCESSING,
                transaction_reference=request.data.get("transaction_reference", ""),
            ).order_by("-created_at").first()
            if pending:
                pending.status = PaymentTransaction.Status.FAILED
                pending.processed_at = timezone.now()
                pending.save(update_fields=["status", "processed_at", "updated_at"])
                if funding_payment.amount_paid < funding_payment.amount_due:
                    funding_payment.payment_status = FundingPayment.PaymentStatus.PENDING
                    funding_payment.save(update_fields=["payment_status", "updated_at"])
        return Response({"success": True, "message": "Checkout was cancelled. No payment was recorded."})


class PayFastITNView(APIView):
    """Public PayFast callback. Trust is established only after all checks pass."""

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        if not payfast_is_configured():
            return Response({"success": False, "message": "PayFast is not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        form = request._request.POST
        posted = {}
        for key, values in form.lists():
            if len(values) != 1:
                return Response({"success": False, "message": "Duplicate notification fields are not accepted."}, status=status.HTTP_400_BAD_REQUEST)
            posted[key] = values[0]
        if posted.get("merchant_id", "") != settings.PAYFAST_MERCHANT_ID:
            return Response({"success": False, "message": "Notification merchant does not match this installation."}, status=status.HTTP_403_FORBIDDEN)
        if not is_valid_payfast_ip(request.META.get("REMOTE_ADDR", "")):
            return Response({"success": False, "message": "Notification source is not an approved PayFast address."}, status=status.HTTP_403_FORBIDDEN)
        if not is_valid_itn_signature(posted):
            return Response({"success": False, "message": "Notification signature validation failed."}, status=status.HTTP_400_BAD_REQUEST)
        if not confirm_itn_with_payfast(posted):
            return Response({"success": False, "message": "PayFast could not confirm this notification."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        reference = posted.get("m_payment_id", "")
        transaction_record = PaymentTransaction.objects.filter(
            transaction_reference=reference,
            provider__in=["PAYFAST", "PAYFAST_SANDBOX"],
        ).first()
        if not transaction_record:
            return Response({"success": False, "message": "Payment reference was not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            gross_amount = Decimal(posted.get("amount_gross", "0")).quantize(Decimal("0.01"))
        except Exception:
            return Response({"success": False, "message": "Notification amount is invalid."}, status=status.HTTP_400_BAD_REQUEST)
        if not gross_amount.is_finite() or gross_amount < 0:
            return Response({"success": False, "message": "Notification amount is invalid."}, status=status.HTTP_400_BAD_REQUEST)
        if posted.get("currency", "").upper() != transaction_record.currency or gross_amount != transaction_record.amount:
            return Response({"success": False, "message": "Notification amount or currency does not match this checkout."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            transaction_record = PaymentTransaction.objects.select_for_update().select_related(
                "funding_payment__application__property",
                "funding_payment__application__room",
                "funding_payment__contract",
                "funding_payment__student",
            ).get(id=transaction_record.id)
            funding_payment = FundingPayment.objects.select_for_update().get(id=transaction_record.funding_payment_id)
            if transaction_record.status == PaymentTransaction.Status.SUCCESSFUL:
                return Response({"success": True, "message": "Notification already processed."}, status=status.HTTP_200_OK)

            if transaction_record.provider == "PAYFAST" and payfast_mode() != "live":
                return Response({"success": False, "message": "Live payment notification received while PayFast is in sandbox mode."}, status=status.HTTP_400_BAD_REQUEST)
            if transaction_record.provider == "PAYFAST_SANDBOX" and payfast_mode() != "sandbox":
                return Response({"success": False, "message": "Sandbox payment notification received while PayFast is not in sandbox mode."}, status=status.HTTP_400_BAD_REQUEST)

            if posted.get("payment_status", "").upper() != "COMPLETE":
                transaction_record.status = PaymentTransaction.Status.FAILED
                transaction_record.processed_at = timezone.now()
                transaction_record.save(update_fields=["status", "processed_at", "updated_at"])
                if funding_payment.amount_paid < funding_payment.amount_due:
                    funding_payment.payment_status = FundingPayment.PaymentStatus.FAILED
                    funding_payment.save(update_fields=["payment_status", "updated_at"])
                return Response({"success": True, "message": "Payment was not completed."}, status=status.HTTP_200_OK)

            transaction_record.status = PaymentTransaction.Status.SUCCESSFUL
            transaction_record.processed_at = timezone.now()
            transaction_record.save(update_fields=["status", "processed_at", "updated_at"])
            apply_funding_payment_delta(
                funding_payment,
                transaction_record.amount,
                (posted.get("pf_payment_id") or reference)[:100],
            )
            balance = max(Decimal("0.00"), funding_payment.amount_due - funding_payment.amount_paid)
            record_audit_event(
                actor=funding_payment.student,
                action="PAYMENT_RECEIVED_PAYFAST",
                entity_type="funding_payment",
                entity_id=funding_payment.id,
                summary="PayFast confirmed a student accommodation payment",
                metadata={"transaction_reference": reference, "provider_payment_id": posted.get("pf_payment_id", ""), "amount": str(transaction_record.amount), "currency": transaction_record.currency},
                request=request,
            )

            if funding_payment.amount_paid >= first_rent_installment_due(funding_payment):
                booking, _ = finalize_booking_after_initial_rent(funding_payment)
                if not booking:
                    notify_admin_payment_allocation_needed(funding_payment, reference)
                else:
                    create_notification(
                        recipient=funding_payment.student,
                        actor=funding_payment.student,
                        notification_type="PAYMENT_SUCCESSFUL",
                        title="Payment received",
                        message=f"PayFast confirmed your payment of {transaction_record.currency} {transaction_record.amount:.2f}.",
                        application=funding_payment.application,
                        extra_data={"payment_reference": funding_payment.payment_reference},
                    )
            else:
                create_notification(
                    recipient=funding_payment.student,
                    actor=funding_payment.student,
                    notification_type="PAYMENT_SUCCESSFUL",
                    title="Partial payment received",
                    message=f"PayFast confirmed your payment of {transaction_record.currency} {transaction_record.amount:.2f}. Balance remaining: {funding_payment.currency} {balance:.2f}.",
                    application=funding_payment.application,
                    extra_data={"payment_reference": funding_payment.payment_reference, "balance": str(balance)},
                )

        return Response({"success": True, "message": "PayFast payment notification processed."}, status=status.HTTP_200_OK)


class LandlordFundingRecordsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != "LANDLORD":
            return Response({"success": False, "message": "Landlord access required."}, status=status.HTTP_403_FORBIDDEN)
        records = FundingPayment.objects.filter(
            application__property__landlord=request.user,
        ).select_related(
            "student", "application__property", "contract",
        ).prefetch_related("transactions").order_by("-updated_at")
        payment_status = request.query_params.get("status")
        if payment_status in FundingPayment.PaymentStatus.values:
            records = records.filter(payment_status=payment_status)
        serializer = FundingPaymentSerializer(records, many=True)
        return Response({"success": True, "count": records.count(), "funding_payments": serializer.data})
