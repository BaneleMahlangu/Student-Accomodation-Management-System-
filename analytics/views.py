from django.shortcuts import render

# Create your views here.
import calendar
from urllib.parse import quote
from datetime import date, timedelta

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User, LandlordProfile
from accommodations.models import Bed, Property, Room
from applications.models import Application
from complaints.models import Complaint
from contracts.models import Contract
from documents.models import Document
from funding.models import FundingPayment, PaymentTransaction
from bookings.models import Booking
from maintenance.models import MaintenanceRequest
from waitinglist.models import WaitingListEntry

from .models import AuditEvent, ReportSchedule
from .reports import REPORT_TYPES, build_report, report_csv


def _next_report_run(frequency, base=None):
    current = timezone.localtime(base or timezone.now())
    if frequency == ReportSchedule.Frequency.DAILY:
        return current + timedelta(days=1)
    if frequency == ReportSchedule.Frequency.WEEKLY:
        return current + timedelta(days=7)
    month = current.month % 12 + 1
    year = current.year + (1 if current.month == 12 else 0)
    day = min(current.day, calendar.monthrange(year, month)[1])
    return current.replace(year=year, month=month, day=day)


def _schedule_payload(item):
    return {
        "id": item.id,
        "report_type": item.report_type,
        "report_label": item.get_report_type_display(),
        "frequency": item.frequency,
        "frequency_label": item.get_frequency_display(),
        "recipient_email": item.created_by.email,
        "next_run_at": item.next_run_at,
        "last_sent_at": item.last_sent_at,
        "last_error": item.last_error,
        "is_active": item.is_active,
    }


