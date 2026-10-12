from django.contrib import admin

from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):

    list_display = [
        "id",
        "student",
        "application",
        "document_type",
        "status",
        "uploaded_at",
        "verified_at",
        "expiry_date",
    ]

    list_filter = [
        "document_type",
        "status",
        "uploaded_at",
    ]

    search_fields = [
        "student__email",
        "student__first_name",
        "student__last_name",
        "application__application_number",
        "original_filename",
    ]

    readonly_fields = [
        "uploaded_at",
        "verified_at",
        "updated_at",
    ]