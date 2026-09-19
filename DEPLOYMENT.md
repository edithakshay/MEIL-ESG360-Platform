# Deployment

Required environment:

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: long random value used for signed cookies

Development:

```bash
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/mockup-sandbox run dev
```

Build:

```bash
pnpm run build
```

The API artifact uses its configured managed port and health endpoint `/api/healthz`. The web artifact is served through its configured preview path and calls the API through `/api`, not a hard-coded localhost URL.