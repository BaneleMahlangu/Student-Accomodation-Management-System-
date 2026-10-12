from django.conf import settings
from django.db import models


class PlatformConfiguration(models.Model):
    application_period_name = models.CharField(max_length=160, default="Current accommodation intake")
    applications_open = models.BooleanField(default=True)
    application_opens_at = models.DateTimeField(null=True, blank=True)
    application_closes_at = models.DateTimeField(null=True, blank=True)
    closed_message = models.CharField(max_length=300, default="Applications are temporarily closed. Please check back later.")
    support_email = models.EmailField(blank=True, default="")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="platform_settings_updates")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "platform configuration"
        verbose_name_plural = "platform configuration"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def current(cls):
        return cls.objects.filter(pk=1).first()

    def applications_currently_open(self, now=None):
        from django.utils import timezone

        now = now or timezone.now()
        if not self.applications_open:
            return False
        if self.application_opens_at and now < self.application_opens_at:
            return False
        if self.application_closes_at and now > self.application_closes_at:
            return False
        return True

    def __str__(self):
        return self.application_period_name


class PlatformAnnouncement(models.Model):
    class Audience(models.TextChoices):
        ALL = "ALL", "Everyone"
        STUDENT = "STUDENT", "Students"
        LANDLORD = "LANDLORD", "Landlords"
        ADMINISTRATOR = "ADMINISTRATOR", "Administrators"

    title = models.CharField(max_length=180)
    body = models.TextField(max_length=3000)
    audience = models.CharField(max_length=20, choices=Audience.choices, default=Audience.ALL)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="platform_announcements")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-starts_at", "-created_at"]

    def __str__(self):
        return self.title
