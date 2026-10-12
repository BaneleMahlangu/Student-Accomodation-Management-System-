from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accommodations", "0003_alter_propertyimage_category"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="property",
            name="latitude",
            field=models.DecimalField(blank=True, decimal_places=7, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name="property",
            name="longitude",
            field=models.DecimalField(blank=True, decimal_places=7, max_digits=10, null=True),
        ),
        migrations.CreateModel(
            name="StudentFavoriteProperty",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("property", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="student_favorites", to="accommodations.property")),
                ("student", models.ForeignKey(limit_choices_to={"role": "STUDENT"}, on_delete=django.db.models.deletion.CASCADE, related_name="favorite_properties", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.AddConstraint(
            model_name="studentfavoriteproperty",
            constraint=models.UniqueConstraint(fields=("student", "property"), name="accom_student_favorite_unique"),
        ),
    ]
