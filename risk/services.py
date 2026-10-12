from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from accommodations.models import Property
from applications.models import Application
from analytics.models import AuditEvent
from documents.models import Document
from funding.models import PaymentTransaction

from .models import LandlordRiskSignal, RiskSignal


ACTIVE_APPLICATION_STATUSES = [
    Application.Status.SUBMITTED,
    Application.Status.UNDER_REVIEW,
    Application.Status.ADDITIONAL_INFO,
    Application.Status.WAITING_LIST,
    Application.Status.WAITLISTED,
]


def _record_signal(*, application, signal_type, severity, occurrence_count, explanation):
    signal, created = RiskSignal.objects.get_or_create(
        application=application,
        signal_type=signal_type,
        defaults={
            "student": application.student,
            "severity": severity,
            "occurrence_count": occurrence_count,
            "explanation": explanation,
        },
    )
    if not created and signal.status in {RiskSignal.Status.OPEN, RiskSignal.Status.IN_REVIEW}:
        signal.severity = severity
        signal.occurrence_count = occurrence_count
        signal.explanation = explanation
        signal.save(update_fields=["severity", "occurrence_count", "explanation", "updated_at"])
    return created


def refresh_student_signals(student):
    """Record explainable review signals; these do not decide eligibility."""
    active_apps = list(
        Application.objects.filter(student=student, status__in=ACTIVE_APPLICATION_STATUSES)
        .select_related("property")
        .order_by("created_at")
    )
    created_count = 0

    if len(active_apps) >= 4:
        explanation = (
            f"This student has {len(active_apps)} active accommodation applications. "
            "Check for duplicate or overlapping requests before making a decision. "
            "This signal is for manual review and is not an eligibility decision."
        )
        for application in active_apps:
            created_count += _record_signal(
                application=application,
                signal_type=RiskSignal.SignalType.MULTIPLE_ACTIVE_APPLICATIONS,
                severity=RiskSignal.Severity.MEDIUM,
                occurrence_count=len(active_apps),
                explanation=explanation,
            )

    cutoff = timezone.now() - timedelta(hours=24)
    recent_apps = list(
        Application.objects.filter(student=student, submitted_at__gte=cutoff)
        .select_related("property")
        .order_by("submitted_at")
    )
    if len(recent_apps) >= 5:
        severity = RiskSignal.Severity.HIGH if len(recent_apps) >= 8 else RiskSignal.Severity.MEDIUM
        explanation = (
            f"{len(recent_apps)} applications were submitted by this student within 24 hours. "
            "Confirm that each request is intentional and current. This signal is for manual review."
        )
        for application in recent_apps:
            created_count += _record_signal(
                application=application,
                signal_type=RiskSignal.SignalType.RAPID_APPLICATION_SUBMISSIONS,
                severity=severity,
                occurrence_count=len(recent_apps),
                explanation=explanation,
            )

    failed_payment_query = PaymentTransaction.objects.filter(
        funding_payment__student=student,
        status=PaymentTransaction.Status.FAILED,
        created_at__gte=cutoff,
    )
    failed_payment_count = failed_payment_query.count()
    if failed_payment_count >= 3:
        severity = RiskSignal.Severity.HIGH if failed_payment_count >= 5 else RiskSignal.Severity.MEDIUM
        failed_application_ids = failed_payment_query.values_list("funding_payment__application_id", flat=True).distinct()
        explanation = (
            f"{failed_payment_count} payment attempts were recorded as failed for this student within 24 hours. "
            "Check transaction references and student context before taking action. This is a manual review signal; "
            "it does not determine funding eligibility or booking status."
        )
        for application in Application.objects.filter(id__in=failed_application_ids).select_related("property"):
            created_count += _record_signal(
                application=application,
                signal_type=RiskSignal.SignalType.REPEATED_PAYMENT_FAILURES,
                severity=severity,
                occurrence_count=failed_payment_count,
                explanation=explanation,
            )

    document_cutoff = timezone.now() - timedelta(days=365)
    duplicate_files = Document.objects.filter(
        student=student,
        uploaded_at__gte=document_cutoff,
    ).exclude(content_sha256="").values("content_sha256").annotate(
        file_count=Count("id"),
        application_count=Count("application_id", distinct=True),
        document_type_count=Count("document_type", distinct=True),
    ).filter(file_count__gte=2)
    for duplicate in duplicate_files:
        if duplicate["application_count"] < 2 and duplicate["document_type_count"] < 2:
            continue
        documents = list(Document.objects.filter(
            student=student,
            content_sha256=duplicate["content_sha256"],
            uploaded_at__gte=document_cutoff,
        ).select_related("application__property").order_by("uploaded_at"))
        types = sorted({document.get_document_type_display() for document in documents})
        application_ids = sorted({document.application_id for document in documents})
        severity = RiskSignal.Severity.MEDIUM if len(types) > 1 else RiskSignal.Severity.LOW
        explanation = (
            f"The same uploaded file content appears in {len(documents)} document uploads across "
            f"{len(application_ids)} application(s) and {len(types)} document type(s): {', '.join(types)}. "
            "Check that the file is appropriate and current. Reusing a valid document can be legitimate; "
            "this signal requires human review and does not affect eligibility automatically."
        )
        for application in Application.objects.filter(id__in=application_ids).select_related("property"):
            created_count += _record_signal(
                application=application,
                signal_type=RiskSignal.SignalType.DUPLICATE_DOCUMENT_UPLOADS,
                severity=severity,
                occurrence_count=len(documents),
                explanation=explanation,
            )

    return created_count


