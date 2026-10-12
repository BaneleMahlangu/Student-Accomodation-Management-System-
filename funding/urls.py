from django.urls import path

from .views import (
    AdminFundingRecordsView,
    AdminSponsorshipApplicationsView,
    AdminSponsorshipProgramDetailView,
    AdminSponsorshipProgramsView,
    StudentFundingPaymentView,
    StudentPaymentView,
    StudentSponsorshipApplicationsView,
    StudentSponsorshipApplyView,
    SponsorshipProgramsView,
    LandlordFundingRecordsView,
    PayFastConfigurationView,
    PayFastCheckoutView,
    PayFastCancelView,
    PayFastITNView,
)
from .refunds import AdminRefundRequestsView, StudentRefundRequestsView


urlpatterns = [
    path("application/<int:application_id>/refunds/", StudentRefundRequestsView.as_view(), name="student-refund-requests"),
    path("admin/refunds/", AdminRefundRequestsView.as_view(), name="admin-refund-requests"),
    path("admin/refunds/<int:refund_id>/", AdminRefundRequestsView.as_view(), name="admin-refund-decision"),
    path("payfast/config/", PayFastConfigurationView.as_view(), name="payfast-configuration"),
    path("payfast/notify/", PayFastITNView.as_view(), name="payfast-itn"),
    path("application/<int:application_id>/payfast/checkout/", PayFastCheckoutView.as_view(), name="payfast-checkout"),
    path("application/<int:application_id>/payfast/cancel/", PayFastCancelView.as_view(), name="payfast-cancel"),
    path("landlord/records/", LandlordFundingRecordsView.as_view(), name="landlord-funding-records"),
    path("admin/records/", AdminFundingRecordsView.as_view(), name="admin-funding-records"),
    path("admin/records/<int:record_id>/", AdminFundingRecordsView.as_view(), name="admin-funding-record-decision"),
    path("programs/", SponsorshipProgramsView.as_view(), name="sponsorship-programs"),
    path("programs/<int:program_id>/apply/", StudentSponsorshipApplyView.as_view(), name="sponsorship-apply"),
    path("my-sponsorship-applications/", StudentSponsorshipApplicationsView.as_view(), name="student-sponsorship-applications"),
    path("admin/sponsorship-programs/", AdminSponsorshipProgramsView.as_view(), name="admin-sponsorship-programs"),
    path("admin/sponsorship-programs/<int:program_id>/", AdminSponsorshipProgramDetailView.as_view(), name="admin-sponsorship-program-detail"),
    path("admin/sponsorship-applications/", AdminSponsorshipApplicationsView.as_view(), name="admin-sponsorship-applications"),
    path("admin/sponsorship-applications/<int:application_id>/", AdminSponsorshipApplicationsView.as_view(), name="admin-sponsorship-application-decision"),
    path(
        "application/<int:application_id>/",
        StudentFundingPaymentView.as_view(),
        name="student-funding-payment",
    ),
    path(
        "application/<int:application_id>/pay/",
        StudentPaymentView.as_view(),
        name="student-payment",
    ),
]
