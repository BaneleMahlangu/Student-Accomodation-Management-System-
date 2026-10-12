from django.conf import settings
from django.contrib.auth import login, logout
from django.contrib.sessions.models import Session
from django.contrib.auth.hashers import check_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db.models.deletion import ProtectedError
from django.db import IntegrityError, transaction
from django.core.mail import send_mail
from django.core.files.base import ContentFile
from django.db.models import Q
from django.http import FileResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from io import BytesIO
from PIL import Image, ImageOps, UnidentifiedImageError

from rest_framework import status
from rest_framework.permissions import (
    AllowAny,
    IsAuthenticated,
)
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView

from .models import User

from .serializers import (
    LoginSerializer,
    StudentRegistrationSerializer,
    LandlordRegistrationSerializer,
    StudentProfileUpdateSerializer,
    LandlordProfileUpdateSerializer,
)

from .models import (
    User,
    AdministratorProfile,
    AccountCode,
    AccountSession,
    LoginEvent,
    NotificationPreference,
    StudentProfile,
)
from .services import consume_account_code, issue_account_code, issue_registration_verification
from analytics.services import record_audit_event
from notifications.services import create_notification


def _record_login_event(request, user, outcome, *, method=LoginEvent.Method.PASSWORD, reason=""):
    LoginEvent.objects.create(
        user=user,
        method=method,
        outcome=outcome,
        failure_reason=reason[:120],
        ip_address=request.META.get("REMOTE_ADDR") or None,
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:512],
    )


def _record_failed_password_attempt(user_id):
    """Apply a short account lock after repeated password failures."""
    now = timezone.now()
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user_id)
        if user.login_locked_until and user.login_locked_until > now:
            return user.login_locked_until
        if user.login_locked_until and user.login_locked_until <= now:
            user.failed_login_attempts = 0
            user.login_locked_until = None
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.login_locked_until = now + timedelta(minutes=15)
        user.save(update_fields=["failed_login_attempts", "login_locked_until"])
        return user.login_locked_until


