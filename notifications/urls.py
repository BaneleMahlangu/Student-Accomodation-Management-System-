from django.urls import path

from .views import (
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationMarkReadView,
)


urlpatterns = [

    path(
        "",
        NotificationListView.as_view(),
    ),

    path(
        "<int:notification_id>/read/",
        NotificationMarkReadView.as_view(),
    ),

    path(
        "mark-all-read/",
        NotificationMarkAllReadView.as_view(),
    ),
]