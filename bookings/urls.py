from django.urls import path

from .views import (
    AdminScanCheckInView,
    CheckInPreviewView,
    StudentBookingView,
    StudentCheckInView,
    StudentCheckOutView,
    StudentAccommodationChangeRequestsView,
    StudentTransferOptionsView,
    AccommodationChangeRequestWithdrawalView,
    ManagedAccommodationChangeRequestsView,
    AccommodationChangeRequestDecisionView,
    ManagedBookingsView,
    ManagedBookingTransferOptionsView,
    ManagedBookingTerminationView,
    ManagedBookingTransferView,
)


urlpatterns = [
    path(
        "application/<int:application_id>/",
        StudentBookingView.as_view(),
    ),
    path(
        "application/<int:application_id>/check-in/",
        StudentCheckInView.as_view(),
        name="student-check-in",
    ),
    path(
        "application/<int:application_id>/check-out/",
        StudentCheckOutView.as_view(),
    ),
    
    
    path(
        "scan/check-in/preview/",
        CheckInPreviewView.as_view(),
        name="check-in-preview",
    ),
    path(
        "scan/check-in/",
        AdminScanCheckInView.as_view(),
        name="staff-check-in",
    ),
    path("lifecycle/transfer-options/", StudentTransferOptionsView.as_view()),
    path("lifecycle/application/<int:application_id>/requests/", StudentAccommodationChangeRequestsView.as_view()),
    path("lifecycle/requests/<int:request_id>/withdraw/", AccommodationChangeRequestWithdrawalView.as_view()),
    path("lifecycle/management/requests/", ManagedAccommodationChangeRequestsView.as_view()),
    path("lifecycle/management/requests/<int:request_id>/decision/", AccommodationChangeRequestDecisionView.as_view()),
    path("managed/", ManagedBookingsView.as_view()),
    path("managed/<int:booking_id>/transfer-options/", ManagedBookingTransferOptionsView.as_view()),
    path("managed/<int:booking_id>/terminate/", ManagedBookingTerminationView.as_view()),
    path("managed/<int:booking_id>/transfer/", ManagedBookingTransferView.as_view()),
]
