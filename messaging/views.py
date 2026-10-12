from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accommodations.models import Bed, Property
from applications.models import Application
from bookings.models import Booking
from notifications.services import create_notification

from .models import Conversation, ConversationParticipant, Message


ACTIVE_APPLICATION_STATUSES = [
    Application.Status.SUBMITTED,
    Application.Status.UNDER_REVIEW,
    Application.Status.ADDITIONAL_INFO,
    Application.Status.APPROVED,
    Application.Status.WAITING_LIST,
    Application.Status.WAITLISTED,
]


def _is_admin(user):
    return user.role in {User.Role.ADMINISTRATOR, "ADMIN"} or user.is_superuser


def _visible_conversations(user):
    queryset = Conversation.objects.select_related("property", "application", "created_by")
    if _is_admin(user):
        return queryset
    conversations = queryset.filter(participant_records__user=user)
    if user.role == User.Role.LANDLORD:
        allowed_recipients = _messaging_recipients(user)
        disallowed_participants = ConversationParticipant.objects.filter(
            conversation_id=OuterRef("pk"),
        ).exclude(
            user_id=user.id,
        ).exclude(
            user_id__in=allowed_recipients.values("id"),
        )
        conversations = conversations.filter(
            participants__in=allowed_recipients,
        ).annotate(
            has_disallowed_participant=Exists(disallowed_participants),
        ).filter(
            has_disallowed_participant=False,
        )
    elif user.role == User.Role.STUDENT:
        conversations = conversations.filter(
            participant_records__user__role=User.Role.LANDLORD,
        ).exclude(
            participant_records__user__role__in=[User.Role.ADMINISTRATOR, "ADMIN"],
        ).exclude(
            participant_records__user__is_superuser=True,
        )
    return conversations.distinct()


def _landlord_registered_student_ids(landlord, *, property_id=None):
    booking_statuses = [Booking.Status.CONFIRMED, Booking.Status.ACTIVE]

    applications = Application.objects.filter(
        property__landlord=landlord,
        status__in=ACTIVE_APPLICATION_STATUSES,
    )
    bookings = Booking.objects.filter(
        property__landlord=landlord,
        status__in=booking_statuses,
    )
    occupied_beds = Bed.objects.filter(
        room__property__landlord=landlord,
        current_student__isnull=False,
    )
    if property_id is not None:
        applications = applications.filter(property_id=property_id)
        bookings = bookings.filter(property_id=property_id)
        occupied_beds = occupied_beds.filter(room__property_id=property_id)

    return (
        set(applications.values_list("student_id", flat=True))
        | set(bookings.values_list("student_id", flat=True))
        | set(occupied_beds.values_list("current_student_id", flat=True))
    )


def _messaging_recipients(user):
    if _is_admin(user):
        return User.objects.filter(
            role=User.Role.LANDLORD,
            is_active=True,
            landlord_profile__verification_status="VERIFIED",
        ).order_by("first_name", "last_name", "id")
    if user.role == User.Role.LANDLORD:
        student_ids = _landlord_registered_student_ids(user)
        students = User.objects.filter(
            id__in=student_ids,
            role=User.Role.STUDENT,
            is_active=True,
            is_verified=True,
        )
        administrators = User.objects.filter(
            Q(role__in=[User.Role.ADMINISTRATOR, "ADMIN"]) | Q(is_superuser=True),
            is_active=True,
        ).exclude(id=user.id)
        return (students | administrators).distinct().order_by("role", "first_name", "last_name", "id")
    if user.role == User.Role.STUDENT:
        landlord_ids = set(
            Application.objects.filter(
                student=user,
                status__in=ACTIVE_APPLICATION_STATUSES,
            ).values_list("property__landlord_id", flat=True)
        )
        landlord_ids.update(
            Bed.objects.filter(current_student=user).values_list(
                "room__property__landlord_id", flat=True
            )
        )
        return User.objects.filter(
            id__in=landlord_ids,
            role=User.Role.LANDLORD,
            is_active=True,
        ).order_by("first_name", "last_name", "id")
    return User.objects.none()


def _serialize_recipient(user):
    return {
        "id": user.id,
        "name": user.get_full_name(),
        "email": user.email,
        "role": user.role,
    }


def _serialize_message(message):
    return {
        "id": message.id,
        "sender": message.sender_id,
        "sender_name": message.sender.get_full_name(),
        "sender_role": message.sender.role,
        "body": message.body,
        "created_at": message.created_at,
    }


