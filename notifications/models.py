from django.conf import settings
from django.db import models


class Notification(models.Model):

    class NotificationType(models.TextChoices):

        APPLICATION_SUBMITTED = (
            "APPLICATION_SUBMITTED",
            "Application Submitted",
        )

        APPLICATION_RECEIVED = (
            "APPLICATION_RECEIVED",
            "Application Received",
        )

        APPLICATION_UNDER_REVIEW = (
            "APPLICATION_UNDER_REVIEW",
            "Application Under Review",
        )

        APPLICATION_APPROVED = (
            "APPLICATION_APPROVED",
            "Application Approved",
        )

        APPLICATION_REJECTED = (
            "APPLICATION_REJECTED",
            "Application Rejected",
        )

        APPLICATION_UPDATED = (
            "APPLICATION_UPDATED",
            "Application Updated",
        )

        ADDITIONAL_INFORMATION = (
            "ADDITIONAL_INFORMATION",
            "Additional Information Requested",
        )

        WAITING_LIST = (
            "WAITING_LIST",
            "Added to Waiting List",
        )

        ADMIN_FEEDBACK = (
            "ADMIN_FEEDBACK",
            "Administrator Feedback",
        )

        LANDLORD_FEEDBACK = (
            "LANDLORD_FEEDBACK",
            "Accommodation Provider Feedback",
        )

        DOCUMENTS_SUBMITTED = (
            "DOCUMENTS_SUBMITTED",
            "Documents Submitted",
        )

        DOCUMENT_VERIFIED = (
            "DOCUMENT_VERIFIED",
            "Document Verified",
        )

        DOCUMENT_REJECTED = (
            "DOCUMENT_REJECTED",
            "Document Rejected",
        )

        DOCUMENT_NEEDS_REVIEW = (
            "DOCUMENT_NEEDS_REVIEW",
            "Document Requires Review",
        )

        DOCUMENT_REQUESTED = (
            "DOCUMENT_REQUESTED",
            "Additional Document Required",
        )

        CONTRACT_READY = (
            "CONTRACT_READY",
            "Contract Ready",
        )

        CONTRACT_SIGNED = (
            "CONTRACT_SIGNED",
            "Contract Signed",
        )

        PAYMENT_DUE = (
            "PAYMENT_DUE",
            "Payment Due",
        )

        PAYMENT_SUCCESSFUL = (
            "PAYMENT_SUCCESSFUL",
            "Payment Successful",
        )

        PAYMENT_FAILED = (
            "PAYMENT_FAILED",
            "Payment Failed",
        )

        FUNDING_UPDATED = (
            "FUNDING_UPDATED",
            "Funding Updated",
        )

        BOOKING_CONFIRMED = (
            "BOOKING_CONFIRMED",
            "Booking Confirmed",
        )

        BOOKING_TERMINATED = (
            "BOOKING_TERMINATED",
            "Booking Terminated",
        )

        BOOKING_ROOM_TRANSFERRED = (
            "BOOKING_ROOM_TRANSFERRED",
            "Room Allocation Updated",
        )

        CHECK_IN_AVAILABLE = (
            "CHECK_IN_AVAILABLE",
            "Check-in Available",
        )

        CHECKED_IN = (
            "CHECKED_IN",
            "Checked In",
        )

        CHECKED_OUT = (
            "CHECKED_OUT",
            "Checked Out",
        )

        MAINTENANCE_SUBMITTED = (
            "MAINTENANCE_SUBMITTED",
            "Maintenance Request Submitted",
        )

        MAINTENANCE_ASSIGNED = (
            "MAINTENANCE_ASSIGNED",
            "Maintenance Assigned",
        )

        MAINTENANCE_UPDATED = (
            "MAINTENANCE_UPDATED",
            "Maintenance Updated",
        )

        MAINTENANCE_RESOLVED = (
            "MAINTENANCE_RESOLVED",
            "Maintenance Resolved",
        )

        MAINTENANCE_CONFIRMED = (
            "MAINTENANCE_CONFIRMED",
            "Maintenance Resolution Confirmed",
        )

        SYSTEM = (
            "SYSTEM",
            "System Notification",
        )


    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications_sent",
    )

    notification_type = models.CharField(
        max_length=50,
        choices=NotificationType.choices,
    )

    title = models.CharField(
        max_length=200,
    )

    message = models.TextField()

    application = models.ForeignKey(
        "applications.Application",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )

    document = models.ForeignKey(
        "documents.Document",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )

    maintenance_request = models.ForeignKey(
        "maintenance.MaintenanceRequest",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )

    extra_data = models.JSONField(
        default=dict,
        blank=True,
    )

    is_read = models.BooleanField(
        default=False,
    )

    read_at = models.DateTimeField(
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

        ordering = [
            "-created_at",
        ]

        indexes = [
            models.Index(
                fields=[
                    "recipient",
                    "is_read",
                ]
            ),
            models.Index(
                fields=[
                    "recipient",
                    "-created_at",
                ]
            ),
        ]


    def __str__(self):
        return (
            f"{self.recipient} - "
            f"{self.title}"
        )
