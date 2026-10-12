from decimal import Decimal, ROUND_HALF_UP

from django.db import migrations
from django.db.models import Avg


def recalculate_published_property_ratings(apps, schema_editor):
    Property = apps.get_model("accommodations", "Property")
    PropertyReview = apps.get_model("accommodations", "PropertyReview")
    database = schema_editor.connection.alias
    averages = {
        row["property_id"]: row["average"]
        for row in PropertyReview.objects.using(database)
        .filter(status="PUBLISHED")
        .values("property_id")
        .annotate(average=Avg("rating"))
    }
    for property_obj in Property.objects.using(database).only("id").iterator():
        average = averages.get(property_obj.id)
        rating = Decimal(str(average)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if average is not None else Decimal("0.00")
        Property.objects.using(database).filter(pk=property_obj.id).update(rating=rating)


class Migration(migrations.Migration):
    dependencies = [
        ("accommodations", "0012_publish_resident_reviews"),
    ]

    operations = [
        migrations.RunPython(recalculate_published_property_ratings, migrations.RunPython.noop),
    ]
