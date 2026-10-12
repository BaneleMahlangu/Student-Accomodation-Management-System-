from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accommodations.models import Bed, Property, RoomType
from applications.models import Application, ApplicationStatusHistory
from notifications.services import create_notification
from analytics.services import record_audit_event

from .models import WaitingListEntry
from .services import offer_waitlist_for_bed


def serialize_entry(entry, *, queue_position=None):
    room = entry.offered_bed.room if entry.offered_bed_id else None
    return {
        "id": entry.id,
        "property": entry.property_id,
        "property_name": entry.property.name,
        "campus_name": entry.property.campus.name,
        "room_type": entry.room_type_id,
        "room_type_name": entry.room_type.name if entry.room_type_id else "Any room type",
        "max_monthly_price": str(entry.max_monthly_price) if entry.max_monthly_price is not None else None,
        "accessibility_required": entry.accessibility_required,
        "priority_score": entry.priority_score,
        "status": entry.status,
        "queue_position": queue_position,
        "offered_room": room.id if room else None,
        "offered_room_number": room.room_number if room else None,
        "offered_bed_number": entry.offered_bed.bed_number if entry.offered_bed_id else None,
        "offered_at": entry.offered_at,
        "respond_by": entry.respond_by,
        "accepted_at": entry.accepted_at,
        "created_at": entry.created_at,
        "student": entry.student_id,
        "student_name": entry.student.get_full_name(),
        "student_email": entry.student.email,
        "application_id": entry.application_id,
    }


