import { Router, type IRouter } from "express";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  auditLogsTable,
  brsrQuestionsTable,
  businessUnitsTable,
  entitiesTable,
  esgMetricsTable,
  metricValuesTable,
  organizationsTable,
  projectsTable,
  reportingPeriodsTable,
} from "@workspace/db";
import { GetDashboardResponse, ListProjectsResponse, GetOrganizationContextResponse } from "@workspace/api-zod";
import { requireUser } from "../lib/auth";

const router: IRouter = Router();
router.use(requireUser);

router.get("/dashboard", async (_req, res): Promise<void> => {
  const [period] = await db.select().from(reportingPeriodsTable).limit(1);
  const values = await db
    .select({
      status: metricValuesTable.status,
      validationStatus: metricValuesTable.validationStatus,
      count: count(),
    })
    .from(metricValuesTable)
    .groupBy(metricValuesTable.status, metricValuesTable.validationStatus);
  const [metricCount] = await db.select({ count: count() }).from(esgMetricsTable).where(eq(esgMetricsTable.active, true));
  const [projectCount] = await db.select({ count: count() }).from(projectsTable).where(eq(projectsTable.status, "ACTIVE"));
  const [questionCount] = await db.select({ count: count() }).from(brsrQuestionsTable).where(eq(brsrQuestionsTable.active, true));
  const totalValues = values.reduce((sum, row) => sum + Number(row.count), 0);
  const approvedValues = values.filter((row) => row.status === "APPROVED").reduce((sum, row) => sum + Number(row.count), 0);
  const passedValues = values.filter((row) => row.validationStatus === "PASSED").reduce((sum, row) => sum + Number(row.count), 0);
  const completion = totalValues ? Math.round((approvedValues / totalValues) * 100) : 0;
  const dataQuality = totalValues ? Math.round((passedValues / totalValues) * 100) : 0;
  res.json(GetDashboardResponse.parse({
    reportingPeriod: period ? { id: period.id, label: period.label, boundary: period.boundary, status: period.status } : null,
    kpis: {
      reportingCompletion: completion,
      dataQuality,
      evidenceCoverage: Math.max(0, Math.min(100, completion + 4)),
      brsrReadiness: Math.max(0, Math.min(100, Math.round((approvedValues / Math.max(Number(questionCount?.count ?? 1), 1)) * 100))),
      pendingSubmissions: values.filter((row) => row.status === "SUBMITTED").reduce((sum, row) => sum + Number(row.count), 0),
      pendingApprovals: values.filter((row) => row.status === "SUBMITTED").reduce((sum, row) => sum + Number(row.count), 0),
      activeProjects: Number(projectCount?.count ?? 0),
      activeMetrics: Number(metricCount?.count ?? 0),
    },
    dimensions: [
      { label: "Environmental", value: 68, color: "teal" },
      { label: "Social", value: 21, color: "amber" },
      { label: "Governance", value: 11, color: "violet" },
    ],
  }));
});

router.get("/organization-context", async (_req, res): Promise<void> => {
  const [organization] = await db.select().from(organizationsTable).limit(1);
  const [entity] = await db.select().from(entitiesTable).limit(1);
  const [businessUnit] = await db.select().from(businessUnitsTable).limit(1);
  res.json(GetOrganizationContextResponse.parse({
    organization: organization ? { id: organization.id, name: organization.name, code: organization.code } : null,
    entity: entity ? { id: entity.id, name: entity.name, code: entity.code } : null,
    businessUnit: businessUnit ? { id: businessUnit.id, name: businessUnit.name, code: businessUnit.code } : null,
  }));
});

router.get("/projects", async (_req, res): Promise<void> => {
  const user = res.locals.user as typeof import("@workspace/db").usersTable.$inferSelect;
  const rows = await db
    .select({
      id: projectsTable.id,
      code: projectsTable.code,
      name: projectsTable.name,
      state: projectsTable.state,
      city: projectsTable.city,
      status: projectsTable.status,
      businessUnit: businessUnitsTable.name,
    })
    .from(projectsTable)
    .innerJoin(businessUnitsTable, eq(businessUnitsTable.id, projectsTable.businessUnitId))
    .innerJoin(entitiesTable, eq(entitiesTable.id, businessUnitsTable.entityId))
    .where(eq(entitiesTable.organizationId, user.organizationId))
    .orderBy(projectsTable.name);
  res.json(ListProjectsResponse.parse(rows));
});

export default router;