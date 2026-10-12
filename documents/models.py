from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from applications.models import Application
from .storage import PrivateDocumentStorage


class Document(models.Model):

    class DocumentType(models.TextChoices):
        PROOF_OF_REGISTRATION = (
            "PROOF_OF_REGISTRATION",
            "Proof of Registration",
        )

        STUDENT_ID = (
            "STUDENT_ID",
            "Student ID",
        )

        FUNDING_CONFIRMATION = (
            "FUNDING_CONFIRMATION",
            "Funding Confirmation",
        )

        BURSARY_SPONSORSHIP = (
            "BURSARY_SPONSORSHIP",
            "Bursary / Sponsorship",
        )

        OTHER = (
            "OTHER",
            "Other",
        )

    class Status(models.TextChoices):
        PROCESSING = (
            "PROCESSING",
            "Processing",
        )

        VERIFIED = (
            "VERIFIED",
            "Verified",
        )

        NEEDS_REVIEW = (
            "NEEDS_REVIEW",
            "Needs Review",
        )

        REJECTED = (
            "REJECTED",
            "Rejected",
        )

    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name="documents",
    )

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="documents",
        limit_choices_to={"role": "STUDENT"},
    )

    document_type = models.CharField(
        max_length=40,
        choices=DocumentType.choices,
    )

    file = models.FileField(
        upload_to="documents/%Y/%m/%d/",
        storage=PrivateDocumentStorage(),
    )

    original_filename = models.CharField(
        max_length=255,
    )

    content_sha256 = models.CharField(max_length=64, blank=True, default="", db_index=True)

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PROCESSING,
    )

    verification_notes = models.TextField(
        blank=True,
    )

    rejection_reason = models.TextField(
        blank=True,
    )

    uploaded_at = models.DateTimeField(
        auto_now_add=True,
    )

    verified_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    expiry_date = models.DateField(
        null=True,
        blank=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def clean(self):

        if self.application_id:
            if (
                self.application.student_id
                != self.student_id
            ):
                raise ValidationError(
                    "The document student must match "
                    "the application student."
                )

    def __str__(self):
        return (
            f"{self.student.get_full_name()} - "
            f"{self.get_document_type_display()}"
        )
