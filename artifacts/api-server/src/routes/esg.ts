import { Router, type IRouter } from "express";
import { and, count, desc, eq } from "drizzle-orm";
import {
  auditLogsTable,
  brsrQuestionsTable,
  brsrResponsesTable,
  businessUnitsTable,
  db,
  entitiesTable,
  esgMetricsTable,
  evidenceTable,
  metricBrsrMappingsTable,
  metricValuesTable,
  projectsTable,
  reportingPeriodsTable,
} from "@workspace/db";
import {
  ApproveMetricValueParams,
  ApproveMetricValueResponse,
  CreateMetricValueBody,
  CreateMetricValueResponse,
  GetBrsrReadinessResponse,
  ListAuditLogsResponse,
  ListMetricsResponse,
  ListMetricValuesQueryParams,
  ListMetricValuesResponse,
  SubmitMetricValueParams,
  SubmitMetricValueResponse,
} from "@workspace/api-zod";
import { requireRole, requireUser } from "../lib/auth";

const router: IRouter = Router();
router.use(requireUser);
const reviewerRoles = ["Reviewer", "Approver", "Group ESG Admin", "Group ESG Head", "Super Admin"];

function validateValue(value: number, unit: string, expectedUnit: string, rules: Record<string, unknown>) {
  if (unit !== expectedUnit) return { status: "ERROR", message: `Unit must be ${expectedUnit}.` };
  if (Number.isNaN(value) || !Number.isFinite(value)) return { status: "ERROR", message: "Value must be a finite number." };
  if (typeof rules.min === "number" && value < rules.min) return { status: "ERROR", message: "Value cannot be negative." };
  if (rules.integer === true && !Number.isInteger(value)) return { status: "ERROR", message: "Value must be a whole number." };
  return { status: "PASSED", message: null };
}

router.get("/metrics", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: esgMetricsTable.id,
      code: esgMetricsTable.code,
      name: esgMetricsTable.name,
      description: esgMetricsTable.description,
      dimension: esgMetricsTable.dimension,
      category: esgMetricsTable.category,
      unit: esgMetricsTable.unit,
      requiredEvidence: esgMetricsTable.requiredEvidence,
    })
    .from(esgMetricsTable)
    .where(eq(esgMetricsTable.active, true))
    .orderBy(esgMetricsTable.dimension, esgMetricsTable.name);
  res.json(ListMetricsResponse.parse(rows));
});

router.get("/metric-values", async (req, res): Promise<void> => {
  const query = ListMetricValuesQueryParams.parse(req.query);
  const predicates = [];
  if (query.projectId) predicates.push(eq(metricValuesTable.projectId, query.projectId));
  if (query.reportingPeriodId) predicates.push(eq(metricValuesTable.reportingPeriodId, query.reportingPeriodId));
  const rows = await db
    .select({
      id: metricValuesTable.id,
      metricId: metricValuesTable.metricId,
      metricName: esgMetricsTable.name,
      projectId: metricValuesTable.projectId,
      projectName: projectsTable.name,
      reportingPeriodId: metricValuesTable.reportingPeriodId,
      value: metricValuesTable.value,
      unit: metricValuesTable.unit,
      status: metricValuesTable.status,
      validationStatus: metricValuesTable.validationStatus,
      validationMessage: metricValuesTable.validationMessage,
      applicability: metricValuesTable.applicability,
    })
    .from(metricValuesTable)
    .innerJoin(esgMetricsTable, eq(esgMetricsTable.id, metricValuesTable.metricId))
    .leftJoin(projectsTable, eq(projectsTable.id, metricValuesTable.projectId))
    .where(predicates.length ? and(...predicates) : undefined)
    .orderBy(desc(metricValuesTable.updatedAt));
  res.json(
    ListMetricValuesResponse.parse(
      rows.map((row) => ({
        ...row,
        value: row.value === null ? null : Number(row.value),
      })),
    ),
  );
});

