# API

The API is mounted at `/api` and uses signed HTTP-only session cookies.

Baseline contract routes include:

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/dashboard`, `/api/projects`, `/api/metrics`, `/api/metric-values`
- `POST /api/metric-values`, `POST /api/metric-values/:id/submit`, `POST /api/metric-values/:id/approve`
- `GET /api/brsr/readiness`, `GET /api/audit`

Product journey routes include:

- `GET /api/reporting-periods`, `GET|POST /api/evidence`
- `GET /api/workflow/pending`, `POST /api/metric-values/:id/return`
- `POST /api/consolidation/run`, `GET /api/lineage/:metricValueId`
- `GET|POST /api/brsr/workspace`, `/api/brsr/responses`
- `POST /api/reports/generate`, `GET /api/notifications`

All authenticated queries are tenant-filtered where the related organization is available. Reviewer actions require a reviewer, approver, ESG admin/head, or super-admin role.