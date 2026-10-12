from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError


class University(models.Model):
    name = models.CharField(max_length=200, unique=True)
    code = models.CharField(max_length=20, unique=True)
    website = models.URLField(blank=True)
    city = models.CharField(max_length=100)
    province = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.code})"


class Campus(models.Model):
    university = models.ForeignKey(
        University,
        on_delete=models.CASCADE,
        related_name="campuses",
    )
    name = models.CharField(max_length=200)
    address = models.TextField()
    latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
    )
    longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"{self.university.name} - {self.name}"


class Amenity(models.Model):
    name = models.CharField(max_length=100, unique=True)
    icon = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Property(models.Model):

    class PropertyStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING = "PENDING", "Pending Verification"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        SUSPENDED = "SUSPENDED", "Suspended"

    class PropertyType(models.TextChoices):
        STUDENT_RESIDENCE = "STUDENT_RESIDENCE", "Student Residence"
        APARTMENT = "APARTMENT", "Student Apartment"
        HOUSE = "HOUSE", "Shared Student House"
        STUDIO = "STUDIO", "Studio"
        UNIVERSITY_RESIDENCE = "UNIVERSITY_RESIDENCE", "University Residence"

    landlord = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="properties",
        limit_choices_to={"role": "LANDLORD"},
    )

    campus = models.ForeignKey(
        Campus,
        on_delete=models.PROTECT,
        related_name="properties",
    )

    name = models.CharField(max_length=200)

    property_type = models.CharField(
        max_length=40,
        choices=PropertyType.choices,
    )

    description = models.TextField()

    virtual_tour_url = models.URLField(max_length=500, blank=True, default="")

    address = models.TextField()

    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)

    distance_from_campus_km = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
    )

    walking_minutes = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    rating = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0,
    )

    monthly_min_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )

    monthly_max_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )

    amenities = models.ManyToManyField(
        Amenity,
        blank=True,
        related_name="properties",
    )

    status = models.CharField(
        max_length=30,
        choices=PropertyStatus.choices,
        default=PropertyStatus.DRAFT,
    )

    is_demo = models.BooleanField(default=False, db_index=True)

    verification_notes = models.TextField(blank=True)

    approved_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class StudentFavoriteProperty(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorite_properties",
        limit_choices_to={"role": "STUDENT"},
    )
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="student_favorites",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["student", "property"], name="accom_student_favorite_unique"),
        ]

    def __str__(self):
        return f"{self.student_id} saved {self.property_id}"


class Building(models.Model):
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="buildings",
    )

    name = models.CharField(max_length=100)

    description = models.TextField(blank=True)

    number_of_floors = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.property.name} - {self.name}"


class Floor(models.Model):
    building = models.ForeignKey(
        Building,
        on_delete=models.CASCADE,
        related_name="floors",
    )

    floor_number = models.IntegerField()

    name = models.CharField(
        max_length=100,
        blank=True,
    )

    def __str__(self):
        return f"{self.building.name} - Floor {self.floor_number}"


class RoomType(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    default_capacity = models.PositiveIntegerField(default=1)

    default_monthly_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )

    def __str__(self):
        return self.name


class Room(models.Model):

    class RoomStatus(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Available"
        RESERVED = "RESERVED", "Reserved"
        OCCUPIED = "OCCUPIED", "Occupied"
        MAINTENANCE = "MAINTENANCE", "Under Maintenance"
        BLOCKED = "BLOCKED", "Blocked"
        CLEANING = "CLEANING", "Cleaning"
        UNAVAILABLE = "UNAVAILABLE", "Unavailable"

    floor = models.ForeignKey(
        Floor,
        on_delete=models.CASCADE,
        related_name="rooms",
    )

    # Stored on Room so the database can enforce room-number uniqueness across
    # every building and floor that belongs to the same accommodation.
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="rooms",
        editable=False,
    )

    room_type = models.ForeignKey(
        RoomType,
        on_delete=models.PROTECT,
        related_name="rooms",
    )

    room_number = models.CharField(
        max_length=50,
        help_text="Must be unique within this accommodation.",
    )

    capacity = models.PositiveIntegerField(default=1)

    monthly_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    status = models.CharField(
        max_length=30,
        choices=RoomStatus.choices,
        default=RoomStatus.AVAILABLE,
    )

    is_accessible = models.BooleanField(default=False)

    description = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["property", "room_number"],
                name="room_property_number_unique",
            ),
        ]

    def clean(self):
        super().clean()
        if not self.floor_id or not self.room_number:
            return

        property_id = Floor.objects.filter(pk=self.floor_id).values_list(
            "building__property_id", flat=True
        ).first()
        if property_id is None:
            return

        duplicates = Room.objects.filter(
            property_id=property_id,
            room_number__iexact=self.room_number.strip(),
        ).exclude(pk=self.pk)
        if duplicates.exists():
            raise ValidationError({
                "room_number": "Room numbers must be unique within an accommodation."
            })

    def save(self, *args, **kwargs):
        if self.room_number:
            normalized_room_number = self.room_number.strip()
            if normalized_room_number != self.room_number:
                self.room_number = normalized_room_number
                if kwargs.get("update_fields") is not None:
                    kwargs["update_fields"] = set(kwargs["update_fields"]) | {"room_number"}
        property_id = Floor.objects.filter(pk=self.floor_id).values_list(
            "building__property_id", flat=True
        ).first()
        if property_id is not None and self.property_id != property_id:
            self.property_id = property_id
            if kwargs.get("update_fields") is not None:
                kwargs["update_fields"] = set(kwargs["update_fields"]) | {"property"}
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.floor.building.property.name} - Room {self.room_number}"


