from rest_framework import serializers

from .models import Application, ApplicationStatusHistory


class ApplicationStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ApplicationStatusHistory
        fields = [
            "id",
            "from_status",
            "to_status",
            "note",
            "changed_by_name",
            "created_at",
        ]

    def get_changed_by_name(self, obj):
        if not obj.changed_by:
            return None

        return obj.changed_by.get_full_name()


class ApplicationSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    property_name = serializers.CharField(
        source="property.name",
        read_only=True,
    )

    room_number = serializers.CharField(
        source="room.room_number",
        read_only=True,
    )

    status_history = ApplicationStatusHistorySerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = Application

        fields = [
            "id",
            "application_number",
            "student_name",

            # Selected accommodation
            "property",
            "property_name",
            "room",
            "room_number",

            # Application status
            "status",
            "current_step",

            # Personal information
            "date_of_birth",

            # Emergency contact
            "emergency_contact_name",
            "emergency_contact_phone",

            # Academic information
            "academic_year",
            "university",
            "campus",
            "course",
            "year_of_study",

            # Accommodation preferences
            "expected_sign_in_date",
            "expected_sign_out_date",
            "accessibility_required",
            "accessibility_notes",
            "meal_preference",
            "student_notes",

            # Funding
            "funding_method",
            "funding_notes",

            # Administration
            "admin_notes",
            "decline_reason",

            # Dates
            "submitted_at",
            "reviewed_at",
            "created_at",
            "updated_at",

            # History
            "status_history",
        ]

        read_only_fields = [
            "application_number",
            "status",
            "submitted_at",
            "reviewed_at",
            "created_at",
            "updated_at",
            "admin_notes",
            "decline_reason",
            "status_history",
        ]

    def get_student_name(self, obj):
        return obj.student.get_full_name()


class LandlordApplicationSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    property_name = serializers.CharField(source="property.name", read_only=True)
    room_number = serializers.CharField(source="room.room_number", read_only=True)

    class Meta:
        model = Application
        fields = [
            "id", "application_number", "student_name", "property_name", "room_number",
            "status", "university", "campus", "course", "year_of_study",
            "expected_sign_in_date", "expected_sign_out_date", "accessibility_required",
            "meal_preference", "funding_method", "admin_notes", "submitted_at", "reviewed_at", "created_at",
        ]
        read_only_fields = fields

    def get_student_name(self, obj):
        return obj.student.get_full_name() or obj.student.email
