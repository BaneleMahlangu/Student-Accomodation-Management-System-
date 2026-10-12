from django.contrib.auth import authenticate
from django.db import transaction

from rest_framework import serializers

from .models import (
    User,
    StudentProfile,
    LandlordProfile,
)
from .identity import south_african_id_birth_date


class StudentRegistrationSerializer(serializers.Serializer):

    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    mobile = serializers.CharField(max_length=20)

    password = serializers.CharField(
        write_only=True,
        min_length=8,
    )

    password_confirm = serializers.CharField(
        write_only=True,
    )

    student_number = serializers.CharField(
        max_length=50,
    )

    national_id = serializers.CharField(max_length=13)

    date_of_birth = serializers.DateField()

    university = serializers.CharField(
        max_length=200,
    )

    campus = serializers.CharField(
        max_length=200,
    )

    course = serializers.CharField(
        max_length=200,
    )

    year_of_study = serializers.IntegerField(
        min_value=1,
        max_value=10,
    )

    def validate_email(self, value):

        value = value.strip().lower()

        if User.objects.filter(
            email=value
        ).exists():

            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return value

    def validate_student_number(self, value):

        value = value.strip()

        if StudentProfile.objects.filter(
            student_number=value
        ).exists():

            raise serializers.ValidationError(
                "This student number is already registered."
            )

        return value

    def validate_national_id(self, value):
        value = value.strip()
        birth_date = south_african_id_birth_date(value)
        if birth_date is None:
            raise serializers.ValidationError("Enter a valid 13-digit South African ID number.")
        if StudentProfile.objects.filter(national_id=value).exists():
            raise serializers.ValidationError("This ID number is already registered.")
        return value

    def validate(self, data):

        id_birth_date = south_african_id_birth_date(data["national_id"])
        if id_birth_date != data["date_of_birth"]:
            raise serializers.ValidationError({
                "date_of_birth": "Your date of birth must match the date encoded in your ID number."
            })

        if (
            data["password"]
            != data["password_confirm"]
        ):

            raise serializers.ValidationError(
                {
                    "password_confirm":
                    "Passwords do not match."
                }
            )

        return data

    @transaction.atomic
    def create(self, validated_data):

        validated_data.pop(
            "password_confirm"
        )

        student_number = (
            validated_data.pop(
                "student_number"
            )
        )

        national_id = validated_data.pop("national_id")

        date_of_birth = validated_data.pop("date_of_birth")

        university = (
            validated_data.pop(
                "university"
            )
        )

        campus = (
            validated_data.pop(
                "campus"
            )
        )

        course = (
            validated_data.pop(
                "course"
            )
        )

        year_of_study = (
            validated_data.pop(
                "year_of_study"
            )
        )

        password = (
            validated_data.pop(
                "password"
            )
        )

        user = User.objects.create_user(
            password=password,
            role=User.Role.STUDENT,
            email_verification_required=True,
            **validated_data,
        )

        StudentProfile.objects.create(
            user=user,
            student_number=student_number,
            national_id=national_id,
            date_of_birth=date_of_birth,
            university=university,
            campus=campus,
            course=course,
            year_of_study=year_of_study,
        )

        return user


class LandlordRegistrationSerializer(serializers.Serializer):

    first_name = serializers.CharField(
        max_length=100,
    )

    last_name = serializers.CharField(
        max_length=100,
    )

    email = serializers.EmailField()

    mobile = serializers.CharField(
        max_length=20,
    )

    password = serializers.CharField(
        write_only=True,
        min_length=8,
    )

    password_confirm = serializers.CharField(
        write_only=True,
    )

    business_name = serializers.CharField(
        max_length=200,
    )

    registration_number = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
    )

    phone = serializers.CharField(
        max_length=20,
    )

    address = serializers.CharField(
        max_length=2000,
    )

    def validate_email(self, value):

        value = value.strip().lower()

        if User.objects.filter(
            email=value
        ).exists():

            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return value

    def validate(self, data):

        if (
            data["password"]
            != data["password_confirm"]
        ):

            raise serializers.ValidationError(
                {
                    "password_confirm":
                    "Passwords do not match."
                }
            )

        if not data["business_name"].strip():

            raise serializers.ValidationError(
                {
                    "business_name":
                    "Business or landlord name is required."
                }
            )

        if not data["phone"].strip():

            raise serializers.ValidationError(
                {
                    "phone":
                    "Business or contact phone is required."
                }
            )

        if not data["address"].strip():

            raise serializers.ValidationError(
                {
                    "address":
                    "Business or residential address is required."
                }
            )

        return data

    @transaction.atomic
    def create(self, validated_data):

        validated_data.pop(
            "password_confirm"
        )

        password = (
            validated_data.pop(
                "password"
            )
        )

        business_name = (
            validated_data.pop(
                "business_name"
            )
        )

        registration_number = (
            validated_data.pop(
                "registration_number",
                "",
            )
        )

        phone = (
            validated_data.pop(
                "phone"
            )
        )

        address = (
            validated_data.pop(
                "address"
            )
        )

        user = User.objects.create_user(
            password=password,
            role=User.Role.LANDLORD,
            email_verification_required=True,
            **validated_data,
        )

        LandlordProfile.objects.create(
            user=user,
            business_name=business_name.strip(),
            registration_number=(
                registration_number.strip()
            ),
            phone=phone.strip(),
            address=address.strip(),
            verification_status="PENDING",
            profile_completed=False,
        )

        return user


