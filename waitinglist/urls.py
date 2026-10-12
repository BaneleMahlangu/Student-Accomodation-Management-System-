from django.urls import path

from .views import LandlordWaitingListView, StudentWaitingListActionView, StudentWaitingListView


urlpatterns = [
    path("", StudentWaitingListView.as_view(), name="student-waiting-list"),
    path("landlord/", LandlordWaitingListView.as_view(), name="landlord-waiting-list"),
    path("landlord/<int:entry_id>/", LandlordWaitingListView.as_view(), name="landlord-waiting-list-detail"),
    path("<int:entry_id>/<str:action>/", StudentWaitingListActionView.as_view(), name="student-waiting-list-action"),
]
