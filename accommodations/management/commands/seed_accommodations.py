from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import User
from accommodations.models import (
    University,
    Campus,
    Amenity,
    Property,
    Building,
    Floor,
    RoomType,
    Room,
    Bed,
)


class Command(BaseCommand):
    help = "Populate Student Haven with realistic demo accommodation data."

    @transaction.atomic
    def handle(self, *args, **options):

        if not settings.DEBUG:
            raise CommandError("Demo accommodation data can only be seeded while DEBUG is true.")

        self.stdout.write(
            self.style.WARNING(
                "Creating Student Haven accommodation demo data..."
            )
        )

        # ---------------------------------------------------------
        # 1. FIND DEMO LANDLORD
        # ---------------------------------------------------------

        try:
            landlord = User.objects.get(
                email="demo.landlord@studenthaven.local"
            )
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(
                    "Demo landlord not found. Create the landlord first."
                )
            )
            return

        # ---------------------------------------------------------
        # 2. UNIVERSITIES
        # ---------------------------------------------------------

        university_data = [
            {
                "name": "Sol Plaatje University",
                "code": "SPU",
                "city": "Kimberley",
                "province": "Northern Cape",
            },
            {
                "name": "University of the Free State",
                "code": "UFS",
                "city": "Bloemfontein",
                "province": "Free State",
            },
            {
                "name": "University of Johannesburg",
                "code": "UJ",
                "city": "Johannesburg",
                "province": "Gauteng",
            },
        ]

        universities = {}

        for data in university_data:
            university, _ = University.objects.get_or_create(
                code=data["code"],
                defaults=data,
            )
            universities[data["code"]] = university

        # ---------------------------------------------------------
        # 3. CAMPUSES
        # ---------------------------------------------------------

        campus_data = [
            (
                "SPU Main Campus",
                "SPU",
                "Kimberley, Northern Cape",
                -28.7282,
                24.7499,
            ),
            (
                "UFS Bloemfontein Campus",
                "UFS",
                "Bloemfontein, Free State",
                -29.1080,
                26.1950,
            ),
            (
                "UJ APK Campus",
                "UJ",
                "Johannesburg, Gauteng",
                -26.1824,
                28.0012,
            ),
        ]

        campuses = {}

        for name, university_code, address, lat, lng in campus_data:
            campus, _ = Campus.objects.get_or_create(
                university=universities[university_code],
                name=name,
                defaults={
                    "address": address,
                    "latitude": lat,
                    "longitude": lng,
                },
            )
            campuses[name] = campus

        # ---------------------------------------------------------
        # 4. AMENITIES
        # ---------------------------------------------------------

        amenity_names = [
            "High-Speed Wi-Fi",
            "24/7 Security",
            "CCTV",
            "Controlled Access",
            "Laundry",
            "Study Area",
            "Study Rooms",
            "Common Lounge",
            "Swimming Pool",
            "Gym",
            "Parking",
            "Backup Power",
            "Kitchen",
            "Dining Area",
            "TV Lounge",
            "Transport",
            "On-Site Manager",
            "Cleaning Service",
            "Wheelchair Accessible",
            "Outdoor Area",
        ]

        amenities = {}

        for name in amenity_names:
            amenity, _ = Amenity.objects.get_or_create(
                name=name
            )
            amenities[name] = amenity

        # ---------------------------------------------------------
        # 5. ROOM TYPES
        # ---------------------------------------------------------

        room_type_data = [
            {
                "name": "Single Room",
                "default_capacity": 1,
                "default_monthly_price": Decimal("4500.00"),
                "description": "Private room with dedicated study space.",
            },
            {
                "name": "Double Room",
                "default_capacity": 2,
                "default_monthly_price": Decimal("3500.00"),
                "description": "Shared room designed for two students.",
            },
            {
                "name": "Premium Single",
                "default_capacity": 1,
                "default_monthly_price": Decimal("5500.00"),
                "description": "Premium private room with upgraded finishes.",
            },
            {
                "name": "Studio Apartment",
                "default_capacity": 1,
                "default_monthly_price": Decimal("6500.00"),
                "description": "Private studio with kitchenette and bathroom.",
            },
            {
                "name": "Shared Apartment Room",
                "default_capacity": 3,
                "default_monthly_price": Decimal("3000.00"),
                "description": "Affordable shared student accommodation.",
            },
        ]

        room_types = {}

        for data in room_type_data:
            room_type, _ = RoomType.objects.get_or_create(
                name=data["name"],
                defaults=data,
            )
            room_types[data["name"]] = room_type

        # ---------------------------------------------------------
        # 6. PROPERTY DATA
        # ---------------------------------------------------------

        properties = [
            {
                "name": "Campus View Residence",
                "type": Property.PropertyType.STUDENT_RESIDENCE,
                "campus": "SPU Main Campus",
                "distance": Decimal("0.80"),
                "walking": 10,
                "min_price": Decimal("3000.00"),
                "max_price": Decimal("4800.00"),
                "description": "Modern student residence close to campus.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "24/7 Security",
                    "CCTV",
                    "Laundry",
                    "Study Area",
                    "Backup Power",
                    "Parking",
                ],
            },
            {
                "name": "Kimberley Student Lodge",
                "type": Property.PropertyType.STUDENT_RESIDENCE,
                "campus": "SPU Main Campus",
                "distance": Decimal("1.20"),
                "walking": 16,
                "min_price": Decimal("2800.00"),
                "max_price": Decimal("4500.00"),
                "description": "Affordable accommodation with social common spaces.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "24/7 Security",
                    "Common Lounge",
                    "Study Rooms",
                    "Laundry",
                    "Transport",
                ],
            },
            {
                "name": "Urban Nest Kimberley",
                "type": Property.PropertyType.APARTMENT,
                "campus": "SPU Main Campus",
                "distance": Decimal("1.60"),
                "walking": 21,
                "min_price": Decimal("4200.00"),
                "max_price": Decimal("6500.00"),
                "description": "Contemporary student apartments with premium finishes.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "Controlled Access",
                    "Gym",
                    "Laundry",
                    "Backup Power",
                    "Parking",
                ],
            },
            {
                "name": "Student Square",
                "type": Property.PropertyType.STUDENT_RESIDENCE,
                "campus": "SPU Main Campus",
                "distance": Decimal("1.00"),
                "walking": 13,
                "min_price": Decimal("3200.00"),
                "max_price": Decimal("5000.00"),
                "description": "Community-focused residence for students.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "24/7 Security",
                    "Study Area",
                    "Common Lounge",
                    "TV Lounge",
                ],
            },
            {
                "name": "Diamond City Residence",
                "type": Property.PropertyType.STUDENT_RESIDENCE,
                "campus": "SPU Main Campus",
                "distance": Decimal("2.00"),
                "walking": 26,
                "min_price": Decimal("2700.00"),
                "max_price": Decimal("4300.00"),
                "description": "Budget-friendly student accommodation in Kimberley.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "24/7 Security",
                    "Laundry",
                    "Study Area",
                    "Parking",
                ],
            },
            {
                "name": "Northern Cape Student Village",
                "type": Property.PropertyType.UNIVERSITY_RESIDENCE,
                "campus": "SPU Main Campus",
                "distance": Decimal("1.40"),
                "walking": 18,
                "min_price": Decimal("3000.00"),
                "max_price": Decimal("4600.00"),
                "description": "Large residence with extensive student facilities.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "24/7 Security",
                    "Study Rooms",
                    "Dining Area",
                    "Laundry",
                    "Transport",
                    "Backup Power",
                ],
            },
            {
                "name": "The Junction",
                "type": Property.PropertyType.HOUSE,
                "campus": "SPU Main Campus",
                "distance": Decimal("2.30"),
                "walking": 30,
                "min_price": Decimal("2500.00"),
                "max_price": Decimal("3800.00"),
                "description": "Shared student house with a relaxed home environment.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "Kitchen",
                    "Outdoor Area",
                    "Parking",
                    "Laundry",
                ],
            },
            {
                "name": "StudyHub Residence",
                "type": Property.PropertyType.STUDENT_RESIDENCE,
                "campus": "SPU Main Campus",
                "distance": Decimal("0.95"),
                "walking": 12,
                "min_price": Decimal("3600.00"),
                "max_price": Decimal("5200.00"),
                "description": "Designed around study, productivity and student wellbeing.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "Study Rooms",
                    "24/7 Security",
                    "CCTV",
                    "Laundry",
                    "Common Lounge",
                ],
            },
            {
                "name": "Greenview Student Living",
                "type": Property.PropertyType.STUDENT_RESIDENCE,
                "campus": "SPU Main Campus",
                "distance": Decimal("2.70"),
                "walking": 35,
                "min_price": Decimal("2600.00"),
                "max_price": Decimal("4000.00"),
                "description": "Comfortable accommodation with spacious outdoor areas.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "24/7 Security",
                    "Outdoor Area",
                    "Parking",
                    "Laundry",
                ],
            },
            {
                "name": "Varsity Heights",
                "type": Property.PropertyType.APARTMENT,
                "campus": "UFS Bloemfontein Campus",
                "distance": Decimal("1.10"),
                "walking": 14,
                "min_price": Decimal("3900.00"),
                "max_price": Decimal("5900.00"),
                "description": "Modern apartments for university students.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "Controlled Access",
                    "Gym",
                    "Study Area",
                    "Backup Power",
                ],
            },
            {
                "name": "Bloem Student Central",
                "type": Property.PropertyType.STUDENT_RESIDENCE,
                "campus": "UFS Bloemfontein Campus",
                "distance": Decimal("0.90"),
                "walking": 11,
                "min_price": Decimal("3200.00"),
                "max_price": Decimal("4700.00"),
                "description": "Convenient student residence near campus facilities.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "24/7 Security",
                    "Laundry",
                    "Study Rooms",
                    "Transport",
                ],
            },
            {
                "name": "Mangaung Student Village",
                "type": Property.PropertyType.STUDENT_RESIDENCE,
                "campus": "UFS Bloemfontein Campus",
                "distance": Decimal("1.80"),
                "walking": 23,
                "min_price": Decimal("2900.00"),
                "max_price": Decimal("4400.00"),
                "description": "Vibrant residence with shared social spaces.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "Common Lounge",
                    "Study Area",
                    "Laundry",
                    "Parking",
                ],
            },
            {
                "name": "City Edge Apartments",
                "type": Property.PropertyType.APARTMENT,
                "campus": "UFS Bloemfontein Campus",
                "distance": Decimal("2.40"),
                "walking": 31,
                "min_price": Decimal("4300.00"),
                "max_price": Decimal("6800.00"),
                "description": "Premium apartments with modern facilities.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "Gym",
                    "Controlled Access",
                    "Parking",
                    "Backup Power",
                ],
            },
            {
                "name": "Free State Student House",
                "type": Property.PropertyType.HOUSE,
                "campus": "UFS Bloemfontein Campus",
                "distance": Decimal("2.10"),
                "walking": 28,
                "min_price": Decimal("2500.00"),
                "max_price": Decimal("3600.00"),
                "description": "Shared student home with affordable rooms.",
                "amenities": [
                    "Wi-Fi",
                    "Kitchen",
                    "Outdoor Area",
                    "Laundry",
                    "Parking",
                ],
            },
            {
                "name": "Campus Connect",
                "type": Property.PropertyType.STUDENT_RESIDENCE,
                "campus": "UJ APK Campus",
                "distance": Decimal("1.40"),
                "walking": 18,
                "min_price": Decimal("4200.00"),
                "max_price": Decimal("6200.00"),
                "description": "Connected student living close to UJ.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "Study Rooms",
                    "24/7 Security",
                    "CCTV",
                    "Gym",
                ],
            },
            {
                "name": "Auckland Park Student Living",
                "type": Property.PropertyType.APARTMENT,
                "campus": "UJ APK Campus",
                "distance": Decimal("1.30"),
                "walking": 17,
                "min_price": Decimal("4500.00"),
                "max_price": Decimal("7200.00"),
                "description": "Premium apartments for students seeking comfort and convenience.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "Gym",
                    "Swimming Pool",
                    "Controlled Access",
                    "Backup Power",
                    "Parking",
                ],
            },
            {
                "name": "Jozi Student Lodge",
                "type": Property.PropertyType.STUDENT_RESIDENCE,
                "campus": "UJ APK Campus",
                "distance": Decimal("2.20"),
                "walking": 29,
                "min_price": Decimal("3200.00"),
                "max_price": Decimal("5100.00"),
                "description": "Social student residence with practical amenities.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "24/7 Security",
                    "Laundry",
                    "Common Lounge",
                    "Transport",
                ],
            },
            {
                "name": "Metro Student Suites",
                "type": Property.PropertyType.STUDIO,
                "campus": "UJ APK Campus",
                "distance": Decimal("1.80"),
                "walking": 22,
                "min_price": Decimal("5600.00"),
                "max_price": Decimal("7500.00"),
                "description": "Private studio-style accommodation for students.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "Controlled Access",
                    "Gym",
                    "Laundry",
                    "Backup Power",
                    "On-Site Manager",
                ],
            },
            {
                "name": "Braamfontein Student Hub",
                "type": Property.PropertyType.STUDENT_RESIDENCE,
                "campus": "UJ APK Campus",
                "distance": Decimal("1.50"),
                "walking": 20,
                "min_price": Decimal("3400.00"),
                "max_price": Decimal("5200.00"),
                "description": "Central accommodation with easy access to student life.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "24/7 Security",
                    "Study Area",
                    "Laundry",
                    "Transport",
                ],
            },
            {
                "name": "The Scholar House",
                "type": Property.PropertyType.HOUSE,
                "campus": "UJ APK Campus",
                "distance": Decimal("2.60"),
                "walking": 34,
                "min_price": Decimal("2800.00"),
                "max_price": Decimal("4100.00"),
                "description": "Affordable shared house for students.",
                "amenities": [
                    "Wi-Fi",
                    "Kitchen",
                    "Outdoor Area",
                    "Parking",
                    "Laundry",
                ],
            },
            {
                "name": "Premier Student Square",
                "type": Property.PropertyType.STUDENT_RESIDENCE,
                "campus": "UJ APK Campus",
                "distance": Decimal("0.70"),
                "walking": 9,
                "min_price": Decimal("4800.00"),
                "max_price": Decimal("7000.00"),
                "description": "Premium residence located close to campus.",
                "amenities": [
                    "High-Speed Wi-Fi",
                    "24/7 Security",
                    "CCTV",
                    "Gym",
                    "Study Rooms",
                    "Swimming Pool",
                    "Backup Power",
                ],
            },
            {
                "name": "Affordable Campus Rooms",
                "type": Property.PropertyType.STUDENT_RESIDENCE,
                "campus": "SPU Main Campus",
                "distance": Decimal("2.50"),
                "walking": 32,
                "min_price": Decimal("2200.00"),
                "max_price": Decimal("3400.00"),
                "description": "Simple and affordable rooms for budget-conscious students.",
                "amenities": [
                    "Wi-Fi",
                    "24/7 Security",
                    "Laundry",
                    "Kitchen",
                ],
            },
        ]

        # ---------------------------------------------------------
        # 7. CREATE PROPERTIES
        # ---------------------------------------------------------

        created_properties = 0
        created_rooms = 0
        created_beds = 0

        for property_index, data in enumerate(properties, start=1):

            property_obj, created = Property.objects.get_or_create(
                landlord=landlord,
                name=data["name"],
                defaults={
                    "campus": campuses[data["campus"]],
                    "property_type": data["type"],
                    "description": data["description"],
                    "address": data["campus"],
                    "distance_from_campus_km": data["distance"],
                    "walking_minutes": data["walking"],
                    "monthly_min_price": data["min_price"],
                    "monthly_max_price": data["max_price"],
                    "status": Property.PropertyStatus.APPROVED,
                    "is_demo": True,
                },
            )

            property_obj.campus = campuses[data["campus"]]
            property_obj.property_type = data["type"]
            property_obj.description = data["description"]
            property_obj.distance_from_campus_km = data["distance"]
            property_obj.walking_minutes = data["walking"]
            property_obj.monthly_min_price = data["min_price"]
            property_obj.monthly_max_price = data["max_price"]
            property_obj.status = Property.PropertyStatus.APPROVED
            property_obj.is_demo = True
            property_obj.save()

            for amenity_name in data["amenities"]:
                if amenity_name in amenities:
                    property_obj.amenities.add(
                        amenities[amenity_name]
                    )

            if created:
                created_properties += 1

            # -----------------------------------------------------
            # BUILDING
            # -----------------------------------------------------

            building, _ = Building.objects.get_or_create(
                property=property_obj,
                name="Main Building",
                defaults={
                    "number_of_floors": 3
                },
            )

            # -----------------------------------------------------
            # FLOORS + ROOMS + BEDS
            # -----------------------------------------------------

            for floor_number in range(1, 4):

                floor, _ = Floor.objects.get_or_create(
                    building=building,
                    floor_number=floor_number,
                    defaults={
                        "name": f"Floor {floor_number}"
                    },
                )

                # 6 rooms per floor
                for room_number in range(1, 7):

                    room_type_names = list(room_types.keys())

                    room_type_name = room_type_names[
                        (room_number - 1) % len(room_type_names)
                    ]

                    room_type = room_types[room_type_name]

                    sequence_number = (floor_number - 1) * 6 + room_number
                    room_code = f"{property_index}01{sequence_number:02d}"
                    legacy_room_code = (
                        f"{property_index}"
                        f"{floor_number:02d}"
                        f"{room_number:02d}"
                    )
                    room_defaults = {
                        "room_type": room_type,
                        "capacity": room_type.default_capacity,
                        "monthly_price": room_type.default_monthly_price,
                        "status": Room.RoomStatus.AVAILABLE,
                        "is_accessible": room_number == 1,
                        "description": f"{room_type.name} at {property_obj.name}.",
                    }

                    room = Room.objects.filter(
                        floor=floor,
                        room_number=room_code,
                    ).first()
                    if room is None:
                        room = Room.objects.filter(
                            floor=floor,
                            room_number=legacy_room_code,
                        ).first()
                    if room is None:
                        room = Room.objects.create(
                            floor=floor,
                            room_number=room_code,
                            **room_defaults,
                        )
                        room_created = True
                    else:
                        room_created = False
                        if room.room_number != room_code:
                            room.room_number = room_code
                            room.save(update_fields=["room_number"])

                    if room_created:
                        created_rooms += 1

                    # -------------------------------------------------
                    # BEDS
                    # -------------------------------------------------

                    for bed_number in range(
                        1,
                        room.capacity + 1,
                    ):

                        bed, bed_created = Bed.objects.get_or_create(
                            room=room,
                            bed_number=f"BED-{bed_number}",
                            defaults={
                                "status": Bed.BedStatus.AVAILABLE
                            },
                        )

                        if bed_created:
                            created_beds += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Created/updated properties: {len(properties)}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"New properties created: {created_properties}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"New rooms created: {created_rooms}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"New beds created: {created_beds}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Student Haven accommodation seed completed successfully."
            )
        )
