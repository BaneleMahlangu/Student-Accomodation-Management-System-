from django.conf import settings
from django.db import models


class RiskSignal(models.Model):
    class SignalType(models.TextChoices):
        MULTIPLE_ACTIVE_APPLICATIONS = "MULTIPLE_ACTIVE_APPLICATIONS", "Multiple active applications"
        RAPID_APPLICATION_SUBMISSIONS = "RAPID_APPLICATION_SUBMISSIONS", "Rapid application submissions"
        REPEATED_PAYMENT_FAILURES = "REPEATED_PAYMENT_FAILURES", "Repeated payment failures"
        DUPLICATE_DOCUMENT_UPLOADS = "DUPLICATE_DOCUMENT_UPLOADS", "Identical document uploads"

    class Severity(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open for review"
        IN_REVIEW = "IN_REVIEW", "Under review"
        DISMISSED = "DISMISSED", "Dismissed"
        RESOLVED = "RESOLVED", "Resolved"

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="risk_signals",
    )
    application = models.ForeignKey(
        "applications.Application",
        on_delete=models.CASCADE,
        related_name="risk_signals",
    )
    signal_type = models.CharField(max_length=50, choices=SignalType.choices)
    severity = models.CharField(max_length=20, choices=Severity.choices, default=Severity.MEDIUM)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    occurrence_count = models.PositiveIntegerField(default=1)
    explanation = models.TextField()
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_risk_signals",
    )
    review_note = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["application", "signal_type"], name="risk_app_signal_unique"),
        ]
        indexes = [
            models.Index(fields=["status", "severity", "created_at"], name="risk_status_severity_idx"),
            models.Index(fields=["student", "status"], name="risk_student_status_idx"),
        ]

    def __str__(self):
        return f"{self.get_signal_type_display()} — {self.application.application_number}"


class LandlordRiskSignal(models.Model):
    class SignalType(models.TextChoices):
        REPEATED_PROPERTY_REJECTIONS = "REPEATED_PROPERTY_REJECTIONS", "Repeated property rejections"
        RAPID_PROPERTY_SUBMISSIONS = "RAPID_PROPERTY_SUBMISSIONS", "Rapid property submissions"

    landlord = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="landlord_risk_signals",
        limit_choices_to={"role": "LANDLORD"},
    )
    property = models.ForeignKey(
        "accommodations.Property",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="landlord_risk_signals",
    )
    signal_type = models.CharField(max_length=50, choices=SignalType.choices)
    severity = models.CharField(max_length=20, choices=RiskSignal.Severity.choices, default=RiskSignal.Severity.MEDIUM)
    status = models.CharField(max_length=20, choices=RiskSignal.Status.choices, default=RiskSignal.Status.OPEN)
    occurrence_count = models.PositiveIntegerField(default=1)
    explanation = models.TextField()
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_landlord_risk_signals",
    )
    review_note = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["landlord", "signal_type"], name="risk_landlord_signal_unique"),
        ]
        indexes = [
            models.Index(fields=["status", "severity", "created_at"], name="risk_land_status_sev_idx"),
        ]

    def __str__(self):
        return f"{self.get_signal_type_display()} — {self.landlord.email}"
