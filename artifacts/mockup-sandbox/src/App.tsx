import { useEffect, useMemo, useState, type ComponentType, type FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Database,
  FileCheck2,
  FileText,
  FolderOpen,
  Gauge,
  GitBranch,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Upload,
  Users,
  X,
} from "lucide-react";

import { modules as discoveredModules } from "./.generated/mockup-components";

type ModuleMap = Record<string, () => Promise<Record<string, unknown>>>;

function _resolveComponent(mod: Record<string, unknown>, name: string): ComponentType | undefined {
  const fns = Object.values(mod).filter((v) => typeof v === "function") as ComponentType[];
  return (mod.default as ComponentType) || (mod.Preview as ComponentType) || (mod[name] as ComponentType) || fns[fns.length - 1];
}

function PreviewRenderer({ componentPath, modules }: { componentPath: string; modules: ModuleMap }) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadComponent(): Promise<void> {
      const loader = modules[`./components/mockups/${componentPath}.tsx`];
      if (!loader) {
        setError(`No component found at ${componentPath}.tsx`);
        return;
      }
      try {
        const mod = await loader();
        if (!cancelled) setComponent(() => _resolveComponent(mod, componentPath.split("/").pop()!) ?? null);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      }
    }
    void loadComponent();
    return () => { cancelled = true; };
  }, [componentPath, modules]);

  if (error) return <pre className="preview-error">{error}</pre>;
  return Component ? <Component /> : null;
}

type Page = "dashboard" | "collection" | "review" | "evidence" | "brsr" | "reports" | "admin";
type User = { id: string; email: string; displayName: string };
type Auth = { user: User; roles: string[] };
type Project = { id: string; code: string; name: string; state: string; city: string; status: string; businessUnit: string };
type Metric = { id: string; code: string; name: string; description: string; dimension: string; category: string; unit: string; requiredEvidence: boolean };
type Period = { id: string; label: string; boundary: string; status: string; locked: boolean };
type MetricValue = {
  id: string; metricId: string; metricName: string; projectId: string | null; projectName?: string | null;
  reportingPeriodId: string; value: number | null; unit: string; status: string; validationStatus: string; validationMessage?: string | null; applicability: string;
};
type Dashboard = {
  reportingPeriod: { id: string; label: string; boundary: string; status: string } | null;
  kpis: Record<string, number>; dimensions: { label: string; value: number; color: string }[];
};
type BrsrQuestion = { id: string; section: string; principleCode?: string | null; questionCode: string; questionText: string; requirementType: string; response: string | null; responseStatus: string; mappedMetricCount: number };
type Evidence = { id: string; fileName: string; evidenceType: string; status: string; checksum?: string | null; metricValueId?: string | null; createdAt: string };

