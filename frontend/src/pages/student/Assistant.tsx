import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Bot, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import "../../App.css";

type Reply = { text: string; link?: string; linkLabel?: string };
type ChatLine = { id: number; role: "assistant" | "student"; text: string; reply?: Reply };

const topics = ["How to use StudentHaven", "Find accommodation", "Application status", "Documents", "Notifications", "Safety tips", "Maintenance"];

function answerQuestion(question: string): Reply {
  const text = question.toLowerCase();
  if (/how (do|can) i use|how does .* work|step.?by.?step|where do i start|how to use|getting started/.test(text)) {
    return { text: "Start by verifying your account and completing your student profile. Then browse and compare properties, apply for a room, upload requested documents, and follow updates in My Applications and Notifications. Review any offer and agreement before continuing. The quick-start page walks through each step.", link: "/help/how-to-use", linkLabel: "Open the student quick-start guide" };
  }
  if (/safety|safe|scam|fraud|payment details|pay.*landlord/.test(text)) {
    return { text: "Review the full listing and monthly cost, verify who manages the property, arrange a viewing when possible, and read the agreement before paying. Confirm payment instructions directly with the provider and never share your password or verification code. For an immediate threat, contact local emergency services.", link: "/safety", linkLabel: "Read StudentHaven safety tips" };
  }
  if (/notification|alert|update|remind/.test(text)) {
    return { text: "Your Notifications page collects account updates such as application, document, accommodation, funding, maintenance and message activity. Open a notification to review the details and mark it read. Check your account settings to manage optional email alerts.", link: "/student/notifications", linkLabel: "Open Notifications" };
  }
  if (/profile|onboarding|student number|university|campus|course|academic details/.test(text)) {
    return { text: "Open Student profile to review your saved details. If your setup is incomplete, continue onboarding and add the requested student number, university, campus, course and contact information before applying.", link: "/student/profile", linkLabel: "Open your student profile" };
  }
  if (/application|decision|approved|declined|status/.test(text)) {
    return { text: "You can see the latest status, any requested information, and the next step in My Applications. Selecting a room is not a final allocation; the accommodation decision is made by an authorised reviewer.", link: "/student/applications", linkLabel: "Open My Applications" };
  }
  if (/document|upload|proof|id card|student id|verification/.test(text)) {
    return { text: "Open Documents to upload the requested files and check whether each one is pending, verified, or needs changes. If a document was rejected, read the reviewer’s note before uploading a replacement.", link: "/student/documents", linkLabel: "Open Documents" };
  }
  if (/bursar|sponsor|scholarship|funding programme|funding program|grant/.test(text)) {
    return { text: "The funding opportunities page shows current bursary and sponsorship programmes, their eligibility rules, deadlines, and the status of your applications. Eligibility and awards are reviewed by the funding team.", link: "/student/funding-programs", linkLabel: "View funding opportunities" };
  }
  if (/funding|payment|pay|invoice|receipt|balance/.test(text)) {
    return { text: "Funding and payment details are attached to an approved accommodation application and its signed contract. Open My Applications to choose the relevant record. If a payment attempt failed or the balance looks wrong, contact StudentHaven support before trying again.", link: "/student/applications", linkLabel: "Open My Applications" };
  }
  if (/wait.?list|queue|room available|offer/.test(text)) {
    return { text: "The Waiting List page shows your current queue entries and any room offer that needs a response. Keep notifications enabled so you can act before an offer expires.", link: "/student/waiting-list", linkLabel: "Open Waiting List" };
  }
  if (/maintenance|repair|broken|leak|fault/.test(text)) {
    return { text: "Use Maintenance to report a repair and follow its progress. For an immediate safety emergency, contact local emergency services or your residence staff directly.", link: "/student/maintenance", linkLabel: "Open Maintenance" };
  }
  if (/complaint|dispute|appeal|unfair|concern/.test(text)) {
    return { text: "You can send a confidential concern through Help & Complaints and follow staff replies there. This assistant cannot review or change an official decision.", link: "/student/complaints", linkLabel: "Open Help & Complaints" };
  }
  if (/find|search|property|accommodation|residence|room/.test(text)) {
    return { text: "Browse approved listings, compare up to three properties, save favourites, and open a property to see its rooms and available beds. Availability can change before an application is approved.", link: "/accommodation", linkLabel: "Find accommodation" };
  }
  if (/message|human|person|staff|support|contact|help/.test(text)) {
    return { text: "For accommodation questions, you can message the landlord through Messages. Choose the property related to your question.", link: "/student/messages?new=landlord", linkLabel: "Message your landlord" };
  }
  if (/login|password|sign in|account/.test(text)) {
    return { text: "If you can’t sign in, use the password reset option on the login page. For verification or security issues that persist, contact support so a staff member can review your account.", link: "/forgot-password", linkLabel: "Reset your password" };
  }
  return { text: "I can guide you through accommodation search, profile setup, applications, documents, funding, notifications, safety, the waitlist and maintenance. I cannot see private account records or make official decisions. For accommodation questions, message your landlord.", link: "/help/how-to-use", linkLabel: "Open the student quick-start guide" };
}

