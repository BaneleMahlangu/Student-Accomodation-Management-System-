from django.conf import settings
from django.db import models


class Contract(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING_SIGNATURE = "PENDING_SIGNATURE", "Pending Signature"
        SIGNED = "SIGNED", "Signed"
        CANCELLED = "CANCELLED", "Cancelled"
        EXPIRED = "EXPIRED", "Expired"

    contract_number = models.CharField(
        max_length=50,
        unique=True,
    )

    application = models.OneToOneField(
        "applications.Application",
        on_delete=models.PROTECT,
        related_name="contract",
    )

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="contracts",
    )

    property_name = models.CharField(
        max_length=255,
    )

    room_number = models.CharField(
        max_length=100,
    )

    start_date = models.DateField(
        null=True,
        blank=True,
    )

    end_date = models.DateField(
        null=True,
        blank=True,
    )

    monthly_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )

    terms = models.TextField(
        blank=True,
    )

    rules = models.TextField(
        blank=True,
    )

    cancellation_policy = models.TextField(
        blank=True,
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    signed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    signature_name = models.CharField(max_length=201, blank=True)

    signature_consent_version = models.CharField(max_length=30, blank=True)

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return self.contract_number
