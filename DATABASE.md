# Database

The source-of-truth schema is `lib/db/src/schema/index.ts`. The current normalized core includes organizations, entities, business units, projects, sites, users, roles, scoped role assignments, sessions, reporting periods, metrics, metric values, evidence metadata, BRSR questions/responses/mappings, workflow tasks, audit logs, consolidation runs, reports, and notifications.

Use `pnpm --filter @workspace/db run push` only against a development database. Production schema changes should be reviewed and migrated through the deployment process.

The first API start seeds data only when no organization exists. Seed values are deliberately demo data and must not be treated as MEIL regulatory facts.