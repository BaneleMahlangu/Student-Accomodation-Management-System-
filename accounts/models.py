from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from .storage import PrivateProfileStorage


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)

        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", User.Role.ADMINISTRATOR)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_verified", True)

        return self.create_user(
            email,
            password,
            **extra_fields
        )


class User(AbstractBaseUser, PermissionsMixin):

    class Role(models.TextChoices):
        STUDENT = "STUDENT", "Student"
        LANDLORD = "LANDLORD", "Landlord"
        ADMINISTRATOR = "ADMINISTRATOR", "Administrator"

    email = models.EmailField(unique=True)

    first_name = models.CharField(max_length=100)

    last_name = models.CharField(max_length=100)

    mobile = models.CharField(
        max_length=20,
        blank=True
    )

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STUDENT
    )

    is_verified = models.BooleanField(default=False)

    # Newly registered users must verify their email. This flag keeps
    # pre-existing accounts usable while the verification flow is rolled out.
    email_verification_required = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)

    is_staff = models.BooleanField(default=False)

    two_factor_enabled = models.BooleanField(default=False)

    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    login_locked_until = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"

    REQUIRED_FIELDS = [
        "first_name",
        "last_name"
    ]

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def get_short_name(self):
        return self.first_name

    def __str__(self):
        return f"{self.get_full_name()} ({self.email})"


class StudentProfile(models.Model):

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="student_profile"
    )

    student_number = models.CharField(
        max_length=50,
        unique=True
    )

    national_id = models.CharField(
        max_length=13,
        unique=True,
        null=True,
        blank=True,
    )

    university = models.CharField(
        max_length=200,
        blank=True
    )

    campus = models.CharField(
        max_length=200,
        blank=True
    )

    course = models.CharField(
        max_length=200,
        blank=True
    )

    year_of_study = models.PositiveIntegerField(
        null=True,
        blank=True
    )

    date_of_birth = models.DateField(
        null=True,
        blank=True
    )

    emergency_contact_name = models.CharField(
        max_length=200,
        blank=True
    )

    emergency_contact_phone = models.CharField(
        max_length=20,
        blank=True
    )

    accessibility_requirements = models.TextField(blank=True)

    share_contact_with_landlord = models.BooleanField(default=True)

    profile_photo = models.ImageField(upload_to="student-profiles/", storage=PrivateProfileStorage(), blank=True)

    accommodation_preferences = models.JSONField(
        default=dict,
        blank=True,
    )

    profile_completed = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.student_number}"


class LandlordProfile(models.Model):

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="landlord_profile"
    )

    business_name = models.CharField(
        max_length=200,
        blank=True
    )

    registration_number = models.CharField(
        max_length=100,
        blank=True
    )

    phone = models.CharField(
        max_length=20,
        blank=True
    )

    address = models.TextField(
        blank=True
    )

    verification_status = models.CharField(
        max_length=30,
        choices=[
            ("PENDING", "Pending"),
            ("VERIFIED", "Verified"),
            ("REJECTED", "Rejected"),
            ("SUSPENDED", "Suspended"),
        ],
        default="PENDING"
    )

    profile_completed = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return self.business_name or self.user.get_full_name()


class AdministratorProfile(models.Model):

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="administrator_profile"
    )

    department = models.CharField(
        max_length=200,
        blank=True
    )

    job_title = models.CharField(
        max_length=200,
        blank=True
    )

    permissions_level = models.CharField(
        max_length=50,
        default="STANDARD"
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return self.user.get_full_name()


class NotificationPreference(models.Model):
    """Per-account opt-ins for non-security email notifications."""

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    email_application_updates = models.BooleanField(default=True)
    email_finance_updates = models.BooleanField(default=True)
    email_accommodation_updates = models.BooleanField(default=True)
    email_support_updates = models.BooleanField(default=True)
    email_product_updates = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Email preferences — {self.user.email}"


class AccountCode(models.Model):
    class Purpose(models.TextChoices):
        VERIFY_EMAIL = "VERIFY_EMAIL", "Verify email"
        CHANGE_EMAIL = "CHANGE_EMAIL", "Change email address"
        RESET_PASSWORD = "RESET_PASSWORD", "Reset password"
        ENABLE_TWO_FACTOR = "ENABLE_TWO_FACTOR", "Enable two-factor authentication"
        LOGIN_TWO_FACTOR = "LOGIN_TWO_FACTOR", "Two-factor sign-in"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="account_codes",
    )
    purpose = models.CharField(max_length=20, choices=Purpose.choices)
    code_hash = models.CharField(max_length=256)
    target_email = models.EmailField(blank=True, default="")
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "purpose", "created_at"], name="accounts_ac_user_id_e2264c_idx"),
        ]

    def __str__(self):
        return f"{self.user.email}: {self.purpose}"


class LoginEvent(models.Model):
    class Method(models.TextChoices):
        PASSWORD = "PASSWORD", "Password sign-in"
        EMAIL_CODE = "EMAIL_CODE", "Email security code"

    class Outcome(models.TextChoices):
        SUCCESSFUL = "SUCCESSFUL", "Successful"
        FAILED = "FAILED", "Failed"
        CHALLENGE_REQUIRED = "CHALLENGE_REQUIRED", "Security code required"
        CHALLENGE_FAILED = "CHALLENGE_FAILED", "Security code failed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="login_events",
    )
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.PASSWORD)
    outcome = models.CharField(max_length=24, choices=Outcome.choices)
    failure_reason = models.CharField(max_length=120, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "-created_at"], name="account_login_user_time_idx")]

    def __str__(self):
        return f"{self.user or 'Unknown account'} — {self.outcome} — {self.created_at}"


class AccountSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="active_sessions")
    session_key = models.CharField(max_length=64, unique=True)
    user_agent = models.CharField(max_length=512, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_seen_at", "-id"]
        indexes = [models.Index(fields=["user", "revoked_at", "expires_at"], name="account_session_active_idx")]

    def __str__(self):
        return f"{self.user.email} — {self.session_key[:8]}"