class LoginSerializer(serializers.Serializer):

    email = serializers.EmailField()

    password = serializers.CharField(
        write_only=True
    )

    def validate(self, data):

        email = data["email"].strip().lower()
        password = data["password"]

        user = authenticate(
            username=email,
            password=password,
        )

        if user is None:

            raise serializers.ValidationError(
                "Invalid email or password."
            )

        if not user.is_active:

            raise serializers.ValidationError(
                "This account is inactive."
            )

        if user.email_verification_required and not user.is_verified:
            raise serializers.ValidationError(
                "Verify your email address before signing in."
            )

        if user.role == User.Role.LANDLORD:

            try:
                landlord_profile = (
                    user.landlord_profile
                )

                if (
                    landlord_profile.verification_status
                    == "SUSPENDED"
                ):

                    raise serializers.ValidationError(
                        "This landlord account has been suspended."
                    )

                if (
                    landlord_profile.verification_status
                    == "REJECTED"
                ):

                    raise serializers.ValidationError(
                        "This landlord account has not passed verification."
                    )

            except LandlordProfile.DoesNotExist:

                raise serializers.ValidationError(
                    "Landlord profile is not configured."
                )

        data["user"] = user

        return data


class StudentProfileUpdateSerializer(serializers.Serializer):

    first_name = serializers.CharField(
        max_length=100,
        required=False,
    )

    last_name = serializers.CharField(
        max_length=100,
        required=False,
    )

    mobile = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
    )

    university = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
    )

    campus = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
    )

    course = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
    )

    year_of_study = serializers.IntegerField(
        min_value=1,
        max_value=10,
        required=False,
        allow_null=True,
    )

    date_of_birth = serializers.DateField(
        required=False,
        allow_null=True,
    )

    national_id = serializers.CharField(
        max_length=13,
        required=False,
    )

    def validate_national_id(self, value):
        value = value.strip()
        if south_african_id_birth_date(value) is None:
            raise serializers.ValidationError("Enter a valid 13-digit South African ID number.")

        request = self.context.get("request")
        profiles = StudentProfile.objects.filter(national_id=value)
        if request is not None:
            profiles = profiles.exclude(user=request.user)
        if profiles.exists():
            raise serializers.ValidationError("This ID number is already registered.")
        return value

    def validate(self, data):
        request = self.context.get("request")
        profile = getattr(request.user, "student_profile", None) if request else None
        national_id = data.get("national_id", getattr(profile, "national_id", None))
        date_of_birth = data.get("date_of_birth", getattr(profile, "date_of_birth", None))

        if national_id and date_of_birth and south_african_id_birth_date(national_id) != date_of_birth:
            raise serializers.ValidationError({
                "date_of_birth": "Your date of birth must match the date encoded in your ID number."
            })

        if national_id and not date_of_birth:
            raise serializers.ValidationError({
                "date_of_birth": "Enter your date of birth to match it with your ID number."
            })

        return data

    emergency_contact_name = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
    )

    emergency_contact_phone = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
    )

    accessibility_requirements = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=4000,
    )

    accommodation_preferences = serializers.DictField(
        required=False,
    )

    def validate_accommodation_preferences(self, value):
        allowed = {"budget", "room_type", "accessible", "distance_km"}
        if set(value) - allowed:
            raise serializers.ValidationError("Remove unsupported accommodation preference fields.")

        budget = value.get("budget", "")
        if budget not in (None, ""):
            try:
                if float(budget) <= 0:
                    raise ValueError
            except (TypeError, ValueError):
                raise serializers.ValidationError("Monthly budget must be a positive number.")

        distance = value.get("distance_km", "")
        if distance not in (None, ""):
            try:
                if float(distance) <= 0:
                    raise ValueError
            except (TypeError, ValueError):
                raise serializers.ValidationError("Campus distance must be a positive number.")

        room_type = value.get("room_type", "")
        if not isinstance(room_type, str):
            raise serializers.ValidationError("Room type must be text.")

        accessible = value.get("accessible", False)
        if not isinstance(accessible, bool):
            raise serializers.ValidationError("Accessible room preference must be true or false.")

        return value


class LandlordProfileUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100, required=False)
    last_name = serializers.CharField(max_length=100, required=False)
    mobile = serializers.CharField(max_length=20, required=False, allow_blank=True)
    business_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    registration_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