router.post("/metric-values", async (req, res): Promise<void> => {
  const parsed = CreateMetricValueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [metric] = await db.select().from(esgMetricsTable).where(eq(esgMetricsTable.id, parsed.data.metricId)).limit(1);
  const [period] = await db.select().from(reportingPeriodsTable).where(eq(reportingPeriodsTable.id, parsed.data.reportingPeriodId)).limit(1);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parsed.data.projectId)).limit(1);
  if (!metric || !period || !project) {
    res.status(404).json({ error: "Metric, reporting period, or project was not found" });
    return;
  }
  if (period.locked) {
    res.status(409).json({ error: "This reporting period is locked" });
    return;
  }
  const validation = validateValue(parsed.data.value, parsed.data.unit, metric.unit, metric.validationRules);
  const user = res.locals.user as typeof import("@workspace/db").usersTable.$inferSelect;
  const [created] = await db
    .insert(metricValuesTable)
    .values({
      metricId: metric.id,
      reportingPeriodId: period.id,
      projectId: project.id,
      entityId: (await db.select({ id: entitiesTable.id }).from(entitiesTable).innerJoin(
        // The project is scoped through its business unit; this is resolved for traceability.
        businessUnitsTable,
        eq(businessUnitsTable.entityId, entitiesTable.id),
      ).where(eq(businessUnitsTable.id, project.businessUnitId)).limit(1))[0]?.id,
      value: String(parsed.data.value),
      unit: parsed.data.unit,
      applicability: parsed.data.applicability ?? "APPLICABLE",
      notApplicableReason: parsed.data.notApplicableReason,
      validationStatus: validation.status,
      validationMessage: validation.message,
      submittedBy: user.id,
    })
    .returning();
  if (!created) {
    res.status(500).json({ error: "Unable to save metric value" });
    return;
  }
  await db.insert(auditLogsTable).values({
    organizationId: period.organizationId,
    actorUserId: user.id,
    action: "METRIC_VALUE_CREATED",
    entityType: "metric_value",
    entityId: created.id,
    after: { metricId: metric.id, projectId: project.id, value: parsed.data.value, unit: parsed.data.unit },
  });
  res.status(201).json(CreateMetricValueResponse.parse({
    id: created.id,
    metricId: created.metricId,
    metricName: metric.name,
    projectId: created.projectId,
    projectName: project.name,
    reportingPeriodId: created.reportingPeriodId,
    value: created.value === null ? null : Number(created.value),
    unit: created.unit,
    status: created.status,
    validationStatus: created.validationStatus,
    validationMessage: created.validationMessage,
    applicability: created.applicability,
  }));
});

router.post("/metric-values/:id/submit", async (req, res): Promise<void> => {
  const params = SubmitMetricValueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ value: metricValuesTable, metric: esgMetricsTable, period: reportingPeriodsTable })
    .from(metricValuesTable)
    .innerJoin(esgMetricsTable, eq(esgMetricsTable.id, metricValuesTable.metricId))
    .innerJoin(reportingPeriodsTable, eq(reportingPeriodsTable.id, metricValuesTable.reportingPeriodId))
    .where(eq(metricValuesTable.id, params.data.id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Metric value not found" });
    return;
  }
  if (row.period.locked) {
    res.status(409).json({ error: "This reporting period is locked" });
    return;
  }
  if (row.value.validationStatus === "ERROR") {
    res.status(409).json({ error: row.value.validationMessage ?? "Resolve validation errors before submitting" });
    return;
  }
  if (row.metric.requiredEvidence) {
    const [evidence] = await db.select({ count: count() }).from(evidenceTable).where(eq(evidenceTable.metricValueId, row.value.id));
    if (Number(evidence?.count ?? 0) === 0) {
      res.status(409).json({ error: "Evidence is required before submission" });
      return;
    }
  }
  const user = res.locals.user as typeof import("@workspace/db").usersTable.$inferSelect;
  const [updated] = await db.update(metricValuesTable).set({
    status: "SUBMITTED",
    submittedBy: user.id,
    submittedAt: new Date(),
  }).where(eq(metricValuesTable.id, row.value.id)).returning();
  await db.insert(auditLogsTable).values({
    organizationId: row.period.organizationId,
    actorUserId: user.id,
    action: "METRIC_VALUE_SUBMITTED",
    entityType: "metric_value",
    entityId: row.value.id,
    before: { status: row.value.status },
    after: { status: "SUBMITTED" },
  });
  res.json(SubmitMetricValueResponse.parse({
    id: updated?.id,
    metricId: updated?.metricId,
    metricName: row.metric.name,
    projectId: updated?.projectId,
    projectName: null,
    reportingPeriodId: updated?.reportingPeriodId,
    value: updated?.value === null ? null : Number(updated?.value),
    unit: updated?.unit,
    status: updated?.status,
    validationStatus: updated?.validationStatus,
    validationMessage: updated?.validationMessage,
    applicability: updated?.applicability,
  }));
});

