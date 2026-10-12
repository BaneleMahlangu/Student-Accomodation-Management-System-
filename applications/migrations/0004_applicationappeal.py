import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("applications", "0003_alter_application_status"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ApplicationAppeal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("grounds", models.TextField()),
                ("student_response", models.TextField(blank=True, default="")),
                ("status", models.CharField(choices=[("PENDING", "Pending review"), ("IN_REVIEW", "Under review"), ("NEEDS_INFO", "More information required"), ("UPHELD", "Original decision upheld"), ("OVERTURNED", "Returned for fresh review")], default="PENDING", max_length=20)),
                ("review_note", models.TextField(blank=True, default="")),
                ("submitted_at", models.DateTimeField(auto_now_add=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("application", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="appeal", to="applications.application")),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reviewed_application_appeals", to=settings.AUTH_USER_MODEL)),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="application_appeals", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-submitted_at", "-id"]},
        ),
        migrations.AddIndex(
            model_name="applicationappeal",
            index=models.Index(fields=["status", "submitted_at"], name="appeal_status_time_idx"),
        ),
    ]
