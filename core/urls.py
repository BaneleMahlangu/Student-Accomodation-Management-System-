from django.urls import path

from .views import (
    AdminAnnouncementDetailView,
    AdminAnnouncementsView,
    AdminPlatformConfigurationView,
    AdminPlatformReadinessView,
    ApplicationAvailabilityView,
    CurrentAnnouncementsView,
)

urlpatterns = [
    path("announcements/", CurrentAnnouncementsView.as_view(), name="current-announcements"),
    path("application-availability/", ApplicationAvailabilityView.as_view(), name="application-availability"),
    path("admin/settings/", AdminPlatformConfigurationView.as_view(), name="admin-platform-settings"),
    path("admin/readiness/", AdminPlatformReadinessView.as_view(), name="admin-platform-readiness"),
    path("admin/announcements/", AdminAnnouncementsView.as_view(), name="admin-announcements"),
    path("admin/announcements/<int:announcement_id>/", AdminAnnouncementDetailView.as_view(), name="admin-announcement-detail"),
]
