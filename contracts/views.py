from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from applications.models import Application
from funding.models import FundingPayment
from notifications.services import create_notification
from analytics.services import record_audit_event

from .models import Contract
from .serializers import ContractSerializer
from .rent import calculate_stay_rent


class StudentContractView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, application_id):

        if request.user.role != "STUDENT":
            return Response(
                {
                    "success": False,
                    "message": (
                        "Only students can view their contracts."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        application = get_object_or_404(
            Application,
            id=application_id,
        )

        if application.student_id != request.user.id:
            return Response(
                {
                    "success": False,
                    "message": "Access denied.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        contract = get_object_or_404(
            Contract,
            application=application,
            student=request.user,
        )

        serializer = ContractSerializer(contract)

        return Response(
            {
                "success": True,
                "contract": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class SignStudentContractView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, application_id):

        if request.user.role != "STUDENT":
            return Response(
                {
                    "success": False,
                    "message": (
                        "Only students can sign contracts."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        application = get_object_or_404(
            Application,
            id=application_id,
        )

        if application.student_id != request.user.id:
            return Response(
                {
                    "success": False,
                    "message": "Access denied.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        contract = get_object_or_404(
            Contract,
            application=application,
            student=request.user,
        )

        if contract.status != Contract.Status.PENDING_SIGNATURE:
            return Response(
                {
                    "success": False,
                    "message": (
                        "This contract is not available "
                        "for signing."
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        confirmation = request.data.get(
            "confirmation"
        )

        signature_name = str(request.data.get("signature_name", "")).strip()
        if confirmation is not True or not signature_name:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Type your full name and confirm that you have read and agree to the contract."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not contract.start_date or not contract.end_date or contract.end_date <= contract.start_date:
            return Response(
                {"success": False, "message": "The contract needs a valid check-in and check-out date before it can be signed."},
                status=status.HTTP_409_CONFLICT,
            )
        if contract.monthly_fee <= 0:
            return Response(
                {"success": False, "message": "The contract needs a monthly rent greater than zero before it can be signed."},
                status=status.HTTP_409_CONFLICT,
            )

        if signature_name.casefold() != request.user.get_full_name().strip().casefold():
            return Response(
                {"success": False, "message": "Enter your full name as shown on your Student Haven account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        contract.status = Contract.Status.SIGNED
        contract.signed_at = timezone.now()
        contract.signature_name = signature_name
        contract.signature_consent_version = "student-haven-esign-v1"

        contract.save(
            update_fields=[
                "status",
                "signed_at",
                "signature_name",
                "signature_consent_version",
                "updated_at",
            ]
        )

        record_audit_event(
            actor=request.user,
            action="CONTRACT_ELECTRONICALLY_ACKNOWLEDGED",
            entity_type="contract",
            entity_id=contract.id,
            summary=f"Student acknowledged contract {contract.contract_number}",
            metadata={"application_number": application.application_number, "consent_version": contract.signature_consent_version},
            request=request,
        )

        funding_payment, funding_created = (
            FundingPayment.objects.get_or_create(
                contract=contract,
                defaults={
                    "application": application,
                    "student": request.user,
                    "funding_method": (
                        application.funding_method
                    ),
                    "funding_status": (
                        FundingPayment.FundingStatus.PENDING
                    ),
                    "payment_status": (
                        FundingPayment.PaymentStatus.PENDING
                    ),
                    "amount_due": calculate_stay_rent(contract.start_date, contract.end_date, contract.monthly_fee),
                    "amount_paid": 0,
                    "currency": "ZAR",
                    "due_date": contract.start_date,
                    "funding_notes": (
                        application.funding_notes or ""
                    ),
                },
            )
        )
        if not funding_created and funding_payment.amount_paid == 0 and not funding_payment.transactions.filter(status="SUCCESSFUL").exists():
            funding_payment.amount_due = calculate_stay_rent(contract.start_date, contract.end_date, contract.monthly_fee)
            funding_payment.due_date = contract.start_date
            funding_payment.save(update_fields=["amount_due", "due_date", "updated_at"])

        # =================================================
        # CONTRACT SIGNED NOTIFICATION
        # =================================================

        create_notification(
            recipient=request.user,
            actor=request.user,
            notification_type="CONTRACT_SIGNED",
            title="Contract signed",
            message=(
                f"Your accommodation contract "
                f"{contract.contract_number} has been "
                f"signed successfully."
            ),
            application=application,
            extra_data={
                "contract_number": (
                    contract.contract_number
                ),
                "contract_status": (
                    contract.status
                ),
                "signed_at": (
                    contract.signed_at.isoformat()
                    if contract.signed_at
                    else None
                ),
            },
        )

        # =================================================
        # PAYMENT DUE NOTIFICATION
        # =================================================

        if funding_created:

            create_notification(
                recipient=request.user,
                actor=request.user,
                notification_type="PAYMENT_DUE",
                title="Payment due",
                message=(
                    "Your accommodation contract has "
                    "been signed. Your funding/payment "
                    "record is now available and payment "
                    "is required before your booking can "
                    "be confirmed."
                ),
                application=application,
                extra_data={
                    "amount_due": str(
                        funding_payment.amount_due
                    ),
                    "amount_paid": str(
                        funding_payment.amount_paid
                    ),
                    "balance": str(
                        funding_payment.amount_due
                        - funding_payment.amount_paid
                    ),
                    "funding_method": (
                        funding_payment.funding_method
                    ),
                },
            )

        serializer = ContractSerializer(contract)

        return Response(
            {
                "success": True,
                "message": (
                    "Contract signed successfully."
                ),
                "contract": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class LandlordContractsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == "ADMINISTRATOR":
            contracts = Contract.objects.all()
        elif request.user.role == "LANDLORD":
            contracts = Contract.objects.filter(
                application__property__landlord=request.user,
            )
        else:
            return Response({"success": False, "message": "Landlord or administrator access required."}, status=status.HTTP_403_FORBIDDEN)

        contracts = contracts.select_related("student", "application__property").order_by("-updated_at")
        current_status = request.query_params.get("status")
        if current_status in Contract.Status.values:
            contracts = contracts.filter(status=current_status)
        search = request.query_params.get("q", request.query_params.get("search", "")).strip()
        if search:
            contracts = contracts.filter(
                Q(contract_number__icontains=search)
                | Q(student__email__icontains=search)
                | Q(student__first_name__icontains=search)
                | Q(student__last_name__icontains=search)
                | Q(property_name__icontains=search)
                | Q(room_number__icontains=search)
            )
        serializer = ContractSerializer(contracts, many=True)
        return Response({"success": True, "count": contracts.count(), "contracts": serializer.data})
