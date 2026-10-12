from decimal import Decimal, ROUND_HALF_UP
import math

from django.db.models import Avg, Count
from rest_framework import serializers

from .models import (
    Property,
    Campus,
    Amenity,
    Building,
    Floor,
    RoomType,
    Room,
    Bed,
    PropertyImage,
    RoomImage,
    BedImage,
    PropertyReview,
)


def _distance_between_coordinates_km(latitude_a, longitude_a, latitude_b, longitude_b):
    """Return the great-circle distance between two coordinates in kilometres."""
    lat_a, lon_a, lat_b, lon_b = map(
        math.radians,
        (float(latitude_a), float(longitude_a), float(latitude_b), float(longitude_b)),
    )
    delta_lat = lat_b - lat_a
    delta_lon = lon_b - lon_a
    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat_a) * math.cos(lat_b) * math.sin(delta_lon / 2) ** 2
    )
    return 6371.0088 * 2 * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine))


def _room_bed_status_counts(room):
    counts = getattr(room, "_serialized_bed_status_counts", None)
    if counts is None:
        counts = {
            Bed.BedStatus.AVAILABLE: 0,
            Bed.BedStatus.RESERVED: 0,
            Bed.BedStatus.OCCUPIED: 0,
            Bed.BedStatus.BLOCKED: 0,
        }
        beds = list(room.beds.all())
        for bed in beds:
            counts[bed.status] = counts.get(bed.status, 0) + 1
        counts["total"] = len(beds)
        room._serialized_bed_status_counts = counts
    return counts


