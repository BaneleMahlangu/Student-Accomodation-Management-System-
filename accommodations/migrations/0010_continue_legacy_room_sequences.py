from collections import defaultdict

from django.db import migrations


def continue_legacy_room_sequences(apps, schema_editor):
    Property = apps.get_model("accommodations", "Property")
    Room = apps.get_model("accommodations", "Room")
    database = schema_editor.connection.alias

    for property_obj in Property.objects.using(database).order_by("pk").iterator():
        rooms = list(
            Room.objects.using(database)
            .filter(property_id=property_obj.pk)
            .select_related("floor")
            .order_by("floor__floor_number", "floor_id", "room_number", "pk")
        )
        if not rooms:
            continue

        prefixes = set()
        room_indices_by_floor = defaultdict(list)
        is_legacy_sequence = True
        for room in rooms:
            number = room.room_number or ""
            floor_number = room.floor.floor_number
            if (
                not number.isdigit()
                or len(number) < 5
                or number[-4:-2] != f"{floor_number:02d}"
                or not 1 <= int(number[-2:]) <= 6
            ):
                is_legacy_sequence = False
                break
            prefixes.add(number[:-4])
            room_indices_by_floor[room.floor_id].append(int(number[-2:]))

        if (
            not is_legacy_sequence
            or len(prefixes) != 1
            or any(sorted(indices) != [1, 2, 3, 4, 5, 6] for indices in room_indices_by_floor.values())
        ):
            continue

        prefix = prefixes.pop()
        changes = [
            (room.pk, room.room_number, f"{prefix}01{index:02d}")
            for index, room in enumerate(rooms, start=1)
        ]
        if all(old_number == new_number for _, old_number, new_number in changes):
            continue

        # Temporary unique labels avoid collisions with the old labels during
        # the update while the database uniqueness constraint stays enabled.
        for room_id, _, _ in changes:
            Room.objects.using(database).filter(pk=room_id).update(
                room_number=f"TMP-{room_id}"
            )
        for room_id, _, new_number in changes:
            Room.objects.using(database).filter(pk=room_id).update(
                room_number=new_number
            )


class Migration(migrations.Migration):

    dependencies = [
        ("accommodations", "0009_continue_demo_room_numbers"),
    ]

    operations = [
        migrations.RunPython(
            continue_legacy_room_sequences,
            migrations.RunPython.noop,
        ),
    ]