const API_BASE = "/api";

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options, headers: { "Content-Type": "application/json", ...(options.headers ?? {}) } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function getBasePath(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

function getPreviewPath(): string | null {
  const basePath = getBasePath();
  const local = basePath && window.location.pathname.startsWith(basePath) ? window.location.pathname.slice(basePath.length) || "/" : window.location.pathname;
  const match = local.match(/^\/preview\/(.+)$/);
  return match ? match[1] : null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function statusClass(value: string): string {
  return `status status-${value.toLowerCase().replace(/[^a-z]+/g, "-")}`;
}

function Login({ onLogin }: { onLogin: (auth: Auth) => void }) {
  const [email, setEmail] = useState("coordinator@demo.meil-esg360.test");
  const [password, setPassword] = useState("Demo!123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      onLogin(await api<Auth>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="brand-mark">M</div>
        <p className="eyebrow">MEIL GROUP · ESG OPERATIONS</p>
        <h1>MEIL <span>ESG360</span></h1>
        <p className="login-lede">A controlled workspace for collecting, validating, consolidating and reporting ESG data across the enterprise.</p>
        <div className="login-principles">
          <span><ShieldCheck size={16} /> Evidence-led</span>
          <span><GitBranch size={16} /> Traceable</span>
          <span><FileCheck2 size={16} /> Assurance-ready</span>
        </div>
      </section>
      <section className="login-card">
        <div className="login-card-header">
          <div className="app-icon"><Activity size={21} /></div>
          <div><p className="eyebrow">SECURE ACCESS</p><h2>Sign in to your workspace</h2></div>
        </div>
        <form onSubmit={submit} className="stack-form">
          <label>Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required /></label>
          <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={8} /></label>
          {error && <div className="error-banner">{error}</div>}
          <button className="primary-button" disabled={loading}>{loading ? "Signing in…" : "Sign in"} <ArrowRight size={17} /></button>
        </form>
        <div className="demo-note"><span className="dot online" /><div><strong>Seeded demo workspace</strong><p>Coordinator: coordinator@demo.meil-esg360.test · Reviewer: reviewer@demo.meil-esg360.test · password: Demo!123</p></div></div>
      </section>
    </main>
  );
}

function KpiCard({ label, value, suffix = "%", caption, icon: Icon, accent }: { label: string; value: number | string; suffix?: string; caption: string; icon: ComponentType<{ size?: number }>; accent: string }) {
  return <div className="kpi-card">
    <div className="kpi-top"><span className={`kpi-icon ${accent}`}><Icon size={18} /></span><span className="kpi-caption">{caption}</span></div>
    <div className="kpi-value">{value}<small>{suffix}</small></div><p>{label}</p>
  </div>;
}

function DashboardPage({ dashboard, projects, values, readiness, onNavigate }: { dashboard: Dashboard | null; projects: Project[]; values: MetricValue[]; readiness: number; onNavigate: (page: Page) => void }) {
  const kpis = dashboard?.kpis ?? {};
  const pending = values.filter((value) => value.status === "SUBMITTED").length;
  return <div className="page-content">
    <div className="page-intro"><div><p className="eyebrow">EXECUTIVE OVERVIEW</p><h1>Good morning, Priya</h1><p className="subtle">Here’s the current reporting position for the MEIL Group workspace.</p></div><button className="secondary-button" onClick={() => window.location.reload()}><RefreshCw size={16} /> Refresh data</button></div>
    <div className="context-strip"><div><span className="context-label">REPORTING PERIOD</span><strong>{dashboard?.reportingPeriod?.label ?? "No period"}</strong></div><div className="context-divider" /><div><span className="context-label">BOUNDARY</span><strong>{dashboard?.reportingPeriod?.boundary ?? "—"}</strong></div><div className="context-divider" /><div><span className="context-label">STATUS</span><span className={statusClass(dashboard?.reportingPeriod?.status ?? "DRAFT")}>{dashboard?.reportingPeriod?.status ?? "DRAFT"}</span></div><button className="context-action" onClick={() => onNavigate("collection")}>Open collection <ArrowRight size={15} /></button></div>
    <div className="kpi-grid">
      <KpiCard label="Reporting completion" value={kpis.reportingCompletion ?? 0} caption="GROUP LEVEL" icon={Gauge} accent="teal" />
      <KpiCard label="Data quality score" value={kpis.dataQuality ?? 0} caption="VALIDATED" icon={CheckCircle2} accent="blue" />
      <KpiCard label="Evidence coverage" value={kpis.evidenceCoverage ?? 0} caption="TRACEABILITY" icon={FolderOpen} accent="amber" />
      <KpiCard label="BRSR readiness" value={readiness} caption="FRAMEWORK 2024" icon={BookOpenCheck} accent="violet" />
    </div>
    <div className="dashboard-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">DATA MIX</p><h2>ESG dimensions</h2></div><span className="muted-chip">Current period</span></div><div className="dimension-chart">{(dashboard?.dimensions ?? []).map((dimension) => <div className="dimension-row" key={dimension.label}><div className="dimension-label"><span className={`dimension-dot ${dimension.color}`} />{dimension.label}<strong>{dimension.value}%</strong></div><div className="bar-track"><div className={`bar-fill ${dimension.color}`} style={{ width: `${dimension.value}%` }} /></div></div>)}</div><div className="chart-footer"><span>Metric values recorded</span><strong>{values.length}</strong></div></section>
      <section className="panel action-panel"><div className="panel-heading"><div><p className="eyebrow">ACTION QUEUE</p><h2>Needs attention</h2></div><span className="notification-count">{pending}</span></div><button className="action-row" onClick={() => onNavigate("review")}><span className="action-icon amber"><ClipboardCheck size={17} /></span><span><strong>{pending} submissions pending review</strong><small>Review validated project data</small></span><ArrowRight size={16} /></button><button className="action-row" onClick={() => onNavigate("evidence")}><span className="action-icon violet"><FolderOpen size={17} /></span><span><strong>Evidence coverage review</strong><small>Link source records before approval</small></span><ArrowRight size={16} /></button><button className="action-row" onClick={() => onNavigate("brsr")}><span className="action-icon teal"><BookOpenCheck size={17} /></span><span><strong>BRSR workspace</strong><small>Update mapped disclosures</small></span><ArrowRight size={16} /></button></section>
    </div>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">OPERATING FOOTPRINT</p><h2>Active projects</h2></div><button className="text-button" onClick={() => onNavigate("collection")}>View data collection <ArrowRight size={15} /></button></div><div className="project-table"><div className="table-head"><span>Project</span><span>Business unit</span><span>Location</span><span>Status</span><span /></div>{projects.map((project) => <div className="table-row" key={project.id}><span><strong>{project.name}</strong><small>{project.code}</small></span><span>{project.businessUnit}</span><span>{project.city}, {project.state}</span><span><span className={statusClass(project.status)}>{project.status}</span></span><ArrowRight size={16} /></div>)}</div></section>
  </div>;
}

function CollectionPage({ periods, projects, metrics, values, onSaved, notify }: { periods: Period[]; projects: Project[]; metrics: Metric[]; values: MetricValue[]; onSaved: () => void; notify: (message: string) => void }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [metricId, setMetricId] = useState(metrics[0]?.id ?? "");
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [value, setValue] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const projectValues = values.filter((item) => item.projectId === projectId);
  const selectedMetric = metrics.find((item) => item.id === metricId);

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!selectedMetric || !value) return;
    setSaving(true);
    try {
      await api<MetricValue>("/metric-values", { method: "POST", body: JSON.stringify({ metricId, reportingPeriodId: periodId, projectId, value: Number(value), unit: selectedMetric.unit, remarks }) });
      notify("Metric saved as a draft");
      setValue(""); setRemarks(""); onSaved();
    } catch (reason) { notify(reason instanceof Error ? reason.message : "Unable to save metric"); }
    finally { setSaving(false); }
  }

  async function submitMetric(id: string): Promise<void> {
    try { await api(`/metric-values/${id}/submit`, { method: "POST" }); notify("Submission sent for review"); onSaved(); } catch (reason) { notify(reason instanceof Error ? reason.message : "Unable to submit metric"); }
  }

  return <div className="page-content"><div className="page-intro"><div><p className="eyebrow">ESG DATA</p><h1>Data collection</h1><p className="subtle">Capture source data once, validate it, and route it through the review workflow.</p></div><span className="live-pill"><span className="dot online" /> Autosave off · submit when ready</span></div>
    <div className="collection-layout"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">NEW VALUE</p><h2>Record a metric</h2></div><span className="muted-chip">Draft</span></div><form className="stack-form" onSubmit={save}><label>Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Reporting period<select value={periodId} onChange={(event) => setPeriodId(event.target.value)}>{periods.map((period) => <option key={period.id} value={period.id}>{period.label} · {period.boundary}</option>)}</select></label><label>Metric<select value={metricId} onChange={(event) => setMetricId(event.target.value)}>{metrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.name} · {metric.dimension}</option>)}</select></label>{selectedMetric && <div className="metric-help"><span className={`dimension-dot ${selectedMetric.dimension === "ENVIRONMENTAL" ? "teal" : selectedMetric.dimension === "SOCIAL" ? "amber" : "violet"}`} /><div><strong>{selectedMetric.name}</strong><p>{selectedMetric.description}</p></div><span className="unit-tag">{selectedMetric.unit}</span></div>}<div className="two-col"><label>Current value<input type="number" step="any" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Enter a measured value" required /></label><label>Unit<input value={selectedMetric?.unit ?? ""} readOnly /></label></div><label>Remarks <span className="optional">optional</span><textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Add context, source reference or variance explanation" rows={3} /></label><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save draft"} <Plus size={17} /></button></form></section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">PROJECT REGISTER</p><h2>Recorded values</h2></div><span className="muted-chip">{projectValues.length} values</span></div>{projectValues.length === 0 ? <EmptyState icon={Database} title="No values recorded yet" body="Choose a metric and save the first project value." /> : <div className="value-list">{projectValues.map((item) => <div className="value-card" key={item.id}><div><span className={`metric-kicker ${item.metricName.includes("work") ? "social" : "environmental"}`}>{item.metricName}</span><div className="value-number">{item.value ?? "—"} <small>{item.unit}</small></div><p className="subtle">Validation <span className={statusClass(item.validationStatus)}>{item.validationStatus}</span></p></div><div className="value-card-actions"><span className={statusClass(item.status)}>{item.status}</span>{item.status === "DRAFT" || item.status === "RETURNED" ? <button className="small-button" onClick={() => submitMetric(item.id)}><Send size={14} /> Submit</button> : <button className="icon-button" title="Select for evidence" onClick={() => setSelectedId(item.id)}><FolderOpen size={16} /></button>}</div></div>)}</div>}</section></div>
    {selectedId && <EvidenceInline metricValueId={selectedId} periodId={periodId} projectId={projectId} onDone={() => { setSelectedId(null); notify("Evidence linked to metric"); onSaved(); }} onClose={() => setSelectedId(null)} />}
  </div>;
}

