from django.contrib import admin

# Register your models here.
from django.contrib import admin

from .models import Conversation, ConversationParticipant, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ("sender", "body", "created_at")


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("subject", "created_by", "property", "application", "status", "updated_at")
    list_filter = ("status",)
    search_fields = ("subject", "participants__email", "property__name", "application__application_number")
    inlines = (MessageInline,)


@admin.register(ConversationParticipant)
class ConversationParticipantAdmin(admin.ModelAdmin):
    list_display = ("conversation", "user", "last_read_at", "joined_at")
    search_fields = ("user__email", "conversation__subject")