class StudentWaitingListView(APIView):
    permission_classes = [IsAuthenticated]

    def _student_only(self, request):
        if request.user.role != "STUDENT":
            return Response({"success": False, "message": "Student access is required."}, status=status.HTTP_403_FORBIDDEN)
        return None

    def get(self, request):
        error = self._student_only(request)
        if error:
            return error

        now = timezone.now()
        expired = list(WaitingListEntry.objects.filter(
            student=request.user,
            status=WaitingListEntry.Status.OFFERED,
            respond_by__lte=now,
        ).select_related("offered_bed"))
        if expired:
            WaitingListEntry.objects.filter(id__in=[entry.id for entry in expired]).update(
                status=WaitingListEntry.Status.EXPIRED,
                updated_at=now,
            )
            for entry in expired:
                if entry.offered_bed_id and entry.offered_bed.status == Bed.BedStatus.AVAILABLE:
                    offer_waitlist_for_bed(entry.offered_bed)
        entries = WaitingListEntry.objects.filter(student=request.user).select_related(
            "property__campus", "room_type", "offered_bed__room", "student"
        )
        serialized = []
        for entry in entries:
            position = None
            if entry.status == WaitingListEntry.Status.WAITING:
                position = WaitingListEntry.objects.filter(
                    property=entry.property,
                    status=WaitingListEntry.Status.WAITING,
                ).filter(
                    Q(priority_score__gt=entry.priority_score)
                    | Q(priority_score=entry.priority_score, created_at__lt=entry.created_at)
                    | Q(priority_score=entry.priority_score, created_at=entry.created_at, id__lte=entry.id)
                ).count()
            serialized.append(serialize_entry(entry, queue_position=position))
        return Response({"success": True, "entries": serialized})

    def post(self, request):
        error = self._student_only(request)
        if error:
            return error
        try:
            property_id = int(request.data.get("property_id"))
        except (TypeError, ValueError):
            return Response({"success": False, "message": "Select a valid property."}, status=status.HTTP_400_BAD_REQUEST)
        property_obj = get_object_or_404(Property, id=property_id, status=Property.PropertyStatus.APPROVED)

        room_type = None
        raw_room_type = request.data.get("room_type_id")
        if raw_room_type not in (None, ""):
            try:
                room_type = RoomType.objects.get(id=int(raw_room_type))
            except (TypeError, ValueError, RoomType.DoesNotExist):
                return Response({"success": False, "message": "Choose a valid room type."}, status=status.HTTP_400_BAD_REQUEST)

        max_price = request.data.get("max_monthly_price")
        if max_price not in (None, ""):
            try:
                max_price = Decimal(str(max_price))
                if not max_price.is_finite() or max_price <= 0:
                    raise InvalidOperation
            except (InvalidOperation, TypeError, ValueError):
                return Response({"success": False, "message": "Enter a valid maximum monthly price."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            max_price = None

        accessibility_required = request.data.get("accessibility_required", False)
        if not isinstance(accessibility_required, bool):
            return Response({"success": False, "message": "Accessibility preference must be true or false."}, status=status.HTTP_400_BAD_REQUEST)

        duplicate = WaitingListEntry.objects.filter(
            student=request.user,
            property=property_obj,
            status__in=[WaitingListEntry.Status.WAITING, WaitingListEntry.Status.OFFERED],
        ).first()
        if duplicate:
            return Response({"success": True, "existing": True, "entry": serialize_entry(duplicate), "message": "You are already on this property's waiting list."})

        entry = WaitingListEntry.objects.create(
            student=request.user,
            property=property_obj,
            room_type=room_type,
            max_monthly_price=max_price,
            accessibility_required=accessibility_required,
        )
        return Response({"success": True, "entry": serialize_entry(entry, queue_position=1), "message": "You have joined the waiting list. We will notify you if a suitable room becomes available."}, status=status.HTTP_201_CREATED)


class StudentWaitingListActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, entry_id, action):
        if request.user.role != "STUDENT":
            return Response({"success": False, "message": "Student access is required."}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            entry = get_object_or_404(
                WaitingListEntry.objects.select_for_update().select_related(
                    "property", "student", "offered_bed__room__room_type", "offered_bed__room__floor__building__property"
                ),
                id=entry_id,
                student=request.user,
            )
            if action == "cancel":
                if entry.status not in {WaitingListEntry.Status.WAITING, WaitingListEntry.Status.OFFERED}:
                    return Response({"success": False, "message": "This waiting-list entry can no longer be cancelled."}, status=status.HTTP_409_CONFLICT)
                bed = entry.offered_bed if entry.status == WaitingListEntry.Status.OFFERED else None
                entry.status = WaitingListEntry.Status.CANCELLED
                entry.save(update_fields=["status", "updated_at"])
                if bed and bed.status == Bed.BedStatus.AVAILABLE:
                    transaction.on_commit(lambda: offer_waitlist_for_bed(bed))
                return Response({"success": True, "message": "Waiting-list entry cancelled."})

            if action != "accept":
                return Response({"success": False, "message": "Unknown waiting-list action."}, status=status.HTTP_404_NOT_FOUND)
            if entry.status != WaitingListEntry.Status.OFFERED or not entry.offered_bed_id:
                return Response({"success": False, "message": "There is no active room offer for this entry."}, status=status.HTTP_409_CONFLICT)
            if not entry.respond_by or entry.respond_by <= timezone.now():
                entry.status = WaitingListEntry.Status.EXPIRED
                entry.save(update_fields=["status", "updated_at"])
                if entry.offered_bed and entry.offered_bed.status == Bed.BedStatus.AVAILABLE:
                    transaction.on_commit(lambda bed=entry.offered_bed: offer_waitlist_for_bed(bed))
                return Response({"success": False, "message": "This room offer has expired."}, status=status.HTTP_409_CONFLICT)

            bed = Bed.objects.select_for_update().select_related("room__room_type", "room__floor__building__property").get(pk=entry.offered_bed_id)
            room = bed.room
            if bed.status != Bed.BedStatus.AVAILABLE or room.status != "AVAILABLE" or room.floor.building.property.status != Property.PropertyStatus.APPROVED:
                entry.status = WaitingListEntry.Status.EXPIRED
                entry.save(update_fields=["status", "updated_at"])
                transaction.on_commit(lambda: offer_waitlist_for_bed(bed))
                return Response({"success": False, "message": "That bed is no longer available. You remain on the waiting list for another match."}, status=status.HTTP_409_CONFLICT)

            application = entry.application
            if application:
                previous_status = application.status
                application.property = room.floor.building.property
                application.room = room
                application.status = Application.Status.DRAFT
                application.current_step = 1
                application.save(update_fields=["property", "room", "status", "current_step", "updated_at"])
                ApplicationStatusHistory.objects.create(
                    application=application,
                    from_status=previous_status,
                    to_status=Application.Status.DRAFT,
                    note="Student accepted a room offer from the waiting list.",
                    changed_by=request.user,
                )
            else:
                profile = getattr(request.user, "student_profile", None)
                application = Application.objects.create(
                    student=request.user,
                    property=room.floor.building.property,
                    room=room,
                    status=Application.Status.DRAFT,
                    current_step=1,
                    university=profile.university if profile else "",
                    campus=profile.campus if profile else "",
                    course=profile.course if profile else "",
                    year_of_study=profile.year_of_study if profile else None,
                )
                ApplicationStatusHistory.objects.create(
                    application=application,
                    from_status="",
                    to_status=Application.Status.DRAFT,
                    note="Draft application created after accepting a waiting-list room offer.",
                    changed_by=request.user,
                )

            entry.application = application
            entry.status = WaitingListEntry.Status.ACCEPTED
            entry.accepted_at = timezone.now()
            entry.save(update_fields=["application", "status", "accepted_at", "updated_at"])
            create_notification(
                recipient=request.user,
                actor=request.user,
                notification_type="WAITING_LIST",
                title="Room offer accepted",
                message=f"Continue your application for {room.floor.building.property.name}, Room {room.room_number}.",
                application=application,
                extra_data={"waiting_list_entry": entry.id, "room_id": room.id},
            )

        return Response({"success": True, "application_id": application.id, "message": "Room offer accepted. Complete and submit your application for landlord review."})


class LandlordWaitingListView(APIView):
    permission_classes = [IsAuthenticated]

    def _landlord_error(self, request):
        if request.user.role != "LANDLORD":
            return Response({"success": False, "message": "Landlord access is required."}, status=status.HTTP_403_FORBIDDEN)
        return None

    def get(self, request):
        error = self._landlord_error(request)
        if error:
            return error
        entries = WaitingListEntry.objects.filter(property__landlord=request.user).select_related(
            "student", "property__campus", "room_type", "offered_bed__room"
        )
        status_filter = request.query_params.get("status", "")
        if status_filter in WaitingListEntry.Status.values:
            entries = entries.filter(status=status_filter)
        return Response({"success": True, "count": entries.count(), "entries": [serialize_entry(entry) for entry in entries]})

    def patch(self, request, entry_id):
        error = self._landlord_error(request)
        if error:
            return error
        entry = get_object_or_404(WaitingListEntry, id=entry_id, property__landlord=request.user)
        try:
            priority_score = int(request.data.get("priority_score"))
        except (TypeError, ValueError):
            return Response({"success": False, "message": "Priority must be a whole number from 0 to 100."}, status=status.HTTP_400_BAD_REQUEST)
        if not 0 <= priority_score <= 100:
            return Response({"success": False, "message": "Priority must be a whole number from 0 to 100."}, status=status.HTTP_400_BAD_REQUEST)
        entry.priority_score = priority_score
        entry.save(update_fields=["priority_score", "updated_at"])
        record_audit_event(
            actor=request.user,
            action="WAITLIST_PRIORITY_UPDATED",
            entity_type="waiting_list_entry",
            entity_id=entry.id,
            summary=f"Updated waiting-list priority for {entry.student.get_full_name()}",
            metadata={"priority": priority_score},
            request=request,
        )
        return Response({"success": True, "entry": serialize_entry(entry), "message": "Waiting-list priority updated."})
