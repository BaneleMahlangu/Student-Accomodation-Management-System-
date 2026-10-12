from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("contracts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="contract",
            name="signature_name",
            field=models.CharField(blank=True, max_length=201),
        ),
        migrations.AddField(
            model_name="contract",
            name="signature_consent_version",
            field=models.CharField(blank=True, max_length=30),
        ),
    ]
