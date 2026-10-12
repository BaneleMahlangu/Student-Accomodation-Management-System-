from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="email_verification_required",
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name="AccountCode",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("purpose", models.CharField(choices=[("VERIFY_EMAIL", "Verify email"), ("RESET_PASSWORD", "Reset password")], max_length=20)),
                ("code_hash", models.CharField(max_length=256)),
                ("expires_at", models.DateTimeField()),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("consumed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="account_codes", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [models.Index(fields=["user", "purpose", "created_at"], name="accounts_ac_user_id_e2264c_idx")],
            },
        ),
    ]
