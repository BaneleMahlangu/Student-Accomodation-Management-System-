from django.contrib import admin

from .models import AccommodationChangeRequest, Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("booking_number", "student", "property", "room", "status", "start_date", "end_date")
    list_filter = ("status", "property")
    search_fields = ("booking_number", "student__email", "student__first_name", "student__last_name", "property__name")


@admin.register(AccommodationChangeRequest)
class AccommodationChangeRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "request_type", "student", "booking", "status", "created_at", "reviewed_by")
    list_filter = ("request_type", "status", "created_at")
    search_fields = ("student__email", "student__first_name", "student__last_name", "booking__booking_number")
    readonly_fields = ("pending_key", "created_at", "updated_at")