export default function StudentAssistant() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<ChatLine[]>([
    { id: 1, role: "assistant", text: "Hi! I can guide you to the right StudentHaven page and explain common steps. What would you like help with?" },
  ]);
  const nextId = useMemo(() => Math.max(1, ...history.map((line) => line.id)) + 1, [history]);

  function ask(value: string) {
    const cleanQuestion = value.trim();
    if (!cleanQuestion) return;
    const reply = answerQuestion(cleanQuestion);
    setHistory((current) => [...current, { id: nextId, role: "student", text: cleanQuestion }, { id: nextId + 1, role: "assistant", text: reply.text, reply }]);
    setQuestion("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(question);
  }

  return <div className="page-shell"><main className="student-assistant-page">
    <header className="funding-header"><div><span className="section-eyebrow">STUDENTHAVEN AI GUIDE</span><h1><Bot size={31} aria-hidden="true" /> Ask StudentHaven AI</h1><p>Get step-by-step directions for common accommodation tasks and quick links to the right page.</p></div><Link className="dashboard-secondary-action" to="/student/dashboard">Student dashboard</Link></header>
    <div className="assistant-disclaimer" role="note"><strong>About this assistant</strong><span>The guide matches your question to StudentHaven help information. It cannot see private account records or make official application, funding or accommodation decisions. Don’t enter passwords, banking details or sensitive documents here.</span></div>
    <section className="assistant-chat-panel" aria-label="StudentHaven help conversation">
      <div className="assistant-topic-row" aria-label="Common questions">{topics.map((topic) => <button key={topic} type="button" onClick={() => ask(topic)}>{topic}</button>)}</div>
      <div className="assistant-chat-history" aria-live="polite">{history.map((line) => <article key={line.id} className={`assistant-chat-line ${line.role === "student" ? "student-chat-line" : "guide-chat-line"}`}><span>{line.role === "student" ? <><UserRound size={14} aria-hidden="true" /> You</> : <><Bot size={14} aria-hidden="true" /> StudentHaven AI</>}</span><p>{line.text}</p>{line.reply?.link && <Link to={line.reply.link}>{line.reply.linkLabel || "Open page"}</Link>}</article>)}</div>
      <form className="assistant-question-form" onSubmit={submit}><label htmlFor="student-guide-question">Ask a question</label><textarea id="student-guide-question" rows={2} maxLength={1000} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="For example: how do I check my application status?" /><div><small>{question.length}/1,000</small><button className="dashboard-primary-action" disabled={!question.trim()}>Send question</button></div></form>
    </section>
    <p className="assistant-support-footer">Need a person to review a property concern? <Link to="/student/messages?new=landlord">Message your landlord</Link>.</p>
  </main></div>;
}
