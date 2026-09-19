import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router, type IRouter } from "express";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import {
  auditLogsTable,
  brsrQuestionsTable,
  brsrResponsesTable,
  businessUnitsTable,
  db,
  entitiesTable,
  evidenceTable,
  metricBrsrMappingsTable,
  metricValuesTable,
  notificationsTable,
  projectsTable,
  reportsTable,
  reportingPeriodsTable,
  usersTable,
} from "@workspace/db";
import { getUserRoles, requireRole, requireUser } from "../lib/auth";

const router: IRouter = Router();
router.use(requireUser);

const reviewerRoles = [
  "Reviewer",
  "Approver",
  "Group ESG Admin",
  "Group ESG Head",
  "Super Admin",
];

async function audit(
  organizationId: string,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  after: unknown,
  before?: unknown,
): Promise<void> {
  await db.insert(auditLogsTable).values({
    organizationId,
    actorUserId,
    action,
    entityType,
    entityId,
    before,
    after,
  });
}

router.get("/reporting-periods", async (req, res): Promise<void> => {
  const user = res.locals.user as typeof usersTable.$inferSelect;
  const rows = await db
    .select()
    .from(reportingPeriodsTable)
    .where(eq(reportingPeriodsTable.organizationId, user.organizationId))
    .orderBy(desc(reportingPeriodsTable.startDate));
  res.json(rows);
});

router.get("/evidence", async (req, res): Promise<void> => {
  const user = res.locals.user as typeof usersTable.$inferSelect;
  const conditions = [eq(usersTable.organizationId, user.organizationId)];
  const rows = await db
    .select({
      id: evidenceTable.id,
      fileName: evidenceTable.fileName,
      evidenceType: evidenceTable.evidenceType,
      checksum: evidenceTable.checksum,
      reportingPeriodId: evidenceTable.reportingPeriodId,
      projectId: evidenceTable.projectId,
      metricValueId: evidenceTable.metricValueId,
      uploadedBy: evidenceTable.uploadedBy,
      status: evidenceTable.status,
      comments: evidenceTable.comments,
      expiresAt: evidenceTable.expiresAt,
      createdAt: evidenceTable.createdAt,
    })
    .from(evidenceTable)
    .innerJoin(usersTable, eq(usersTable.id, evidenceTable.uploadedBy))
    .where(and(...conditions))
    .orderBy(desc(evidenceTable.createdAt))
    .limit(100);
  res.json(rows);
});

router.post("/evidence", async (req, res): Promise<void> => {
  const user = res.locals.user as typeof usersTable.$inferSelect;
  const {
    fileName,
    evidenceType,
    reportingPeriodId,
    projectId,
    metricValueId,
    comments,
    expiresAt,
    mimeType,
    contentBase64,
  } = req.body as Record<string, unknown>;
  if (typeof fileName !== "string" || !fileName.trim() || typeof evidenceType !== "string") {
    res.status(400).json({ error: "fileName and evidenceType are required" });
    return;
  }
  if (typeof contentBase64 !== "string" || !contentBase64) {
    res.status(400).json({ error: "A file payload is required" });
    return;
  }
  const normalizedName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const allowedTypes = ["application/pdf", "text/csv", "text/plain", "application/json", "image/png", "image/jpeg", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
  if (typeof mimeType === "string" && !allowedTypes.includes(mimeType)) {
    res.status(400).json({ error: "Unsupported evidence file type" });
    return;
  }
  const raw = contentBase64.includes(",") ? contentBase64.split(",").pop() : contentBase64;
  if (!raw) {
    res.status(400).json({ error: "Invalid file payload" });
    return;
  }
  const bytes = Buffer.from(raw, "base64");
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
    res.status(400).json({ error: "Evidence files must be between 1 byte and 10 MB" });
    return;
  }
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const relativePath = path.join("uploads", `${randomUUID()}-${normalizedName}`);
  const absolutePath = path.join(process.cwd(), relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes, { flag: "wx" });

  const [period] = reportingPeriodId
    ? await db.select().from(reportingPeriodsTable).where(and(eq(reportingPeriodsTable.id, String(reportingPeriodId)), eq(reportingPeriodsTable.organizationId, user.organizationId))).limit(1)
    : [];
  if (reportingPeriodId && !period) {
    res.status(404).json({ error: "Reporting period not found" });
    return;
  }
  const [created] = await db.insert(evidenceTable).values({
    fileName: normalizedName,
    evidenceType,
    storagePath: relativePath,
    checksum,
    reportingPeriodId: period?.id,
    projectId: typeof projectId === "string" ? projectId : undefined,
    metricValueId: typeof metricValueId === "string" ? metricValueId : undefined,
    uploadedBy: user.id,
    comments: JSON.stringify({ text: typeof comments === "string" ? comments : null, mimeType, size: bytes.length }),
    expiresAt: typeof expiresAt === "string" ? expiresAt : undefined,
  }).returning();
  if (!created) {
    res.status(500).json({ error: "Unable to save evidence metadata" });
    return;
  }
  await audit(user.organizationId, user.id, "EVIDENCE_UPLOADED", "evidence", created.id, { fileName: normalizedName, checksum });
  res.status(201).json({ ...created, storagePath: undefined });
});

