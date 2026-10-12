from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_studentprofile_profile_photo_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="studentprofile",
            name="national_id",
            field=models.CharField(blank=True, max_length=13, null=True, unique=True),
        ),
    ]