def _admin_error(request):
    if request.user.role != User.Role.ADMINISTRATOR and not request.user.is_superuser:
        return Response({"success": False, "message": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)
    return None


class AdminOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        error = _admin_error(request)
        if error:
            return error
        try:
            days = max(1, min(int(request.query_params.get("days", "30")), 365))
        except ValueError:
            return Response({"success": False, "message": "Choose a reporting period from 1 to 365 days."}, status=status.HTTP_400_BAD_REQUEST)

        start = timezone.now() - timedelta(days=days)
        roles = {row["role"]: row["count"] for row in User.objects.values("role").annotate(count=Count("id"))}
        property_statuses = {row["status"]: row["count"] for row in Property.objects.values("status").annotate(count=Count("id"))}
        application_statuses = {row["status"]: row["count"] for row in Application.objects.values("status").annotate(count=Count("id"))}
        bed_counts = Bed.objects.aggregate(
            total=Count("id"),
            available=Count("id", filter=Q(status=Bed.BedStatus.AVAILABLE)),
            reserved=Count("id", filter=Q(status=Bed.BedStatus.RESERVED)),
            occupied=Count("id", filter=Q(status=Bed.BedStatus.OCCUPIED)),
            blocked=Count("id", filter=Q(status=Bed.BedStatus.BLOCKED)),
        )
        funding_totals = FundingPayment.objects.aggregate(
            amount_due=Sum("amount_due"),
            amount_paid=Sum("amount_paid"),
        )
        successful_transactions = PaymentTransaction.objects.filter(status=PaymentTransaction.Status.SUCCESSFUL)
        transaction_totals = successful_transactions.aggregate(amount=Sum("amount"), count=Count("id"))
        occupied_percent = round((bed_counts["occupied"] + bed_counts["reserved"]) * 100 / bed_counts["total"]) if bed_counts["total"] else 0

        property_occupancy = Property.objects.filter(status=Property.PropertyStatus.APPROVED).annotate(
            total_beds=Count("buildings__floors__rooms__beds", distinct=True),
            occupied_beds=Count("buildings__floors__rooms__beds", filter=Q(buildings__floors__rooms__beds__status=Bed.BedStatus.OCCUPIED), distinct=True),
            available_beds=Count("buildings__floors__rooms__beds", filter=Q(buildings__floors__rooms__beds__status=Bed.BedStatus.AVAILABLE), distinct=True),
        ).order_by("-occupied_beds", "name")[:10]

        app_trend = Application.objects.filter(created_at__gte=timezone.now() - timedelta(days=180)).annotate(month=TruncMonth("created_at")).values("month").annotate(count=Count("id")).order_by("month")
        registration_trend = User.objects.filter(created_at__gte=timezone.now() - timedelta(days=180)).annotate(month=TruncMonth("created_at")).values("month", "role").annotate(count=Count("id")).order_by("month", "role")
        revenue_trend = successful_transactions.filter(processed_at__gte=timezone.now() - timedelta(days=180)).annotate(month=TruncMonth("processed_at")).values("month").annotate(amount=Sum("amount")).order_by("month")

        today = timezone.localdate()
        next_month = date(today.year + (today.month // 12), (today.month % 12) + 1, 1)
        approved_capacity = Property.objects.filter(
            status=Property.PropertyStatus.APPROVED,
        ).aggregate(total=Count("buildings__floors__rooms__beds", distinct=True))["total"] or 0
        booking_states = [Booking.Status.CONFIRMED, Booking.Status.ACTIVE]
        monthly_outlook = []
        for month_offset in range(6):
            month_number = next_month.month - 1 + month_offset
            year = next_month.year + month_number // 12
            month = month_number % 12 + 1
            month_start = date(year, month, 1)
            month_end = date(year, month, calendar.monthrange(year, month)[1])
            bookings = Booking.objects.filter(
                property__status=Property.PropertyStatus.APPROVED,
                status__in=booking_states,
            )
            occupied_at_month_end = bookings.filter(
                start_date__lte=month_end,
                end_date__gte=month_end,
            ).values("bed_id").distinct().count()
            move_ins = bookings.filter(start_date__gte=month_start, start_date__lte=month_end).values("bed_id").distinct().count()
            scheduled_vacancies = bookings.filter(end_date__gte=month_start, end_date__lte=month_end).values("bed_id").distinct().count()
            monthly_outlook.append({
                "month": month_start.isoformat(),
                "known_occupied_beds": min(occupied_at_month_end, approved_capacity),
                "known_occupancy_percent": round(min(occupied_at_month_end, approved_capacity) * 100 / approved_capacity) if approved_capacity else 0,
                "known_move_ins": move_ins,
                "scheduled_vacancies": scheduled_vacancies,
            })

        recent_activity_start = today - timedelta(days=90)
        recent_applications = Application.objects.filter(created_at__date__gte=recent_activity_start).exclude(status="DRAFT")
        average_monthly_applications = round(recent_applications.count() / 3, 1)
        recent_waitlist = WaitingListEntry.objects.filter(
            created_at__date__gte=recent_activity_start,
            status__in=[WaitingListEntry.Status.WAITING, WaitingListEntry.Status.OFFERED],
        )
        average_monthly_waitlist_entries = round(recent_waitlist.count() / 3, 1)
        demand_by_type_and_location = list(
            recent_applications.values(
                "property__campus__name",
                "room__room_type__name",
            ).annotate(requests=Count("id")).order_by("-requests")[:8]
        )

        return Response({
            "success": True,
            "period_days": days,
            "generated_at": timezone.now(),
            "users": {
                "total": User.objects.count(),
                "students": roles.get(User.Role.STUDENT, 0),
                "landlords": roles.get(User.Role.LANDLORD, 0),
                "administrators": roles.get(User.Role.ADMINISTRATOR, 0),
                "verified_landlords": LandlordProfile.objects.filter(verification_status="VERIFIED").count(),
                "pending_landlord_verification": LandlordProfile.objects.filter(verification_status="PENDING").count(),
                "new_in_period": User.objects.filter(created_at__gte=start).count(),
            },
            "properties": {
                "total": Property.objects.count(),
                "approved": property_statuses.get(Property.PropertyStatus.APPROVED, 0),
                "pending": property_statuses.get(Property.PropertyStatus.PENDING, 0),
                "draft": property_statuses.get(Property.PropertyStatus.DRAFT, 0),
                "rejected_or_suspended": property_statuses.get(Property.PropertyStatus.REJECTED, 0) + property_statuses.get(Property.PropertyStatus.SUSPENDED, 0),
            },
            "beds": {**bed_counts, "occupancy_percent": occupied_percent},
            "applications": {
                "total": Application.objects.count(),
                "in_period": Application.objects.filter(created_at__gte=start).count(),
                "by_status": application_statuses,
                "monthly_trend": list(app_trend),
            },
            "registrations_by_month": list(registration_trend),
            "finance": {
                "amount_due": funding_totals["amount_due"] or 0,
                "amount_paid": funding_totals["amount_paid"] or 0,
                "successful_transaction_total": transaction_totals["amount"] or 0,
                "successful_transaction_count": transaction_totals["count"] or 0,
                "revenue_by_month": list(revenue_trend),
            },
            "complaints": {
                "open": Complaint.objects.filter(status__in=[Complaint.Status.OPEN, Complaint.Status.UNDER_REVIEW, Complaint.Status.AWAITING_RESPONSE, Complaint.Status.ESCALATED]).count(),
                "total": Complaint.objects.count(),
            },
            "maintenance": {
                "open": MaintenanceRequest.objects.exclude(status__in=[MaintenanceRequest.Status.RESOLVED, MaintenanceRequest.Status.STUDENT_CONFIRMED, MaintenanceRequest.Status.CANCELLED]).count(),
                "total": MaintenanceRequest.objects.count(),
            },
            "waiting_list": {
                "waiting": WaitingListEntry.objects.filter(status=WaitingListEntry.Status.WAITING).count(),
                "offers": WaitingListEntry.objects.filter(status=WaitingListEntry.Status.OFFERED).count(),
            },
            "property_occupancy": [{
                "id": item.id,
                "name": item.name,
                "total_beds": item.total_beds,
                "occupied_beds": item.occupied_beds,
                "available_beds": item.available_beds,
                "occupancy_percent": round(item.occupied_beds * 100 / item.total_beds) if item.total_beds else 0,
            } for item in property_occupancy],
            "occupancy_outlook": {
                "method": "Known confirmed and active booking dates at month end; application and wait-list demand use the trailing 90-day monthly average.",
                "approved_bed_capacity": approved_capacity,
                "average_monthly_applications": average_monthly_applications,
                "average_monthly_waitlist_entries": average_monthly_waitlist_entries,
                "demand_by_type_and_location": [{
                    "campus": row["property__campus__name"] or "Unspecified campus",
                    "room_type": row["room__room_type__name"] or "Unspecified room type",
                    "application_count": row["requests"],
                } for row in demand_by_type_and_location],
                "monthly": monthly_outlook,
            },
        })


class AdminAuditLogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        error = _admin_error(request)
        if error:
            return error
        events = AuditEvent.objects.select_related("actor")
        action = request.query_params.get("action", "").strip()
        entity_type = request.query_params.get("entity_type", "").strip()
        search = request.query_params.get("search", "").strip()
        if action:
            events = events.filter(action__icontains=action)
        if entity_type:
            events = events.filter(entity_type__iexact=entity_type)
        if search:
            search_filter = Q(summary__icontains=search) | Q(actor__email__icontains=search)
            if search.isdigit():
                search_filter |= Q(entity_id=int(search))
            events = events.filter(search_filter)
        try:
            limit = max(1, min(int(request.query_params.get("limit", "100")), 500))
        except ValueError:
            limit = 100
        records = events[:limit]
        return Response({"success": True, "count": events.count(), "events": [{
            "id": event.id,
            "actor": event.actor_id,
            "actor_name": event.actor.get_full_name() if event.actor else "System",
            "actor_email": event.actor.email if event.actor else "",
            "action": event.action,
            "entity_type": event.entity_type,
            "entity_id": event.entity_id,
            "summary": event.summary,
            "metadata": event.metadata,
            "ip_address": event.ip_address,
            "created_at": event.created_at,
        } for event in records]})


class AdminGlobalSearchView(APIView):
    """Small, permission-scoped suggestions for the administrator command centre."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        error = _admin_error(request)
        if error:
            return error

        term = request.query_params.get("q", "").strip()[:100]
        if len(term) < 2:
            return Response({"success": True, "query": term, "results": []})

        exact_id = int(term) if term.isdigit() else None
        search_query = quote(term, safe="")
        results = []

        def add(kind, label, detail, path):
            results.append({"kind": kind, "label": str(label), "detail": str(detail), "path": path})

        students = User.objects.filter(role=User.Role.STUDENT).filter(
            Q(email__icontains=term) | Q(first_name__icontains=term) |
            Q(last_name__icontains=term) | Q(mobile__icontains=term) |
            Q(student_profile__student_number__icontains=term) |
            (Q(pk=exact_id) if exact_id else Q(pk__in=[]))
        ).select_related("student_profile").order_by("last_name", "first_name")[:5]
        for item in students:
            number = getattr(getattr(item, "student_profile", None), "student_number", "")
            add("Student", item.get_full_name() or item.email,
                f"{item.email}{' · ' + number if number else ''}", f"/admin/students?search={search_query}")

        landlords = User.objects.filter(role=User.Role.LANDLORD).filter(
            Q(email__icontains=term) | Q(first_name__icontains=term) |
            Q(last_name__icontains=term) | Q(mobile__icontains=term) |
            Q(landlord_profile__business_name__icontains=term) |
            (Q(pk=exact_id) if exact_id else Q(pk__in=[]))
        ).select_related("landlord_profile").order_by("last_name", "first_name")[:5]
        for item in landlords:
            business = getattr(getattr(item, "landlord_profile", None), "business_name", "")
            add("Landlord", business or item.get_full_name() or item.email,
                f"{item.email}{' · ' + item.get_full_name() if business else ''}", f"/admin/landlords?search={search_query}")

        applications = Application.objects.filter(
            Q(application_number__icontains=term) | Q(student__email__icontains=term) |
            Q(student__first_name__icontains=term) | Q(student__last_name__icontains=term) |
            Q(student__student_profile__student_number__icontains=term) |
            Q(property__name__icontains=term) | Q(room__room_number__icontains=term) |
            (Q(pk=exact_id) if exact_id else Q(pk__in=[]))
        ).select_related("student", "property", "room").order_by("-created_at")[:6]
        for item in applications:
            add("Application", item.application_number,
                f"{item.student.get_full_name() or item.student.email} · {item.property.name} · Room {item.room.room_number} · {item.status.replace('_', ' ').title()}",
                f"/admin/applications/{item.id}")

        properties = Property.objects.filter(
            Q(name__icontains=term) | Q(address__icontains=term) |
            Q(landlord__email__icontains=term) | Q(campus__name__icontains=term) |
            (Q(pk=exact_id) if exact_id else Q(pk__in=[]))
        ).select_related("landlord", "campus").order_by("name")[:5]
        for item in properties:
            destination = f"/accommodation/{item.id}" if item.status == Property.PropertyStatus.APPROVED else "/admin/properties"
            add("Property", item.name, f"{item.campus.name} · {item.landlord.email} · {item.status.replace('_', ' ').title()}", destination)

        rooms = Room.objects.filter(
            Q(room_number__icontains=term) | Q(floor__building__property__name__icontains=term) |
            Q(floor__building__property__landlord__email__icontains=term) |
            Q(beds__bed_number__icontains=term) |
            (Q(pk=exact_id) if exact_id else Q(pk__in=[]))
        ).select_related("floor__building__property").distinct().order_by("floor__building__property__name", "room_number")[:5]
        for item in rooms:
            property_obj = item.floor.building.property
            add("Room", f"{property_obj.name} · Room {item.room_number}", f"{item.status.replace('_', ' ').title()} · {item.capacity} bed capacity", f"/accommodation/{property_obj.id}/rooms/{item.id}" if property_obj.status == Property.PropertyStatus.APPROVED else "/admin/properties")

        transactions = PaymentTransaction.objects.filter(
            Q(transaction_reference__icontains=term) | Q(funding_payment__payment_reference__icontains=term) |
            Q(funding_payment__student__email__icontains=term) |
            Q(funding_payment__contract__contract_number__icontains=term) |
            (Q(pk=exact_id) if exact_id else Q(pk__in=[]))
        ).select_related("funding_payment__student").order_by("-created_at")[:5]
        for item in transactions:
            add("Payment", item.transaction_reference,
                f"{item.funding_payment.student.email} · {item.currency} {item.amount} · {item.status.title()}", f"/admin/payments?search={quote(item.funding_payment.contract.contract_number, safe='')}")
        funding_rows = FundingPayment.objects.filter(
            Q(payment_reference__icontains=term) | Q(student__email__icontains=term) |
            Q(contract__contract_number__icontains=term) |
            (Q(pk=exact_id) if exact_id else Q(pk__in=[]))
        ).select_related("student", "contract").order_by("-updated_at")[:5]
        for item in funding_rows:
            add("Payment", item.payment_reference or item.contract.contract_number,
                f"{item.student.email} · balance {item.currency} {item.amount_due - item.amount_paid} · {item.payment_status.title()}", f"/admin/payments?search={quote(item.contract.contract_number, safe='')}")

        documents = Document.objects.filter(
            Q(original_filename__icontains=term) | Q(document_type__icontains=term) |
            Q(student__email__icontains=term) | Q(application__application_number__icontains=term) |
            (Q(pk=exact_id) if exact_id else Q(pk__in=[]))
        ).select_related("student", "application").order_by("-uploaded_at")[:5]
        for item in documents:
            add("Document", item.original_filename,
                f"{item.student.email} · {item.get_document_type_display()} · {item.get_status_display()}", f"/admin/applications/{item.application_id}")

        contracts = Contract.objects.filter(
            Q(contract_number__icontains=term) | Q(student__email__icontains=term) |
            Q(property_name__icontains=term) | Q(room_number__icontains=term) |
            (Q(pk=exact_id) if exact_id else Q(pk__in=[]))
        ).select_related("student").order_by("-created_at")[:5]
        for item in contracts:
            add("Contract", item.contract_number,
                f"{item.student.email} · {item.property_name} · Room {item.room_number} · {item.status.replace('_', ' ').title()}", f"/admin/contracts?search={quote(item.contract_number, safe='')}")

        maintenance = MaintenanceRequest.objects.filter(
            Q(reference_number__icontains=term) | Q(title__icontains=term) |
            Q(student__email__icontains=term) | Q(booking__property__name__icontains=term) |
            Q(booking__room__room_number__icontains=term) |
            (Q(pk=exact_id) if exact_id else Q(pk__in=[]))
        ).select_related("student", "booking__property", "booking__room").order_by("-created_at")[:5]
        for item in maintenance:
            add("Maintenance", item.reference_number,
                f"{item.title} · {item.student.email} · {item.status.replace('_', ' ').title()}", f"/admin/maintenance?search={search_query}")

        return Response({"success": True, "query": term, "results": results[:50]})


class AdminReportExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        error = _admin_error(request)
        if error:
            return error
        report_type = request.query_params.get("type", "applications")
        if request.query_params.get("format") == "table":
            try:
                headers, rows = build_report(report_type)
            except ValueError:
                available = ", ".join(key for key, _ in REPORT_TYPES)
                return Response({"success": False, "message": f"Choose a supported report type: {available}."}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"success": True, "type": report_type, "generated_at": timezone.now(), "headers": headers, "rows": rows})
        try:
            content = report_csv(report_type)
        except ValueError:
            available = ", ".join(key for key, _ in REPORT_TYPES)
            return Response({"success": False, "message": f"Choose a supported report type: {available}."}, status=status.HTTP_400_BAD_REQUEST)
        response = HttpResponse(content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="student-haven-{report_type}-report.csv"'
        return response


class AdminReportSchedulesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        error = _admin_error(request)
        if error:
            return error
        schedules = ReportSchedule.objects.filter(created_by=request.user).select_related("created_by").order_by("next_run_at")
        return Response({"success": True, "schedules": [_schedule_payload(item) for item in schedules]})

    def post(self, request):
        error = _admin_error(request)
        if error:
            return error
        report_type = request.data.get("report_type", "")
        frequency = request.data.get("frequency", "")
        if report_type not in ReportSchedule.ReportType.values:
            return Response({"success": False, "message": "Choose a valid report."}, status=status.HTTP_400_BAD_REQUEST)
        if frequency not in ReportSchedule.Frequency.values:
            return Response({"success": False, "message": "Choose daily, weekly or monthly delivery."}, status=status.HTTP_400_BAD_REQUEST)
        item = ReportSchedule.objects.create(
            created_by=request.user,
            report_type=report_type,
            frequency=frequency,
            recipient_email=request.user.email,
            next_run_at=_next_report_run(frequency),
        )
        AuditEvent.objects.create(actor=request.user, action="REPORT_SCHEDULE_CREATED", entity_type="report_schedule", entity_id=item.id, summary=f"Scheduled {item.get_report_type_display()} report {item.get_frequency_display().lower()}.")
        return Response({"success": True, "schedule": _schedule_payload(item)}, status=status.HTTP_201_CREATED)


class AdminReportScheduleDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, schedule_id):
        error = _admin_error(request)
        if error:
            return error
        item = get_object_or_404(ReportSchedule, id=schedule_id, created_by=request.user)
        active = request.data.get("is_active")
        if not isinstance(active, bool):
            return Response({"success": False, "message": "Choose whether this schedule is active."}, status=status.HTTP_400_BAD_REQUEST)
        item.is_active = active
        item.save(update_fields=["is_active", "updated_at"])
        AuditEvent.objects.create(actor=request.user, action="REPORT_SCHEDULE_UPDATED", entity_type="report_schedule", entity_id=item.id, summary=f"{'Resumed' if active else 'Paused'} scheduled report delivery.")
        return Response({"success": True, "schedule": _schedule_payload(item)})

    def delete(self, request, schedule_id):
        error = _admin_error(request)
        if error:
            return error
        item = get_object_or_404(ReportSchedule, id=schedule_id, created_by=request.user)
        AuditEvent.objects.create(actor=request.user, action="REPORT_SCHEDULE_DELETED", entity_type="report_schedule", entity_id=item.id, summary="Deleted a scheduled report delivery.")
        item.delete()
        return Response({"success": True})
