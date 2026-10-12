from django.urls import path

from .views import AdminAuditLogView, AdminGlobalSearchView, AdminOverviewView, AdminReportExportView, AdminReportScheduleDetailView, AdminReportSchedulesView


urlpatterns = [
    path("admin/overview/", AdminOverviewView.as_view(), name="admin-analytics-overview"),
    path("admin/audit-logs/", AdminAuditLogView.as_view(), name="admin-audit-logs"),
    path("admin/reports/", AdminReportExportView.as_view(), name="admin-report-export"),
    path("admin/search/", AdminGlobalSearchView.as_view(), name="admin-global-search"),
    path("admin/report-schedules/", AdminReportSchedulesView.as_view(), name="admin-report-schedules"),
    path("admin/report-schedules/<int:schedule_id>/", AdminReportScheduleDetailView.as_view(), name="admin-report-schedule-detail"),
]
