from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accommodations", "0006_propertyreview"),
    ]

    operations = [
        migrations.AddField(
            model_name="property",
            name="virtual_tour_url",
            field=models.URLField(blank=True, default="", max_length=500),
        ),
    ]
