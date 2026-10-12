from django.conf import settings
from django.db import models


class WaitingListEntry(models.Model):
    class Status(models.TextChoices):
        WAITING = "WAITING", "Waiting"
        OFFERED = "OFFERED", "Offer sent"
        ACCEPTED = "ACCEPTED", "Offer accepted"
        EXPIRED = "EXPIRED", "Offer expired"
        CANCELLED = "CANCELLED", "Cancelled"

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="accommodation_waitlist_entries",
    )
    property = models.ForeignKey(
        "accommodations.Property",
        on_delete=models.CASCADE,
        related_name="waiting_list_entries",
    )
    room_type = models.ForeignKey(
        "accommodations.RoomType",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="waiting_list_entries",
    )
    application = models.OneToOneField(
        "applications.Application",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="waiting_list_entry",
    )
    offered_bed = models.ForeignKey(
        "accommodations.Bed",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="waiting_list_offers",
    )
    max_monthly_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    accessibility_required = models.BooleanField(default=False)
    priority_score = models.PositiveSmallIntegerField(default=100)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.WAITING,
    )
    offered_at = models.DateTimeField(null=True, blank=True)
    respond_by = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-priority_score", "created_at"]
        indexes = [
            models.Index(fields=["property", "status", "created_at"], name="waitlist_prop_status_idx"),
            models.Index(fields=["student", "status"], name="waitlist_student_status_idx"),
        ]

    def __str__(self):
        return f"{self.student.email} — {self.property.name} ({self.status})"
