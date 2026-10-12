import AdminNavigation from "../../components/AdminNavigation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createAdminReportSchedule, deleteAdminReportSchedule, downloadAdminReport, getAdminReportSchedules, getAdminReportTable, setAdminReportScheduleActive } from "../../services/api";
import type { AdminReportSchedule, AdminReportType } from "../../services/api";
import "../../App.css";

const reports = [
  { type: "applications", title: "Applications", description: "Student applications, status, accommodation choices and submission dates." },
  { type: "properties", title: "Properties & inventory", description: "Landlord listings with room, bed, occupancy and availability totals." },
  { type: "occupancy", title: "Accommodation occupancy", description: "Occupied, available and total beds by property." },
  { type: "landlords", title: "Landlord performance", description: "Verification status, portfolio size, approved listings and application activity." },
  { type: "payments", title: "Funding & payments", description: "Funding balances and payment states by student and contract." },
  { type: "waiting_list", title: "Waiting list", description: "Student demand, priority, offer status and property preferences." },
  { type: "complaints", title: "Complaints", description: "Complaint references, priority, status and property context." },
  { type: "maintenance", title: "Maintenance requests", description: "Maintenance reference, category, priority, room and resolution state." },
] satisfies { type: AdminReportType; title: string; description: string }[];

function AdminReports() {
  const [downloading, setDownloading] = useState<AdminReportType | null>(null);
  const [schedules, setSchedules] = useState<AdminReportSchedule[]>([]);
  const [scheduleType, setScheduleType] = useState<AdminReportType>("applications");
  const [frequency, setFrequency] = useState<AdminReportSchedule["frequency"]>("WEEKLY");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadSchedules() {
    try { setSchedules(await getAdminReportSchedules()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load scheduled reports."); }
  }

  useEffect(() => { void loadSchedules(); }, []);

  async function addSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSavingSchedule(true); setError(""); setNotice("");
    try {
      const saved = await createAdminReportSchedule(scheduleType, frequency);
      setSchedules((current) => [...current, saved].sort((a, b) => a.next_run_at.localeCompare(b.next_run_at)));
      setNotice(`${saved.report_label} will be emailed ${saved.frequency_label.toLowerCase()} to ${saved.recipient_email}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to schedule this report."); }
    finally { setSavingSchedule(false); }
  }

  async function toggleSchedule(item: AdminReportSchedule) {
    setError("");
    try {
      const updated = await setAdminReportScheduleActive(item.id, !item.is_active);
      setSchedules((current) => current.map((row) => row.id === updated.id ? updated : row));
      setNotice(`Scheduled delivery ${updated.is_active ? "resumed" : "paused"}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update this schedule."); }
  }

  async function removeSchedule(item: AdminReportSchedule) {
    if (!window.confirm(`Delete the ${item.report_label.toLowerCase()} schedule?`)) return;
    setError("");
    try {
      await deleteAdminReportSchedule(item.id);
      setSchedules((current) => current.filter((row) => row.id !== item.id));
      setNotice("Scheduled report deleted.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete this schedule."); }
  }

  async function exportReport(type: AdminReportType, title: string) {
    setDownloading(type); setError(""); setNotice("");
    try { await downloadAdminReport(type); setNotice(`${title} report downloaded.`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to download this report."); }
    finally { setDownloading(null); }
  }

  async function printReport(type: AdminReportType, title: string) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { setError("Allow pop-up windows to print or save a report as PDF."); return; }
    setDownloading(type); setError(""); setNotice("");
    try {
      const data = await getAdminReportTable(type);
      const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
      const header = data.headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("");
      const rows = data.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
      printWindow.document.open();
      printWindow.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} report · StudentHaven</title><style>body{font:14px Arial,sans-serif;color:#20232b;margin:28px}h1{font-size:24px;margin:0 0 8px}p{color:#5d6370}.table-wrap{overflow:auto;margin-top:22px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #d9dce3;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#f0f1f5}button{padding:9px 15px;border:0;border-radius:6px;background:#176b58;color:white;font-weight:bold;cursor:pointer}@media print{body{margin:10mm}button{display:none}.table-wrap{overflow:visible}table{font-size:9px;table-layout:auto}th,td{padding:4px;overflow-wrap:anywhere}@page{size:landscape;margin:10mm}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button><h1>${escapeHtml(title)}</h1><p>StudentHaven · generated ${escapeHtml(new Date(data.generated_at).toLocaleString("en-ZA"))} · ${data.rows.length} records</p><div class="table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${rows || `<tr><td colspan="${data.headers.length}">No records in this report.</td></tr>`}</tbody></table></div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300))</script></body></html>`);
      printWindow.document.close();
      setNotice(`${title} report is ready. Choose “Save as PDF” in the print dialog to export a PDF.`);
    } catch (caught) {
      printWindow.close();
      setError(caught instanceof Error ? caught.message : "Unable to prepare this printable report.");
    } finally { setDownloading(null); }
  }

  return <div className="admin-dashboard-page admin-operations-page"><header className="admin-header"><Link to="/admin/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Administrator Console</span></div></Link><div className="admin-header-title">Reports</div></header><div className="admin-layout"><AdminNavigation /><main className="admin-content"><section className="admin-welcome"><div><span className="eyebrow">DATA EXPORTS</span><h1>Platform reports</h1><p>Download CSV files or print a report and choose Save as PDF.</p></div></section>{error && <div className="property-alert property-alert-error" role="alert">{error}</div>}{notice && <div className="property-alert property-alert-success" role="status">{notice}</div>}<section className="admin-report-grid">{reports.map((report) => <article className="admin-report-card" key={report.type}><span className="eyebrow">DATA EXPORT</span><h2>{report.title}</h2><p>{report.description}</p><div className="admin-report-actions"><button className="dashboard-primary-action" disabled={downloading !== null} onClick={() => void exportReport(report.type, report.title)}>{downloading === report.type ? "Preparing…" : "Download CSV"}</button><button className="dashboard-secondary-action" disabled={downloading !== null} onClick={() => void printReport(report.type, report.title)}>{downloading === report.type ? "Preparing…" : "Print / Save PDF"}</button></div></article>)}</section><p className="analytics-generated">Print opens your browser’s print dialog. Choose Save as PDF to create a PDF file. Reports contain up to 10,000 current records.</p><section className="admin-report-schedules"><div><span className="eyebrow">AUTOMATED DELIVERY</span><h2>Schedule an emailed report</h2><p>Scheduled reports are sent as CSV to your administrator account email.</p></div><form className="audit-filter-bar" onSubmit={(event) => void addSchedule(event)}><label>Report<select value={scheduleType} onChange={(event) => setScheduleType(event.target.value as AdminReportType)}>{reports.map((report) => <option value={report.type} key={report.type}>{report.title}</option>)}</select></label><label>Frequency<select value={frequency} onChange={(event) => setFrequency(event.target.value as AdminReportSchedule["frequency"])}><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option></select></label><button className="dashboard-primary-action" disabled={savingSchedule}>{savingSchedule ? "Saving…" : "Create schedule"}</button></form>{schedules.length === 0 ? <p className="property-empty-state">No scheduled reports yet.</p> : <div className="admin-report-schedule-list">{schedules.map((item) => <article key={item.id}><div><span className={`admin-program-state ${item.is_active ? "is-active" : ""}`}>{item.is_active ? "Active" : "Paused"}</span><h3>{item.report_label}</h3><p>{item.frequency_label} · To {item.recipient_email}</p><small>Next: {new Date(item.next_run_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}{item.last_sent_at ? ` · Last sent ${new Date(item.last_sent_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}` : " · Not sent yet"}</small>{item.last_error && <p className="property-alert property-alert-error" role="status">Last delivery error: {item.last_error}</p>}</div><div className="admin-report-actions"><button className="dashboard-secondary-action" onClick={() => void toggleSchedule(item)}>{item.is_active ? "Pause" : "Resume"}</button><button className="dashboard-secondary-action" onClick={() => void removeSchedule(item)}>Delete</button></div></article>)}</div>}<p className="analytics-generated">Report delivery requires the server’s scheduled task to run <code>python manage.py send_due_reports</code>. Configure Windows Task Scheduler or a hosting scheduler to call it regularly. Delivery also needs working SMTP settings.</p></section></main></div></div>;
}

export default AdminReports;
