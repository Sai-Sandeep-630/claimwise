# Verification — Netlify/Supabase edition

Verified on 2026-10-05 using Node 24:

- Dependency installation and lockfile: passed.
- 16 Node tests: passed. Includes deterministic rules, mocked AI stages, session validation, REST adapter error handling, and actual PostgreSQL schema/RPC execution using PGlite.
- SQL checks: stale revisions rejected, initial insert cannot overwrite an existing workspace, invalid data rejected, browser roles denied table/function privileges.
- TypeScript checking: passed.
- Next.js production build: passed.
- Production HTTP integration: passed for authentication, sample creation, revision conflicts, missing-AI status, approval gate, cross-origin rejection, clarification, amendment, rejection, reopening and persistence across application restart. This uses a local REST gateway backed by the actual PostgreSQL schema; it is not a hosted Supabase test.

Not yet verified: hosted Supabase connectivity, Netlify deployment/adapter execution, browser visual QA, and a real OpenAI model response. These require the user's configured accounts and credentials. Follow HOSTING.md before submission.

There are no real credentials or claimant records in the package. Automated integration checks generate temporary secrets and synthetic data. Tests do not establish a production-grade authentication or audit system.
