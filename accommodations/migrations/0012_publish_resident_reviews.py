from decimal import Decimal, ROUND_HALF_UP

from django.db import migrations
from django.db import models
from django.db.models import Avg


def publish_existing_reviews(apps, schema_editor):
    Property = apps.get_model("accommodations", "Property")
    PropertyReview = apps.get_model("accommodations", "PropertyReview")
    database = schema_editor.connection.alias

    # Reviews awaiting moderation become live; preserve reviews explicitly rejected before
    # the platform switched to immediate publication.
    PropertyReview.objects.using(database).filter(status="PENDING").update(status="PUBLISHED")
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


def _replace_submit_procedure(schema_editor, review_status):
    if schema_editor.connection.vendor != "mysql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DROP PROCEDURE IF EXISTS studenthaven_submit_property_review")
        cursor.execute(
            f"""
            CREATE PROCEDURE studenthaven_submit_property_review(
                IN p_property_id BIGINT UNSIGNED,
                IN p_booking_id BIGINT UNSIGNED,
                IN p_student_id BIGINT UNSIGNED,
                IN p_rating SMALLINT UNSIGNED,
                IN p_title VARCHAR(120),
                IN p_body TEXT
            )
            BEGIN
                DECLARE v_booking_status VARCHAR(20) DEFAULT NULL;
                DECLARE v_checked_in_at DATETIME(6) DEFAULT NULL;
                DECLARE v_checked_out_at DATETIME(6) DEFAULT NULL;

                SELECT status, checked_in_at, checked_out_at
                INTO v_booking_status, v_checked_in_at, v_checked_out_at
                FROM bookings_booking
                WHERE id = p_booking_id
                  AND property_id = p_property_id
                  AND student_id = p_student_id
                  AND EXISTS (
                      SELECT 1
                      FROM accounts_user AS student_account
                      WHERE student_account.id = p_student_id
                        AND student_account.role = 'STUDENT'
                  )
                FOR UPDATE;

                IF v_booking_status IS NULL
                   OR NOT (
                       (v_booking_status = 'ACTIVE' AND v_checked_in_at IS NOT NULL)
                       OR (v_booking_status IN ('COMPLETED', 'CANCELLED')
                           AND v_checked_in_at IS NOT NULL
                           AND v_checked_out_at IS NOT NULL)
                   ) THEN
                    SIGNAL SQLSTATE '45000'
                        SET MESSAGE_TEXT = 'A review requires a current or former resident booking at this property.';
                END IF;

                IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
                    SIGNAL SQLSTATE '45000'
                        SET MESSAGE_TEXT = 'Property ratings must be between 1 and 5 stars.';
                END IF;

                IF p_title IS NULL OR CHAR_LENGTH(TRIM(p_title)) = 0 OR CHAR_LENGTH(p_title) > 120
                   OR p_body IS NULL OR CHAR_LENGTH(TRIM(p_body)) = 0 OR CHAR_LENGTH(p_body) > 2500 THEN
                    SIGNAL SQLSTATE '45000'
                        SET MESSAGE_TEXT = 'A review requires a title and comment within the allowed lengths.';
                END IF;

                INSERT INTO accommodations_propertyreview (
                    rating, title, body, status, moderation_note,
                    created_at, moderated_at, updated_at,
                    booking_id, moderated_by_id, property_id, student_id
                ) VALUES (
                    p_rating, p_title, p_body, '{review_status}', '',
                    UTC_TIMESTAMP(6), NULL, UTC_TIMESTAMP(6),
                    p_booking_id, NULL, p_property_id, p_student_id
                );

                CALL studenthaven_refresh_property_rating(p_property_id);
            END
            """
        )


def install_published_submit_procedure(apps, schema_editor):
    _replace_submit_procedure(schema_editor, "PUBLISHED")


def restore_pending_submit_procedure(apps, schema_editor):
    _replace_submit_procedure(schema_editor, "PENDING")


class Migration(migrations.Migration):
    dependencies = [
        ("accommodations", "0011_resident_rating_procedures"),
    ]

    operations = [
        migrations.AlterField(
            model_name="propertyreview",
            name="status",
            field=models.CharField(
                choices=[("PENDING", "Pending moderation"), ("PUBLISHED", "Published"), ("REJECTED", "Not published")],
                default="PUBLISHED",
                max_length=20,
            ),
        ),
        migrations.RunPython(publish_existing_reviews, migrations.RunPython.noop),
        migrations.RunPython(install_published_submit_procedure, restore_pending_submit_procedure),
    ]
