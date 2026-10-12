from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class PrivateProfileStorage(FileSystemStorage):
    def __init__(self, location=None, base_url=None, **kwargs):
        super().__init__(
            location=location or settings.PRIVATE_PROFILE_ROOT,
            base_url=base_url or "/private-profile/",
            **kwargs,
        )
