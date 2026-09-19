import { and, eq } from "drizzle-orm";
import {
  auditLogsTable,
  brsrQuestionsTable,
  businessUnitsTable,
  entitiesTable,
  esgMetricsTable,
  metricBrsrMappingsTable,
  metricValuesTable,
  organizationsTable,
  projectsTable,
  reportingPeriodsTable,
  rolesTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import { db } from "@workspace/db";
import { hashPassword } from "./auth";

export async function seedDemoData(): Promise<void> {
  const [existing] = await db.select({ id: organizationsTable.id }).from(organizationsTable).limit(1);
  if (existing) return;

  const [organization] = await db
    .insert(organizationsTable)
    .values({ name: "MEIL Group Demo", code: "MEIL-DEMO" })
    .returning();
  if (!organization) throw new Error("Unable to create demo organization");

  const [entity] = await db
    .insert(entitiesTable)
    .values({
      organizationId: organization.id,
      name: "MEIL Infrastructure Demo",
      code: "MEIL-INFRA",
    })
    .returning();
  if (!entity) throw new Error("Unable to create demo entity");

  const [businessUnit] = await db
    .insert(businessUnitsTable)
    .values({
      entityId: entity.id,
      name: "Renewable Infrastructure",
      code: "RENEWABLE",
    })
    .returning();
  if (!businessUnit) throw new Error("Unable to create demo business unit");

  const projects = await db
    .insert(projectsTable)
    .values([
      {
        businessUnitId: businessUnit.id,
        code: "SOLAR-RJ-01",
        name: "Solar Project Rajasthan Demo",
        country: "India",
        state: "Rajasthan",
        city: "Jodhpur",
        projectType: "Renewable energy",
        responsiblePerson: "Aarav Mehta",
        esgCoordinator: "Priya Nair",
      },
      {
        businessUnitId: businessUnit.id,
        code: "WIND-TN-02",
        name: "Wind Corridor Tamil Nadu Demo",
        country: "India",
        state: "Tamil Nadu",
        city: "Thoothukudi",
        projectType: "Renewable energy",
        responsiblePerson: "Rohan Shah",
        esgCoordinator: "Priya Nair",
      },
    ])
    .returning();

  const [period] = await db
    .insert(reportingPeriodsTable)
    .values({
      organizationId: organization.id,
      label: "FY 2025-26",
      startDate: "2025-04-01",
      endDate: "2026-03-31",
      submissionDeadline: "2026-06-30",
      boundary: "CONSOLIDATED",
      status: "DATA_COLLECTION",
    })
    .returning();
  if (!period) throw new Error("Unable to create demo reporting period");

  const [role] = await db
    .insert(rolesTable)
    .values({
      name: "Project ESG Coordinator",
      description: "Collects, validates and submits assigned project ESG data.",
    })
    .returning();
  if (!role) throw new Error("Unable to create demo role");

  const [user] = await db
    .insert(usersTable)
    .values({
      organizationId: organization.id,
      email: "coordinator@demo.meil-esg360.test",
      displayName: "Priya Nair",
      passwordHash: hashPassword("Demo!123"),
    })
    .returning();
  if (!user) throw new Error("Unable to create demo user");
  await db.insert(userRolesTable).values({ userId: user.id, roleId: role.id });

  const metricRows = await db
    .insert(esgMetricsTable)
    .values([
      {
        code: "ENV-ENERGY-ELECTRICITY",
        name: "Electricity consumption",
        description: "Purchased and generated electricity used during the reporting period.",
        dimension: "ENVIRONMENTAL",
        category: "Energy",
        unit: "MWh",
        requiredEvidence: true,
        validationRules: { min: 0 },
      },
      {
        code: "ENV-WATER-CONSUMPTION",
        name: "Water consumption",
        description: "Water consumed across the project boundary.",
        dimension: "ENVIRONMENTAL",
        category: "Water",
        unit: "m³",
        requiredEvidence: false,
        validationRules: { min: 0 },
      },
      {
        code: "SOC-WORKFORCE-TOTAL",
        name: "Total workforce",
        description: "Total permanent and non-permanent workers within the project boundary.",
        dimension: "SOCIAL",
        category: "Workforce",
        unit: "people",
        requiredEvidence: true,
        validationRules: { min: 0, integer: true },
      },
      {
        code: "ENV-WASTE-GENERATED",
        name: "Waste generated",
        description: "Total waste generated and recorded for the reporting period.",
        dimension: "ENVIRONMENTAL",
        category: "Waste",
        unit: "tonnes",
        requiredEvidence: true,
        validationRules: { min: 0 },
      },
    ])
    .returning();

  const questionRows = await db
    .insert(brsrQuestionsTable)
    .values([
      {
        frameworkVersion: "2024",
        section: "A",
        questionCode: "A-01",
        questionText: "Details of the listed entity and reporting boundary",
        requirementType: "ESSENTIAL",
      },
      {
        frameworkVersion: "2024",
        section: "C",
        principleCode: "P6",
        questionCode: "C-P6-01",
        questionText: "Energy and emissions management across operations",
        requirementType: "ESSENTIAL",
      },
      {
        frameworkVersion: "2024",
        section: "C",
        principleCode: "P3",
        questionCode: "C-P3-01",
        questionText: "Employee and worker well-being",
        requirementType: "ESSENTIAL",
      },
    ])
    .returning();

  const energy = metricRows.find((metric) => metric.code === "ENV-ENERGY-ELECTRICITY");
  const water = metricRows.find((metric) => metric.code === "ENV-WATER-CONSUMPTION");
  const workforce = metricRows.find((metric) => metric.code === "SOC-WORKFORCE-TOTAL");
  const p6 = questionRows.find((question) => question.questionCode === "C-P6-01");
  const p3 = questionRows.find((question) => question.questionCode === "C-P3-01");
  if (energy && p6) await db.insert(metricBrsrMappingsTable).values({ metricId: energy.id, questionId: p6.id });
  if (water && p6) await db.insert(metricBrsrMappingsTable).values({ metricId: water.id, questionId: p6.id });
  if (workforce && p3) await db.insert(metricBrsrMappingsTable).values({ metricId: workforce.id, questionId: p3.id });

  const solar = projects[0];
  if (solar && energy && water && workforce) {
    await db.insert(metricValuesTable).values([
      {
        metricId: energy.id,
        reportingPeriodId: period.id,
        projectId: solar.id,
        entityId: entity.id,
        value: "12480",
        unit: "MWh",
        status: "APPROVED",
        validationStatus: "PASSED",
        submittedBy: user.id,
        submittedAt: new Date("2026-05-12T09:00:00Z"),
        approvedBy: user.id,
        approvedAt: new Date("2026-05-14T10:00:00Z"),
      },
      {
        metricId: water.id,
        reportingPeriodId: period.id,
        projectId: solar.id,
        entityId: entity.id,
        value: "1880",
        unit: "m³",
        status: "SUBMITTED",
        validationStatus: "PASSED",
        submittedBy: user.id,
        submittedAt: new Date("2026-05-15T09:00:00Z"),
      },
      {
        metricId: workforce.id,
        reportingPeriodId: period.id,
        projectId: solar.id,
        entityId: entity.id,
        value: "342",
        unit: "people",
        status: "DRAFT",
        validationStatus: "PENDING",
      },
    ]);
  }

  await db.insert(auditLogsTable).values({
    organizationId: organization.id,
    actorUserId: user.id,
    action: "DEMO_DATA_INITIALIZED",
    entityType: "organization",
    entityId: organization.id,
    after: { label: "FY 2025-26", demo: true },
    reason: "Initial demo data seed",
  });
}