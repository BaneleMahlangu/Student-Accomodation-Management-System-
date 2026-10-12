from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from bookings.models import Booking


class MaintenanceRequest(models.Model):

    class Category(models.TextChoices):
        ELECTRICAL = "ELECTRICAL", "Electrical"
        PLUMBING = "PLUMBING", "Plumbing"
        WIFI = "WIFI", "Wi-Fi"
        FURNITURE = "FURNITURE", "Furniture"
        CLEANING = "CLEANING", "Cleaning"
        SECURITY = "SECURITY", "Security"
        ROOM_DAMAGE = "ROOM_DAMAGE", "Room Damage"
        OTHER = "OTHER", "Other"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    class Status(models.TextChoices):
        SUBMITTED = "SUBMITTED", "Submitted"
        ASSIGNED = "ASSIGNED", "Assigned"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        WAITING_FOR_PARTS = (
            "WAITING_FOR_PARTS",
            "Waiting for Parts",
        )
        RESOLVED = "RESOLVED", "Resolved"
        STUDENT_CONFIRMED = (
            "STUDENT_CONFIRMED",
            "Student Confirmed",
        )
        ESCALATED = "ESCALATED", "Escalated"
        CANCELLED = "CANCELLED", "Cancelled"

    reference_number = models.CharField(
        max_length=40,
        unique=True,
        editable=False,
        blank=True,
    )

    booking = models.ForeignKey(
        Booking,
        on_delete=models.PROTECT,
        related_name="maintenance_requests",
    )

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="maintenance_requests",
    )

    category = models.CharField(
        max_length=30,
        choices=Category.choices,
    )

    title = models.CharField(
        max_length=150,
    )

    description = models.TextField()

    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.SUBMITTED,
    )

    photo = models.ImageField(
        upload_to="maintenance/",
        null=True,
        blank=True,
    )

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_maintenance_requests",
    )

    resolution_notes = models.TextField(
        blank=True,
    )

    submitted_at = models.DateTimeField(
        auto_now_add=True,
    )

    assigned_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    started_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    student_confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def clean(self):
        if self.booking_id and self.student_id:
            if self.booking.student_id != self.student_id:
                raise ValidationError(
                    "The student must match the booking student."
                )

    def save(self, *args, **kwargs):

        if not self.reference_number:
            self.reference_number = (
                f"SH-MNT-{timezone.now().year}-"
                f"{uuid4().hex[:8].upper()}"
            )

        super().save(*args, **kwargs)

    def __str__(self):
        return self.reference_number