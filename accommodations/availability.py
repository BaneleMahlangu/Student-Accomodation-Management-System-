from accommodations.models import Bed, Room


LANDLORD_MANAGED_ROOM_STATUSES = {
    Room.RoomStatus.MAINTENANCE,
    Room.RoomStatus.BLOCKED,
    Room.RoomStatus.CLEANING,
    Room.RoomStatus.UNAVAILABLE,
}


def sync_room_status(room):
    """Keep the saved room status aligned with its allocated beds."""
    if room.status in LANDLORD_MANAGED_ROOM_STATUSES:
        return room.status

    bed_statuses = set(room.beds.values_list("status", flat=True))
    if Bed.BedStatus.AVAILABLE in bed_statuses:
        new_status = Room.RoomStatus.AVAILABLE
    elif Bed.BedStatus.OCCUPIED in bed_statuses:
        new_status = Room.RoomStatus.OCCUPIED
    elif Bed.BedStatus.RESERVED in bed_statuses:
        new_status = Room.RoomStatus.RESERVED
    else:
        return room.status

    if room.status != new_status:
        room.status = new_status
        room.save(update_fields=["status"])
    return room.status
