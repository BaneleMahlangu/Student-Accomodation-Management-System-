from decimal import Decimal, ROUND_HALF_UP

from django.core.paginator import Paginator
from django.db import IntegrityError, transaction
from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from analytics.services import record_audit_event
from bookings.models import Booking

from .models import Property, PropertyReview
from .review_services import submit_property_review

VISIBLE_REVIEW_STATUSES = (PropertyReview.Status.PUBLISHED, PropertyReview.Status.PENDING)


def _resident_booking_filter():
    return Q(status=Booking.Status.ACTIVE, checked_in_at__isnull=False) | Q(
        status=Booking.Status.COMPLETED,
        checked_in_at__isnull=False,
        checked_out_at__isnull=False,
    ) | Q(
        status=Booking.Status.CANCELLED,
        checked_in_at__isnull=False,
        checked_out_at__isnull=False,
    )


def _is_resident_booking(booking):
    return (booking.status == Booking.Status.ACTIVE and booking.checked_in_at is not None) or (
        booking.status == Booking.Status.COMPLETED
        and booking.checked_in_at is not None
        and booking.checked_out_at is not None
    ) or (
        booking.status == Booking.Status.CANCELLED
        and booking.checked_in_at is not None
        and booking.checked_out_at is not None
    )


def serialize_review(review, *, include_private_details=False):
    row = {
        "id": review.id,
        "property": review.property_id,
        "property_name": review.property.name,
        "rating": review.rating,
        "title": review.title,
        "body": review.body,
        "status": review.status,
        "created_at": review.created_at,
    }
    if include_private_details:
        row.update({
            "booking": review.booking_id,
            "student_name": review.student.get_full_name(),
            "student_email": review.student.email,
        })
    else:
        # Reviews are tied to verified residence bookings but never expose identities.
        row["reviewer"] = "Verified Student Haven resident"
    return row


