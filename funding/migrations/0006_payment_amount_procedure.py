from django.db import migrations


PROCEDURE_NAME = "studenthaven_adjust_funding_payment"


def install_funding_payment_procedure(apps, schema_editor):
    if schema_editor.connection.vendor != "mysql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(f"DROP PROCEDURE IF EXISTS {PROCEDURE_NAME}")
        cursor.execute(
            f"""
            CREATE PROCEDURE {PROCEDURE_NAME}(
                IN p_funding_payment_id BIGINT UNSIGNED,
                IN p_amount_delta DECIMAL(12, 2),
                IN p_payment_reference VARCHAR(100),
                IN p_is_refund TINYINT
            )
            BEGIN
                DECLARE v_amount_due DECIMAL(12, 2) DEFAULT NULL;
                DECLARE v_amount_paid DECIMAL(12, 2) DEFAULT NULL;
                DECLARE v_new_amount_paid DECIMAL(12, 2);
                DECLARE v_remaining_balance DECIMAL(12, 2);
                DECLARE v_payment_status VARCHAR(30);
                DECLARE v_funding_status VARCHAR(30);
                DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_amount_due = NULL;

                SELECT amount_due, amount_paid
                INTO v_amount_due, v_amount_paid
                FROM funding_fundingpayment
                WHERE id = p_funding_payment_id
                FOR UPDATE;

                IF v_amount_due IS NULL THEN
                    SIGNAL SQLSTATE '45000'
                        SET MESSAGE_TEXT = 'Funding payment record was not found.';
                END IF;

                IF p_amount_delta IS NULL OR p_amount_delta = 0 OR p_is_refund NOT IN (0, 1) THEN
                    SIGNAL SQLSTATE '45000'
                        SET MESSAGE_TEXT = 'Payment adjustment is invalid.';
                END IF;

                IF p_is_refund = 1 THEN
                    IF p_amount_delta > 0 OR ABS(p_amount_delta) > v_amount_paid THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Refund cannot exceed the amount already paid.';
                    END IF;
                ELSEIF p_amount_delta < 0 OR p_amount_delta > v_amount_due - v_amount_paid THEN
                    SIGNAL SQLSTATE '45000'
                        SET MESSAGE_TEXT = 'Payment cannot exceed the outstanding balance.';
                END IF;

                SET v_new_amount_paid = v_amount_paid + p_amount_delta;
                SET v_remaining_balance = GREATEST(0.00, v_amount_due - v_new_amount_paid);

                IF p_is_refund = 1 THEN
                    SET v_payment_status = CASE
                        WHEN v_new_amount_paid <= 0 THEN 'REFUNDED'
                        WHEN v_remaining_balance > 0 THEN 'PENDING'
                        ELSE 'SUCCESSFUL'
                    END;
                    SET v_funding_status = CASE
                        WHEN v_new_amount_paid <= 0 THEN 'PENDING'
                        WHEN v_remaining_balance > 0 THEN 'PARTIALLY_FUNDED'
                        ELSE 'VERIFIED'
                    END;
                ELSE
                    SET v_payment_status = IF(v_remaining_balance = 0, 'SUCCESSFUL', 'PENDING');
                    SET v_funding_status = IF(v_remaining_balance = 0, 'VERIFIED', 'PARTIALLY_FUNDED');
                END IF;

                UPDATE funding_fundingpayment
                SET amount_paid = v_new_amount_paid,
                    payment_status = v_payment_status,
                    funding_status = v_funding_status,
                    payment_reference = IF(
                        p_is_refund = 1,
                        payment_reference,
                        LEFT(COALESCE(p_payment_reference, ''), 100)
                    ),
                    updated_at = UTC_TIMESTAMP(6)
                WHERE id = p_funding_payment_id;
            END
            """
        )


def remove_funding_payment_procedure(apps, schema_editor):
    if schema_editor.connection.vendor != "mysql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(f"DROP PROCEDURE IF EXISTS {PROCEDURE_NAME}")


class Migration(migrations.Migration):
    dependencies = [
        ("funding", "0005_expand_contract_rent_total"),
    ]

    operations = [
        migrations.RunPython(install_funding_payment_procedure, remove_funding_payment_procedure),
    ]
