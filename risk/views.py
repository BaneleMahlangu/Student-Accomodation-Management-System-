from datetime import timedelta

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accommodations.models import Property
from analytics.models import AuditEvent
from analytics.services import record_audit_event
from applications.models import Application
from funding.models import PaymentTransaction

from .models import LandlordRiskSignal, RiskSignal
from .services import refresh_landlord_signals, refresh_student_signals


def _admin_error(request):
    if request.user.role != User.Role.ADMINISTRATOR and not request.user.is_superuser:
        return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)
    return None


def _serialize(signal):
    return {
        "id": signal.id,
        "student": signal.student_id,
        "student_name": signal.student.get_full_name(),
        "student_email": signal.student.email,
        "application": signal.application_id,
        "application_number": signal.application.application_number,
        "property_name": signal.application.property.name,
        "signal_type": signal.signal_type,
        "signal_type_display": signal.get_signal_type_display(),
        "severity": signal.severity,
        "status": signal.status,
        "occurrence_count": signal.occurrence_count,
        "explanation": signal.explanation,
        "reviewed_by": signal.reviewed_by.get_full_name() if signal.reviewed_by_id else None,
        "review_note": signal.review_note,
        "reviewed_at": signal.reviewed_at,
        "created_at": signal.created_at,
        "updated_at": signal.updated_at,
    }


def _serialize_landlord_signal(signal):
    return {
        "id": signal.id,
        "landlord": signal.landlord_id,
        "landlord_name": signal.landlord.get_full_name(),
        "landlord_email": signal.landlord.email,
        "property": signal.property_id,
        "property_name": signal.property.name if signal.property_id else "Multiple listings",
        "signal_type": signal.signal_type,
        "signal_type_display": signal.get_signal_type_display(),
        "severity": signal.severity,
        "status": signal.status,
        "occurrence_count": signal.occurrence_count,
        "explanation": signal.explanation,
        "reviewed_by": signal.reviewed_by.get_full_name() if signal.reviewed_by_id else None,
        "review_note": signal.review_note,
        "reviewed_at": signal.reviewed_at,
        "created_at": signal.created_at,
        "updated_at": signal.updated_at,
    }


class AdminRiskSignalsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        error = _admin_error(request)
        if error:
            return error
        signals = RiskSignal.objects.select_related("student", "application__property", "reviewed_by")
        status_filter = request.query_params.get("status", "")
        signal_type = request.query_params.get("signal_type", "")
        severity = request.query_params.get("severity", "")
        application_id = request.query_params.get("application_id", "")
        search = request.query_params.get("search", "").strip()
        if status_filter in RiskSignal.Status.values:
            signals = signals.filter(status=status_filter)
        if signal_type in RiskSignal.SignalType.values:
            signals = signals.filter(signal_type=signal_type)
        if severity in RiskSignal.Severity.values:
            signals = signals.filter(severity=severity)
        if application_id.isdigit():
            signals = signals.filter(application_id=int(application_id))
        if search:
            signals = signals.filter(Q(student__email__icontains=search) | Q(student__first_name__icontains=search) | Q(student__last_name__icontains=search) | Q(application__application_number__icontains=search) | Q(application__property__name__icontains=search))
        return Response({"success": True, "count": signals.count(), "signals": [_serialize(item) for item in signals[:500]]})

    def post(self, request):
        error = _admin_error(request)
        if error:
            return error
        now = timezone.now()
        since = now - timedelta(days=30)
        document_cutoff = now - timedelta(days=365)
        payment_cutoff = now - timedelta(hours=24)
        student_ids = User.objects.filter(
            Q(applications__submitted_at__gte=since)
            | Q(documents__uploaded_at__gte=document_cutoff)
            | Q(
                funding_payments__transactions__status=PaymentTransaction.Status.FAILED,
                funding_payments__transactions__created_at__gte=payment_cutoff,
            )
        ).values_list("id", flat=True).distinct()
        scanned = 0
        new_signals = 0
        for student in User.objects.filter(id__in=student_ids).iterator():
            scanned += 1
            new_signals += refresh_student_signals(student)

        rejection_property_ids = AuditEvent.objects.filter(
            action="PROPERTY_REVIEW_DECIDED",
            entity_type="property",
            metadata__decision=Property.PropertyStatus.REJECTED,
            created_at__gte=now - timedelta(days=90),
        ).values_list("entity_id", flat=True)
        landlord_ids = User.objects.filter(role=User.Role.LANDLORD).filter(
            Q(properties__created_at__gte=now - timedelta(days=1))
            | Q(properties__id__in=rejection_property_ids)
        ).values_list("id", flat=True).distinct()
        scanned_landlords = 0
        for landlord in User.objects.filter(id__in=landlord_ids).iterator():
            scanned_landlords += 1
            new_signals += refresh_landlord_signals(landlord)
        record_audit_event(
            actor=request.user,
            action="RISK_SIGNALS_REFRESHED",
            entity_type="risk_signal",
            summary="Refreshed student and landlord risk review signals",
            metadata={"fields": ["scanned_students", "scanned_landlords", "new_signals"]},
            request=request,
        )
        return Response({"success": True, "scanned_students": scanned, "scanned_landlords": scanned_landlords, "new_signals": new_signals, "message": f"Review signals refreshed for {scanned} students and {scanned_landlords} landlords."})


class AdminLandlordRiskSignalsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        error = _admin_error(request)
        if error:
            return error
        signals = LandlordRiskSignal.objects.select_related("landlord", "property", "reviewed_by")
        status_filter = request.query_params.get("status", "")
        severity = request.query_params.get("severity", "")
        search = request.query_params.get("search", "").strip()
        if status_filter in RiskSignal.Status.values:
            signals = signals.filter(status=status_filter)
        if severity in RiskSignal.Severity.values:
            signals = signals.filter(severity=severity)
        if search:
            signals = signals.filter(
                Q(landlord__email__icontains=search)
                | Q(landlord__first_name__icontains=search)
                | Q(landlord__last_name__icontains=search)
                | Q(property__name__icontains=search)
            )
        return Response({"success": True, "count": signals.count(), "signals": [_serialize_landlord_signal(item) for item in signals[:500]]})


class AdminLandlordRiskSignalDecisionView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, signal_id):
        error = _admin_error(request)
        if error:
            return error
        signal = get_object_or_404(LandlordRiskSignal.objects.select_related("landlord", "property"), id=signal_id)
        new_status = request.data.get("status")
        note = str(request.data.get("review_note", "")).strip()
        if new_status not in RiskSignal.Status.values or new_status == RiskSignal.Status.OPEN:
            return Response({"success": False, "message": "Choose in review, dismissed, or resolved."}, status=status.HTTP_400_BAD_REQUEST)
        if new_status in {RiskSignal.Status.DISMISSED, RiskSignal.Status.RESOLVED} and not note:
            return Response({"success": False, "message": "Add a brief review note before closing this signal."}, status=status.HTTP_400_BAD_REQUEST)
        signal.status = new_status
        signal.reviewed_by = request.user
        signal.review_note = note
        signal.reviewed_at = timezone.now()
        signal.save(update_fields=["status", "reviewed_by", "review_note", "reviewed_at", "updated_at"])
        record_audit_event(
            actor=request.user,
            action="LANDLORD_RISK_SIGNAL_REVIEWED",
            entity_type="landlord_risk_signal",
            entity_id=signal.id,
            summary=f"Updated landlord review signal for {signal.landlord.get_full_name()}",
            metadata={"status": new_status},
            request=request,
        )
        return Response({"success": True, "signal": _serialize_landlord_signal(signal), "message": "Landlord risk review signal updated."})


class AdminRiskSignalDecisionView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, signal_id):
        error = _admin_error(request)
        if error:
            return error
        signal = get_object_or_404(RiskSignal.objects.select_related("student", "application__property"), id=signal_id)
        new_status = request.data.get("status")
        note = str(request.data.get("review_note", "")).strip()
        if new_status not in RiskSignal.Status.values or new_status == RiskSignal.Status.OPEN:
            return Response({"success": False, "message": "Choose in review, dismissed, or resolved."}, status=status.HTTP_400_BAD_REQUEST)
        if new_status in {RiskSignal.Status.DISMISSED, RiskSignal.Status.RESOLVED} and not note:
            return Response({"success": False, "message": "Add a brief review note before closing this signal."}, status=status.HTTP_400_BAD_REQUEST)

        signal.status = new_status
        signal.reviewed_by = request.user
        signal.review_note = note
        signal.reviewed_at = timezone.now()
        signal.save(update_fields=["status", "reviewed_by", "review_note", "reviewed_at", "updated_at"])
        record_audit_event(
            actor=request.user,
            action="RISK_SIGNAL_REVIEWED",
            entity_type="risk_signal",
            entity_id=signal.id,
            summary=f"Updated review signal for {signal.application.application_number}",
            metadata={"status": new_status},
            request=request,
        )
        return Response({"success": True, "signal": _serialize(signal), "message": "Risk review signal updated."})
