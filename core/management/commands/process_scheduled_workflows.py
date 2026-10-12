"""Run daily Student Haven lifecycle reminders and expiry processing."""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from analytics.services import record_audit_event
from contracts.models import Contract
from documents.models import Document
from notifications.models import Notification
from notifications.services import create_notification
from waitinglist.models import WaitingListEntry
from waitinglist.services import offer_waitlist_for_bed


class Command(BaseCommand):
    help = "Send lifecycle reminders and process expired contracts, documents and wait-list offers. Run daily."

    def handle(self, *args, **options):
        now = timezone.now()
        today = timezone.localdate(now)
        counts = {"contract_reminders": 0, "contracts_expired": 0, "documents_expired": 0, "waitlist_offers_expired": 0, "replacement_offers": 0}

        # Remind students before the end of a signed stay. The marker in the
        # notification's metadata prevents a rerun on the same day duplicating it.
        reminder_days = {today + timedelta(days=days): days for days in (30, 7, 1)}
        for end_date, days_remaining in reminder_days.items():
            contracts = Contract.objects.filter(
                status=Contract.Status.SIGNED,
                end_date=end_date,
            ).select_related("student", "application")
            for contract in contracts.iterator():
                marker = f"contract-end:{contract.pk}:{days_remaining}"
                if Notification.objects.filter(recipient=contract.student, extra_data__scheduled_key=marker).exists():
                    continue
                create_notification(
                    recipient=contract.student,
                    notification_type="SYSTEM",
                    title="Accommodation contract ending soon",
                    message=f"Your Student Haven accommodation contract ends in {days_remaining} day(s). Contact your accommodation team if you need to discuss renewal or check-out arrangements.",
                    application=contract.application,
                    extra_data={"scheduled_key": marker, "contract_number": contract.contract_number, "days_remaining": days_remaining},
                )
                counts["contract_reminders"] += 1

        expired_contracts = Contract.objects.filter(
            status=Contract.Status.SIGNED,
            end_date__lt=today,
        ).select_related("student", "application__property__landlord")
        for contract in expired_contracts.iterator():
            with transaction.atomic():
                current = Contract.objects.select_for_update().filter(pk=contract.pk, status=Contract.Status.SIGNED, end_date__lt=today).first()
                if not current:
                    continue
                current.status = Contract.Status.EXPIRED
                current.save(update_fields=["status", "updated_at"])
                record_audit_event(actor=None, action="CONTRACT_EXPIRED", entity_type="contract", entity_id=current.pk, summary=f"Contract {current.contract_number} expired on {current.end_date}", metadata={"status": current.status, "application_number": current.application.application_number})
                create_notification(
                    recipient=current.student,
                    notification_type="SYSTEM",
                    title="Accommodation contract expired",
                    message=f"Your accommodation contract {current.contract_number} ended on {current.end_date}. Contact Student Haven support if your accommodation status needs updating.",
                    application=current.application,
                    extra_data={"contract_number": current.contract_number},
                )
                counts["contracts_expired"] += 1

        expired_documents = Document.objects.filter(
            status=Document.Status.VERIFIED,
            expiry_date__lt=today,
        ).select_related("student", "application__property__landlord")
        for document in expired_documents.iterator():
            with transaction.atomic():
                current = Document.objects.select_for_update().filter(pk=document.pk, status=Document.Status.VERIFIED, expiry_date__lt=today).first()
                if not current:
                    continue
                current.status = Document.Status.NEEDS_REVIEW
                note = f"Document expired on {current.expiry_date}; updated by the scheduled lifecycle check."
                current.verification_notes = "\n".join(part for part in [current.verification_notes.strip(), note] if part)
                current.save(update_fields=["status", "verification_notes", "updated_at"])
                record_audit_event(actor=None, action="DOCUMENT_EXPIRED", entity_type="document", entity_id=current.pk, summary=f"Verified document {current.pk} expired on {current.expiry_date}", metadata={"status": current.status, "application_number": current.application.application_number})
                create_notification(
                    recipient=current.student,
                    notification_type="SYSTEM",
                    title="A verified document has expired",
                    message=f"Your {current.get_document_type_display()} for application {current.application.application_number} expired on {current.expiry_date}. Upload a current copy so the property landlord can review it.",
                    application=current.application,
                    document=current,
                    extra_data={"document_id": current.pk, "expiry_date": current.expiry_date.isoformat()},
                )
                create_notification(
                    recipient=current.application.property.landlord,
                    notification_type="DOCUMENT_NEEDS_REVIEW",
                    title="Expired document needs review",
                    message=f"{current.get_document_type_display()} for application {current.application.application_number} has expired and requires landlord review.",
                    application=current.application,
                    document=current,
                    extra_data={"document_id": current.pk, "expiry_date": current.expiry_date.isoformat()},
                )
                counts["documents_expired"] += 1

        expired_offers = WaitingListEntry.objects.filter(
            status=WaitingListEntry.Status.OFFERED,
            respond_by__lte=now,
        ).select_related("student", "property", "application", "offered_bed")
        beds_to_reoffer = {}
        for entry in expired_offers.iterator():
            with transaction.atomic():
                current = WaitingListEntry.objects.select_for_update().filter(pk=entry.pk, status=WaitingListEntry.Status.OFFERED, respond_by__lte=now).select_related("student", "property", "application", "offered_bed").first()
                if not current:
                    continue
                bed = current.offered_bed
                current.status = WaitingListEntry.Status.EXPIRED
                current.save(update_fields=["status", "updated_at"])
                record_audit_event(actor=None, action="WAITLIST_OFFER_EXPIRED", entity_type="waiting_list_entry", entity_id=current.pk, summary=f"Wait-list offer for {current.student.email} at {current.property.name} expired", metadata={"status": current.status, "application_number": current.application.application_number if current.application_id else ""})
                create_notification(
                    recipient=current.student,
                    notification_type="SYSTEM",
                    title="Your accommodation offer expired",
                    message=f"The 48-hour response window for your room offer at {current.property.name} has ended. You remain able to review other available accommodation.",
                    application=current.application,
                    extra_data={"waiting_list_entry": current.pk, "property_id": current.property_id},
                )
                counts["waitlist_offers_expired"] += 1
                if bed:
                    beds_to_reoffer[bed.pk] = bed

        for bed in beds_to_reoffer.values():
            if offer_waitlist_for_bed(bed):
                counts["replacement_offers"] += 1

        self.stdout.write(self.style.SUCCESS("Scheduled lifecycle processing complete: " + ", ".join(f"{name}={value}" for name, value in counts.items())))
