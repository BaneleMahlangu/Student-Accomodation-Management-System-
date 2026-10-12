import logging
from smtplib import SMTPAuthenticationError
from typing import Any

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction

from accounts.models import NotificationPreference
from .models import Notification


logger = logging.getLogger(__name__)


def _email_category(notification_type: str) -> str:
    if notification_type.startswith(("APPLICATION_", "DOCUMENT")) or notification_type in {
        "ADDITIONAL_INFORMATION", "ADMIN_FEEDBACK", "LANDLORD_FEEDBACK",
    }:
        return "email_application_updates"
    if notification_type.startswith(("CONTRACT_", "PAYMENT_")) or notification_type == "FUNDING_UPDATED":
        return "email_finance_updates"
    if notification_type.startswith(("BOOKING_", "CHECK_")) or notification_type in {"CHECKED_IN", "CHECKED_OUT", "WAITING_LIST"}:
        return "email_accommodation_updates"
    if notification_type.startswith(("MAINTENANCE_", "COMPLAINT_")):
        return "email_support_updates"
    return "email_product_updates"


def _send_notification_email(notification_id: int, preference_field: str):
    notification = Notification.objects.select_related("recipient").filter(id=notification_id).first()
    if not notification or not notification.recipient.is_verified:
        return

    preferences, _ = NotificationPreference.objects.get_or_create(user=notification.recipient)
    if not getattr(preferences, preference_field, False):
        return

    try:
        send_mail(
            subject=f"Student Haven: {notification.title[:180]}",
            message=(
                f"{notification.message}\n\n"
                "Sign in to Student Haven to review this update. "
                "You can change optional email notifications in account settings."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[notification.recipient.email],
            fail_silently=False,
        )
    except SMTPAuthenticationError:
        if settings.EMAIL_HOST.lower() == "smtp.gmail.com":
            logger.warning(
                "Gmail rejected notification email for event %s. Sign in to the Gmail account in a browser, "
                "complete any security prompt, and confirm EMAIL_HOST_PASSWORD is a current Google app password.",
                notification_id,
            )
        else:
            logger.warning(
                "SMTP rejected notification email for event %s. Check the provider account and SMTP credentials.",
                notification_id,
            )
    except Exception:
        # Delivery failures must not roll back the application event or its in-app alert.
        logger.exception("Unable to deliver notification email for event %s", notification_id)


def create_notification(
    *,
    recipient,
    notification_type,
    title: str,
    message: str,
    actor=None,
    application=None,
    document=None,
    maintenance_request=None,
    extra_data: dict[str, Any] | None = None,
):
    """
    Creates one Student Haven notification for a specific user.

    Notifications are created only when a meaningful business event
    occurs, such as an application decision, document decision,
    maintenance update, payment update, booking event, etc.
    """

    notification = Notification.objects.create(
        recipient=recipient,
        actor=actor,
        notification_type=notification_type,
        title=title,
        message=message,
        application=application,
        document=document,
        maintenance_request=maintenance_request,
        extra_data=extra_data or {},
    )
    transaction.on_commit(
        lambda: _send_notification_email(
            notification.id,
            _email_category(str(notification_type)),
        )
    )
    return notification


def notify_active_landlords(*, actor, title: str, message: str, extra_data: dict[str, Any] | None = None) -> int:
    """Send an administrator update to every active landlord account."""
    from accounts.models import User

    recipients = User.objects.filter(
        role=User.Role.LANDLORD,
        is_active=True,
    ).iterator()
    notification_count = 0
    for recipient in recipients:
        create_notification(
            recipient=recipient,
            actor=actor,
            notification_type=Notification.NotificationType.SYSTEM,
            title=title,
            message=message,
            extra_data=extra_data or {},
        )
        notification_count += 1
    return notification_count
