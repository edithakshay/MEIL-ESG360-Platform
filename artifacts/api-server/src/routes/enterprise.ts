import { createHash } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import {
  assuranceEngagementsTable,
  assuranceFindingsTable,
  assuranceRequestsTable,
  brsrCoreMetricsTable,
  brsrCoreResponsesTable,
  brsrQuestionsTable,
  brsrPrinciplesTable,
  brsrResponsesTable,
  businessUnitsTable,
  crossReferencesTable,
  db,
  entitiesTable,
  esgMetricsTable,
  esgTargetsTable,
  evidenceTable,
  metricValuesTable,
  policiesTable,
  policyPrincipleMappingsTable,
  projectsTable,
  reportVersionsTable,
  reportsTable,
  reportingBoundariesTable,
  reportingPeriodsTable,
  risksTable,
  sdgTargetsTable,
  sdgsTable,
  usersTable,
} from "@workspace/db";
import { requireRole, requireUser } from "../lib/auth";

const router: IRouter = Router();
router.use(requireUser);

const adminRoles = ["Group ESG Admin", "Group ESG Head", "Super Admin"];
const reviewerRoles = [...adminRoles, "Reviewer", "Approver", "Internal Auditor"];

function currentUser(res: Response): typeof usersTable.$inferSelect {
  return res.locals.user as typeof usersTable.$inferSelect;
}

router.get("/enterprise/overview", async (_req, res): Promise<void> => {
  const user = currentUser(res);
  const [period] = await db.select().from(reportingPeriodsTable)
    .where(eq(reportingPeriodsTable.organizationId, user.organizationId))
    .orderBy(desc(reportingPeriodsTable.startDate)).limit(1);
  if (!period) {
    res.json({ period: null, principles: [], core: [], sdgs: [], targets: [], risks: [], assurance: [], policies: [], review: null });
    return;
  }
  const [principles, coreMetrics, coreResponses, sdgs, sdgTargets, targets, risks, engagements, policies, policyMappings, boundary, values, questions, responses, findings] = await Promise.all([
    db.select().from(brsrPrinciplesTable).where(eq(brsrPrinciplesTable.frameworkVersion, "2024")).orderBy(brsrPrinciplesTable.code),
    db.select().from(brsrCoreMetricsTable).where(eq(brsrCoreMetricsTable.frameworkVersion, "2024")).orderBy(brsrCoreMetricsTable.code),
    db.select().from(brsrCoreResponsesTable).where(eq(brsrCoreResponsesTable.reportingPeriodId, period.id)),
    db.select().from(sdgsTable).where(eq(sdgsTable.active, true)).orderBy(sdgsTable.number),
    db.select().from(sdgTargetsTable),
    db.select({ target: esgTargetsTable, metricName: esgMetricsTable.name })
      .from(esgTargetsTable).innerJoin(esgMetricsTable, eq(esgMetricsTable.id, esgTargetsTable.metricId))
      .where(eq(esgTargetsTable.organizationId, user.organizationId)),
    db.select().from(risksTable).where(eq(risksTable.organizationId, user.organizationId)).orderBy(desc(risksTable.updatedAt)),
    db.select().from(assuranceEngagementsTable).where(eq(assuranceEngagementsTable.organizationId, user.organizationId)).orderBy(desc(assuranceEngagementsTable.createdAt)),
    db.select().from(policiesTable).where(eq(policiesTable.organizationId, user.organizationId)).orderBy(desc(policiesTable.updatedAt)),
    db.select().from(policyPrincipleMappingsTable),
    db.select().from(reportingBoundariesTable).where(eq(reportingBoundariesTable.reportingPeriodId, period.id)).orderBy(desc(reportingBoundariesTable.createdAt)).limit(1),
    db.select().from(metricValuesTable).where(eq(metricValuesTable.reportingPeriodId, period.id)),
    db.select().from(brsrQuestionsTable).where(eq(brsrQuestionsTable.active, true)),
    db.select().from(brsrResponsesTable).where(eq(brsrResponsesTable.reportingPeriodId, period.id)),
    engagementsForFindings(user.organizationId),
  ]);
  const valueCount = values.length;
  const approvedCount = values.filter((value) => ["APPROVED", "CONSOLIDATED"].includes(value.status)).length;
  const requiredQuestions = questions.filter((question) => question.requirementType === "ESSENTIAL");
  const completedQuestions = responses.filter((response) => response.status === "COMPLETED").length;
  const openFindings = findings.filter((finding) => !["RESOLVED", "CLOSED"].includes(finding.status)).length;
  res.json({
    period: { ...period, boundaryHistory: boundary },
    principles,
    core: coreMetrics.map((metric) => ({
      ...metric,
      response: coreResponses.find((response) => response.metricId === metric.id) ?? null,
    })),
    sdgs: sdgs.map((sdg) => ({ ...sdg, targets: sdgTargets.filter((target) => target.sdgId === sdg.id) })),
    targets: targets.map(({ target, metricName }) => ({ ...target, metricName })),
    risks,
    assurance: engagements.map((engagement) => ({
      ...engagement,
      findingCount: findings.filter((finding) => finding.engagementId === engagement.id).length,
      openFindingCount: findings.filter((finding) => finding.engagementId === engagement.id && !["RESOLVED", "CLOSED"].includes(finding.status)).length,
    })),
    policies: policies.map((policy) => ({
      ...policy,
      principleIds: policyMappings.filter((mapping) => mapping.policyId === policy.id).map((mapping) => mapping.principleId),
    })),
    review: {
      valueCount,
      approvedCount,
      pendingApprovals: values.filter((value) => value.status === "SUBMITTED").length,
      validationErrors: values.filter((value) => value.validationStatus === "ERROR").length,
      essentialQuestions: { completed: Math.min(completedQuestions, requiredQuestions.length), total: requiredQuestions.length },
      openAssuranceFindings: openFindings,
      boundaryApproved: boundary[0]?.status === "APPROVED",
    },
  });
});

