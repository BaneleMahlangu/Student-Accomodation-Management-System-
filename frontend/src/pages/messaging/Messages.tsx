import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getConversation, getConversations, getMessagingRecipients, sendConversationMessage, startConversation } from "../../services/api";
import type { MessagingRecipient, StudentHavenConversation } from "../../services/api";
import "../../App.css";

type Audience = "student" | "landlord" | "admin";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

function Messages({ audience }: { audience: Audience }) {
  const [searchParams] = useSearchParams();
  const landlordHandoff = ["support", "landlord"].includes(searchParams.get("new") || "");
  const requestedConversationId = Number(searchParams.get("conversation"));
  const [conversations, setConversations] = useState<StudentHavenConversation[]>([]);
  const [recipients, setRecipients] = useState<MessagingRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(
    Number.isSafeInteger(requestedConversationId) && requestedConversationId > 0
      ? requestedConversationId
      : null,
  );
  const [selected, setSelected] = useState<StudentHavenConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(landlordHandoff);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reply, setReply] = useState("");
  const [draft, setDraft] = useState({ recipient_id: "", subject: landlordHandoff ? "Accommodation question" : "", body: "" });
  const canStartConversation = true;
  const pageTitle = audience === "student" ? "Messages" : audience === "landlord" ? "Messages" : "Platform messages";
  const dashboardPath = audience === "admin" ? "/admin/dashboard" : audience === "landlord" ? "/landlord/dashboard" : "/student/dashboard";
  const recipientDescription = audience === "student"
    ? "Message a landlord connected to one of your applications or your current accommodation."
    : audience === "landlord"
      ? "Start a conversation with a student registered at one of your properties or an active StudentHaven administrator."
      : "Start a conversation with any verified landlord.";

  async function loadList() {
    setLoading(true); setError("");
    try {
      const data = await getConversations();
      setConversations(data);
      if (!data.some((item) => item.id === selectedId)) setSelectedId(data[0]?.id ?? null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load messages."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    void loadList();
    setRecipientsLoading(true);
    getMessagingRecipients()
      .then(setRecipients)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load message recipients."))
      .finally(() => setRecipientsLoading(false));
  }, [audience]);

  useEffect(() => {
    let active = true;
    const refreshList = async () => {
      if (!active || document.visibilityState === "hidden") return;
      try {
        const data = await getConversations();
        if (!active) return;
        setConversations(data);
        setSelectedId((current) => current !== null && data.some((item) => item.id === current)
          ? current
          : data[0]?.id ?? null);
      } catch {
        // Keep the existing inbox visible if a background refresh fails.
      }
    };
    const interval = window.setInterval(() => void refreshList(), 60_000);
    document.addEventListener("visibilitychange", refreshList);
    window.addEventListener("focus", refreshList);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshList);
      window.removeEventListener("focus", refreshList);
    };
  }, [audience]);

  useEffect(() => {
    if (selectedId === null) { setSelected(null); return; }
    let active = true;
    let requestPending = false;
    const refreshConversation = async (showLoading: boolean) => {
      if (!active || requestPending || document.visibilityState === "hidden") return;
      requestPending = true;
      if (showLoading) setDetailLoading(true);
      try {
        const item = await getConversation(selectedId);
        if (active) setSelected(item);
      } catch (caught) {
        if (active && showLoading) setError(caught instanceof Error ? caught.message : "Unable to load the conversation.");
      } finally {
        requestPending = false;
        if (active && showLoading) setDetailLoading(false);
      }
    };
    void refreshConversation(true);
    const interval = window.setInterval(() => void refreshConversation(false), 60_000);
    const refreshWhenVisible = () => void refreshConversation(false);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [selectedId]);

  async function createThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const result = await startConversation({
        subject: draft.subject,
        body: draft.body,
        recipient_id: Number(draft.recipient_id),
      });
      setDraft({ recipient_id: "", subject: "", body: "" }); setShowNew(false); setNotice("Message sent.");
      await loadList(); setSelectedId(result.id); setSelected(result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to start this conversation."); }
    finally { setSaving(false); }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true); setError("");
    try {
      await sendConversationMessage(selected.id, reply);
      setReply("");
      const updated = await getConversation(selected.id);
      setSelected(updated); await loadList();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to send your message."); }
    finally { setSaving(false); }
  }

  const unread = conversations.reduce((total, item) => total + item.unread_count, 0);

  return <div className={audience === "admin" ? "admin-dashboard-page messages-page" : "student-page messages-page"}>
    {audience === "admin" ? <header className="admin-header"><Link to="/admin/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Administrator Console</span></div></Link><div className="admin-header-title">Messages</div></header> : <header className="dashboard-header"><Link to={dashboardPath} className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>{audience === "landlord" ? "Landlord Portal" : "Student Portal"}</span></div></Link><Link to={dashboardPath} className="dashboard-secondary-action">Dashboard</Link></header>}
    <main className="messages-content">
      <section className="messages-page-heading"><div><span className="eyebrow">STUDENTHAVEN INBOX</span><h1>{pageTitle}</h1><p>{audience === "admin" ? "Review platform conversations and start a conversation with any verified landlord." : recipientDescription}</p></div><div className="messages-unread"><strong>{unread}</strong><span>Unread</span></div></section>
      {error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}{notice && <div className="property-alert property-alert-success" role="status">{notice}</div>}
      <div className="messages-workspace"><aside className="messages-list-panel"><div className="messages-list-title"><div><span className="eyebrow">INBOX</span><h2>Conversations</h2></div>{canStartConversation && <button className="dashboard-primary-action" onClick={() => setShowNew((value) => !value)}>{showNew ? "Close" : "New message"}</button>}</div>
        {loading ? <div className="property-empty-state">Loading conversations…</div> : conversations.length === 0 ? <div className="property-empty-state"><h3>No conversations yet</h3><p>New conversations will appear here.</p></div> : conversations.map((item) => <button key={item.id} className={`messages-list-item ${selectedId === item.id ? "selected" : ""}`} onClick={() => { setSelectedId(item.id); setShowNew(false); }}><strong>{item.subject}</strong><small>{item.other_participants.map((participant) => participant.name).join(", ") || "StudentHaven administrator"}</small><small>{item.last_message?.body ?? "No messages"}</small><span>{item.unread_count > 0 ? `${item.unread_count} unread` : formatDate(item.updated_at)}</span></button>)}
      </aside>
      <section className="messages-thread-panel">
        {showNew && canStartConversation ? <><div className="messages-thread-heading"><div><span className="eyebrow">NEW CONVERSATION</span><h2>Send a message</h2><p>{recipientDescription}</p></div></div><form className="messages-new-form" onSubmit={(event) => void createThread(event)}>
          <label>Recipient<select value={draft.recipient_id} onChange={(event) => setDraft((current) => ({ ...current, recipient_id: event.target.value }))} required><option value="">Choose a recipient</option>{recipients.map((recipient) => <option value={recipient.id} key={recipient.id}>{recipient.name} · {recipient.role.replaceAll("_", " ").toLowerCase()} · {recipient.email}</option>)}</select>{recipientsLoading ? <small>Loading available contacts…</small> : recipients.length === 0 ? <small>{audience === "student" ? "No landlord is linked to your applications or accommodation yet." : audience === "landlord" ? "No students registered to your properties or active administrators are available." : "No verified landlords are available."}</small> : null}</label>
          <label>Subject<input maxLength={200} value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} required placeholder="What do you need help with?" /></label><label>Message<textarea rows={7} maxLength={5000} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} required placeholder="Write your message…" /></label><button className="dashboard-primary-action" disabled={saving || recipientsLoading || recipients.length === 0 || !draft.recipient_id}>{saving ? "Sending…" : "Send message"}</button></form></> : detailLoading ? <div className="property-empty-state">Loading messages…</div> : selected ? <>
          <div className="messages-thread-heading"><div><span className="eyebrow">{selected.property_name || selected.application_number || "STUDENTHAVEN SUPPORT"}</span><h2>{selected.subject}</h2><p>With {selected.other_participants.map((item) => `${item.name} (${item.role.toLowerCase()})`).join(", ")}</p></div><span className={`property-status-pill property-status-${selected.status.toLowerCase()}`}>{selected.status}</span></div>
          <div className="messages-thread-items">{(selected.messages ?? []).map((item) => <article className={`messages-thread-message ${item.sender_role === (audience === "student" ? "STUDENT" : audience === "landlord" ? "LANDLORD" : "ADMINISTRATOR") ? "own-message" : ""}`} key={item.id}><div><strong>{item.sender_name}</strong><time>{formatDate(item.created_at)}</time></div><p>{item.body}</p></article>)}</div>
          {selected.status === "ACTIVE" ? <form className="messages-reply-form" onSubmit={(event) => void sendReply(event)}><label>Reply<textarea rows={3} value={reply} maxLength={5000} onChange={(event) => setReply(event.target.value)} required placeholder="Write a reply…" /></label><button className="dashboard-primary-action" disabled={saving}>{saving ? "Sending…" : "Send reply"}</button></form> : <div className="property-empty-state">This conversation is closed.</div>}
        </> : <div className="property-empty-state"><h2>Select a conversation</h2><p>Choose a conversation from the inbox to read and reply.</p></div>}
      </section></div>
      <Link className="complaint-back-link" to={dashboardPath}>Back to dashboard</Link>
    </main>
  </div>;
}

export default Messages;
