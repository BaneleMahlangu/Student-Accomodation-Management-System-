from django.contrib import admin

from .models import (
    University,
    Campus,
    Amenity,
    Property,
    Building,
    Floor,
    RoomType,
    Room,
    Bed,
    PropertyImage,
    RoomImage,
    StudentFavoriteProperty,
)


@admin.register(StudentFavoriteProperty)
class StudentFavoritePropertyAdmin(admin.ModelAdmin):
    list_display = ("student", "property", "created_at")
    search_fields = ("student__email", "property__name")
    list_select_related = ("student", "property")


@admin.register(University)
class UniversityAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "city",
        "province",
    )
    search_fields = (
        "name",
        "code",
        "city",
    )


@admin.register(Campus)
class CampusAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "university",
        "address",
    )
    search_fields = (
        "name",
        "university__name",
    )
    list_filter = ("university",)


@admin.register(Amenity)
class AmenityAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    readonly_fields = ("rating",)
    list_display = (
        "name",
        "property_type",
        "landlord",
        "campus",
        "status",
        "rating",
        "monthly_min_price",
        "monthly_max_price",
    )
    list_filter = (
        "property_type",
        "status",
        "campus",
    )
    search_fields = (
        "name",
        "address",
        "landlord__email",
    )


@admin.register(Building)
class BuildingAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "property",
        "number_of_floors",
    )
    search_fields = (
        "name",
        "property__name",
    )


@admin.register(Floor)
class FloorAdmin(admin.ModelAdmin):
    list_display = (
        "floor_number",
        "name",
        "building",
    )
    search_fields = (
        "name",
        "building__name",
    )


@admin.register(RoomType)
class RoomTypeAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "default_capacity",
        "default_monthly_price",
    )
    search_fields = ("name",)


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = (
        "room_number",
        "property",
        "floor",
        "room_type",
        "capacity",
        "monthly_price",
        "status",
        "is_accessible",
    )
    list_filter = (
        "status",
        "room_type",
        "is_accessible",
    )
    readonly_fields = ("property",)
    search_fields = (
        "room_number",
        "property__name",
        "floor__building__property__name",
    )


@admin.register(Bed)
class BedAdmin(admin.ModelAdmin):
    list_display = (
        "bed_number",
        "room",
        "status",
        "current_student",
    )
    list_filter = ("status",)
    search_fields = (
        "bed_number",
        "room__room_number",
        "current_student__email",
    )


@admin.register(PropertyImage)
class PropertyImageAdmin(admin.ModelAdmin):
    list_display = (
        "property",
        "category",
        "is_primary",
        "display_order",
    )
    list_filter = (
        "category",
        "is_primary",
    )


@admin.register(RoomImage)
class RoomImageAdmin(admin.ModelAdmin):
    list_display = (
        "room",
        "display_order",
    )
