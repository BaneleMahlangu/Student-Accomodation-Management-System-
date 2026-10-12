# Student Haven

Student Haven is a Django REST and React application for student accommodation discovery and administration. It includes student, landlord and administrator workflows for property listings, verified-stay reviews, applications and appeals, document review, contracts, funding, PayFast checkout, refund requests, bookings, maintenance, complaints, messaging, notifications, waiting lists, reporting and risk review.

## Run locally on Windows

1. Install Python 3.12 or newer, Node.js 22 or newer, and MySQL 8.
2. Create a MySQL database and user for the application. Give that user access to the student_haven database.
3. In PowerShell at the project root, run:

        py -3.12 -m venv venv
        .\venv\Scripts\Activate.ps1
        python -m pip install -r requirements.txt
        Copy-Item .env.example .env

4. Edit .env with the MySQL password and a private DJANGO_SECRET_KEY. Do not commit .env.
5. Apply database migrations and start Django:

        python manage.py migrate
        python manage.py check
        python manage.py runserver

6. In a second PowerShell window, run:

        cd frontend
        Copy-Item .env.example .env.local
        npm ci
        npm run dev

Open the local URL printed by Vite. The backend uses the development database values in .env; use the same API URL in frontend/.env.local if the backend is not at http://localhost:8000.

To create an administrator, run python manage.py createsuperuser. A landlord account can be registered through the application. The seed_accommodations management command creates sample listings only when DEBUG is true and requires a landlord account with email demo.landlord@studenthaven.local; create that demo account first if you want sample inventory. Seeded listings are marked as demos, labelled in accommodation discovery, and excluded from production discovery. They are not verified, available accommodation.

## PayFast

Payment checkout supports PayFast sandbox and live mode. Development defaults to sandbox, but checkout stays unavailable until merchant settings are supplied. Configure the sandbox merchant ID and key and a publicly reachable PAYFAST_NOTIFY_URL, for example https://your-test-domain.example/api/funding/payfast/notify/. PayFast must be able to reach that URL to confirm payments; a local server needs a secure public tunnel. Keep all merchant credentials in the backend .env only.

For live payments, set DJANGO_DEBUG=false, a unique DJANGO_SECRET_KEY, the deployed DJANGO_ALLOWED_HOSTS, MySQL connection values, verified HTTPS frontend and notification URLs, the live merchant ID/key/passphrase, and production SMTP settings. The server refuses to start in live PayFast mode with debug enabled, missing merchant secrets, or non-HTTPS return/notification URLs. The student payment page trusts only a validated PayFast server notification; returning from checkout by itself never marks an invoice paid. See the [PayFast developer documentation](https://developers.payfast.co.za/documentation) for current sandbox and ITN setup requirements.

Live transactions are real charges. Start with PayFast sandbox and a public HTTPS notification endpoint, confirm the callback reaches the backend, and then configure live merchant credentials through the hosting provider's secret store.

## Production configuration

- Configure MySQL backups, TLS, a trusted reverse proxy, static/media storage and monitoring before exposing the service.
- Set `PRIVATE_DOCUMENT_ROOT` to persistent private storage outside the public media directory. Run database migrations during deployment; the document migration moves existing uploaded identity and funding files out of the public media directory. Back up this private directory with the database.
- Set `PRIVATE_PROFILE_ROOT` to persistent private storage outside the public media directory and back it up with the database. Student profile photos are normalized to JPEG and are only served to their owner.
- Set DJANGO_DEBUG=false, a unique DJANGO_SECRET_KEY, DJANGO_ALLOWED_HOSTS, database credentials, an HTTPS FRONTEND_BASE_URL, CORS_ALLOWED_ORIGINS, and CSRF_TRUSTED_ORIGINS.
- Configure `DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, and `DEFAULT_FROM_EMAIL`. The defaults use StudentHaven's `studenthaven02@gmail.com` account with Gmail SMTP (`smtp.gmail.com`, port 587, STARTTLS). Set `EMAIL_HOST_PASSWORD` to that Google account's app password in `.env` or the hosting secret store; do not commit it. Gmail app passwords require 2-Step Verification; see [Google's app password setup](https://support.google.com/mail/answer/185833?hl=en). If port 587 times out during TLS negotiation on your network, try port 465 with `EMAIL_USE_TLS=false` and `EMAIL_USE_SSL=true`; use only one of TLS or SSL. The console backend is disabled so verification codes cannot be printed to the server terminal. Account verification and password recovery depend on working SMTP delivery.
- Set SECURE_SSL_REDIRECT=true after HTTPS is configured at the application or trusted proxy.
- Configure secure HTTPS origins for both the frontend and PayFast notifications.
- Five consecutive password sign-in failures temporarily lock an account for 15 minutes. Two-factor code challenges have their own attempt limits.
- Use the Django deployment checklist and a production static/media storage service. Local media storage is intended for development.
- Do not enable simulated payments outside debug mode. Do not use sample property records as real supply.
- Configure Windows Task Scheduler or the hosting scheduler to run `python manage.py send_due_reports` regularly for scheduled administrator reports and `python manage.py process_scheduled_workflows` once per day for contract reminders/expiry, expired verified documents, and expired wait-list offers. Configure SMTP first; local console email only prints messages to the server terminal. Each command is safe to rerun; completed lifecycle items are not processed twice. Approved student reviews are based on completed bookings; provider refunds still need to be processed in the PayFast merchant account and recorded in the staff refund queue.

## Build and checks

From the project root:

        python manage.py check
        python manage.py makemigrations --check --dry-run

From frontend:

        npm run build

The frontend API base defaults to http://localhost:8000/api and can be changed with VITE_API_BASE_URL.

## Data and service boundaries

Sample accommodation listings, rule-based recommendations, the built-in help assistant, and the occupancy planning outlook are local application features. The outlook uses known booking dates plus recent application and waiting-list volumes; it is not a trained demand model. Listing verification, live PayFast transactions and refunds, production email, hosting/storage, OCR/document identity checks, and any external AI service require the operator's real data, accounts and credentials. The application does not treat risk signals as automatic fraud decisions.

## Project contributors

- Melvin Kisten, lecturer and project guidance: [GitHub](https://github.com/iammelvink) · [LinkedIn](https://www.linkedin.com/in/iammelvink)
- Ayanda Princess Mabasa — GitHub: `ayand-aaaa`
- Baanetse Masopha — GitHub: `masophabaanetse`
- Baby Thabiso Njabulo Manqele — GitHub: `Manqele-01B`
- Banele Clementine — [GitHub](https://github.com/BaneleMahlangu)

We acknowledge Melvin Kisten for his guidance.
