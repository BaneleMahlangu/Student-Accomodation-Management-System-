from django.contrib import admin

from .models import Contract


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = (
        "contract_number",
        "student",
        "property_name",
        "room_number",
        "status",
        "start_date",
        "end_date",
        "created_at",
    )

    list_filter = (
        "status",
        "start_date",
        "end_date",
    )

    search_fields = (
        "contract_number",
        "student__email",
        "property_name",
        "room_number",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
        "signed_at",
        "signature_name",
        "signature_consent_version",
    )
