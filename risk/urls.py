from django.urls import path

from .views import (
    AdminLandlordRiskSignalDecisionView,
    AdminLandlordRiskSignalsView,
    AdminRiskSignalDecisionView,
    AdminRiskSignalsView,
)


urlpatterns = [
    path("admin/signals/", AdminRiskSignalsView.as_view(), name="admin-risk-signals"),
    path("admin/signals/refresh/", AdminRiskSignalsView.as_view(), name="admin-risk-signals-refresh"),
    path("admin/signals/<int:signal_id>/decision/", AdminRiskSignalDecisionView.as_view(), name="admin-risk-signal-decision"),
    path("admin/landlord-signals/", AdminLandlordRiskSignalsView.as_view(), name="admin-landlord-risk-signals"),
    path("admin/landlord-signals/<int:signal_id>/decision/", AdminLandlordRiskSignalDecisionView.as_view(), name="admin-landlord-risk-signal-decision"),
]
