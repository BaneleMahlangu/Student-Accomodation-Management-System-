from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.identity import south_african_id_birth_date
from accommodations.availability import sync_room_status
from accommodations.models import Bed, Property, Room
from bookings.models import Booking
from contracts.models import Contract
from funding.models import FundingPayment

from .models import (
    Application,
    ApplicationStatusHistory,
)
from .serializers import ApplicationSerializer, LandlordApplicationSerializer
from notifications.services import create_notification
from waitinglist.models import WaitingListEntry
from waitinglist.services import offer_waitlist_for_bed
from analytics.services import record_audit_event
from risk.services import refresh_student_signals
from core.models import PlatformConfiguration


def update_application_status(
    application,
    new_status,
    changed_by=None,
    note="",
):
    old_status = application.status

    if old_status == new_status:
        return

    application.status = new_status
    application.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    ApplicationStatusHistory.objects.create(
        application=application,
        from_status=old_status,
        to_status=new_status,
        note=note,
        changed_by=changed_by,
    )

    landlord = application.property.landlord
    if landlord.is_active and (changed_by is None or changed_by.id != landlord.id):
        create_notification(
            recipient=landlord,
            actor=changed_by,
            notification_type="APPLICATION_UPDATED",
            title="Application status updated",
            message=(
                f"Application {application.application_number} for "
                f"{application.property.name} is now {application.get_status_display()}."
            ),
            application=application,
            extra_data={
                "previous_status": old_status,
                "new_status": new_status,
                "application_id": application.id,
            },
        )


class ApplicationCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):

        if request.user.role != "STUDENT":
            return Response(
                {
                    "success": False,
                    "message": (
                        "Only students can create "
                        "accommodation applications."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        property_id = request.data.get("property")
        room_id = request.data.get("room")

        if not property_id or not room_id:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Property and room are required."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        property_obj = get_object_or_404(
            Property,
            id=property_id,
            status=Property.PropertyStatus.APPROVED,
        )

        room = get_object_or_404(
            Room.objects.select_for_update(),
            id=room_id,
            floor__building__property=property_obj,
        )
        sync_room_status(room)

        if room.status != Room.RoomStatus.AVAILABLE:
            return Response(
                {
                    "success": False,
                    "message": (
                        "This room is no longer available."
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        if not room.beds.filter(
            status="AVAILABLE"
        ).exists():
            return Response(
                {
                    "success": False,
                    "message": (
                        "No beds are currently available "
                        "in this room."
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        existing = Application.objects.filter(
            student=request.user,
            property=property_obj,
            room=room,
            status__in=[
                Application.Status.DRAFT,
                Application.Status.SUBMITTED,
                Application.Status.UNDER_REVIEW,
                Application.Status.ADDITIONAL_INFO,
                Application.Status.APPROVED,
                Application.Status.WAITING_LIST,
            ],
        ).first()

        if existing:
            serializer = ApplicationSerializer(
                existing
            )

            return Response(
                {
                    "success": True,
                    "existing": True,
                    "application": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        application = Application.objects.create(
            student=request.user,
            property=property_obj,
            room=room,
            status=Application.Status.DRAFT,
            current_step=1,
        )

        ApplicationStatusHistory.objects.create(
            application=application,
            from_status="",
            to_status=Application.Status.DRAFT,
            note="Application created.",
            changed_by=request.user,
        )


        serializer = ApplicationSerializer(
            application
        )

        return Response(
            {
                "success": True,
                "existing": False,
                "application": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


class MyApplicationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        applications = (
            Application.objects
            .filter(student=request.user)
            .select_related(
                "property",
                "room",
            )
            .prefetch_related(
                "status_history"
            )
        )

        serializer = ApplicationSerializer(
            applications,
            many=True,
        )

        return Response(
            {
                "success": True,
                "applications": serializer.data,
            }
        )


class ApplicationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, application_id):
        application = get_object_or_404(
            Application,
            id=application_id
        )

        if application.student_id != request.user.id:
            return Response(
                {
                    "success": False,
                    "message": "Access denied.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ApplicationSerializer(application)

        return Response(
            {
                "success": True,
                "application": serializer.data,
            }
        )

    def patch(self, request, application_id):
        application = get_object_or_404(
            Application,
            id=application_id
        )

        if application.student_id != request.user.id:
            return Response(
                {
                    "success": False,
                    "message": "Access denied.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if application.status != Application.Status.DRAFT:
            return Response(
                {
                    "success": False,
                    "message": "Only draft applications can be edited.",
                },
                status=status.HTTP_409_CONFLICT,
            )

        allowed_fields = [
            "date_of_birth",
            "emergency_contact_name",
            "emergency_contact_phone",

            "academic_year",
            "university",
            "campus",
            "course",
            "year_of_study",

            "expected_sign_in_date",
            "expected_sign_out_date",

            "accessibility_required",
            "accessibility_notes",
            "meal_preference",

            "student_notes",

            "funding_method",
            "funding_notes",

            "current_step",
        ]

        for field in allowed_fields:
            if field not in request.data:
                continue

            value = request.data[field]

            # Empty values should become NULL for numeric/date fields
            if value == "":
                if field in [
                    "academic_year",
                    "year_of_study",
                    "date_of_birth",
                    "expected_sign_in_date",
                    "expected_sign_out_date",
                ]:
                    value = None

            setattr(application, field, value)

        application.save()

        serializer = ApplicationSerializer(application)

        return Response(
            {
                "success": True,
                "application": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class ApplicationSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, application_id):

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

        platform_configuration = PlatformConfiguration.current()
        if platform_configuration and not platform_configuration.applications_currently_open():
            if platform_configuration.application_opens_at and timezone.now() < platform_configuration.application_opens_at:
                message = f"Applications for {platform_configuration.application_period_name} open at {timezone.localtime(platform_configuration.application_opens_at).strftime('%d %B %Y at %H:%M')}. Your draft has been saved."
            else:
                message = platform_configuration.closed_message
            return Response({"success": False, "message": message}, status=status.HTTP_409_CONFLICT)

        if application.status != Application.Status.DRAFT:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Only draft applications "
                        "can be submitted."
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        student_profile = getattr(request.user, "student_profile", None)
        national_id = getattr(student_profile, "national_id", None)
        id_birth_date = south_african_id_birth_date(national_id)
        if (
            id_birth_date is None
            or id_birth_date != application.date_of_birth
            or id_birth_date != getattr(student_profile, "date_of_birth", None)
        ):
            return Response(
                {
                    "success": False,
                    "message": "Enter a valid South African ID number and matching date of birth before submitting.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        room = get_object_or_404(Room.objects.select_for_update(), id=application.room_id)
        sync_room_status(room)
        if (
            room.status != Room.RoomStatus.AVAILABLE
            or not room.beds.filter(status=Bed.BedStatus.AVAILABLE).exists()
        ):
            return Response(
                {
                    "success": False,
                    "message": "This room no longer has an available bed. Choose another room before submitting your application.",
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Required application information
        required_fields = [
            "date_of_birth",
            "emergency_contact_name",
            "emergency_contact_phone",
            "academic_year",
            "university",
            "campus",
            "course",
            "year_of_study",
            "expected_sign_in_date",
            "expected_sign_out_date",
            "meal_preference",
            "funding_method",
        ]

        missing = []

        for field in required_fields:
            value = getattr(
                application,
                field,
            )

            if value in (
                None,
                "",
            ):
                missing.append(field)

        # Stop submission if required information is missing
        if missing:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Please complete all required "
                        "application information."
                    ),
                    "missing_fields": missing,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        from documents.models import Document

        missing_documents = []
        for document_type, label in (
            (Document.DocumentType.PROOF_OF_REGISTRATION, "proof of registration"),
            (Document.DocumentType.STUDENT_ID, "student ID"),
        ):
            latest_document = (
                Document.objects.filter(
                    application=application,
                    student=request.user,
                    document_type=document_type,
                )
                .order_by("-uploaded_at", "-id")
                .first()
            )
            if latest_document is None or latest_document.status == Document.Status.REJECTED:
                missing_documents.append(label)

        if missing_documents:
            return Response(
                {
                    "success": False,
                    "message": "Upload your " + " and ".join(missing_documents) + " before submitting your application.",
                    "missing_documents": missing_documents,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Make sure the sign-out date is after sign-in
        if (
            application.expected_sign_in_date
            and application.expected_sign_out_date
            and application.expected_sign_out_date
            <= application.expected_sign_in_date
        ):
            return Response(
                {
                    "success": False,
                    "message": (
                        "The sign-out date must be after "
                        "the sign-in date."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Submit the application
        old_status = application.status

        application.status = (
            Application.Status.SUBMITTED
        )

        application.current_step = 6

        application.submitted_at = timezone.now()

        application.save(
            update_fields=[
                "status",
                "current_step",
                "submitted_at",
                "updated_at",
            ]
        )

        # Record status history
        ApplicationStatusHistory.objects.create(
            application=application,
            from_status=old_status,
            to_status=Application.Status.SUBMITTED,
            note="Application submitted by student.",
            changed_by=request.user,
        )

        refresh_student_signals(request.user)
        
        create_notification(
            recipient=application.student,
            actor=request.user,
            notification_type="APPLICATION_SUBMITTED",
            title="Application submitted",
            message=(
                f"Your accommodation application "
                f"{application.application_number} has been "
                f"submitted successfully and is now awaiting review."
            ),
            application=application,
            extra_data={
                "previous_status": old_status,
                "new_status": Application.Status.SUBMITTED,
            },
        )

        create_notification(
            recipient=application.property.landlord,
            actor=request.user,
            notification_type="APPLICATION_RECEIVED",
            title="New application for your property",
            message=(
                f"{application.student.get_full_name() or application.student.email} "
                f"submitted application {application.application_number} "
                f"for {application.property.name}."
            ),
            application=application,
            extra_data={"application_id": application.id},
        )

        administrators = User.objects.filter(
            role__in=[User.Role.ADMINISTRATOR, "ADMIN"],
            is_active=True,
        )
        for administrator in administrators:
            create_notification(
                recipient=administrator,
                actor=request.user,
                notification_type="APPLICATION_RECEIVED",
                title="Application ready for review",
                message=(
                    f"Application {application.application_number} for "
                    f"{application.property.name} was submitted and is awaiting review."
                ),
                application=application,
                extra_data={"application_id": application.id},
            )

        serializer = ApplicationSerializer(
            application
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Application submitted "
                    "successfully."
                ),
                "application": serializer.data,
            },
            status=status.HTTP_200_OK,
        )
        
class ApplicationStartReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def check_landlord(self, request):
        if request.user.role != "LANDLORD":
            return Response(
                {
                    "success": False,
                    "message": "Landlord access required.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return None

    @transaction.atomic
    def post(self, request, application_id):
        landlord_error = self.check_landlord(request)

        if landlord_error:
            return landlord_error

        application = get_object_or_404(
            Application.objects.select_for_update(),
            id=application_id,
            property__landlord=request.user,
        )

        if application.status not in {
            Application.Status.SUBMITTED,
            Application.Status.ADDITIONAL_INFO,
        }:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Only submitted applications or applications awaiting additional information can be moved into review."
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        old_status = application.status
        resumed_from_information_request = old_status == Application.Status.ADDITIONAL_INFO
        review_note = (
            "Landlord resumed review after the information request."
            if resumed_from_information_request
            else "Application is now under landlord review."
        )

        update_application_status(
            application=application,
            new_status=Application.Status.UNDER_REVIEW,
            changed_by=request.user,
            note=review_note,
        )

        create_notification(
            recipient=application.student,
            actor=request.user,
            notification_type="APPLICATION_UNDER_REVIEW",
            title="Application review resumed" if resumed_from_information_request else "Application under review",
            message=(
                f"Your accommodation application {application.application_number} is now under landlord review."
            ),
            application=application,
            extra_data={
                "previous_status": old_status,
                "new_status": Application.Status.UNDER_REVIEW,
            },
        )

        record_audit_event(
            actor=request.user,
            action="APPLICATION_REVIEW_RESUMED" if resumed_from_information_request else "APPLICATION_REVIEW_STARTED",
            entity_type="application",
            entity_id=application.id,
            summary=f"{'Resumed' if resumed_from_information_request else 'Started'} review of {application.application_number}",
            metadata={"from_status": old_status, "to_status": Application.Status.UNDER_REVIEW},
            request=request,
        )

        serializer = ApplicationSerializer(application)

        return Response(
            {
                "success": True,
                "message": (
                    "Application moved to "
                    "under review."
                ),
                "application": serializer.data,
            },
            status=status.HTTP_200_OK,
        )
        
class ApplicationReopenReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, application_id):
        if request.user.role != "LANDLORD":
            return Response(
                {"success": False, "message": "Landlord access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        note = str(request.data.get("note", "")).strip()

        with transaction.atomic():
            application = get_object_or_404(
                Application.objects.select_for_update().select_related("student", "property__landlord"),
                id=application_id,
                property__landlord=request.user,
            )
            final_statuses = {
                Application.Status.APPROVED,
                Application.Status.DECLINED,
                Application.Status.WAITING_LIST,
                Application.Status.WAITLISTED,
            }
            if application.status not in final_statuses:
                return Response(
                    {"success": False, "message": "Only an application with a recorded decision can be reopened."},
                    status=status.HTTP_409_CONFLICT,
                )

            contract = Contract.objects.select_for_update().filter(application=application).first()
            has_booking = Booking.objects.filter(application=application).exists()
            has_funding_record = FundingPayment.objects.filter(application=application).exists()
            if contract and (
                contract.status == Contract.Status.SIGNED
                or contract.signed_at
                or contract.signature_name
                or has_booking
                or has_funding_record
            ):
                return Response(
                    {
                        "success": False,
                        "message": "This decision cannot be reopened because contract signing, booking, or payment processing has already started.",
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            if has_booking or has_funding_record:
                return Response(
                    {
                        "success": False,
                        "message": "This decision cannot be reopened because booking or payment records already exist.",
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            old_status = application.status
            review_note = note or "Landlord reopened the application for a fresh review."
            if contract and contract.status != Contract.Status.CANCELLED:
                contract.status = Contract.Status.CANCELLED
                contract.save(update_fields=["status", "updated_at"])

            waiting_entry = WaitingListEntry.objects.select_for_update().filter(
                application=application,
                status__in=[WaitingListEntry.Status.WAITING, WaitingListEntry.Status.OFFERED],
            ).select_related("offered_bed").first()
            offered_bed = waiting_entry.offered_bed if waiting_entry and waiting_entry.status == WaitingListEntry.Status.OFFERED else None
            if waiting_entry:
                waiting_entry.status = WaitingListEntry.Status.CANCELLED
                waiting_entry.save(update_fields=["status", "updated_at"])
                if offered_bed and offered_bed.status == Bed.BedStatus.AVAILABLE:
                    transaction.on_commit(lambda bed=offered_bed: offer_waitlist_for_bed(bed))

            update_application_status(
                application=application,
                new_status=Application.Status.UNDER_REVIEW,
                changed_by=request.user,
                note=review_note,
            )
            application.reviewed_at = None
            application.decline_reason = ""
            update_fields = ["reviewed_at", "decline_reason", "updated_at"]
            if note:
                application.admin_notes = note
                update_fields.append("admin_notes")
            application.save(update_fields=update_fields)

            create_notification(
                recipient=application.student,
                actor=request.user,
                notification_type="APPLICATION_UNDER_REVIEW",
                title="Application review reopened",
                message=f"Your application {application.application_number} is being reviewed again.",
                application=application,
                extra_data={"previous_status": old_status, "new_status": Application.Status.UNDER_REVIEW},
            )
            record_audit_event(
                actor=request.user,
                action="APPLICATION_REOPENED_FOR_REVIEW",
                entity_type="application",
                entity_id=application.id,
                summary=f"Reopened {application.application_number} for review",
                metadata={"from_status": old_status, "to_status": Application.Status.UNDER_REVIEW},
                request=request,
            )

        return Response(
            {
                "success": True,
                "message": "Application returned to review. The previous decision remains in its activity history.",
                "application": ApplicationSerializer(application).data,
            },
            status=status.HTTP_200_OK,
        )

class ApplicationDecisionView(APIView):
    permission_classes = [IsAuthenticated]

    def check_landlord(self, request):
        if request.user.role != "LANDLORD":
            return Response(
                {
                    "success": False,
                    "message": "Landlord access required.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return None

    @transaction.atomic
    def post(self, request, application_id):
        landlord_error = self.check_landlord(request)

        if landlord_error:
            return landlord_error

        application = get_object_or_404(
            Application.objects.select_for_update().select_related("student", "property__landlord", "room"),
            id=application_id,
            property__landlord=request.user,
        )

        decision = str(
            request.data.get("decision", "")
        ).upper()

        note = str(
            request.data.get("note", "")
        ).strip()

        decline_reason = str(
            request.data.get("decline_reason", "")
        ).strip()

        if application.status != Application.Status.UNDER_REVIEW:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Only applications currently "
                        "under review can receive a decision."
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        if decision not in [
            "APPROVED",
            "DECLINED",
            "WAITING_LIST",
            "ADDITIONAL_INFO",
        ]:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Choose approval, decline, waiting list, or request additional information."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (
            decision == "DECLINED"
            and not decline_reason
        ):
            return Response(
                {
                    "success": False,
                    "message": (
                        "A decline reason is required."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_contract = None
        if decision == "APPROVED":
            existing_contract = Contract.objects.select_for_update().filter(application=application).first()
            if existing_contract and (
                existing_contract.status == Contract.Status.SIGNED
                or existing_contract.signed_at
                or existing_contract.signature_name
                or Booking.objects.filter(application=application).exists()
                or FundingPayment.objects.filter(application=application).exists()
            ):
                return Response(
                    {"success": False, "message": "This application already has a signed contract, booking, or payment record."},
                    status=status.HTTP_409_CONFLICT,
                )

        old_status = application.status

        if decision == "ADDITIONAL_INFO":
            if not note:
                return Response(
                    {"success": False, "message": "Explain what additional information the student needs to provide."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            update_application_status(
                application=application,
                new_status=Application.Status.ADDITIONAL_INFO,
                changed_by=request.user,
                note=note,
            )
            application.reviewed_at = None
            application.decline_reason = ""
            application.admin_notes = note
            application.save(update_fields=["reviewed_at", "decline_reason", "admin_notes", "updated_at"])
            create_notification(
                recipient=application.student,
                actor=request.user,
                notification_type="ADDITIONAL_INFORMATION",
                title="Additional information requested",
                message=f"Please update application {application.application_number}: {note}",
                application=application,
                extra_data={"previous_status": old_status, "new_status": Application.Status.ADDITIONAL_INFO},
            )
            record_audit_event(
                actor=request.user,
                action="APPLICATION_ADDITIONAL_INFO_REQUESTED",
                entity_type="application",
                entity_id=application.id,
                summary=f"Requested more information for {application.application_number}",
                metadata={"from_status": old_status, "to_status": Application.Status.ADDITIONAL_INFO},
                request=request,
            )
            return self._success_response(application, "Additional information requested from the student.")

        if decision == "WAITING_LIST":
            update_application_status(
                application=application,
                new_status=Application.Status.WAITING_LIST,
                changed_by=request.user,
                note=note or "Application placed on the accommodation waiting list.",
            )
            application.reviewed_at = timezone.now()
            if note:
                application.admin_notes = note
                application.save(update_fields=["reviewed_at", "admin_notes", "updated_at"])
            else:
                application.save(update_fields=["reviewed_at", "updated_at"])

            entry = WaitingListEntry.objects.filter(application=application).first()
            if entry:
                entry.status = WaitingListEntry.Status.WAITING
                entry.offered_bed = None
                entry.offered_at = None
                entry.respond_by = None
                entry.priority_score = 100
                entry.save(update_fields=["status", "offered_bed", "offered_at", "respond_by", "priority_score", "updated_at"])
            else:
                entry = WaitingListEntry.objects.create(
                    student=application.student,
                    property=application.property,
                    room_type=application.room.room_type,
                    application=application,
                    accessibility_required=application.accessibility_required,
                )

            create_notification(
                recipient=application.student,
                actor=request.user,
                notification_type="WAITING_LIST",
                title="Application added to waiting list",
                message=f"Your application for {application.property.name} is now on the waiting list. We will notify you when a matching room becomes available.",
                application=application,
                extra_data={"waiting_list_entry": entry.id, "previous_status": old_status},
            )
            available_beds = application.property.buildings.values_list("floors__rooms__beds__id", flat=True)
            for bed in Bed.objects.filter(id__in=available_beds, status=Bed.BedStatus.AVAILABLE).select_related("room__room_type", "room__floor__building__property"):
                offer_waitlist_for_bed(bed)
            record_audit_event(
                actor=request.user,
                action="APPLICATION_WAITLISTED",
                entity_type="application",
                entity_id=application.id,
                summary=f"Placed {application.application_number} on the waiting list",
                metadata={"from_status": old_status, "to_status": Application.Status.WAITING_LIST},
                request=request,
            )
            return self._success_response(application, "Application added to the waiting list.")

        # =================================================
        # APPROVED
        # =================================================

        if decision == "APPROVED":

            approval_note = (
                note
                or (
                    "Application approved by "
                    "the property landlord."
                )
            )

            update_application_status(
                application=application,
                new_status=Application.Status.APPROVED,
                changed_by=request.user,
                note=approval_note,
            )

            contract_number = (
                f"SH-C-{application.application_number}"
            )

            contract, created = Contract.objects.get_or_create(
                application=application,
                defaults={
                    "contract_number": contract_number,
                    "student": application.student,
                    "property_name": (
                        application.property.name
                    ),
                    "room_number": (
                        application.room.room_number
                    ),
                    "start_date": (
                        application.expected_sign_in_date
                    ),
                    "end_date": (
                        application.expected_sign_out_date
                    ),
                    "monthly_fee": (
                        application.room.monthly_price
                        if application.room
                        else 0
                    ),
                    "status": (
                        Contract.Status.PENDING_SIGNATURE
                    ),
                },
            )

            if not created and contract.status != Contract.Status.PENDING_SIGNATURE:
                contract.status = Contract.Status.PENDING_SIGNATURE
                contract.save(update_fields=["status", "updated_at"])

            application.reviewed_at = timezone.now()

            update_fields = [
                "reviewed_at",
                "updated_at",
            ]

            if note:
                application.admin_notes = note
                update_fields.append("admin_notes")

            application.save(
                update_fields=update_fields
            )

            create_notification(
                recipient=application.student,
                actor=request.user,
                notification_type=(
                    "APPLICATION_APPROVED"
                ),
                title="Application approved",
                message=(
                    f"Your accommodation application "
                    f"{application.application_number} "
                    f"has been approved."
                    + (
                        f" Landlord feedback: {note}"
                        if note
                        else ""
                    )
                ),
                application=application,
                extra_data={
                    "previous_status": old_status,
                    "new_status": (
                        Application.Status.APPROVED
                    ),
                    "landlord_feedback": note,
                },
            )

            if note:
                create_notification(
                    recipient=application.student,
                    actor=request.user,
                    notification_type="LANDLORD_FEEDBACK",
                    title="Landlord feedback",
                    message=note,
                    application=application,
                    extra_data={
                        "related_event": (
                            "APPLICATION_APPROVED"
                        ),
                        "application_number": (
                            application.application_number
                        ),
                    },
                )

            record_audit_event(
                actor=request.user,
                action="APPLICATION_APPROVED",
                entity_type="application",
                entity_id=application.id,
                summary=f"Approved {application.application_number}",
                metadata={"from_status": old_status, "to_status": Application.Status.APPROVED},
                request=request,
            )

            return self._success_response(
                application,
                "Application approved.",
            )

        # =================================================
        # DECLINED
        # =================================================

        decline_note = (
            note
            or (
                "Application declined by "
                "the property landlord."
            )
        )

        update_application_status(
            application=application,
            new_status=Application.Status.DECLINED,
            changed_by=request.user,
            note=decline_note,
        )

        application.reviewed_at = timezone.now()
        application.decline_reason = decline_reason

        update_fields = [
            "reviewed_at",
            "decline_reason",
            "updated_at",
        ]

        if note:
            application.admin_notes = note
            update_fields.append("admin_notes")

        application.save(
            update_fields=update_fields
        )

        create_notification(
            recipient=application.student,
            actor=request.user,
            notification_type="APPLICATION_REJECTED",
            title="Application declined",
            message=(
                f"Your accommodation application "
                f"{application.application_number} "
                f"has been declined. "
                f"Reason: {decline_reason}"
                + (
                    f" Landlord feedback: {note}"
                    if note
                    else ""
                )
            ),
            application=application,
            extra_data={
                "previous_status": old_status,
                "new_status": (
                    Application.Status.DECLINED
                ),
                "decline_reason": decline_reason,
                "landlord_feedback": note,
            },
        )

        if note:
            create_notification(
                recipient=application.student,
                actor=request.user,
                notification_type="LANDLORD_FEEDBACK",
                title="Landlord feedback",
                message=note,
                application=application,
                extra_data={
                    "related_event": (
                        "APPLICATION_REJECTED"
                    ),
                    "application_number": (
                        application.application_number
                    ),
                },
            )

        record_audit_event(
            actor=request.user,
            action="APPLICATION_DECLINED",
            entity_type="application",
            entity_id=application.id,
            summary=f"Declined {application.application_number}",
            metadata={"from_status": old_status, "to_status": Application.Status.DECLINED},
            request=request,
        )

        return self._success_response(
            application,
            "Application declined.",
        )

    def _success_response(
        self,
        application,
        message,
    ):
        serializer = ApplicationSerializer(
            application
        )

        return Response(
            {
                "success": True,
                "message": message,
                "application": serializer.data,
            },
            status=status.HTTP_200_OK,
        )
        
class LandlordApplicationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != "LANDLORD":
            return Response({"success": False, "message": "Landlord access required."}, status=status.HTTP_403_FORBIDDEN)
        applications = Application.objects.filter(
            property__landlord=request.user,
        ).exclude(status__in=[Application.Status.DRAFT, Application.Status.WITHDRAWN]).select_related(
            "student", "property", "room",
        )
        status_filter = request.query_params.get("status")
        if status_filter in Application.Status.values:
            applications = applications.filter(status=status_filter)
        search = request.query_params.get("q", "").strip()
        if search:
            from django.db.models import Q
            applications = applications.filter(
                Q(application_number__icontains=search)
                | Q(student__first_name__icontains=search)
                | Q(student__last_name__icontains=search)
                | Q(property__name__icontains=search)
                | Q(room__room_number__icontains=search)
                | Q(course__icontains=search)
            )
        applications = applications.order_by("-submitted_at", "-created_at")
        return Response({
            "success": True,
            "count": applications.count(),
            "applications": LandlordApplicationSerializer(applications, many=True).data,
        }, status=status.HTTP_200_OK)


class AdminApplicationsView(APIView):
    permission_classes = [IsAuthenticated]

    def check_admin(self, request):
        if request.user.role not in ["ADMIN", "ADMINISTRATOR"]:
            return Response(
                {
                    "success": False,
                    "message": "Administrator access required.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return None

    def get(self, request):
        admin_error = self.check_admin(request)

        if admin_error:
            return admin_error

        applications = (
            Application.objects
            .select_related(
                "student",
                "property",
                "room",
            )
            .order_by("-created_at")
        )

        serializer = ApplicationSerializer(
            applications,
            many=True,
        )

        return Response(
            {
                "success": True,
                "count": applications.count(),
                "applications": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class AdminApplicationReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def check_admin(self, request):
        if request.user.role not in ["ADMIN", "ADMINISTRATOR"]:
            return Response(
                {
                    "success": False,
                    "message": "Administrator access required.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return None

    def get(self, request, application_id):
        admin_error = self.check_admin(request)

        if admin_error:
            return admin_error

        application = get_object_or_404(
            Application.objects.select_related(
                "student",
                "property",
                "room",
            ),
            id=application_id,
        )

        serializer = ApplicationSerializer(application)

        return Response(
            {
                "success": True,
                "application": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class AdminApplicationEligibilityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, application_id):
        if request.user.role not in ["ADMIN", "ADMINISTRATOR"]:
            return Response(
                {"success": False, "message": "Administrator access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        application = get_object_or_404(
            Application.objects.select_related("property", "room"),
            id=application_id,
        )

        from documents.models import Document

        latest_documents = {}
        documents = Document.objects.filter(
            application=application,
            document_type__in=["PROOF_OF_REGISTRATION", "STUDENT_ID"],
        ).order_by("-uploaded_at", "-id")
        for document in documents:
            latest_documents.setdefault(document.document_type, document)

        reasons = []
        if not application.submitted_at or application.status == Application.Status.DRAFT:
            reasons.append("The student has not submitted the application.")
        if application.status == Application.Status.WITHDRAWN:
            reasons.append("The application has been withdrawn.")
        if not application.room_id:
            reasons.append("A room has not been selected.")

        required_document_labels = {
            "PROOF_OF_REGISTRATION": "Proof of Registration",
            "STUDENT_ID": "Student ID",
        }
        for document_type, label in required_document_labels.items():
            document = latest_documents.get(document_type)
            if document is None:
                reasons.append(f"{label} has not been uploaded.")
            elif document.status != Document.Status.VERIFIED:
                reasons.append(f"{label} has not been verified by the landlord.")

        return Response(
            {
                "success": True,
                "application_id": application.id,
                "application_number": application.application_number,
                "eligible": not reasons,
                "reasons": reasons,
                "required_documents_verified": sum(
                    document.status == Document.Status.VERIFIED
                    for document in latest_documents.values()
                ),
                "required_documents_total": len(required_document_labels),
            },
            status=status.HTTP_200_OK,
        )