router.get("/brsr-core", async (_req, res): Promise<void> => {
  const user = currentUser(res);
  const [period] = await db.select().from(reportingPeriodsTable).where(eq(reportingPeriodsTable.organizationId, user.organizationId)).orderBy(desc(reportingPeriodsTable.startDate)).limit(1);
  const metrics = await db.select().from(brsrCoreMetricsTable).where(eq(brsrCoreMetricsTable.active, true)).orderBy(brsrCoreMetricsTable.code);
  const responses = period ? await db.select().from(brsrCoreResponsesTable).where(eq(brsrCoreResponsesTable.reportingPeriodId, period.id)) : [];
  res.json(metrics.map((metric) => ({ ...metric, response: responses.find((response) => response.metricId === metric.id) ?? null })));
});

router.post("/brsr-core/responses", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const { metricId, value, textValue, unit, dataSource, methodology, assuranceStatus } = req.body as Record<string, unknown>;
  if (typeof metricId !== "string" || typeof unit !== "string") {
    res.status(400).json({ error: "metricId and unit are required" });
    return;
  }
  const [period] = await db.select().from(reportingPeriodsTable).where(eq(reportingPeriodsTable.organizationId, user.organizationId)).orderBy(desc(reportingPeriodsTable.startDate)).limit(1);
  const [metric] = await db.select().from(brsrCoreMetricsTable).where(eq(brsrCoreMetricsTable.id, metricId)).limit(1);
  if (!period || !metric) {
    res.status(404).json({ error: "BRSR Core metric or reporting period not found" });
    return;
  }
  if (period.locked) {
    res.status(409).json({ error: "The reporting period is locked" });
    return;
  }
  const numericValue = typeof value === "number" || typeof value === "string" ? String(value) : undefined;
  const [existing] = await db.select().from(brsrCoreResponsesTable).where(and(eq(brsrCoreResponsesTable.metricId, metricId), eq(brsrCoreResponsesTable.reportingPeriodId, period.id))).limit(1);
  const payload = {
    value: numericValue,
    textValue: typeof textValue === "string" ? textValue : undefined,
    unit,
    dataSource: typeof dataSource === "string" ? dataSource : undefined,
    observation: typeof methodology === "string" ? `Methodology: ${methodology}` : undefined,
    assuranceStatus: typeof assuranceStatus === "string" ? assuranceStatus : "NOT_STARTED",
    status: "DRAFT",
  };
  const saved = existing
    ? (await db.update(brsrCoreResponsesTable).set(payload).where(eq(brsrCoreResponsesTable.id, existing.id)).returning())[0]
    : (await db.insert(brsrCoreResponsesTable).values({ ...payload, metricId, reportingPeriodId: period.id }).returning())[0];
  res.json(saved);
});

