"""
URL configuration for student_haven_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path



urlpatterns = [
    path(
        "api/core/",
        include("core.urls"),
    ),

    path(
        "admin/",
        admin.site.urls,
    ),

    path(
        "api/accounts/",
        include("accounts.urls"),
    ),

    path(
        "api/accommodations/",
        include("accommodations.urls"),
    ),

    path(
    "api/applications/",
    include("applications.urls"),
),
    path(
    "api/contracts/",
    include("contracts.urls"),
),
    
    path(
    "api/funding/",
    include("funding.urls"),
),
    
    path(
    "api/bookings/",
    include("bookings.urls"),
),
    
    path(
    "api/documents/",
    include("documents.urls"),
),
    path(
    "api/maintenance/",
    include("maintenance.urls"),
),
    
    path(
    "api/notifications/",
    include("notifications.urls"),
),

    path(
        "api/waiting-list/",
        include("waitinglist.urls"),
    ),

    path(
        "api/complaints/",
        include("complaints.urls"),
    ),

    path(
        "api/messaging/",
        include("messaging.urls"),
    ),

    path(
        "api/analytics/",
        include("analytics.urls"),
    ),

    path(
        "api/risk/",
        include("risk.urls"),
    ),
    
]


if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )
