from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_account_codes_and_email_verification"),
    ]

    operations = [
        migrations.AlterField(
            model_name="accountcode",
            name="purpose",
            field=models.CharField(choices=[("VERIFY_EMAIL", "Verify email"), ("RESET_PASSWORD", "Reset password"), ("ENABLE_TWO_FACTOR", "Enable two-factor authentication"), ("LOGIN_TWO_FACTOR", "Two-factor sign-in")], max_length=20),
        ),
    ]
