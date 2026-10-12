from django.urls import path

from .views import (
    StudentMaintenanceListCreateView,
    StudentMaintenanceDetailView,
    StudentMaintenanceConfirmView,
    AdminMaintenanceListView,
    AdminMaintenanceUpdateView,
    LandlordMaintenanceView,
)


urlpatterns = [
    path(
        "application/<int:application_id>/",
        StudentMaintenanceListCreateView.as_view(),
    ),

    path(
        "<int:request_id>/",
        StudentMaintenanceDetailView.as_view(),
    ),
    
    path(
    "<int:request_id>/confirm/",
    StudentMaintenanceConfirmView.as_view(),
),

    path(
        "admin/",
        AdminMaintenanceListView.as_view(),
    ),

    path(
        "admin/<int:request_id>/",
        AdminMaintenanceUpdateView.as_view(),
    ),
    path("landlord/", LandlordMaintenanceView.as_view()),
    path("landlord/<int:request_id>/", LandlordMaintenanceView.as_view()),
]
