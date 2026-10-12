import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("bookings", "0005_accommodationchangerequest"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CheckInRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("identity_document_type", models.CharField(choices=[("NATIONAL_ID", "South African ID"), ("PASSPORT", "Passport"), ("OTHER_OFFICIAL_ID", "Other official photo ID")], max_length=24)),
                ("identity_verified", models.BooleanField(default=False)),
                ("room_inspected", models.BooleanField(default=False)),
                ("keys_handed_over", models.BooleanField(default=False)),
                ("arrival_notes", models.TextField(blank=True)),
                ("checked_in_at", models.DateTimeField(auto_now_add=True)),
                ("booking", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="check_in_record", to="bookings.booking")),
                ("checked_in_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="recorded_student_check_ins", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-checked_in_at", "-id"]},
        ),
    ]
