from django.db import transaction
from django.db.models import Q
from decimal import Decimal, InvalidOperation
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from analytics.services import record_audit_event
from notifications.services import create_notification
from .availability import sync_room_status
from .models import (
    Amenity,
    Bed,
    Building,
    Campus,
    Floor,
    Property,
    PropertyImage,
    Room,
    RoomType,
    StudentFavoriteProperty,
)
from .serializers import (
    BedWriteSerializer,
    BuildingWriteSerializer,
    CampusOptionSerializer,
    FloorWriteSerializer,
    ManagedPropertySerializer,
    PropertyImageUploadSerializer,
    PropertyManagementWriteSerializer,
    PropertySerializer,
    RoomTypeOptionSerializer,
    RoomWriteSerializer,
)


def _role_error(request, role):
    if request.user.role != role:
        return Response(
            {"success": False, "message": "You do not have permission to manage accommodation."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _managed_property_queryset():
    return Property.objects.select_related(
        "landlord", "campus", "campus__university"
    ).prefetch_related(
        "amenities", "images", "buildings__floors__rooms__room_type",
        "buildings__floors__rooms__beds", "buildings__floors__rooms__images",
    )


class PropertyListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):

        properties = (
            Property.objects
            .filter(status="APPROVED")
            .select_related(
                "campus",
                "campus__university",
            )
            .prefetch_related(
             "amenities",
             "images",
             "buildings__floors__rooms__beds",
             "buildings__floors__rooms__images",
            )
            .distinct()
        )

        # -------------------------
        # SEARCH
        # -------------------------

        search = request.GET.get("search", "").strip()

        if search:
            properties = properties.filter(
                Q(name__icontains=search)
                | Q(address__icontains=search)
                | Q(campus__name__icontains=search)
                | Q(campus__university__name__icontains=search)
            )

        # -------------------------
        # UNIVERSITY
        # -------------------------

        university = request.GET.get(
            "university",
            "",
        ).strip()

        if university:
            properties = properties.filter(
                campus__university__name__iexact=university
            )

        # -------------------------
        # PROPERTY TYPE
        # -------------------------

        property_type = request.GET.get(
            "property_type",
            "",
        ).strip()

        if property_type:
            properties = properties.filter(
                property_type=property_type
            )

        # -------------------------
        # MAX PRICE
        # -------------------------

        max_price = request.GET.get(
            "max_price",
            "",
        ).strip()

        if max_price:
            try:
                properties = properties.filter(
                    monthly_min_price__lte=float(max_price)
                )
            except ValueError:
                pass

        # -------------------------
        # SORT
        # -------------------------

        sort = request.GET.get(
            "sort",
            "recommended",
        )

        if sort == "price_low":
            properties = properties.order_by(
                "monthly_min_price"
            )

        elif sort == "price_high":
            properties = properties.order_by(
                "-monthly_min_price"
            )

        elif sort == "rating":
            properties = properties.order_by(
                "-rating"
            )

        elif sort == "closest":
            properties = properties.order_by(
                "distance_from_campus_km"
            )

        else:
            properties = properties.order_by(
                "-rating",
                "monthly_min_price",
            )

        serializer = PropertySerializer(
            properties,
            many=True,
            context={"request": request},
      )

        return Response({
            "success": True,
            "count": len(serializer.data),
            "properties": serializer.data,
        })


class PropertyDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, property_id):

        try:
            property_obj = (
                Property.objects
                .filter(
                    id=property_id,
                    status="APPROVED",
                )
                .select_related(
                    "campus",
                    "campus__university",
                )
                .prefetch_related(
                   "amenities",
                   "images",
                   "buildings__floors__rooms__beds",
                   "buildings__floors__rooms__images",
                )
                .get()
            )

        except Property.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Accommodation property not found."
                    ),
                },
                status=404,
            )

        serializer = PropertySerializer(
            property_obj,
            context={"request": request},
        )

        return Response({
            "success": True,
            "property": serializer.data,
        })


class StudentFavoritePropertiesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.STUDENT:
            return Response({"success": False, "message": "Student access is required to view saved properties."}, status=status.HTTP_403_FORBIDDEN)
        favorites = StudentFavoriteProperty.objects.filter(
            student=request.user,
            property__status=Property.PropertyStatus.APPROVED,
        ).select_related("property__campus", "property__campus__university").prefetch_related(
            "property__amenities", "property__images", "property__buildings__floors__rooms__beds", "property__buildings__floors__rooms__images",
        )
        data = PropertySerializer([entry.property for entry in favorites], many=True, context={"request": request}).data
        return Response({"success": True, "count": len(data), "properties": data})


class StudentFavoritePropertyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, property_id):
        if request.user.role != User.Role.STUDENT:
            return Response({"success": False, "message": "Student access is required to save a property."}, status=status.HTTP_403_FORBIDDEN)
        property_obj = get_object_or_404(Property.objects, id=property_id, status=Property.PropertyStatus.APPROVED)
        _, created = StudentFavoriteProperty.objects.get_or_create(student=request.user, property=property_obj)
        return Response({"success": True, "is_favorite": True, "created": created})

    def delete(self, request, property_id):
        if request.user.role != User.Role.STUDENT:
            return Response({"success": False, "message": "Student access is required to manage saved properties."}, status=status.HTTP_403_FORBIDDEN)
        StudentFavoriteProperty.objects.filter(student=request.user, property_id=property_id).delete()
        return Response({"success": True, "is_favorite": False})


class AccommodationRecommendationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.STUDENT:
            return Response({"success": False, "message": "Student access is required for personalized recommendations."}, status=status.HTTP_403_FORBIDDEN)

        budget_value = request.query_params.get("budget", "").strip()
        distance_value = request.query_params.get("distance_km", "").strip()
        try:
            budget = Decimal(budget_value) if budget_value else None
            if budget is not None and (not budget.is_finite() or budget <= 0):
                raise InvalidOperation
        except (InvalidOperation, ValueError):
            return Response({"success": False, "message": "Enter a valid monthly budget."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            max_distance = Decimal(distance_value) if distance_value else None
            if max_distance is not None and (not max_distance.is_finite() or max_distance <= 0):
                raise InvalidOperation
        except (InvalidOperation, ValueError):
            return Response({"success": False, "message": "Enter a valid maximum distance."}, status=status.HTTP_400_BAD_REQUEST)

        room_type = request.query_params.get("room_type", "").strip()
        accessible = request.query_params.get("accessible", "false").lower() in {"true", "1", "yes"}
        profile = getattr(request.user, "student_profile", None)
        expected_campus = profile.campus.strip().casefold() if profile else ""
        expected_university = profile.university.strip().casefold() if profile else ""
        properties = Property.objects.filter(status=Property.PropertyStatus.APPROVED).select_related("campus__university").prefetch_related("amenities", "images").order_by("-rating", "monthly_min_price")
        results = []

        for property_obj in properties:
            available_rooms = Room.objects.filter(
                floor__building__property=property_obj,
                status=Room.RoomStatus.AVAILABLE,
                beds__status=Bed.BedStatus.AVAILABLE,
            ).select_related("room_type").distinct()
            available_beds = Bed.objects.filter(
                room__floor__building__property=property_obj,
                room__status=Room.RoomStatus.AVAILABLE,
                status=Bed.BedStatus.AVAILABLE,
            ).count()
            if not available_beds:
                continue

            earned = 25
            possible = 25
            reasons = [f"{available_beds} bed{'s' if available_beds != 1 else ''} currently available"]
            considerations = []

            if budget is not None:
                possible += 25
                if property_obj.monthly_min_price is not None and property_obj.monthly_min_price <= budget:
                    earned += 25
                    reasons.append(f"Listed from R{property_obj.monthly_min_price:,.0f}, within your R{budget:,.0f} budget")
                else:
                    considerations.append("Starting price is above your budget or has not been listed")

            if room_type:
                possible += 20
                if available_rooms.filter(room_type__name__icontains=room_type).exists():
                    earned += 20
                    reasons.append(f"Available rooms match your {room_type} preference")
                else:
                    considerations.append(f"No available {room_type} room was found")

            if accessible:
                possible += 10
                if available_rooms.filter(is_accessible=True).exists():
                    earned += 10
                    reasons.append("An accessible room is available")
                else:
                    considerations.append("No accessible room is currently available")

            if max_distance is not None:
                possible += 10
                if property_obj.distance_from_campus_km is not None and property_obj.distance_from_campus_km <= max_distance:
                    earned += 10
                    reasons.append(f"{property_obj.distance_from_campus_km} km from campus, within your limit")
                elif property_obj.distance_from_campus_km is None:
                    considerations.append("Campus distance has not been confirmed")
                else:
                    considerations.append("Campus distance is beyond your selected limit")

            campus_name = property_obj.campus.name.strip().casefold()
            university_name = property_obj.campus.university.name.strip().casefold()
            if expected_campus or expected_university:
                possible += 10
                if expected_campus and campus_name == expected_campus:
                    earned += 10
                    reasons.append("Located at your selected campus")
                elif expected_university and university_name == expected_university:
                    earned += 5
                    reasons.append("Located at your university")
                else:
                    considerations.append("Campus differs from your student profile")

            serialized_property = PropertySerializer(property_obj, context={"request": request}).data
            results.append({
                "property": serialized_property,
                "match_score": round(earned * 100 / possible),
                "reasons": reasons[:4],
                "considerations": considerations,
            })

        results.sort(key=lambda item: -item["match_score"])
        return Response({"success": True, "count": len(results), "recommendations": results[:30]})


class AccommodationManagementOptionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        role_error = _role_error(request, User.Role.LANDLORD)
        if role_error:
            return role_error
        return Response({
            "success": True,
            "campuses": CampusOptionSerializer(
                Campus.objects.select_related("university").order_by("university__name", "name"),
                many=True,
            ).data,
            "room_types": RoomTypeOptionSerializer(RoomType.objects.order_by("name"), many=True).data,
            "amenities": list(Amenity.objects.order_by("name").values("id", "name")),
            "property_types": [
                {"value": value, "label": label}
                for value, label in Property.PropertyType.choices
            ],
            "property_statuses": [
                {"value": value, "label": label}
                for value, label in Property.PropertyStatus.choices
            ],
        })


class LandlordPropertyListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        role_error = _role_error(request, User.Role.LANDLORD)
        if role_error:
            return role_error
        properties = _managed_property_queryset().filter(landlord=request.user).order_by("-updated_at")
        return Response({
            "success": True,
            "properties": ManagedPropertySerializer(properties, many=True, context={"request": request}).data,
        })

    def post(self, request):
        role_error = _role_error(request, User.Role.LANDLORD)
        if role_error:
            return role_error
        serializer = PropertyManagementWriteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        property_obj = serializer.save(landlord=request.user, status=Property.PropertyStatus.DRAFT)
        return Response({
            "success": True,
            "message": "Property draft created. Add its rooms, beds and photos before submitting for review.",
            "property": ManagedPropertySerializer(property_obj, context={"request": request}).data,
        }, status=status.HTTP_201_CREATED)


class LandlordPropertyDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_property(self, request, property_id):
        role_error = _role_error(request, User.Role.LANDLORD)
        if role_error:
            return None, role_error
        property_obj = get_object_or_404(_managed_property_queryset(), id=property_id, landlord=request.user)
        return property_obj, None

    def get(self, request, property_id):
        property_obj, error = self.get_property(request, property_id)
        if error:
            return error
        return Response({"success": True, "property": ManagedPropertySerializer(property_obj, context={"request": request}).data})

    def patch(self, request, property_id):
        property_obj, error = self.get_property(request, property_id)
        if error:
            return error
        serializer = PropertyManagementWriteSerializer(property_obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        changed = any(
            getattr(property_obj, field) != value
            for field, value in serializer.validated_data.items()
            if field != "amenities"
        )
        if "amenities" in serializer.validated_data:
            current_amenities = set(property_obj.amenities.values_list("id", flat=True))
            updated_amenities = {amenity.id for amenity in serializer.validated_data["amenities"]}
            changed = changed or current_amenities != updated_amenities
        save_kwargs = {}
        if changed:
            save_kwargs = {
                "status": Property.PropertyStatus.DRAFT,
                "verification_notes": "",
                "approved_at": None,
            }
        property_obj = serializer.save(**save_kwargs)
        return Response({
            "success": True,
            "message": "Property details updated. Submit the changed listing for approval when ready." if changed else "Property details saved.",
            "property": ManagedPropertySerializer(property_obj, context={"request": request}).data,
        })


class LandlordPropertySubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, property_id):
        role_error = _role_error(request, User.Role.LANDLORD)
        if role_error:
            return role_error
        property_obj = get_object_or_404(Property, id=property_id, landlord=request.user)
        landlord_profile = getattr(request.user, "landlord_profile", None)
        if not landlord_profile or landlord_profile.verification_status != "VERIFIED":
            return Response({
                "success": False,
                "message": "Your landlord profile must be verified before a property can be submitted for approval.",
            }, status=status.HTTP_403_FORBIDDEN)
        missing = []
        if not property_obj.name.strip():
            missing.append("property name")
        if not property_obj.description.strip():
            missing.append("description")
        if not property_obj.address.strip():
            missing.append("address")
        if not property_obj.images.exists():
            missing.append("at least one property photo")
        if not property_obj.buildings.filter(floors__rooms__beds__isnull=False).exists():
            missing.append("at least one bed in a room")
        if missing:
            return Response({
                "success": False,
                "message": "Complete these items before submitting: " + ", ".join(missing) + ".",
                "missing": missing,
            }, status=status.HTTP_400_BAD_REQUEST)
        if property_obj.status == Property.PropertyStatus.PENDING:
            return Response({"success": False, "message": "This property is already waiting for administrator review."}, status=status.HTTP_409_CONFLICT)
        property_obj.status = Property.PropertyStatus.PENDING
        property_obj.verification_notes = ""
        property_obj.approved_at = None
        property_obj.save(update_fields=["status", "verification_notes", "approved_at", "updated_at"])
        return Response({
            "success": True,
            "message": "Property submitted. An administrator will review the listing and its accommodation details.",
            "property": ManagedPropertySerializer(property_obj, context={"request": request}).data,
        })


class LandlordPropertyImageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, property_id):
        role_error = _role_error(request, User.Role.LANDLORD)
        if role_error:
            return role_error
        property_obj = get_object_or_404(Property, id=property_id, landlord=request.user)
        serializer = PropertyImageUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            if serializer.validated_data.get("is_primary"):
                property_obj.images.update(is_primary=False)
            image = serializer.save(property=property_obj)
            if property_obj.status in {Property.PropertyStatus.APPROVED, Property.PropertyStatus.PENDING}:
                property_obj.status = Property.PropertyStatus.DRAFT
                property_obj.verification_notes = ""
                property_obj.approved_at = None
                property_obj.save(update_fields=["status", "verification_notes", "approved_at", "updated_at"])
        return Response({
            "success": True,
            "message": "Photo uploaded.",
            "image": serializer.__class__(image, context={"request": request}).data,
            "status": property_obj.status,
        }, status=status.HTTP_201_CREATED)

    def delete(self, request, property_id, image_id):
        role_error = _role_error(request, User.Role.LANDLORD)
        if role_error:
            return role_error
        property_obj = get_object_or_404(Property, id=property_id, landlord=request.user)
        image = get_object_or_404(PropertyImage, id=image_id, property=property_obj)
        was_primary = image.is_primary
        image.delete()
        if was_primary:
            replacement = property_obj.images.order_by("display_order", "id").first()
            if replacement:
                replacement.is_primary = True
                replacement.save(update_fields=["is_primary"])
        if property_obj.status in {Property.PropertyStatus.APPROVED, Property.PropertyStatus.PENDING}:
            property_obj.status = Property.PropertyStatus.DRAFT
            property_obj.verification_notes = ""
            property_obj.approved_at = None
            property_obj.save(update_fields=["status", "verification_notes", "approved_at", "updated_at"])
        return Response({"success": True, "message": "Photo removed. Submit the property again if its listing was already reviewed."})


class LandlordNestedCollectionView(APIView):
    permission_classes = [IsAuthenticated]
    parent_model = None
    parent_owner_lookup = ""
    child_parent_field = ""
    serializer_class = None

    def post(self, request, parent_id):
        role_error = _role_error(request, User.Role.LANDLORD)
        if role_error:
            return role_error
        parent = get_object_or_404(
            self.parent_model.objects,
            id=parent_id,
            **{self.parent_owner_lookup: request.user},
        )
        serializer = self.serializer_class(data=request.data, context={"parent": parent})
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        if self.child_parent_field == "room":
            with transaction.atomic():
                room = Room.objects.select_for_update().get(pk=parent.pk)
                if room.beds.count() >= room.capacity:
                    return Response({"success": False, "message": "This room already has its full bed capacity."}, status=status.HTTP_409_CONFLICT)
                bed_number = serializer.validated_data["bed_number"]
                if room.beds.filter(bed_number__iexact=bed_number).exists():
                    return Response({"success": False, "message": "That bed number is already used in this room."}, status=status.HTTP_400_BAD_REQUEST)
                child = serializer.save(**{self.child_parent_field: room})
        else:
            if self.child_parent_field == "building" and Floor.objects.filter(
                building=parent,
                floor_number=serializer.validated_data.get("floor_number"),
            ).exists():
                return Response({"success": False, "message": "That floor number already exists in this building."}, status=status.HTTP_400_BAD_REQUEST)
            if self.child_parent_field == "floor" and Room.objects.filter(
                property_id=parent.building.property_id,
                room_number__iexact=serializer.validated_data.get("room_number", ""),
            ).exists():
                return Response({"success": False, "message": "That room number already exists in this accommodation."}, status=status.HTTP_400_BAD_REQUEST)
            child = serializer.save(**{self.child_parent_field: parent})
        property_obj = (
            parent if isinstance(parent, Property)
            else parent.property if isinstance(parent, Building)
            else parent.building.property if isinstance(parent, Floor)
            else parent.floor.building.property
        )
        if property_obj.status in {Property.PropertyStatus.APPROVED, Property.PropertyStatus.PENDING}:
            property_obj.status = Property.PropertyStatus.DRAFT
            property_obj.verification_notes = ""
            property_obj.approved_at = None
            property_obj.save(update_fields=["status", "verification_notes", "approved_at", "updated_at"])
        return Response({
            "success": True,
            "message": "Accommodation structure saved.",
            "item": serializer.__class__(child, context={"request": request}).data,
        }, status=status.HTTP_201_CREATED)


class LandlordBuildingCollectionView(LandlordNestedCollectionView):
    parent_model = Property
    parent_owner_lookup = "landlord"
    child_parent_field = "property"
    serializer_class = BuildingWriteSerializer


class LandlordFloorCollectionView(LandlordNestedCollectionView):
    parent_model = Building
    parent_owner_lookup = "property__landlord"
    child_parent_field = "building"
    serializer_class = FloorWriteSerializer


class LandlordRoomCollectionView(LandlordNestedCollectionView):
    parent_model = Floor
    parent_owner_lookup = "building__property__landlord"
    child_parent_field = "floor"
    serializer_class = RoomWriteSerializer


class LandlordBedCollectionView(LandlordNestedCollectionView):
    parent_model = Room
    parent_owner_lookup = "floor__building__property__landlord"
    child_parent_field = "room"
    serializer_class = BedWriteSerializer


class LandlordStructureDetailView(APIView):
    permission_classes = [IsAuthenticated]
    structures = {
        "building": (Building, "property__landlord", BuildingWriteSerializer),
        "floor": (Floor, "building__property__landlord", FloorWriteSerializer),
        "room": (Room, "floor__building__property__landlord", RoomWriteSerializer),
        "bed": (Bed, "room__floor__building__property__landlord", BedWriteSerializer),
    }

    @transaction.atomic
    def patch(self, request, kind, object_id):
        role_error = _role_error(request, User.Role.LANDLORD)
        if role_error:
            return role_error
        config = self.structures.get(kind)
        if not config:
            return Response({"success": False, "message": "Unknown accommodation item."}, status=status.HTTP_404_NOT_FOUND)
        model, owner_lookup, serializer_class = config
        if kind == "bed":
            bed_room_id = get_object_or_404(
                Bed.objects.filter(**{owner_lookup: request.user}),
                id=object_id,
            ).room_id
            Room.objects.select_for_update().get(pk=bed_room_id)
        item = get_object_or_404(model.objects, id=object_id, **{owner_lookup: request.user})
        previous_status = getattr(item, "status", None)
        serializer = serializer_class(item, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        item = serializer.save()
        if kind == "bed" and previous_status != item.status:
            room = item.room
            sync_room_status(room)
            if item.status == Bed.BedStatus.AVAILABLE:
                from waitinglist.services import offer_waitlist_for_bed
                offer_waitlist_for_bed(item)
        changes_listing_content = (
            kind in {"building", "floor"}
            or (kind == "room" and bool(set(request.data.keys()) - {"status"}))
            or (kind == "bed" and "bed_number" in request.data)
        )
        if changes_listing_content:
            property_obj = (
                item.property if kind == "building"
                else item.building.property if kind == "floor"
                else item.floor.building.property if kind == "room"
                else item.room.floor.building.property
            )
            if property_obj.status in {Property.PropertyStatus.APPROVED, Property.PropertyStatus.PENDING}:
                property_obj.status = Property.PropertyStatus.DRAFT
                property_obj.verification_notes = ""
                property_obj.approved_at = None
                property_obj.save(update_fields=["status", "verification_notes", "approved_at", "updated_at"])
        return Response({"success": True, "item": serializer_class(item, context={"request": request}).data})


class AdminPropertyReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def _admin_error(self, request):
        if request.user.role != User.Role.ADMINISTRATOR and not request.user.is_superuser:
            return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)
        return None

    def get(self, request):
        error = self._admin_error(request)
        if error:
            return error
        properties = _managed_property_queryset().filter(status=Property.PropertyStatus.PENDING).order_by("created_at")
        return Response({
            "success": True,
            "count": properties.count(),
            "properties": ManagedPropertySerializer(properties, many=True, context={"request": request}).data,
        })

    def post(self, request, property_id):
        error = self._admin_error(request)
        if error:
            return error
        property_obj = get_object_or_404(Property, id=property_id)
        if property_obj.status != Property.PropertyStatus.PENDING:
            return Response({"success": False, "message": "Only properties waiting for review can receive a decision."}, status=status.HTTP_409_CONFLICT)
        decision = request.data.get("decision")
        notes = str(request.data.get("notes", "")).strip()
        if decision not in {Property.PropertyStatus.APPROVED, Property.PropertyStatus.REJECTED}:
            return Response({"success": False, "message": "Choose approve or request changes."}, status=status.HTTP_400_BAD_REQUEST)
        if decision == Property.PropertyStatus.REJECTED and not notes:
            return Response({"success": False, "message": "Add a note explaining what the landlord needs to change."}, status=status.HTTP_400_BAD_REQUEST)
        property_obj.status = decision
        property_obj.verification_notes = notes
        property_obj.approved_at = timezone.now() if decision == Property.PropertyStatus.APPROVED else None
        property_obj.save(update_fields=["status", "verification_notes", "approved_at", "updated_at"])
        if decision == Property.PropertyStatus.APPROVED:
            from waitinglist.services import offer_waitlist_for_bed
            available_beds = Bed.objects.filter(
                room__floor__building__property=property_obj,
                status=Bed.BedStatus.AVAILABLE,
            ).select_related("room__room_type", "room__floor__building__property")
            for bed in available_beds:
                offer_waitlist_for_bed(bed)
        record_audit_event(
            actor=request.user,
            action="PROPERTY_REVIEW_DECIDED",
            entity_type="property",
            entity_id=property_obj.id,
            summary=f"{decision.title()} property listing {property_obj.name}",
            metadata={"decision": decision},
            request=request,
        )
        create_notification(
            recipient=property_obj.landlord,
            actor=request.user,
            notification_type="SYSTEM",
            title="Property review updated",
            message=(
                f'Your property listing "{property_obj.name}" was approved and published.'
                if decision == Property.PropertyStatus.APPROVED
                else f'An administrator requested changes to your property listing "{property_obj.name}". {notes}'
            ),
            extra_data={"source": "property_review", "property_id": property_obj.id, "decision": decision},
        )
        return Response({
            "success": True,
            "message": "Property approved and published." if decision == Property.PropertyStatus.APPROVED else "Changes requested. The landlord can update and resubmit this property.",
            "property": ManagedPropertySerializer(property_obj, context={"request": request}).data,
        })
