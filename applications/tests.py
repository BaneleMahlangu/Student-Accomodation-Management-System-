from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from accommodations.models import Bed, Building, Campus, Floor, Property, Room, RoomType, University
from applications.models import Application, ApplicationStatusHistory
from contracts.models import Contract


class ApplicationDecisionWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="admin@example.test",
            password="Test-password-123",
            first_name="Admin",
            last_name="Reviewer",
            role=User.Role.ADMINISTRATOR,
        )
        self.client.force_authenticate(self.admin)
        self.student = User.objects.create_user(
            email="student@example.test",
            password="Test-password-123",
            first_name="Sam",
            last_name="Student",
            role=User.Role.STUDENT,
        )
        self.landlord = User.objects.create_user(
            email="landlord@example.test",
            password="Test-password-123",
            first_name="Lee",
            last_name="Landlord",
            role=User.Role.LANDLORD,
        )
        university = University.objects.create(name="Test University", code="TU", city="Cape Town", province="Western Cape")
        campus = Campus.objects.create(university=university, name="Main", address="1 Test Road")
        property_obj = Property.objects.create(
            landlord=self.landlord,
            campus=campus,
            name="Student House",
            property_type=Property.PropertyType.STUDENT_RESIDENCE,
            description="Test accommodation",
            address="1 Test Road",
        )
        self.property = property_obj
        building = Building.objects.create(property=property_obj, name="A")
        floor = Floor.objects.create(building=building, floor_number=1)
        room_type = RoomType.objects.create(name="Single")
        room = Room.objects.create(floor=floor, room_type=room_type, room_number="1A", monthly_price=5000)
        self.room = room
        Bed.objects.create(room=room, bed_number="A")
        self.application = Application.objects.create(
            student=self.student,
            property=property_obj,
            room=room,
            status=Application.Status.DECLINED,
            submitted_at=timezone.now(),
            decline_reason="Original reason",
        )

    def test_student_can_resume_the_same_saved_draft(self):
        self.property.status = Property.PropertyStatus.APPROVED
        self.property.save(update_fields=["status", "updated_at"])
        self.client.force_authenticate(self.student)

        create = self.client.post(
            reverse("application-create"),
            {"property": self.property.id, "room": self.room.id},
            format="json",
        )
        self.assertEqual(create.status_code, 201)
        application_id = create.data["application"]["id"]

        save = self.client.patch(
            reverse("application-detail", kwargs={"application_id": application_id}),
            {
                "current_step": 3,
                "emergency_contact_name": "A saved contact",
                "emergency_contact_phone": "0712345678",
                "university": "Test University",
            },
            format="json",
        )
        self.assertEqual(save.status_code, 200)

        resume = self.client.post(
            reverse("application-create"),
            {"property": self.property.id, "room": self.room.id},
            format="json",
        )
        self.assertEqual(resume.status_code, 200)
        self.assertTrue(resume.data["existing"])
        self.assertEqual(resume.data["application"]["id"], application_id)
        self.assertEqual(resume.data["application"]["current_step"], 3)
        self.assertEqual(
            resume.data["application"]["emergency_contact_name"],
            "A saved contact",
        )
        self.assertEqual(
            Application.objects.filter(
                student=self.student,
                property=self.property,
                room=self.room,
                status=Application.Status.DRAFT,
            ).count(),
            1,
        )

    def test_previously_hidden_inventory_is_restored_to_discovery_and_applications(self):
        self.property.status = Property.PropertyStatus.APPROVED
        self.property.is_demo = True
        self.property.save(update_fields=["status", "is_demo", "updated_at"])

        discovery = APIClient().get(reverse("property-list"))
        self.assertEqual(discovery.status_code, 200)
        self.assertIn(
            self.property.id,
            [row["id"] for row in discovery.data["properties"]],
        )
        detail = APIClient().get(reverse("property-detail", kwargs={"property_id": self.property.id}))
        self.assertEqual(detail.status_code, 200)

        self.client.force_authenticate(self.student)
        create = self.client.post(
            reverse("application-create"),
            {"property": self.property.id, "room": self.room.id},
            format="json",
        )
        self.assertEqual(create.status_code, 201)

    def test_reopened_decision_can_be_replaced_and_contract_is_reissued(self):
        reopen = self.client.post(
            reverse("application-reopen-review", kwargs={"application_id": self.application.id}),
            {"note": "Please verify updated supporting documents."},
            format="json",
        )
        self.assertEqual(reopen.status_code, 200)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Application.Status.UNDER_REVIEW)
        self.assertEqual(self.application.decline_reason, "")
        self.assertEqual(self.application.status_history.count(), 1)

        decision = self.client.post(
            reverse("application-decision", kwargs={"application_id": self.application.id}),
            {"decision": "APPROVED", "note": "Documents verified."},
            format="json",
        )
        self.assertEqual(decision.status_code, 200)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Application.Status.APPROVED)
        self.assertEqual(self.application.status_history.count(), 2)
        self.assertEqual(self.application.contract.status, Contract.Status.PENDING_SIGNATURE)

    def test_signed_contract_prevents_reopening_without_changing_decision(self):
        self.application.status = Application.Status.APPROVED
        self.application.save(update_fields=["status", "updated_at"])
        Contract.objects.create(
            application=self.application,
            student=self.student,
            contract_number="SH-C-TEST-SIGNED",
            property_name="Student House",
            room_number="1A",
            monthly_fee=5000,
            status=Contract.Status.SIGNED,
            signed_at=timezone.now(),
            signature_name="Sam Student",
        )

        response = self.client.post(
            reverse("application-reopen-review", kwargs={"application_id": self.application.id}),
            {},
            format="json",
        )
        self.assertEqual(response.status_code, 409)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Application.Status.APPROVED)

    def test_additional_information_request_can_resume_review(self):
        self.application.status = Application.Status.UNDER_REVIEW
        self.application.save(update_fields=["status", "updated_at"])
        request_info = self.client.post(
            reverse("application-decision", kwargs={"application_id": self.application.id}),
            {"decision": "ADDITIONAL_INFO", "note": "Please upload your current registration letter."},
            format="json",
        )
        self.assertEqual(request_info.status_code, 200)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Application.Status.ADDITIONAL_INFO)

        resume = self.client.post(
            reverse("application-start-review", kwargs={"application_id": self.application.id}),
            {},
            format="json",
        )
        self.assertEqual(resume.status_code, 200)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Application.Status.UNDER_REVIEW)
        self.assertEqual(self.application.status_history.count(), 2)
