from rest_framework import serializers

from .models import PlatformAnnouncement, PlatformConfiguration


class PlatformConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformConfiguration
        fields = [
            "id", "application_period_name", "applications_open", "application_opens_at",
            "application_closes_at", "closed_message", "support_email", "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]

    def validate(self, attrs):
        opens = attrs.get("application_opens_at", getattr(self.instance, "application_opens_at", None))
        closes = attrs.get("application_closes_at", getattr(self.instance, "application_closes_at", None))
        if opens and closes and closes < opens:
            raise serializers.ValidationError({"application_closes_at": "The closing time must be after the opening time."})
        if not attrs.get("application_period_name", getattr(self.instance, "application_period_name", "")).strip():
            raise serializers.ValidationError({"application_period_name": "Enter a name for this application period."})
        if not attrs.get("closed_message", getattr(self.instance, "closed_message", "")).strip():
            raise serializers.ValidationError({"closed_message": "Enter a message students can see when applications are closed."})
        return attrs


class PlatformAnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformAnnouncement
        fields = ["id", "title", "body", "audience", "starts_at", "ends_at", "is_active", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def validate(self, attrs):
        start = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        end = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if start and end and end < start:
            raise serializers.ValidationError({"ends_at": "The announcement must end after it starts."})
        return attrs
