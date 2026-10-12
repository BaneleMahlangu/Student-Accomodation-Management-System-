import { useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  FileText,
  GraduationCap,
  Headphones,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  UserRound,
  Wallet,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import "../App.css";

type PageKey = "about" | "safety" | "legal" | "guide";

interface InformationCard {
  id?: string;
  title: string;
  description: string;
  Icon: LucideIcon;
}

interface InformationPage {
  kicker: string;
  title: string;
  introduction: string;
  cards: InformationCard[];
  closingTitle: string;
  closingText: string;
}

const pages: Record<PageKey, InformationPage> = {
  about: {
    kicker: "ABOUT STUDENTHAVEN",
    title: "A clearer way to find student accommodation.",
    introduction: "StudentHaven brings students, accommodation providers and useful services together in one place, from the first property search through the steps of applying and settling in.",
    cards: [
      { title: "Made for student life", description: "Compare residences, room details, facilities, campus locations and monthly costs while planning your next move.", Icon: GraduationCap },
      { title: "A connected journey", description: "Keep your profile, applications, documents, messages and stay information close to your StudentHaven account.", Icon: CheckCircle2 },
      { title: "A place for housing providers", description: "Landlords can list accommodation and manage the applications and resident services connected to their properties.", Icon: Building2 },
      { title: "South African context", description: "The platform is built around South African campuses and student housing needs, with support based in Johannesburg.", Icon: MapPin },
    ],
    closingTitle: "Ready to find your next stay?",
    closingText: "Explore available accommodation or create a student account to manage your applications.",
  },
  safety: {
    kicker: "STUDENT SAFETY TIPS",
    title: "Search carefully. Ask questions. Keep your account secure.",
    introduction: "Use these checks when reviewing accommodation and communicating with a housing provider. StudentHaven guidance can help you prepare, but it does not replace your own checks or emergency support.",
    cards: [
      { title: "Check the full listing", description: "Review the address, campus distance, room type, facilities, availability and full monthly cost. Ask the provider about anything that is unclear.", Icon: Search },
      { title: "View before you commit", description: "Arrange a viewing where possible, in person or by live video. Confirm who you are speaking with and that they manage the property.", Icon: MapPin },
      { title: "Read every agreement", description: "Review the lease, deposit, payment schedule, house rules and cancellation terms. Keep a copy of documents you sign.", Icon: FileText },
      { title: "Verify payment details", description: "Confirm payment instructions directly with the property provider through a trusted channel before transferring money. Keep proof of payment.", Icon: Wallet },
      { title: "Protect your account", description: "Never share your password or verification code. Use your own device to sign in and sign out on shared devices.", Icon: ShieldCheck },
      { title: "Get urgent help", description: "For an immediate threat or medical emergency, contact local emergency services and residence staff. Use StudentHaven support for platform issues.", Icon: Headphones },
    ],
    closingTitle: "Keep important conversations easy to follow.",
    closingText: "Use StudentHaven Messages for accommodation questions and keep relevant application or property details in the conversation.",
  },
  legal: {
    kicker: "LEGAL & POLICIES",
    title: "Understand the service before you use it.",
    introduction: "This page summarizes practical platform guidance. Review the specific lease, payment terms and notices that apply to your accommodation before you agree to them.",
    cards: [
      { id: "terms", title: "Using StudentHaven", description: "Provide accurate account and application information, use the platform respectfully, and keep your sign-in details private. You are responsible for reviewing information before you submit it.", Icon: FileText },
      { title: "Listings and applications", description: "Listing details and availability may change. An application is not a confirmed allocation; follow its status and wait for the relevant authorised decision and confirmation.", Icon: Building2 },
      { id: "privacy", title: "Personal information", description: "Your account may contain contact, academic, application and accommodation information. Share only what is requested for the step you are completing, and use account settings to manage available privacy and notification options.", Icon: UserRound },
      { title: "Agreements and payments", description: "Read provider agreements, charges, due dates and payment instructions before accepting or paying. Keep copies of agreements and receipts for your records.", Icon: Wallet },
      { title: "Questions and concerns", description: "For help understanding a platform notice or requesting policy information, contact StudentHaven support. For disputes about a lease, seek appropriate independent advice.", Icon: MessageCircle },
    ],
    closingTitle: "Need help with a policy question?",
    closingText: "Contact StudentHaven support and include the page or notice you are asking about.",
  },
  guide: {
    kicker: "STUDENT QUICK-START GUIDE",
    title: "How to use the StudentHaven system.",
    introduction: "Complete each stage in order. Your application page shows the current status and the next action when you need to do something.",
    cards: [
      { title: "1. Create and verify your account", description: "Choose the student account option, enter your details and university information, then use the email code to verify your address.", Icon: UserRound },
      { title: "2. Complete onboarding and your profile", description: "Add your student number, campus, course, year of study and accommodation preferences so your profile is ready before you apply.", Icon: GraduationCap },
      { title: "3. Find and compare stays", description: "Browse properties, check rooms, prices, facilities and location, then save or compare the options that suit your needs.", Icon: Search },
      { title: "4. Apply and provide documents", description: "Choose an available room and submit your application. Upload requested documents, then check their review status.", Icon: FileText },
      { title: "5. Wait for the application decision", description: "Follow your status in My Applications and Notifications. If staff request information, open the application and respond there.", Icon: Bell },
      { title: "6. Review and sign the contract", description: "After approval, read the accommodation details, agreement, residence rules and cancellation terms before signing.", Icon: BadgeCheck },
      { title: "7. Review the balance and pay", description: "Open Funding & Payments to review the monthly rent, full stay total, amount received and remaining balance. Choose a full payment or enter an installment. If PayFast is enabled, payment details are entered on its hosted checkout page, not stored in StudentHaven.", Icon: Wallet },
      { title: "8. Wait for booking confirmation", description: "Returning from checkout is not the final confirmation. Check My Applications for the payment result and booking status. If room allocation needs staff review, follow the update there.", Icon: CheckCircle2 },
      { title: "9. Check in and manage your stay", description: "Once your booking is confirmed, use My Room, Messages and Maintenance to review move-in details, contact the provider and follow service requests.", Icon: Wrench },
    ],
    closingTitle: "Not sure what to do next?",
    closingText: "Open My Applications and follow the Your Next Step prompt. For help with a specific record, contact StudentHaven support and include its reference number.",
  },
};

export default function CompanyInformation({ page }: { page: PageKey }) {
  const content = pages[page];
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const timer = window.setTimeout(() => {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hash, page]);

  return (
    <div className="app company-info-page">
      <header className="welcome-nav">
        <Link to="/" className="welcome-brand">
          <img src="/SH-logo.jpg" alt="" />
          <span><strong>StudentHaven</strong><small>Find your place. Build your future.</small></span>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/accommodation">Browse stays</Link>
          <Link to="/login">Sign in</Link>
          <Link className="welcome-nav-cta" to="/register">Create account <ArrowRight size={16} aria-hidden="true" /></Link>
        </nav>
      </header>

      <main className="company-info-content">
        <Link className="company-info-back" to="/"><ArrowLeft size={16} aria-hidden="true" /> StudentHaven home</Link>
        <section className="company-info-hero">
          <span><BookOpen size={16} aria-hidden="true" /> {content.kicker}</span>
          <h1>{content.title}</h1>
          <p>{content.introduction}</p>
        </section>

        <section className="company-info-grid" aria-label={content.kicker}>
          {content.cards.map(({ id, title, description, Icon }, index) => (
            <article className="company-info-card" id={id} key={title}>
              <div className="company-info-card-top"><span className="company-info-icon"><Icon size={21} aria-hidden="true" /></span><small>{String(index + 1).padStart(2, "0")}</small></div>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </section>

        <section className="company-info-cta">
          <div><span>{page === "guide" ? "STUDENT SUPPORT" : "STUDENTHAVEN"}</span><h2>{content.closingTitle}</h2><p>{content.closingText}</p></div>
          <div className="company-info-cta-actions">
            {page === "guide" ? <Link to="/student/assistant"><BookOpen size={17} aria-hidden="true" /> Open the AI Guide</Link> : <Link to="/help/how-to-use"><BookOpen size={17} aria-hidden="true" /> Student quick-start guide</Link>}
            <a href="mailto:support@studenthaven.co.za"><MessageCircle size={17} aria-hidden="true" /> Contact support</a>
          </div>
        </section>
      </main>
    </div>
  );
}
