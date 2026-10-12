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
            name="Complaint",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reference_number", models.CharField(editable=False, max_length=40, unique=True)),
                ("category", models.CharField(choices=[("SAFETY", "Safety or security"), ("FACILITIES", "Facilities or room condition"), ("LANDLORD_SERVICE", "Landlord service"), ("ROOMMATE", "Roommate concern"), ("BILLING", "Billing or funding"), ("DISCRIMINATION", "Discrimination or harassment"), ("OTHER", "Other concern")], max_length=30)),
                ("title", models.CharField(max_length=150)),
                ("description", models.TextField()),
                ("priority", models.CharField(choices=[("LOW", "Low"), ("MEDIUM", "Medium"), ("HIGH", "High"), ("URGENT", "Urgent")], default="MEDIUM", max_length=20)),
                ("status", models.CharField(choices=[("OPEN", "Open"), ("UNDER_REVIEW", "Under review"), ("AWAITING_RESPONSE", "Awaiting response"), ("RESOLVED", "Resolved"), ("CLOSED", "Closed"), ("ESCALATED", "Escalated")], default="OPEN", max_length=30)),
                ("resolution", models.TextField(blank=True)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("application", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="complaints", to="applications.application")),
                ("assigned_to", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="assigned_complaints", to=settings.AUTH_USER_MODEL)),
                ("property", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="complaints", to="accommodations.property")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="student_complaints", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["status", "priority", "created_at"], name="complaint_status_prio_idx"),
                    models.Index(fields=["student", "status"], name="complaint_student_status_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ComplaintMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("body", models.TextField()),
                ("is_internal", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("complaint", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="messages", to="complaints.complaint")),
                ("sender", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="complaint_messages", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["created_at", "id"]},
        ),
    ]