router.get("/workflow/pending", async (req, res): Promise<void> => {
  const user = res.locals.user as typeof usersTable.$inferSelect;
  const rows = await db
    .select({
      id: metricValuesTable.id,
      metricId: metricValuesTable.metricId,
      metricName: (await import("@workspace/db")).esgMetricsTable.name,
      projectId: metricValuesTable.projectId,
      value: metricValuesTable.value,
      unit: metricValuesTable.unit,
      status: metricValuesTable.status,
      validationStatus: metricValuesTable.validationStatus,
      submittedAt: metricValuesTable.submittedAt,
    })
    .from(metricValuesTable)
    .innerJoin((await import("@workspace/db")).esgMetricsTable, eq((await import("@workspace/db")).esgMetricsTable.id, metricValuesTable.metricId))
    .innerJoin(projectsTable, eq(projectsTable.id, metricValuesTable.projectId))
    .innerJoin(businessUnitsTable, eq(businessUnitsTable.id, projectsTable.businessUnitId))
    .innerJoin(entitiesTable, eq(entitiesTable.id, businessUnitsTable.entityId))
    .where(and(eq(entitiesTable.organizationId, user.organizationId), inArray(metricValuesTable.status, ["SUBMITTED", "RETURNED"])))
    .orderBy(desc(metricValuesTable.submittedAt));
  res.json(rows.map((row) => ({ ...row, value: row.value === null ? null : Number(row.value) })));
});

router.post("/metric-values/:id/return", requireRole(...reviewerRoles), async (req, res): Promise<void> => {
  const user = res.locals.user as typeof usersTable.$inferSelect;
  const metricValueId = typeof req.params.id === "string" ? req.params.id : req.params.id[0];
  const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
  if (!comment) {
    res.status(400).json({ error: "A review comment is required when returning an item" });
    return;
  }
  const [row] = await db.select({ value: metricValuesTable, period: reportingPeriodsTable })
    .from(metricValuesTable)
    .innerJoin(reportingPeriodsTable, eq(reportingPeriodsTable.id, metricValuesTable.reportingPeriodId))
    .where(and(eq(metricValuesTable.id, metricValueId), eq(reportingPeriodsTable.organizationId, user.organizationId))).limit(1);
  if (!row) {
    res.status(404).json({ error: "Metric value not found" });
    return;
  }
  const [updated] = await db.update(metricValuesTable).set({ status: "RETURNED", validationMessage: comment }).where(eq(metricValuesTable.id, row.value.id)).returning();
  await audit(user.organizationId, user.id, "METRIC_VALUE_RETURNED", "metric_value", row.value.id, { status: "RETURNED", comment }, { status: row.value.status });
  res.json({ ...updated, value: updated?.value === null ? null : Number(updated?.value) });
});

