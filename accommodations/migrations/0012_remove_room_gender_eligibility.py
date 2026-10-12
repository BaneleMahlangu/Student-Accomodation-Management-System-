from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accommodations", "0011_resident_rating_procedures"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="room",
            name="gender_eligibility",
        ),
    ]