function EvidenceInline({ metricValueId, periodId, projectId, onDone, onClose }: { metricValueId: string; periodId: string; projectId: string; onDone: () => void; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("utility bill");
  const [loading, setLoading] = useState(false);
  async function upload(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!file) return;
    setLoading(true);
    try {
      const contentBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not read file")); reader.readAsDataURL(file); });
      await api("/evidence", { method: "POST", body: JSON.stringify({ fileName: file.name, evidenceType: type, mimeType: file.type, contentBase64, reportingPeriodId: periodId, projectId, metricValueId }) });
      onDone();
    } catch { setLoading(false); }
  }
  return <div className="modal-backdrop"><div className="modal-card"><div className="modal-header"><div><p className="eyebrow">TRACEABILITY</p><h2>Link evidence</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><form className="stack-form" onSubmit={upload}><label>Evidence type<select value={type} onChange={(event) => setType(event.target.value)}><option>utility bill</option><option>fuel record</option><option>HR report</option><option>audit report</option><option>certificate</option><option>spreadsheet</option><option>other</option></select></label><label className="file-drop"><Upload size={20} /><span>{file ? file.name : "Choose a PDF, image, CSV or spreadsheet"}</span><small>Maximum 10 MB</small><input type="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.txt,.json" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!file || loading}>{loading ? "Uploading…" : "Upload evidence"} <Upload size={16} /></button></div></form></div></div>;
}

