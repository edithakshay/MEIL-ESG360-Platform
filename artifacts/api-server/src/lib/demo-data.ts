import { and, eq } from "drizzle-orm";
import {
  assuranceEngagementsTable,
  assuranceFindingsTable,
  brsrCoreMetricsTable,
  brsrPrinciplesTable,
  auditLogsTable,
  brsrQuestionsTable,
  businessUnitsTable,
  entitiesTable,
  esgTargetsTable,
  esgMetricsTable,
  metricBrsrMappingsTable,
  metricValuesTable,
  organizationsTable,
  policiesTable,
  projectsTable,
  reportingPeriodsTable,
  reportingBoundariesTable,
  risksTable,
  rolesTable,
  sdgTargetsTable,
  sdgsTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import { db } from "@workspace/db";
import { hashPassword } from "./auth";

export async function seedDemoData(): Promise<void> {
  const [existing] = await db.select({ id: organizationsTable.id }).from(organizationsTable).limit(1);
  if (existing) {
    await seedEnterpriseData(existing.id);
    return;
  }

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

  const [coordinatorRole, reviewerRole] = await db
    .insert(rolesTable)
    .values([
      {
        name: "Project ESG Coordinator",
        description: "Collects, validates and submits assigned project ESG data.",
      },
      {
        name: "Reviewer",
        description: "Reviews validated project data and records a traceable decision.",
      },
    ])
    .returning();
  if (!coordinatorRole || !reviewerRole) throw new Error("Unable to create demo roles");

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
  await db.insert(userRolesTable).values({ userId: user.id, roleId: coordinatorRole.id });
  const [reviewer] = await db
    .insert(usersTable)
    .values({
      organizationId: organization.id,
      email: "reviewer@demo.meil-esg360.test",
      displayName: "Arjun Rao",
      passwordHash: hashPassword("Demo!123"),
    })
    .returning();
  if (reviewer) await db.insert(userRolesTable).values({ userId: reviewer.id, roleId: reviewerRole.id });

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
  await seedEnterpriseData(organization.id);
}

async function seedEnterpriseData(organizationId: string): Promise<void> {
  const [period] = await db
    .select()
    .from(reportingPeriodsTable)
    .where(eq(reportingPeriodsTable.organizationId, organizationId))
    .limit(1);
  const [admin] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.organizationId, organizationId))
    .limit(1);
  if (!period || !admin) return;

  const principles = [
    ["P1", "Integrity, transparency and accountability", "Businesses should conduct and govern themselves with integrity."],
    ["P2", "Sustainable and safe goods and services", "Businesses should provide goods and services in a manner that is sustainable and safe."],
    ["P3", "Employee and worker well-being", "Businesses should respect and promote the well-being of all employees, including value chains."],
    ["P4", "Stakeholder responsiveness", "Businesses should respect the interests of and be responsive to all stakeholders."],
    ["P5", "Human rights", "Businesses should respect and promote human rights."],
    ["P6", "Environment protection", "Businesses should respect and make efforts to protect and restore the environment."],
    ["P7", "Responsible public policy", "Businesses should engage in public and regulatory policy responsibly and transparently."],
    ["P8", "Inclusive growth", "Businesses should promote inclusive growth and equitable development."],
    ["P9", "Responsible consumer value", "Businesses should engage with and provide value to consumers responsibly."],
  ] as const;
  const existingPrinciples = await db.select().from(brsrPrinciplesTable).where(eq(brsrPrinciplesTable.frameworkVersion, "2024"));
  if (!existingPrinciples.length) {
    await db.insert(brsrPrinciplesTable).values(principles.map(([code, title, description]) => ({
      frameworkVersion: "2024",
      code,
      title,
      description,
    })));
  }

  const coreMetrics = [
    ["CORE-GHG-01", "GHG footprint", "Scope 1 and Scope 2 greenhouse gas emissions reported for the boundary.", "tCO2e"],
    ["CORE-WATER-01", "Water consumption", "Water consumption for the reporting period.", "m³"],
    ["CORE-WASTE-01", "Waste generated", "Waste generated by type and disposal route.", "tonnes"],
    ["CORE-SAFETY-01", "Recordable work-related injuries", "Recordable injuries for employees and workers.", "count"],
  ] as const;
  const existingCore = await db.select().from(brsrCoreMetricsTable).where(eq(brsrCoreMetricsTable.frameworkVersion, "2024"));
  if (!existingCore.length) {
    await db.insert(brsrCoreMetricsTable).values(coreMetrics.map(([code, name, description, unit]) => ({
      frameworkVersion: "2024",
      code,
      name,
      description,
      unit,
      methodology: "Configured BRSR Core metric definition; source and methodology must be confirmed by the reporting team.",
    })));
  }

  const sdgNames = [
    "No Poverty", "Zero Hunger", "Good Health and Well-being", "Quality Education",
    "Gender Equality", "Clean Water and Sanitation", "Affordable and Clean Energy",
    "Decent Work and Economic Growth", "Industry, Innovation and Infrastructure",
    "Reduced Inequalities", "Sustainable Cities and Communities", "Responsible Consumption and Production",
    "Climate Action", "Life Below Water", "Life on Land", "Peace, Justice and Strong Institutions",
    "Partnerships for the Goals",
  ];
  const existingSdgs = await db.select().from(sdgsTable);
  if (!existingSdgs.length) {
    const seededSdgs = await db.insert(sdgsTable).values(sdgNames.map((name, index) => ({
      number: index + 1,
      name,
      description: `UN Sustainable Development Goal ${index + 1}: ${name}.`,
    }))).returning();
    const goal7 = seededSdgs.find((sdg) => sdg.number === 7);
    const goal6 = seededSdgs.find((sdg) => sdg.number === 6);
    if (goal7) await db.insert(sdgTargetsTable).values({ sdgId: goal7.id, code: "7.2", title: "Increase the share of renewable energy" });
    if (goal6) await db.insert(sdgTargetsTable).values({ sdgId: goal6.id, code: "6.4", title: "Improve water-use efficiency" });
  }

  const [boundary] = await db.select().from(reportingBoundariesTable).where(eq(reportingBoundariesTable.reportingPeriodId, period.id)).limit(1);
  if (!boundary) {
    await db.insert(reportingBoundariesTable).values({
      reportingPeriodId: period.id,
      boundary: period.boundary,
      reason: "Demo consolidated reporting boundary",
      status: "APPROVED",
      approvedBy: admin.id,
      approvedAt: new Date(),
    });
  }

  const [target] = await db.select().from(esgTargetsTable).where(eq(esgTargetsTable.organizationId, organizationId)).limit(1);
  const [energy] = await db.select().from(esgMetricsTable).where(eq(esgMetricsTable.code, "ENV-ENERGY-ELECTRICITY")).limit(1);
  if (!target && energy) {
    await db.insert(esgTargetsTable).values({
      organizationId,
      metricId: energy.id,
      baselineYear: 2025,
      baselineValue: "100",
      targetYear: 2030,
      targetValue: "80",
      owner: "Group ESG Head",
      status: "ACTIVE",
      isSample: true,
    });
  }

  const [risk] = await db.select().from(risksTable).where(eq(risksTable.organizationId, organizationId)).limit(1);
  const [project] = await db.select().from(projectsTable).limit(1);
  const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.organizationId, organizationId)).limit(1);
  if (!risk) {
    await db.insert(risksTable).values({
      organizationId,
      category: "Climate and resource availability",
      description: "Demo risk record requiring project-level energy and water evidence.",
      entityId: entity?.id,
      projectId: project?.id,
      likelihood: 3,
      impact: 4,
      inherentRisk: 12,
      controls: "Monthly utility review and project coordinator attestations.",
      mitigation: "Increase renewable sourcing and monitor water intensity.",
      residualRisk: 6,
      owner: "Group ESG Head",
      status: "OPEN",
    });
  }

  const [engagement] = await db.select().from(assuranceEngagementsTable).where(eq(assuranceEngagementsTable.organizationId, organizationId)).limit(1);
  if (!engagement) {
    const [created] = await db.insert(assuranceEngagementsTable).values({
      organizationId,
      reportingPeriodId: period.id,
      name: "FY 2025-26 demo readiness review",
      provider: "Demo assurance provider",
      status: "IN_PROGRESS",
      scope: { boundary: period.boundary, frameworkVersion: "2024", demo: true },
      startedAt: new Date(),
    }).returning();
    if (created) {
      await db.insert(assuranceFindingsTable).values({
        engagementId: created.id,
        severity: "MEDIUM",
        title: "Confirm evidence coverage for sampled energy values",
        description: "Sample finding for the assurance workspace; attach supporting evidence before finalization.",
        remediation: "Link source records and document reviewer response.",
        status: "OPEN",
      });
    }
  }

  const [policy] = await db.select().from(policiesTable).where(eq(policiesTable.organizationId, organizationId)).limit(1);
  if (!policy) {
    const [created] = await db.insert(policiesTable).values({
      organizationId,
      name: "Responsible Business and Sustainability Policy",
      owner: "Group ESG Head",
      version: "1.0",
      status: "ACTIVE",
      effectiveDate: "2025-04-01",
      reviewDate: "2026-03-31",
      valueChainApplicable: true,
    }).returning();
    const p6 = existingPrinciples.find((item) => item.code === "P6");
    if (created && p6) {
      await db.insert((await import("@workspace/db")).policyPrincipleMappingsTable).values({ policyId: created.id, principleId: p6.id });
    }
  }
}