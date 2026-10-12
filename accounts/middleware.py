from datetime import timedelta

from django.utils import timezone

from .models import AccountSession


class AccountSessionActivityMiddleware:
    """Keep tracked session activity fresh without writing on every request."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        session_key = getattr(getattr(request, "session", None), "session_key", None)
        if user is not None and user.is_authenticated and session_key:
            now = timezone.now()
            AccountSession.objects.filter(
                user_id=user.id,
                session_key=session_key,
                revoked_at__isnull=True,
                last_seen_at__lt=now - timedelta(minutes=5),
            ).update(last_seen_at=now)
        return self.get_response(request)
