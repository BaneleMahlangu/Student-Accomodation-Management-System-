from django.urls import path

from .views import (
    SignStudentContractView,
    StudentContractView,
    LandlordContractsView,
)


urlpatterns = [
    path("landlord/", LandlordContractsView.as_view(), name="landlord-contracts"),
    path(
        "application/<int:application_id>/",
        StudentContractView.as_view(),
        name="student-contract",
    ),
    path(
        "application/<int:application_id>/sign/",
        SignStudentContractView.as_view(),
        name="sign-student-contract",
    ),
]
