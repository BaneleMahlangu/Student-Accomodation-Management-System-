from rest_framework import serializers

from .models import Notification


class NotificationSerializer(
    serializers.ModelSerializer
):

    notification_type_display = (
        serializers.CharField(
            source="get_notification_type_display",
            read_only=True,
        )
    )

    actor_name = serializers.SerializerMethodField()

    application_number = (
        serializers.SerializerMethodField()
    )

    document_type = serializers.SerializerMethodField()

    maintenance_reference = (
        serializers.SerializerMethodField()
    )

    class Meta:

        model = Notification

        fields = [
            "id",
            "notification_type",
            "notification_type_display",
            "title",
            "message",
            "actor",
            "actor_name",
            "application",
            "application_number",
            "document",
            "document_type",
            "maintenance_request",
            "maintenance_reference",
            "extra_data",
            "is_read",
            "read_at",
            "created_at",
            "updated_at",
        ]

        read_only_fields = fields

    def get_actor_name(self, obj):

        if not obj.actor:
            return None

        return (
            obj.actor.get_full_name()
            or obj.actor.email
        )

    def get_application_number(self, obj):

        if not obj.application:
            return None

        return obj.application.application_number

    def get_document_type(self, obj):

        if not obj.document:
            return None

        return (
            obj.document.get_document_type_display()
        )

    def get_maintenance_reference(self, obj):

        if not obj.maintenance_request:
            return None

        return (
            obj.maintenance_request.reference_number
        )