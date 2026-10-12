from rest_framework import serializers

from .models import Contract


class ContractSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.get_full_name", read_only=True)

    class Meta:
        model = Contract
        fields = [
            "id",
            "contract_number",
            "application",
            "student",
            "student_name",
            "property_name",
            "room_number",
            "start_date",
            "end_date",
            "monthly_fee",
            "terms",
            "rules",
            "cancellation_policy",
            "status",
            "signed_at",
            "signature_name",
            "signature_consent_version",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "contract_number",
            "application",
            "student",
            "property_name",
            "room_number",
            "start_date",
            "end_date",
            "monthly_fee",
            "status",
            "signed_at",
            "signature_name",
            "signature_consent_version",
            "created_at",
            "updated_at",
        ]
