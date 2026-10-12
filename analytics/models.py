from django.conf import settings
from django.db import models


class AuditEvent(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_events",
    )
    action = models.CharField(max_length=80)
    entity_type = models.CharField(max_length=60)
    entity_id = models.PositiveBigIntegerField(null=True, blank=True)
    summary = models.CharField(max_length=255)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["action", "created_at"], name="audit_action_created_idx"),
            models.Index(fields=["entity_type", "entity_id"], name="audit_entity_idx"),
        ]

    def __str__(self):
        return f"{self.action} — {self.entity_type} #{self.entity_id or '—'}"


class ReportSchedule(models.Model):
    class ReportType(models.TextChoices):
        APPLICATIONS = "applications", "Applications"
        PROPERTIES = "properties", "Properties & inventory"
        OCCUPANCY = "occupancy", "Accommodation occupancy"
        LANDLORDS = "landlords", "Landlord performance"
        PAYMENTS = "payments", "Funding & payments"
        WAITING_LIST = "waiting_list", "Waiting list"
        COMPLAINTS = "complaints", "Complaints"
        MAINTENANCE = "maintenance", "Maintenance requests"

    class Frequency(models.TextChoices):
        DAILY = "DAILY", "Daily"
        WEEKLY = "WEEKLY", "Weekly"
        MONTHLY = "MONTHLY", "Monthly"

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="report_schedules")
    report_type = models.CharField(max_length=30, choices=ReportType.choices)
    frequency = models.CharField(max_length=10, choices=Frequency.choices, default=Frequency.WEEKLY)
    recipient_email = models.EmailField()
    next_run_at = models.DateTimeField(db_index=True)
    last_sent_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=250, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["next_run_at", "id"]
        indexes = [models.Index(fields=["is_active", "next_run_at"], name="report_due_schedule_idx")]

    def __str__(self):
        return f"{self.get_report_type_display()} — {self.get_frequency_display()} — {self.recipient_email}"
