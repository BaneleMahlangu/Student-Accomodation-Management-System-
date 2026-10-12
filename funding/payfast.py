"""PayFast custom-form checkout and ITN validation helpers."""

from collections import OrderedDict
from hashlib import md5
import hmac
from ipaddress import ip_address, ip_network
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings


SANDBOX_PROCESS_URL = "https://sandbox.payfast.co.za/eng/process"
LIVE_PROCESS_URL = "https://www.payfast.co.za/eng/process"
SANDBOX_VALIDATE_URL = "https://sandbox.payfast.co.za/eng/query/validate"
LIVE_VALIDATE_URL = "https://www.payfast.co.za/eng/query/validate"

# PayFast's published ITN sender ranges. Keep these synchronized with its
# developer documentation when PayFast changes its notification infrastructure.
PAYFAST_NETWORKS = tuple(ip_network(value) for value in (
    "197.97.145.144/28",
    "41.74.179.192/27",
    "102.216.36.0/28",
    "102.216.36.128/28",
    "144.126.193.139/32",
))


def payfast_mode() -> str:
    mode = settings.PAYFAST_MODE
    return mode if mode in {"disabled", "sandbox", "live"} else "disabled"


def payfast_is_configured() -> bool:
    mode = payfast_mode()
    notify_url = settings.PAYFAST_NOTIFY_URL
    if mode not in {"sandbox", "live"}:
        return False
    if not settings.PAYFAST_MERCHANT_ID or not settings.PAYFAST_MERCHANT_KEY or not notify_url.startswith("https://"):
        return False
    if mode == "live" and not settings.PAYFAST_PASSPHRASE:
        return False
    return True


def process_url() -> str:
    return LIVE_PROCESS_URL if payfast_mode() == "live" else SANDBOX_PROCESS_URL


def _encoded_pairs(fields) -> str:
    return urlencode([(key, str(value).strip()) for key, value in fields if str(value).strip()])


def create_signature(fields, passphrase: str = "") -> str:
    parameter_string = _encoded_pairs(fields)
    if passphrase:
        parameter_string = f"{parameter_string}&passphrase={urlencode({'p': passphrase.strip()})[2:]}"
    return md5(parameter_string.encode("utf-8")).hexdigest()


def checkout_fields(*, transaction, funding_payment) -> OrderedDict:
    app = funding_payment.application
    user = funding_payment.student
    fields = OrderedDict([
        ("merchant_id", settings.PAYFAST_MERCHANT_ID),
        ("merchant_key", settings.PAYFAST_MERCHANT_KEY),
        ("return_url", f"{settings.FRONTEND_BASE_URL}/funding/{app.id}?payfast=return"),
        ("cancel_url", f"{settings.FRONTEND_BASE_URL}/funding/{app.id}?payfast=cancelled&ref={transaction.transaction_reference}"),
        ("notify_url", settings.PAYFAST_NOTIFY_URL),
        ("name_first", user.first_name[:100]),
        ("name_last", user.last_name[:100]),
        ("email_address", user.email[:100]),
        ("m_payment_id", transaction.transaction_reference),
        ("amount", f"{transaction.amount:.2f}"),
        ("item_name", f"Student accommodation payment {app.application_number}"[:100]),
        ("item_description", f"Outstanding balance for Student Haven application {app.application_number}"[:255]),
    ])
    fields["signature"] = create_signature(fields.items(), settings.PAYFAST_PASSPHRASE)
    return fields


def is_valid_payfast_ip(value: str) -> bool:
    try:
        address = ip_address(value)
    except ValueError:
        return False
    return any(address in network for network in PAYFAST_NETWORKS)


def is_valid_itn_signature(posted_fields) -> bool:
    signature = posted_fields.get("signature", "")
    if not signature:
        return False
    signed_fields = [(key, value) for key, value in posted_fields.items() if key != "signature"]
    expected = create_signature(signed_fields, settings.PAYFAST_PASSPHRASE)
    return hmac.compare_digest(signature.lower(), expected.lower())


def confirm_itn_with_payfast(posted_fields, *, timeout=12) -> bool:
    endpoint = LIVE_VALIDATE_URL if payfast_mode() == "live" else SANDBOX_VALIDATE_URL
    # The notification's signature is included in the confirmation POST.
    payload = urlencode(list(posted_fields.items())).encode("ascii")
    request = Request(
        endpoint,
        data=payload,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "StudentHaven/1.0 PayFast-ITN",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status == 200 and response.read(64).decode("ascii", "replace").strip() == "VALID"
    except Exception:
        return False
