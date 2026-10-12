import hashlib
import os
from pathlib import PurePath

from PIL import Image, UnidentifiedImageError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.http import FileResponse

from rest_framework import status
from rest_framework.parsers import (
    MultiPartParser,
    FormParser,
)
from rest_framework.permissions import (
    IsAuthenticated,
)
from rest_framework.response import Response
from rest_framework.views import APIView

from applications.models import Application
from notifications.services import create_notification

from .models import Document
from .serializers import (
    DocumentDecisionSerializer,
    DocumentSerializer,
    DocumentUploadSerializer,
)


def run_document_precheck(document):
    """Check file readability and consistency without asserting authenticity."""
    if not document.file:
        document.status = Document.Status.REJECTED
        document.rejection_reason = "No document file was received."
        document.save(update_fields=["status", "rejection_reason", "updated_at"])
        return

    findings = []
    filename = PurePath(document.original_filename or document.file.name).suffix.lower()
    document.file.open("rb")
    try:
        header = document.file.read(16)
        if filename == ".pdf":
            document.file.seek(max(0, document.file.size - 2048))
            tail = document.file.read()
            if not header.startswith(b"%PDF-"):
                findings.append("The file extension says PDF, but its file signature does not.")
            elif b"%%EOF" not in tail:
                findings.append("The PDF does not contain a standard end marker and may be incomplete.")
            else:
                findings.append("PDF signature and end marker are present.")
        else:
            document.file.seek(0)
            try:
                with Image.open(document.file) as image:
                    dimensions = image.size
                    detected_format = (image.format or "").lower()
                    expected_format = "jpeg" if filename in {".jpg", ".jpeg"} else "png"
                    if detected_format != expected_format:
                        findings.append(f"The file extension and detected image format do not match ({detected_format or 'unknown'} format detected).")
                    elif dimensions[0] * dimensions[1] > 25_000_000:
                        findings.append("The image dimensions are unusually large and need landlord inspection.")
                    else:
                        image.verify()
                        findings.append(f"Image file is readable ({dimensions[0]} × {dimensions[1]} pixels).")
            except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
                findings.append("The image could not be read reliably; it may be damaged or mislabeled.")
    finally:
        document.file.close()

    if document.content_sha256:
        duplicate_count = Document.objects.filter(
            content_sha256=document.content_sha256,
        ).exclude(pk=document.pk).count()
        if duplicate_count:
            findings.append(f"This exact file content matches {duplicate_count} other uploaded document(s); the landlord should confirm it is appropriate for this application.")

    findings.append("Completeness, identity, and authenticity have not been automatically verified. The property landlord must review this document before it can be marked verified.")
    document.status = Document.Status.NEEDS_REVIEW
    document.verification_notes = " ".join(findings)
    document.save(update_fields=["status", "verification_notes", "updated_at"])


class DocumentDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, document_id):
        document = get_object_or_404(
            Document.objects.select_related("application__property"),
            id=document_id,
        )
        is_landlord = (
            request.user.role == "LANDLORD"
            and document.application.property.landlord_id == request.user.id
        )
        if not is_landlord and document.student_id != request.user.id:
            return Response({"success": False, "message": "You are not allowed to access this document."}, status=status.HTTP_403_FORBIDDEN)
        try:
            file_handle = document.file.open("rb")
        except (FileNotFoundError, OSError, ValueError):
            return Response({"success": False, "message": "The stored document is unavailable."}, status=status.HTTP_404_NOT_FOUND)
        filename = os.path.basename(document.original_filename or "student-document")
        response = FileResponse(file_handle, as_attachment=True, filename=filename, content_type="application/octet-stream")
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class DocumentPreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, document_id):
        document = get_object_or_404(
            Document.objects.select_related("application__property"),
            id=document_id,
            application__property__landlord_id=request.user.id,
        )
        filename = os.path.basename(document.original_filename or "student-document")
        extension = PurePath(filename).suffix.lower()
        content_type = {
            ".pdf": "application/pdf",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
        }.get(extension)
        if not content_type:
            return Response({"success": False, "message": "This document format cannot be previewed."}, status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)

        try:
            file_handle = document.file.open("rb")
        except (FileNotFoundError, OSError, ValueError):
            return Response({"success": False, "message": "The stored document is unavailable."}, status=status.HTTP_404_NOT_FOUND)

        response = FileResponse(file_handle, as_attachment=False, filename=filename, content_type=content_type)
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class StudentDocumentListCreateView(
    APIView
):

    permission_classes = [
        IsAuthenticated
    ]

    parser_classes = [
        MultiPartParser,
        FormParser,
    ]

    def get(self, request, application_id):

        if request.user.role != "STUDENT":
            return Response(
                {
                    "success": False,
                    "message": (
                        "Student access required."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        application = get_object_or_404(
            Application,
            id=application_id,
        )

        if (
            application.student_id
            != request.user.id
        ):
            return Response(
                {
                    "success": False,
                    "message": "Access denied.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        documents = (
            Document.objects
            .filter(
                application=application,
                student=request.user,
            )
            .order_by(
                "-uploaded_at"
            )
        )

        serializer = DocumentSerializer(
            documents,
            many=True,
            context={
                "request": request
            },
        )

        return Response(
            {
                "success": True,
                "documents": serializer.data,
            }
        )

    def post(self, request, application_id):

        if request.user.role != "STUDENT":
            return Response(
                {
                    "success": False,
                    "message": (
                        "Student access required."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        application = get_object_or_404(
            Application,
            id=application_id,
        )

        if (
            application.student_id
            != request.user.id
        ):
            return Response(
                {
                    "success": False,
                    "message": "Access denied.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data.copy()

        data["application_id"] = (
            application.id
        )

        serializer = DocumentUploadSerializer(
            data=data
        )

        if not serializer.is_valid():

            return Response(
                {
                    "success": False,
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        uploaded_file = (
            serializer.validated_data["file"]
        )

        digest = hashlib.sha256()
        for chunk in uploaded_file.chunks():
            digest.update(chunk)
        uploaded_file.seek(0)

        expiry_date = (
            serializer.validated_data.get(
                "expiry_date"
            )
        )

        document = Document.objects.create(
            application=application,
            student=request.user,
            document_type=(
                serializer.validated_data[
                    "document_type"
                ]
            ),
            file=uploaded_file,
            original_filename=(
                uploaded_file.name
            ),
            content_sha256=digest.hexdigest(),
            status=Document.Status.PROCESSING,
            expiry_date=expiry_date,
        )

        run_document_precheck(
            document
        )

        # =================================================
        # DOCUMENT SUBMITTED NOTIFICATION
        # =================================================

        create_notification(
            recipient=request.user,
            actor=request.user,
            notification_type="DOCUMENTS_SUBMITTED",
            title="Document submitted",
            message=(
                f"Your "
                f"{document.get_document_type_display()} "
                f"has been submitted successfully and "
                f"sent to the property landlord for review."
            ),
            application=application,
            document=document,
            extra_data={
                "document_type": (
                    document.document_type
                ),
                "document_status": (
                    document.status
                ),
                "original_filename": (
                    document.original_filename
                ),
            },
        )

        landlord = application.property.landlord
        create_notification(
            recipient=landlord,
            actor=request.user,
            notification_type="DOCUMENTS_SUBMITTED",
            title="Student document uploaded",
            message=(
                f"{request.user.get_full_name() or request.user.email} uploaded "
                f"{document.get_document_type_display()} for application "
                f"{application.application_number} at {application.property.name}. "
                "Review the document and record a decision."
            ),
            application=application,
            document=document,
            extra_data={
                "application_id": application.id,
                "document_id": document.id,
                "document_type": document.document_type,
                "document_status": document.status,
                "original_filename": document.original_filename,
            },
        )

        document_serializer = (
            DocumentSerializer(
                document,
                context={
                    "request": request
                },
            )
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Document uploaded successfully "
                    "and sent to the property landlord for review."
                ),
                "document": (
                    document_serializer.data
                ),
            },
            status=status.HTTP_201_CREATED,
        )


class StudentDocumentDeleteView(
    APIView
):

    permission_classes = [
        IsAuthenticated
    ]

    def delete(
        self,
        request,
        document_id,
    ):

        if request.user.role != "STUDENT":
            return Response(
                {
                    "success": False,
                    "message": (
                        "Student access required."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        document = get_object_or_404(
            Document,
            id=document_id,
        )

        if (
            document.student_id
            != request.user.id
        ):
            return Response(
                {
                    "success": False,
                    "message": "Access denied.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if document.status == (
            Document.Status.VERIFIED
        ):
            return Response(
                {
                    "success": False,
                    "message": (
                        "Verified documents cannot "
                        "be deleted."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        document.file.delete(
            save=False
        )

        document.delete()

        return Response(
            {
                "success": True,
                "message": (
                    "Document deleted successfully."
                ),
            }
        )


class LandlordDocumentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, application_id):
        if request.user.role != "LANDLORD":
            return Response(
                {"success": False, "message": "Landlord access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        application = get_object_or_404(
            Application.objects.select_related("student", "property"),
            id=application_id,
            property__landlord=request.user,
        )
        documents = Document.objects.filter(application=application).order_by("-uploaded_at", "-id")
        serializer = DocumentSerializer(documents, many=True, context={"request": request})

        return Response(
            {
                "success": True,
                "application": {
                    "id": application.id,
                    "application_number": application.application_number,
                    "student_name": application.student.get_full_name() or application.student.email,
                    "property_name": application.property.name,
                },
                "documents": serializer.data,
            }
        )


class LandlordDocumentDecisionView(
    APIView
):

    permission_classes = [
        IsAuthenticated
    ]

    def post(
        self,
        request,
        document_id,
    ):

        if request.user.role != "LANDLORD":
            return Response(
                {
                    "success": False,
                    "message": (
                        "Landlord access required."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        document = get_object_or_404(
            Document.objects.select_related("application__property", "student"),
            id=document_id,
            application__property__landlord=request.user,
        )

        serializer = (
            DocumentDecisionSerializer(
                data=request.data
            )
        )

        if not serializer.is_valid():

            return Response(
                {
                    "success": False,
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        decision = (
            serializer.validated_data[
                "decision"
            ]
        )

        note = (
            serializer.validated_data.get(
                "note",
                "",
            ).strip()
        )

        previous_status = document.status

        if (
            decision == "REJECTED"
            and not note
        ):
            return Response(
                {
                    "success": False,
                    "message": (
                        "A rejection reason is "
                        "required."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        document.status = decision

        document.verification_notes = (
            note
        )

        if decision == "VERIFIED":

            document.rejection_reason = ""

            document.verified_at = (
                timezone.now()
            )

        elif decision == "REJECTED":

            document.rejection_reason = (
                note
            )

            document.verified_at = None

        else:

            document.verified_at = None

        document.save(
            update_fields=[
                "status",
                "verification_notes",
                "rejection_reason",
                "verified_at",
                "updated_at",
            ]
        )

        # =================================================
        # DOCUMENT DECISION NOTIFICATION
        # =================================================

        notification_type_map = {
            "VERIFIED": "DOCUMENT_VERIFIED",
            "REJECTED": "DOCUMENT_REJECTED",
        }

        notification_type = (
            notification_type_map[decision]
        )

        document_name = (
            document.get_document_type_display()
        )

        if decision == "VERIFIED":

            notification_title = (
                "Document verified"
            )

            notification_message = f"Your {document_name} has been verified by the property landlord."

        elif decision == "REJECTED":

            notification_title = (
                "Document rejected"
            )

            notification_message = (
                f"Your {document_name} was rejected. "
                f"Reason: {note}"
            )

        create_notification(
            recipient=document.student,
            actor=request.user,
            notification_type=notification_type,
            title=notification_title,
            message=notification_message,
            application=document.application,
            document=document,
            extra_data={
                "previous_status": (
                    previous_status
                ),
                "new_status": decision,
                "document_type": (
                    document.document_type
                ),
                "landlord_feedback": (
                    note
                ),
            },
        )

        # =================================================
        # ADDITIONAL LANDLORD FEEDBACK
        # =================================================

        if note:

            create_notification(
                recipient=document.student,
                actor=request.user,
                notification_type=(
                    "LANDLORD_FEEDBACK"
                ),
                title=(
                    "Landlord document feedback"
                ),
                message=note,
                application=document.application,
                document=document,
                extra_data={
                    "related_event": decision,
                    "document_type": (
                        document.document_type
                    ),
                },
            )

        result = DocumentSerializer(
            document,
            context={
                "request": request
            },
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Document status updated."
                ),
                "document": result.data,
            }
        )