class Bed(models.Model):

    class BedStatus(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Available"
        RESERVED = "RESERVED", "Reserved"
        OCCUPIED = "OCCUPIED", "Occupied"
        BLOCKED = "BLOCKED", "Blocked"

    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="beds",
    )

    bed_number = models.CharField(max_length=50)

    status = models.CharField(
        max_length=30,
        choices=BedStatus.choices,
        default=BedStatus.AVAILABLE,
    )

    current_student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="current_beds",
        limit_choices_to={"role": "STUDENT"},
    )

    def __str__(self):
        return f"Room {self.room.room_number} - Bed {self.bed_number}"
    
class BedImage(models.Model):

    bed = models.ForeignKey(
        Bed,
        on_delete=models.CASCADE,
        related_name="images",
    )

    image = models.ImageField(
        upload_to="beds/",
    )

    caption = models.CharField(
        max_length=255,
        blank=True,
    )

    display_order = models.PositiveIntegerField(
        default=0,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def __str__(self):
        return f"{self.bed} - Image"    


class PropertyImage(models.Model):

    class ImageCategory(models.TextChoices):
        ACCOMMODATION = "ACCOMMODATION", "Accommodation"
        EXTERIOR = "EXTERIOR", "Exterior"
        ENTRANCE = "ENTRANCE", "Entrance"
        RECEPTION = "RECEPTION", "Reception"
        CORRIDOR = "CORRIDOR", "Corridor"
        ROOM = "ROOM", "Room"
        KITCHEN = "KITCHEN", "Kitchen"
        DINING = "DINING", "Dining"
        BATHROOM = "BATHROOM", "Bathroom"
        LAUNDRY = "LAUNDRY", "Laundry"
        STUDY = "STUDY", "Study Area"
        LOUNGE = "LOUNGE", "Lounge"
        OUTDOOR = "OUTDOOR", "Outdoor"
        SECURITY = "SECURITY", "Security"
        PARKING = "PARKING", "Parking"
        RECREATION = "RECREATION", "Recreation"
        SURROUNDINGS = "SURROUNDINGS", "Surroundings"
        OTHER = "OTHER", "Other"

    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="images",
    )

    image = models.ImageField(
        upload_to="properties/",
    )

    category = models.CharField(
        max_length=30,
        choices=ImageCategory.choices,
        default=ImageCategory.OTHER,
    )

    caption = models.CharField(
        max_length=255,
        blank=True,
    )

    is_primary = models.BooleanField(default=False)

    display_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.property.name} - {self.category}"


class PropertyReview(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending moderation"
        PUBLISHED = "PUBLISHED", "Published"
        REJECTED = "REJECTED", "Not published"

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name="reviews")
    booking = models.OneToOneField("bookings.Booking", on_delete=models.PROTECT, related_name="property_review")
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="property_reviews")
    rating = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=120)
    body = models.TextField(max_length=2500)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PUBLISHED)
    moderation_note = models.TextField(blank=True, default="")
    moderated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moderated_property_reviews",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    moderated_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["property", "status", "created_at"], name="property_review_pub_idx")]
        constraints = [
            models.CheckConstraint(condition=models.Q(rating__gte=1, rating__lte=5), name="accommodation_review_rating_range"),
        ]

    def __str__(self):
        return f"{self.property.name} — {self.rating}/5 ({self.status})"


class RoomImage(models.Model):
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="images",
    )

    image = models.ImageField(
        upload_to="rooms/",
    )

    caption = models.CharField(
        max_length=255,
        blank=True,
    )

    display_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.room} - Image"
