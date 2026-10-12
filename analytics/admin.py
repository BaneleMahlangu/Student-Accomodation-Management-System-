from django.contrib import admin

# Register your models here.
from django.contrib import admin

from .models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "action", "entity_type", "entity_id", "summary")
    list_filter = ("action", "entity_type")
    search_fields = ("summary", "actor__email", "entity_type")
    readonly_fields = ("actor", "action", "entity_type", "entity_id", "summary", "metadata", "ip_address", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
