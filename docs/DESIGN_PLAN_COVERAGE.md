# Student Haven design-plan coverage

This is a code and configuration audit of the 63 sections in the supplied plan. “Implemented” means the repository has a connected workflow or screen; it does not mean production credentials, real accommodation data, or a formal usability/security certification have been supplied.

| # | Plan section | Status | Current coverage / remaining work |
|---:|---|---|---|
| 1 | Product vision | Partial | The main accommodation lifecycle is connected. Production availability still depends on real listings, deployment, and service credentials. |
| 2 | User roles | Implemented | Separate student, landlord, and administrator experiences with server-side role checks. |
| 3 | Student experience | Mostly implemented | Dashboard, discovery, applications, room, funding, documents, contracts, maintenance, messaging, notifications, settings, support, and accommodation change flows are present. |
| 4 | Registration | Implemented with setup | Student/landlord registration and email verification are present; live email needs verified SMTP settings. |
| 5 | Login | Mostly implemented | Password recovery, verification, two-factor challenges, lockout and session controls exist. Native biometric/passkey login is not implemented. |
| 6 | Student onboarding | Implemented | Profile, university, preferences, documents and funding choices feed the student workflow. |
| 7 | Student profile | Mostly implemented | Profile/contact/preferences/privacy/security controls exist. Biometric login is not available. |
| 8 | Accommodation discovery | Implemented, data-dependent | Galleries, categories, availability and details are present. Real photos, amenities, security details and supply must be entered by providers. |
| 9 | Search and filtering | Implemented | Search, filters, sorting, saved properties and comparison are present. |
| 10 | AI accommodation matching | Partial | Recommendations use transparent preference/rule scoring. There is no trained or hosted machine-learning model. |
| 11 | Accommodation details | Mostly implemented | Photo gallery/lightbox, rooms, amenities, maps, verified-stay reviews and landlord-entered HTTPS virtual-tour links are connected. Hosted video storage is not included. |
| 12 | Room selection | Implemented | Room/bed availability and application selection are connected. |
| 13 | Application system | Implemented | Multi-step applications, status changes, review history, document/funding links and booking follow-through exist. |
| 14 | Application validation | Implemented | Server-side ownership, required data and workflow validation are present. |
| 15 | Document management | Implemented with manual review | Private uploads, hashes, expiry dates, verification states, review and replacement paths exist. |
| 16 | Automated document verification | Not complete | Expiry and duplicate-upload signals are automated; OCR, identity authenticity checks and automated inconsistency detection need an approved OCR/identity service. Staff review remains authoritative. |
| 17 | Admin application review | Implemented | Staff review, decision history, risk context and audit trail are connected. |
| 18 | Additional information request | Implemented | Staff can request and review further application information. |
| 19 | Application status tracking | Implemented | Students can follow application status and history. |
| 20 | Smart waiting list | Implemented | Prioritised matching, timed offers, acceptance/expiry and bed re-offers exist; expiry is also handled by the daily command. |
| 21 | Admin approval | Implemented | Property and application approval paths are staff-controlled. |
| 22 | Funding system | Partial | Funding methods, review and sponsorship workflows exist. Official NSFAS, university, bank or sponsor system connections/data are not supplied. |
| 23 | Financial dashboard | Implemented | Due, paid and balance views plus audited refund requests are connected. Staff still processes approved returns through PayFast. |
| 24 | Payment system | Partial | PayFast sandbox/live checkout and signed notification handling are coded. Merchant credentials, public HTTPS callback, reconciliation and live operation need account/deployment configuration. |
| 25 | Digital contracts | Partial | Contract generation and typed-name signature evidence exist. A qualified e-signature provider and legal review of enforceability/terms are not configured. |
| 26 | Check-in and check-out | Implemented | Booking QR check-in, check-out and records exist. |
| 27 | Student room dashboard | Implemented | Confirmed/active stay, booking, contract and accommodation actions are connected. |
| 28 | Maintenance system | Implemented | Students and landlords can submit, assign, update and resolve maintenance work. |
| 29 | Complaints | Implemented | Complaint submission, responses, status handling and administration are present. |
| 30 | Messaging | Implemented | In-platform student/provider/admin conversations are present. |
| 31 | Notification centre | Implemented with setup | In-app events and email delivery hooks exist; production email needs SMTP and sender-domain verification. SMS is not configured. |
| 32 | AI chatbot / support agent | Partial | A local scripted help assistant exists. A live AI provider, approved privacy terms and provider credentials are not configured. |
| 33 | Fraud and risk detection | Implemented as review signals | Student/landlord queues include suspicious repeated documents and landlord activity. Signals are advisory; staff make decisions. |
| 34 | Property management | Implemented, data-dependent | Landlords manage listing, photos, virtual-tour links, buildings and inventory. Real verified properties and images must be entered. |
| 35 | Room management | Implemented | Building/floor/room/bed inventory and availability management are present. |
| 36 | Landlord dashboard | Implemented | Scoped applications, tenant/booking records, finance, maintenance and reports are connected. Application decisions remain administrator-controlled. |
| 37 | Predictive occupancy analytics | Partial | Current outlook is a rules-based estimate from applications, bookings and waiting-list volume, not a trained predictive model. |
| 38 | Funding administration | Implemented | Staff funding review and payment records are connected. |
| 39 | Sponsorship/bursary management | Implemented with data dependency | Programs, student applications and award decisions exist; real sponsor rules, agreements and funds must be supplied. |
| 40 | Administration | Implemented | Administrator command centre and operational queues exist. |
| 41 | Audit log | Implemented | Important application, funding, risk, security and review events are recorded. |
| 42 | Map system | Implemented, data-dependent | OpenStreetMap display, campus/property selection and directions exist. Accurate results require verified property/campus coordinates. |
| 43 | Analytics | Implemented | Operational dashboards and trends exist; outputs reflect the quality/completeness of entered data. |
| 44 | Reporting | Implemented with deployment step | Report scheduling and the due-report command exist. Configure SMTP and a regular Windows/host scheduler job. |
| 45 | Admin search | Implemented | Cross-record administrator search is present. |
| 46 | Security | Mostly implemented | Two-factor auth, sign-in history, session revocation, private document storage and risk review exist. Production TLS, secret storage, backups, monitoring and security review remain deployment work. |
| 47 | Accessibility | Partial | Semantic labels, keyboard gallery controls, reduced-motion handling and responsive controls exist. The whole product has not had a WCAG audit. |
| 48 | Responsive design | Mostly implemented | Responsive web views and role-specific mobile navigation exist. There is no native iOS/Android application. |
| 49 | Design system | Mostly implemented | Shared visual tokens/components and consistent status treatments are used; formal design documentation still needs product sign-off. |
| 50 | UI states | Mostly implemented | Loading, empty, error and success states are used across key routes. Every one of the 76 requested screen variants has not had a separate visual QA pass. |
| 51 | Automated workflow states | Partial | Important user actions and daily contract/document/wait-list processing are automated. The daily command must be scheduled; external provider actions remain manual. |
| 52 | Edge cases | Partial | Core ownership, duplicate request, capacity, price, date, status and payment conditions are guarded. Broad real-user acceptance testing remains. |
| 53 | Student application decision logic | Implemented | Application decisions, eligibility/status paths and history are staff-controlled. |
| 54 | AI recommendation logic | Partial | Current matching is deterministic and explainable; trained AI requires a data set, model, provider/privacy decision and evaluation. |
| 55 | Design language | Implemented | The current web product follows the Student Haven visual language. |
| 56 | Dashboard personalisation | Mostly implemented | Student, landlord and administrator dashboards prioritise role-specific status, work queues, metrics, notices and actions. |
| 57 | Command centre | Implemented | The administrator dashboard links operational queues and summary views. |
| 58 | Notification automation | Mostly implemented | Business-event notices and scheduled reminders are present. Delivery depends on user preference, SMTP and a running scheduler. |
| 59 | User permissions | Implemented | Student ownership checks, landlord property scoping and administrator-only operations are enforced server-side. |
| 60 | Final Figma requirement | Not complete | No Figma file or interactive Figma prototype is present in this repository. |
| 61 | Primary screens to generate | Partial | The working React application contains the principal role flows, but it is not a Figma file with 76 individually staged screen frames. |
| 62 | Prototype interactions | Partial | The web application has connected interactions; the separate linked Figma prototype requested by the plan is not present. |
| 63 | Final product principle | Partial | The application is a substantial working foundation, not a production-ready service until the remaining real data, integrations, legal review and deployment work below is completed. |