class StudentRegistrationView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):

        serializer = StudentRegistrationSerializer(
            data=request.data
        )

        if serializer.is_valid():

            user = serializer.save()
            delivery = issue_registration_verification(user)
            email_sent = delivery == "sent"

            return Response(
                {
                    "success": True,
                    "verification_email_sent": email_sent,
                    "message": (
                        "Student account created. Check your email for a verification code before signing in."
                        if email_sent
                        else "Your account was created, but we could not send the verification email. Use Resend verification code on the next page, or try again later."
                    ),
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "role": user.role,
                    },
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {
                "success": False,
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class LandlordRegistrationView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):

        serializer = LandlordRegistrationSerializer(
            data=request.data
        )

        if serializer.is_valid():

            user = serializer.save()
            delivery = issue_registration_verification(user)
            email_sent = delivery == "sent"

            return Response(
                {
                    "success": True,
                    "verification_email_sent": email_sent,
                    "message": (
                        "Landlord account created successfully. "
                        + (
                            "Your landlord profile is awaiting review. Check your email for a verification code before signing in."
                            if email_sent
                            else "Your landlord profile is awaiting review, but we could not send the verification email. Use Resend verification code on the next page, or try again later."
                        )
                    ),
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "role": user.role,
                        "verification_status": (
                            user.landlord_profile
                            .verification_status
                        ),
                    },
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {
                "success": False,
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class CSRFView(APIView):

    permission_classes = [AllowAny]

    def get(self, request):

        get_token(request)

        return Response(
            {
                "success": True,
                "message": "CSRF cookie set.",
            }
        )


class LoginView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):

        attempted_email = str(request.data.get("email", "")).strip().lower()
        account = User.objects.filter(email__iexact=attempted_email).first() if attempted_email else None
        now = timezone.now()
        if account and account.login_locked_until and account.login_locked_until > now:
            _record_login_event(request, account, LoginEvent.Outcome.FAILED, reason="Account temporarily locked after repeated password failures")
            return Response({
                "success": False,
                "message": "Sign-in is temporarily locked after repeated incorrect attempts. Try again after the lock expires.",
            }, status=status.HTTP_423_LOCKED)

        serializer = LoginSerializer(
            data=request.data
        )

        if serializer.is_valid():

            user = serializer.validated_data[
                "user"
            ]

            if user.failed_login_attempts or user.login_locked_until:
                user.failed_login_attempts = 0
                user.login_locked_until = None
                user.save(update_fields=["failed_login_attempts", "login_locked_until"])

            if user.two_factor_enabled:
                two_factor_code = str(request.data.get("two_factor_code", "")).strip()
                if not two_factor_code:
                    delivery = issue_account_code(user, AccountCode.Purpose.LOGIN_TWO_FACTOR)
                    _record_login_event(
                        request,
                        user,
                        LoginEvent.Outcome.CHALLENGE_REQUIRED if delivery != "failed" else LoginEvent.Outcome.FAILED,
                        method=LoginEvent.Method.EMAIL_CODE,
                        reason="" if delivery != "failed" else "Security code delivery failed",
                    )
                    if delivery == "failed":
                        return Response({"success": False, "message": "We could not send a sign-in code. Try again shortly.", "requires_two_factor": True}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
                    message = "A sign-in code has been sent to your account email." if delivery == "sent" else "A recent sign-in code is still active. Check your email before requesting another."
                    return Response({"success": True, "requires_two_factor": True, "message": message})

                code_result = consume_account_code(user, AccountCode.Purpose.LOGIN_TWO_FACTOR, two_factor_code)
                if code_result != "valid":
                    _record_login_event(
                        request,
                        user,
                        LoginEvent.Outcome.CHALLENGE_FAILED,
                        method=LoginEvent.Method.EMAIL_CODE,
                        reason="Invalid or expired security code",
                    )
                    messages = {
                        "missing": "Request a new sign-in code and try again.",
                        "expired": "That sign-in code has expired. Request a new one.",
                        "locked": "Too many incorrect code attempts. Request a new sign-in code.",
                        "invalid": "That sign-in code is incorrect.",
                    }
                    return Response({"success": False, "message": messages.get(code_result, "Unable to verify the sign-in code."), "requires_two_factor": True}, status=status.HTTP_400_BAD_REQUEST)

            login(
                request,
                user,
            )
            _record_login_event(
                request,
                user,
                LoginEvent.Outcome.SUCCESSFUL,
                method=LoginEvent.Method.EMAIL_CODE if user.two_factor_enabled else LoginEvent.Method.PASSWORD,
            )
            if request.session.session_key:
                AccountSession.objects.update_or_create(
                    session_key=request.session.session_key,
                    defaults={
                        "user": user,
                        "user_agent": request.META.get("HTTP_USER_AGENT", "")[:512],
                        "ip_address": request.META.get("REMOTE_ADDR") or None,
                        "last_seen_at": timezone.now(),
                        "expires_at": request.session.get_expiry_date(),
                        "revoked_at": None,
                    },
                )

            response_user = {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "is_verified": user.is_verified,
            }

            if user.role == User.Role.LANDLORD:

                response_user[
                    "verification_status"
                ] = (
                    user.landlord_profile
                    .verification_status
                )

            return Response(
                {
                    "success": True,
                    "message": "Login successful.",
                    "user": response_user,
                }
            )

        matched_user = account
        if matched_user:
            locked_until = _record_failed_password_attempt(matched_user.id)
            _record_login_event(request, matched_user, LoginEvent.Outcome.FAILED, reason="Temporary account lockout applied" if locked_until else "Invalid credentials or account state")
            if locked_until:
                return Response({
                    "success": False,
                    "message": "Too many incorrect sign-in attempts. Try again after the temporary lock expires.",
                }, status=status.HTTP_423_LOCKED)
        return Response(
            {
                "success": False,
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class LogoutView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        session_key = request.session.session_key
        if session_key:
            AccountSession.objects.filter(
                user=request.user,
                session_key=session_key,
                revoked_at__isnull=True,
            ).update(revoked_at=timezone.now())
        logout(request)

        return Response(
            {
                "success": True,
                "message": "Logged out successfully.",
            }
        )


class AccountSecurityHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        current_session_key = request.session.session_key
        if current_session_key:
            AccountSession.objects.get_or_create(
                session_key=current_session_key,
                defaults={
                    "user": request.user,
                    "user_agent": request.META.get("HTTP_USER_AGENT", "")[:512],
                    "ip_address": request.META.get("REMOTE_ADDR") or None,
                    "last_seen_at": now,
                    "expires_at": request.session.get_expiry_date(),
                },
            )
        sessions = AccountSession.objects.filter(
            user=request.user,
            revoked_at__isnull=True,
            expires_at__gt=now,
        ).order_by("-last_seen_at")
        active_sessions = []
        for account_session in sessions:
            django_session = Session.objects.filter(session_key=account_session.session_key).first()
            if django_session is None or str(django_session.get_decoded().get("_auth_user_id", "")) != str(request.user.id):
                account_session.revoked_at = now
                account_session.save(update_fields=["revoked_at"])
                continue
            active_sessions.append({
                "id": account_session.id,
                "user_agent": account_session.user_agent,
                "ip_address": account_session.ip_address,
                "created_at": account_session.created_at,
                "last_seen_at": account_session.last_seen_at,
                "expires_at": account_session.expires_at,
                "is_current": account_session.session_key == request.session.session_key,
            })
        events = LoginEvent.objects.filter(user=request.user).order_by("-created_at")[:30]
        return Response({
            "success": True,
            "sessions": active_sessions,
            "login_events": [{
                "id": event.id,
                "method": event.get_method_display(),
                "outcome": event.get_outcome_display(),
                "status": event.outcome,
                "failure_reason": event.failure_reason,
                "ip_address": event.ip_address,
                "user_agent": event.user_agent,
                "created_at": event.created_at,
            } for event in events],
        })


class StudentPrivacySettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.STUDENT:
            return Response({"success": False, "message": "Student account access required."}, status=status.HTTP_403_FORBIDDEN)
        profile = get_object_or_404(StudentProfile, user=request.user)
        return Response({"success": True, "settings": {"share_contact_with_landlord": profile.share_contact_with_landlord}})


class StudentProfilePhotoView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def _profile(self, request):
        if request.user.role != User.Role.STUDENT:
            return None
        return get_object_or_404(StudentProfile, user=request.user)

    def get(self, request):
        profile = self._profile(request)
        if profile is None:
            return Response({"success": False, "message": "Student account access required."}, status=status.HTTP_403_FORBIDDEN)
        photo_url = request.build_absolute_uri(reverse("student-profile-photo-file")) if profile.profile_photo else None
        return Response({"success": True, "photo_url": photo_url})

    def put(self, request):
        profile = self._profile(request)
        if profile is None:
            return Response({"success": False, "message": "Student account access required."}, status=status.HTTP_403_FORBIDDEN)
        uploaded = request.FILES.get("photo")
        if not uploaded:
            return Response({"success": False, "message": "Choose a JPG, PNG or WebP image."}, status=status.HTTP_400_BAD_REQUEST)
        if uploaded.size > 3 * 1024 * 1024:
            return Response({"success": False, "message": "Profile images must be 3 MB or smaller."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            uploaded.seek(0)
            with Image.open(uploaded) as original:
                detected = (original.format or "").upper()
                if detected not in {"JPEG", "PNG", "WEBP"}:
                    return Response({"success": False, "message": "Choose a JPG, PNG or WebP image."}, status=status.HTTP_400_BAD_REQUEST)
                if original.width * original.height > 25_000_000:
                    return Response({"success": False, "message": "Choose an image with fewer than 25 megapixels."}, status=status.HTTP_400_BAD_REQUEST)
                original.verify()
            uploaded.seek(0)
            with Image.open(uploaded) as original:
                image = ImageOps.exif_transpose(original).convert("RGB")
                image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
                output = BytesIO()
                image.save(output, format="JPEG", quality=86, optimize=True)
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError):
            return Response({"success": False, "message": "The image could not be read. Choose a valid JPG, PNG or WebP file."}, status=status.HTTP_400_BAD_REQUEST)
        if profile.profile_photo:
            profile.profile_photo.delete(save=False)
        profile.profile_photo.save("profile.jpg", ContentFile(output.getvalue()), save=False)
        profile.save(update_fields=["profile_photo", "updated_at"])
        photo_url = request.build_absolute_uri(reverse("student-profile-photo-file"))
        record_audit_event(actor=request.user, action="STUDENT_PROFILE_PHOTO_UPDATED", entity_type="student_profile", entity_id=profile.id, summary="Updated profile photo", metadata={}, request=request)
        return Response({"success": True, "photo_url": photo_url})

    def delete(self, request):
        profile = self._profile(request)
        if profile is None:
            return Response({"success": False, "message": "Student account access required."}, status=status.HTTP_403_FORBIDDEN)
        if profile.profile_photo:
            profile.profile_photo.delete(save=False)
            profile.profile_photo = ""
            profile.save(update_fields=["profile_photo", "updated_at"])
            record_audit_event(actor=request.user, action="STUDENT_PROFILE_PHOTO_REMOVED", entity_type="student_profile", entity_id=profile.id, summary="Removed profile photo", metadata={}, request=request)
        return Response({"success": True, "photo_url": None})


class StudentProfilePhotoFileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.STUDENT:
            return Response({"success": False, "message": "Student account access required."}, status=status.HTTP_403_FORBIDDEN)
        profile = get_object_or_404(StudentProfile, user=request.user)
        if not profile.profile_photo:
            return Response({"success": False, "message": "No profile photo has been uploaded."}, status=status.HTTP_404_NOT_FOUND)
        try:
            file_handle = profile.profile_photo.open("rb")
        except (FileNotFoundError, OSError, ValueError):
            return Response({"success": False, "message": "The profile photo is unavailable."}, status=status.HTTP_404_NOT_FOUND)
        response = FileResponse(file_handle, as_attachment=False, filename="profile.jpg", content_type="image/jpeg")
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response

    def patch(self, request):
        if request.user.role != User.Role.STUDENT:
            return Response({"success": False, "message": "Student account access required."}, status=status.HTTP_403_FORBIDDEN)
        value = request.data.get("share_contact_with_landlord")
        if not isinstance(value, bool):
            return Response({"success": False, "message": "Choose whether to share your contact details with the landlord for your active booking."}, status=status.HTTP_400_BAD_REQUEST)
        profile = get_object_or_404(StudentProfile, user=request.user)
        previous = profile.share_contact_with_landlord
        profile.share_contact_with_landlord = value
        profile.save(update_fields=["share_contact_with_landlord", "updated_at"])
        if previous != value:
            record_audit_event(
                actor=request.user,
                action="STUDENT_PRIVACY_PREFERENCE_UPDATED",
                entity_type="student_profile",
                entity_id=profile.id,
                summary="Changed landlord access to student contact details",
                metadata={"share_contact_with_landlord": value},
                request=request,
            )
        return Response({"success": True, "settings": {"share_contact_with_landlord": profile.share_contact_with_landlord}})


class RevokeAccountSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, session_id):
        account_session = get_object_or_404(AccountSession, id=session_id, user=request.user, revoked_at__isnull=True)
        if account_session.session_key == request.session.session_key:
            return Response({"success": False, "message": "Use Sign out to end the session on this device."}, status=status.HTTP_400_BAD_REQUEST)
        Session.objects.filter(session_key=account_session.session_key).delete()
        account_session.revoked_at = timezone.now()
        account_session.save(update_fields=["revoked_at"])
        record_audit_event(
            actor=request.user,
            action="ACCOUNT_SESSION_REVOKED",
            entity_type="account_session",
            entity_id=account_session.id,
            summary="Revoked another account session",
            metadata={},
            request=request,
        )
        return Response({"success": True, "message": "The selected session has been signed out."})


class RevokeOtherAccountSessionsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        now = timezone.now()
        other_sessions = list(AccountSession.objects.filter(
            user=request.user,
            revoked_at__isnull=True,
            expires_at__gt=now,
        ).exclude(session_key=request.session.session_key))
        keys = [item.session_key for item in other_sessions]
        Session.objects.filter(session_key__in=keys).delete()
        AccountSession.objects.filter(id__in=[item.id for item in other_sessions]).update(revoked_at=now)
        record_audit_event(
            actor=request.user,
            action="ACCOUNT_OTHER_SESSIONS_REVOKED",
            entity_type="account_session",
            summary=f"Signed out {len(keys)} other device session(s)",
            metadata={},
            request=request,
        )
        return Response({"success": True, "revoked_count": len(keys), "message": f"Signed out {len(keys)} other device session(s)."})


class TwoFactorSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"success": True, "enabled": request.user.two_factor_enabled, "email_verified": request.user.is_verified})

    def post(self, request):
        if request.user.two_factor_enabled:
            return Response({"success": False, "message": "Two-factor authentication is already enabled."}, status=status.HTTP_409_CONFLICT)
        if not request.user.is_verified:
            return Response({"success": False, "message": "Verify your email address before enabling sign-in codes."}, status=status.HTTP_400_BAD_REQUEST)
        delivery = issue_account_code(request.user, AccountCode.Purpose.ENABLE_TWO_FACTOR)
        if delivery == "failed":
            return Response({"success": False, "message": "We could not send a security code. Try again shortly."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        message = "A security code has been sent to your verified email address." if delivery == "sent" else "A recent security code is still active. Check your email before requesting another."
        return Response({"success": True, "message": message})


class ConfirmTwoFactorView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.two_factor_enabled:
            return Response({"success": False, "message": "Two-factor authentication is already enabled."}, status=status.HTTP_409_CONFLICT)
        result = consume_account_code(request.user, AccountCode.Purpose.ENABLE_TWO_FACTOR, request.data.get("code", ""))
        if result != "valid":
            messages = {
                "missing": "Request a new security code and try again.",
                "expired": "That security code has expired. Request a new one.",
                "locked": "Too many incorrect attempts. Request a new security code.",
                "invalid": "That security code is incorrect.",
            }
            return Response({"success": False, "message": messages.get(result, "Unable to verify the security code.")}, status=status.HTTP_400_BAD_REQUEST)
        request.user.two_factor_enabled = True
        request.user.save(update_fields=["two_factor_enabled", "updated_at"])
        record_audit_event(actor=request.user, action="TWO_FACTOR_ENABLED", entity_type="account", entity_id=request.user.id, summary="Enabled email two-factor authentication", metadata={"two_factor_enabled": True}, request=request)
        return Response({"success": True, "enabled": True, "message": "Two-factor authentication is enabled for future sign-ins."})


class DisableTwoFactorView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password = str(request.data.get("password", ""))
        if not request.user.two_factor_enabled:
            return Response({"success": False, "message": "Two-factor authentication is already disabled."}, status=status.HTTP_409_CONFLICT)
        if not check_password(password, request.user.password):
            return Response({"success": False, "message": "Your current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        request.user.two_factor_enabled = False
        request.user.save(update_fields=["two_factor_enabled", "updated_at"])
        AccountCode.objects.filter(
            user=request.user,
            purpose=AccountCode.Purpose.LOGIN_TWO_FACTOR,
            consumed_at__isnull=True,
        ).update(consumed_at=timezone.now())
        record_audit_event(actor=request.user, action="TWO_FACTOR_DISABLED", entity_type="account", entity_id=request.user.id, summary="Disabled email two-factor authentication", metadata={"two_factor_enabled": False}, request=request)
        return Response({"success": True, "enabled": False, "message": "Two-factor authentication has been disabled."})


class CurrentUserView(APIView):

    permission_classes = [IsAuthenticated]

    def build_response(self, user):

        response = {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "mobile": user.mobile,
            "role": user.role,
            "is_verified": user.is_verified,
            "two_factor_enabled": user.two_factor_enabled,
        }

        if user.role == User.Role.STUDENT:

            profile = user.student_profile

            response["student_profile"] = {
                "student_number": (
                    profile.student_number
                ),
                "national_id": profile.national_id or "",
                "university": profile.university,
                "campus": profile.campus,
                "course": profile.course,
                "year_of_study": (
                    profile.year_of_study
                ),
                "date_of_birth": (
                    profile.date_of_birth.isoformat()
                    if profile.date_of_birth
                    else ""
                ),
                "emergency_contact_name": (
                    profile.emergency_contact_name
                ),
                "emergency_contact_phone": (
                    profile.emergency_contact_phone
                ),
                "accessibility_requirements": profile.accessibility_requirements,
                "accommodation_preferences": profile.accommodation_preferences,
                "profile_completed": (
                    profile.profile_completed
                ),
            }

        elif user.role == User.Role.LANDLORD:

            profile = user.landlord_profile

            response["landlord_profile"] = {
                "business_name": (
                    profile.business_name
                ),
                "registration_number": (
                    profile.registration_number
                ),
                "phone": profile.phone,
                "address": profile.address,
                "verification_status": (
                    profile.verification_status
                ),
                "profile_completed": (
                    profile.profile_completed
                ),
            }

        elif (
            user.role
            == User.Role.ADMINISTRATOR
        ):

            try:
                profile = user.administrator_profile

                response["administrator_profile"] = {
                    "department": profile.department,
                    "job_title": profile.job_title,
                    "permissions_level": (
                        profile.permissions_level
                    ),
                }

            except AdministratorProfile.DoesNotExist:
                response["administrator_profile"] = None

        return response

    def get(self, request):

        return Response(
            self.build_response(
                request.user
            )
        )

    def patch(self, request):

        user = request.user

        if user.role == User.Role.LANDLORD:
            serializer = LandlordProfileUpdateSerializer(data=request.data, partial=True)
            if not serializer.is_valid():
                return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
            data = serializer.validated_data
            profile = user.landlord_profile
            identity_fields_changed = any(
                field in data and getattr(profile, field) != data[field]
                for field in ("business_name", "registration_number")
            )
            for field in ("first_name", "last_name", "mobile"):
                if field in data:
                    setattr(user, field, data[field])
            for field in ("business_name", "registration_number", "phone", "address"):
                if field in data:
                    setattr(profile, field, data[field])
            if identity_fields_changed and profile.verification_status in {"VERIFIED", "REJECTED"}:
                profile.verification_status = "PENDING"
            user.save()
            profile.profile_completed = all([
                bool(user.first_name.strip()),
                bool(user.last_name.strip()),
                bool(profile.business_name.strip()),
                bool(profile.phone.strip()),
                bool(profile.address.strip()),
            ])
            profile.save()
            record_audit_event(actor=user, action="LANDLORD_PROFILE_UPDATED", entity_type="account", entity_id=user.id, summary="Landlord updated profile information", metadata={"fields": list(data.keys())}, request=request)
            message = "Profile details changed. Your landlord verification has been returned to pending review." if identity_fields_changed else "Landlord profile updated successfully."
            return Response({"success": True, "message": message, **self.build_response(user)}, status=status.HTTP_200_OK)

        if user.role != User.Role.STUDENT:

            return Response(
                {
                    "success": False,
                    "message": (
                        "Student profile access required."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = StudentProfileUpdateSerializer(
            data=request.data,
            partial=True,
            context={"request": request},
        )

        if not serializer.is_valid():

            return Response(
                {
                    "success": False,
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data

        profile = user.student_profile

        user_fields = {
            "first_name",
            "last_name",
            "mobile",
        }

        profile_fields = {
            "university",
            "campus",
            "course",
            "year_of_study",
            "date_of_birth",
            "national_id",
            "emergency_contact_name",
            "emergency_contact_phone",
            "accessibility_requirements",
            "accommodation_preferences",
        }

        for field in user_fields:

            if field in data:

                setattr(
                    user,
                    field,
                    data[field],
                )

        for field in profile_fields:

            if field in data:

                setattr(
                    profile,
                    field,
                    data[field],
                )

        user.save()
        profile.save()

        profile.profile_completed = all(
            [
                bool(
                    user.first_name.strip()
                ),
                bool(
                    user.last_name.strip()
                ),
                bool(
                    user.mobile.strip()
                ),
                bool(
                    profile.student_number.strip()
                ),
                bool(
                    profile.university.strip()
                ),
                bool(
                    profile.campus.strip()
                ),
                bool(
                    profile.course.strip()
                ),
                profile.year_of_study
                is not None,
                profile.date_of_birth
                is not None,
                bool(
                    profile.emergency_contact_name.strip()
                ),
                bool(
                    profile.emergency_contact_phone.strip()
                ),
            ]
        )

        profile.save(
            update_fields=[
                "profile_completed",
                "updated_at",
            ]
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Profile updated successfully."
                ),
                **self.build_response(user),
            },
            status=status.HTTP_200_OK,
        )


class NotificationPreferencesView(APIView):
    permission_classes = [IsAuthenticated]

    fields = (
        "email_application_updates",
        "email_finance_updates",
        "email_accommodation_updates",
        "email_support_updates",
        "email_product_updates",
    )

    @staticmethod
    def delivery_mode():
        backend = settings.EMAIL_BACKEND
        if backend.endswith("console.EmailBackend"):
            return "development_console"
        if backend.endswith("smtp.EmailBackend") and settings.EMAIL_HOST:
            return "smtp"
        return "unconfigured"

    def get(self, request):
        preferences, _ = NotificationPreference.objects.get_or_create(user=request.user)
        return Response({
            "success": True,
            "preferences": {field: getattr(preferences, field) for field in self.fields},
            "email_verified": request.user.is_verified,
            "delivery_mode": self.delivery_mode(),
        })

    def patch(self, request):
        unknown = set(request.data) - set(self.fields)
        if unknown:
            return Response({"success": False, "message": "One or more notification settings are not supported."}, status=status.HTTP_400_BAD_REQUEST)
        if not request.data:
            return Response({"success": False, "message": "Choose at least one setting to update."}, status=status.HTTP_400_BAD_REQUEST)
        if any(not isinstance(value, bool) for value in request.data.values()):
            return Response({"success": False, "message": "Notification settings must be true or false."}, status=status.HTTP_400_BAD_REQUEST)

        preferences, _ = NotificationPreference.objects.get_or_create(user=request.user)
        for field, value in request.data.items():
            setattr(preferences, field, value)
        preferences.save(update_fields=[*request.data.keys(), "updated_at"])
        record_audit_event(
            actor=request.user,
            action="NOTIFICATION_PREFERENCES_UPDATED",
            entity_type="account",
            entity_id=request.user.id,
            summary="Updated email notification preferences",
            metadata={field: value for field, value in request.data.items()},
            request=request,
        )
        return Response({
            "success": True,
            "message": "Email notification preferences saved.",
            "preferences": {field: getattr(preferences, field) for field in self.fields},
            "email_verified": request.user.is_verified,
            "delivery_mode": self.delivery_mode(),
        })


class AccountEmailChangeRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        new_email = str(request.data.get("new_email", "")).strip().lower()
        current_password = request.data.get("current_password", "")
        try:
            validate_email(new_email)
        except DjangoValidationError:
            return Response({"success": False, "message": "Enter a valid email address."}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(current_password, str) or not check_password(current_password, request.user.password):
            return Response({"success": False, "message": "Your current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        if new_email == request.user.email.lower():
            return Response({"success": False, "message": "That is already your sign-in email."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email__iexact=new_email).exclude(id=request.user.id).exists():
            return Response({"success": False, "message": "An account already uses that email address."}, status=status.HTTP_409_CONFLICT)

        latest = AccountCode.objects.filter(
            user=request.user,
            purpose=AccountCode.Purpose.CHANGE_EMAIL,
            consumed_at__isnull=True,
        ).first()
        if latest and (timezone.now() - latest.created_at).total_seconds() < 60 and latest.target_email != new_email:
            return Response({"success": False, "message": "A code was just sent to another address. Wait one minute before requesting a different email."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        result = issue_account_code(request.user, AccountCode.Purpose.CHANGE_EMAIL, recipient_email=new_email)
        if result == "cooldown":
            return Response({"success": True, "message": "A confirmation code was recently sent to that address. Check your inbox before requesting another.", "pending_email": new_email})
        if result == "failed":
            return Response({"success": False, "message": "The confirmation message could not be sent. Your current email remains unchanged."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"success": True, "message": "A six-digit confirmation code was sent to the new address. Your sign-in email stays the same until you confirm it.", "pending_email": new_email})


class AccountEmailChangeConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = str(request.data.get("code", "")).strip()
        if len(code) != 6 or not code.isdigit():
            return Response({"success": False, "message": "Enter the six-digit code sent to your new email address."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            challenge = AccountCode.objects.select_for_update().filter(
                user=user,
                purpose=AccountCode.Purpose.CHANGE_EMAIL,
                consumed_at__isnull=True,
            ).first()
            if not challenge or challenge.expires_at <= timezone.now() or challenge.attempts >= 5:
                if challenge:
                    challenge.consumed_at = timezone.now()
                    challenge.save(update_fields=["consumed_at"])
                return Response({"success": False, "message": "The confirmation code has expired. Request a new one and try again."}, status=status.HTTP_400_BAD_REQUEST)
            if not check_password(code, challenge.code_hash):
                challenge.attempts += 1
                challenge.save(update_fields=["attempts"])
                return Response({"success": False, "message": "That code is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
            if User.objects.filter(email__iexact=challenge.target_email).exclude(id=user.id).exists():
                challenge.consumed_at = timezone.now()
                challenge.save(update_fields=["consumed_at"])
                return Response({"success": False, "message": "That email address has since been used by another account. Request a different address."}, status=status.HTTP_409_CONFLICT)

            previous_email = user.email
            user.email = challenge.target_email
            user.is_verified = True
            try:
                with transaction.atomic():
                    user.save(update_fields=["email", "is_verified", "updated_at"])
            except IntegrityError:
                challenge.consumed_at = timezone.now()
                challenge.save(update_fields=["consumed_at"])
                return Response({"success": False, "message": "That email address has since been used by another account. Request a different address."}, status=status.HTTP_409_CONFLICT)
            challenge.consumed_at = timezone.now()
            challenge.save(update_fields=["consumed_at"])
            record_audit_event(
                actor=user,
                action="ACCOUNT_EMAIL_CHANGED",
                entity_type="account",
                entity_id=user.id,
                summary="Account email address changed after new-address verification",
                metadata={"previous_email": previous_email, "new_email": user.email},
                request=request,
            )
            transaction.on_commit(lambda: send_mail(
                "Your Student Haven email address changed",
                "Your account sign-in email was changed. If you did not make this change, contact Student Haven support immediately.",
                settings.DEFAULT_FROM_EMAIL,
                [previous_email],
                fail_silently=True,
            ))
        return Response({"success": True, "message": "Your new email address is verified and is now used to sign in.", "email": user.email})


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        code = str(request.data.get("code", "")).strip()
        if not email or len(code) != 6 or not code.isdigit():
            return Response({"success": False, "message": "Enter a valid email and six-digit code."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user = User.objects.select_for_update().filter(email=email).first()
            if not user:
                return Response({"success": False, "message": "This verification code is invalid or expired."}, status=status.HTTP_400_BAD_REQUEST)
            if user.is_verified:
                return Response({"success": True, "message": "This email address is already verified."})

            code_result = consume_account_code(
                user,
                AccountCode.Purpose.VERIFY_EMAIL,
                code,
            )
            if code_result == "expired":
                return Response({"success": False, "message": "This verification code has expired. Request a new code and try again."}, status=status.HTTP_400_BAD_REQUEST)
            if code_result == "locked":
                return Response({"success": False, "message": "Too many incorrect attempts. Request a new code and try again."}, status=status.HTTP_400_BAD_REQUEST)
            if code_result != "valid":
                return Response({"success": False, "message": "That code is incorrect. Check the email and try again."}, status=status.HTTP_400_BAD_REQUEST)

            user.is_verified = True
            user.save(update_fields=["is_verified", "updated_at"])

        return Response({"success": True, "message": "Email verified. You can now sign in."})


class ResendVerificationCodeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        user = User.objects.filter(email=email, email_verification_required=True, is_verified=False).first()
        if not user:
            return Response({
                "success": True,
                "message": "If this account needs verification, a new code will be sent when email delivery is available. Check your spam folder or contact support if nothing arrives.",
            })

        delivery = issue_registration_verification(user)
        if delivery == "failed":
            return Response({
                "success": False,
                "message": "We couldn't send the verification email. Please try again later or contact StudentHaven support.",
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({
            "success": True,
            "message": "A new verification code was sent. Any code received in the last 15 minutes can still be used. Check your inbox and spam folder.",
        })


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        user = User.objects.filter(email=email, is_active=True).first()
        if user:
            issue_account_code(user, AccountCode.Purpose.RESET_PASSWORD)
        return Response({
            "success": True,
            "message": "If an active account uses that email, a password reset code will be sent.",
        })


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        code = str(request.data.get("code", "")).strip()
        password = request.data.get("new_password", "")
        password_confirm = request.data.get("password_confirm", "")
        if not email or len(code) != 6 or not code.isdigit():
            return Response({"success": False, "message": "Enter a valid email and six-digit code."}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(password, str) or len(password) < 8:
            return Response({"success": False, "message": "Choose a password with at least eight characters."}, status=status.HTTP_400_BAD_REQUEST)
        if password != password_confirm:
            return Response({"success": False, "message": "The passwords do not match."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user = User.objects.select_for_update().filter(email=email, is_active=True).first()
            if not user:
                return Response({"success": False, "message": "The reset code is invalid or expired."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                validate_password(password, user=user)
            except DjangoValidationError as error:
                return Response({"success": False, "message": " ".join(error.messages)}, status=status.HTTP_400_BAD_REQUEST)

            challenge = AccountCode.objects.select_for_update().filter(
                user=user,
                purpose=AccountCode.Purpose.RESET_PASSWORD,
                consumed_at__isnull=True,
            ).first()
            if not challenge or challenge.expires_at <= timezone.now() or challenge.attempts >= 5:
                if challenge and challenge.consumed_at is None:
                    challenge.consumed_at = timezone.now()
                    challenge.save(update_fields=["consumed_at"])
                return Response({"success": False, "message": "The reset code has expired. Request a new one and try again."}, status=status.HTTP_400_BAD_REQUEST)
            if not check_password(code, challenge.code_hash):
                challenge.attempts += 1
                challenge.save(update_fields=["attempts"])
                return Response({"success": False, "message": "That reset code is incorrect. Check the email and try again."}, status=status.HTTP_400_BAD_REQUEST)

            user.set_password(password)
            user.save(update_fields=["password", "updated_at"])
            AccountCode.objects.filter(
                user=user,
                purpose=AccountCode.Purpose.RESET_PASSWORD,
                consumed_at__isnull=True,
            ).update(consumed_at=timezone.now())

        return Response({"success": True, "message": "Password updated. You can now sign in with your new password."})


class AdminDirectoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, kind):
        if request.user.role != User.Role.ADMINISTRATOR and not request.user.is_superuser:
            return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)

        if kind not in {"students", "landlords"}:
            return Response({"success": False, "message": "Unknown account directory."}, status=status.HTTP_404_NOT_FOUND)

        role = User.Role.STUDENT if kind == "students" else User.Role.LANDLORD
        users = User.objects.filter(role=role)
        if kind == "students":
            users = users.select_related("student_profile")
        else:
            users = users.select_related("landlord_profile")

        search = request.GET.get("search", "").strip()
        if search:
            if kind == "students":
                users = users.filter(
                    Q(email__icontains=search)
                    | Q(first_name__icontains=search)
                    | Q(last_name__icontains=search)
                    | Q(student_profile__student_number__icontains=search)
                    | Q(student_profile__university__icontains=search)
                )
            else:
                users = users.filter(
                    Q(email__icontains=search)
                    | Q(first_name__icontains=search)
                    | Q(last_name__icontains=search)
                    | Q(landlord_profile__business_name__icontains=search)
                    | Q(landlord_profile__registration_number__icontains=search)
                )

        if kind == "students":
            verified = request.GET.get("verified", "")
            if verified == "true":
                users = users.filter(is_verified=True)
            elif verified == "false":
                users = users.filter(is_verified=False)
        else:
            verification_status = request.GET.get("verification_status", "")
            if verification_status in {"PENDING", "VERIFIED", "REJECTED", "SUSPENDED"}:
                users = users.filter(landlord_profile__verification_status=verification_status)

        records = []
        for user in users.order_by("-created_at"):
            record = {
                "id": user.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "full_name": user.get_full_name(),
                "email": user.email,
                "mobile": user.mobile,
                "is_active": user.is_active,
                "is_verified": user.is_verified,
                "created_at": user.created_at,
            }
            if kind == "students":
                profile = getattr(user, "student_profile", None)
                record["profile"] = {
                    "student_number": profile.student_number,
                    "university": profile.university,
                    "campus": profile.campus,
                    "course": profile.course,
                    "year_of_study": profile.year_of_study,
                    "profile_completed": profile.profile_completed,
                } if profile else None
            else:
                profile = getattr(user, "landlord_profile", None)
                record["profile"] = {
                    "business_name": profile.business_name,
                    "registration_number": profile.registration_number,
                    "phone": profile.phone,
                    "address": profile.address,
                    "verification_status": profile.verification_status,
                    "profile_completed": profile.profile_completed,
                } if profile else None
            records.append(record)

        return Response({"success": True, "count": len(records), "users": records})


class AdminAccountStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, kind, user_id):
        if request.user.role != User.Role.ADMINISTRATOR and not request.user.is_superuser:
            return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)
        if kind not in {"students", "landlords"}:
            return Response({"success": False, "message": "Unknown account directory."}, status=status.HTTP_404_NOT_FOUND)

        expected_role = User.Role.STUDENT if kind == "students" else User.Role.LANDLORD
        user = User.objects.filter(id=user_id, role=expected_role).first()
        if not user:
            return Response({"success": False, "message": "Account not found."}, status=status.HTTP_404_NOT_FOUND)

        allowed_fields = {"is_active", "is_verified"} if kind == "students" else {"is_active", "verification_status"}
        if not request.data or set(request.data.keys()) - allowed_fields:
            return Response({"success": False, "message": "Choose a valid account status change."}, status=status.HTTP_400_BAD_REQUEST)
        if "is_active" in request.data and not isinstance(request.data["is_active"], bool):
            return Response({"success": False, "message": "Account status must be true or false."}, status=status.HTTP_400_BAD_REQUEST)
        if kind == "students" and "is_verified" in request.data and not isinstance(request.data["is_verified"], bool):
            return Response({"success": False, "message": "Verification status must be true or false."}, status=status.HTTP_400_BAD_REQUEST)

        landlord_profile = None
        if kind == "landlords" and "verification_status" in request.data:
            landlord_profile = getattr(user, "landlord_profile", None)
            if not landlord_profile:
                return Response({"success": False, "message": "This landlord account has no verification profile."}, status=status.HTTP_409_CONFLICT)
            if request.data["verification_status"] not in {"PENDING", "VERIFIED", "REJECTED", "SUSPENDED"}:
                return Response({"success": False, "message": "Choose a valid landlord verification status."}, status=status.HTTP_400_BAD_REQUEST)

        previous_is_active = user.is_active
        previous_verification_status = landlord_profile.verification_status if landlord_profile else None
        changed_user_fields = []
        if "is_active" in request.data:
            user.is_active = request.data["is_active"]
            changed_user_fields.append("is_active")
        if kind == "students" and "is_verified" in request.data:
            user.is_verified = request.data["is_verified"]
            changed_user_fields.append("is_verified")
        if changed_user_fields:
            user.save(update_fields=[*changed_user_fields, "updated_at"])
        if landlord_profile:
            landlord_profile.verification_status = request.data["verification_status"]
            landlord_profile.save(update_fields=["verification_status", "updated_at"])

        if kind == "landlords" and (
            user.is_active != previous_is_active
            or (landlord_profile and landlord_profile.verification_status != previous_verification_status)
        ):
            changes = []
            if user.is_active != previous_is_active:
                changes.append("sign-in access enabled" if user.is_active else "sign-in access disabled")
            if landlord_profile and landlord_profile.verification_status != previous_verification_status:
                changes.append(f"verification status set to {landlord_profile.get_verification_status_display().lower()}")
            create_notification(
                recipient=user,
                actor=request.user,
                notification_type="SYSTEM",
                title="Account status updated by an administrator",
                message=f"An administrator updated your landlord account: {', '.join(changes)}.",
                extra_data={"source": "admin_account_status"},
            )

        record_audit_event(
            actor=request.user,
            action="ACCOUNT_STATUS_UPDATED",
            entity_type=kind,
            entity_id=user.id,
            summary=f"Updated {kind[:-1]} account status",
            metadata=request.data,
            request=request,
        )

        return Response({
            "success": True,
            "message": "Account status updated.",
            "user": {
                "id": user.id,
                "is_active": user.is_active,
                "is_verified": user.is_verified,
                "verification_status": getattr(getattr(user, "landlord_profile", None), "verification_status", None),
            },
        })


class AdminAccountDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, kind, user_id):
        if request.user.role != User.Role.ADMINISTRATOR and not request.user.is_superuser:
            return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)
        if kind not in {"students", "landlords"}:
            return Response({"success": False, "message": "Unknown account directory."}, status=status.HTTP_404_NOT_FOUND)

        expected_role = User.Role.STUDENT if kind == "students" else User.Role.LANDLORD
        with transaction.atomic():
            user = User.objects.select_for_update().filter(id=user_id, role=expected_role).first()
            if not user:
                return Response({"success": False, "message": "Account not found."}, status=status.HTTP_404_NOT_FOUND)
            if user.id == request.user.id:
                return Response({"success": False, "message": "You cannot delete the account you are currently using."}, status=status.HTTP_409_CONFLICT)

            confirmation_email = str(request.data.get("confirmation_email", "")).strip().casefold()
            if confirmation_email != user.email.casefold():
                return Response({"success": False, "message": "Enter the account email exactly to confirm permanent deletion."}, status=status.HTTP_400_BAD_REQUEST)

            user_id_to_delete = user.id
            profile_photo_name = ""
            if kind == "students":
                profile = getattr(user, "student_profile", None)
                if profile and profile.profile_photo:
                    profile_photo_name = profile.profile_photo.name
            try:
                with transaction.atomic():
                    LoginEvent.objects.filter(user=user).delete()
                    user.delete()
            except ProtectedError:
                return Response(
                    {
                        "success": False,
                        "message": "This account is linked to protected application, housing, support, conversation, or financial records and cannot be permanently deleted. Deactivate the account to remove sign-in access while preserving that history.",
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            if profile_photo_name:
                storage = profile._meta.get_field("profile_photo").storage
                transaction.on_commit(lambda: storage.delete(profile_photo_name))

            record_audit_event(
                actor=request.user,
                action="ACCOUNT_PERMANENTLY_DELETED",
                entity_type=kind,
                entity_id=user_id_to_delete,
                summary=f"Permanently deleted {kind[:-1]} account",
                metadata={},
                request=request,
            )

        return Response({"success": True, "message": "Account and removable account data were permanently deleted."})
