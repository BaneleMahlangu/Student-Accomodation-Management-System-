from django.contrib import admin

# Register your models here.
from django.contrib import admin

from .models import Complaint, ComplaintMessage


class ComplaintMessageInline(admin.TabularInline):
    model = ComplaintMessage
    extra = 0
    readonly_fields = ("sender", "body", "is_internal", "created_at")


@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = ("reference_number", "title", "student", "property", "priority", "status", "created_at")
    list_filter = ("status", "priority", "category")
    search_fields = ("reference_number", "title", "student__email", "student__first_name", "student__last_name")
    readonly_fields = ("reference_number", "created_at", "updated_at")
    inlines = (ComplaintMessageInline,)


@admin.register(ComplaintMessage)
class ComplaintMessageAdmin(admin.ModelAdmin):
    list_display = ("complaint", "sender", "is_internal", "created_at")
    list_filter = ("is_internal",)
    search_fields = ("complaint__reference_number", "sender__email", "body")
