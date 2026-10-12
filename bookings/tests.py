from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import LandlordProfile, User
from accommodations.models import Bed, Building, Campus, Floor, Property, Room, RoomType, University
from applications.models import Application
from contracts.models import Contract
from contracts.rent import calculate_stay_rent
from funding.models import FundingPayment

from .models import Booking, CheckInRecord


class StaffCheckInWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student = User.objects.create_user(
            email="student-checkin@example.test",
            password="Testing-password-123",
            first_name="Casey",
            last_name="Student",
            role=User.Role.STUDENT,
        )
        self.landlord = User.objects.create_user(
            email="landlord-checkin@example.test",
            password="Testing-password-123",
            first_name="Lee",
            last_name="Landlord",
            role=User.Role.LANDLORD,
        )
        self.admin = User.objects.create_user(
            email="admin-checkin@example.test",
            password="Testing-password-123",
            first_name="Ari",
            last_name="Admin",
            role=User.Role.ADMINISTRATOR,
        )
        university = University.objects.create(name="Check-in University", code="CIU", city="Cape Town", province="Western Cape")
        campus = Campus.objects.create(university=university, name="Main", address="1 Test Road")
        self.property = Property.objects.create(
            landlord=self.landlord,
            campus=campus,
            name="Check-in House",
            property_type=Property.PropertyType.STUDENT_RESIDENCE,
            description="Check-in workflow test",
            address="1 Test Road",
        )
        building = Building.objects.create(property=self.property, name="A")
        floor = Floor.objects.create(building=building, floor_number=1)
        room_type = RoomType.objects.create(name="Check-in Single")
        self.room = Room.objects.create(floor=floor, room_type=room_type, room_number="1A", monthly_price=5000)
        self.bed = Bed.objects.create(room=self.room, bed_number="A", status=Bed.BedStatus.RESERVED)

        today = timezone.localdate()
        stay_end = today + timedelta(days=90)
        self.application = Application.objects.create(
            student=self.student,
            property=self.property,
            room=self.room,
            status=Application.Status.APPROVED,
            expected_sign_in_date=today,
            expected_sign_out_date=stay_end,
        )
        self.contract = Contract.objects.create(
            application=self.application,
            student=self.student,
            contract_number="SH-C-CHECKIN-TEST",
            property_name=self.property.name,
            room_number=self.room.room_number,
            start_date=today,
            end_date=stay_end,
            monthly_fee=Decimal("5000.00"),
            status=Contract.Status.SIGNED,
        )
        self.funding_payment = FundingPayment.objects.create(
            contract=self.contract,
            application=self.application,
            student=self.student,
            funding_method=Application.FundingMethod.SELF_PAY,
            funding_status=FundingPayment.FundingStatus.VERIFIED,
            payment_status=FundingPayment.PaymentStatus.PENDING,
            amount_due=calculate_stay_rent(today, stay_end, Decimal("5000.00")),
            amount_paid=Decimal("5000.00"),
            currency="ZAR",
        )
        self.booking = Booking.objects.create(
            booking_number="SH-B-CHECKIN-TEST",
            application=self.application,
            contract=self.contract,
            student=self.student,
            property=self.property,
            room=self.room,
            bed=self.bed,
            start_date=today,
            end_date=stay_end,
            monthly_fee=Decimal("5000.00"),
        )
        self.preview_url = reverse("check-in-preview")
        self.confirm_url = reverse("staff-check-in")
        self.client.force_authenticate(self.admin)

    def confirmation_payload(self):
        return {
            "token": str(self.booking.check_in_token),
            "identity_document_type": CheckInRecord.IdentityDocumentType.NATIONAL_ID,
            "identity_verified": True,
            "room_inspected": True,
            "keys_handed_over": True,
            "arrival_notes": "Room condition and access handover checked.",
        }

    def test_student_cannot_check_themselves_in_with_one_click(self):
        self.client.force_authenticate(self.student)
        response = self.client.post(
            reverse("student-check-in", kwargs={"application_id": self.application.id}),
            {},
            format="json",
        )
        self.assertEqual(response.status_code, 409)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.CONFIRMED)
        self.assertFalse(CheckInRecord.objects.filter(booking=self.booking).exists())

    def test_scanning_qr_only_previews_the_booking(self):
        response = self.client.post(self.preview_url, {"token": str(self.booking.check_in_token)}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["booking"]["booking_number"], self.booking.booking_number)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.CONFIRMED)
        self.assertFalse(CheckInRecord.objects.filter(booking=self.booking).exists())

    def test_staff_must_complete_the_in_person_checklist_before_confirming(self):
        response = self.client.post(self.confirm_url, {"token": str(self.booking.check_in_token)}, format="json")
        self.assertEqual(response.status_code, 400)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.CONFIRMED)
        self.assertFalse(CheckInRecord.objects.filter(booking=self.booking).exists())

    def test_verified_staff_checkin_records_arrival_and_occupies_the_bed(self):
        response = self.client.post(self.confirm_url, self.confirmation_payload(), format="json")
        self.assertEqual(response.status_code, 200)
        self.booking.refresh_from_db()
        self.bed.refresh_from_db()
        self.room.refresh_from_db()
        record = CheckInRecord.objects.get(booking=self.booking)
        self.assertEqual(self.booking.status, Booking.Status.ACTIVE)
        self.assertEqual(self.bed.status, Bed.BedStatus.OCCUPIED)
        self.assertEqual(self.bed.current_student, self.student)
        self.assertEqual(self.room.status, Room.RoomStatus.OCCUPIED)
        self.assertEqual(record.checked_in_by, self.admin)
        self.assertTrue(record.identity_verified)
        self.assertTrue(record.room_inspected)
        self.assertTrue(record.keys_handed_over)
        self.assertEqual(response.data["booking"]["check_in_record"]["staff_name"], "Ari Admin")

    def test_verified_landlord_can_check_in_at_their_own_property(self):
        LandlordProfile.objects.create(user=self.landlord, verification_status="VERIFIED")
        self.client.force_authenticate(self.landlord)
        response = self.client.post(self.preview_url, {"token": str(self.booking.check_in_token)}, format="json")
        self.assertEqual(response.status_code, 200)

    def test_unverified_landlord_cannot_check_in_a_student(self):
        self.client.force_authenticate(self.landlord)
        response = self.client.post(self.preview_url, {"token": str(self.booking.check_in_token)}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_checkin_is_blocked_if_first_month_rent_is_not_confirmed(self):
        self.funding_payment.amount_paid = Decimal("4999.99")
        self.funding_payment.save(update_fields=["amount_paid", "updated_at"])
        response = self.client.post(self.preview_url, {"token": str(self.booking.check_in_token)}, format="json")
        self.assertEqual(response.status_code, 409)

    def test_checkin_is_blocked_if_the_reserved_bed_was_released(self):
        self.bed.status = Bed.BedStatus.AVAILABLE
        self.bed.save(update_fields=["status"])
        response = self.client.post(self.preview_url, {"token": str(self.booking.check_in_token)}, format="json")
        self.assertEqual(response.status_code, 409)
