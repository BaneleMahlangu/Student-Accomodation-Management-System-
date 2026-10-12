from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMessage
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from analytics.models import ReportSchedule
from analytics.reports import report_csv


def next_run(frequency, now):
    current = timezone.localtime(now)
    if frequency == ReportSchedule.Frequency.DAILY:
        return current + timedelta(days=1)
    if frequency == ReportSchedule.Frequency.WEEKLY:
        return current + timedelta(days=7)
    month = current.month % 12 + 1
    year = current.year + (1 if current.month == 12 else 0)
    import calendar
    return current.replace(year=year, month=month, day=min(current.day, calendar.monthrange(year, month)[1]))


class Command(BaseCommand):
    help = "Email CSV files for due administrator report schedules."

    def handle(self, *args, **options):
        now = timezone.now()
        schedule_ids = list(ReportSchedule.objects.filter(is_active=True, next_run_at__lte=now).order_by("next_run_at").values_list("id", flat=True)[:100])
        sent_count = 0
        failed_count = 0
        for schedule_id in schedule_ids:
            try:
                with transaction.atomic():
                    schedule = ReportSchedule.objects.select_for_update().select_related("created_by").get(pk=schedule_id)
                    if not schedule.is_active or schedule.next_run_at > timezone.now():
                        continue
                    # Always deliver to the schedule owner's current verified account address.
                    recipient = schedule.created_by.email
                    schedule.recipient_email = recipient
                    csv_content = report_csv(schedule.report_type)
                    message = EmailMessage(
                        subject=f"Student Haven {schedule.get_report_type_display()} report",
                        body=(
                            f"Your scheduled {schedule.get_frequency_display().lower()} Student Haven report is attached.\n\n"
                            "This report contains operational account information. Keep it in a secure location. "
                            "Delivery is restricted to the administrator account that created this schedule."
                        ),
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        to=[recipient],
                    )
                    message.attach(f"student-haven-{schedule.report_type}-report.csv", csv_content, "text/csv")
                    if message.send(fail_silently=False) != 1:
                        raise RuntimeError("The email backend did not accept the report message.")
                    delivered_at = timezone.now()
                    schedule.last_sent_at = delivered_at
                    schedule.last_error = ""
                    schedule.next_run_at = next_run(schedule.frequency, delivered_at)
                    schedule.save(update_fields=["recipient_email", "last_sent_at", "last_error", "next_run_at", "updated_at"])
                    sent_count += 1
                    self.stdout.write(self.style.SUCCESS(f"Sent report schedule {schedule.id} to its owner."))
            except Exception as error:
                failed_count += 1
                retry_at = timezone.now() + timedelta(hours=6)
                ReportSchedule.objects.filter(pk=schedule_id, is_active=True).update(
                    last_error=str(error)[:250],
                    next_run_at=retry_at,
                    updated_at=timezone.now(),
                )
                self.stderr.write(self.style.ERROR(f"Report schedule {schedule_id} failed; it will be retried later."))
        self.stdout.write(f"Completed scheduled reports: {sent_count} sent, {failed_count} failed.")
