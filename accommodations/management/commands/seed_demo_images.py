from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from accommodations.models import Bed, BedImage, Property, PropertyImage, Room, RoomImage


FAMILY_COUNT = 22
THREE_BEDROOM_FAMILY = 1
MANAGED_CAPTION_PREFIX = "Student Haven demo image:"
LEGACY_CAPTION_PREFIX = "Temporary Pexels"

ACCOMMODATION_CATEGORIES = [
    "ACCOMMODATION", "ACCOMMODATION", "EXTERIOR", "EXTERIOR", "EXTERIOR", "EXTERIOR",
    "EXTERIOR", "EXTERIOR", "ACCOMMODATION", "ACCOMMODATION", "ACCOMMODATION",
    "ACCOMMODATION", "ACCOMMODATION", "ACCOMMODATION", "ACCOMMODATION", "ACCOMMODATION",
    "ACCOMMODATION", "ACCOMMODATION", "ACCOMMODATION", "ACCOMMODATION", "ACCOMMODATION",
    "ACCOMMODATION",
]

ACCOMMODATION_CAPTIONS = [
    "Three-bedroom shared student residence",
    "Student room with bed and study desk",
    "Student residence apartments",
    "University student housing building",
    "Modern brick apartment building",
    "Contemporary student residence buildings",
    "Modern accommodation building",
    "University residence exterior",
    "Student accommodation interior",
    "Student accommodation interior",
    "Student residence interior",
    "Student residence interior",
    "Student residence interior",
    "Student residence interior",
    "Student residence interior",
    "Student residence interior",
    "Student residence interior",
    "Student residence interior",
    "Student residence interior",
    "Student residence interior",
    "Student residence interior",
    "Student residence interior",
]

FACILITY_CATEGORIES = [
    "STUDY", "STUDY", "STUDY", "STUDY", "STUDY", "STUDY", "STUDY", "STUDY",
    "KITCHEN", "KITCHEN", "DINING", "KITCHEN", "KITCHEN", "KITCHEN", "KITCHEN",
    "KITCHEN", "DINING", "KITCHEN", "KITCHEN", "KITCHEN", "KITCHEN", "KITCHEN",
]

FACILITY_CAPTIONS = [
    "Shared library and study tables",
    "Student computer study room",
    "Study desk and computer",
    "Residence bookshelf and study corner",
    "Residence library shelving",
    "Student desk and study area",
    "Quiet study room",
    "Student study workspace",
    "Shared residence kitchen",
    "Shared residence kitchen",
    "Shared kitchen and dining area",
    "Shared residence kitchen",
    "Communal cooking facilities",
    "Shared residence kitchen",
    "Residence kitchen interior",
    "Shared residence kitchen",
    "Shared dining space",
    "Shared residence kitchen",
    "Shared residence kitchen",
    "Shared residence kitchen",
    "Shared residence kitchen",
    "Shared residence kitchen",
]


def image_path(family_number, suffix):
    return f"properties/interiors/property-{family_number}-{suffix}.jpg"


def room_image_paths(family_number):
    if family_number == THREE_BEDROOM_FAMILY:
        return [
            image_path(family_number, "room-detail"),
            image_path(family_number, "room-detail-2"),
            image_path(family_number, "room-detail-3"),
        ]
    return [image_path(family_number, "room-detail")]


