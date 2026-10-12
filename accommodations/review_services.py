from decimal import Decimal, ROUND_HALF_UP

from django.db import connection
from django.db.models import Avg
from django.utils import timezone

from .models import Property, PropertyReview


def submit_property_review(*, property_id, booking_id, student_id, rating, title, body):
    """Publish a verified-resident review immediately, using the database routine when available."""
    if connection.vendor == "mysql":
        with connection.cursor() as cursor:
            cursor.callproc(
                "studenthaven_submit_property_review",
                [property_id, booking_id, student_id, rating, title, body],
            )
        review = PropertyReview.objects.get(booking_id=booking_id)
        # Older installs still have the previous procedure, which inserted PENDING reviews.
        # Publish that row here as well so ratings are visible even before the procedure migration.
        if review.status != PropertyReview.Status.PUBLISHED:
            PropertyReview.objects.filter(pk=review.pk).update(
                status=PropertyReview.Status.PUBLISHED,
                updated_at=timezone.now(),
            )
        refresh_property_rating(property_id)
        return PropertyReview.objects.select_related("property", "student", "booking").get(pk=review.pk)

    review = PropertyReview.objects.create(
        property_id=property_id,
        booking_id=booking_id,
        student_id=student_id,
        rating=rating,
        title=title,
        body=body,
        status=PropertyReview.Status.PUBLISHED,
    )
    refresh_property_rating(property_id)
    return review


def refresh_property_rating(property_id):
    """Keep the stored property rating equal to its published resident reviews."""
    if connection.vendor == "mysql":
        with connection.cursor() as cursor:
            cursor.callproc("studenthaven_refresh_property_rating", [property_id])
        return

    average = PropertyReview.objects.filter(
        property_id=property_id,
        status=PropertyReview.Status.PUBLISHED,
    ).aggregate(value=Avg("rating"))["value"]
    value = Decimal(str(average)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if average is not None else Decimal("0.00")
    Property.objects.filter(pk=property_id).update(rating=value, updated_at=timezone.now())
