from django.urls import path

from .views import (
    StudentRegistrationView,
    LandlordRegistrationView,
    LoginView,
    LogoutView,
    CurrentUserView,
    CSRFView,
    AdminDirectoryView,
    AdminAccountStatusView,
    AdminAccountDeleteView,
    VerifyEmailView,
    ResendVerificationCodeView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    TwoFactorSettingsView,
    ConfirmTwoFactorView,
    DisableTwoFactorView,
    AccountSecurityHistoryView,
    RevokeAccountSessionView,
    RevokeOtherAccountSessionsView,
    NotificationPreferencesView,
    AccountEmailChangeRequestView,
    AccountEmailChangeConfirmView,
    StudentPrivacySettingsView,
    StudentProfilePhotoView,
    StudentProfilePhotoFileView,
)


urlpatterns = [

    path(
        "register/student/",
        StudentRegistrationView.as_view(),
        name="student-register",
    ),

    path(
        "register/landlord/",
        LandlordRegistrationView.as_view(),
        name="landlord-register",
    ),

    path(
        "login/",
        LoginView.as_view(),
        name="login",
    ),

    path(
        "logout/",
        LogoutView.as_view(),
        name="logout",
    ),

    path(
        "me/",
        CurrentUserView.as_view(),
        name="current-user",
    ),

    path(
        "csrf/",
        CSRFView.as_view(),
        name="csrf",
    ),

    path("verify-email/", VerifyEmailView.as_view(), name="verify-email"),
    path("verify-email/resend/", ResendVerificationCodeView.as_view(), name="resend-verification-code"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("security/two-factor/", TwoFactorSettingsView.as_view(), name="two-factor-settings"),
    path("security/two-factor/confirm/", ConfirmTwoFactorView.as_view(), name="two-factor-confirm"),
    path("security/two-factor/disable/", DisableTwoFactorView.as_view(), name="two-factor-disable"),
    path("security/history/", AccountSecurityHistoryView.as_view(), name="account-security-history"),
    path("security/sessions/<int:session_id>/", RevokeAccountSessionView.as_view(), name="revoke-account-session"),
    path("security/sessions/revoke-others/", RevokeOtherAccountSessionsView.as_view(), name="revoke-other-account-sessions"),
    path("notification-preferences/", NotificationPreferencesView.as_view(), name="notification-preferences"),
    path("email-change/request/", AccountEmailChangeRequestView.as_view(), name="email-change-request"),
    path("email-change/confirm/", AccountEmailChangeConfirmView.as_view(), name="email-change-confirm"),
    path("privacy-settings/", StudentPrivacySettingsView.as_view(), name="student-privacy-settings"),
    path("profile/photo/", StudentProfilePhotoView.as_view(), name="student-profile-photo"),
    path("profile/photo/file/", StudentProfilePhotoFileView.as_view(), name="student-profile-photo-file"),

    path(
        "admin/<str:kind>/",
        AdminDirectoryView.as_view(),
        name="admin-account-directory",
    ),
    path(
        "admin/<str:kind>/<int:user_id>/status/",
        AdminAccountStatusView.as_view(),
        name="admin-account-status",
    ),
    path(
        "admin/<str:kind>/<int:user_id>/delete/",
        AdminAccountDeleteView.as_view(),
        name="admin-account-delete",
    ),
]
