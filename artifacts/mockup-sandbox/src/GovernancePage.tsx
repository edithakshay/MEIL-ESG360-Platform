import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, BookOpenCheck, CheckCircle2, FileText, GitBranch, Leaf, RefreshCw, ShieldCheck, Target, Users } from "lucide-react";

type Auth = { roles: string[] };
type Tab = "core" | "sdgs" | "targets" | "risks" | "assurance" | "policies";
type CoreMetric = {
  id: string;
  code: string;
  name: string;
  description: string;
  unit: string;
  methodology?: string | null;
  response: { value: string | null; unit: string; dataSource?: string | null; assuranceStatus: string } | null;
};
type Overview = {
  period: { label: string; boundary: string; status: string } | null;
  principles: { code: string; title: string; description: string }[];
  core: CoreMetric[];
  sdgs: { number: number; name: string; description: string; targets: { code: string; title: string }[] }[];
  targets: { id: string; metricName: string; baselineYear: number; baselineValue: string; targetYear: number; targetValue: string; owner?: string | null; status: string; isSample: boolean }[];
  risks: { id: string; category: string; description: string; likelihood: number; impact: number; residualRisk?: number | null; status: string }[];
  assurance: { id: string; name: string; provider?: string | null; status: string; findingCount: number; openFindingCount: number }[];
  policies: { id: string; name: string; owner?: string | null; version: string; status: string; valueChainApplicable: boolean; principleIds: string[] }[];
  review: { valueCount: number; approvedCount: number; pendingApprovals: number; validationErrors: number; essentialQuestions: { completed: number; total: number }; openAssuranceFindings: number; boundaryApproved: boolean } | null;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function chip(value: string): string {
  return `status status-${value.toLowerCase().replace(/[^a-z]+/g, "-")}`;
}

export function GovernancePage({ auth, notify }: { auth: Auth; notify: (message: string) => void }) {
  const [tab, setTab] = useState<Tab>("core");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { value: string; dataSource: string; assuranceStatus: string }>>({});

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const next = await request<Overview>("/enterprise/overview");
      setData(next);
      setDrafts(Object.fromEntries(next.core.map((metric) => [metric.id, {
        value: metric.response?.value ?? "",
        dataSource: metric.response?.dataSource ?? "",
        assuranceStatus: metric.response?.assuranceStatus ?? "NOT_STARTED",
      }])));
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "Unable to load governance workspace");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function saveCore(event: FormEvent, metric: CoreMetric): Promise<void> {
    event.preventDefault();
    const draft = drafts[metric.id];
    if (!draft?.value.trim()) return;
    setSavingId(metric.id);
    try {
      await request("/brsr-core/responses", {
        method: "POST",
        body: JSON.stringify({ metricId: metric.id, value: Number(draft.value), unit: metric.unit, dataSource: draft.dataSource, assuranceStatus: draft.assuranceStatus }),
      });
      notify("BRSR Core response saved as a draft");
      await load();
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "Unable to save BRSR Core response");
    } finally {
      setSavingId(null);
    }
  }

  const tabs = [
    { id: "core" as const, label: "BRSR Core", icon: BookOpenCheck },
    { id: "sdgs" as const, label: "SDG mapping", icon: Leaf },
    { id: "targets" as const, label: "Targets", icon: Target },
    { id: "risks" as const, label: "Risk & materiality", icon: AlertTriangle },
    { id: "assurance" as const, label: "Assurance", icon: ShieldCheck },
    { id: "policies" as const, label: "Policies", icon: FileText },
  ];
  const review = data?.review;
  const isAdmin = auth.roles.some((role) => ["Group ESG Admin", "Group ESG Head", "Super Admin"].includes(role));

  if (loading && !data) return <div className="page-content"><div className="loading-inline"><RefreshCw size={18} /> Loading governance workspace…</div></div>;

  return <div className="page-content">
    <div className="page-intro">
      <div><p className="eyebrow">GOVERNANCE & ASSURANCE</p><h1>Enterprise controls</h1><p className="subtle">BRSR Core, sustainability targets, SDG context, risk, policy and assurance records linked to the current reporting period.</p></div>
      <button className="secondary-button" onClick={() => void load()}><RefreshCw size={16} /> Refresh</button>
    </div>
    <div className="context-strip governance-context">
      <div><span className="context-label">REPORTING PERIOD</span><strong>{data?.period?.label ?? "No period"}</strong></div>
      <div className="context-divider" />
      <div><span className="context-label">BOUNDARY</span><strong>{data?.period?.boundary ?? "—"}</strong></div>
      <div className="context-divider" />
      <div><span className="context-label">DATA READINESS</span><strong>{review?.approvedCount ?? 0} / {review?.valueCount ?? 0} approved</strong></div>
      <div className="context-divider" />
      <div><span className="context-label">ASSURANCE</span><strong>{review?.openAssuranceFindings ?? 0} open findings</strong></div>
    </div>
    <div className="governance-kpis">
      <div className="governance-kpi"><CheckCircle2 size={17} /><span>Validation errors<strong>{review?.validationErrors ?? 0}</strong></span></div>
      <div className="governance-kpi"><GitBranch size={17} /><span>Essential disclosures<strong>{review?.essentialQuestions.completed ?? 0}/{review?.essentialQuestions.total ?? 0}</strong></span></div>
      <div className="governance-kpi"><ShieldCheck size={17} /><span>Boundary approval<strong>{review?.boundaryApproved ? "Approved" : "Pending"}</strong></span></div>
      <div className="governance-kpi"><Users size={17} /><span>Pending approvals<strong>{review?.pendingApprovals ?? 0}</strong></span></div>
    </div>
    <div className="governance-tabs">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={16} /><span>{label}</span></button>)}</div>
    <section className="panel governance-panel">
      {tab === "core" && <div>
        <div className="panel-heading"><div><p className="eyebrow">CONFIGURED KPI LIBRARY</p><h2>BRSR Core responses</h2></div><span className="muted-chip">{data?.core.length ?? 0} metrics</span></div>
        <div className="governance-list">{(data?.core ?? []).map((metric) => {
          const draft = drafts[metric.id] ?? { value: "", dataSource: "", assuranceStatus: "NOT_STARTED" };
          return <form className="governance-row core-row" key={metric.id} onSubmit={(event) => void saveCore(event, metric)}>
            <div className="governance-code">{metric.code}</div><div className="governance-copy"><strong>{metric.name}</strong><p>{metric.description}</p><small>Methodology: {metric.methodology ?? "Confirm source methodology before assurance."}</small></div>
            <label className="compact-field"><span>Value</span><input type="number" step="any" value={draft.value} onChange={(event) => setDrafts((current) => ({ ...current, [metric.id]: { ...draft, value: event.target.value } }))} placeholder="Not recorded" /></label>
            <label className="compact-field"><span>Source</span><input value={draft.dataSource} onChange={(event) => setDrafts((current) => ({ ...current, [metric.id]: { ...draft, dataSource: event.target.value } }))} placeholder="Source reference" /></label>
            <label className="compact-field"><span>Status</span><select value={draft.assuranceStatus} onChange={(event) => setDrafts((current) => ({ ...current, [metric.id]: { ...draft, assuranceStatus: event.target.value } }))}><option>NOT_STARTED</option><option>IN_PROGRESS</option><option>EVIDENCE_REQUESTED</option><option>UNDER_REVIEW</option><option>ASSURANCE_COMPLETE</option></select></label>
            <div className="core-action"><span className="unit-tag">{metric.unit}</span><button className="small-button success" disabled={!draft.value.trim() || savingId === metric.id}>{savingId === metric.id ? "Saving…" : "Save draft"}</button></div>
          </form>;
        })}</div>
      </div>}
      {tab === "sdgs" && <div><div className="panel-heading"><div><p className="eyebrow">REFERENCE DATA</p><h2>17 Sustainable Development Goals</h2></div><span className="muted-chip">Configurable master dataset</span></div><div className="sdg-grid">{(data?.sdgs ?? []).map((sdg) => <div className="sdg-card" key={sdg.number}><span className="sdg-number">{sdg.number}</span><div><strong>{sdg.name}</strong><p>{sdg.description}</p>{sdg.targets.map((target) => <small key={target.code}>{target.code} · {target.title}</small>)}</div></div>)}</div></div>}
      {tab === "targets" && <div><div className="panel-heading"><div><p className="eyebrow">PERFORMANCE MANAGEMENT</p><h2>ESG targets</h2></div><span className="muted-chip">{data?.targets.length ?? 0} configured</span></div>{isAdmin && <p className="governance-note">Target creation is available through the protected administration API. Demo targets are labelled as sample and are not MEIL disclosures.</p>}<div className="governance-list">{(data?.targets ?? []).map((target) => <div className="governance-row" key={target.id}><div className="target-icon"><Target size={17} /></div><div className="governance-copy"><strong>{target.metricName}</strong><p>{target.baselineYear}: {target.baselineValue} → {target.targetYear}: {target.targetValue}</p><small>Owner: {target.owner ?? "Unassigned"} · {target.isSample ? "DEMO DATA · SAMPLE TARGET" : "Configured target"}</small></div><span className={chip(target.status)}>{target.status}</span></div>)}</div></div>}
      {tab === "risks" && <div><div className="panel-heading"><div><p className="eyebrow">RISK & MATERIALITY</p><h2>ESG risk register</h2></div><span className="muted-chip">{data?.risks.length ?? 0} risks</span></div><div className="governance-list">{(data?.risks ?? []).map((risk) => <div className="governance-row" key={risk.id}><div className="risk-score">{risk.inherentRisk}<small>risk</small></div><div className="governance-copy"><strong>{risk.category}</strong><p>{risk.description}</p><small>Likelihood {risk.likelihood}/5 · impact {risk.impact}/5 · residual {risk.residualRisk ?? "—"}</small></div><span className={chip(risk.status)}>{risk.status}</span></div>)}</div></div>}
      {tab === "assurance" && <div><div className="panel-heading"><div><p className="eyebrow">ASSURANCE WORKSPACE</p><h2>Engagements and findings</h2></div><span className="muted-chip">{data?.assurance.length ?? 0} engagements</span></div><div className="governance-list">{(data?.assurance ?? []).map((engagement) => <div className="governance-row" key={engagement.id}><div className="assurance-icon"><ShieldCheck size={17} /></div><div className="governance-copy"><strong>{engagement.name}</strong><p>Provider: {engagement.provider ?? "Not assigned"}</p><small>{engagement.findingCount} findings · {engagement.openFindingCount} open · scope is stored with the engagement</small></div><span className={chip(engagement.status)}>{engagement.status}</span></div>)}</div></div>}
      {tab === "policies" && <div><div className="panel-heading"><div><p className="eyebrow">SECTION B · POLICY CONTROL</p><h2>Policy register</h2></div><span className="muted-chip">{data?.policies.length ?? 0} policies</span></div><div className="governance-list">{(data?.policies ?? []).map((policy) => <div className="governance-row" key={policy.id}><div className="policy-icon"><FileText size={17} /></div><div className="governance-copy"><strong>{policy.name}</strong><p>Version {policy.version} · Owner {policy.owner ?? "Unassigned"}</p><small>{policy.principleIds.length} principle mappings · value-chain applicability: {policy.valueChainApplicable ? "Yes" : "No"}</small></div><span className={chip(policy.status)}>{policy.status}</span></div>)}</div></div>}
    </section>
  </div>;
}