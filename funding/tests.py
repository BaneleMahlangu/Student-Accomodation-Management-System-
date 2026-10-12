from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from accommodations.models import Bed, Building, Campus, Floor, Property, Room, RoomType, University
from applications.models import Application
from bookings.models import Booking
from contracts.models import Contract
from contracts.rent import calculate_rent_schedule, calculate_stay_rent

from .models import FundingPayment


class AccommodationRentScheduleTests(TestCase):
    def test_full_months_and_final_partial_month_are_calculated_from_stay_dates(self):
        schedule = calculate_rent_schedule(date(2026, 1, 15), date(2026, 3, 1), Decimal("6000.00"))
        self.assertEqual([row["amount"] for row in schedule], [Decimal("6000.00"), Decimal("3000.00")])
        self.assertEqual(calculate_stay_rent(date(2026, 1, 15), date(2026, 3, 1), Decimal("6000.00")), Decimal("9000.00"))

    def test_month_end_checkin_keeps_its_anniversary_after_february(self):
        schedule = calculate_rent_schedule(date(2026, 1, 31), date(2026, 3, 31), Decimal("5000.00"))
        self.assertEqual([(row["start_date"], row["end_date"]) for row in schedule], [
            (date(2026, 1, 31), date(2026, 2, 28)),
            (date(2026, 2, 28), date(2026, 3, 31)),
        ])
        self.assertEqual(calculate_stay_rent(date(2026, 1, 31), date(2026, 3, 31), Decimal("5000.00")), Decimal("10000.00"))

    def test_invalid_dates_or_nonpositive_rent_produce_no_charges(self):
        self.assertEqual(calculate_stay_rent(date(2026, 3, 1), date(2026, 3, 1), Decimal("5000.00")), Decimal("0.00"))
        self.assertEqual(calculate_stay_rent(date(2026, 3, 1), date(2026, 4, 1), Decimal("0.00")), Decimal("0.00"))


