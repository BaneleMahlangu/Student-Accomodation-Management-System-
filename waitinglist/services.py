from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from accommodations.models import Bed, Property, Room
from notifications.services import create_notification

from .models import WaitingListEntry


def offer_waitlist_for_bed(bed):
    """Offer an available bed to the highest-priority matching student."""
    with transaction.atomic():
        bed = Bed.objects.select_for_update().select_related(
            "room__room_type",
            "room__floor__building__property",
        ).get(pk=bed.pk)
        room = bed.room
        property_obj = room.floor.building.property

        if (
            bed.status != Bed.BedStatus.AVAILABLE
            or room.status != Room.RoomStatus.AVAILABLE
            or property_obj.status != Property.PropertyStatus.APPROVED
        ):
            return None

        now = timezone.now()
        WaitingListEntry.objects.filter(
            offered_bed=bed,
            status=WaitingListEntry.Status.OFFERED,
            respond_by__lte=now,
        ).update(status=WaitingListEntry.Status.EXPIRED, updated_at=now)

        if WaitingListEntry.objects.filter(
            offered_bed=bed,
            status__in=[WaitingListEntry.Status.OFFERED, WaitingListEntry.Status.ACCEPTED],
        ).exists():
            return None

        candidate = WaitingListEntry.objects.select_for_update().filter(
            property=property_obj,
            status=WaitingListEntry.Status.WAITING,
        ).filter(
            Q(room_type__isnull=True) | Q(room_type=room.room_type),
        ).filter(
            Q(max_monthly_price__isnull=True) | Q(max_monthly_price__gte=room.monthly_price),
        ).filter(
            Q(accessibility_required=False) | Q(accessibility_required=room.is_accessible),
        ).order_by("-priority_score", "created_at", "id").first()

        if not candidate:
            return None

        candidate.status = WaitingListEntry.Status.OFFERED
        candidate.offered_bed = bed
        candidate.offered_at = now
        candidate.respond_by = now + timedelta(hours=48)
        candidate.save(update_fields=["status", "offered_bed", "offered_at", "respond_by", "updated_at"])
        create_notification(
            recipient=candidate.student,
            notification_type="WAITING_LIST",
            title="A matching room is available",
            message=(
                f"A bed at {property_obj.name} matches your waiting-list preferences. "
                "Accept the offer within 48 hours to start an application."
            ),
            extra_data={
                "waiting_list_entry": candidate.id,
                "property_id": property_obj.id,
                "room_id": room.id,
                "room_number": room.room_number,
                "respond_by": candidate.respond_by.isoformat(),
            },
        )
        return candidate
