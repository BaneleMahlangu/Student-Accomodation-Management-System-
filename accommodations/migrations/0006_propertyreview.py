import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accommodations", "0005_mark_demo_inventory"),
        ("bookings", "0005_accommodationchangerequest"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PropertyReview",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("rating", models.PositiveSmallIntegerField()),
                ("title", models.CharField(max_length=120)),
                ("body", models.TextField(max_length=2500)),
                ("status", models.CharField(choices=[("PENDING", "Pending moderation"), ("PUBLISHED", "Published"), ("REJECTED", "Not published")], default="PENDING", max_length=20)),
                ("moderation_note", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("moderated_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("booking", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="property_review", to="bookings.booking")),
                ("moderated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="moderated_property_reviews", to=settings.AUTH_USER_MODEL)),
                ("property", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reviews", to="accommodations.property")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="property_reviews", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.AddIndex(
            model_name="propertyreview",
            index=models.Index(fields=["property", "status", "created_at"], name="property_review_pub_idx"),
        ),
        migrations.AddConstraint(
            model_name="propertyreview",
            constraint=models.CheckConstraint(condition=models.Q(("rating__gte", 1), ("rating__lte", 5)), name="accommodation_review_rating_range"),
        ),
    ]
