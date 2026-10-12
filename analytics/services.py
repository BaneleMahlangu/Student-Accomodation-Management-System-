from .models import AuditEvent


def record_audit_event(*, actor, action, entity_type, entity_id=None, summary, metadata=None, request=None):
    safe_metadata = {}
    for key, value in (metadata or {}).items():
        if key in {"status", "from_status", "to_status", "decision", "priority", "is_active", "applications_open", "is_verified", "verification_status", "two_factor_enabled", "fields", "application_number", "consent_version", "reason", "room_number", "bed_number", "from_room_number", "from_bed_number", "to_room_number", "to_bed_number"}:
            if isinstance(value, (str, int, float, bool, list, tuple)) or value is None:
                safe_metadata[key] = value
    ip_address = request.META.get("REMOTE_ADDR") if request else None
    return AuditEvent.objects.create(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        summary=summary[:255],
        metadata=safe_metadata,
        ip_address=ip_address,
    )
