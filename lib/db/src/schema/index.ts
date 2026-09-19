import { randomUUID } from "node:crypto";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => randomUUID());
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const organizationsTable = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const entitiesTable = pgTable("legal_entities", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizationsTable.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  country: text("country").notNull().default("India"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const businessUnitsTable = pgTable("business_units", {
  id: id(),
  entityId: text("entity_id")
    .notNull()
    .references(() => entitiesTable.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const projectsTable = pgTable("projects", {
  id: id(),
  businessUnitId: text("business_unit_id")
    .notNull()
    .references(() => businessUnitsTable.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  state: text("state").notNull(),
  city: text("city").notNull(),
  projectType: text("project_type").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  responsiblePerson: text("responsible_person").notNull(),
  esgCoordinator: text("esg_coordinator").notNull(),
  attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sitesTable = pgTable("sites", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .references(() => projectsTable.id),
  name: text("name").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const rolesTable = pgTable("roles", {
  id: id(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  createdAt: createdAt(),
});

export const usersTable = pgTable("users", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizationsTable.id),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const userRolesTable = pgTable("user_roles", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  roleId: text("role_id")
    .notNull()
    .references(() => rolesTable.id),
  scopeType: text("scope_type").notNull().default("ORGANIZATION"),
  scopeId: text("scope_id"),
  createdAt: createdAt(),
});

export const sessionsTable = pgTable("auth_sessions", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const reportingPeriodsTable = pgTable("reporting_periods", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizationsTable.id),
  label: text("label").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("OPEN"),
  boundary: text("boundary").notNull().default("CONSOLIDATED"),
  submissionDeadline: date("submission_deadline", { mode: "string" }),
  locked: boolean("locked").notNull().default(false),
  lockedBy: text("locked_by"),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const reportingBoundariesTable = pgTable("reporting_boundaries", {
  id: id(),
  reportingPeriodId: text("reporting_period_id")
    .notNull()
    .references(() => reportingPeriodsTable.id),
  boundary: text("boundary").notNull(),
  includedEntities: jsonb("included_entities").$type<string[]>().notNull().default([]),
  excludedEntities: jsonb("excluded_entities").$type<string[]>().notNull().default([]),
  reason: text("reason"),
  status: text("status").notNull().default("DRAFT"),
  approvedBy: text("approved_by").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const esgMetricsTable = pgTable("esg_metrics", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  dimension: text("dimension").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  frequency: text("frequency").notNull().default("ANNUAL"),
  indicatorType: text("indicator_type").notNull().default("ESSENTIAL"),
  requiredEvidence: boolean("required_evidence").notNull().default(false),
  active: boolean("active").notNull().default(true),
  version: integer("version").notNull().default(1),
  validationRules: jsonb("validation_rules")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const metricValuesTable = pgTable("metric_values", {
  id: id(),
  metricId: text("metric_id")
    .notNull()
    .references(() => esgMetricsTable.id),
  reportingPeriodId: text("reporting_period_id")
    .notNull()
    .references(() => reportingPeriodsTable.id),
  projectId: text("project_id").references(() => projectsTable.id),
  entityId: text("entity_id").references(() => entitiesTable.id),
  value: numeric("value", { precision: 18, scale: 4 }),
  textValue: text("text_value"),
  unit: text("unit").notNull(),
  applicability: text("applicability").notNull().default("APPLICABLE"),
  notApplicableReason: text("not_applicable_reason"),
  status: text("status").notNull().default("DRAFT"),
  validationStatus: text("validation_status").notNull().default("PENDING"),
  validationMessage: text("validation_message"),
  submittedBy: text("submitted_by").references(() => usersTable.id),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedBy: text("approved_by").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const evidenceTable = pgTable("evidence", {
  id: id(),
  fileName: text("file_name").notNull(),
  evidenceType: text("evidence_type").notNull(),
  storagePath: text("storage_path").notNull(),
  checksum: text("checksum"),
  reportingPeriodId: text("reporting_period_id").references(
    () => reportingPeriodsTable.id,
  ),
  projectId: text("project_id").references(() => projectsTable.id),
  metricValueId: text("metric_value_id").references(() => metricValuesTable.id),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => usersTable.id),
  status: text("status").notNull().default("PENDING_REVIEW"),
  comments: text("comments"),
  expiresAt: date("expires_at", { mode: "string" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const brsrQuestionsTable = pgTable("brsr_questions", {
  id: id(),
  framework: text("framework").notNull().default("BRSR"),
  frameworkVersion: text("framework_version").notNull(),
  section: text("section").notNull(),
  principleCode: text("principle_code"),
  questionCode: text("question_code").notNull().unique(),
  questionText: text("question_text").notNull(),
  requirementType: text("requirement_type").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const brsrResponsesTable = pgTable("brsr_responses", {
  id: id(),
  questionId: text("question_id")
    .notNull()
    .references(() => brsrQuestionsTable.id),
  reportingPeriodId: text("reporting_period_id")
    .notNull()
    .references(() => reportingPeriodsTable.id),
  response: text("response"),
  status: text("status").notNull().default("INCOMPLETE"),
  evidenceStatus: text("evidence_status").notNull().default("MISSING"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const metricBrsrMappingsTable = pgTable("metric_brsr_mappings", {
  id: id(),
  metricId: text("metric_id")
    .notNull()
    .references(() => esgMetricsTable.id),
  questionId: text("question_id")
    .notNull()
    .references(() => brsrQuestionsTable.id),
  createdAt: createdAt(),
});

export const brsrPrinciplesTable = pgTable("brsr_principles", {
  id: id(),
  frameworkVersion: text("framework_version").notNull(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const brsrCoreMetricsTable = pgTable("brsr_core_metrics", {
  id: id(),
  frameworkVersion: text("framework_version").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  unit: text("unit").notNull(),
  methodology: text("methodology"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const brsrCoreResponsesTable = pgTable("brsr_core_responses", {
  id: id(),
  metricId: text("metric_id")
    .notNull()
    .references(() => brsrCoreMetricsTable.id),
  reportingPeriodId: text("reporting_period_id")
    .notNull()
    .references(() => reportingPeriodsTable.id),
  value: numeric("value", { precision: 18, scale: 4 }),
  textValue: text("text_value"),
  unit: text("unit").notNull(),
  dataSource: text("data_source"),
  evidenceId: text("evidence_id").references(() => evidenceTable.id),
  assuranceStatus: text("assurance_status").notNull().default("NOT_STARTED"),
  assuranceProvider: text("assurance_provider"),
  observation: text("observation"),
  status: text("status").notNull().default("DRAFT"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const policiesTable = pgTable("policies", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizationsTable.id),
  name: text("name").notNull(),
  owner: text("owner"),
  version: text("version").notNull().default("1.0"),
  status: text("status").notNull().default("DRAFT"),
  effectiveDate: date("effective_date", { mode: "string" }),
  reviewDate: date("review_date", { mode: "string" }),
  documentEvidenceId: text("document_evidence_id").references(() => evidenceTable.id),
  valueChainApplicable: boolean("value_chain_applicable").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const policyPrincipleMappingsTable = pgTable("policy_principle_mappings", {
  id: id(),
  policyId: text("policy_id")
    .notNull()
    .references(() => policiesTable.id),
  principleId: text("principle_id")
    .notNull()
    .references(() => brsrPrinciplesTable.id),
  createdAt: createdAt(),
});

export const crossReferencesTable = pgTable("brsr_cross_references", {
  id: id(),
  questionId: text("question_id")
    .notNull()
    .references(() => brsrQuestionsTable.id),
  reportingPeriodId: text("reporting_period_id")
    .notNull()
    .references(() => reportingPeriodsTable.id),
  sourceFramework: text("source_framework").notNull(),
  sourceDocument: text("source_document").notNull(),
  pageNumber: integer("page_number"),
  section: text("section"),
  referenceUrl: text("reference_url"),
  notes: text("notes"),
  verificationStatus: text("verification_status").notNull().default("PENDING"),
  createdAt: createdAt(),
});

export const sdgsTable = pgTable("sdgs", {
  id: id(),
  number: integer("number").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const sdgTargetsTable = pgTable("sdg_targets", {
  id: id(),
  sdgId: text("sdg_id")
    .notNull()
    .references(() => sdgsTable.id),
  code: text("code").notNull(),
  title: text("title").notNull(),
  createdAt: createdAt(),
});

export const metricSdgMappingsTable = pgTable("metric_sdg_mappings", {
  id: id(),
  metricId: text("metric_id")
    .notNull()
    .references(() => esgMetricsTable.id),
  sdgId: text("sdg_id")
    .notNull()
    .references(() => sdgsTable.id),
  sdgTargetId: text("sdg_target_id").references(() => sdgTargetsTable.id),
  mappingSource: text("mapping_source").notNull().default("ADMIN_CONFIGURED"),
  createdAt: createdAt(),
});

export const esgTargetsTable = pgTable("esg_targets", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizationsTable.id),
  metricId: text("metric_id")
    .notNull()
    .references(() => esgMetricsTable.id),
  baselineYear: integer("baseline_year").notNull(),
  baselineValue: numeric("baseline_value", { precision: 18, scale: 4 }).notNull(),
  targetYear: integer("target_year").notNull(),
  targetValue: numeric("target_value", { precision: 18, scale: 4 }).notNull(),
  owner: text("owner"),
  entityId: text("entity_id").references(() => entitiesTable.id),
  projectId: text("project_id").references(() => projectsTable.id),
  status: text("status").notNull().default("DRAFT"),
  isSample: boolean("is_sample").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const targetProgressTable = pgTable("target_progress", {
  id: id(),
  targetId: text("target_id")
    .notNull()
    .references(() => esgTargetsTable.id),
  reportingPeriodId: text("reporting_period_id")
    .notNull()
    .references(() => reportingPeriodsTable.id),
  value: numeric("value", { precision: 18, scale: 4 }).notNull(),
  evidenceId: text("evidence_id").references(() => evidenceTable.id),
  recordedBy: text("recorded_by").references(() => usersTable.id),
  createdAt: createdAt(),
});

export const risksTable = pgTable("risks", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizationsTable.id),
  category: text("category").notNull(),
  description: text("description").notNull(),
  entityId: text("entity_id").references(() => entitiesTable.id),
  projectId: text("project_id").references(() => projectsTable.id),
  likelihood: integer("likelihood").notNull(),
  impact: integer("impact").notNull(),
  inherentRisk: integer("inherent_risk").notNull(),
  controls: text("controls"),
  mitigation: text("mitigation"),
  residualRisk: integer("residual_risk"),
  owner: text("owner"),
  dueDate: date("due_date", { mode: "string" }),
  status: text("status").notNull().default("OPEN"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const materialityAssessmentsTable = pgTable("materiality_assessments", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizationsTable.id),
  issue: text("issue").notNull(),
  stakeholder: text("stakeholder"),
  impact: integer("impact").notNull(),
  financialRelevance: integer("financial_relevance").notNull(),
  dimension: text("dimension").notNull(),
  status: text("status").notNull().default("DRAFT"),
  evidenceId: text("evidence_id").references(() => evidenceTable.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assuranceEngagementsTable = pgTable("assurance_engagements", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizationsTable.id),
  reportingPeriodId: text("reporting_period_id")
    .notNull()
    .references(() => reportingPeriodsTable.id),
  name: text("name").notNull(),
  provider: text("provider"),
  status: text("status").notNull().default("NOT_STARTED"),
  scope: jsonb("scope").$type<Record<string, unknown>>().notNull().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assuranceRequestsTable = pgTable("assurance_requests", {
  id: id(),
  engagementId: text("engagement_id")
    .notNull()
    .references(() => assuranceEngagementsTable.id),
  requestedBy: text("requested_by").references(() => usersTable.id),
  assignedTo: text("assigned_to").references(() => usersTable.id),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("OPEN"),
  response: text("response"),
  dueDate: date("due_date", { mode: "string" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assuranceFindingsTable = pgTable("assurance_findings", {
  id: id(),
  engagementId: text("engagement_id")
    .notNull()
    .references(() => assuranceEngagementsTable.id),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  managementResponse: text("management_response"),
  remediation: text("remediation"),
  status: text("status").notNull().default("OPEN"),
  dueDate: date("due_date", { mode: "string" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const workflowTasksTable = pgTable("workflow_tasks", {
  id: id(),
  metricValueId: text("metric_value_id")
    .notNull()
    .references(() => metricValuesTable.id),
  assignedTo: text("assigned_to").references(() => usersTable.id),
  status: text("status").notNull().default("PENDING_REVIEW"),
  comment: text("comment"),
  decision: text("decision"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizationsTable.id),
  actorUserId: text("actor_user_id").references(() => usersTable.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  before: jsonb("before").$type<unknown>(),
  after: jsonb("after").$type<unknown>(),
  reason: text("reason"),
  createdAt: createdAt(),
});

export const consolidationRunsTable = pgTable("consolidation_runs", {
  id: id(),
  reportingPeriodId: text("reporting_period_id")
    .notNull()
    .references(() => reportingPeriodsTable.id),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizationsTable.id),
  status: text("status").notNull().default("COMPLETED"),
  sourceCount: integer("source_count").notNull().default(0),
  metricCount: integer("metric_count").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const reportsTable = pgTable("reports", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizationsTable.id),
  reportingPeriodId: text("reporting_period_id")
    .notNull()
    .references(() => reportingPeriodsTable.id),
  reportType: text("report_type").notNull(),
  frameworkVersion: text("framework_version").notNull(),
  boundary: text("boundary").notNull(),
  status: text("status").notNull().default("DRAFT"),
  checksum: text("checksum"),
  generatedBy: text("generated_by").references(() => usersTable.id),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const reportVersionsTable = pgTable("report_versions", {
  id: id(),
  reportId: text("report_id")
    .notNull()
    .references(() => reportsTable.id),
  version: integer("version").notNull().default(1),
  dataset: jsonb("dataset").$type<Record<string, unknown>>().notNull(),
  checksum: text("checksum").notNull(),
  calculationVersions: jsonb("calculation_versions").$type<string[]>().notNull().default([]),
  evidenceReferences: jsonb("evidence_references").$type<string[]>().notNull().default([]),
  finalizedBy: text("finalized_by").references(() => usersTable.id),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  immutable: boolean("immutable").notNull().default(false),
  createdAt: createdAt(),
});

export const approvalsTable = pgTable("approvals", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizationsTable.id),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  reviewerId: text("reviewer_id")
    .notNull()
    .references(() => usersTable.id),
  decision: text("decision").notNull(),
  comment: text("comment"),
  createdAt: createdAt(),
});

export const notificationsTable = pgTable("notifications", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export type Organization = typeof organizationsTable.$inferSelect;
export type Entity = typeof entitiesTable.$inferSelect;
export type BusinessUnit = typeof businessUnitsTable.$inferSelect;
export type Project = typeof projectsTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type ReportingPeriod = typeof reportingPeriodsTable.$inferSelect;
export type EsgMetric = typeof esgMetricsTable.$inferSelect;
export type MetricValue = typeof metricValuesTable.$inferSelect;
export type Evidence = typeof evidenceTable.$inferSelect;
export type BrsrQuestion = typeof brsrQuestionsTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;