import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0002_account_codes_and_email_verification"),
        ("accommodations", "0003_alter_propertyimage_category"),
        ("applications", "0003_alter_application_status"),
    ]

    operations = [
        migrations.CreateModel(
            name="WaitingListEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("max_monthly_price", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("accessibility_required", models.BooleanField(default=False)),
                ("priority_score", models.PositiveSmallIntegerField(default=100)),
                ("status", models.CharField(choices=[("WAITING", "Waiting"), ("OFFERED", "Offer sent"), ("ACCEPTED", "Offer accepted"), ("EXPIRED", "Offer expired"), ("CANCELLED", "Cancelled")], default="WAITING", max_length=20)),
                ("offered_at", models.DateTimeField(blank=True, null=True)),
                ("respond_by", models.DateTimeField(blank=True, null=True)),
                ("accepted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("application", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="waiting_list_entry", to="applications.application")),
                ("offered_bed", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="waiting_list_offers", to="accommodations.bed")),
                ("property", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="waiting_list_entries", to="accommodations.property")),
                ("room_type", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="waiting_list_entries", to="accommodations.roomtype")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="accommodation_waitlist_entries", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-priority_score", "created_at"],
                "indexes": [
                    models.Index(fields=["property", "status", "created_at"], name="waitlist_prop_status_idx"),
                    models.Index(fields=["student", "status"], name="waitlist_student_status_idx"),
                ],
            },
        ),
    ]
