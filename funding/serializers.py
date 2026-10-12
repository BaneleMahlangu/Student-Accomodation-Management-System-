from rest_framework import serializers
from bookings.models import Booking

from .models import (
    FundingPayment,
    PaymentTransaction,
    SponsorshipApplication,
    SponsorshipProgram,
)


class PaymentTransactionSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = PaymentTransaction

        fields = [
            "id",
            "transaction_reference",
            "provider",
            "amount",
            "currency",
            "status",
            "processed_at",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "transaction_reference",
            "provider",
            "amount",
            "currency",
            "status",
            "processed_at",
            "created_at",
            "updated_at",
        ]


class FundingPaymentSerializer(
    serializers.ModelSerializer
):
    balance = serializers.SerializerMethodField()
    remaining_months = serializers.SerializerMethodField()
    booking_confirmed = serializers.SerializerMethodField()
    student_name = serializers.CharField(source="student.get_full_name", read_only=True)
    property_name = serializers.CharField(source="application.property.name", read_only=True)
    monthly_rent = serializers.DecimalField(source="contract.monthly_fee", max_digits=10, decimal_places=2, read_only=True)
    stay_start_date = serializers.DateField(source="contract.start_date", read_only=True)
    stay_end_date = serializers.DateField(source="contract.end_date", read_only=True)
    rent_schedule = serializers.SerializerMethodField()
    pending_payment_amount = serializers.SerializerMethodField()

    transactions = PaymentTransactionSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = FundingPayment

        fields = [
            "id",
            "contract",
            "application",
            "student",
            "student_name",
            "property_name",
            "monthly_rent",
            "stay_start_date",
            "stay_end_date",
            "rent_schedule",
            "funding_method",
            "funding_status",
            "payment_status",
            "amount_due",
            "amount_paid",
            "balance",
            "remaining_months",
            "pending_payment_amount",
            "booking_confirmed",
            "currency",
            "payment_reference",
            "funding_notes",
            "due_date",
            "transactions",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "contract",
            "application",
            "student",
            "amount_due",
            "amount_paid",
            "balance",
            "currency",
            "payment_reference",
            "funding_status",
            "payment_status",
            "transactions",
            "created_at",
            "updated_at",
        ]

    def get_balance(self, obj):
        schedule = self.get_rent_schedule(obj)
        if schedule:
            return sum((installment["balance"] for installment in schedule), start=obj.amount_due * 0)
        return max(obj.amount_due - obj.amount_paid, 0)

    def get_remaining_months(self, obj):
        schedule = self.get_rent_schedule(obj)
        return sum(1 for installment in schedule if installment["balance"] > 0)

    def get_pending_payment_amount(self, obj):
        pending = getattr(obj, "_pending_payment_amount", None)
        if pending is not None:
            return pending
        transaction = obj.transactions.filter(
            provider__in=["PAYFAST", "PAYFAST_SANDBOX"],
            status=PaymentTransaction.Status.PROCESSING,
        ).order_by("-created_at").first()
        return transaction.amount if transaction else None

    def get_rent_schedule(self, obj):
        from contracts.rent import calculate_rent_schedule

        schedule = calculate_rent_schedule(obj.contract.start_date, obj.contract.end_date, obj.contract.monthly_fee)
        paid_remaining = max(obj.amount_paid, 0)
        result = []
        for installment in schedule:
            paid = min(installment["amount"], paid_remaining)
            balance = installment["amount"] - paid
            paid_remaining -= paid
            result.append({
                "due_date": installment["due_date"],
                "start_date": installment["start_date"],
                "end_date": installment["end_date"],
                "amount_due": installment["amount"],
                "amount_paid": paid,
                "balance": balance,
                "status": "PAID" if balance == 0 else "PARTIALLY_PAID" if paid > 0 else "DUE",
            })
        return result

    def get_booking_confirmed(self, obj):
        return Booking.objects.filter(application_id=obj.application_id).exists()


