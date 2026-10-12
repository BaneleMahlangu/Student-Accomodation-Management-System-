from decimal import Decimal, ROUND_HALF_UP

from django.db import migrations
from django.db.models import Avg


def synchronize_property_ratings(apps, schema_editor):
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
        stored_rating = Decimal(str(average)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if average is not None else Decimal("0.00")
        Property.objects.using(database).filter(pk=property_obj.id).update(rating=stored_rating)


def install_rating_procedures(apps, schema_editor):
    if schema_editor.connection.vendor != "mysql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DROP PROCEDURE IF EXISTS studenthaven_submit_property_review")
        cursor.execute("DROP PROCEDURE IF EXISTS studenthaven_refresh_property_rating")
        cursor.execute(
            """
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
                    p_rating, p_title, p_body, 'PENDING', '',
                    UTC_TIMESTAMP(6), NULL, UTC_TIMESTAMP(6),
                    p_booking_id, NULL, p_property_id, p_student_id
                );
            END
            """
        )
        cursor.execute(
            """
            CREATE PROCEDURE studenthaven_refresh_property_rating(
                IN p_property_id BIGINT UNSIGNED
            )
            BEGIN
                UPDATE accommodations_property
                SET rating = COALESCE(
                    (
                        SELECT ROUND(AVG(review.rating), 2)
                        FROM accommodations_propertyreview AS review
                        WHERE review.property_id = p_property_id
                          AND review.status = 'PUBLISHED'
                    ),
                    0.00
                ),
                updated_at = UTC_TIMESTAMP(6)
                WHERE id = p_property_id;
            END
            """
        )


def remove_rating_procedures(apps, schema_editor):
    if schema_editor.connection.vendor != "mysql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DROP PROCEDURE IF EXISTS studenthaven_submit_property_review")
        cursor.execute("DROP PROCEDURE IF EXISTS studenthaven_refresh_property_rating")


class Migration(migrations.Migration):

    dependencies = [
        ("accommodations", "0010_continue_legacy_room_sequences"),
    ]

    operations = [
        migrations.RunPython(synchronize_property_ratings, migrations.RunPython.noop),
        migrations.RunPython(install_rating_procedures, remove_rating_procedures),
    ]
