
import uuid

from django.conf import settings
from django.db import models

from applications.models import Application
from contracts.models import Contract
from accommodations.models import Property, Room, Bed


class Booking(models.Model):

    class Status(models.TextChoices):
        CONFIRMED = "CONFIRMED", "Confirmed"
        ACTIVE = "ACTIVE", "Active"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"
        TRANSFERRED = "TRANSFERRED", "Transferred"

    booking_number = models.CharField(
        max_length=40,
        unique=True,
    )

    application = models.OneToOneField(
        Application,
        on_delete=models.PROTECT,
        related_name="booking",
    )

    contract = models.OneToOneField(
        Contract,
        on_delete=models.PROTECT,
        related_name="booking",
    )

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="bookings",
    )

    property = models.ForeignKey(
        Property,
        on_delete=models.PROTECT,
        related_name="bookings",
    )

    room = models.ForeignKey(
        Room,
        on_delete=models.PROTECT,
        related_name="bookings",
    )

    bed = models.ForeignKey(
        Bed,
        on_delete=models.PROTECT,
        related_name="bookings",
    )

    start_date = models.DateField()

    end_date = models.DateField()

    monthly_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.CONFIRMED,
    )

    confirmed_at = models.DateTimeField(
        auto_now_add=True,
    )

    checked_in_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    checked_out_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    
    check_in_token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )

    

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return self.booking_number


class CheckInRecord(models.Model):
    class IdentityDocumentType(models.TextChoices):
        NATIONAL_ID = "NATIONAL_ID", "South African ID"
        PASSPORT = "PASSPORT", "Passport"
        OTHER_OFFICIAL_ID = "OTHER_OFFICIAL_ID", "Other official photo ID"

    booking = models.OneToOneField(
        Booking,
        on_delete=models.PROTECT,
        related_name="check_in_record",
    )
    checked_in_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="recorded_student_check_ins",
    )
    identity_document_type = models.CharField(
        max_length=24,
        choices=IdentityDocumentType.choices,
    )
    identity_verified = models.BooleanField(default=False)
    room_inspected = models.BooleanField(default=False)
    keys_handed_over = models.BooleanField(default=False)
    arrival_notes = models.TextField(blank=True)
    checked_in_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-checked_in_at", "-id"]

    def __str__(self):
        return f"Check-in for {self.booking.booking_number}"


class AccommodationChangeRequest(models.Model):
    class RequestType(models.TextChoices):
        RENEWAL = "RENEWAL", "Renewal"
        TRANSFER = "TRANSFER", "Transfer"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending review"
        APPROVED = "APPROVED", "Approved"
        DECLINED = "DECLINED", "Declined"
        WITHDRAWN = "WITHDRAWN", "Withdrawn"

    booking = models.ForeignKey(
        Booking,
        on_delete=models.PROTECT,
        related_name="change_requests",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="accommodation_change_requests",
    )
    request_type = models.CharField(max_length=20, choices=RequestType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    pending_key = models.CharField(max_length=80, unique=True, null=True, blank=True, editable=False)
    reason = models.TextField()
    requested_end_date = models.DateField(null=True, blank=True)
    target_property = models.ForeignKey(
        Property,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incoming_transfer_requests",
    )
    decision_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_accommodation_change_requests",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["status", "request_type", "created_at"]),
            models.Index(fields=["student", "created_at"]),
        ]

    def __str__(self):
        return f"{self.get_request_type_display()} — {self.booking.booking_number}"

    def save(self, *args, **kwargs):
        self.pending_key = f"{self.booking_id}:{self.request_type}" if self.status == self.Status.PENDING else None
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "status" in update_fields:
            kwargs["update_fields"] = set(update_fields) | {"pending_key"}
        super().save(*args, **kwargs)
