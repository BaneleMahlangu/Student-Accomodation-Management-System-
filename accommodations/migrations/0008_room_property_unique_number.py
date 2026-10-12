from itertools import groupby

from django.db import migrations, models
import django.db.models.deletion


def backfill_room_property_and_unique_numbers(apps, schema_editor):
    Room = apps.get_model("accommodations", "Room")
    database = schema_editor.connection.alias
    rooms = Room.objects.using(database).select_related("floor__building").order_by(
        "floor__building__property_id", "pk"
    )

    for property_id, property_rooms in groupby(
        rooms.iterator(), key=lambda room: room.floor.building.property_id
    ):
        property_rooms = list(property_rooms)
        original_numbers = {
            (room.room_number or "").strip().casefold()
            for room in property_rooms
        }
        used_numbers = set()

        for room in property_rooms:
            original_number = (room.room_number or "").strip()
            base_number = original_number or f"Room-{room.pk}"
            number = base_number
            normalized = number.casefold()

            if normalized in used_numbers:
                suffix = 2
                while True:
                    suffix_text = f"-{suffix}"
                    number = f"{base_number[:50 - len(suffix_text)]}{suffix_text}"
                    normalized = number.casefold()
                    if normalized not in used_numbers and normalized not in original_numbers:
                        break
                    suffix += 1

            used_numbers.add(normalized)
            if number != room.room_number or room.property_id != property_id:
                Room.objects.using(database).filter(pk=room.pk).update(
                    room_number=number,
                    property_id=property_id,
                )


class Migration(migrations.Migration):

    dependencies = [
        ("accommodations", "0007_property_virtual_tour_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="room",
            name="property",
            field=models.ForeignKey(
                editable=False,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="rooms",
                to="accommodations.property",
            ),
        ),
        migrations.RunPython(
            backfill_room_property_and_unique_numbers,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="room",
            name="property",
            field=models.ForeignKey(
                editable=False,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="rooms",
                to="accommodations.property",
            ),
        ),
        migrations.AlterField(
            model_name="room",
            name="room_number",
            field=models.CharField(
                help_text="Must be unique within this accommodation.",
                max_length=50,
            ),
        ),
        migrations.AddConstraint(
            model_name="room",
            constraint=models.UniqueConstraint(
                fields=("property", "room_number"),
                name="room_property_number_unique",
            ),
        ),
    ]
