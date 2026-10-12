from django.urls import path

from .views import (
    AccommodationRecommendationsView,
    AccommodationManagementOptionsView,
    AdminPropertyReviewView,
    LandlordBedCollectionView,
    LandlordBuildingCollectionView,
    LandlordFloorCollectionView,
    LandlordPropertyDetailView,
    LandlordPropertyImageView,
    LandlordPropertyListCreateView,
    LandlordPropertySubmitView,
    LandlordRoomCollectionView,
    LandlordStructureDetailView,
    PropertyListView,
    PropertyDetailView,
    StudentFavoritePropertiesView,
    StudentFavoritePropertyView,
)
from .reviews import AdminPropertyReviewsView, AllPropertyReviewsView, LandlordPropertyReviewsView, PropertyReviewFeedView


urlpatterns = [
    path("reviews/", AllPropertyReviewsView.as_view(), name="all-property-reviews"),
    path("properties/<int:property_id>/reviews/", PropertyReviewFeedView.as_view(), name="property-reviews"),
    path("landlord/reviews/", LandlordPropertyReviewsView.as_view(), name="landlord-property-reviews"),
    path("admin/property-reviews/", AdminPropertyReviewsView.as_view(), name="admin-property-reviews"),
    path("favorites/", StudentFavoritePropertiesView.as_view(), name="student-favorite-properties"),
    path("favorites/<int:property_id>/", StudentFavoritePropertyView.as_view(), name="student-favorite-property"),
    path("recommendations/", AccommodationRecommendationsView.as_view(), name="accommodation-recommendations"),
    path(
        "properties/",
        PropertyListView.as_view(),
        name="property-list",
    ),

    path(
        "properties/<int:property_id>/",
        PropertyDetailView.as_view(),
        name="property-detail",
    ),

    path("landlord/options/", AccommodationManagementOptionsView.as_view(), name="landlord-accommodation-options"),
    path("landlord/properties/", LandlordPropertyListCreateView.as_view(), name="landlord-properties"),
    path("landlord/properties/<int:property_id>/", LandlordPropertyDetailView.as_view(), name="landlord-property-detail"),
    path("landlord/properties/<int:property_id>/submit/", LandlordPropertySubmitView.as_view(), name="landlord-property-submit"),
    path("landlord/properties/<int:property_id>/images/", LandlordPropertyImageView.as_view(), name="landlord-property-image-upload"),
    path("landlord/properties/<int:property_id>/images/<int:image_id>/", LandlordPropertyImageView.as_view(), name="landlord-property-image-detail"),
    path("landlord/properties/<int:parent_id>/buildings/", LandlordBuildingCollectionView.as_view(), name="landlord-property-buildings"),
    path("landlord/buildings/<int:parent_id>/floors/", LandlordFloorCollectionView.as_view(), name="landlord-building-floors"),
    path("landlord/floors/<int:parent_id>/rooms/", LandlordRoomCollectionView.as_view(), name="landlord-floor-rooms"),
    path("landlord/rooms/<int:parent_id>/beds/", LandlordBedCollectionView.as_view(), name="landlord-room-beds"),
    path("landlord/structures/<str:kind>/<int:object_id>/", LandlordStructureDetailView.as_view(), name="landlord-structure-detail"),
    path("admin/properties/", AdminPropertyReviewView.as_view(), name="admin-property-review-list"),
    path("admin/properties/<int:property_id>/decision/", AdminPropertyReviewView.as_view(), name="admin-property-review-decision"),
]