router.get("/sdgs", async (_req, res): Promise<void> => {
  const [sdgs, targets] = await Promise.all([db.select().from(sdgsTable).where(eq(sdgsTable.active, true)).orderBy(sdgsTable.number), db.select().from(sdgTargetsTable)]);
  res.json(sdgs.map((sdg) => ({ ...sdg, targets: targets.filter((target) => target.sdgId === sdg.id) })));
});

router.post("/targets", requireRole(...adminRoles), async (req, res): Promise<void> => {
  const user = currentUser(res);
  const body = req.body as Record<string, unknown>;
  if (typeof body.metricId !== "string" || typeof body.baselineYear !== "number" || typeof body.targetYear !== "number" || typeof body.baselineValue !== "number" || typeof body.targetValue !== "number") {
    res.status(400).json({ error: "metricId, baselineYear, baselineValue, targetYear and targetValue are required" });
    return;
  }
  const [metric] = await db.select().from(esgMetricsTable).where(eq(esgMetricsTable.id, body.metricId)).limit(1);
  if (!metric) {
    res.status(404).json({ error: "Metric not found" });
    return;
  }
  const [target] = await db.insert(esgTargetsTable).values({
    organizationId: user.organizationId,
    metricId: body.metricId,
    baselineYear: body.baselineYear,
    baselineValue: String(body.baselineValue),
    targetYear: body.targetYear,
    targetValue: String(body.targetValue),
    owner: typeof body.owner === "string" ? body.owner : undefined,
    status: "DRAFT",
  }).returning();
  res.status(201).json({ ...target, metricName: metric.name });
});

router.post("/risks", requireRole(...adminRoles), async (req, res): Promise<void> => {
  const user = currentUser(res);
  const body = req.body as Record<string, unknown>;
  if (typeof body.category !== "string" || typeof body.description !== "string" || typeof body.likelihood !== "number" || typeof body.impact !== "number") {
    res.status(400).json({ error: "category, description, likelihood and impact are required" });
    return;
  }
  const [risk] = await db.insert(risksTable).values({
    organizationId: user.organizationId,
    category: body.category,
    description: body.description,
    likelihood: body.likelihood,
    impact: body.impact,
    inherentRisk: body.likelihood * body.impact,
    controls: typeof body.controls === "string" ? body.controls : undefined,
    mitigation: typeof body.mitigation === "string" ? body.mitigation : undefined,
    owner: typeof body.owner === "string" ? body.owner : undefined,
  }).returning();
  res.status(201).json(risk);
});

router.post("/assurance/:engagementId/requests", requireRole(...reviewerRoles), async (req, res): Promise<void> => {
  const user = currentUser(res);
  const body = req.body as Record<string, unknown>;
  const engagementId = typeof req.params.engagementId === "string" ? req.params.engagementId : req.params.engagementId[0];
  const [engagement] = await db.select().from(assuranceEngagementsTable).where(and(eq(assuranceEngagementsTable.id, engagementId), eq(assuranceEngagementsTable.organizationId, user.organizationId))).limit(1);
  if (!engagement) {
    res.status(404).json({ error: "Assurance engagement not found" });
    return;
  }
  if (typeof body.subject !== "string" || typeof body.description !== "string") {
    res.status(400).json({ error: "subject and description are required" });
    return;
  }
  const [request] = await db.insert(assuranceRequestsTable).values({
    engagementId: engagement.id,
    requestedBy: user.id,
    subject: body.subject,
    description: body.description,
    dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined,
  }).returning();
  res.status(201).json(request);
});

router.get("/assurance/:engagementId", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const engagementId = typeof req.params.engagementId === "string" ? req.params.engagementId : req.params.engagementId[0];
  const [engagement] = await db.select().from(assuranceEngagementsTable).where(and(eq(assuranceEngagementsTable.id, engagementId), eq(assuranceEngagementsTable.organizationId, user.organizationId))).limit(1);
  if (!engagement) {
    res.status(404).json({ error: "Assurance engagement not found" });
    return;
  }
  const [requests, findings] = await Promise.all([
    db.select().from(assuranceRequestsTable).where(eq(assuranceRequestsTable.engagementId, engagement.id)).orderBy(desc(assuranceRequestsTable.createdAt)),
    db.select().from(assuranceFindingsTable).where(eq(assuranceFindingsTable.engagementId, engagement.id)).orderBy(desc(assuranceFindingsTable.createdAt)),
  ]);
  res.json({ engagement, requests, findings });
});

router.post("/brsr/cross-references", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const body = req.body as Record<string, unknown>;
  const [period] = await db.select().from(reportingPeriodsTable).where(eq(reportingPeriodsTable.organizationId, user.organizationId)).orderBy(desc(reportingPeriodsTable.startDate)).limit(1);
  if (!period || typeof body.questionId !== "string" || typeof body.sourceFramework !== "string" || typeof body.sourceDocument !== "string") {
    res.status(400).json({ error: "questionId, sourceFramework and sourceDocument are required" });
    return;
  }
  const [reference] = await db.insert(crossReferencesTable).values({
    questionId: body.questionId,
    reportingPeriodId: period.id,
    sourceFramework: body.sourceFramework,
    sourceDocument: body.sourceDocument,
    pageNumber: typeof body.pageNumber === "number" ? body.pageNumber : undefined,
    section: typeof body.section === "string" ? body.section : undefined,
    referenceUrl: typeof body.referenceUrl === "string" ? body.referenceUrl : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
  }).returning();
  res.status(201).json(reference);
});

router.get("/search", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (query.length < 2) {
    res.json([]);
    return;
  }
  const pattern = `%${query}%`;
  const [projects, metrics, questions, policies, risks] = await Promise.all([
    db.select({ id: projectsTable.id, title: projectsTable.name }).from(projectsTable)
      .innerJoin(businessUnitsTable, eq(businessUnitsTable.id, projectsTable.businessUnitId))
      .innerJoin(entitiesTable, eq(entitiesTable.id, businessUnitsTable.entityId))
      .where(and(eq(entitiesTable.organizationId, user.organizationId), ilike(projectsTable.name, pattern))).limit(10),
    db.select({ id: esgMetricsTable.id, title: esgMetricsTable.name }).from(esgMetricsTable).where(ilike(esgMetricsTable.name, pattern)).limit(10),
    db.select({ id: brsrQuestionsTable.id, title: brsrQuestionsTable.questionText }).from(brsrQuestionsTable).where(ilike(brsrQuestionsTable.questionText, pattern)).limit(10),
    db.select({ id: policiesTable.id, title: policiesTable.name }).from(policiesTable).where(and(eq(policiesTable.organizationId, user.organizationId), ilike(policiesTable.name, pattern))).limit(10),
    db.select({ id: risksTable.id, title: risksTable.description }).from(risksTable).where(and(eq(risksTable.organizationId, user.organizationId), ilike(risksTable.description, pattern))).limit(10),
  ]);
  res.json([
    ...projects.map((item) => ({ ...item, type: "PROJECT" })),
    ...metrics.map((item) => ({ ...item, type: "METRIC" })),
    ...questions.map((item) => ({ ...item, type: "BRSR_QUESTION" })),
    ...policies.map((item) => ({ ...item, type: "POLICY" })),
    ...risks.map((item) => ({ ...item, type: "RISK" })),
  ]);
});

