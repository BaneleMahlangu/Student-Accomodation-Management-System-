import re
from unittest.mock import patch

from django.core import mail
from django.test import TestCase
from django.urls import reverse
from django.test import override_settings
from rest_framework.test import APIClient

from analytics.models import AuditEvent
from accounts.models import AccountCode, LoginEvent, User
from complaints.models import Complaint


class AdminAccountDeletionTests(TestCase):
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

    def test_delete_requires_exact_account_email(self):
        response = self.client.delete(
            reverse("admin-account-delete", kwargs={"kind": "students", "user_id": self.student.id}),
            {"confirmation_email": "wrong@example.test"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.student.pk).exists())

    def test_admin_can_permanently_delete_unreferenced_account(self):
        student_id = self.student.id
        LoginEvent.objects.create(
            user=self.student,
            outcome=LoginEvent.Outcome.SUCCESSFUL,
            ip_address="192.0.2.4",
            user_agent="test browser",
        )
        response = self.client.delete(
            reverse("admin-account-delete", kwargs={"kind": "students", "user_id": student_id}),
            {"confirmation_email": self.student.email},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(pk=student_id).exists())
        self.assertEqual(LoginEvent.objects.count(), 0)
        self.assertTrue(AuditEvent.objects.filter(action="ACCOUNT_PERMANENTLY_DELETED", entity_id=student_id).exists())

    def test_protected_case_history_prevents_account_deletion(self):
        Complaint.objects.create(
            student=self.student,
            category=Complaint.Category.OTHER,
            title="Test concern",
            description="A record that must remain available for review.",
        )
        response = self.client.delete(
            reverse("admin-account-delete", kwargs={"kind": "students", "user_id": self.student.id}),
            {"confirmation_email": self.student.email},
            format="json",
        )
        self.assertEqual(response.status_code, 409)
        self.assertTrue(User.objects.filter(pk=self.student.pk).exists())


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class RegistrationEmailWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def student_payload(self, email="new.student@example.test"):
        return {
            "first_name": "New",
            "last_name": "Student",
            "email": email,
            "mobile": "0712345678",
            "password": "Student-password-123!",
            "password_confirm": "Student-password-123!",
            "student_number": "STU-2026-001",
            "university": "Test University",
            "campus": "Main Campus",
            "course": "Information Technology",
            "year_of_study": 1,
        }

    def test_student_can_resend_immediately_then_verify_and_sign_in(self):
        response = self.client.post(
            reverse("student-register"), self.student_payload(), format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["verification_email_sent"])
        self.assertEqual(len(mail.outbox), 1)

        user = User.objects.get(email="new.student@example.test")
        self.assertFalse(user.is_verified)

        resend = self.client.post(
            reverse("resend-verification-code"),
            {"email": user.email},
            format="json",
        )
        self.assertEqual(resend.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(
            AccountCode.objects.filter(
                user=user,
                purpose=AccountCode.Purpose.VERIFY_EMAIL,
                consumed_at__isnull=True,
            ).count(),
            2,
        )

        # A delayed first email must remain usable after the user requests another.
        match = re.search(r"(?<!\d)\d{6}(?!\d)", mail.outbox[0].body)
        self.assertIsNotNone(match)
        verified = self.client.post(
            reverse("verify-email"),
            {"email": user.email, "code": match.group(0)},
            format="json",
        )
        self.assertEqual(verified.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.is_verified)

        login = self.client.post(
            reverse("login"),
            {"email": user.email, "password": "Student-password-123!"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.data["success"])

    def test_landlord_registration_also_sends_a_verification_code(self):
        response = self.client.post(
            reverse("landlord-register"),
            {
                "first_name": "New",
                "last_name": "Landlord",
                "email": "new.landlord@example.test",
                "mobile": "0723456789",
                "password": "Landlord-password-123!",
                "password_confirm": "Landlord-password-123!",
                "business_name": "New Student Homes",
                "registration_number": "",
                "phone": "0723456789",
                "address": "1 Test Road, Cape Town",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["verification_email_sent"])
        self.assertEqual(len(mail.outbox), 1)
        landlord = User.objects.get(email="new.landlord@example.test")
        self.assertEqual(landlord.landlord_profile.verification_status, "PENDING")

    @patch("accounts.services.send_mail", return_value=0)
    def test_failed_email_is_reported_and_resend_can_retry(self, send_mail_mock):
        email = "mail.retry@example.test"
        response = self.client.post(
            reverse("student-register"), self.student_payload(email), format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["verification_email_sent"])

        user = User.objects.get(email=email)
        self.assertFalse(
            AccountCode.objects.filter(
                user=user,
                purpose=AccountCode.Purpose.VERIFY_EMAIL,
                consumed_at__isnull=True,
            ).exists()
        )

        retry = self.client.post(
            reverse("resend-verification-code"), {"email": email}, format="json"
        )
        self.assertEqual(retry.status_code, 503)
        self.assertEqual(send_mail_mock.call_count, 2)
