from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from analytics.services import record_audit_event
from notifications.services import create_notification

from .models import FundingPayment, PaymentTransaction, RefundRequest
from .services import apply_funding_payment_delta


ACTIVE_REFUND_STATUSES = [
    RefundRequest.Status.PENDING,
    RefundRequest.Status.APPROVED,
    RefundRequest.Status.PROCESSING,
    RefundRequest.Status.REFUNDED,
]


def serialize_refund(refund):
    payment = refund.transaction.funding_payment
    return {
        "id": refund.id,
        "application": payment.application_id,
        "application_number": payment.application.application_number,
        "student": refund.student_id,
        "student_name": refund.student.get_full_name(),
        "student_email": refund.student.email,
        "property_name": payment.application.property.name,
        "transaction": refund.transaction_id,
        "transaction_reference": refund.transaction.transaction_reference,
        "provider": refund.transaction.provider,
        "transaction_amount": str(refund.transaction.amount),
        "amount": str(refund.amount),
        "currency": refund.transaction.currency,
        "reason": refund.reason,
        "status": refund.status,
        "review_note": refund.review_note,
        "provider_reference": refund.provider_reference,
        "requested_at": refund.requested_at,
        "reviewed_at": refund.reviewed_at,
        "processed_at": refund.processed_at,
    }


class StudentRefundRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    def _student(self, request):
        if request.user.role != User.Role.STUDENT:
            return Response({"success": False, "message": "Student access is required."}, status=status.HTTP_403_FORBIDDEN)
        return None

    def get(self, request, application_id):
        denied = self._student(request)
        if denied:
            return denied
        from applications.models import Application

        application = get_object_or_404(Application, id=application_id, student=request.user)
        rows = RefundRequest.objects.filter(
            transaction__funding_payment__application=application,
            student=request.user,
        ).select_related("student", "transaction__funding_payment__application", "transaction__funding_payment__application__property")
        return Response({"success": True, "refunds": [serialize_refund(row) for row in rows]})

    def post(self, request, application_id):
        denied = self._student(request)
        if denied:
            return denied
        reason = str(request.data.get("reason", "")).strip()
        if not reason or len(reason) > 2000:
            return Response({"success": False, "message": "Explain the reason for your refund request (up to 2,000 characters)."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            transaction_id = int(request.data.get("transaction_id"))
            amount = Decimal(str(request.data.get("amount", "")))
        except (TypeError, ValueError, InvalidOperation):
            return Response({"success": False, "message": "Select a valid transaction and refund amount."}, status=status.HTTP_400_BAD_REQUEST)
        if not amount.is_finite() or amount <= 0 or amount.as_tuple().exponent < -2:
            return Response({"success": False, "message": "Enter a positive refund amount with no more than two decimal places."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                payment_transaction = PaymentTransaction.objects.select_for_update().select_related(
                    "funding_payment__application__property", "funding_payment__student"
                ).get(
                    id=transaction_id,
                    funding_payment__application_id=application_id,
                    funding_payment__student=request.user,
                )
                if payment_transaction.status != PaymentTransaction.Status.SUCCESSFUL:
                    return Response({"success": False, "message": "Only successful payments can be refunded."}, status=status.HTTP_409_CONFLICT)
                if not payment_transaction.provider.startswith("PAYFAST"):
                    return Response({"success": False, "message": "Only confirmed PayFast payments can be submitted for refund. Simulated transactions do not move money."}, status=status.HTTP_409_CONFLICT)
                reserved = payment_transaction.refund_requests.filter(status__in=ACTIVE_REFUND_STATUSES).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
                available = payment_transaction.amount - reserved
                if amount > available:
                    return Response({"success": False, "message": f"The maximum amount available to request for this payment is {available:.2f}."}, status=status.HTTP_400_BAD_REQUEST)
                refund = RefundRequest.objects.create(
                    transaction=payment_transaction,
                    student=request.user,
                    amount=amount,
                    reason=reason,
                )
                payment = payment_transaction.funding_payment
                record_audit_event(actor=request.user, action="PAYMENT_REFUND_REQUESTED", entity_type="refund_request", entity_id=refund.id, summary=f"Student requested a {amount:.2f} refund for {payment_transaction.transaction_reference}", metadata={"status": refund.status, "application_number": payment.application.application_number}, request=request)
                create_notification(recipient=request.user, notification_type="SYSTEM", title="Refund request received", message="Your refund request has been sent to Student Haven staff for review. No refund is issued until the payment provider processes it.", application=payment.application, extra_data={"refund_request_id": refund.id})
            return Response({"success": True, "refund": serialize_refund(refund)}, status=status.HTTP_201_CREATED)
        except PaymentTransaction.DoesNotExist:
            return Response({"success": False, "message": "That successful transaction was not found on this application."}, status=status.HTTP_404_NOT_FOUND)


class AdminRefundRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    def _admin(self, request):
        return request.user.role == User.Role.ADMINISTRATOR or request.user.is_superuser

    def get(self, request):
        if not self._admin(request):
            return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)
        rows = RefundRequest.objects.select_related(
            "student", "transaction", "transaction__funding_payment__application", "transaction__funding_payment__application__property"
        )
        status_filter = request.query_params.get("status", "")
        if status_filter in RefundRequest.Status.values:
            rows = rows.filter(status=status_filter)
        return Response({"success": True, "refunds": [serialize_refund(row) for row in rows[:500]], "count": rows.count()})

    def patch(self, request, refund_id):
        if not self._admin(request):
            return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)
        next_status = str(request.data.get("status", ""))
        note = str(request.data.get("review_note", "")).strip()
        provider_reference = str(request.data.get("provider_reference", "")).strip()
        if next_status not in RefundRequest.Status.values:
            return Response({"success": False, "message": "Choose a valid refund status."}, status=status.HTTP_400_BAD_REQUEST)
        if not note or len(note) > 1500:
            return Response({"success": False, "message": "Add a staff note of up to 1,500 characters."}, status=status.HTTP_400_BAD_REQUEST)
        if next_status == RefundRequest.Status.REFUNDED and not provider_reference:
            return Response({"success": False, "message": "Record the provider refund reference after confirming the refund in PayFast."}, status=status.HTTP_400_BAD_REQUEST)
        allowed = {
            RefundRequest.Status.PENDING: {RefundRequest.Status.APPROVED, RefundRequest.Status.REJECTED},
            RefundRequest.Status.APPROVED: {RefundRequest.Status.PROCESSING, RefundRequest.Status.REFUNDED, RefundRequest.Status.FAILED, RefundRequest.Status.REJECTED},
            RefundRequest.Status.PROCESSING: {RefundRequest.Status.REFUNDED, RefundRequest.Status.FAILED},
        }
        with transaction.atomic():
            refund = get_object_or_404(
                RefundRequest.objects.select_for_update().select_related("student", "transaction__funding_payment__application"),
                id=refund_id,
            )
            if next_status not in allowed.get(refund.status, set()):
                return Response({"success": False, "message": f"A refund in {refund.get_status_display()} cannot move to {next_status.replace('_', ' ').lower()}."}, status=status.HTTP_409_CONFLICT)
            payment_transaction = PaymentTransaction.objects.select_for_update().get(id=refund.transaction_id)
            funding_payment = FundingPayment.objects.select_for_update().get(id=payment_transaction.funding_payment_id)
            previous_status = refund.status
            now = timezone.now()
            refund.status = next_status
            refund.review_note = note
            refund.reviewed_by = request.user
            refund.reviewed_at = now
            if provider_reference:
                refund.provider_reference = provider_reference[:100]
            if next_status == RefundRequest.Status.REFUNDED:
                refund.processed_at = now
                apply_funding_payment_delta(funding_payment, -refund.amount, is_refund=True)
                remaining_balance = max(Decimal("0.00"), funding_payment.amount_due - funding_payment.amount_paid)
                refunded_total = payment_transaction.refund_requests.filter(status=RefundRequest.Status.REFUNDED).exclude(pk=refund.pk).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
                if refunded_total + refund.amount >= payment_transaction.amount:
                    payment_transaction.status = PaymentTransaction.Status.REFUNDED
                    payment_transaction.save(update_fields=["status", "updated_at"])
            refund.save(update_fields=["status", "review_note", "reviewed_by", "reviewed_at", "provider_reference", "processed_at", "updated_at"])
            record_audit_event(actor=request.user, action="PAYMENT_REFUND_STATUS_UPDATED", entity_type="refund_request", entity_id=refund.id, summary=f"Refund request {refund.id} changed from {previous_status} to {next_status}", metadata={"from_status": previous_status, "to_status": next_status, "application_number": funding_payment.application.application_number}, request=request)
            create_notification(recipient=refund.student, actor=request.user, notification_type="SYSTEM", title="Refund request updated", message=f"Your refund request for {refund.amount:.2f} is now {refund.get_status_display()}. {note}", application=funding_payment.application, extra_data={"refund_request_id": refund.id, "status": next_status})
            refund.refresh_from_db()
            return Response({"success": True, "refund": serialize_refund(refund)})
