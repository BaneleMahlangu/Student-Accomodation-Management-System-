from rest_framework import serializers
from django.urls import reverse

from .models import Document


class DocumentSerializer(
    serializers.ModelSerializer
):

    document_type_display = serializers.CharField(
        source="get_document_type_display",
        read_only=True,
    )

    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    file_url = serializers.SerializerMethodField()
    preview_url = serializers.SerializerMethodField()

    class Meta:
        model = Document

        fields = [
            "id",
            "application",
            "student",
            "document_type",
            "document_type_display",
            "file_url",
            "preview_url",
            "original_filename",
            "status",
            "status_display",
            "verification_notes",
            "rejection_reason",
            "uploaded_at",
            "verified_at",
            "expiry_date",
            "updated_at",
        ]

        read_only_fields = [
            "student",
            "original_filename",
            "status",
            "verification_notes",
            "rejection_reason",
            "uploaded_at",
            "verified_at",
            "updated_at",
        ]

    def get_file_url(self, obj):

        request = self.context.get(
            "request"
        )

        if not obj.file:
            return None

        url = reverse("document-download", kwargs={"document_id": obj.id})

        if request:
            return request.build_absolute_uri(
                url
            )

        return url

    def get_preview_url(self, obj):
        request = self.context.get("request")
        if not request or getattr(request.user, "role", None) != "LANDLORD":
            return None

        url = reverse("document-preview", kwargs={"document_id": obj.id})
        return request.build_absolute_uri(url)


class DocumentUploadSerializer(
    serializers.Serializer
):

    application_id = serializers.IntegerField()

    document_type = serializers.ChoiceField(
        choices=Document.DocumentType.choices
    )

    file = serializers.FileField()

    expiry_date = serializers.DateField(
        required=False,
        allow_null=True,
    )

    def validate_file(self, value):

        # 10 MB maximum
        max_size = 10 * 1024 * 1024

        if value.size > max_size:
            raise serializers.ValidationError(
                "The document must be smaller than 10 MB."
            )

        allowed_extensions = [
            ".pdf",
            ".jpg",
            ".jpeg",
            ".png",
        ]

        filename = value.name.lower()

        if not any(
            filename.endswith(extension)
            for extension in allowed_extensions
        ):
            raise serializers.ValidationError(
                "Only PDF, JPG, JPEG and PNG files are allowed."
            )

        return value


class DocumentDecisionSerializer(
    serializers.Serializer
):

    decision = serializers.ChoiceField(
        choices=[
            "VERIFIED",
            "REJECTED",
        ]
    )

    note = serializers.CharField(
        required=False,
        allow_blank=True,
    )
