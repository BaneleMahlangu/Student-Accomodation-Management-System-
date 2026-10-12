from django.contrib import admin

from .models import (
    User,
    StudentProfile,
    LandlordProfile,
    AdministratorProfile,
    AccountCode,
    AccountSession,
    LoginEvent,
    NotificationPreference,
)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = (
        "email",
        "first_name",
        "last_name",
        "role",
        "is_verified",
        "is_active",
        "created_at",
    )

    list_filter = (
        "role",
        "is_verified",
        "is_active",
    )

    search_fields = (
        "email",
        "first_name",
        "last_name",
    )


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = (
        "student_number",
        "user",
        "university",
        "campus",
        "course",
        "profile_completed",
    )

    search_fields = (
        "student_number",
        "user__email",
        "user__first_name",
        "user__last_name",
    )


@admin.register(LandlordProfile)
class LandlordProfileAdmin(admin.ModelAdmin):
    list_display = (
        "business_name",
        "user",
        "verification_status",
        "profile_completed",
    )

    list_filter = (
        "verification_status",
    )

    search_fields = (
        "business_name",
        "user__email",
    )


@admin.register(AdministratorProfile)
class AdministratorProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "department",
        "job_title",
        "permissions_level",
    )


@admin.register(AccountCode)
class AccountCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "purpose", "attempts", "expires_at", "consumed_at", "created_at")
    list_filter = ("purpose", "consumed_at", "created_at")
    search_fields = ("user__email",)
    readonly_fields = ("user", "purpose", "code_hash", "attempts", "expires_at", "consumed_at", "created_at")


@admin.register(LoginEvent)
class LoginEventAdmin(admin.ModelAdmin):
    list_display = ("user", "method", "outcome", "ip_address", "created_at")
    list_filter = ("method", "outcome", "created_at")
    search_fields = ("user__email", "user__first_name", "user__last_name", "ip_address")
    readonly_fields = ("user", "method", "outcome", "failure_reason", "ip_address", "user_agent", "created_at")


@admin.register(AccountSession)
class AccountSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "ip_address", "created_at", "last_seen_at", "expires_at", "revoked_at")
    list_filter = ("revoked_at", "created_at")
    search_fields = ("user__email", "user__first_name", "user__last_name", "ip_address")
    readonly_fields = ("user", "session_key", "user_agent", "ip_address", "created_at", "last_seen_at", "expires_at", "revoked_at")


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ("user", "email_application_updates", "email_finance_updates", "email_accommodation_updates", "email_support_updates", "email_product_updates", "updated_at")
    search_fields = ("user__email", "user__first_name", "user__last_name")