def _record_landlord_signal(*, landlord, property_obj, signal_type, severity, occurrence_count, explanation):
    signal, created = LandlordRiskSignal.objects.get_or_create(
        landlord=landlord,
        signal_type=signal_type,
        defaults={
            "property": property_obj,
            "severity": severity,
            "occurrence_count": occurrence_count,
            "explanation": explanation,
        },
    )
    if not created and signal.status in {RiskSignal.Status.OPEN, RiskSignal.Status.IN_REVIEW}:
        signal.property = property_obj
        signal.severity = severity
        signal.occurrence_count = occurrence_count
        signal.explanation = explanation
        signal.save(update_fields=["property", "severity", "occurrence_count", "explanation", "updated_at"])
    return created


def refresh_landlord_signals(landlord):
    """Flag review patterns for staff; never restrict a landlord automatically."""
    now = timezone.now()
    rejection_cutoff = now - timedelta(days=90)
    property_ids = Property.objects.filter(landlord=landlord).values_list("id", flat=True)
    rejected_reviews = AuditEvent.objects.filter(
        action="PROPERTY_REVIEW_DECIDED",
        entity_type="property",
        entity_id__in=property_ids,
        metadata__decision=Property.PropertyStatus.REJECTED,
        created_at__gte=rejection_cutoff,
    ).order_by("-created_at")
    rejection_count = rejected_reviews.count()
    created_count = 0
    if rejection_count >= 3:
        latest_property_id = rejected_reviews.values_list("entity_id", flat=True).first()
        property_obj = Property.objects.filter(id=latest_property_id).first()
        severity = RiskSignal.Severity.HIGH if rejection_count >= 6 else RiskSignal.Severity.MEDIUM
        created_count += _record_landlord_signal(
            landlord=landlord,
            property_obj=property_obj,
            signal_type=LandlordRiskSignal.SignalType.REPEATED_PROPERTY_REJECTIONS,
            severity=severity,
            occurrence_count=rejection_count,
            explanation=(
                f"{rejection_count} property review decisions for this landlord requested changes or rejected a listing "
                "within 90 days. Review the individual decision notes and current listings with the landlord before "
                "taking action. This is an administrative review prompt, not a finding of misconduct."
            ),
        )

    submission_cutoff = now - timedelta(hours=24)
    recent_properties = Property.objects.filter(landlord=landlord, created_at__gte=submission_cutoff).order_by("-created_at")
    submission_count = recent_properties.count()
    if submission_count >= 5:
        severity = RiskSignal.Severity.HIGH if submission_count >= 10 else RiskSignal.Severity.MEDIUM
        created_count += _record_landlord_signal(
            landlord=landlord,
            property_obj=recent_properties.first(),
            signal_type=LandlordRiskSignal.SignalType.RAPID_PROPERTY_SUBMISSIONS,
            severity=severity,
            occurrence_count=submission_count,
            explanation=(
                f"{submission_count} property listings were created by this landlord within 24 hours. "
                "Check ownership and listing details if needed. This signal does not suspend the account or decide "
                "whether a property should be approved."
            ),
        )
    return created_count
