from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0002_account_codes_and_email_verification"),
        ("applications", "0003_alter_application_status"),
    ]

    operations = [
        migrations.CreateModel(
            name="RiskSignal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("signal_type", models.CharField(choices=[("MULTIPLE_ACTIVE_APPLICATIONS", "Multiple active applications"), ("RAPID_APPLICATION_SUBMISSIONS", "Rapid application submissions")], max_length=50)),
                ("severity", models.CharField(choices=[("LOW", "Low"), ("MEDIUM", "Medium"), ("HIGH", "High")], default="MEDIUM", max_length=20)),
                ("status", models.CharField(choices=[("OPEN", "Open for review"), ("IN_REVIEW", "Under review"), ("DISMISSED", "Dismissed"), ("RESOLVED", "Resolved")], default="OPEN", max_length=20)),
                ("occurrence_count", models.PositiveIntegerField(default=1)),
                ("explanation", models.TextField()),
                ("review_note", models.TextField(blank=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("application", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="risk_signals", to="applications.application")),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reviewed_risk_signals", to=settings.AUTH_USER_MODEL)),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="risk_signals", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at", "-id"],
                "indexes": [
                    models.Index(fields=["status", "severity", "created_at"], name="risk_status_severity_idx"),
                    models.Index(fields=["student", "status"], name="risk_student_status_idx"),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="risksignal",
            constraint=models.UniqueConstraint(fields=("application", "signal_type"), name="risk_app_signal_unique"),
        ),
    ]