@override_settings(DEBUG=True, PAYMENT_SIMULATOR_ENABLED=True)
class StudentInstallmentPaymentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student = User.objects.create_user(
            email="student-payments@example.test", password="Testing-password-123",
            first_name="Casey", last_name="Student", role=User.Role.STUDENT,
        )
        landlord = User.objects.create_user(
            email="landlord-payments@example.test", password="Testing-password-123",
            first_name="Lee", last_name="Landlord", role=User.Role.LANDLORD,
        )
        university = University.objects.create(name="Payment University", code="PU", city="Cape Town", province="Western Cape")
        campus = Campus.objects.create(university=university, name="Main", address="1 Test Road")
        property_obj = Property.objects.create(
            landlord=landlord, campus=campus, name="Payment House",
            property_type=Property.PropertyType.STUDENT_RESIDENCE,
            description="Payment workflow test", address="1 Test Road",
        )
        building = Building.objects.create(property=property_obj, name="A")
        floor = Floor.objects.create(building=building, floor_number=1)
        room_type = RoomType.objects.create(name="Payment Single")
        room = Room.objects.create(floor=floor, room_type=room_type, room_number="1A", monthly_price=5000)
        self.bed = Bed.objects.create(room=room, bed_number="A")
        self.application = Application.objects.create(
            student=self.student, property=property_obj, room=room,
            status=Application.Status.APPROVED,
            expected_sign_in_date=date(2026, 1, 1), expected_sign_out_date=date(2026, 4, 1),
        )
        self.contract = Contract.objects.create(
            application=self.application, student=self.student, contract_number="SH-C-PAYMENT-TEST",
            property_name=property_obj.name, room_number=room.room_number,
            start_date=date(2026, 1, 1), end_date=date(2026, 4, 1), monthly_fee=Decimal("5000.00"),
            status=Contract.Status.SIGNED,
        )
        self.funding_payment = FundingPayment.objects.create(
            contract=self.contract, application=self.application, student=self.student,
            funding_method=Application.FundingMethod.SELF_PAY, amount_due=Decimal("15000.00"), currency="ZAR",
        )
        self.client.force_authenticate(self.student)

    def test_partial_payment_updates_paid_balance_and_monthly_schedule_without_confirming_booking(self):
        response = self.client.post(
            reverse("student-payment", kwargs={"application_id": self.application.id}),
            {"amount": "3000.00"}, format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.funding_payment.refresh_from_db()
        self.assertEqual(self.funding_payment.amount_paid, Decimal("3000.00"))
        self.assertEqual(response.data["funding_payment"]["balance"], Decimal("12000.00"))
        self.assertEqual(response.data["funding_payment"]["remaining_months"], 3)
        self.assertEqual(response.data["funding_payment"]["rent_schedule"][0]["status"], "PARTIALLY_PAID")
        self.assertFalse(Booking.objects.filter(application=self.application).exists())
        self.bed.refresh_from_db()
        self.assertEqual(self.bed.status, Bed.BedStatus.AVAILABLE)

    def test_first_month_rent_confirms_booking_while_later_months_remain_due(self):
        response = self.client.post(
            reverse("student-payment", kwargs={"application_id": self.application.id}),
            {"amount": "5000.00"}, format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.funding_payment.refresh_from_db()
        booking = Booking.objects.get(application=self.application)
        self.bed.refresh_from_db()
        self.assertEqual(self.funding_payment.payment_status, FundingPayment.PaymentStatus.PENDING)
        self.assertEqual(self.funding_payment.amount_paid, Decimal("5000.00"))
        self.assertEqual(response.data["funding_payment"]["balance"], Decimal("10000.00"))
        self.assertTrue(response.data["funding_payment"]["booking_confirmed"])
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)
        self.assertEqual(self.bed.status, Bed.BedStatus.RESERVED)

    def test_overpayment_is_rejected_without_changing_the_balance(self):
        response = self.client.post(
            reverse("student-payment", kwargs={"application_id": self.application.id}),
            {"amount": "15000.01"}, format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.funding_payment.refresh_from_db()
        self.assertEqual(self.funding_payment.amount_paid, Decimal("0.00"))

    @override_settings(PAYMENT_SIMULATOR_ENABLED=False)
    def test_simulated_payment_requires_explicit_local_enablement(self):
        response = self.client.post(
            reverse("student-payment", kwargs={"application_id": self.application.id}),
            {"amount": "5000.00"}, format="json",
        )
        self.assertEqual(response.status_code, 503)
        self.funding_payment.refresh_from_db()
        self.assertEqual(self.funding_payment.amount_paid, Decimal("0.00"))
        self.assertEqual(self.funding_payment.transactions.count(), 0)

    def test_first_month_payment_is_not_recorded_when_room_has_no_available_bed(self):
        self.bed.status = Bed.BedStatus.OCCUPIED
        self.bed.save(update_fields=["status"])
        response = self.client.post(
            reverse("student-payment", kwargs={"application_id": self.application.id}),
            {"amount": "5000.00"}, format="json",
        )
        self.assertEqual(response.status_code, 409)
        self.funding_payment.refresh_from_db()
        self.assertEqual(self.funding_payment.amount_paid, Decimal("0.00"))

    def test_remainder_payment_settles_balance_and_confirms_booking(self):
        self.client.post(
            reverse("student-payment", kwargs={"application_id": self.application.id}),
            {"amount": "7000.00"}, format="json",
        )
        response = self.client.post(
            reverse("student-payment", kwargs={"application_id": self.application.id}),
            {"amount": "8000.00"}, format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.funding_payment.refresh_from_db()
        self.assertEqual(self.funding_payment.amount_paid, Decimal("15000.00"))
        self.assertEqual(self.funding_payment.payment_status, FundingPayment.PaymentStatus.SUCCESSFUL)
        self.assertEqual(response.data["funding_payment"]["remaining_months"], 0)
        self.assertTrue(Booking.objects.filter(application=self.application).exists())

    def test_contract_signature_sets_total_rent_from_the_full_stay(self):
        self.contract.status = Contract.Status.PENDING_SIGNATURE
        self.contract.save(update_fields=["status", "updated_at"])
        self.funding_payment.amount_due = Decimal("5000.00")
        self.funding_payment.save(update_fields=["amount_due", "updated_at"])

        response = self.client.post(
            reverse("sign-student-contract", kwargs={"application_id": self.application.id}),
            {"confirmation": True, "signature_name": "Casey Student"}, format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.funding_payment.refresh_from_db()
        self.assertEqual(self.funding_payment.amount_due, Decimal("15000.00"))
        self.assertEqual(self.funding_payment.due_date, date(2026, 1, 1))

    @patch("funding.views.payfast_mode", return_value="sandbox")
    @patch("funding.views.payfast_is_configured", return_value=True)
    @patch("funding.views.process_url", return_value="https://sandbox.payfast.example/eng/process")
    @patch("funding.views.checkout_fields", return_value={"amount": "6000.00"})
    def test_payfast_checkout_uses_custom_installment_and_reuses_its_pending_reference(
        self, _fields, _url, _configured, _mode
    ):
        route = reverse("payfast-checkout", kwargs={"application_id": self.application.id})
        first = self.client.post(route, {"amount": "6000.00"}, format="json")
        second = self.client.post(route, {"amount": "6000.00"}, format="json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data["amount"], "6000.00")
        self.assertEqual(second.data["transaction_reference"], first.data["transaction_reference"])
        self.assertEqual(self.funding_payment.transactions.count(), 1)
        self.assertEqual(self.funding_payment.transactions.get().amount, Decimal("6000.00"))

    @patch("funding.views.payfast_mode", return_value="sandbox")
    @patch("funding.views.payfast_is_configured", return_value=True)
    def test_payfast_checkout_rejects_an_installment_above_the_balance(self, _configured, _mode):
        response = self.client.post(
            reverse("payfast-checkout", kwargs={"application_id": self.application.id}),
            {"amount": "15000.01"}, format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.funding_payment.transactions.count(), 0)
