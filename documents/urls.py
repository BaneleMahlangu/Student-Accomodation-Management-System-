from django.urls import path

from .views import (
    DocumentDownloadView,
    DocumentPreviewView,
    LandlordDocumentDecisionView,
    LandlordDocumentListView,
    StudentDocumentDeleteView,
    StudentDocumentListCreateView,
)


urlpatterns = [

    path(
        "download/<int:document_id>/",
        DocumentDownloadView.as_view(),
        name="document-download",
    ),
    path(
        "preview/<int:document_id>/",
        DocumentPreviewView.as_view(),
        name="document-preview",
    ),

    path(
        "application/<int:application_id>/",
        StudentDocumentListCreateView.as_view(),
        name="student-documents",
    ),

    path(
        "<int:document_id>/",
        StudentDocumentDeleteView.as_view(),
        name="student-document-delete",
    ),

    path(
        "landlord/application/<int:application_id>/",
        LandlordDocumentListView.as_view(),
        name="landlord-document-list",
    ),

    path(
        "landlord/<int:document_id>/decision/",
        LandlordDocumentDecisionView.as_view(),
        name="landlord-document-decision",
    ),
]
