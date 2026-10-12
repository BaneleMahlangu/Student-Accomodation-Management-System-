from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from analytics.services import record_audit_event
from notifications.services import create_notification

from .models import Application, ApplicationAppeal, ApplicationStatusHistory


def serialize_appeal(appeal):
    return {
        "id": appeal.id,
        "application": appeal.application_id,
        "application_number": appeal.application.application_number,
        "student_name": appeal.student.get_full_name(),
        "student_email": appeal.student.email,
        "property_name": appeal.application.property.name,
        "status": appeal.status,
        "status_display": appeal.get_status_display(),
        "grounds": appeal.grounds,
        "student_response": appeal.student_response,
        "review_note": appeal.review_note,
        "reviewed_by_name": appeal.reviewed_by.get_full_name() if appeal.reviewed_by_id else None,
        "submitted_at": appeal.submitted_at,
        "reviewed_at": appeal.reviewed_at,
        "updated_at": appeal.updated_at,
    }


def _is_admin(user):
    return user.role in {User.Role.ADMINISTRATOR, "ADMIN"} or user.is_superuser


def _is_student(user):
    return user.role == User.Role.STUDENT


class StudentApplicationAppealView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, application_id):
        if not _is_student(request.user):
            return Response({"success": False, "message": "Student access is required."}, status=status.HTTP_403_FORBIDDEN)
        application = get_object_or_404(Application, id=application_id, student=request.user)
        appeal = ApplicationAppeal.objects.filter(application=application).select_related("student", "reviewed_by", "application__property").first()
        return Response({"success": True, "appeal": serialize_appeal(appeal) if appeal else None, "appeal_window_days": settings.APPLICATION_APPEAL_WINDOW_DAYS})

    def post(self, request, application_id):
        if not _is_student(request.user):
            return Response({"success": False, "message": "Student access is required."}, status=status.HTTP_403_FORBIDDEN)
        application = get_object_or_404(Application.objects.select_related("property", "student"), id=application_id, student=request.user)
        if application.status != Application.Status.DECLINED:
            return Response({"success": False, "message": "An appeal can only be submitted after an application is declined."}, status=status.HTTP_409_CONFLICT)
        window_days = max(1, int(settings.APPLICATION_APPEAL_WINDOW_DAYS))
        if not application.reviewed_at or timezone.now() > application.reviewed_at + timedelta(days=window_days):
            return Response({"success": False, "message": f"The {window_days}-day appeal window for this decision has closed."}, status=status.HTTP_409_CONFLICT)
        if ApplicationAppeal.objects.filter(application=application).exists():
            return Response({"success": False, "message": "An appeal has already been submitted for this application. You can still reply if administrators request more information."}, status=status.HTTP_409_CONFLICT)
        grounds = str(request.data.get("grounds", "")).strip()
        if len(grounds) < 30 or len(grounds) > 5000:
            return Response({"success": False, "message": "Explain why you are appealing in 30 to 5,000 characters."}, status=status.HTTP_400_BAD_REQUEST)

        appeal = ApplicationAppeal.objects.create(application=application, student=request.user, grounds=grounds)
        for admin in User.objects.filter(role=User.Role.ADMINISTRATOR, is_active=True):
            create_notification(
                recipient=admin,
                actor=request.user,
                notification_type="APPLICATION_UPDATED",
                title="Student application appeal submitted",
                message=f"{request.user.get_full_name()} submitted an appeal for {application.application_number}.",
                application=application,
                extra_data={"appeal_id": appeal.id, "application_number": application.application_number},
            )
        record_audit_event(actor=request.user, action="APPLICATION_APPEAL_SUBMITTED", entity_type="application_appeal", entity_id=appeal.id, summary=f"Submitted an appeal for {application.application_number}", metadata={"status": appeal.status, "application_number": application.application_number}, request=request)
        return Response({"success": True, "appeal": serialize_appeal(appeal), "message": "Your appeal has been submitted for an independent administrative review."}, status=status.HTTP_201_CREATED)

    def patch(self, request, application_id):
        if not _is_student(request.user):
            return Response({"success": False, "message": "Student access is required."}, status=status.HTTP_403_FORBIDDEN)
        appeal = get_object_or_404(ApplicationAppeal.objects.select_related("application__property", "student", "reviewed_by"), application_id=application_id, student=request.user)
        if appeal.status != ApplicationAppeal.Status.NEEDS_INFO:
            return Response({"success": False, "message": "A response is only available when administrators request more information."}, status=status.HTTP_409_CONFLICT)
        response_text = str(request.data.get("student_response", "")).strip()
        if len(response_text) < 10 or len(response_text) > 5000:
            return Response({"success": False, "message": "Enter a response between 10 and 5,000 characters."}, status=status.HTTP_400_BAD_REQUEST)
        appeal.student_response = response_text
        appeal.status = ApplicationAppeal.Status.PENDING
        appeal.reviewed_by = None
        appeal.reviewed_at = None
        appeal.save(update_fields=["student_response", "status", "reviewed_by", "reviewed_at", "updated_at"])
        for admin in User.objects.filter(role=User.Role.ADMINISTRATOR, is_active=True):
            create_notification(recipient=admin, actor=request.user, notification_type="APPLICATION_UPDATED", title="Student replied to appeal request", message=f"{request.user.get_full_name()} replied to the information request for {appeal.application.application_number}.", application=appeal.application, extra_data={"appeal_id": appeal.id})
        record_audit_event(actor=request.user, action="APPLICATION_APPEAL_RESPONSE_SUBMITTED", entity_type="application_appeal", entity_id=appeal.id, summary=f"Replied to appeal information request for {appeal.application.application_number}", metadata={"status": appeal.status}, request=request)
        return Response({"success": True, "appeal": serialize_appeal(appeal), "message": "Your response has been sent for review."})


class AdminApplicationAppealsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_admin(request.user):
            return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)
        appeals = ApplicationAppeal.objects.select_related("student", "reviewed_by", "application__property").order_by("submitted_at")
        status_filter = request.query_params.get("status", "")
        if status_filter in ApplicationAppeal.Status.values:
            appeals = appeals.filter(status=status_filter)
        return Response({"success": True, "count": appeals.count(), "appeals": [serialize_appeal(item) for item in appeals[:500]]})

    @transaction.atomic
    def patch(self, request, appeal_id):
        if not _is_admin(request.user):
            return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)
        appeal = get_object_or_404(ApplicationAppeal.objects.select_related("student", "application__property"), id=appeal_id)
        decision = str(request.data.get("decision", "")).upper()
        note = str(request.data.get("review_note", "")).strip()
        valid_decisions = {ApplicationAppeal.Status.IN_REVIEW, ApplicationAppeal.Status.NEEDS_INFO, ApplicationAppeal.Status.UPHELD, ApplicationAppeal.Status.OVERTURNED}
        if decision not in valid_decisions:
            return Response({"success": False, "message": "Choose a valid appeal review action."}, status=status.HTTP_400_BAD_REQUEST)
        if decision in {ApplicationAppeal.Status.NEEDS_INFO, ApplicationAppeal.Status.UPHELD, ApplicationAppeal.Status.OVERTURNED} and len(note) < 10:
            return Response({"success": False, "message": "Add at least 10 characters explaining the review action."}, status=status.HTTP_400_BAD_REQUEST)
        if appeal.status in {ApplicationAppeal.Status.UPHELD, ApplicationAppeal.Status.OVERTURNED}:
            return Response({"success": False, "message": "This appeal already has a final decision."}, status=status.HTTP_409_CONFLICT)
        if decision == ApplicationAppeal.Status.OVERTURNED and appeal.application.status != Application.Status.DECLINED:
            return Response({"success": False, "message": "The application is no longer declined and cannot be returned for a fresh review."}, status=status.HTTP_409_CONFLICT)

        old_status = appeal.status
        appeal.status = decision
        appeal.review_note = note
        appeal.reviewed_by = request.user
        appeal.reviewed_at = timezone.now() if decision != ApplicationAppeal.Status.IN_REVIEW else None
        appeal.save(update_fields=["status", "review_note", "reviewed_by", "reviewed_at", "updated_at"])
        if decision == ApplicationAppeal.Status.OVERTURNED:
            application = appeal.application
            ApplicationStatusHistory.objects.create(application=application, from_status=application.status, to_status=Application.Status.UNDER_REVIEW, note=f"Appeal accepted for a fresh review. {note}", changed_by=request.user)
            application.status = Application.Status.UNDER_REVIEW
            application.reviewed_at = None
            application.save(update_fields=["status", "reviewed_at", "updated_at"])
        create_notification(
            recipient=appeal.student,
            actor=request.user,
            notification_type="APPLICATION_UPDATED",
            title="Application appeal updated",
            message=(f"Your appeal for {appeal.application.application_number} needs more information. " if decision == ApplicationAppeal.Status.NEEDS_INFO else f"Your appeal for {appeal.application.application_number} has been {appeal.get_status_display().lower()}. ") + note,
            application=appeal.application,
            extra_data={"appeal_id": appeal.id, "appeal_status": decision},
        )
        record_audit_event(actor=request.user, action="APPLICATION_APPEAL_REVIEWED", entity_type="application_appeal", entity_id=appeal.id, summary=f"Reviewed appeal for {appeal.application.application_number}", metadata={"from_status": old_status, "to_status": decision, "application_number": appeal.application.application_number}, request=request)
        appeal.refresh_from_db()
        return Response({"success": True, "appeal": serialize_appeal(appeal), "message": "Appeal review saved."})
