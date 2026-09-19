# MEIL ESG360

MEIL ESG360 is an enterprise ESG and BRSR reporting workspace for a large infrastructure group. It keeps project data, evidence, approvals, reporting-period state, BRSR mappings, consolidation results, and audit history connected.

## Run locally

1. Provide a PostgreSQL `DATABASE_URL` and a strong `SESSION_SECRET` in the workspace environment.
2. Install dependencies with `pnpm install`.
3. Apply the development schema with `pnpm --filter @workspace/db run push`.
4. Start the managed API and web artifact services from Replit, or run:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/mockup-sandbox run dev
```

The first API start seeds a MEIL demo organization, a reporting period, projects, metrics, BRSR mappings, sample values, and coordinator/reviewer accounts.

## Demo journey

1. Sign in as the coordinator.
2. Open **ESG data**, record a value, and submit it.
3. Link evidence from the value card or the **Evidence** library.
4. Sign in as the reviewer in a separate session and approve or return the submission.
5. Use **Assurance & reports** to run consolidation/report generation and inspect lineage.
6. Use **BRSR reporting** to update a source-backed disclosure response.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DATABASE.md](DATABASE.md)
- [API.md](API.md)
- [SECURITY.md](SECURITY.md)
- [BRSR_IMPLEMENTATION.md](BRSR_IMPLEMENTATION.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
- [AI_GOVERNANCE.md](AI_GOVERNANCE.md)
- [TESTING.md](TESTING.md)