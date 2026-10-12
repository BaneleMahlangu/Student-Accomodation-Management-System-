from django.contrib import admin

from .models import (
    Application,
    ApplicationStatusHistory,
)


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):

    list_display = (
        "application_number",
        "student",
        "property",
        "room",
        "status",
        "current_step",
        "created_at",
        "submitted_at",
    )

    list_filter = (
        "status",
        "funding_method",
        "accessibility_required",
    )

    search_fields = (
        "application_number",
        "student__email",
        "student__first_name",
        "student__last_name",
        "property__name",
        "room__room_number",
    )

    readonly_fields = (
        "application_number",
        "status",
        "created_at",
        "updated_at",
        "submitted_at",
        "reviewed_at",
    )


@admin.register(ApplicationStatusHistory)
class ApplicationStatusHistoryAdmin(admin.ModelAdmin):

    list_display = (
        "application",
        "from_status",
        "to_status",
        "changed_by",
        "created_at",
    )

    list_filter = (
        "from_status",
        "to_status",
    )

    search_fields = (
        "application__application_number",
    )
