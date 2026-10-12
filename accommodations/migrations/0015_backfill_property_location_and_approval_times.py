import math
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from django.db import migrations


# The seeded listings don't carry street addresses. These campus-relative pins
# are approximate map locations, with radii matching the saved campus distance.
PROPERTY_DETAILS = {
    "Campus View Residence": ("SPU Main Campus", 0.80, 45, 10, "2026-08-04 07:20"),
    "Urban Nest Kimberley": ("SPU Main Campus", 1.60, 140, 21, "2026-08-11 08:45"),
    "Northern Cape Student Village": ("SPU Main Campus", 1.40, 235, 18, "2026-08-17 09:10"),
    "StudyHub Residence": ("SPU Main Campus", 0.95, 325, 12, "2026-08-22 10:35"),
    "Varsity Heights": ("UFS Bloemfontein Campus", 1.10, 30, 14, "2026-08-28 11:50"),
    "Bloem Student Central": ("UFS Bloemfontein Campus", 0.90, 125, 11, "2026-09-02 07:40"),
    "City Edge Apartments": ("UFS Bloemfontein Campus", 2.40, 220, 31, "2026-09-07 12:25"),
    "Free State Student House": ("UFS Bloemfontein Campus", 2.10, 315, 28, "2026-09-12 08:55"),
    "Campus Connect": ("UJ APK Campus", 1.40, 25, 18, "2026-09-17 13:15"),
    "Auckland Park Student Living": ("UJ APK Campus", 1.30, 115, 17, "2026-09-22 09:30"),
    "Metro Student Suites": ("UJ APK Campus", 1.80, 205, 22, "2026-09-27 14:05"),
    "Premier Student Square": ("UJ APK Campus", 0.70, 290, 9, "2026-10-02 10:20"),
}


def destination_point(latitude, longitude, distance_km, bearing_degrees):
    earth_radius_km = 6371.0088
    angular_distance = distance_km / earth_radius_km
    bearing = math.radians(bearing_degrees)
    lat1 = math.radians(float(latitude))
    lon1 = math.radians(float(longitude))

    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular_distance)
        + math.cos(lat1) * math.sin(angular_distance) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat1),
        math.cos(angular_distance) - math.sin(lat1) * math.sin(lat2),
    )
    return round(math.degrees(lat2), 7), round(math.degrees(lon2), 7)


def distance_between(latitude_a, longitude_a, latitude_b, longitude_b):
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


def populate_property_location_and_approval_times(apps, schema_editor):
    Property = apps.get_model("accommodations", "Property")

    for name, details in PROPERTY_DETAILS.items():
        campus_name, desired_distance, bearing, walking_minutes, approved_at = details
        queryset = Property.objects.filter(name=name, campus__name=campus_name).select_related("campus")
        for property_obj in queryset:
            campus = property_obj.campus
            if campus.latitude is None or campus.longitude is None:
                continue

            latitude, longitude = destination_point(
                campus.latitude,
                campus.longitude,
                desired_distance,
                bearing,
            )
            measured_distance = distance_between(
                campus.latitude,
                campus.longitude,
                latitude,
                longitude,
            )
            property_obj.latitude = Decimal(str(latitude))
            property_obj.longitude = Decimal(str(longitude))
            property_obj.distance_from_campus_km = Decimal(str(measured_distance)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            property_obj.walking_minutes = walking_minutes
            if property_obj.status == "APPROVED" and property_obj.approved_at is None:
                property_obj.approved_at = datetime.strptime(
                    approved_at, "%Y-%m-%d %H:%M"
                ).replace(tzinfo=timezone.utc)
            property_obj.save(
                update_fields=[
                    "latitude",
                    "longitude",
                    "distance_from_campus_km",
                    "walking_minutes",
                    "approved_at",
                ]
            )


class Migration(migrations.Migration):
    dependencies = [
        ("accommodations", "0014_merge_review_rating_and_room_gender"),
    ]

    operations = [
        migrations.RunPython(
            populate_property_location_and_approval_times,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
