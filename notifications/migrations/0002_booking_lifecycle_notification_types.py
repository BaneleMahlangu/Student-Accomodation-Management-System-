from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="notification",
            name="notification_type",
            field=models.CharField(
                choices=[
                    ("APPLICATION_SUBMITTED", "Application Submitted"),
                    ("APPLICATION_RECEIVED", "Application Received"),
                    ("APPLICATION_UNDER_REVIEW", "Application Under Review"),
                    ("APPLICATION_APPROVED", "Application Approved"),
                    ("APPLICATION_REJECTED", "Application Rejected"),
                    ("APPLICATION_UPDATED", "Application Updated"),
                    ("ADDITIONAL_INFORMATION", "Additional Information Requested"),
                    ("WAITING_LIST", "Added to Waiting List"),
                    ("ADMIN_FEEDBACK", "Administrator Feedback"),
                    ("LANDLORD_FEEDBACK", "Accommodation Provider Feedback"),
                    ("DOCUMENTS_SUBMITTED", "Documents Submitted"),
                    ("DOCUMENT_VERIFIED", "Document Verified"),
                    ("DOCUMENT_REJECTED", "Document Rejected"),
                    ("DOCUMENT_NEEDS_REVIEW", "Document Requires Review"),
                    ("DOCUMENT_REQUESTED", "Additional Document Required"),
                    ("CONTRACT_READY", "Contract Ready"),
                    ("CONTRACT_SIGNED", "Contract Signed"),
                    ("PAYMENT_DUE", "Payment Due"),
                    ("PAYMENT_SUCCESSFUL", "Payment Successful"),
                    ("PAYMENT_FAILED", "Payment Failed"),
                    ("FUNDING_UPDATED", "Funding Updated"),
                    ("BOOKING_CONFIRMED", "Booking Confirmed"),
                    ("BOOKING_TERMINATED", "Booking Terminated"),
                    ("BOOKING_ROOM_TRANSFERRED", "Room Allocation Updated"),
                    ("CHECK_IN_AVAILABLE", "Check-in Available"),
                    ("CHECKED_IN", "Checked In"),
                    ("CHECKED_OUT", "Checked Out"),
                    ("MAINTENANCE_SUBMITTED", "Maintenance Request Submitted"),
                    ("MAINTENANCE_ASSIGNED", "Maintenance Assigned"),
                    ("MAINTENANCE_UPDATED", "Maintenance Updated"),
                    ("MAINTENANCE_RESOLVED", "Maintenance Resolved"),
                    ("MAINTENANCE_CONFIRMED", "Maintenance Resolution Confirmed"),
                    ("SYSTEM", "System Notification"),
                ],
                max_length=50,
            ),
        ),
    ]
