from django.utils import timezone
from rest_framework import serializers

from .models import AccommodationChangeRequest, Booking, CheckInRecord


class CheckInRecordSerializer(serializers.ModelSerializer):
    staff_name = serializers.SerializerMethodField()

    class Meta:
        model = CheckInRecord
        fields = [
            "staff_name",
            "identity_document_type",
            "identity_verified",
            "room_inspected",
            "keys_handed_over",
            "arrival_notes",
            "checked_in_at",
        ]

    def get_staff_name(self, obj):
        return obj.checked_in_by.get_full_name() or obj.checked_in_by.email


class CheckInTokenSerializer(serializers.Serializer):
    token = serializers.UUIDField()


class CheckInConfirmationSerializer(CheckInTokenSerializer):
    identity_document_type = serializers.ChoiceField(choices=CheckInRecord.IdentityDocumentType.choices)
    identity_verified = serializers.BooleanField()
    room_inspected = serializers.BooleanField()
    keys_handed_over = serializers.BooleanField()
    arrival_notes = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def validate(self, attrs):
        checklist = {
            "identity_verified": "Confirm the student's photo ID matches their account.",
            "room_inspected": "Confirm the assigned room and bed are ready.",
            "keys_handed_over": "Confirm the room keys or access method were handed over.",
        }
        errors = {field: message for field, message in checklist.items() if not attrs.get(field)}
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class BookingSerializer(serializers.ModelSerializer):

    student_name = serializers.SerializerMethodField()
    property_name = serializers.CharField(
        source="property.name",
        read_only=True,
    )
    room_number = serializers.CharField(
        source="room.room_number",
        read_only=True,
    )
    bed_number = serializers.CharField(
        source="bed.bed_number",
        read_only=True,
    )
    
    check_in_eligible = serializers.SerializerMethodField()
    check_out_eligible = serializers.SerializerMethodField()
    check_in_record = serializers.SerializerMethodField()
    

    class Meta:
        model = Booking
        fields = [
            "id",
            "booking_number",
            "application",
            "contract",
            "student",
            "student_name",
            "property",
            "property_name",
            "room",
            "room_number",
            "bed",
            "bed_number",
            "start_date",
            "end_date",
            "monthly_fee",
            "status",
            "confirmed_at",
            "checked_in_at",
            "checked_out_at",
            "check_in_eligible",
            "check_out_eligible",
            "check_in_record",
            "check_in_token",
            "created_at",
            "updated_at",
        ]

        read_only_fields = fields

    def get_student_name(self, obj):
        return obj.student.get_full_name()
    
    def get_check_in_eligible(self, obj):
        today = timezone.localdate()

        return (
            obj.status == Booking.Status.CONFIRMED
            and obj.start_date <= today <= obj.end_date
        )

    def get_check_out_eligible(self, obj):
        return obj.status == Booking.Status.ACTIVE

    def get_check_in_record(self, obj):
        try:
            record = obj.check_in_record
        except CheckInRecord.DoesNotExist:
            return None
        return CheckInRecordSerializer(record).data


class AccommodationChangeRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    booking_number = serializers.CharField(source="booking.booking_number", read_only=True)
    current_property_name = serializers.CharField(source="booking.property.name", read_only=True)
    current_room_number = serializers.CharField(source="booking.room.room_number", read_only=True)
    target_property_name = serializers.CharField(source="target_property.name", read_only=True, default="")
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AccommodationChangeRequest
        fields = [
            "id", "booking", "booking_number", "student", "student_name",
            "request_type", "status", "reason", "requested_end_date",
            "target_property", "target_property_name", "current_property_name",
            "current_room_number", "decision_note", "reviewed_by",
            "reviewed_by_name", "reviewed_at", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_student_name(self, obj):
        return obj.student.get_full_name() or obj.student.email

    def get_reviewed_by_name(self, obj):
        if not obj.reviewed_by_id:
            return ""
        return obj.reviewed_by.get_full_name() or obj.reviewed_by.email


class ManagedBookingSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_email = serializers.SerializerMethodField()
    student_mobile = serializers.SerializerMethodField()
    property_name = serializers.CharField(source="property.name", read_only=True)
    room_number = serializers.CharField(source="room.room_number", read_only=True)
    bed_number = serializers.CharField(source="bed.bed_number", read_only=True)
    check_in_record = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id", "booking_number", "application", "contract", "student", "student_name",
            "student_email", "student_mobile", "property", "property_name", "room", "room_number",
            "bed", "bed_number", "start_date", "end_date", "monthly_fee", "status",
            "confirmed_at", "checked_in_at", "checked_out_at", "check_in_record", "updated_at",
        ]
        read_only_fields = fields

    def get_student_name(self, obj):
        return obj.student.get_full_name() or obj.student.email

    def get_check_in_record(self, obj):
        try:
            record = obj.check_in_record
        except CheckInRecord.DoesNotExist:
            return None
        return CheckInRecordSerializer(record).data

    def _may_share_contact(self, obj):
        request = self.context.get("request")
        if request and (request.user.role == "ADMINISTRATOR" or request.user.is_superuser):
            return True
        profile = getattr(obj.student, "student_profile", None)
        return bool(profile and profile.share_contact_with_landlord)

    def get_student_email(self, obj):
        return obj.student.email if self._may_share_contact(obj) else ""

    def get_student_mobile(self, obj):
        return obj.student.mobile if self._may_share_contact(obj) else ""
