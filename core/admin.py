from django.contrib import admin

from .models import PlatformAnnouncement, PlatformConfiguration


@admin.register(PlatformConfiguration)
class PlatformConfigurationAdmin(admin.ModelAdmin):
    list_display = ("application_period_name", "applications_open", "application_opens_at", "application_closes_at", "updated_at")
    readonly_fields = ("updated_at",)


@admin.register(PlatformAnnouncement)
class PlatformAnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "audience", "starts_at", "ends_at", "is_active")
    list_filter = ("audience", "is_active")
    search_fields = ("title", "body")
