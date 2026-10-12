from django.db import migrations


def continue_demo_room_numbers(apps, schema_editor):
    Property = apps.get_model("accommodations", "Property")
    Room = apps.get_model("accommodations", "Room")
    database = schema_editor.connection.alias

    demo_properties = Property.objects.using(database).filter(is_demo=True).order_by("pk")
    for property_obj in demo_properties.iterator():
        rooms = list(
            Room.objects.using(database)
            .filter(property_id=property_obj.pk)
            .select_related("floor")
            .order_by("floor__floor_number", "floor_id", "room_number", "pk")
        )
        if not rooms:
            continue

        prefixes = set()
        is_legacy_seed_inventory = True
        for room in rooms:
            number = room.room_number or ""
            floor_number = room.floor.floor_number
            if (
                not number.isdigit()
                or len(number) < 5
                or number[-4:-2] != f"{floor_number:02d}"
                or not 1 <= int(number[-2:]) <= 6
            ):
                is_legacy_seed_inventory = False
                break
            prefixes.add(number[:-4])

        if not is_legacy_seed_inventory or len(prefixes) != 1:
            continue

        prefix = prefixes.pop()
        changes = [
            (room.pk, room.room_number, f"{prefix}01{index:02d}")
            for index, room in enumerate(rooms, start=1)
        ]
        if all(old_number == new_number for _, old_number, new_number in changes):
            continue

        # Stage through unique temporary values so the existing database
        # constraint remains satisfied while the floor-based labels change.
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
        ("accommodations", "0008_room_property_unique_number"),
    ]

    operations = [
        migrations.RunPython(
            continue_demo_room_numbers,
            migrations.RunPython.noop,
        ),
    ]