router.post("/consolidation/run", requireRole(...reviewerRoles), async (_req, res): Promise<void> => {
  const user = res.locals.user as typeof usersTable.$inferSelect;
  const [period] = await db.select().from(reportingPeriodsTable).where(eq(reportingPeriodsTable.organizationId, user.organizationId)).orderBy(desc(reportingPeriodsTable.startDate)).limit(1);
  if (!period) {
    res.status(404).json({ error: "No reporting period configured" });
    return;
  }
  const sourceRows = await db.select().from(metricValuesTable).where(and(eq(metricValuesTable.reportingPeriodId, period.id), eq(metricValuesTable.status, "APPROVED")));
  const grouped = new Map<string, { metricId: string; entityId: string; total: number; unit: string }>();
  for (const source of sourceRows) {
    if (!source.entityId || source.value === null) continue;
    const key = `${source.metricId}:${source.entityId}`;
    const current = grouped.get(key) ?? { metricId: source.metricId, entityId: source.entityId, total: 0, unit: source.unit };
    current.total += Number(source.value);
    grouped.set(key, current);
  }
  const inserted = [];
  for (const item of grouped.values()) {
    const [existing] = await db.select().from(metricValuesTable).where(and(eq(metricValuesTable.metricId, item.metricId), eq(metricValuesTable.entityId, item.entityId), eq(metricValuesTable.reportingPeriodId, period.id), eq(metricValuesTable.status, "CONSOLIDATED"))).limit(1);
    if (existing) continue;
    const [created] = await db.insert(metricValuesTable).values({
      metricId: item.metricId,
      reportingPeriodId: period.id,
      entityId: item.entityId,
      value: String(item.total),
      unit: item.unit,
      status: "CONSOLIDATED",
      validationStatus: "PASSED",
      submittedBy: user.id,
    }).returning();
    if (created) inserted.push(created.id);
  }
  await audit(user.organizationId, user.id, "CONSOLIDATION_RUN_COMPLETED", "consolidation", null, { sourceCount: sourceRows.length, metricCount: inserted.length });
  res.json({ status: "COMPLETED", reportingPeriodId: period.id, sourceCount: sourceRows.length, metricCount: inserted.length });
});

router.get("/lineage/:metricValueId", async (req, res): Promise<void> => {
  const user = res.locals.user as typeof usersTable.$inferSelect;
  const [row] = await db.select({ value: metricValuesTable, period: reportingPeriodsTable })
    .from(metricValuesTable)
    .innerJoin(reportingPeriodsTable, eq(reportingPeriodsTable.id, metricValuesTable.reportingPeriodId))
    .where(and(eq(metricValuesTable.id, req.params.metricValueId), eq(reportingPeriodsTable.organizationId, user.organizationId))).limit(1);
  if (!row) {
    res.status(404).json({ error: "Metric value not found" });
    return;
  }
  const evidence = await db.select({ id: evidenceTable.id, fileName: evidenceTable.fileName, checksum: evidenceTable.checksum, status: evidenceTable.status }).from(evidenceTable).where(eq(evidenceTable.metricValueId, row.value.id));
  const auditRows = await db.select({ action: auditLogsTable.action, createdAt: auditLogsTable.createdAt, actorUserId: auditLogsTable.actorUserId }).from(auditLogsTable).where(eq(auditLogsTable.entityId, row.value.id)).orderBy(auditLogsTable.createdAt);
  res.json({
    metricValue: { id: row.value.id, metricId: row.value.metricId, value: row.value.value === null ? null : Number(row.value.value), unit: row.value.unit, status: row.value.status, validationStatus: row.value.validationStatus },
    nodes: [
      { type: "SOURCE", label: "Project submission", status: "complete" },
      { type: "VALIDATED", label: row.value.validationStatus === "PASSED" ? "Validation passed" : "Validation pending", status: row.value.validationStatus === "PASSED" ? "complete" : "attention" },
      { type: "EVIDENCE", label: `${evidence.length} linked evidence file${evidence.length === 1 ? "" : "s"}`, status: evidence.length ? "complete" : "attention" },
      { type: row.value.status === "CONSOLIDATED" ? "CONSOLIDATION" : "APPROVAL", label: row.value.status, status: ["APPROVED", "CONSOLIDATED"].includes(row.value.status) ? "complete" : "pending" },
      { type: "REPORT", label: "BRSR report dataset", status: "pending" },
    ],
    evidence,
    audit: auditRows,
  });
});

