from django.urls import path

from .views import ComplaintDetailView, ComplaintListCreateView, ComplaintMessageView


urlpatterns = [
    path("", ComplaintListCreateView.as_view(), name="complaint-list-create"),
    path("<int:complaint_id>/", ComplaintDetailView.as_view(), name="complaint-detail"),
    path("<int:complaint_id>/messages/", ComplaintMessageView.as_view(), name="complaint-messages"),
]