class SponsorshipProgramSerializer(serializers.ModelSerializer):
    application_count = serializers.SerializerMethodField()
    beneficiary_count = serializers.SerializerMethodField()
    available_slots = serializers.SerializerMethodField()

    class Meta:
        model = SponsorshipProgram
        fields = [
            "id", "name", "sponsor_name", "description", "eligibility_rules",
            "amount", "currency", "funding_period_start", "funding_period_end",
            "application_deadline", "maximum_beneficiaries", "conditions", "is_active",
            "application_count", "beneficiary_count", "available_slots", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_application_count(self, obj):
        return getattr(obj, "application_count_annotated", obj.applications.count())

    def get_beneficiary_count(self, obj):
        return getattr(obj, "beneficiary_count_annotated", obj.applications.filter(status=SponsorshipApplication.Status.APPROVED).count())

    def get_available_slots(self, obj):
        if obj.maximum_beneficiaries is None:
            return None
        return max(0, obj.maximum_beneficiaries - self.get_beneficiary_count(obj))


class SponsorshipProgramWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SponsorshipProgram
        fields = [
            "name", "sponsor_name", "description", "eligibility_rules", "amount", "currency",
            "funding_period_start", "funding_period_end", "application_deadline",
            "maximum_beneficiaries", "conditions", "is_active",
        ]

    def validate(self, attrs):
        start = attrs.get("funding_period_start", getattr(self.instance, "funding_period_start", None))
        end = attrs.get("funding_period_end", getattr(self.instance, "funding_period_end", None))
        deadline = attrs.get("application_deadline", getattr(self.instance, "application_deadline", None))
        amount = attrs.get("amount", getattr(self.instance, "amount", None))
        if start and end and end < start:
            raise serializers.ValidationError({"funding_period_end": "The funding period must end on or after it starts."})
        if deadline and start and deadline > start:
            raise serializers.ValidationError({"application_deadline": "The deadline must be on or before the funding period start."})
        if amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount": "Funding amount must be greater than zero."})
        currency = attrs.get("currency", getattr(self.instance, "currency", "ZAR"))
        if len(currency) != 3:
            raise serializers.ValidationError({"currency": "Use a three-letter currency code."})
        return attrs


class SponsorshipApplicationSerializer(serializers.ModelSerializer):
    program_name = serializers.CharField(source="program.name", read_only=True)
    sponsor_name = serializers.CharField(source="program.sponsor_name", read_only=True)
    program_description = serializers.CharField(source="program.description", read_only=True)
    eligibility_rules = serializers.CharField(source="program.eligibility_rules", read_only=True)
    program_amount = serializers.DecimalField(source="program.amount", max_digits=12, decimal_places=2, read_only=True)
    program_currency = serializers.CharField(source="program.currency", read_only=True)
    funding_period_start = serializers.DateField(source="program.funding_period_start", read_only=True)
    funding_period_end = serializers.DateField(source="program.funding_period_end", read_only=True)
    student_name = serializers.CharField(source="student.get_full_name", read_only=True)
    student_email = serializers.EmailField(source="student.email", read_only=True)
    student_number = serializers.SerializerMethodField()

    class Meta:
        model = SponsorshipApplication
        fields = [
            "id", "program", "program_name", "sponsor_name", "program_description", "eligibility_rules",
            "program_amount", "program_currency", "funding_period_start", "funding_period_end",
            "student", "student_name", "student_email", "student_number", "statement", "status",
            "review_note", "award_amount", "award_conditions", "award_period_start", "award_period_end",
            "reviewed_by", "reviewed_at", "submitted_at", "updated_at",
        ]
        read_only_fields = [
            "id", "program", "student", "status", "review_note", "award_amount", "award_conditions",
            "award_period_start", "award_period_end", "reviewed_by", "reviewed_at", "submitted_at", "updated_at",
        ]

    def get_student_number(self, obj):
        profile = getattr(obj.student, "student_profile", None)
        return profile.student_number if profile else ""


class SponsorshipDecisionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=SponsorshipApplication.Status.choices)
    review_note = serializers.CharField(max_length=1500, trim_whitespace=True)
    award_amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, required=False, allow_null=True)
    award_conditions = serializers.CharField(max_length=5000, required=False, allow_blank=True)
    award_period_start = serializers.DateField(required=False, allow_null=True)
    award_period_end = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        if not attrs.get("review_note", "").strip():
            raise serializers.ValidationError({"review_note": "Add a note explaining the decision."})
        start = attrs.get("award_period_start")
        end = attrs.get("award_period_end")
        if start and end and end < start:
            raise serializers.ValidationError({"award_period_end": "The award period must end on or after it starts."})
        if attrs.get("status") == SponsorshipApplication.Status.APPROVED and attrs.get("award_amount") == 0:
            raise serializers.ValidationError({"award_amount": "An approved award must be greater than zero."})
        return attrs
