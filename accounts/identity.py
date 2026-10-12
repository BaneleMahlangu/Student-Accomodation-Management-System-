import re
from datetime import date


def south_african_id_birth_date(identity_number):
    """Return the birth date encoded in a valid South African ID number."""
    if not isinstance(identity_number, str) or not re.fullmatch(r"\d{13}", identity_number):
        return None

    digits = [int(digit) for digit in identity_number]

    # Citizenship digit: 0 for a citizen, 1 for a permanent resident.
    if digits[10] not in (0, 1):
        return None

    total = digits[-1]
    double_digit = True
    for digit in reversed(digits[:-1]):
        value = digit * 2 if double_digit else digit
        total += value - 9 if value > 9 else value
        double_digit = not double_digit

    if total % 10:
        return None

    today = date.today()
    year = today.year // 100 * 100 + int(identity_number[:2])
    if year > today.year:
        year -= 100

    try:
        birth_date = date(year, int(identity_number[2:4]), int(identity_number[4:6]))
    except ValueError:
        return None

    return birth_date if birth_date <= today else None
