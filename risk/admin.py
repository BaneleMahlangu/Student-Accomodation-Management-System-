from django.contrib import admin

from .models import LandlordRiskSignal, RiskSignal


@admin.register(RiskSignal)
class RiskSignalAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "application", "signal_type", "severity", "status", "created_at")
    list_filter = ("status", "severity", "signal_type")
    search_fields = ("student__email", "student__first_name", "student__last_name", "application__application_number")
    readonly_fields = ("student", "application", "signal_type", "severity", "occurrence_count", "explanation", "created_at", "updated_at")


@admin.register(LandlordRiskSignal)
class LandlordRiskSignalAdmin(admin.ModelAdmin):
    list_display = ("landlord", "signal_type", "severity", "status", "occurrence_count", "created_at")
    list_filter = ("signal_type", "severity", "status")
    search_fields = ("landlord__email", "landlord__first_name", "landlord__last_name", "property__name")
    readonly_fields = ("landlord", "property", "signal_type", "severity", "occurrence_count", "explanation", "created_at", "updated_at")
