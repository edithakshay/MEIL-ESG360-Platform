# Security

- Passwords are hashed with Node `scrypt` and never stored in plaintext.
- Sessions use signed, HTTP-only, same-site cookies and expire after eight hours.
- The API validates login and metric input with Zod and checks reporting-period locks server-side.
- Evidence uploads use a filename allowlist, MIME allowlist, 10 MB limit, random storage names, and SHA-256 checksums.
- Approval, return, consolidation, and report-generation actions are role-gated.
- Tenant identifiers are checked for project and evidence reads/writes where applicable.
- Audit entries record important state transitions and report generation.

Before production use, add CSRF protection for cross-site mutation requests, a login rate limiter, password reset/MFA/SSO, malware scanning for evidence, object-storage access policies, and a production secrets rotation process.