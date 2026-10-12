import csv
import io

from django.db.models import Count, Q

from accounts.models import User, LandlordProfile
from accommodations.models import Bed, Property
from applications.models import Application
from bookings.models import Booking
from complaints.models import Complaint
from funding.models import FundingPayment
from maintenance.models import MaintenanceRequest
from waitinglist.models import WaitingListEntry


REPORT_TYPES = (
    ("applications", "Applications"),
    ("properties", "Properties & inventory"),
    ("occupancy", "Accommodation occupancy"),
    ("landlords", "Landlord performance"),
    ("payments", "Funding & payments"),
    ("waiting_list", "Waiting list"),
    ("complaints", "Complaints"),
    ("maintenance", "Maintenance requests"),
)


def build_report(report_type):
    """Return a bounded snapshot as headings and string-valued rows."""
    limit = 10000
    headers = []
    rows = []
    if report_type == "applications":
        headers = ["Application", "Status", "Student email", "Student number", "Property", "Room", "Submitted", "Created"]
        records = Application.objects.select_related("student__student_profile", "property", "room").order_by("-created_at")[:limit]
        rows = [[app.application_number, app.status, app.student.email, getattr(getattr(app.student, "student_profile", None), "student_number", ""), app.property.name, app.room.room_number, app.submitted_at.isoformat() if app.submitted_at else "", app.created_at.isoformat()] for app in records]
    elif report_type in {"properties", "occupancy"}:
        fields = ["Property ID", "Property", "Landlord email", "Campus", "Status", "Rooms", "Total beds", "Occupied beds", "Available beds", "Occupancy percent"]
        headers = fields if report_type == "properties" else ["Property", "Landlord email", "Campus", "Total beds", "Occupied beds", "Available beds", "Occupancy percent"]
        property_rows = Property.objects.select_related("landlord", "campus").annotate(
            room_count=Count("buildings__floors__rooms", distinct=True),
            bed_count=Count("buildings__floors__rooms__beds", distinct=True),
            occupied_count=Count("buildings__floors__rooms__beds", filter=Q(buildings__floors__rooms__beds__status=Bed.BedStatus.OCCUPIED), distinct=True),
            available_count=Count("buildings__floors__rooms__beds", filter=Q(buildings__floors__rooms__beds__status=Bed.BedStatus.AVAILABLE), distinct=True),
        ).order_by("name")[:limit]
        for item in property_rows:
            percent = round(item.occupied_count * 100 / item.bed_count) if item.bed_count else 0
            row = [item.id, item.name, item.landlord.email, item.campus.name, item.status, item.room_count, item.bed_count, item.occupied_count, item.available_count, percent]
            rows.append(row if report_type == "properties" else [item.name, item.landlord.email, item.campus.name, item.bed_count, item.occupied_count, item.available_count, percent])
    elif report_type == "landlords":
        headers = ["Landlord", "Email", "Business", "Verification status", "Properties", "Approved properties", "Applications on properties"]
        records = User.objects.filter(role=User.Role.LANDLORD).select_related("landlord_profile").annotate(
            property_count=Count("properties", distinct=True),
            approved_property_count=Count("properties", filter=Q(properties__status=Property.PropertyStatus.APPROVED), distinct=True),
            application_count=Count("properties__applications", distinct=True),
        ).order_by("last_name", "first_name")[:limit]
        for item in records:
            profile = getattr(item, "landlord_profile", None)
            rows.append([item.get_full_name(), item.email, profile.business_name if profile else "", profile.verification_status if profile else "NOT SUBMITTED", item.property_count, item.approved_property_count, item.application_count])
    elif report_type == "payments":
        headers = ["Student email", "Contract", "Funding method", "Payment status", "Amount due", "Amount paid", "Balance", "Reference"]
        records = FundingPayment.objects.select_related("student", "contract").order_by("-updated_at")[:limit]
        rows = [[item.student.email, item.contract.contract_number, item.funding_method, item.payment_status, item.amount_due, item.amount_paid, item.amount_due - item.amount_paid, item.payment_reference] for item in records]
    elif report_type == "waiting_list":
        headers = ["Student email", "Property", "Room type", "Application", "Status", "Priority", "Maximum monthly price", "Accessibility required", "Created", "Offer sent"]
        records = WaitingListEntry.objects.select_related("student", "property", "room_type", "application").order_by("-priority_score", "created_at")[:limit]
        rows = [[item.student.email, item.property.name, item.room_type.name if item.room_type_id else "Any room type", item.application.application_number if item.application_id else "", item.status, item.priority_score, item.max_monthly_price if item.max_monthly_price is not None else "", "Yes" if item.accessibility_required else "No", item.created_at.isoformat(), item.offered_at.isoformat() if item.offered_at else ""] for item in records]
    elif report_type == "complaints":
        headers = ["Reference", "Student email", "Property", "Category", "Priority", "Status", "Created", "Updated"]
        records = Complaint.objects.select_related("student", "property").order_by("-created_at")[:limit]
        rows = [[item.reference_number, item.student.email, item.property.name if item.property_id else "General support", item.category, item.priority, item.status, item.created_at.isoformat(), item.updated_at.isoformat()] for item in records]
    elif report_type == "maintenance":
        headers = ["Reference", "Student email", "Property", "Room", "Category", "Priority", "Status", "Submitted", "Resolved"]
        records = MaintenanceRequest.objects.select_related("student", "booking__property", "booking__room").order_by("-created_at")[:limit]
        rows = [[item.reference_number, item.student.email, item.booking.property.name, item.booking.room.room_number, item.category, item.priority, item.status, item.submitted_at.isoformat(), item.resolved_at.isoformat() if item.resolved_at else ""] for item in records]
    else:
        raise ValueError("Choose one of the available report types.")
    return headers, [["" if value is None else str(value) for value in row] for row in rows]


def report_csv(report_type):
    headers, rows = build_report(report_type)
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer)
    def safe_cell(value):
        text = "" if value is None else str(value)
        return f"'{text}" if text.startswith(("=", "+", "-", "@", "\t", "\r")) else text
    writer.writerow([safe_cell(value) for value in headers])
    writer.writerows([[safe_cell(value) for value in row] for row in rows])
    return buffer.getvalue()