class PropertyReviewFeedView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, property_id):
        property_obj = get_object_or_404(Property, id=property_id, status=Property.PropertyStatus.APPROVED)
        reviews = PropertyReview.objects.filter(property=property_obj, status__in=VISIBLE_REVIEW_STATUSES).select_related("property", "student", "booking")
        data = [serialize_review(review) for review in reviews]
        eligible_bookings = []
        own_reviews = []
        if request.user.is_authenticated and request.user.role == User.Role.STUDENT:
            eligible = Booking.objects.filter(
                property=property_obj,
                student=request.user,
            ).filter(_resident_booking_filter()).filter(
                property_review__isnull=True,
            ).order_by("-checked_in_at", "-created_at")
            eligible_bookings = [{
                "id": booking.id,
                "booking_number": booking.booking_number,
                "status": booking.status,
                "checked_out_at": booking.checked_out_at,
            } for booking in eligible]
            own_reviews = [
                serialize_review(review, include_private_details=True)
                for review in PropertyReview.objects.filter(
                    property=property_obj,
                    student=request.user,
                    status__in=VISIBLE_REVIEW_STATUSES,
                ).select_related("property", "student")
            ]
        visible_reviews = PropertyReview.objects.filter(property=property_obj, status__in=VISIBLE_REVIEW_STATUSES)
        aggregate = visible_reviews.aggregate(value=Avg("rating"))
        average = aggregate["value"]
        return Response({
            "success": True,
            "property": property_obj.id,
            "viewer_is_student": bool(request.user.is_authenticated and request.user.role == User.Role.STUDENT),
            "average_rating": str(Decimal(str(average)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)) if average is not None else None,
            "review_count": visible_reviews.count(),
            "reviews": data,
            "eligible_bookings": eligible_bookings,
            "my_reviews": own_reviews,
        })

    def post(self, request, property_id):
        if not request.user.is_authenticated:
            return Response({"success": False, "message": "Sign in as a student with a residence booking to leave a review."}, status=status.HTTP_401_UNAUTHORIZED)
        if request.user.role != User.Role.STUDENT:
            return Response({"success": False, "message": "Student access is required."}, status=status.HTTP_403_FORBIDDEN)
        property_obj = get_object_or_404(Property, id=property_id, status=Property.PropertyStatus.APPROVED)
        title = str(request.data.get("title", "")).strip()
        body = str(request.data.get("body", "")).strip()
        try:
            booking_id = int(request.data.get("booking_id"))
            rating = int(request.data.get("rating"))
        except (TypeError, ValueError):
            return Response({"success": False, "message": "Select your residence booking and a rating from 1 to 5."}, status=status.HTTP_400_BAD_REQUEST)
        if not 1 <= rating <= 5:
            return Response({"success": False, "message": "Choose a rating from 1 to 5 stars."}, status=status.HTTP_400_BAD_REQUEST)
        if not title or len(title) > 120 or not body or len(body) > 2500:
            return Response({"success": False, "message": "Enter a short title and a review of up to 2,500 characters."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            with transaction.atomic():
                booking = get_object_or_404(
                    Booking.objects.select_for_update(),
                    id=booking_id,
                    property=property_obj,
                    student=request.user,
                )
                if not _is_resident_booking(booking):
                    return Response({"success": False, "message": "You can review this property after check-in, while staying there, or after a completed stay."}, status=status.HTTP_409_CONFLICT)
                review = submit_property_review(
                    property_id=property_obj.id,
                    booking_id=booking.id,
                    student_id=request.user.id,
                    rating=rating,
                    title=title,
                    body=body,
                )
                record_audit_event(actor=request.user, action="PROPERTY_REVIEW_SUBMITTED", entity_type="property_review", entity_id=review.id, summary=f"Verified-stay review submitted for {property_obj.name}", metadata={"status": review.status, "fields": ["rating", "title", "body"]}, request=request)
            return Response({"success": True, "review": serialize_review(review), "message": "Your review is live on the property page and reviews page."}, status=status.HTTP_201_CREATED)
        except IntegrityError:
            return Response({"success": False, "message": "A review has already been submitted for this stay."}, status=status.HTTP_409_CONFLICT)


class AdminPropertyReviewsView(APIView):
    permission_classes = [IsAuthenticated]

    def _is_admin(self, user):
        return user.role == User.Role.ADMINISTRATOR or user.is_superuser

    def get(self, request):
        if not self._is_admin(request.user):
            return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)
        queryset = PropertyReview.objects.select_related("property", "student", "booking").order_by("-created_at", "-id")
        return Response({"success": True, "reviews": [serialize_review(review, include_private_details=True) for review in queryset[:500]]})


class LandlordPropertyReviewsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.LANDLORD:
            return Response({"success": False, "message": "Landlord access is required."}, status=status.HTTP_403_FORBIDDEN)

        reviews = PropertyReview.objects.filter(
            property__landlord_id=request.user.id,
            status__in=VISIBLE_REVIEW_STATUSES,
        ).select_related("property", "student", "booking").order_by("-created_at", "-id")
        summary = reviews.aggregate(average=Avg("rating"), count=Count("id"))
        average = summary["average"]
        paginator = Paginator(reviews, 24)
        page = paginator.get_page(request.query_params.get("page", 1))
        return Response({
            "success": True,
            "count": summary["count"],
            "average_rating": str(Decimal(str(average)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)) if average is not None else None,
            "page": page.number,
            "total_pages": paginator.num_pages,
            "has_previous": page.has_previous(),
            "has_next": page.has_next(),
            "reviews": [serialize_review(review) for review in page.object_list],
        })


class AllPropertyReviewsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        queryset = PropertyReview.objects.filter(
            property__status=Property.PropertyStatus.APPROVED,
            status__in=VISIBLE_REVIEW_STATUSES,
        ).select_related("property", "student", "booking")
        paginator = Paginator(queryset, 24)
        page = paginator.get_page(request.query_params.get("page", 1))
        return Response({
            "success": True,
            "count": paginator.count,
            "page": page.number,
            "total_pages": paginator.num_pages,
            "has_previous": page.has_previous(),
            "has_next": page.has_next(),
            "reviews": [serialize_review(review) for review in page.object_list],
        })
