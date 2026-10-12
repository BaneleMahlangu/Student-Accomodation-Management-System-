import os

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from analytics.services import record_audit_event
from notifications.services import notify_active_landlords

from .models import PlatformAnnouncement, PlatformConfiguration
from .serializers import PlatformAnnouncementSerializer, PlatformConfigurationSerializer
from accommodations.models import Campus, Property


def _admin_only(request):
    if request.user.role != User.Role.ADMINISTRATOR and not request.user.is_superuser:
        return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)
    return None


class CurrentAnnouncementsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        audience = request.user.role if request.user.role in PlatformAnnouncement.Audience.values else PlatformAnnouncement.Audience.ALL
        announcements = PlatformAnnouncement.objects.filter(
            is_active=True,
            starts_at__lte=now,
        ).filter(
            Q(ends_at__isnull=True) | Q(ends_at__gte=now),
            audience__in=[PlatformAnnouncement.Audience.ALL, audience],
        )
        return Response({"success": True, "announcements": PlatformAnnouncementSerializer(announcements, many=True).data})


class AdminPlatformReadinessView(APIView):
    """Report safe readiness facts without disclosing configured secrets."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        error = _admin_only(request)
        if error:
            return error

        approved_real = Property.objects.filter(status=Property.PropertyStatus.APPROVED, is_demo=False).count()
        campuses_with_coordinates = Campus.objects.filter(latitude__isnull=False, longitude__isnull=False).count()
        email_live = settings.EMAIL_BACKEND.endswith("smtp.EmailBackend") and bool(settings.EMAIL_HOST and settings.EMAIL_HOST_USER and settings.EMAIL_HOST_PASSWORD)
        if email_live:
            email_detail = "SMTP is configured for outgoing account and workflow email."
        elif settings.EMAIL_HOST == "smtp.gmail.com" and settings.EMAIL_HOST_USER.lower() == "studenthaven02@gmail.com":
            email_detail = "Set EMAIL_HOST_PASSWORD to a Google app password for studenthaven02@gmail.com. Verification codes cannot be delivered until SMTP credentials are configured."
        else:
            email_detail = "Configure a verified sender and SMTP credentials; console email only prints to the local server."
        payfast_ready = bool(settings.PAYFAST_MERCHANT_ID and settings.PAYFAST_MERCHANT_KEY and settings.PAYFAST_PASSPHRASE and settings.PAYFAST_NOTIFY_URL.startswith("https://"))
        private_storage_persistent = bool(os.environ.get("PRIVATE_DOCUMENT_ROOT") and os.environ.get("PRIVATE_PROFILE_ROOT"))
        database_is_mysql = settings.DATABASES["default"]["ENGINE"].endswith("mysql")
        checks = [
            {"id": "real_inventory", "label": "Verified real accommodation supply", "status": "READY" if approved_real else "ACTION_REQUIRED", "detail": f"{approved_real} approved properties are available." if approved_real else "No verified accommodation supply is available. Add and approve landlord listings before opening student discovery."},
            {"id": "campus_coordinates", "label": "Campus and map data", "status": "READY" if campuses_with_coordinates else "ACTION_REQUIRED", "detail": f"{campuses_with_coordinates} campuses have map coordinates." if campuses_with_coordinates else "Add and verify campus latitude and longitude. Property pins are managed separately."},
            {"id": "payfast", "label": "PayFast checkout", "status": "READY" if payfast_ready else "ACTION_REQUIRED", "detail": f"{settings.PAYFAST_MODE.title()} checkout has merchant credentials and an HTTPS notification URL." if payfast_ready else "Configure PayFast merchant credentials and a publicly reachable HTTPS notification URL in the backend environment."},
            {"id": "email", "label": "Email delivery", "status": "READY" if email_live else "ACTION_REQUIRED", "detail": email_detail},
            {"id": "database", "label": "Production database", "status": "READY" if database_is_mysql and not settings.DEBUG else "ACTION_REQUIRED", "detail": "MySQL is selected with debug disabled." if database_is_mysql and not settings.DEBUG else "Production launch requires MySQL and debug disabled; SQLite is for local development."},
            {"id": "https", "label": "Production HTTPS and debug mode", "status": "READY" if not settings.DEBUG and settings.SECURE_SSL_REDIRECT and settings.FRONTEND_BASE_URL.startswith("https://") else "ACTION_REQUIRED", "detail": "Debug is off and HTTPS frontend/redirect settings are enabled." if not settings.DEBUG and settings.SECURE_SSL_REDIRECT and settings.FRONTEND_BASE_URL.startswith("https://") else "Set production HTTPS frontend and secure redirect settings, then disable debug before launch."},
            {"id": "private_storage", "label": "Persistent private document and profile storage", "status": "READY" if private_storage_persistent else "ACTION_REQUIRED", "detail": "Both private storage roots are explicitly configured." if private_storage_persistent else "Configure persistent PRIVATE_DOCUMENT_ROOT and PRIVATE_PROFILE_ROOT outside public media storage, with backups."},
            {"id": "ai", "label": "External AI service", "status": "OPTIONAL", "detail": "Accommodation matching and the help guide use local rules; no external AI provider is configured."},
            {"id": "document_ocr", "label": "OCR and identity checks", "status": "OPTIONAL", "detail": "Documents receive technical checks and landlord review; OCR and external identity verification are not configured."},
            {"id": "legal_signature", "label": "Certified e-signature provider", "status": "ACTION_REQUIRED", "detail": "The current typed-name signature is application evidence only. Confirm institutional legal requirements and configure an approved signing provider if required."},
        ]
        action_count = sum(item["status"] == "ACTION_REQUIRED" for item in checks)
        return Response({"success": True, "checks": checks, "action_required": action_count, "launch_ready": action_count == 0})


class ApplicationAvailabilityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.STUDENT:
            return Response({"success": False, "message": "Student access is required."}, status=status.HTTP_403_FORBIDDEN)
        configuration = PlatformConfiguration.current()
        if configuration is None:
            return Response({"success": True, "is_open": True, "period_name": "Current accommodation intake", "opens_at": None, "closes_at": None, "message": ""})
        is_open = configuration.applications_currently_open()
        now = timezone.now()
        if configuration.application_opens_at and now < configuration.application_opens_at:
            message = f"Applications for {configuration.application_period_name} open on {timezone.localtime(configuration.application_opens_at).strftime('%d %B %Y at %H:%M')}."
        elif configuration.application_closes_at and now > configuration.application_closes_at:
            message = f"The application period for {configuration.application_period_name} has closed. {configuration.closed_message}"
        elif not configuration.applications_open:
            message = configuration.closed_message
        else:
            message = f"Applications are open for {configuration.application_period_name}."
        return Response({
            "success": True,
            "is_open": is_open,
            "period_name": configuration.application_period_name,
            "opens_at": configuration.application_opens_at,
            "closes_at": configuration.application_closes_at,
            "message": message,
        })


class AdminPlatformConfigurationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        error = _admin_only(request)
        if error:
            return error
        configuration, _ = PlatformConfiguration.objects.get_or_create(pk=1)
        return Response({"success": True, "configuration": PlatformConfigurationSerializer(configuration).data})

    def patch(self, request):
        error = _admin_only(request)
        if error:
            return error
        configuration, _ = PlatformConfiguration.objects.get_or_create(pk=1)
        serializer = PlatformConfigurationSerializer(configuration, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        changed_fields = [
            field for field, value in serializer.validated_data.items()
            if getattr(configuration, field) != value
        ]
        configuration = serializer.save(updated_by=request.user)
        notify_count = 0
        if changed_fields:
            notify_count = notify_active_landlords(
                actor=request.user,
                title="Platform settings updated",
                message=f"An administrator updated the platform settings for {configuration.application_period_name}.",
                extra_data={"source": "platform_configuration", "changed_fields": changed_fields},
            )
        record_audit_event(
            actor=request.user,
            action="PLATFORM_SETTINGS_UPDATED",
            entity_type="platform_configuration",
            entity_id=configuration.id,
            summary=f"Updated settings for {configuration.application_period_name}",
            metadata={"applications_open": configuration.applications_open},
            request=request,
        )
        return Response({
            "success": True,
            "configuration": PlatformConfigurationSerializer(configuration).data,
            "landlords_notified": notify_count,
        })


class AdminAnnouncementsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        error = _admin_only(request)
        if error:
            return error
        announcements = PlatformAnnouncement.objects.select_related("created_by").all()
        return Response({"success": True, "announcements": PlatformAnnouncementSerializer(announcements, many=True).data})

    def post(self, request):
        error = _admin_only(request)
        if error:
            return error
        serializer = PlatformAnnouncementSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        announcement = serializer.save(created_by=request.user)
        landlords_notified = 0
        if announcement.is_active and announcement.audience in {
            PlatformAnnouncement.Audience.ALL,
            PlatformAnnouncement.Audience.LANDLORD,
        }:
            notification_message = announcement.body
            if announcement.starts_at > timezone.now():
                scheduled_for = timezone.localtime(announcement.starts_at).strftime("%d %B %Y at %H:%M")
                notification_message = f"This update is scheduled to appear from {scheduled_for}.\n\n{notification_message}"
            landlords_notified = notify_active_landlords(
                actor=request.user,
                title=announcement.title,
                message=notification_message,
                extra_data={"source": "platform_announcement", "announcement_id": announcement.id},
            )
        record_audit_event(
            actor=request.user,
            action="PLATFORM_ANNOUNCEMENT_CREATED",
            entity_type="platform_announcement",
            entity_id=announcement.id,
            summary=f"Created platform announcement: {announcement.title}",
            metadata={"is_active": announcement.is_active},
            request=request,
        )
        return Response({"success": True, "announcement": PlatformAnnouncementSerializer(announcement).data, "landlords_notified": landlords_notified}, status=status.HTTP_201_CREATED)


class AdminAnnouncementDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, announcement_id):
        error = _admin_only(request)
        if error:
            return error
        announcement = get_object_or_404(PlatformAnnouncement, id=announcement_id)
        previous_audience = announcement.audience
        previous_is_active = announcement.is_active
        serializer = PlatformAnnouncementSerializer(announcement, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        announcement = serializer.save()
        landlords_notified = 0
        if announcement.is_active and announcement.audience in {
            PlatformAnnouncement.Audience.ALL,
            PlatformAnnouncement.Audience.LANDLORD,
        }:
            notification_message = announcement.body
            if announcement.starts_at > timezone.now():
                scheduled_for = timezone.localtime(announcement.starts_at).strftime("%d %B %Y at %H:%M")
                notification_message = f"This update is scheduled to appear from {scheduled_for}.\n\n{notification_message}"
            landlords_notified = notify_active_landlords(
                actor=request.user,
                title=announcement.title,
                message=notification_message,
                extra_data={"source": "platform_announcement", "announcement_id": announcement.id},
            )
        elif previous_is_active and previous_audience in {
            PlatformAnnouncement.Audience.ALL,
            PlatformAnnouncement.Audience.LANDLORD,
        } and announcement.audience not in {
            PlatformAnnouncement.Audience.ALL,
            PlatformAnnouncement.Audience.LANDLORD,
        }:
            landlords_notified = notify_active_landlords(
                actor=request.user,
                title="Platform update audience changed",
                message=f'An administrator changed the audience for "{announcement.title}". This update is no longer shared with landlords.',
                extra_data={"source": "platform_announcement", "announcement_id": announcement.id},
            )
        elif previous_is_active and not announcement.is_active and announcement.audience in {
            PlatformAnnouncement.Audience.ALL,
            PlatformAnnouncement.Audience.LANDLORD,
        }:
            landlords_notified = notify_active_landlords(
                actor=request.user,
                title="Platform update paused",
                message=f'An administrator paused the platform update "{announcement.title}".',
                extra_data={"source": "platform_announcement", "announcement_id": announcement.id},
            )
        record_audit_event(
            actor=request.user,
            action="PLATFORM_ANNOUNCEMENT_UPDATED",
            entity_type="platform_announcement",
            entity_id=announcement.id,
            summary=f"Updated platform announcement: {announcement.title}",
            metadata={"is_active": announcement.is_active},
            request=request,
        )
        return Response({"success": True, "announcement": PlatformAnnouncementSerializer(announcement).data, "landlords_notified": landlords_notified})
