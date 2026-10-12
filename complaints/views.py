from django.shortcuts import render

# Create your views here.
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accommodations.models import Property
from applications.models import Application
from analytics.services import record_audit_event
from notifications.services import create_notification

from .models import Complaint, ComplaintMessage


def is_admin(user):
    return user.role in {"ADMIN", "ADMINISTRATOR"} or user.is_superuser


def visible_complaints(user):
    queryset = Complaint.objects.select_related("student", "property", "property__landlord", "application", "assigned_to")
    if is_admin(user):
        return queryset
    if user.role == "LANDLORD":
        return queryset.filter(property__landlord=user)
    return queryset.filter(student=user)


def serialize_complaint(complaint, *, include_messages=False, include_internal=False):
    data = {
        "id": complaint.id,
        "reference_number": complaint.reference_number,
        "student": complaint.student_id,
        "student_name": complaint.student.get_full_name(),
        "student_email": complaint.student.email,
        "property": complaint.property_id,
        "property_name": complaint.property.name if complaint.property_id else "General Student Haven support",
        "application": complaint.application_id,
        "application_number": complaint.application.application_number if complaint.application_id else None,
        "category": complaint.category,
        "category_display": complaint.get_category_display(),
        "title": complaint.title,
        "description": complaint.description,
        "priority": complaint.priority,
        "status": complaint.status,
        "assigned_to": complaint.assigned_to_id,
        "assigned_to_name": complaint.assigned_to.get_full_name() if complaint.assigned_to_id else None,
        "resolution": complaint.resolution,
        "resolved_at": complaint.resolved_at,
        "created_at": complaint.created_at,
        "updated_at": complaint.updated_at,
    }
    if include_messages:
        messages = complaint.messages.select_related("sender").all()
        if not include_internal:
            messages = messages.filter(is_internal=False)
        data["messages"] = [{
            "id": item.id,
            "sender": item.sender_id,
            "sender_name": item.sender.get_full_name(),
            "sender_role": item.sender.role,
            "body": item.body,
            "is_internal": item.is_internal,
            "created_at": item.created_at,
        } for item in messages]
    return data


class ComplaintListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        complaints = visible_complaints(request.user)
        status_filter = request.query_params.get("status", "")
        if status_filter in Complaint.Status.values:
            complaints = complaints.filter(status=status_filter)
        return Response({"success": True, "count": complaints.count(), "complaints": [serialize_complaint(item) for item in complaints]})

    def post(self, request):
        if request.user.role != "STUDENT":
            return Response({"success": False, "message": "Only students can submit a complaint."}, status=status.HTTP_403_FORBIDDEN)

        category = str(request.data.get("category", "OTHER")).upper()
        title = str(request.data.get("title", "")).strip()
        description = str(request.data.get("description", "")).strip()
        if category not in Complaint.Category.values:
            return Response({"success": False, "message": "Choose a valid complaint category."}, status=status.HTTP_400_BAD_REQUEST)
        if not title or len(title) > 150 or len(description) < 10 or len(description) > 10000:
            return Response({"success": False, "message": "Enter a title and a description between 10 and 10,000 characters."}, status=status.HTTP_400_BAD_REQUEST)

        application = None
        application_id = request.data.get("application_id")
        if application_id not in (None, ""):
            application = Application.objects.filter(id=application_id, student=request.user).select_related("property").first()
            if not application:
                return Response({"success": False, "message": "The selected application was not found."}, status=status.HTTP_404_NOT_FOUND)

        property_obj = None
        property_id = request.data.get("property_id")
        if property_id not in (None, ""):
            property_obj = Property.objects.filter(id=property_id).first()
            if not property_obj:
                return Response({"success": False, "message": "The selected property was not found."}, status=status.HTTP_404_NOT_FOUND)
        elif application:
            property_obj = application.property

        if not property_obj:
            return Response({"success": False, "message": "Select a property so its landlord can review this complaint."}, status=status.HTTP_400_BAD_REQUEST)

        if application and property_obj and application.property_id != property_obj.id:
            return Response({"success": False, "message": "The property must match the selected application."}, status=status.HTTP_400_BAD_REQUEST)

        complaint = Complaint.objects.create(
            student=request.user,
            property=property_obj,
            application=application,
            category=category,
            title=title,
            description=description,
        )
        if property_obj:
            create_notification(
                recipient=property_obj.landlord,
                actor=request.user,
                notification_type="SYSTEM",
                title="New student complaint",
                message=f"A student submitted complaint {complaint.reference_number} about {property_obj.name}.",
                application=application,
                extra_data={"complaint_id": complaint.id, "reference_number": complaint.reference_number},
            )
        return Response({"success": True, "complaint": serialize_complaint(complaint), "message": "Your complaint has been submitted."}, status=status.HTTP_201_CREATED)


class ComplaintDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, complaint_id):
        complaint = get_object_or_404(visible_complaints(request.user), id=complaint_id)
        return Response({"success": True, "complaint": serialize_complaint(complaint, include_messages=True, include_internal=is_admin(request.user))})

    def patch(self, request, complaint_id):
        if request.user.role != "LANDLORD":
            return Response({"success": False, "message": "Landlord access is required to update this complaint."}, status=status.HTTP_403_FORBIDDEN)
        complaint = get_object_or_404(visible_complaints(request.user), id=complaint_id)
        allowed = {"status", "resolution"}
        if not request.data or set(request.data.keys()) - allowed:
            return Response({"success": False, "message": "Choose a valid complaint update."}, status=status.HTTP_400_BAD_REQUEST)
        if "status" in request.data and request.data["status"] not in Complaint.Status.values:
            return Response({"success": False, "message": "Choose a valid complaint status."}, status=status.HTTP_400_BAD_REQUEST)
        changed = []
        for field in allowed:
            if field in request.data:
                setattr(complaint, field, str(request.data[field]).strip() if field == "resolution" else request.data[field])
                changed.append(field)
        if "status" in request.data:
            complaint.resolved_at = timezone.now() if complaint.status in {Complaint.Status.RESOLVED, Complaint.Status.CLOSED} else None
            changed.append("resolved_at")
        if changed:
            complaint.save(update_fields=[*changed, "updated_at"])
            record_audit_event(
                actor=request.user,
                action="COMPLAINT_UPDATED",
                entity_type="complaint",
                entity_id=complaint.id,
                summary=f"Updated complaint {complaint.reference_number}",
                metadata={key: request.data[key] for key in ("status",) if key in request.data},
                request=request,
            )
            create_notification(
                recipient=complaint.student,
                actor=request.user,
                notification_type="LANDLORD_FEEDBACK",
                title="Complaint updated",
                message=f"Complaint {complaint.reference_number} is now {complaint.get_status_display().lower()}.",
                application=complaint.application,
                extra_data={"complaint_id": complaint.id, "status": complaint.status},
            )
        return Response({"success": True, "complaint": serialize_complaint(complaint), "message": "Complaint updated."})


class ComplaintMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, complaint_id):
        complaint = get_object_or_404(visible_complaints(request.user), id=complaint_id)
        body = str(request.data.get("body", "")).strip()
        is_internal = request.data.get("is_internal", False)
        if not body or len(body) > 5000:
            return Response({"success": False, "message": "Enter a reply of up to 5,000 characters."}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(is_internal, bool) or (is_internal and not is_admin(request.user)):
            return Response({"success": False, "message": "Internal notes are available to administrators only."}, status=status.HTTP_403_FORBIDDEN)

        message = ComplaintMessage.objects.create(complaint=complaint, sender=request.user, body=body, is_internal=is_internal)
        if not is_internal and request.user.id != complaint.student_id:
            create_notification(
                recipient=complaint.student,
                actor=request.user,
                notification_type="LANDLORD_FEEDBACK" if request.user.role == "LANDLORD" else "ADMIN_FEEDBACK",
                title="New complaint response",
                message=f"{request.user.get_full_name()} replied to complaint {complaint.reference_number}.",
                application=complaint.application,
                extra_data={"complaint_id": complaint.id, "message_id": message.id},
            )
        elif not is_internal and request.user.id == complaint.student_id and complaint.property_id:
            create_notification(
                recipient=complaint.property.landlord,
                actor=request.user,
                notification_type="SYSTEM",
                title="Student replied to a complaint",
                message=f"A student replied to complaint {complaint.reference_number}.",
                application=complaint.application,
                extra_data={"complaint_id": complaint.id, "message_id": message.id},
            )

        return Response({"success": True, "message": "Reply added.", "complaint": serialize_complaint(complaint, include_messages=True, include_internal=is_admin(request.user))}, status=status.HTTP_201_CREATED)