router.post("/metric-values/:id/approve", requireRole(...reviewerRoles), async (req, res): Promise<void> => {
  const params = ApproveMetricValueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ value: metricValuesTable, metric: esgMetricsTable, period: reportingPeriodsTable })
    .from(metricValuesTable)
    .innerJoin(esgMetricsTable, eq(esgMetricsTable.id, metricValuesTable.metricId))
    .innerJoin(reportingPeriodsTable, eq(reportingPeriodsTable.id, metricValuesTable.reportingPeriodId))
    .where(eq(metricValuesTable.id, params.data.id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Metric value not found" });
    return;
  }
  if (row.value.status !== "SUBMITTED" || row.value.validationStatus !== "PASSED") {
    res.status(409).json({ error: "Only submitted, validated values can be approved" });
    return;
  }
  const user = res.locals.user as typeof import("@workspace/db").usersTable.$inferSelect;
  const [updated] = await db.update(metricValuesTable).set({
    status: "APPROVED",
    approvedBy: user.id,
    approvedAt: new Date(),
  }).where(eq(metricValuesTable.id, row.value.id)).returning();
  await db.insert(auditLogsTable).values({
    organizationId: row.period.organizationId,
    actorUserId: user.id,
    action: "METRIC_VALUE_APPROVED",
    entityType: "metric_value",
    entityId: row.value.id,
    before: { status: row.value.status },
    after: { status: "APPROVED" },
  });
  res.json(ApproveMetricValueResponse.parse({
    id: updated?.id,
    metricId: updated?.metricId,
    metricName: row.metric.name,
    projectId: updated?.projectId,
    projectName: null,
    reportingPeriodId: updated?.reportingPeriodId,
    value: updated?.value === null ? null : Number(updated?.value),
    unit: updated?.unit,
    status: updated?.status,
    validationStatus: updated?.validationStatus,
    validationMessage: updated?.validationMessage,
    applicability: updated?.applicability,
  }));
});

router.get("/brsr/readiness", async (_req, res): Promise<void> => {
  const questions = await db.select().from(brsrQuestionsTable).where(eq(brsrQuestionsTable.active, true));
  const responses = await db.select().from(brsrResponsesTable);
  const mappedMetrics = await db
    .select({ questionId: metricBrsrMappingsTable.questionId, status: metricValuesTable.status })
    .from(metricBrsrMappingsTable)
    .innerJoin(metricValuesTable, eq(metricValuesTable.metricId, metricBrsrMappingsTable.metricId));
  const sections = ["A", "B", "C"].map((section) => {
    const sectionQuestions = questions.filter((question) => question.section === section);
    const mappedCompleted = mappedMetrics.filter((metric) => {
      const question = sectionQuestions.find((candidate) => candidate.id === metric.questionId);
      return question && metric.status === "APPROVED";
    }).length;
    const explicitCompleted = responses.filter((response) => {
      const question = sectionQuestions.find((candidate) => candidate.id === response.questionId);
      return question && response.status === "COMPLETED";
    }).length;
    return {
      section,
      label: section === "A" ? "Entity profile" : section === "B" ? "Management and process" : "Principle-wise performance",
      completed: Math.min(sectionQuestions.length, mappedCompleted + explicitCompleted),
      total: sectionQuestions.length,
    };
  });
  const total = sections.reduce((sum, section) => sum + section.total, 0);
  const completed = sections.reduce((sum, section) => sum + section.completed, 0);
  res.json(GetBrsrReadinessResponse.parse({ overall: total ? Math.round((completed / total) * 100) : 0, sections }));
});

router.get("/audit", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: auditLogsTable.id,
      action: auditLogsTable.action,
      entityType: auditLogsTable.entityType,
      entityId: auditLogsTable.entityId,
      reason: auditLogsTable.reason,
      createdAt: auditLogsTable.createdAt,
    })
    .from(auditLogsTable)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(50);
  res.json(ListAuditLogsResponse.parse(rows));
});

export default router;