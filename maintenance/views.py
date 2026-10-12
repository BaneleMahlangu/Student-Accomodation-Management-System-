from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.models import Booking
from analytics.services import record_audit_event
from notifications.services import create_notification

from .models import MaintenanceRequest
from .serializers import MaintenanceRequestSerializer


class StudentMaintenanceListCreateView(APIView):

    permission_classes = [IsAuthenticated]

    parser_classes = [
        MultiPartParser,
        FormParser,
    ]

    def get(self, request, application_id):

        if request.user.role != "STUDENT":
            return Response(
                {
                    "success": False,
                    "message": "Student access required.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        booking = get_object_or_404(
            Booking,
            application_id=application_id,
        )

        if booking.student_id != request.user.id:
            return Response(
                {
                    "success": False,
                    "message": "Access denied.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        requests = (
            MaintenanceRequest.objects
            .filter(
                booking=booking,
                student=request.user,
            )
            .select_related(
                "booking__property",
                "booking__room",
                "booking__bed",
                "assigned_to",
            )
            .order_by("-created_at")
        )

        serializer = MaintenanceRequestSerializer(
            requests,
            many=True,
        )

        return Response(
            {
                "success": True,
                "maintenance_requests": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request, application_id):

        if request.user.role != "STUDENT":
            return Response(
                {
                    "success": False,
                    "message": "Student access required.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        booking = get_object_or_404(
            Booking,
            application_id=application_id,
        )

        if booking.student_id != request.user.id:
            return Response(
                {
                    "success": False,
                    "message": "Access denied.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if booking.status != Booking.Status.ACTIVE:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Maintenance requests can only "
                        "be created after check-in."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        category = request.data.get("category")
        title = request.data.get("title")
        description = request.data.get("description")
        priority = request.data.get(
            "priority",
            MaintenanceRequest.Priority.MEDIUM,
        )

        if not category:
            return Response(
                {
                    "success": False,
                    "message": "Maintenance category is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not title:
            return Response(
                {
                    "success": False,
                    "message": "Maintenance title is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not description:
            return Response(
                {
                    "success": False,
                    "message": "Maintenance description is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_categories = {
            choice[0]
            for choice in MaintenanceRequest.Category.choices
        }

        if category not in valid_categories:
            return Response(
                {
                    "success": False,
                    "message": "Invalid maintenance category.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_priorities = {
            choice[0]
            for choice in MaintenanceRequest.Priority.choices
        }

        if priority not in valid_priorities:
            return Response(
                {
                    "success": False,
                    "message": "Invalid maintenance priority.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        maintenance_request = (
            MaintenanceRequest.objects.create(
                booking=booking,
                student=request.user,
                category=category,
                title=title.strip(),
                description=description.strip(),
                priority=priority,
                photo=request.FILES.get("photo"),
            )
        )

        # =====================================================
        # NOTIFICATION: MAINTENANCE REQUEST SUBMITTED
        # =====================================================

        create_notification(
            recipient=request.user,
            actor=request.user,
            notification_type="MAINTENANCE_SUBMITTED",
            title="Maintenance request submitted",
            message=(
                f"Your maintenance request "
                f"{maintenance_request.reference_number} "
                f"has been submitted successfully."
            ),
            application=booking.application,
            maintenance_request=maintenance_request,
            extra_data={
                "reference_number": (
                    maintenance_request.reference_number
                ),
                "category": (
                    maintenance_request.category
                ),
                "priority": (
                    maintenance_request.priority
                ),
                "status": (
                    maintenance_request.status
                ),
            },
        )

        serializer = MaintenanceRequestSerializer(
            maintenance_request
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Maintenance request submitted successfully."
                ),
                "maintenance_request": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


class StudentMaintenanceDetailView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, request_id):

        if request.user.role != "STUDENT":
            return Response(
                {
                    "success": False,
                    "message": "Student access required.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        maintenance_request = get_object_or_404(
            MaintenanceRequest,
            id=request_id,
            student=request.user,
        )

        serializer = MaintenanceRequestSerializer(
            maintenance_request
        )

        return Response(
            {
                "success": True,
                "maintenance_request": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class AdminMaintenanceListView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        if request.user.role not in [
            "ADMIN",
            "ADMINISTRATOR",
        ]:
            return Response(
                {
                    "success": False,
                    "message": "Administrator access required.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        requests = (
            MaintenanceRequest.objects
            .select_related(
                "student",
                "booking__property",
                "booking__room",
                "booking__bed",
                "assigned_to",
            )
            .order_by("-created_at")
        )

        serializer = MaintenanceRequestSerializer(
            requests,
            many=True,
        )

        return Response(
            {
                "success": True,
                "count": requests.count(),
                "maintenance_requests": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class AdminMaintenanceUpdateView(APIView):

    permission_classes = [IsAuthenticated]

    def patch(self, request, request_id):

        if request.user.role not in [
            "ADMIN",
            "ADMINISTRATOR",
        ]:
            return Response(
                {
                    "success": False,
                    "message": "Administrator access required.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        maintenance_request = get_object_or_404(
            MaintenanceRequest,
            id=request_id,
        )

        # Keep the values before making changes so that
        # notifications can accurately record what changed.
        previous_status = (
            maintenance_request.status
        )

        previous_resolution_notes = (
            maintenance_request.resolution_notes
        )

        new_status = request.data.get("status")

        resolution_notes = request.data.get(
            "resolution_notes"
        )

        if new_status:

            valid_statuses = {
                choice[0]
                for choice
                in MaintenanceRequest.Status.choices
            }

            if new_status not in valid_statuses:
                return Response(
                    {
                        "success": False,
                        "message": "Invalid maintenance status.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            maintenance_request.status = new_status

            now = timezone.now()

            # Automatically assign the administrator who
            # performs the assignment if nobody is assigned.
            if new_status == MaintenanceRequest.Status.ASSIGNED:

                if not maintenance_request.assigned_to:
                    maintenance_request.assigned_to = request.user

                if not maintenance_request.assigned_at:
                    maintenance_request.assigned_at = now

            if (
                new_status
                == MaintenanceRequest.Status.IN_PROGRESS
                and not maintenance_request.started_at
            ):
                maintenance_request.started_at = now

            if (
                new_status
                == MaintenanceRequest.Status.RESOLVED
                and not maintenance_request.resolved_at
            ):
                maintenance_request.resolved_at = now

        if resolution_notes is not None:
            maintenance_request.resolution_notes = (
                resolution_notes
            )

        maintenance_request.save()

        # =====================================================
        # DETECT WHAT ACTUALLY CHANGED
        # =====================================================

        status_changed = (
            previous_status
            != maintenance_request.status
        )

        resolution_notes_changed = (
            previous_resolution_notes
            != maintenance_request.resolution_notes
        )

        # =====================================================
        # NOTIFICATIONS
        # =====================================================

        if status_changed or resolution_notes_changed:

            # -------------------------------------------------
            # ASSIGNED
            # -------------------------------------------------

            if (
                maintenance_request.status
                == MaintenanceRequest.Status.ASSIGNED
            ):

                if maintenance_request.assigned_to:
                    assigned_name = (
                        maintenance_request.assigned_to.get_full_name()
                        or maintenance_request.assigned_to.email
                    )
                else:
                    assigned_name = (
                        "a Student Haven administrator"
                    )

                create_notification(
                    recipient=maintenance_request.student,
                    actor=request.user,
                    notification_type=(
                        "MAINTENANCE_ASSIGNED"
                    ),
                    title=(
                        "Maintenance request assigned"
                    ),
                    message=(
                        f"Your maintenance request "
                        f"{maintenance_request.reference_number} "
                        f"has been assigned to "
                        f"{assigned_name}."
                    ),
                    application=(
                        maintenance_request.booking.application
                    ),
                    maintenance_request=(
                        maintenance_request
                    ),
                    extra_data={
                        "previous_status": (
                            previous_status
                        ),
                        "new_status": (
                            maintenance_request.status
                        ),
                        "assigned_to": (
                            maintenance_request.assigned_to_id
                        ),
                    },
                )

            # -------------------------------------------------
            # RESOLVED
            # -------------------------------------------------

            elif (
                maintenance_request.status
                == MaintenanceRequest.Status.RESOLVED
            ):

                resolution_message = (
                    f"Your maintenance request "
                    f"{maintenance_request.reference_number} "
                    f"has been marked as resolved."
                )

                if (
                    maintenance_request.resolution_notes
                ):
                    resolution_message += (
                        " Resolution details: "
                        f"{maintenance_request.resolution_notes}"
                    )

                create_notification(
                    recipient=(
                        maintenance_request.student
                    ),
                    actor=request.user,
                    notification_type=(
                        "MAINTENANCE_RESOLVED"
                    ),
                    title=(
                        "Maintenance request resolved"
                    ),
                    message=resolution_message,
                    application=(
                        maintenance_request.booking.application
                    ),
                    maintenance_request=(
                        maintenance_request
                    ),
                    extra_data={
                        "previous_status": (
                            previous_status
                        ),
                        "new_status": (
                            maintenance_request.status
                        ),
                        "resolution_notes": (
                            maintenance_request.resolution_notes
                        ),
                    },
                )

            # -------------------------------------------------
            # OTHER STATUS / RESOLUTION UPDATES
            # -------------------------------------------------

            else:

                update_message = (
                    f"Your maintenance request "
                    f"{maintenance_request.reference_number} "
                    f"has been updated."
                )

                if status_changed:
                    update_message += (
                        " Current status: "
                        f"{maintenance_request.get_status_display()}."
                    )

                if (
                    maintenance_request.resolution_notes
                ):
                    update_message += (
                        " Update details: "
                        f"{maintenance_request.resolution_notes}"
                    )

                create_notification(
                    recipient=(
                        maintenance_request.student
                    ),
                    actor=request.user,
                    notification_type=(
                        "MAINTENANCE_UPDATED"
                    ),
                    title=(
                        "Maintenance request updated"
                    ),
                    message=update_message,
                    application=(
                        maintenance_request.booking.application
                    ),
                    maintenance_request=(
                        maintenance_request
                    ),
                    extra_data={
                        "previous_status": (
                            previous_status
                        ),
                        "new_status": (
                            maintenance_request.status
                        ),
                        "resolution_notes": (
                            maintenance_request.resolution_notes
                        ),
                    },
                )

        serializer = MaintenanceRequestSerializer(
            maintenance_request
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Maintenance request updated successfully."
                ),
                "maintenance_request": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class StudentMaintenanceConfirmView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):

        if request.user.role != "STUDENT":
            return Response(
                {
                    "success": False,
                    "message": "Student access required.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        maintenance_request = get_object_or_404(
            MaintenanceRequest,
            id=request_id,
            student=request.user,
        )

        if (
            maintenance_request.status
            != MaintenanceRequest.Status.RESOLVED
        ):
            return Response(
                {
                    "success": False,
                    "message": (
                        "Only resolved maintenance requests "
                        "can be confirmed."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        maintenance_request.status = (
            MaintenanceRequest.Status.STUDENT_CONFIRMED
        )

        maintenance_request.student_confirmed_at = (
            timezone.now()
        )

        maintenance_request.save()

        # =====================================================
        # NOTIFICATION: MAINTENANCE CONFIRMED
        # =====================================================

        create_notification(
            recipient=maintenance_request.student,
            actor=request.user,
            notification_type=(
                "MAINTENANCE_CONFIRMED"
            ),
            title=(
                "Maintenance resolution confirmed"
            ),
            message=(
                f"You confirmed that maintenance "
                f"request "
                f"{maintenance_request.reference_number} "
                f"has been resolved."
            ),
            application=(
                maintenance_request.booking.application
            ),
            maintenance_request=maintenance_request,
            extra_data={
                "previous_status": (
                    MaintenanceRequest.Status.RESOLVED
                ),
                "new_status": (
                    MaintenanceRequest.Status.STUDENT_CONFIRMED
                ),
                "confirmed_at": (
                    maintenance_request.student_confirmed_at.isoformat()
                    if maintenance_request.student_confirmed_at
                    else None
                ),
            },
        )

        serializer = MaintenanceRequestSerializer(
            maintenance_request
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Maintenance resolution confirmed."
                ),
                "maintenance_request": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class LandlordMaintenanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != "LANDLORD":
            return Response({"success": False, "message": "Landlord access required."}, status=status.HTTP_403_FORBIDDEN)
        requests = MaintenanceRequest.objects.filter(
            booking__property__landlord=request.user,
        ).select_related(
            "student", "booking__property", "booking__room", "booking__bed", "assigned_to",
        ).order_by("-created_at")
        current_status = request.query_params.get("status")
        if current_status in MaintenanceRequest.Status.values:
            requests = requests.filter(status=current_status)
        serializer = MaintenanceRequestSerializer(requests, many=True, context={"request": request})
        return Response({"success": True, "count": requests.count(), "maintenance_requests": serializer.data})

    def patch(self, request, request_id):
        if request.user.role != "LANDLORD":
            return Response({"success": False, "message": "Landlord access required."}, status=status.HTTP_403_FORBIDDEN)
        maintenance_request = get_object_or_404(
            MaintenanceRequest.objects.select_related("student", "booking__property", "booking__application"),
            id=request_id,
            booking__property__landlord=request.user,
        )
        previous_status = maintenance_request.status
        new_status = str(request.data.get("status", "")).upper().strip()
        allowed_transitions = {
            MaintenanceRequest.Status.SUBMITTED: {MaintenanceRequest.Status.ASSIGNED},
            MaintenanceRequest.Status.ASSIGNED: {MaintenanceRequest.Status.IN_PROGRESS, MaintenanceRequest.Status.WAITING_FOR_PARTS},
            MaintenanceRequest.Status.IN_PROGRESS: {MaintenanceRequest.Status.WAITING_FOR_PARTS, MaintenanceRequest.Status.RESOLVED},
            MaintenanceRequest.Status.WAITING_FOR_PARTS: {MaintenanceRequest.Status.IN_PROGRESS, MaintenanceRequest.Status.RESOLVED},
        }
        if new_status not in allowed_transitions.get(previous_status, set()):
            return Response({"success": False, "message": "That maintenance status change is not allowed from the current state."}, status=status.HTTP_409_CONFLICT)
        resolution_notes = str(request.data.get("resolution_notes", "")).strip()
        if new_status == MaintenanceRequest.Status.RESOLVED and len(resolution_notes) < 10:
            return Response({"success": False, "message": "Add at least 10 characters explaining the completed repair."}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        maintenance_request.status = new_status
        if new_status == MaintenanceRequest.Status.ASSIGNED:
            maintenance_request.assigned_to = request.user
            maintenance_request.assigned_at = now
        elif new_status == MaintenanceRequest.Status.IN_PROGRESS and not maintenance_request.started_at:
            maintenance_request.started_at = now
        elif new_status == MaintenanceRequest.Status.RESOLVED:
            maintenance_request.resolution_notes = resolution_notes
            maintenance_request.resolved_at = now
        maintenance_request.save()

        title = "Maintenance request resolved" if new_status == MaintenanceRequest.Status.RESOLVED else "Maintenance request updated"
        message = (
            f"Your maintenance request {maintenance_request.reference_number} has been marked resolved. "
            f"Residence update: {resolution_notes}"
            if new_status == MaintenanceRequest.Status.RESOLVED
            else f"Your maintenance request {maintenance_request.reference_number} is now {maintenance_request.get_status_display().lower()}."
        )
        create_notification(
            recipient=maintenance_request.student,
            actor=request.user,
            notification_type="MAINTENANCE_RESOLVED" if new_status == MaintenanceRequest.Status.RESOLVED else "MAINTENANCE_UPDATED",
            title=title,
            message=message,
            application=maintenance_request.booking.application,
            maintenance_request=maintenance_request,
            extra_data={"previous_status": previous_status, "new_status": new_status},
        )
        record_audit_event(
            actor=request.user,
            action="LANDLORD_MAINTENANCE_UPDATED",
            entity_type="maintenance_request",
            entity_id=maintenance_request.id,
            summary=f"Landlord updated maintenance request {maintenance_request.reference_number}",
            metadata={"from_status": previous_status, "to_status": new_status, "status": new_status},
            request=request,
        )
        return Response({"success": True, "maintenance_request": MaintenanceRequestSerializer(maintenance_request, context={"request": request}).data})
