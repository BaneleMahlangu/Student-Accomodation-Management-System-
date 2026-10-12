from django.urls import path

from .views import (
    ApplicationCreateView,
    MyApplicationsView,
    ApplicationDetailView,
    ApplicationSubmitView,
    ApplicationStartReviewView,
    ApplicationReopenReviewView,
    ApplicationDecisionView,
    AdminApplicationsView,
    AdminApplicationReviewView,
    AdminApplicationEligibilityView,
    LandlordApplicationsView,
)
from .appeals import AdminApplicationAppealsView, StudentApplicationAppealView

urlpatterns = [
    path("appeals/admin/", AdminApplicationAppealsView.as_view(), name="admin-application-appeals"),
    path("appeals/admin/<int:appeal_id>/", AdminApplicationAppealsView.as_view(), name="admin-application-appeal-review"),
    path("<int:application_id>/appeal/", StudentApplicationAppealView.as_view(), name="student-application-appeal"),

    path(
        "",
        ApplicationCreateView.as_view(),
        name="application-create",
    ),

    path(
        "mine/",
        MyApplicationsView.as_view(),
        name="my-applications",
    ),
    
    path(
        "admin/",
        AdminApplicationsView.as_view(),
        name="admin-applications",
    ),

    path("landlord/", LandlordApplicationsView.as_view(), name="landlord-applications"),

    path(
        "admin/<int:application_id>/",
        AdminApplicationReviewView.as_view(),
        name="admin-application-review",
   ),
    path(
        "admin/<int:application_id>/eligibility/",
        AdminApplicationEligibilityView.as_view(),
        name="admin-application-eligibility",
    ),
    
    
    path(
        "<int:application_id>/",
        ApplicationDetailView.as_view(),
        name="application-detail",
    ),

    path(
        "<int:application_id>/submit/",
        ApplicationSubmitView.as_view(),
        name="application-submit",
    ),

     path(
        "<int:application_id>/start-review/",
        ApplicationStartReviewView.as_view(),
        name="application-start-review",
    ),

    path(
        "<int:application_id>/reopen-review/",
        ApplicationReopenReviewView.as_view(),
        name="application-reopen-review",
    ),

    path(
        "<int:application_id>/decision/",
        ApplicationDecisionView.as_view(),
        name="application-decision",
    ),

    
]
