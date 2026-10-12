import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("funding", "0003_sponsorshipprogram_sponsorshipapplication"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="RefundRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("reason", models.TextField()),
                ("status", models.CharField(choices=[("PENDING", "Pending review"), ("APPROVED", "Approved for processing"), ("PROCESSING", "Provider processing"), ("REJECTED", "Rejected"), ("REFUNDED", "Refund confirmed"), ("FAILED", "Provider refund failed")], default="PENDING", max_length=20)),
                ("review_note", models.TextField(blank=True, default="")),
                ("provider_reference", models.CharField(blank=True, default="", max_length=100)),
                ("requested_at", models.DateTimeField(auto_now_add=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reviewed_payment_refunds", to=settings.AUTH_USER_MODEL)),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="payment_refund_requests", to=settings.AUTH_USER_MODEL)),
                ("transaction", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="refund_requests", to="funding.paymenttransaction")),
            ],
            options={"ordering": ["-requested_at", "-id"]},
        ),
        migrations.AddIndex(
            model_name="refundrequest",
            index=models.Index(fields=["status", "requested_at"], name="refund_status_time_idx"),
        ),
        migrations.AddConstraint(
            model_name="refundrequest",
            constraint=models.CheckConstraint(condition=models.Q(("amount__gt", 0)), name="funding_refund_amount_positive"),
        ),
    ]
