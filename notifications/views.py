from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):

        notifications = (
            Notification.objects
            .filter(
                recipient=request.user
            )
            .select_related(
                "actor",
                "application",
                "document",
                "maintenance_request",
            )
            .order_by("-created_at")
        )

        unread_count = (
            notifications
            .filter(is_read=False)
            .count()
        )

        serializer = NotificationSerializer(
            notifications,
            many=True,
        )

        return Response(
            {
                "success": True,
                "count": notifications.count(),
                "unread_count": unread_count,
                "notifications": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class NotificationMarkReadView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def post(
        self,
        request,
        notification_id,
    ):

        notification = (
            Notification.objects
            .filter(
                id=notification_id,
                recipient=request.user,
            )
            .first()
        )

        if not notification:

            return Response(
                {
                    "success": False,
                    "message": (
                        "Notification not found."
                    ),
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        notification.is_read = True
        notification.read_at = (
            timezone.now()
        )
        notification.save(
            update_fields=[
                "is_read",
                "read_at",
                "updated_at",
            ]
        )

        serializer = NotificationSerializer(
            notification
        )

        return Response(
            {
                "success": True,
                "notification": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class NotificationMarkAllReadView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def post(self, request):

        now = timezone.now()

        updated_count = (
            Notification.objects
            .filter(
                recipient=request.user,
                is_read=False,
            )
            .update(
                is_read=True,
                read_at=now,
                updated_at=now,
            )
        )

        return Response(
            {
                "success": True,
                "updated_count": updated_count,
                "message": (
                    "All notifications marked as read."
                ),
            },
            status=status.HTTP_200_OK,
        )