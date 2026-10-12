from django.conf import settings
from django.db import models
from django.db.models import Q


class FundingPayment(models.Model):

    class FundingStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        PARTIALLY_FUNDED = "PARTIALLY_FUNDED", "Partially Funded"
        REJECTED = "REJECTED", "Rejected"

    class PaymentStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        SUCCESSFUL = "SUCCESSFUL", "Successful"
        FAILED = "FAILED", "Failed"
        REVERSED = "REVERSED", "Reversed"
        REFUNDED = "REFUNDED", "Refunded"

    contract = models.OneToOneField(
        "contracts.Contract",
        on_delete=models.PROTECT,
        related_name="funding_payment",
    )

    application = models.OneToOneField(
        "applications.Application",
        on_delete=models.PROTECT,
        related_name="funding_payment",
    )

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="funding_payments",
    )

    funding_method = models.CharField(
        max_length=50,
    )

    funding_status = models.CharField(
        max_length=30,
        choices=FundingStatus.choices,
        default=FundingStatus.PENDING,
    )

    payment_status = models.CharField(
        max_length=30,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )

    amount_due = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    amount_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    currency = models.CharField(
        max_length=3,
        default="ZAR",
    )

    payment_reference = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    funding_notes = models.TextField(
        blank=True,
        default="",
    )

    due_date = models.DateField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return (
            f"{self.student.email} - "
            f"{self.contract.contract_number}"
        )
        
class PaymentTransaction(models.Model):

    class Status(models.TextChoices):
        PROCESSING = "PROCESSING", "Processing"
        SUCCESSFUL = "SUCCESSFUL", "Successful"
        FAILED = "FAILED", "Failed"
        REVERSED = "REVERSED", "Reversed"
        REFUNDED = "REFUNDED", "Refunded"

    funding_payment = models.ForeignKey(
        FundingPayment,
        on_delete=models.PROTECT,
        related_name="transactions",
    )

    transaction_reference = models.CharField(
        max_length=100,
        unique=True,
    )

    provider = models.CharField(
        max_length=50,
        default="SANDBOX",
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    currency = models.CharField(
        max_length=3,
        default="ZAR",
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PROCESSING,
    )

    processed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return self.transaction_reference


class RefundRequest(models.Model):
    """Auditable student request and staff confirmation for a provider refund."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending review"
        APPROVED = "APPROVED", "Approved for processing"
        PROCESSING = "PROCESSING", "Provider processing"
        REJECTED = "REJECTED", "Rejected"
        REFUNDED = "REFUNDED", "Refund confirmed"
        FAILED = "FAILED", "Provider refund failed"

    transaction = models.ForeignKey(
        PaymentTransaction,
        on_delete=models.PROTECT,
        related_name="refund_requests",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="payment_refund_requests",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    review_note = models.TextField(blank=True, default="")
    provider_reference = models.CharField(max_length=100, blank=True, default="")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_payment_refunds",
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-requested_at", "-id"]
        indexes = [models.Index(fields=["status", "requested_at"], name="refund_status_time_idx")]
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="funding_refund_amount_positive"),
        ]

    def __str__(self):
        return f"Refund {self.id} — {self.transaction.transaction_reference} ({self.status})"


class SponsorshipProgram(models.Model):
    """A bursary or sponsorship opportunity administered on the platform."""

    name = models.CharField(max_length=200)
    sponsor_name = models.CharField(max_length=200)
    description = models.TextField()
    eligibility_rules = models.TextField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="ZAR")
    funding_period_start = models.DateField()
    funding_period_end = models.DateField()
    application_deadline = models.DateField(null=True, blank=True)
    maximum_beneficiaries = models.PositiveIntegerField(null=True, blank=True)
    conditions = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_sponsorship_programs",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["application_deadline", "name"]

    def __str__(self):
        return f"{self.name} — {self.sponsor_name}"


class SponsorshipApplication(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Not approved"
        WAITLISTED = "WAITLISTED", "Waitlisted"

    program = models.ForeignKey(
        SponsorshipProgram,
        on_delete=models.PROTECT,
        related_name="applications",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sponsorship_applications",
    )
    statement = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    review_note = models.TextField(blank=True, default="")
    award_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    award_conditions = models.TextField(blank=True, default="")
    award_period_start = models.DateField(null=True, blank=True)
    award_period_end = models.DateField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_sponsorship_applications",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-submitted_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["program", "student"], name="funding_unique_sponsorship_application"),
            models.CheckConstraint(
                condition=Q(award_period_end__isnull=True) | Q(award_period_start__isnull=True) | Q(award_period_end__gte=models.F("award_period_start")),
                name="funding_award_period_ordered",
            ),
        ]

    def __str__(self):
        return f"{self.student} — {self.program}"
