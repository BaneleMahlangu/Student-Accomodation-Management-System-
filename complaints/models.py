import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Complaint(models.Model):
    class Category(models.TextChoices):
        SAFETY = "SAFETY", "Safety or security"
        FACILITIES = "FACILITIES", "Facilities or room condition"
        LANDLORD_SERVICE = "LANDLORD_SERVICE", "Landlord service"
        ROOMMATE = "ROOMMATE", "Roommate concern"
        BILLING = "BILLING", "Billing or funding"
        DISCRIMINATION = "DISCRIMINATION", "Discrimination or harassment"
        OTHER = "OTHER", "Other concern"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        UNDER_REVIEW = "UNDER_REVIEW", "Under review"
        AWAITING_RESPONSE = "AWAITING_RESPONSE", "Awaiting response"
        RESOLVED = "RESOLVED", "Resolved"
        CLOSED = "CLOSED", "Closed"
        ESCALATED = "ESCALATED", "Escalated"

    reference_number = models.CharField(max_length=40, unique=True, editable=False)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="student_complaints",
    )
    property = models.ForeignKey(
        "accommodations.Property",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaints",
    )
    application = models.ForeignKey(
        "applications.Application",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaints",
    )
    category = models.CharField(max_length=30, choices=Category.choices)
    title = models.CharField(max_length=150)
    description = models.TextField()
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.OPEN)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_complaints",
    )
    resolution = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "priority", "created_at"], name="complaint_status_prio_idx"),
            models.Index(fields=["student", "status"], name="complaint_student_status_idx"),
        ]

    def save(self, *args, **kwargs):
        if not self.reference_number:
            self.reference_number = f"SH-CMP-{timezone.now().year}-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference_number} — {self.title}"


class ComplaintMessage(models.Model):
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="complaint_messages")
    body = models.TextField()
    is_internal = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.complaint.reference_number} — {self.sender.email}"