def _serialize_conversation(conversation, user, *, include_messages=False):
    participant_records = list(conversation.participant_records.select_related("user").all())
    current_record = next((record for record in participant_records if record.user_id == user.id), None)
    last_message = conversation.messages.select_related("sender").last()
    unread_query = conversation.messages.exclude(sender=user)
    if current_record and current_record.last_read_at:
        unread_query = unread_query.filter(created_at__gt=current_record.last_read_at)
    data = {
        "id": conversation.id,
        "subject": conversation.subject,
        "property": conversation.property_id,
        "property_name": conversation.property.name if conversation.property_id else None,
        "application": conversation.application_id,
        "application_number": conversation.application.application_number if conversation.application_id else None,
        "status": conversation.status,
        "created_by": conversation.created_by_id,
        "participants": [{"id": record.user_id, "name": record.user.get_full_name(), "email": record.user.email, "role": record.user.role} for record in participant_records],
        "other_participants": [{"id": record.user_id, "name": record.user.get_full_name(), "email": record.user.email, "role": record.user.role} for record in participant_records if record.user_id != user.id],
        "last_message": _serialize_message(last_message) if last_message else None,
        "unread_count": unread_query.count(),
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
    }
    if include_messages:
        data["messages"] = [_serialize_message(message) for message in conversation.messages.select_related("sender").all()]
    return data


class ConversationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        conversations = _visible_conversations(request.user).prefetch_related("participant_records__user", "messages__sender")
        return Response({"success": True, "count": conversations.count(), "conversations": [_serialize_conversation(item, request.user) for item in conversations[:100]]})

    def post(self, request):
        subject = str(request.data.get("subject", "")).strip()
        body = str(request.data.get("body", "")).strip()
        if not subject or len(subject) > 200 or not body or len(body) > 5000:
            return Response({"success": False, "message": "Enter a subject and a first message of up to 5,000 characters."}, status=status.HTTP_400_BAD_REQUEST)

        raw_recipient_id = request.data.get("recipient_id")
        if request.user.role not in {User.Role.STUDENT, User.Role.LANDLORD} and not _is_admin(request.user):
            return Response({"success": False, "message": "Your account cannot start a conversation."}, status=status.HTTP_403_FORBIDDEN)

        if raw_recipient_id in (None, ""):
            return Response({"success": False, "message": "Choose who to message."}, status=status.HTTP_400_BAD_REQUEST)
        recipient = _messaging_recipients(request.user).filter(id=raw_recipient_id).first()
        if not recipient:
            if request.user.role == User.Role.STUDENT:
                message = "You can only start conversations with a landlord linked to your application or accommodation."
            elif request.user.role == User.Role.LANDLORD:
                message = "Choose a student registered to one of your properties or an active StudentHaven administrator."
            else:
                message = "Administrators can start conversations with verified landlords only."
            return Response({"success": False, "message": message}, status=status.HTTP_403_FORBIDDEN)

        application = None
        raw_application_id = request.data.get("application_id")
        if raw_application_id not in (None, ""):
            application = Application.objects.select_related("student", "property").filter(id=raw_application_id).first()
            if not application:
                return Response({"success": False, "message": "The selected application was not found."}, status=status.HTTP_404_NOT_FOUND)
            if not (
                application.student_id in {request.user.id, recipient.id}
                and application.property.landlord_id in {request.user.id, recipient.id}
            ):
                return Response({"success": False, "message": "The selected application is not related to these participants."}, status=status.HTTP_400_BAD_REQUEST)
            if request.user.role == User.Role.LANDLORD and not _is_admin(recipient):
                if (
                    application.student_id != recipient.id
                    or application.property.landlord_id != request.user.id
                    or application.status not in ACTIVE_APPLICATION_STATUSES
                ):
                    return Response({"success": False, "message": "The selected application is not an active registration at your property."}, status=status.HTTP_400_BAD_REQUEST)

        property_obj = None
        raw_property_id = request.data.get("property_id")
        if raw_property_id not in (None, ""):
            property_obj = Property.objects.select_related("landlord").filter(id=raw_property_id).first()
            if not property_obj:
                return Response({"success": False, "message": "The selected property was not found."}, status=status.HTTP_404_NOT_FOUND)
            if property_obj.landlord_id not in {request.user.id, recipient.id}:
                return Response({"success": False, "message": "The selected property is not related to these participants."}, status=status.HTTP_400_BAD_REQUEST)
            if request.user.role == User.Role.LANDLORD:
                if property_obj.landlord_id != request.user.id:
                    return Response({"success": False, "message": "You can only reference one of your own properties."}, status=status.HTTP_400_BAD_REQUEST)
                if not _is_admin(recipient) and recipient.id not in _landlord_registered_student_ids(request.user, property_id=property_obj.id):
                    return Response({"success": False, "message": "This student is not registered at the selected property."}, status=status.HTTP_403_FORBIDDEN)
        elif application:
            property_obj = application.property
        if application and property_obj and application.property_id != property_obj.id:
            return Response({"success": False, "message": "The selected application and property do not match."}, status=status.HTTP_400_BAD_REQUEST)

        if recipient.id == request.user.id:
            return Response({"success": False, "message": "Choose another account for this conversation."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            conversation = Conversation.objects.create(
                subject=subject,
                property=property_obj,
                application=application,
                created_by=request.user,
            )
            now = timezone.now()
            ConversationParticipant.objects.bulk_create([
                ConversationParticipant(conversation=conversation, user=request.user, last_read_at=now),
                ConversationParticipant(conversation=conversation, user=recipient),
            ])
            Message.objects.create(conversation=conversation, sender=request.user, body=body)
            create_notification(
                recipient=recipient,
                actor=request.user,
                notification_type="SYSTEM",
                title="New StudentHaven message",
                message=f"{request.user.get_full_name()} started a conversation: {subject}",
                application=application,
                extra_data={
                    "conversation_id": conversation.id,
                    "notification_category": "MESSAGES",
                },
            )
        return Response({"success": True, "conversation": _serialize_conversation(conversation, request.user, include_messages=True)}, status=status.HTTP_201_CREATED)


class ConversationRecipientListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        recipients = _messaging_recipients(request.user)
        return Response({
            "success": True,
            "recipients": [_serialize_recipient(user) for user in recipients],
        })


class ConversationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, conversation_id):
        conversation = get_object_or_404(_visible_conversations(request.user), id=conversation_id)
        messages = list(conversation.messages.select_related("sender").all())
        if not _is_admin(request.user):
            ConversationParticipant.objects.filter(conversation=conversation, user=request.user).update(last_read_at=timezone.now())
        data = _serialize_conversation(conversation, request.user)
        data["messages"] = [_serialize_message(message) for message in messages]
        return Response({"success": True, "conversation": data})


class ConversationMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, conversation_id):
        conversation = get_object_or_404(_visible_conversations(request.user), id=conversation_id)
        if not conversation.participant_records.filter(user=request.user).exists():
            return Response({"success": False, "message": "You are not a participant in this conversation."}, status=status.HTTP_403_FORBIDDEN)
        if _is_admin(request.user) and conversation.participant_records.filter(user__role=User.Role.STUDENT).exists():
            return Response({"success": False, "message": "Administrators cannot message students directly. Contact the landlord instead."}, status=status.HTTP_403_FORBIDDEN)
        if conversation.status == Conversation.Status.CLOSED and not _is_admin(request.user):
            return Response({"success": False, "message": "This conversation is closed."}, status=status.HTTP_409_CONFLICT)
        body = str(request.data.get("body", "")).strip()
        if not body or len(body) > 5000:
            return Response({"success": False, "message": "Enter a message of up to 5,000 characters."}, status=status.HTTP_400_BAD_REQUEST)
        message = Message.objects.create(conversation=conversation, sender=request.user, body=body)
        conversation.save(update_fields=["updated_at"])
        recipients = conversation.participants.exclude(id=request.user.id).filter(is_active=True)
        for recipient in recipients:
            create_notification(
                recipient=recipient,
                actor=request.user,
                notification_type="SYSTEM",
                title="New StudentHaven message",
                message=f"{request.user.get_full_name()} replied to: {conversation.subject}",
                application=conversation.application,
                extra_data={
                    "conversation_id": conversation.id,
                    "message_id": message.id,
                    "notification_category": "MESSAGES",
                },
            )
        ConversationParticipant.objects.filter(conversation=conversation, user=request.user).update(last_read_at=timezone.now())
        return Response({"success": True, "message": _serialize_message(message)}, status=status.HTTP_201_CREATED)
