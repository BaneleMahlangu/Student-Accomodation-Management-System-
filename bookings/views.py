from django.shortcuts import get_object_or_404
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.db import IntegrityError, transaction
from django.contrib.auth import get_user_model

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from applications.models import Application
from accommodations.availability import sync_room_status
from accommodations.models import Bed, Property, Room
from analytics.services import record_audit_event
from notifications.services import create_notification

from .models import AccommodationChangeRequest, Booking, CheckInRecord
from .serializers import (
    AccommodationChangeRequestSerializer,
    BookingSerializer,
    CheckInConfirmationSerializer,
    CheckInTokenSerializer,
    ManagedBookingSerializer,
)


def _is_administrator(user):
    return getattr(user, "role", None) == "ADMINISTRATOR"


def _change_request_queryset():
    return AccommodationChangeRequest.objects.select_related(
        "booking__property", "booking__room", "student", "target_property", "reviewed_by"
    )


def _managed_booking_queryset(user):
    if user.role == "LANDLORD":
        return Booking.objects.filter(property__landlord=user)
    if _is_administrator(user):
        return Booking.objects.all()
    return Booking.objects.none()


def _booking_bed_conflict(booking, bed):
    if bed.current_student_id not in (None, booking.student_id):
        return "This bed is assigned to a different student. Refresh the booking before continuing."
    other_allocation = Booking.objects.filter(
        bed_id=bed.id,
        status__in=[Booking.Status.CONFIRMED, Booking.Status.ACTIVE],
    ).exclude(pk=booking.pk).exists()
    if other_allocation:
        return "This bed has another confirmed allocation and cannot be released or reassigned."
    return ""


def _release_managed_booking_bed(booking, bed):
    conflict = _booking_bed_conflict(booking, bed)
    if conflict:
        return conflict
    if bed.status in {Bed.BedStatus.RESERVED, Bed.BedStatus.OCCUPIED}:
        bed.status = Bed.BedStatus.AVAILABLE
    if bed.current_student_id == booking.student_id:
        bed.current_student = None
    bed.save(update_fields=["status", "current_student"])
    return ""


def _can_manage_booking(user, booking):
    return _is_administrator(user) or (
        user.role == "LANDLORD" and booking.property.landlord_id == user.id
    )


class StudentTransferOptionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != "STUDENT":
            return Response({"success": False, "message": "Student access required."}, status=status.HTTP_403_FORBIDDEN)
        properties = Property.objects.filter(
            status=Property.PropertyStatus.APPROVED,
            buildings__floors__rooms__beds__status="AVAILABLE",
        ).exclude(landlord__is_active=False).select_related("campus").distinct().order_by("name")
        return Response({
            "success": True,
            "properties": [{"id": item.id, "name": item.name, "campus_name": item.campus.name} for item in properties],
        })


class StudentAccommodationChangeRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    def _owned_booking(self, request, application_id):
        application = get_object_or_404(Application, id=application_id, student=request.user)
        return get_object_or_404(Booking.objects.select_related("property", "room"), application=application)

    def get(self, request, application_id):
        if request.user.role != "STUDENT":
            return Response({"success": False, "message": "Student access required."}, status=status.HTTP_403_FORBIDDEN)
        booking = self._owned_booking(request, application_id)
        requests = _change_request_queryset().filter(booking=booking)
        return Response({"success": True, "requests": AccommodationChangeRequestSerializer(requests, many=True).data})

    def post(self, request, application_id):
        if request.user.role != "STUDENT":
            return Response({"success": False, "message": "Student access required."}, status=status.HTTP_403_FORBIDDEN)
        booking = self._owned_booking(request, application_id)
        if booking.status not in {Booking.Status.CONFIRMED, Booking.Status.ACTIVE}:
            return Response({"success": False, "message": "Only a current or upcoming confirmed booking can be changed."}, status=status.HTTP_400_BAD_REQUEST)

        request_type = str(request.data.get("request_type", "")).upper().strip()
        if request_type not in AccommodationChangeRequest.RequestType.values:
            return Response({"success": False, "message": "Choose a renewal or transfer request."}, status=status.HTTP_400_BAD_REQUEST)
        reason = str(request.data.get("reason", "")).strip()
        if len(reason) < 10:
            return Response({"success": False, "message": "Please explain your request in at least 10 characters."}, status=status.HTTP_400_BAD_REQUEST)
        if AccommodationChangeRequest.objects.filter(booking=booking, request_type=request_type, status=AccommodationChangeRequest.Status.PENDING).exists():
            return Response({"success": False, "message": "You already have a pending request of this type."}, status=status.HTTP_409_CONFLICT)

        requested_end_date = None
        target_property = None
        if request_type == AccommodationChangeRequest.RequestType.RENEWAL:
            raw_end_date = str(request.data.get("requested_end_date", "")).strip()
            requested_end_date = parse_date(raw_end_date)
            if not requested_end_date:
                return Response({"success": False, "message": "Enter a valid requested end date."}, status=status.HTTP_400_BAD_REQUEST)
            if requested_end_date <= max(booking.end_date, timezone.localdate()):
                return Response({"success": False, "message": "The requested end date must be after both today and your current booking end date."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if booking.status != Booking.Status.ACTIVE:
                return Response({"success": False, "message": "Transfer requests are available after you have checked in."}, status=status.HTTP_400_BAD_REQUEST)
            raw_property_id = request.data.get("target_property")
            if raw_property_id not in (None, "", 0, "0"):
                target_property = get_object_or_404(
                    Property.objects.filter(
                        status=Property.PropertyStatus.APPROVED,
                        buildings__floors__rooms__beds__status="AVAILABLE",
                    ).distinct(),
                    id=raw_property_id,
                )
                if target_property.id == booking.property_id:
                    return Response({"success": False, "message": "Choose a different property or leave the destination open."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                change_request = AccommodationChangeRequest.objects.create(
                    booking=booking,
                    student=request.user,
                    request_type=request_type,
                    reason=reason,
                    requested_end_date=requested_end_date,
                    target_property=target_property,
                )
        except IntegrityError:
            return Response({"success": False, "message": "You already have a pending request of this type."}, status=status.HTTP_409_CONFLICT)

        create_notification(
            recipient=booking.property.landlord,
            actor=request.user,
            notification_type="SYSTEM",
            title="Accommodation change request received",
            message=f"{request.user.get_full_name() or request.user.email} submitted a {request_type.lower()} request for booking {booking.booking_number}.",
            application=booking.application,
            extra_data={"booking_number": booking.booking_number, "request_type": request_type, "request_id": change_request.id},
        )
        if request_type == AccommodationChangeRequest.RequestType.TRANSFER:
            User = get_user_model()
            for administrator in User.objects.filter(role="ADMINISTRATOR", is_active=True):
                create_notification(
                    recipient=administrator,
                    actor=request.user,
                    notification_type="SYSTEM",
                    title="Transfer request needs review",
                    message=f"A transfer request was submitted for booking {booking.booking_number}.",
                    application=booking.application,
                    extra_data={"booking_number": booking.booking_number, "request_type": request_type, "request_id": change_request.id},
                )
        record_audit_event(
            actor=request.user,
            action=f"ACCOMMODATION_{request_type}_REQUESTED",
            entity_type="accommodation_change_request",
            entity_id=change_request.id,
            summary=f"Student submitted {request_type.lower()} request for {booking.booking_number}",
            metadata={"status": change_request.status},
            request=request,
        )
        return Response({"success": True, "request": AccommodationChangeRequestSerializer(change_request).data}, status=status.HTTP_201_CREATED)


class AccommodationChangeRequestWithdrawalView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        if request.user.role != "STUDENT":
            return Response({"success": False, "message": "Student access required."}, status=status.HTTP_403_FORBIDDEN)
        change_request = get_object_or_404(_change_request_queryset(), id=request_id, student=request.user)
        if change_request.status != AccommodationChangeRequest.Status.PENDING:
            return Response({"success": False, "message": "Only pending requests can be withdrawn."}, status=status.HTTP_400_BAD_REQUEST)
        change_request.status = AccommodationChangeRequest.Status.WITHDRAWN
        change_request.save(update_fields=["status", "pending_key", "updated_at"])
        create_notification(
            recipient=change_request.booking.property.landlord,
            actor=request.user,
            notification_type="SYSTEM",
            title="Accommodation request withdrawn",
            message=f"{request.user.get_full_name() or request.user.email} withdrew a {change_request.request_type.lower()} request.",
            application=change_request.booking.application,
            extra_data={"request_id": change_request.id, "status": change_request.status},
        )
        record_audit_event(actor=request.user, action="ACCOMMODATION_CHANGE_REQUEST_WITHDRAWN", entity_type="accommodation_change_request", entity_id=change_request.id, summary=f"Student withdrew request for {change_request.booking.booking_number}", metadata={"status": change_request.status}, request=request)
        return Response({"success": True, "request": AccommodationChangeRequestSerializer(change_request).data})


class ManagedAccommodationChangeRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _is_administrator(request.user):
            requests = _change_request_queryset()
        elif request.user.role == "LANDLORD":
            requests = _change_request_queryset().filter(booking__property__landlord=request.user)
        else:
            return Response({"success": False, "message": "Landlord or administrator access required."}, status=status.HTTP_403_FORBIDDEN)
        current_status = request.query_params.get("status")
        if current_status in AccommodationChangeRequest.Status.values:
            requests = requests.filter(status=current_status)
        request_type = request.query_params.get("request_type")
        if request_type in AccommodationChangeRequest.RequestType.values:
            requests = requests.filter(request_type=request_type)
        return Response({"success": True, "requests": AccommodationChangeRequestSerializer(requests, many=True).data})


class AccommodationChangeRequestDecisionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        is_admin = _is_administrator(request.user)
        if not is_admin and request.user.role != "LANDLORD":
            return Response({"success": False, "message": "Landlord or administrator access required."}, status=status.HTTP_403_FORBIDDEN)
        queryset = _change_request_queryset()
        if not is_admin:
            queryset = queryset.filter(booking__property__landlord=request.user)
        change_request = get_object_or_404(queryset, id=request_id)
        if change_request.request_type == AccommodationChangeRequest.RequestType.TRANSFER and not is_admin:
            return Response({"success": False, "message": "Transfer requests require administrator review."}, status=status.HTTP_403_FORBIDDEN)
        decision = str(request.data.get("decision", "")).upper().strip()
        if decision not in {AccommodationChangeRequest.Status.APPROVED, AccommodationChangeRequest.Status.DECLINED}:
            return Response({"success": False, "message": "Choose approve or decline."}, status=status.HTTP_400_BAD_REQUEST)
        note = str(request.data.get("decision_note", "")).strip()
        if decision == AccommodationChangeRequest.Status.DECLINED and len(note) < 5:
            return Response({"success": False, "message": "Add a brief reason when declining a request."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            change_request = AccommodationChangeRequest.objects.select_for_update().select_related(
                "booking__property", "booking__application", "student", "target_property"
            ).get(id=change_request.id)
            if change_request.status != AccommodationChangeRequest.Status.PENDING:
                return Response({"success": False, "message": "This request has already been reviewed."}, status=status.HTTP_409_CONFLICT)
            change_request.status = decision
            change_request.decision_note = note
            change_request.reviewed_by = request.user
            change_request.reviewed_at = timezone.now()
            change_request.save(update_fields=["status", "pending_key", "decision_note", "reviewed_by", "reviewed_at", "updated_at"])
        if decision == AccommodationChangeRequest.Status.APPROVED:
            message = "Your request was approved for coordination. Your current booking and room allocation remain unchanged until the updated accommodation arrangement is confirmed."
        else:
            message = f"Your {change_request.request_type.lower()} request was declined."
            if note:
                message += f" Reviewer note: {note}"
        create_notification(
            recipient=change_request.student,
            actor=request.user,
            notification_type="SYSTEM",
            title=f"{change_request.get_request_type_display()} request {decision.lower()}",
            message=message,
            application=change_request.booking.application,
            extra_data={"request_id": change_request.id, "request_type": change_request.request_type, "status": decision},
        )
        record_audit_event(
            actor=request.user,
            action=f"ACCOMMODATION_{change_request.request_type}_REQUEST_{decision}",
            entity_type="accommodation_change_request",
            entity_id=change_request.id,
            summary=f"{request.user.get_full_name() or request.user.email} {decision.lower()} {change_request.request_type.lower()} request",
            metadata={"status": decision, "decision": decision},
            request=request,
        )
        return Response({"success": True, "request": AccommodationChangeRequestSerializer(change_request).data})


class ManagedBookingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == "LANDLORD":
            bookings = Booking.objects.filter(property__landlord=request.user)
        elif _is_administrator(request.user):
            bookings = Booking.objects.all()
        else:
            return Response({"success": False, "message": "Landlord or administrator access required."}, status=status.HTTP_403_FORBIDDEN)
        query = request.query_params.get("q", "").strip()
        if query:
            from django.db.models import Q
            bookings = bookings.filter(
                Q(booking_number__icontains=query)
                | Q(student__first_name__icontains=query)
                | Q(student__last_name__icontains=query)
                | Q(student__email__icontains=query)
                | Q(property__name__icontains=query)
            )
        current_status = request.query_params.get("status")
        if current_status in Booking.Status.values:
            bookings = bookings.filter(status=current_status)
        bookings = bookings.select_related(
            "student", "student__student_profile", "property", "room", "bed",
            "check_in_record__checked_in_by",
        ).order_by("-updated_at", "-id")
        return Response({"success": True, "bookings": ManagedBookingSerializer(bookings, many=True, context={"request": request}).data})


class ManagedBookingTransferOptionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, booking_id):
        if request.user.role not in {"LANDLORD", "ADMINISTRATOR"}:
            return Response({"success": False, "message": "Landlord or administrator access required."}, status=status.HTTP_403_FORBIDDEN)
        booking = get_object_or_404(
            _managed_booking_queryset(request.user).select_related("property", "contract"),
            id=booking_id,
        )
        if booking.status not in {Booking.Status.CONFIRMED, Booking.Status.ACTIVE}:
            return Response({"success": False, "message": "Only a current or upcoming stay can be moved."}, status=status.HTTP_409_CONFLICT)
        if booking.contract.status != booking.contract.Status.SIGNED:
            return Response({"success": False, "message": "A signed contract is required before changing the room allocation."}, status=status.HTTP_409_CONFLICT)

        managed_room_statuses = {
            Room.RoomStatus.MAINTENANCE,
            Room.RoomStatus.BLOCKED,
            Room.RoomStatus.CLEANING,
            Room.RoomStatus.UNAVAILABLE,
        }
        rooms = Room.objects.filter(
            property_id=booking.property_id,
            monthly_price=booking.monthly_fee,
            beds__status=Bed.BedStatus.AVAILABLE,
        ).exclude(pk=booking.room_id).exclude(status__in=managed_room_statuses).prefetch_related("beds").distinct().order_by("room_number")
        options = []
        for room in rooms:
            beds = room.beds.filter(
                status=Bed.BedStatus.AVAILABLE,
                current_student__isnull=True,
            ).order_by("bed_number")
            if beds.exists():
                options.append({
                    "id": room.id,
                    "room_number": room.room_number,
                    "monthly_price": str(room.monthly_price),
                    "beds": [{"id": bed.id, "bed_number": bed.bed_number} for bed in beds],
                })
        return Response({"success": True, "rooms": options})


class ManagedBookingTerminationView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, booking_id):
        if request.user.role not in {"LANDLORD", "ADMINISTRATOR"}:
            return Response({"success": False, "message": "Landlord or administrator access required."}, status=status.HTTP_403_FORBIDDEN)
        booking = get_object_or_404(
            _managed_booking_queryset(request.user).select_for_update().select_related("property", "contract", "application"),
            id=booking_id,
        )
        if booking.status not in {Booking.Status.CONFIRMED, Booking.Status.ACTIVE}:
            return Response({"success": False, "message": "Only a current or upcoming stay can be ended."}, status=status.HTTP_409_CONFLICT)
        if booking.contract.status != booking.contract.Status.SIGNED:
            return Response({"success": False, "message": "The booking does not have a signed contract to terminate."}, status=status.HTTP_409_CONFLICT)
        reason = str(request.data.get("reason", "")).strip()
        if len(reason) < 10 or len(reason) > 2000:
            return Response({"success": False, "message": "Enter a termination reason between 10 and 2,000 characters."}, status=status.HTTP_400_BAD_REQUEST)

        room = Room.objects.select_for_update().get(pk=booking.room_id)
        bed = Bed.objects.select_for_update().get(pk=booking.bed_id)
        conflict = _release_managed_booking_bed(booking, bed)
        if conflict:
            return Response({"success": False, "message": conflict}, status=status.HTTP_409_CONFLICT)

        previous_status = booking.status
        ended_at = timezone.now()
        booking.status = Booking.Status.CANCELLED
        update_fields = ["status", "updated_at"]
        if previous_status == Booking.Status.ACTIVE:
            booking.checked_out_at = ended_at
            update_fields.append("checked_out_at")
        booking.save(update_fields=update_fields)
        booking.contract.status = booking.contract.Status.CANCELLED
        booking.contract.save(update_fields=["status", "updated_at"])
        sync_room_status(room)

        from waitinglist.services import offer_waitlist_for_bed
        offer_waitlist_for_bed(bed)
        sync_room_status(room)

        record_audit_event(
            actor=request.user,
            action="BOOKING_TERMINATED",
            entity_type="booking",
            entity_id=booking.id,
            summary=f"{request.user.get_full_name() or request.user.email} ended {booking.booking_number}",
            metadata={
                "from_status": previous_status,
                "to_status": booking.status,
                "room_number": room.room_number,
                "bed_number": bed.bed_number,
                "reason": reason,
            },
            request=request,
        )
        create_notification(
            recipient=booking.student,
            actor=request.user,
            notification_type="BOOKING_TERMINATED",
            title="Accommodation contract ended",
            message=f"Your accommodation contract for {booking.property.name}, room {room.room_number}, was ended by the landlord. Reason: {reason}",
            application=booking.application,
            extra_data={"booking_number": booking.booking_number, "contract_number": booking.contract.contract_number, "reason": reason},
        )
        return Response({
            "success": True,
            "message": "The contract was ended and the room allocation was released.",
            "booking": ManagedBookingSerializer(booking, context={"request": request}).data,
        })


class ManagedBookingTransferView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, booking_id):
        if request.user.role not in {"LANDLORD", "ADMINISTRATOR"}:
            return Response({"success": False, "message": "Landlord or administrator access required."}, status=status.HTTP_403_FORBIDDEN)
        booking = get_object_or_404(
            _managed_booking_queryset(request.user).select_for_update().select_related("property", "contract", "application"),
            id=booking_id,
        )
        if booking.status not in {Booking.Status.CONFIRMED, Booking.Status.ACTIVE}:
            return Response({"success": False, "message": "Only a current or upcoming stay can be moved."}, status=status.HTTP_409_CONFLICT)
        if booking.contract.status != booking.contract.Status.SIGNED:
            return Response({"success": False, "message": "A signed contract is required before changing the room allocation."}, status=status.HTTP_409_CONFLICT)
        reason = str(request.data.get("reason", "")).strip()
        if len(reason) < 10 or len(reason) > 2000:
            return Response({"success": False, "message": "Enter a transfer reason between 10 and 2,000 characters."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            target_bed_id = int(request.data.get("target_bed", ""))
        except (TypeError, ValueError):
            return Response({"success": False, "message": "Choose an available bed in the destination room."}, status=status.HTTP_400_BAD_REQUEST)

        target = Bed.objects.filter(
            id=target_bed_id,
            room__property_id=booking.property_id,
        ).select_related("room").first()
        if not target or target.room_id == booking.room_id:
            return Response({"success": False, "message": "Choose a different room in this property."}, status=status.HTTP_400_BAD_REQUEST)
        if target.room.monthly_price != booking.monthly_fee:
            return Response({"success": False, "message": "The destination room must have the same monthly rent as the signed contract."}, status=status.HTTP_400_BAD_REQUEST)

        rooms = {
            room.id: room
            for room in Room.objects.select_for_update().filter(
                id__in=[booking.room_id, target.room_id],
            ).order_by("id")
        }
        source_room = rooms[booking.room_id]
        target_room = rooms[target.room_id]
        beds = {
            bed.id: bed
            for bed in Bed.objects.select_for_update().filter(
                id__in=[booking.bed_id, target_bed_id],
            ).order_by("id")
        }
        source_bed = beds[booking.bed_id]
        target_bed = beds[target_bed_id]

        if source_room.property_id != booking.property_id or source_bed.room_id != source_room.id or target_room.property_id != booking.property_id:
            return Response({"success": False, "message": "The booking allocation does not match this property's room inventory."}, status=status.HTTP_409_CONFLICT)
        if target_room.monthly_price != booking.monthly_fee:
            return Response({"success": False, "message": "The destination room's rent changed. Refresh the room options before continuing."}, status=status.HTTP_409_CONFLICT)
        sync_room_status(target_room)
        if target_room.status != Room.RoomStatus.AVAILABLE or target_bed.room_id != target_room.id:
            return Response({"success": False, "message": "The destination room is not available."}, status=status.HTTP_409_CONFLICT)
        if target_bed.status != Bed.BedStatus.AVAILABLE or target_bed.current_student_id:
            return Response({"success": False, "message": "That bed has just been taken. Refresh the room options and choose another bed."}, status=status.HTTP_409_CONFLICT)
        target_conflict = _booking_bed_conflict(booking, target_bed)
        if target_conflict:
            return Response({"success": False, "message": target_conflict}, status=status.HTTP_409_CONFLICT)
        source_conflict = _release_managed_booking_bed(booking, source_bed)
        if source_conflict:
            return Response({"success": False, "message": source_conflict}, status=status.HTTP_409_CONFLICT)

        previous_room_number = source_room.room_number
        previous_bed_number = source_bed.bed_number
        if booking.status == Booking.Status.ACTIVE:
            target_bed.status = Bed.BedStatus.OCCUPIED
            target_bed.current_student = booking.student
        else:
            target_bed.status = Bed.BedStatus.RESERVED
            target_bed.current_student = None
        target_bed.save(update_fields=["status", "current_student"])

        booking.room = target_room
        booking.bed = target_bed
        booking.save(update_fields=["room", "bed", "updated_at"])
        booking.application.room = target_room
        booking.application.save(update_fields=["room", "updated_at"])
        booking.contract.room_number = target_room.room_number
        booking.contract.save(update_fields=["room_number", "updated_at"])
        sync_room_status(source_room)
        sync_room_status(target_room)

        from waitinglist.services import offer_waitlist_for_bed
        offer_waitlist_for_bed(source_bed)
        sync_room_status(source_room)

        record_audit_event(
            actor=request.user,
            action="BOOKING_ROOM_TRANSFERRED",
            entity_type="booking",
            entity_id=booking.id,
            summary=f"{request.user.get_full_name() or request.user.email} moved {booking.booking_number} to room {target_room.room_number}",
            metadata={
                "status": booking.status,
                "from_room_number": previous_room_number,
                "from_bed_number": previous_bed_number,
                "to_room_number": target_room.room_number,
                "to_bed_number": target_bed.bed_number,
                "reason": reason,
            },
            request=request,
        )
        create_notification(
            recipient=booking.student,
            actor=request.user,
            notification_type="BOOKING_ROOM_TRANSFERRED",
            title="Room allocation updated",
            message=f"Your accommodation allocation at {booking.property.name} has moved from room {previous_room_number}, bed {previous_bed_number}, to room {target_room.room_number}, bed {target_bed.bed_number}. Reason: {reason}",
            application=booking.application,
            extra_data={
                "booking_number": booking.booking_number,
                "from_room_number": previous_room_number,
                "from_bed_number": previous_bed_number,
                "to_room_number": target_room.room_number,
                "to_bed_number": target_bed.bed_number,
                "reason": reason,
            },
        )
        return Response({
            "success": True,
            "message": "The student was moved and both room allocations were updated.",
            "booking": ManagedBookingSerializer(booking, context={"request": request}).data,
        })


class StudentBookingView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, application_id):

        if request.user.role != "STUDENT":
            return Response(
                {
                    "success": False,
                    "message": "Student access required.",
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

        booking = Booking.objects.filter(application=application).first()
        if not booking:
            return Response(
                {"success": True, "booking": None},
                status=status.HTTP_200_OK,
            )

        serializer = BookingSerializer(booking)

        return Response(
            {
                "success": True,
                "booking": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class StudentCheckInView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, application_id):
        return Response(
            {
                "success": False,
                "message": "Check-in must be confirmed by authorised residence staff after an in-person ID, room and key handover check.",
            },
            status=status.HTTP_409_CONFLICT,
        )


class StudentCheckOutView(APIView):

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, application_id):

        if request.user.role != "STUDENT":
            return Response(
                {
                    "success": False,
                    "message": "Student access required.",
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

        booking = get_object_or_404(
            Booking.objects.select_for_update(),
            application=application,
        )

        if booking.status != Booking.Status.ACTIVE:
            return Response(
                {
                    "success": False,
                    "message": (
                        "This booking cannot be checked out because "
                        f"its current status is "
                        f"{booking.get_status_display()}."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not booking.checked_in_at:
            return Response(
                {
                    "success": False,
                    "message": (
                        "A check-in record is required "
                        "before checkout."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.room = Room.objects.select_for_update().get(pk=booking.room_id)
        booking.bed = Bed.objects.select_for_update().get(pk=booking.bed_id)

        booking.status = Booking.Status.COMPLETED
        booking.checked_out_at = timezone.now()

        booking.save(
            update_fields=[
                "status",
                "checked_out_at",
                "updated_at",
            ]
        )

        bed = booking.bed
        bed.status = "AVAILABLE"
        bed.current_student = None
        bed.save(update_fields=["status", "current_student"])
        sync_room_status(booking.room)
        from waitinglist.services import offer_waitlist_for_bed
        offer_waitlist_for_bed(bed)

        create_notification(
            recipient=request.user,
            actor=request.user,
            notification_type="CHECKED_OUT",
            title="Check-out completed",
            message=(
                f"You have successfully checked out "
                f"of {booking.property.name}, "
                f"Room {booking.room.room_number}."
            ),
            application=application,
            extra_data={
                "booking_number": booking.booking_number,
                "property": (
                    booking.property.name
                    if booking.property
                    else None
                ),
                "room": (
                    booking.room.room_number
                    if booking.room
                    else None
                ),
                "checked_out_at": (
                    booking.checked_out_at.isoformat()
                    if booking.checked_out_at
                    else None
                ),
            },
        )

        serializer = BookingSerializer(booking)

        return Response(
            {
                "success": True,
                "message": (
                    "You have been checked out successfully."
                ),
                "booking": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


def _check_in_booking_for_staff(request, token_serializer, *, for_update=False):
    role = getattr(request.user, "role", "")
    if role not in {"ADMIN", "ADMINISTRATOR", "LANDLORD"}:
        return None, Response(
            {"success": False, "message": "Only authorised residence staff can check a student in."},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = token_serializer(data=request.data)
    if not serializer.is_valid():
        return None, Response(
            {"success": False, "message": "Scan a valid StudentHaven check-in QR code.", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    queryset = Booking.objects.select_related(
        "application", "contract", "student", "property__landlord",
        "room", "bed", "bed__current_student",
    )
    if for_update:
        queryset = queryset.select_for_update()
    booking = queryset.filter(check_in_token=serializer.validated_data["token"]).first()
    if not booking:
        return None, Response(
            {"success": False, "message": "No booking matches this check-in QR code."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if role == "LANDLORD":
        try:
            profile = request.user.landlord_profile
        except ObjectDoesNotExist:
            profile = None
        if booking.property.landlord_id != request.user.id or not profile or profile.verification_status != "VERIFIED":
            return None, Response(
                {"success": False, "message": "A verified landlord can check in students only at their own property."},
                status=status.HTTP_403_FORBIDDEN,
            )

    if booking.status != Booking.Status.CONFIRMED:
        return None, Response(
            {"success": False, "message": f"This booking is {booking.get_status_display().lower()} and cannot be checked in."},
            status=status.HTTP_409_CONFLICT,
        )
    today = timezone.localdate()
    if today < booking.start_date:
        return None, Response(
            {"success": False, "message": f"Check-in opens on {booking.start_date:%d %B %Y}."},
            status=status.HTTP_409_CONFLICT,
        )
    if today > booking.end_date:
        return None, Response(
            {"success": False, "message": "The accommodation period has ended."},
            status=status.HTTP_409_CONFLICT,
        )
    if booking.contract.status != booking.contract.Status.SIGNED:
        return None, Response(
            {"success": False, "message": "The accommodation contract is not fully signed."},
            status=status.HTTP_409_CONFLICT,
        )

    from funding.models import FundingPayment
    funding_payments = FundingPayment.objects.filter(contract=booking.contract)
    if for_update:
        funding_payments = funding_payments.select_for_update()
    funding_payment = funding_payments.first()
    from funding.services import first_rent_installment_due

    first_rent_due = first_rent_installment_due(funding_payment) if funding_payment else None
    if (
        not funding_payment
        or funding_payment.amount_paid < first_rent_due
    ):
        return None, Response(
            {"success": False, "message": "The first month's rent must be confirmed before check-in. Later rent remains due on the monthly schedule."},
            status=status.HTTP_409_CONFLICT,
        )
    if booking.bed.status != "RESERVED" or booking.bed.current_student_id:
        return None, Response(
            {"success": False, "message": "The assigned bed is no longer reserved. Contact StudentHaven before handing over access."},
            status=status.HTTP_409_CONFLICT,
        )

    return booking, None


class CheckInPreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        booking, error = _check_in_booking_for_staff(request, CheckInTokenSerializer)
        if error:
            return error
        return Response({
            "success": True,
            "message": "Booking verified. Check the student's photo ID, allocated room and bed, and access handover in person before confirming.",
            "booking": BookingSerializer(booking).data,
        })


class AdminScanCheckInView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if getattr(request.user, "role", "") not in {"ADMIN", "ADMINISTRATOR", "LANDLORD"}:
            return Response(
                {"success": False, "message": "Only authorised residence staff can check a student in."},
                status=status.HTTP_403_FORBIDDEN,
            )
        confirmation = CheckInConfirmationSerializer(data=request.data)
        if not confirmation.is_valid():
            return Response(
                {"success": False, "message": "Complete every in-person arrival check before confirming check-in.", "errors": confirmation.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            booking, error = _check_in_booking_for_staff(request, CheckInTokenSerializer, for_update=True)
            if error:
                return error
            booking.room = Room.objects.select_for_update().get(pk=booking.room_id)
            booking.bed = Bed.objects.select_for_update().get(id=booking.bed_id)
            if CheckInRecord.objects.filter(booking=booking).exists():
                return Response(
                    {"success": False, "message": "This booking already has a check-in record."},
                    status=status.HTTP_409_CONFLICT,
                )
            # Repeat all state-sensitive checks while holding the booking lock.
            if booking.status != Booking.Status.CONFIRMED or booking.bed.status != "RESERVED" or booking.bed.current_student_id:
                return Response(
                    {"success": False, "message": "The booking or bed allocation changed. Refresh the booking and verify it again."},
                    status=status.HTTP_409_CONFLICT,
                )

            checked_in_at = timezone.now()
            booking.status = Booking.Status.ACTIVE
            booking.checked_in_at = checked_in_at
            booking.checked_out_at = None
            booking.save(update_fields=["status", "checked_in_at", "checked_out_at", "updated_at"])

            CheckInRecord.objects.create(
                booking=booking,
                checked_in_by=request.user,
                identity_document_type=confirmation.validated_data["identity_document_type"],
                identity_verified=confirmation.validated_data["identity_verified"],
                room_inspected=confirmation.validated_data["room_inspected"],
                keys_handed_over=confirmation.validated_data["keys_handed_over"],
                arrival_notes=confirmation.validated_data.get("arrival_notes", "").strip(),
            )

            booking.bed.status = "OCCUPIED"
            booking.bed.current_student = booking.student
            booking.bed.save(update_fields=["status", "current_student"])
            sync_room_status(booking.room)

            record_audit_event(
                actor=request.user,
                action="BOOKING_CHECKED_IN",
                entity_type="booking",
                entity_id=booking.id,
                summary=f"{request.user.get_full_name() or request.user.email} checked in {booking.booking_number}",
                metadata={
                    "identity_document_type": confirmation.validated_data["identity_document_type"],
                    "identity_verified": True,
                    "room_inspected": True,
                    "keys_handed_over": True,
                },
                request=request,
            )

        create_notification(
            recipient=booking.student,
            actor=request.user,
            notification_type="CHECKED_IN",
            title="Check-in completed",
            message=f"Residence staff checked you in at {booking.property.name}, room {booking.room.room_number}, bed {booking.bed.bed_number}.",
            application=booking.application,
            extra_data={
                "booking_number": booking.booking_number,
                "property": booking.property.name,
                "room": booking.room.room_number,
                "bed": booking.bed.bed_number,
                "checked_in_at": checked_in_at.isoformat(),
                "check_in_method": "STAFF_QR_VERIFIED",
            },
        )
        return Response({
            "success": True,
            "message": "Student check-in completed and recorded.",
            "booking": BookingSerializer(booking).data,
        }, status=status.HTTP_200_OK)
