# Architecture

The repository is a pnpm workspace with four relevant layers:

- `artifacts/mockup-sandbox`: the existing Vite/React artifact, now used as the MEIL ESG360 web application while retaining component-preview routing.
- `artifacts/api-server`: Express 5 API. Routes are split between the original baseline ESG routes and `routes/product.ts` for the end-to-end product journey.
- `lib/db`: Drizzle PostgreSQL schema and database client.
- `lib/api-spec`, `lib/api-zod`, `lib/api-client-react`: contract-first baseline API types. The new product routes are intentionally kept in the existing API package until their contract is promoted into OpenAPI.

All product mutations run on the server and create audit entries. Evidence bytes are written to a storage-path abstraction (`uploads/`) while only metadata and a SHA-256 checksum are kept in PostgreSQL. Report generation creates a checksum over the exact source dataset so a draft can be reproduced.

## State model

Metric values distinguish `DRAFT`, `SUBMITTED`, `RETURNED`, `APPROVED`, and `CONSOLIDATED`. Validation is independent (`PENDING`, `PASSED`, `ERROR`). Reporting periods carry an explicit boundary and lock state. Approved project values are never overwritten during consolidation; group-level values are separate records.

## Intentional boundary

The existing repo did not contain object-storage, mail, SSO/MFA, AI, or job infrastructure. The functional core is implemented without pretending those integrations exist. They should be added behind service interfaces in follow-up work.