class Command(BaseCommand):
    help = "Assign local accommodation-related stock photos to demo listings only."

    @transaction.atomic
    def handle(self, *args, **options):
        properties = list(Property.objects.filter(is_demo=True).order_by("id"))
        if not properties:
            self.stdout.write(self.style.WARNING("No demo properties found; no images were changed."))
            return

        rooms = list(
            Room.objects.filter(floor__building__property__is_demo=True)
            .select_related("floor__building__property", "room_type")
            .order_by("floor__building__property_id", "floor__floor_number", "id")
        )
        beds = list(
            Bed.objects.filter(room__floor__building__property__is_demo=True)
            .select_related("room__floor__building__property")
            .order_by("room__floor__building__property_id", "room_id", "id")
        )

        if not (
            len(ACCOMMODATION_CATEGORIES)
            == len(ACCOMMODATION_CAPTIONS)
            == len(FACILITY_CATEGORIES)
            == len(FACILITY_CAPTIONS)
            == FAMILY_COUNT
        ):
            raise RuntimeError("The demo image catalogue must contain 22 complete image families.")

        property_family = {
            property_obj.id: (index % FAMILY_COUNT) + 1
            for index, property_obj in enumerate(properties)
        }

        required_paths = set()
        for family_number in property_family.values():
            required_paths.add(image_path(family_number, "accommodation"))
            required_paths.add(image_path(family_number, "facility"))
            required_paths.update(room_image_paths(family_number))

        missing_files = [
            str(Path(settings.MEDIA_ROOT) / relative_path)
            for relative_path in sorted(required_paths)
            if not (Path(settings.MEDIA_ROOT) / relative_path).is_file()
        ]
        if missing_files:
            raise RuntimeError("Missing local demo image files:\n" + "\n".join(missing_files))

        demo_property_ids = [property_obj.id for property_obj in properties]
        demo_rooms = Room.objects.filter(floor__building__property_id__in=demo_property_ids)
        demo_beds = Bed.objects.filter(room__in=demo_rooms)
        managed_captions = Q(caption__startswith=LEGACY_CAPTION_PREFIX) | Q(
            caption__startswith=MANAGED_CAPTION_PREFIX
        )

        # Retire only records created by this demo-image command. Landlord image
        # uploads and every image attached to a non-demo listing are preserved.
        PropertyImage.objects.filter(property_id__in=demo_property_ids).filter(managed_captions).delete()
        RoomImage.objects.filter(room__in=demo_rooms).filter(managed_captions).delete()
        BedImage.objects.filter(bed__in=demo_beds).filter(managed_captions).delete()

        for property_obj in properties:
            family_number = property_family[property_obj.id]
            cover_path = image_path(family_number, "accommodation")
            room_paths = room_image_paths(family_number)
            facility_path = image_path(family_number, "facility")

            PropertyImage.objects.create(
                property=property_obj,
                image=cover_path,
                category=ACCOMMODATION_CATEGORIES[family_number - 1],
                caption=f"{MANAGED_CAPTION_PREFIX} {ACCOMMODATION_CAPTIONS[family_number - 1]}",
                is_primary=True,
                display_order=0,
            )
            for order, room_path in enumerate(room_paths, start=1):
                room_caption = (
                    f"Bedroom {order} in the shared three-bedroom residence"
                    if family_number == THREE_BEDROOM_FAMILY
                    else "Bedroom interior with student study space"
                )
                PropertyImage.objects.create(
                    property=property_obj,
                    image=room_path,
                    category="ROOM",
                    caption=f"{MANAGED_CAPTION_PREFIX} {room_caption}",
                    is_primary=False,
                    display_order=order,
                )
            PropertyImage.objects.create(
                property=property_obj,
                image=facility_path,
                category=FACILITY_CATEGORIES[family_number - 1],
                caption=f"{MANAGED_CAPTION_PREFIX} {FACILITY_CAPTIONS[family_number - 1]}",
                is_primary=False,
                display_order=len(room_paths) + 1,
            )

        for room in rooms:
            property_obj = room.floor.building.property
            family_number = property_family[property_obj.id]
            room_paths = room_image_paths(family_number)
            for order, room_path in enumerate(room_paths):
                room_caption = (
                    f"Bedroom {order + 1} in the shared three-bedroom residence"
                    if family_number == THREE_BEDROOM_FAMILY
                    else "Bedroom interior with student study space"
                )
                RoomImage.objects.create(
                    room=room,
                    image=room_path,
                    caption=f"{MANAGED_CAPTION_PREFIX} {room_caption}",
                    display_order=order,
                )

        for bed in beds:
            property_obj = bed.room.floor.building.property
            family_number = property_family[property_obj.id]
            bed_path = room_image_paths(family_number)[0]
            BedImage.objects.create(
                bed=bed,
                image=bed_path,
                caption=f"{MANAGED_CAPTION_PREFIX} Bed in student accommodation",
                display_order=0,
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Assigned local image families to {len(properties)} demo properties, "
                f"{len(rooms)} rooms and {len(beds)} beds."
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                "The first demo residence has a coordinated three-bedroom gallery; "
                "non-demo properties and landlord uploads were preserved."
            )
        )