router.get("/reports/:id/review", requireRole(...reviewerRoles), async (req, res): Promise<void> => {
  const user = currentUser(res);
  const reportId = typeof req.params.id === "string" ? req.params.id : req.params.id[0];
  const [report] = await db.select().from(reportsTable).where(and(eq(reportsTable.id, reportId), eq(reportsTable.organizationId, user.organizationId))).limit(1);
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  const [values, questions, responses, boundary, findings] = await Promise.all([
    db.select().from(metricValuesTable).where(eq(metricValuesTable.reportingPeriodId, report.reportingPeriodId)),
    db.select().from(brsrQuestionsTable).where(eq(brsrQuestionsTable.active, true)),
    db.select().from(brsrResponsesTable).where(eq(brsrResponsesTable.reportingPeriodId, report.reportingPeriodId)),
    db.select().from(reportingBoundariesTable).where(eq(reportingBoundariesTable.reportingPeriodId, report.reportingPeriodId)).orderBy(desc(reportingBoundariesTable.createdAt)).limit(1),
    engagementsForFindings(user.organizationId),
  ]);
  const essential = questions.filter((question) => question.requirementType === "ESSENTIAL");
  const checks = [
    { key: "validation", label: "Validation errors", count: values.filter((value) => value.validationStatus === "ERROR").length },
    { key: "approval", label: "Unresolved approvals", count: values.filter((value) => ["DRAFT", "SUBMITTED", "RETURNED"].includes(value.status)).length },
    { key: "responses", label: "Missing essential responses", count: essential.filter((question) => !responses.some((response) => response.questionId === question.id && response.status === "COMPLETED")).length },
    { key: "assurance", label: "Open assurance findings", count: findings.filter((finding) => !["RESOLVED", "CLOSED"].includes(finding.status)).length },
    { key: "boundary", label: "Approved reporting boundary", count: boundary[0]?.status === "APPROVED" ? 0 : 1 },
  ];
  res.json({ report, checks, ready: checks.every((check) => check.count === 0) });
});

router.post("/reports/:id/finalize", requireRole(...adminRoles), async (req, res): Promise<void> => {
  const user = currentUser(res);
  const reportId = typeof req.params.id === "string" ? req.params.id : req.params.id[0];
  const [report] = await db.select().from(reportsTable).where(and(eq(reportsTable.id, reportId), eq(reportsTable.organizationId, user.organizationId))).limit(1);
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  if (report.status === "FINALIZED") {
    res.status(409).json({ error: "Report is already finalized" });
    return;
  }
  const [values, questions, responses, evidence] = await Promise.all([
    db.select().from(metricValuesTable).where(eq(metricValuesTable.reportingPeriodId, report.reportingPeriodId)),
    db.select().from(brsrQuestionsTable).where(eq(brsrQuestionsTable.active, true)),
    db.select().from(brsrResponsesTable).where(eq(brsrResponsesTable.reportingPeriodId, report.reportingPeriodId)),
    db.select({ id: evidenceTable.id }).from(evidenceTable).where(eq(evidenceTable.reportingPeriodId, report.reportingPeriodId)),
  ]);
  const essential = questions.filter((question) => question.requirementType === "ESSENTIAL");
  const blocking = [
    ...values.filter((value) => value.validationStatus === "ERROR").map(() => "validation errors"),
    ...values.filter((value) => ["DRAFT", "SUBMITTED", "RETURNED"].includes(value.status)).map(() => "unresolved approvals"),
    ...essential.filter((question) => !responses.some((response) => response.questionId === question.id && response.status === "COMPLETED")).map(() => "missing essential responses"),
  ];
  if (blocking.length) {
    res.status(409).json({ error: "Report is not ready for finalization", blocking: [...new Set(blocking)] });
    return;
  }
  const dataset = { reportId: report.id, periodId: report.reportingPeriodId, frameworkVersion: report.frameworkVersion, boundary: report.boundary, values, questions, responses, evidence };
  const checksum = createHash("sha256").update(JSON.stringify(dataset)).digest("hex");
  const [version] = await db.insert(reportVersionsTable).values({
    reportId: report.id,
    version: 1,
    dataset,
    checksum,
    evidenceReferences: evidence.map((item) => item.id),
    finalizedBy: user.id,
    finalizedAt: new Date(),
    immutable: true,
  }).returning();
  const [finalized] = await db.update(reportsTable).set({ status: "FINALIZED", checksum, generatedAt: report.generatedAt ?? new Date() }).where(eq(reportsTable.id, report.id)).returning();
  res.json({ report: finalized, version });
});

async function engagementsForFindings(organizationId: string) {
  const engagements = await db.select({ id: assuranceEngagementsTable.id }).from(assuranceEngagementsTable).where(eq(assuranceEngagementsTable.organizationId, organizationId));
  if (!engagements.length) return [] as (typeof assuranceFindingsTable.$inferSelect)[];
  return db.select().from(assuranceFindingsTable).where(inArray(assuranceFindingsTable.engagementId, engagements.map((engagement) => engagement.id)));
}

export default router;