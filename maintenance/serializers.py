from rest_framework import serializers

from .models import MaintenanceRequest


class MaintenanceRequestSerializer(
    serializers.ModelSerializer
):

    property_name = serializers.CharField(
        source="booking.property.name",
        read_only=True,
    )

    room_number = serializers.CharField(
        source="booking.room.room_number",
        read_only=True,
    )

    bed_number = serializers.CharField(
        source="booking.bed.bed_number",
        read_only=True,
    )

    booking_number = serializers.CharField(
        source="booking.booking_number",
        read_only=True,
    )

    student_name = serializers.SerializerMethodField()
    student_email = serializers.EmailField(source="student.email", read_only=True)

    assigned_to_name = serializers.SerializerMethodField()

    category_display = serializers.CharField(
        source="get_category_display",
        read_only=True,
    )

    priority_display = serializers.CharField(
        source="get_priority_display",
        read_only=True,
    )

    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    class Meta:
        model = MaintenanceRequest

        fields = [
            "id",
            "reference_number",
            "booking",
            "booking_number",
            "student",
            "student_name",
            "student_email",
            "property_name",
            "room_number",
            "bed_number",
            "category",
            "category_display",
            "title",
            "description",
            "priority",
            "priority_display",
            "status",
            "status_display",
            "photo",
            "assigned_to",
            "assigned_to_name",
            "resolution_notes",
            "submitted_at",
            "assigned_at",
            "started_at",
            "resolved_at",
            "student_confirmed_at",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "reference_number",
            "booking",
            "booking_number",
            "student",
            "student_name",
            "property_name",
            "room_number",
            "bed_number",
            "category_display",
            "priority_display",
            "status",
            "status_display",
            "assigned_to",
            "assigned_to_name",
            "resolution_notes",
            "submitted_at",
            "assigned_at",
            "started_at",
            "resolved_at",
            "student_confirmed_at",
            "created_at",
            "updated_at",
        ]

    def get_student_name(self, obj):
        return obj.student.get_full_name()

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return None

        return obj.assigned_to.get_full_name()
