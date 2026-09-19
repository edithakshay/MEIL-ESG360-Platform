# MEIL ESG360

MEIL ESG360 is a tenant-aware ESG and BRSR reporting workspace for collecting, validating, reviewing, consolidating, and tracing sustainability data.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port supplied by the artifact workflow)
- `pnpm --filter @workspace/mockup-sandbox run dev` — run the ESG360 web workspace (port supplied by the artifact workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string; `SESSION_SECRET` — signed-session secret

Demo users after the first successful database seed:

- Coordinator: `coordinator@demo.meil-esg360.test` / `Demo!123`
- Reviewer: `reviewer@demo.meil-esg360.test` / `Demo!123`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/mockup-sandbox/src/App.tsx` — responsive ESG360 product shell and workflows
- `artifacts/mockup-sandbox/src/index.css` — product design system and responsive layout
- `artifacts/api-server/src/routes/esg.ts` — metric library, values, validation, submit/approve, BRSR readiness, audit
- `artifacts/api-server/src/routes/product.ts` — evidence upload, reviewer actions, consolidation, BRSR workspace, report snapshots, lineage
- `artifacts/api-server/src/lib/demo-data.ts` — idempotent first-run demo seed
- `lib/db/src/schema/index.ts` — Drizzle source-of-truth schema
- `lib/api-spec/openapi.yaml` — contract source for the generated baseline client

## Current product boundary

The delivered functional core covers the complete demo path through login, metric capture, validation, evidence upload, submission, role-gated review, consolidation, BRSR response updates, report dataset generation, and lineage inspection. External object storage, email delivery, SSO/MFA, AI extraction, and the full configurable regulatory/admin catalog remain integration work and are intentionally not represented as fake UI actions.

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
