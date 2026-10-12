from django.contrib import admin

from .models import FundingPayment, SponsorshipApplication, SponsorshipProgram


@admin.register(FundingPayment)
class FundingPaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "student",
        "contract",
        "funding_method",
        "funding_status",
        "payment_status",
        "amount_due",
        "amount_paid",
        "created_at",
    )

    list_filter = (
        "funding_status",
        "payment_status",
        "funding_method",
    )

    search_fields = (
        "student__email",
        "contract__contract_number",
        "payment_reference",
    )


@admin.register(SponsorshipProgram)
class SponsorshipProgramAdmin(admin.ModelAdmin):
    list_display = ("name", "sponsor_name", "amount", "funding_period_start", "funding_period_end", "is_active")
    list_filter = ("is_active", "currency")
    search_fields = ("name", "sponsor_name", "description")


@admin.register(SponsorshipApplication)
class SponsorshipApplicationAdmin(admin.ModelAdmin):
    list_display = ("program", "student", "status", "submitted_at", "reviewed_at")
    list_filter = ("status", "program")
    search_fields = ("student__email", "student__first_name", "student__last_name", "program__name")
    readonly_fields = ("submitted_at", "updated_at")