def _visible_review_summary(property_obj):
    summary = getattr(property_obj, "_visible_review_summary", None)
    if summary is None:
        aggregate = PropertyReview.objects.filter(
            property_id=property_obj.id,
            status__in=(PropertyReview.Status.PUBLISHED, PropertyReview.Status.PENDING),
        ).aggregate(average=Avg("rating"), count=Count("id"))
        average = aggregate["average"]
        summary = {
            "rating": Decimal(str(average)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if average is not None else None,
            "count": aggregate["count"],
        }
        property_obj._visible_review_summary = summary
    return summary


class AmenitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Amenity
        fields = [
            "id",
            "name",
            "icon",
            "description",
        ]


class PropertyImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PropertyImage
        fields = [
            "id",
            "image",
            "category",
            "caption",
            "is_primary",
            "display_order",
        ]


class RoomImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoomImage
        fields = [
            "id",
            "image",
            "caption",
            "display_order",
        ]
        
class BedImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = BedImage
        fields = [
            "id",
            "image",
            "caption",
            "display_order",
        ]        


class BedSerializer(serializers.ModelSerializer):

    images = BedImageSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = Bed

        fields = [
            "id",
            "bed_number",
            "status",
            "images",
        ]


class RoomSerializer(serializers.ModelSerializer):
    room_type = serializers.CharField(
        source="room_type.name",
        read_only=True,
    )

    beds = BedSerializer(
        many=True,
        read_only=True,
    )

    images = RoomImageSerializer(
        many=True,
        read_only=True,
    )

    available_beds = serializers.SerializerMethodField()
    occupied_beds = serializers.SerializerMethodField()
    reserved_beds = serializers.SerializerMethodField()
    blocked_beds = serializers.SerializerMethodField()
    total_beds = serializers.SerializerMethodField()

    class Meta:
        model = Room

        fields = [
            "id",
            "room_number",
            "room_type",
            "capacity",
            "monthly_price",
            "status",
            "is_accessible",
            "description",
            "available_beds",
            "occupied_beds",
            "reserved_beds",
            "blocked_beds",
            "total_beds",
            "beds",
            "images",
        ]

    def get_available_beds(self, obj):
        return _room_bed_status_counts(obj)[Bed.BedStatus.AVAILABLE]

    def get_occupied_beds(self, obj):
        return _room_bed_status_counts(obj)[Bed.BedStatus.OCCUPIED]

    def get_reserved_beds(self, obj):
        return _room_bed_status_counts(obj)[Bed.BedStatus.RESERVED]

    def get_blocked_beds(self, obj):
        return _room_bed_status_counts(obj)[Bed.BedStatus.BLOCKED]

    def get_total_beds(self, obj):
        return _room_bed_status_counts(obj)["total"]


class PropertySerializer(serializers.ModelSerializer):
    rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    university = serializers.CharField(
        source="campus.university.name",
        read_only=True,
    )

    campus = serializers.CharField(
        source="campus.name",
        read_only=True,
    )

    available_rooms = serializers.SerializerMethodField()

    available_beds = serializers.SerializerMethodField()

    total_rooms = serializers.SerializerMethodField()

    amenities = AmenitySerializer(
        many=True,
        read_only=True,
    )

    images = PropertyImageSerializer(
        many=True,
        read_only=True,
    )

    rooms = serializers.SerializerMethodField()
    campus_id = serializers.IntegerField(source="campus.id", read_only=True)
    campus_latitude = serializers.DecimalField(source="campus.latitude", max_digits=10, decimal_places=7, allow_null=True, read_only=True)
    campus_longitude = serializers.DecimalField(source="campus.longitude", max_digits=10, decimal_places=7, allow_null=True, read_only=True)

    class Meta:
        model = Property

        fields = [
            "id",
            "name",
            "property_type",
            "description",
            "virtual_tour_url",
            "address",
            "latitude",
            "longitude",
            "university",
            "campus",
            "campus_id",
            "campus_latitude",
            "campus_longitude",
            "distance_from_campus_km",
            "walking_minutes",
            "rating",
            "review_count",
            "is_demo",
            "monthly_min_price",
            "monthly_max_price",
            "status",
            "amenities",
            "images",
            "rooms",
            "available_rooms",
            "available_beds",
            "total_rooms",
        ]

    def get_rating(self, obj):
        return _visible_review_summary(obj)["rating"]

    def get_review_count(self, obj):
        return _visible_review_summary(obj)["count"]

    def get_available_rooms(self, obj):
        return Room.objects.filter(
            floor__building__property=obj,
            status=Room.RoomStatus.AVAILABLE,
            beds__status=Bed.BedStatus.AVAILABLE,
        ).distinct().count()

    def get_available_beds(self, obj):
        return Bed.objects.filter(
            room__floor__building__property=obj,
            room__status=Room.RoomStatus.AVAILABLE,
            status=Bed.BedStatus.AVAILABLE,
        ).count()

    def get_total_rooms(self, obj):
        return Room.objects.filter(
            floor__building__property=obj,
        ).count()

    def get_rooms(self, obj):
        rooms = Room.objects.filter(
            floor__building__property=obj,
        ).select_related(
            "room_type",
        ).prefetch_related(
            "beds",
            "images",
        ).order_by("room_number", "id")

        return RoomSerializer(
            rooms,
            many=True,
            context=self.context,
        ).data


class CampusOptionSerializer(serializers.ModelSerializer):
    university = serializers.CharField(source="university.name", read_only=True)

    class Meta:
        model = Campus
        fields = ["id", "name", "university", "address", "latitude", "longitude"]


class RoomTypeOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoomType
        fields = ["id", "name", "description", "default_capacity", "default_monthly_price"]


class ManagementBedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bed
        fields = ["id", "bed_number", "status"]


class ManagementRoomSerializer(serializers.ModelSerializer):
    room_type_name = serializers.CharField(source="room_type.name", read_only=True)
    available_beds = serializers.SerializerMethodField()
    occupied_beds = serializers.SerializerMethodField()
    reserved_beds = serializers.SerializerMethodField()
    blocked_beds = serializers.SerializerMethodField()
    total_beds = serializers.SerializerMethodField()
    beds = ManagementBedSerializer(many=True, read_only=True)
    images = RoomImageSerializer(many=True, read_only=True)

    class Meta:
        model = Room
        fields = [
            "id", "room_number", "room_type", "room_type_name", "capacity",
            "monthly_price", "status", "is_accessible",
            "description", "available_beds", "occupied_beds", "reserved_beds",
            "blocked_beds", "total_beds", "beds", "images",
        ]

    def get_available_beds(self, obj):
        return _room_bed_status_counts(obj)[Bed.BedStatus.AVAILABLE]

    def get_occupied_beds(self, obj):
        return _room_bed_status_counts(obj)[Bed.BedStatus.OCCUPIED]

    def get_reserved_beds(self, obj):
        return _room_bed_status_counts(obj)[Bed.BedStatus.RESERVED]

    def get_blocked_beds(self, obj):
        return _room_bed_status_counts(obj)[Bed.BedStatus.BLOCKED]

    def get_total_beds(self, obj):
        return _room_bed_status_counts(obj)["total"]


class ManagementFloorSerializer(serializers.ModelSerializer):
    rooms = ManagementRoomSerializer(many=True, read_only=True)

    class Meta:
        model = Floor
        fields = ["id", "floor_number", "name", "rooms"]


class ManagementBuildingSerializer(serializers.ModelSerializer):
    floors = ManagementFloorSerializer(many=True, read_only=True)

    class Meta:
        model = Building
        fields = ["id", "name", "description", "number_of_floors", "floors"]


class ManagedPropertySerializer(serializers.ModelSerializer):
    rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    campus_name = serializers.CharField(source="campus.name", read_only=True)
    university_name = serializers.CharField(source="campus.university.name", read_only=True)
    landlord_name = serializers.CharField(source="landlord.get_full_name", read_only=True)
    images = PropertyImageSerializer(many=True, read_only=True)
    amenities = AmenitySerializer(many=True, read_only=True)
    buildings = ManagementBuildingSerializer(many=True, read_only=True)
    total_rooms = serializers.SerializerMethodField()
    total_beds = serializers.SerializerMethodField()
    available_beds = serializers.SerializerMethodField()
    occupied_beds = serializers.SerializerMethodField()
    reserved_beds = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = [
            "id", "landlord_name", "name", "property_type", "description", "address",
            "virtual_tour_url",
            "latitude", "longitude", "campus", "campus_name", "university_name", "distance_from_campus_km",
            "walking_minutes", "rating", "review_count", "monthly_min_price", "monthly_max_price",
            "status", "is_demo", "verification_notes", "approved_at", "amenities", "images",
            "buildings", "total_rooms", "total_beds", "available_beds", "occupied_beds", "reserved_beds",
        ]

    def get_rating(self, obj):
        return _visible_review_summary(obj)["rating"]

    def get_review_count(self, obj):
        return _visible_review_summary(obj)["count"]

    def get_total_rooms(self, obj):
        return Room.objects.filter(floor__building__property=obj).count()

    def get_total_beds(self, obj):
        return Bed.objects.filter(room__floor__building__property=obj).count()

    def get_available_beds(self, obj):
        return Bed.objects.filter(
            room__floor__building__property=obj,
            room__status=Room.RoomStatus.AVAILABLE,
            status=Bed.BedStatus.AVAILABLE,
        ).count()

    def get_occupied_beds(self, obj):
        return Bed.objects.filter(
            room__floor__building__property=obj,
            status=Bed.BedStatus.OCCUPIED,
        ).count()

    def get_reserved_beds(self, obj):
        return Bed.objects.filter(
            room__floor__building__property=obj,
            status=Bed.BedStatus.RESERVED,
        ).count()


class PropertyManagementWriteSerializer(serializers.ModelSerializer):
    latitude = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=-90, max_value=90, allow_null=True, required=False)
    longitude = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=-180, max_value=180, allow_null=True, required=False)
    amenities = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Amenity.objects.all(),
        required=False,
    )

    class Meta:
        model = Property
        fields = [
            "name", "property_type", "description", "virtual_tour_url", "address", "latitude", "longitude", "campus",
            "distance_from_campus_km", "walking_minutes", "monthly_min_price",
            "monthly_max_price", "amenities",
        ]

    def validate_virtual_tour_url(self, value):
        if value and not value.lower().startswith("https://"):
            raise serializers.ValidationError("Virtual tour links must use secure HTTPS.")
        return value

    def validate(self, attrs):
        minimum = attrs.get("monthly_min_price", getattr(self.instance, "monthly_min_price", None))
        maximum = attrs.get("monthly_max_price", getattr(self.instance, "monthly_max_price", None))
        if minimum is not None and maximum is not None and minimum > maximum:
            raise serializers.ValidationError({"monthly_max_price": "Maximum monthly price must be at least the minimum price."})
        latitude = attrs.get("latitude", getattr(self.instance, "latitude", None))
        longitude = attrs.get("longitude", getattr(self.instance, "longitude", None))
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError({"latitude": "Enter both map coordinates or leave both blank."})
        campus = attrs.get("campus", getattr(self.instance, "campus", None))
        if (
            latitude is not None
            and campus is not None
            and campus.latitude is not None
            and campus.longitude is not None
        ):
            distance = _distance_between_coordinates_km(
                latitude,
                longitude,
                campus.latitude,
                campus.longitude,
            )
            attrs["distance_from_campus_km"] = Decimal(str(distance)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        return attrs


class BuildingWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Building
        fields = ["id", "name", "description", "number_of_floors"]
        read_only_fields = ["id"]


class FloorWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Floor
        fields = ["id", "floor_number", "name"]
        read_only_fields = ["id"]


class RoomWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = [
            "id", "room_number", "room_type", "capacity", "monthly_price",
            "status", "is_accessible", "description",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        room_number = attrs.get("room_number", getattr(self.instance, "room_number", ""))
        parent_floor = self.context.get("parent")
        if parent_floor is not None:
            property_id = parent_floor.building.property_id
        else:
            property_id = getattr(self.instance, "property_id", None)

        if property_id and Room.objects.filter(
            property_id=property_id,
            room_number__iexact=room_number.strip(),
        ).exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError({
                "room_number": "Room numbers must be unique within this accommodation."
            })
        return attrs

    def validate_capacity(self, value):
        if self.instance and value < self.instance.beds.count():
            raise serializers.ValidationError("Capacity cannot be less than the number of beds already in this room.")
        return value

    def validate_status(self, value):
        if self.instance and self.instance.status in {Room.RoomStatus.RESERVED, Room.RoomStatus.OCCUPIED} and value != self.instance.status:
            raise serializers.ValidationError("Reserved and occupied room status is controlled by booking activity.")
        if value in {Room.RoomStatus.RESERVED, Room.RoomStatus.OCCUPIED}:
            raise serializers.ValidationError("Reserved and occupied room status is controlled by booking activity.")
        if (
            value == Room.RoomStatus.AVAILABLE
            and self.instance
            and self.instance.beds.exists()
            and not self.instance.beds.filter(status=Bed.BedStatus.AVAILABLE).exists()
        ):
            raise serializers.ValidationError("A room can only be made available when at least one bed is available.")
        return value


class BedWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bed
        fields = ["id", "bed_number", "status"]
        read_only_fields = ["id"]

    def validate_status(self, value):
        if value not in {Bed.BedStatus.AVAILABLE, Bed.BedStatus.BLOCKED}:
            raise serializers.ValidationError("Landlords can make a bed available or block it. Occupancy is updated through bookings.")
        if self.instance and self.instance.status in {Bed.BedStatus.RESERVED, Bed.BedStatus.OCCUPIED}:
            raise serializers.ValidationError("Reserved and occupied bed status is controlled by booking activity.")
        return value


class PropertyImageUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = PropertyImage
        fields = ["id", "image", "category", "caption", "is_primary", "display_order"]
        read_only_fields = ["id"]