function ReviewPage({ values, onUpdated, notify }: { values: MetricValue[]; onUpdated: () => void; notify: (message: string) => void }) {
  const pending = values.filter((item) => item.status === "SUBMITTED" || item.status === "RETURNED");
  const [commentId, setCommentId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  async function decide(id: string, action: "approve" | "return"): Promise<void> {
    try { await api(`/metric-values/${id}/${action}`, { method: "POST", body: JSON.stringify(action === "return" ? { comment } : {}) }); notify(action === "approve" ? "Value approved" : "Value returned for correction"); setCommentId(null); setComment(""); onUpdated(); } catch (reason) { notify(reason instanceof Error ? reason.message : "Review action failed"); }
  }
  return <div className="page-content"><div className="page-intro"><div><p className="eyebrow">WORKFLOW</p><h1>Review queue</h1><p className="subtle">Review submitted data, inspect validation status, and leave a traceable decision.</p></div><span className="notification-count large">{pending.length} open</span></div><section className="panel">{pending.length === 0 ? <EmptyState icon={ClipboardCheck} title="Review queue is clear" body="New submissions from project coordinators will appear here." /> : <div className="review-list">{pending.map((item) => <div className="review-card" key={item.id}><div className="review-main"><div className="review-icon"><Activity size={17} /></div><div><span className="metric-kicker">{item.metricName}</span><h3>{item.value ?? "—"} <small>{item.unit}</small></h3><p className="subtle">Project submission · {item.validationStatus === "PASSED" ? "Validation passed" : item.validationMessage}</p></div></div><div className="review-actions"><span className={statusClass(item.status)}>{item.status}</span><button className="small-button success" onClick={() => decide(item.id, "approve")}><CheckCircle2 size={14} /> Approve</button><button className="small-button danger" onClick={() => setCommentId(item.id)}><X size={14} /> Return</button></div>{commentId === item.id && <div className="review-comment"><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Explain the requested correction" /><button className="small-button danger" onClick={() => decide(item.id, "return")}>Send back</button></div>}</div>)}</div>}</section></div>;
}

function EvidencePage({ evidence, onRefresh }: { evidence: Evidence[]; onRefresh: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("other");
  const [message, setMessage] = useState("");
  async function upload(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!file) return;
    try {
      const contentBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error()); reader.readAsDataURL(file); });
      await api("/evidence", { method: "POST", body: JSON.stringify({ fileName: file.name, evidenceType: type, mimeType: file.type, contentBase64 }) });
      setFile(null); setMessage("Evidence uploaded and queued for review"); onRefresh();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Upload failed"); }
  }
  return <div className="page-content"><div className="page-intro"><div><p className="eyebrow">EVIDENCE</p><h1>Evidence library</h1><p className="subtle">Source files are stored separately from reporting data and identified by checksum.</p></div><button className="secondary-button" onClick={onRefresh}><RefreshCw size={16} /> Refresh</button></div><div className="evidence-layout"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">ADD SOURCE RECORD</p><h2>Upload evidence</h2></div><ShieldCheck size={19} className="panel-icon" /></div><form className="stack-form" onSubmit={upload}><label>Evidence type<select value={type} onChange={(event) => setType(event.target.value)}><option>utility bill</option><option>fuel record</option><option>HR report</option><option>policy</option><option>certificate</option><option>audit report</option><option>supplier document</option><option>other</option></select></label><label className="file-drop"><Upload size={21} /><span>{file ? file.name : "Drop or select a supporting file"}</span><small>PDF, image, CSV, JSON, TXT or XLSX · 10 MB max</small><input type="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.txt,.json" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><button className="primary-button" disabled={!file}>{file ? "Upload source record" : "Select a file first"} <Upload size={16} /></button>{message && <div className="success-banner">{message}</div>}</form></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">SOURCE REGISTER</p><h2>Recent evidence</h2></div><span className="muted-chip">{evidence.length} files</span></div>{evidence.length === 0 ? <EmptyState icon={FolderOpen} title="No evidence uploaded" body="Upload source records to support important ESG values." /> : <div className="evidence-list">{evidence.map((item) => <div className="evidence-row" key={item.id}><span className="file-icon"><FileText size={17} /></span><div><strong>{item.fileName}</strong><small>{item.evidenceType} · {formatDate(item.createdAt)}</small></div><span className={statusClass(item.status)}>{item.status.replace("_", " ")}</span><span className="checksum">{item.checksum?.slice(0, 8) ?? "—"}</span></div>)}</div>}</section></div></div>;
}

function BrsrPage({ questions, onRefresh, notify }: { questions: BrsrQuestion[]; onRefresh: () => void; notify: (message: string) => void }) {
  const [section, setSection] = useState("A");
  const [editing, setEditing] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const visible = questions.filter((question) => question.section === section);
  async function save(questionId: string): Promise<void> {
    try { await api("/brsr/responses", { method: "POST", body: JSON.stringify({ questionId, response }) }); setEditing(null); setResponse(""); notify("BRSR response saved"); onRefresh(); } catch (reason) { notify(reason instanceof Error ? reason.message : "Unable to save response"); }
  }
  return <div className="page-content"><div className="page-intro"><div><p className="eyebrow">REGULATORY WORKSPACE · BRSR 2024</p><h1>BRSR reporting workspace</h1><p className="subtle">Versioned questions stay linked to the data and evidence that support each disclosure.</p></div><button className="secondary-button" onClick={onRefresh}><RefreshCw size={16} /> Recalculate readiness</button></div><div className="section-tabs">{["A", "B", "C"].map((value) => <button className={section === value ? "active" : ""} onClick={() => setSection(value)} key={value}><strong>Section {value}</strong><span>{value === "A" ? "Entity profile" : value === "B" ? "Management & process" : "Principle performance"}</span></button>)}</div><section className="panel"><div className="panel-heading"><div><p className="eyebrow">DISCLOSURES</p><h2>Section {section}</h2></div><span className="muted-chip">{visible.length} configured questions</span></div><div className="question-list">{visible.map((question) => <div className="question-row" key={question.id}><div className="question-code">{question.questionCode}</div><div className="question-copy"><strong>{question.questionText}</strong><small>{question.principleCode ?? "Entity disclosure"} · {question.requirementType} · {question.mappedMetricCount} mapped metric{question.mappedMetricCount === 1 ? "" : "s"}</small>{editing === question.id ? <div className="inline-response"><textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Enter a source-backed response" rows={3} /><div><button className="small-button" onClick={() => setEditing(null)}>Cancel</button><button className="small-button success" onClick={() => save(question.id)}>Save response</button></div></div> : question.response ? <div className="response-preview">{question.response}</div> : null}</div><div className="question-status"><span className={statusClass(question.responseStatus)}>{question.responseStatus}</span><button className="icon-button" title="Edit response" onClick={() => { setEditing(question.id); setResponse(question.response ?? ""); }}><ArrowRight size={16} /></button></div></div>)}</div></section></div>;
}

function ReportsPage({ values, notify }: { values: MetricValue[]; notify: (message: string) => void }) {
  const [report, setReport] = useState<{ id: string; checksum: string; datasetSummary: { questionCount: number; valueCount: number; evidenceCount: number } } | null>(null);
  const [lineage, setLineage] = useState<{ metricValue: MetricValue; nodes: { type: string; label: string; status: string }[] } | null>(null);
  async function generate(): Promise<void> {
    try { const result = await api<{ report: { id: string }; checksum: string; datasetSummary: { questionCount: number; valueCount: number; evidenceCount: number } }>("/reports/generate", { method: "POST", body: JSON.stringify({ reportType: "BRSR" }) }); setReport({ id: result.report.id, checksum: result.checksum, datasetSummary: result.datasetSummary }); notify("Reproducible report dataset generated"); } catch (reason) { notify(reason instanceof Error ? reason.message : "Report generation failed"); }
  }
  async function inspect(id: string): Promise<void> { try { setLineage(await api(`/lineage/${id}`)); } catch (reason) { notify(reason instanceof Error ? reason.message : "Lineage unavailable"); } }
  return <div className="page-content"><div className="page-intro"><div><p className="eyebrow">ASSURANCE & REPORTING</p><h1>Reports and lineage</h1><p className="subtle">Generate from the stored dataset and inspect how a value reaches a disclosure.</p></div><button className="primary-button" onClick={generate}><FileCheck2 size={16} /> Generate draft BRSR dataset</button></div><div className="report-hero"><div className="report-hero-icon"><FileCheck2 size={24} /></div><div><p className="eyebrow">REPRODUCIBLE OUTPUT</p><h2>{report ? "Draft dataset generated" : "Report generation is ready"}</h2><p>{report ? `Checksum ${report.checksum.slice(0, 16)}… confirms the dataset snapshot.` : "A report can only be generated from the current stored data, questions and evidence."}</p></div>{report && <div className="report-stats"><span><strong>{report.datasetSummary.questionCount}</strong> questions</span><span><strong>{report.datasetSummary.valueCount}</strong> values</span><span><strong>{report.datasetSummary.evidenceCount}</strong> evidence</span></div>}</div><section className="panel"><div className="panel-heading"><div><p className="eyebrow">LINEAGE EXPLORER</p><h2>Select a metric value</h2></div><span className="muted-chip">Source → report</span></div><div className="lineage-select-list">{values.slice(0, 8).map((value) => <button className="lineage-select" key={value.id} onClick={() => inspect(value.id)}><span><strong>{value.metricName}</strong><small>{value.value ?? "—"} {value.unit} · {value.status}</small></span><ArrowRight size={16} /></button>)}</div>{lineage && <div className="lineage-detail"><div className="lineage-head"><div><p className="eyebrow">VALUE LINEAGE</p><h3>{lineage.metricValue.metricId}</h3></div><span className={statusClass(lineage.metricValue.status)}>{lineage.metricValue.status}</span></div><div className="lineage-flow">{lineage.nodes.map((node, index) => <div className="lineage-node-wrap" key={node.type}><div className={`lineage-node ${node.status}`}><span>{node.type}</span><strong>{node.label}</strong></div>{index < lineage.nodes.length - 1 && <ArrowRight size={16} />}</div>)}</div></div>}</section></div>;
}

function AdminPage({ auth, projects, metrics, periods }: { auth: Auth; projects: Project[]; metrics: Metric[]; periods: Period[] }) {
  const cards = [{ label: "Users & access", value: auth.roles.length ? "RBAC active" : "—", icon: Users }, { label: "Organization hierarchy", value: `${projects.length} projects`, icon: Building2 }, { label: "Metric library", value: `${metrics.length} active metrics`, icon: Database }, { label: "Reporting periods", value: `${periods.length} configured`, icon: FileText }];
  return <div className="page-content"><div className="page-intro"><div><p className="eyebrow">ADMINISTRATION</p><h1>Workspace controls</h1><p className="subtle">Configuration is tenant-aware and versioned so governance decisions remain visible.</p></div><span className="role-chip"><ShieldCheck size={15} /> {auth.roles[0] ?? "Authenticated user"}</span></div><div className="admin-grid">{cards.map((card) => <div className="admin-card" key={card.label}><card.icon size={19} /><p>{card.label}</p><strong>{card.value}</strong><small>Manage in the full configuration API</small></div>)}</div><section className="panel"><div className="panel-heading"><div><p className="eyebrow">SECURITY CONTROLS</p><h2>Current session</h2></div></div><div className="session-grid"><div><span>Signed-in user</span><strong>{auth.user.displayName}</strong><small>{auth.user.email}</small></div><div><span>Assigned roles</span><strong>{auth.roles.join(", ") || "No role returned"}</strong><small>Server-side authorization applies to protected actions</small></div><div><span>Session policy</span><strong>8 hour expiry</strong><small>HTTP-only signed cookie</small></div></div></section></div>;
}

function EmptyState({ icon: Icon, title, body }: { icon: ComponentType<{ size?: number }>; title: string; body: string }) {
  return <div className="empty-state"><Icon size={25} /><strong>{title}</strong><p>{body}</p></div>;
}

function AppShell({ auth, onLogout }: { auth: Auth; onLogout: () => void }) {
  const [page, setPage] = useState<Page>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [values, setValues] = useState<MetricValue[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [questions, setQuestions] = useState<BrsrQuestion[]>([]);
  const [readiness, setReadiness] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  function notify(message: string): void { setToast(message); window.setTimeout(() => setToast(null), 3500); }
  async function refresh(): Promise<void> {
    try {
      const [dashboardData, projectData, periodData, metricData, valueData, evidenceData, brsrData, readyData] = await Promise.all([
        api<Dashboard>("/dashboard"), api<Project[]>("/projects"), api<Period[]>("/reporting-periods"), api<Metric[]>("/metrics"), api<MetricValue[]>("/metric-values"), api<Evidence[]>("/evidence"), api<BrsrQuestion[]>("/brsr/workspace"), api<{ overall: number }>("/brsr/readiness"),
      ]);
      setDashboard(dashboardData); setProjects(projectData); setPeriods(periodData); setMetrics(metricData); setValues(valueData); setEvidence(evidenceData); setQuestions(brsrData); setReadiness(readyData.overall);
    } catch (reason) { notify(reason instanceof Error ? reason.message : "Unable to refresh workspace"); }
  }
  useEffect(() => { void refresh(); }, []);

  const pageTitle = { dashboard: "Command center", collection: "Data collection", review: "Review queue", evidence: "Evidence library", brsr: "BRSR workspace", reports: "Reports & lineage", admin: "Administration" }[page];
  const nav = [
    { id: "dashboard" as Page, label: "Dashboard", icon: LayoutDashboard },
    { id: "collection" as Page, label: "ESG data", icon: Database },
    { id: "review" as Page, label: "Workflow", icon: ClipboardCheck, count: values.filter((value) => value.status === "SUBMITTED").length },
    { id: "evidence" as Page, label: "Evidence", icon: FolderOpen, count: evidence.length },
    { id: "brsr" as Page, label: "BRSR reporting", icon: BookOpenCheck },
    { id: "reports" as Page, label: "Assurance & reports", icon: FileCheck2 },
    { id: "admin" as Page, label: "Administration", icon: ShieldCheck },
  ];
  return <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}><div className="sidebar-header"><div className="brand-mark small">M</div><div className="brand-copy"><strong>MEIL <span>ESG360</span></strong><small>Enterprise workspace</small></div><button className="sidebar-collapse" onClick={() => setCollapsed(!collapsed)}><PanelLeftClose size={17} /></button></div><div className="workspace-switcher"><span className="workspace-logo">MG</span><span><strong>MEIL Group Demo</strong><small>Consolidated view</small></span><ChevronDown size={15} /></div><nav>{nav.map((item) => <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => { setPage(item.id); setMobileOpen(false); }}><item.icon size={18} /><span>{item.label}</span>{item.count ? <b>{item.count}</b> : null}</button>)}</nav><div className="sidebar-bottom"><div className="help-row"><LifeBuoy size={17} /><span>Need help?</span></div><button className="logout-button" onClick={onLogout}><LogOut size={17} /><span>Sign out</span></button><div className="profile-row"><div className="avatar">PN</div><span><strong>{auth.user.displayName}</strong><small>{auth.roles[0] ?? "Member"}</small></span></div></div></aside>
    <div className="app-main"><header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)}><Menu size={20} /></button><div className="breadcrumbs"><span>MEIL ESG360</span><ArrowRight size={13} /><strong>{pageTitle}</strong></div><div className="topbar-actions"><button className="search-button"><Search size={17} /><span>Search</span><kbd>⌘ K</kbd></button><button className="icon-button notification-button"><Bell size={18} /><span className="notification-dot" /></button><div className="top-avatar">PN</div></div></header><main>{page === "dashboard" && <DashboardPage dashboard={dashboard} projects={projects} values={values} readiness={readiness} onNavigate={setPage} />}{page === "collection" && <CollectionPage periods={periods} projects={projects} metrics={metrics} values={values} onSaved={() => void refresh()} notify={notify} />}{page === "review" && <ReviewPage values={values} onUpdated={() => void refresh()} notify={notify} />}{page === "evidence" && <EvidencePage evidence={evidence} onRefresh={() => void refresh()} />}{page === "brsr" && <BrsrPage questions={questions} onRefresh={() => void refresh()} notify={notify} />}{page === "reports" && <ReportsPage values={values} notify={notify} />}{page === "admin" && <AdminPage auth={auth} projects={projects} metrics={metrics} periods={periods} />}</main></div>
    {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
  </div>;
}

function ProductApp() {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api<Auth>("/auth/me").then(setAuth).catch(() => undefined).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="loading-screen"><div className="brand-mark">M</div><span>Loading ESG360 workspace…</span></div>;
  if (!auth) return <Login onLogin={setAuth} />;
  return <AppShell auth={auth} onLogout={() => { void api("/auth/logout", { method: "POST" }); setAuth(null); }} />;
}

function App() {
  const previewPath = getPreviewPath();
  if (previewPath) return <PreviewRenderer componentPath={previewPath} modules={discoveredModules} />;
  return <ProductApp />;
}

export default App;