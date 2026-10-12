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
            name="Conversation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("subject", models.CharField(max_length=200)),
                ("status", models.CharField(choices=[("ACTIVE", "Active"), ("CLOSED", "Closed")], default="ACTIVE", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("application", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="conversations", to="applications.application")),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="started_conversations", to=settings.AUTH_USER_MODEL)),
                ("property", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="conversations", to="accommodations.property")),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.CreateModel(
            name="ConversationParticipant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("last_read_at", models.DateTimeField(blank=True, null=True)),
                ("joined_at", models.DateTimeField(auto_now_add=True)),
                ("conversation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="participant_records", to="messaging.conversation")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="conversation_participations", to=settings.AUTH_USER_MODEL)),
            ],
            options={"indexes": [models.Index(fields=["user", "last_read_at"], name="msg_user_lastread_idx")]},
        ),
        migrations.AddConstraint(
            model_name="conversationparticipant",
            constraint=models.UniqueConstraint(fields=("conversation", "user"), name="msg_conversation_participant_unique"),
        ),
        migrations.AddField(
            model_name="conversation",
            name="participants",
            field=models.ManyToManyField(related_name="conversations", through="messaging.ConversationParticipant", to=settings.AUTH_USER_MODEL),
        ),
        migrations.CreateModel(
            name="Message",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("body", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("conversation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="messages", to="messaging.conversation")),
                ("sender", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="messages_sent", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["created_at", "id"], "indexes": [models.Index(fields=["conversation", "created_at"], name="msg_conversation_created_idx")]},
        ),
    ]