router.get("/brsr/workspace", async (req, res): Promise<void> => {
  const user = res.locals.user as typeof usersTable.$inferSelect;
  const [period] = await db.select().from(reportingPeriodsTable).where(eq(reportingPeriodsTable.organizationId, user.organizationId)).orderBy(desc(reportingPeriodsTable.startDate)).limit(1);
  const questions = await db.select().from(brsrQuestionsTable).where(eq(brsrQuestionsTable.active, true));
  const responses = period ? await db.select().from(brsrResponsesTable).where(eq(brsrResponsesTable.reportingPeriodId, period.id)) : [];
  const mappings = await db.select().from(metricBrsrMappingsTable);
  res.json(questions.map((question) => {
    const response = responses.find((item) => item.questionId === question.id);
    return {
      ...question,
      response: response?.response ?? null,
      responseStatus: response?.status ?? "INCOMPLETE",
      mappedMetricCount: mappings.filter((item) => item.questionId === question.id).length,
    };
  }));
});

router.post("/brsr/responses", async (req, res): Promise<void> => {
  const user = res.locals.user as typeof usersTable.$inferSelect;
  const { questionId, response, status = "COMPLETED" } = req.body as Record<string, unknown>;
  if (typeof questionId !== "string" || typeof response !== "string" || !response.trim()) {
    res.status(400).json({ error: "questionId and response are required" });
    return;
  }
  const [period] = await db.select().from(reportingPeriodsTable).where(eq(reportingPeriodsTable.organizationId, user.organizationId)).orderBy(desc(reportingPeriodsTable.startDate)).limit(1);
  if (!period || period.locked) {
    res.status(409).json({ error: "No open reporting period is available" });
    return;
  }
  const [existing] = await db.select().from(brsrResponsesTable).where(and(eq(brsrResponsesTable.questionId, questionId), eq(brsrResponsesTable.reportingPeriodId, period.id))).limit(1);
  const saved = existing
    ? (await db.update(brsrResponsesTable).set({ response, status: String(status), evidenceStatus: "RECORDED" }).where(eq(brsrResponsesTable.id, existing.id)).returning())[0]
    : (await db.insert(brsrResponsesTable).values({ questionId, reportingPeriodId: period.id, response, status: String(status), evidenceStatus: "RECORDED" }).returning())[0];
  await audit(user.organizationId, user.id, "BRSR_RESPONSE_SAVED", "brsr_response", saved?.id ?? null, { questionId, status });
  res.json(saved);
});

router.post("/reports/generate", requireRole(...reviewerRoles), async (req, res): Promise<void> => {
  const user = res.locals.user as typeof usersTable.$inferSelect;
  const [period] = await db.select().from(reportingPeriodsTable).where(eq(reportingPeriodsTable.organizationId, user.organizationId)).orderBy(desc(reportingPeriodsTable.startDate)).limit(1);
  if (!period) {
    res.status(404).json({ error: "No reporting period configured" });
    return;
  }
  const [questions, values, evidence] = await Promise.all([
    db.select().from(brsrQuestionsTable).where(eq(brsrQuestionsTable.active, true)),
    db.select().from(metricValuesTable).where(eq(metricValuesTable.reportingPeriodId, period.id)),
    db.select({ id: evidenceTable.id, fileName: evidenceTable.fileName, metricValueId: evidenceTable.metricValueId }).from(evidenceTable).where(eq(evidenceTable.reportingPeriodId, period.id)),
  ]);
  const dataset = { generatedAt: new Date().toISOString(), period: { id: period.id, label: period.label, boundary: period.boundary }, questions, values, evidence };
  const checksum = createHash("sha256").update(JSON.stringify(dataset)).digest("hex");
  const [report] = await db.insert(reportsTable).values({ organizationId: user.organizationId, reportingPeriodId: period.id, reportType: typeof req.body?.reportType === "string" ? req.body.reportType : "BRSR", frameworkVersion: "2024", boundary: period.boundary, status: "DRAFT", checksum, generatedBy: user.id, generatedAt: new Date() }).returning();
  await audit(user.organizationId, user.id, "REPORT_GENERATED", "report", report?.id ?? null, { checksum, reportType: report?.reportType });
  res.status(201).json({ report, datasetSummary: { questionCount: questions.length, valueCount: values.length, evidenceCount: evidence.length }, checksum });
});

router.get("/notifications", async (_req, res): Promise<void> => {
  const user = res.locals.user as typeof usersTable.$inferSelect;
  const rows = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, user.id)).orderBy(desc(notificationsTable.createdAt)).limit(25);
  res.json(rows);
});

export default router;