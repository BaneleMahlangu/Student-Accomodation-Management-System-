from django.conf import settings
from django.db import models

from accommodations.models import Property, Room


class Application(models.Model):

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted"
        UNDER_REVIEW = "UNDER_REVIEW", "Under Review"
        ADDITIONAL_INFO = "ADDITIONAL_INFO", "Additional Information Required"
        APPROVED = "APPROVED", "Approved"
        DECLINED = "DECLINED", "Declined"
        WITHDRAWN = "WITHDRAWN", "Withdrawn"
        WAITING_LIST = "WAITING_LIST", "Waiting List"
        WAITLISTED = "WAITLISTED", "Waitlisted"

    class FundingMethod(models.TextChoices):
        NOT_SELECTED = "NOT_SELECTED", "Not Selected"
        STUDENT_FUNDING = "STUDENT_FUNDING", "Student Funding"
        BURSARY = "BURSARY", "Bursary"
        SPONSORSHIP = "SPONSORSHIP", "Sponsorship"
        SELF_PAY = "SELF_PAY", "Self Pay"
        MIXED = "MIXED", "Mixed"

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="applications",
        limit_choices_to={"role": "STUDENT"},
    )

    property = models.ForeignKey(
        Property,
        on_delete=models.PROTECT,
        related_name="applications",
    )

    room = models.ForeignKey(
        Room,
        on_delete=models.PROTECT,
        related_name="applications",
    )

    application_number = models.CharField(
        max_length=30,
        unique=True,
        editable=False,
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    current_step = models.PositiveSmallIntegerField(
        default=1
    )

    # Personal information
    date_of_birth = models.DateField(
        null=True,
        blank=True,
    )

    emergency_contact_name = models.CharField(
        max_length=200,
        blank=True,
    )

    emergency_contact_phone = models.CharField(
        max_length=20,
        blank=True,
    )

    # Academic information
    academic_year = models.PositiveIntegerField(
    null=True,
    blank=True,
    )

    university = models.CharField(
    max_length=200,
    blank=True,
    )

    campus = models.CharField(
    max_length=200,
    blank=True,
    )

    course = models.CharField(
    max_length=200,
    blank=True,
   )

    year_of_study = models.PositiveSmallIntegerField(
    null=True,
    blank=True,
   )

   # Accommodation preferences
   
    expected_sign_in_date = models.DateField(
    null=True,
    blank=True,
   )

    expected_sign_out_date = models.DateField(
    null=True,
    blank=True,
    )

    accessibility_required = models.BooleanField(
    default=False,
    )

    accessibility_notes = models.TextField(
    blank=True,
    )
 
    meal_preference = models.CharField(
    max_length=100,
    blank=True,
    )

    # Funding
    funding_method = models.CharField(
        max_length=30,
        choices=FundingMethod.choices,
        default=FundingMethod.NOT_SELECTED,
    )

    funding_notes = models.TextField(
        blank=True,
    )

    # Review / admin
    student_notes = models.TextField(
        blank=True,
    )

    admin_notes = models.TextField(
        blank=True,
    )

    decline_reason = models.TextField(
        blank=True,
    )

    submitted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):

        if not self.application_number:
            last_application = (
                Application.objects
                .order_by("-id")
                .first()
            )

            next_number = (
                (last_application.id + 1)
                if last_application
                else 1
            )

            self.application_number = (
                f"SH-2026-{next_number:06d}"
            )

        super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"{self.application_number} - "
            f"{self.student.email}"
        )


class ApplicationStatusHistory(models.Model):

    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name="status_history",
    )

    from_status = models.CharField(
        max_length=30,
        blank=True,
    )

    to_status = models.CharField(
        max_length=30,
    )

    note = models.TextField(
        blank=True,
    )

    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="application_status_changes",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return (
            f"{self.application.application_number}: "
            f"{self.from_status} → {self.to_status}"
        )


class ApplicationAppeal(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending review"
        IN_REVIEW = "IN_REVIEW", "Under review"
        NEEDS_INFO = "NEEDS_INFO", "More information required"
        UPHELD = "UPHELD", "Original decision upheld"
        OVERTURNED = "OVERTURNED", "Returned for fresh review"

    application = models.OneToOneField(
        Application,
        on_delete=models.PROTECT,
        related_name="appeal",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="application_appeals",
    )
    grounds = models.TextField()
    student_response = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    review_note = models.TextField(blank=True, default="")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_application_appeals",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-submitted_at", "-id"]
        indexes = [models.Index(fields=["status", "submitted_at"], name="appeal_status_time_idx")]

    def __str__(self):
        return f"Appeal — {self.application.application_number} ({self.status})"
