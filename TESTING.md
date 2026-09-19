# Testing

The repository currently has no automated test suite. The minimum verification for the delivered core is:

```bash
pnpm run typecheck
pnpm run build
```

The highest-value next tests are API integration tests for tenant isolation, evidence upload validation, locked periods, role-gated approval, consolidation idempotency, and reproducible report checksums, plus a browser test for the coordinator → reviewer journey.