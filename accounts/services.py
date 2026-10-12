import logging
import secrets
from datetime import timedelta
from smtplib import SMTPAuthenticationError, SMTPServerDisconnected

from django.conf import settings
from django.db import transaction
from django.contrib.auth.hashers import make_password
from django.contrib.auth.hashers import check_password
from django.core.mail import send_mail
from django.utils import timezone

from .models import AccountCode


logger = logging.getLogger(__name__)


def issue_account_code(user, purpose, *, cooldown_seconds=60, recipient_email=""):
    """Create and email a short-lived, single-use account code."""
    now = timezone.now()
    latest = AccountCode.objects.filter(
        user=user,
        purpose=purpose,
        consumed_at__isnull=True,
    ).first()
    if latest and (now - latest.created_at).total_seconds() < cooldown_seconds:
        return "cooldown"

    existing_codes = AccountCode.objects.filter(
        user=user,
        purpose=purpose,
        consumed_at__isnull=True,
    )
    if purpose == AccountCode.Purpose.VERIFY_EMAIL:
        # Keep earlier verification codes usable while their email may still be in transit.
        existing_codes.filter(expires_at__lte=now).update(consumed_at=now)
    else:
        existing_codes.update(consumed_at=now)

    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = AccountCode.objects.create(
        user=user,
        purpose=purpose,
        code_hash=make_password(code),
        target_email=recipient_email.strip().lower() if purpose == AccountCode.Purpose.CHANGE_EMAIL else "",
        expires_at=now + timedelta(minutes=15),
    )

    if purpose == AccountCode.Purpose.CHANGE_EMAIL:
        subject = "Confirm your new Student Haven email"
        message = (
            f"Hello {user.first_name},\n\n"
            f"Your Student Haven email-change code is {code}. "
            "It expires in 15 minutes. If you did not request this change, "
            "ignore this email and keep your current address."
        )
    elif purpose == AccountCode.Purpose.VERIFY_EMAIL:
        subject = "Verify your Student Haven email"
        message = (
            f"Hello {user.first_name},\n\n"
            f"Your Student Haven verification code is {code}. "
            "It expires in 15 minutes. If you did not create this account, "
            "you can ignore this email."
        )
    elif purpose == AccountCode.Purpose.RESET_PASSWORD:
        subject = "Reset your Student Haven password"
        message = (
            f"Hello {user.first_name},\n\n"
            f"Your Student Haven password reset code is {code}. "
            "It expires in 15 minutes. If you did not request this change, "
            "you can ignore this email."
        )
    else:
        subject = "Your Student Haven security code"
        message = (
            f"Hello {user.first_name},\n\n"
            f"Your Student Haven security code is {code}. "
            "It expires in 15 minutes. If you did not request this, "
            "you can ignore this email."
        )

    try:
        messages_sent = send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [recipient_email.strip().lower() if purpose == AccountCode.Purpose.CHANGE_EMAIL else user.email],
            fail_silently=False,
        )
    except SMTPAuthenticationError as error:
        if settings.EMAIL_HOST.lower() == "smtp.gmail.com":
            logger.error(
                "Gmail rejected account-code email for %s (SMTP %s). Sign in to the configured Google account, "
                "complete any security prompts, and set EMAIL_HOST_PASSWORD to a current Google app password.",
                user.email,
                error.smtp_code,
            )
        else:
            logger.error(
                "SMTP authentication failed for account-code email to %s via %s (SMTP %s). Check the provider credentials.",
                user.email,
                settings.EMAIL_HOST,
                error.smtp_code,
            )
    except SMTPServerDisconnected:
        logger.error(
            "SMTP server %s:%s closed the connection while sending an account code to %s. Check the provider's "
            "account/security status, credentials, and SMTP port/encryption settings.",
            settings.EMAIL_HOST,
            settings.EMAIL_PORT,
            user.email,
        )
    except Exception:
        logger.exception("Unable to send account code to %s", user.email)
    else:
        if messages_sent != 1:
            logger.error(
                "Email backend did not confirm delivery of the account code to %s.",
                user.email,
            )
        else:
            return "sent"

    challenge.consumed_at = timezone.now()
    challenge.save(update_fields=["consumed_at"])
    return "failed"


def issue_registration_verification(user):
    """Try to send the signup code without turning mail failures into signup failures."""
    try:
        # Resend requests must stay available after successful email delivery.
        return issue_account_code(
            user,
            AccountCode.Purpose.VERIFY_EMAIL,
            cooldown_seconds=0,
        )
    except Exception:
        logger.exception("Unable to prepare an email verification code for %s", user.email)
        return "failed"


def consume_account_code(user, purpose, raw_code):
    """Check and consume a short-lived code with a five-attempt limit."""

    with transaction.atomic():
        challenges = AccountCode.objects.select_for_update().filter(
            user=user,
            purpose=purpose,
            consumed_at__isnull=True,
        )
        if purpose == AccountCode.Purpose.VERIFY_EMAIL:
            active_challenges = list(challenges)
            if not active_challenges:
                return "missing"

            now = timezone.now()
            expired_challenges = [
                challenge
                for challenge in active_challenges
                if challenge.expires_at <= now
            ]
            for challenge in expired_challenges:
                challenge.consumed_at = now
                challenge.save(update_fields=["consumed_at"])

            active_challenges = [
                challenge
                for challenge in active_challenges
                if challenge.expires_at > now
            ]
            if not active_challenges:
                return "expired"

            if max(challenge.attempts for challenge in active_challenges) >= 5:
                challenges.update(consumed_at=now)
                return "locked"

            if any(
                check_password(str(raw_code), challenge.code_hash)
                for challenge in active_challenges
            ):
                challenges.update(consumed_at=now)
                return "valid"

            attempts = max(challenge.attempts for challenge in active_challenges) + 1
            if attempts >= 5:
                challenges.update(attempts=attempts, consumed_at=now)
                return "locked"
            challenges.update(attempts=attempts)
            return "invalid"

        challenge = challenges.first()
        if not challenge:
            return "missing"
        if challenge.attempts >= 5:
            challenge.consumed_at = timezone.now()
            challenge.save(update_fields=["consumed_at"])
            return "locked"
        if challenge.expires_at <= timezone.now():
            challenge.consumed_at = timezone.now()
            challenge.save(update_fields=["consumed_at"])
            return "expired"
        if check_password(str(raw_code), challenge.code_hash):
            challenge.consumed_at = timezone.now()
            challenge.save(update_fields=["consumed_at"])
            return "valid"
        challenge.attempts += 1
        if challenge.attempts >= 5:
            challenge.consumed_at = timezone.now()
            challenge.save(update_fields=["attempts", "consumed_at"])
            return "locked"
        challenge.save(update_fields=["attempts"])
        return "invalid"