## Required before real operation

- Enter and verify actual accommodation inventory, campus/property coordinates, landlord details, prices, amenities, eligibility and photos. Seeded/demo listings are explicitly not real supply.
- Configure PayFast merchant credentials, public HTTPS notification URL, hosting, database and refund-handling procedure. Refunds require a staff member to process them with the merchant account and record the provider reference.
- Configure production SMTP, sender-domain verification, HTTPS, secret management, private persistent document/profile storage, backups and monitoring.
- Choose and configure approved OCR/identity verification and AI providers only after privacy, consent, data-retention and institutional approvals. Current recommendations and help remain local rule/script features.
- Have the contract templates and typed-name signature process reviewed for the applicable South African legal requirements; obtain/approve an e-sign provider if the plan requires that level of signature.
- Add real bursary/NSFAS/sponsor data or approved connections, and schedule `send_due_reports` plus the daily `process_scheduled_workflows` command in Windows Task Scheduler or the production host.
- Complete accessibility/usability/security acceptance reviews and create the separate Figma file/prototype if that deliverable is still required.

## Verification performed for this pass

- `frontend`: `npm run build` completed successfully.
- Django migration drift check: `makemigrations --check --dry-run --skip-checks` reported no changes.
- A fresh in-memory SQLite database accepted all project migrations, including appeals, property reviews/virtual tours and refund requests.
- Python syntax parsing passed for the changed backend modules. A full Django system check could not be run with the available Python runtime: this workspace virtual environment uses Python 3.14, while the executable allowed in this session is Python 3.12; Pillow's native extension is incompatible, and the base Python 3.14 executable is denied by the session sandbox.
