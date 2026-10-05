# Claimwise — Expense review workspace

A runnable full-stack application for reviewing employee expenses using deterministic checks, AI policy evidence, and human decisions.

**Start here:** [HOSTING.md](HOSTING.md) contains local setup, GitHub upload, Netlify/Supabase hosting, environment configuration and the reviewer walkthrough.

## Technology

React + Next.js App Router, TypeScript, Node.js 24, Supabase PostgreSQL, Groq Chat Completions API, Tailwind CSS, and Lucide icons. This Netlify-ready export does not require ChatGPT sign-in or any plugin.

## Quick start

```sh
npm ci
# Copy .env.example to .env.local and populate it; see HOSTING.md.
npm test
npm run build
npm run test:integration
npm start
```

Open http://localhost:3000 and enter the demo reviewer password you configured. Use `npm run dev` for development. Run `supabase/schema.sql` once in your Supabase SQL Editor before first use. The Groq API key stays server-side. The default model is `openai/gpt-oss-20b`, hosted by Groq; no OpenAI key is required. Groq free-plan quotas apply.

## Architecture

- `app/Dashboard.tsx`: claims inbox, new-claim form, detailed policy review, human actions and audit history.
- `app/login/page.tsx`, `app/api/login`, `lib/auth.ts`, `lib/session.ts`: demo-password authentication with signed, expiring, HTTP-only cookies. No client-provided identity headers are trusted.
- `app/api/workspace/route.ts`: authenticated reads and mutations. Browser writes are checked against `APP_URL`.
- `lib/core.ts`: sample policy, input validation, exact duplicate signals, integer-cent totals and decision rules.
- `lib/ai.ts`: classification, metadata-based policy retrieval, structured policy review and citation validation.
- `lib/storage.ts`: server-only Supabase REST calls; a PostgreSQL RPC checks the revision and atomically rejects stale writes.
- `tests/`: rule, provider-contract, session and persistence tests.

For this small demonstration, claims and their append-only histories are stored together in one JSON document per workspace. This makes a decision and its audit event atomic. The demo has one shared reviewer account and supports at most 100 claims. A production design should normalize records and provide named users, role separation, indexed querying and audit retention.

### Review sequence

1. Submit an expense; code validates dates, required fields, supported currency and amount precision.
2. Code flags potential duplicates, missing receipts and category-limit exceptions, and calculates totals separately by currency.
3. On request, the first LLM call classifies the description and marks ambiguity. Declared or manually overridden categories remain authoritative; disagreements are flagged.
4. The server retrieves the matching category section plus common policy rules. This small policy uses exact section metadata, not a vector database.
5. A second LLM call produces an advisory explanation, findings, section IDs and clarification questions using strict JSON schema.
6. The server verifies cited section IDs against the retrieved policy and prevents a flagged claim from being labelled `may_comply`. The UI displays canonical evidence text. Citation existence checks do not prove that every model inference is correct.
7. A human approves, rejects, requests clarification or overrides classification with a reason. Approval requires a saved AI review. Missing credentials or provider errors never create simulated reviews.

Information updates and overrides invalidate the current review while preserving it in history. Closed claims must be explicitly reopened before further edits. A later human decision may resolve policy warnings, with a reason and check snapshot recorded. No money is transferred.

## Sample policy

No organizational policy was supplied. The app clearly labels its eight-section policy as illustrative. Replace `POLICY` in `lib/core.ts`, keep prose and numeric rules consistent, bump its version, and redeploy to substitute a real policy.

| Category | Sample INR limit per claim |
|---|---:|
| Meals | 1,000 |
| Travel | 5,000 |
| Lodging | 6,000 |
| Office supplies | 2,500 |
| Other | No configured limit; human review |

Receipts are required for all claims. Availability is a declaration; there is no file upload or OCR. USD, EUR and GBP are accepted but no exchange-rate conversion or non-INR limit check is performed. Totals are accumulated in integer minor units and remain separate per currency.

Potential duplicates share normalized claimant, expense date, amount and currency. They are flagged without deletion; legitimate separate transactions may match. Valid input dates run from 2000 through today in Asia/Kolkata. The year-2000 lower bound is an input boundary, not an employer rule. Meals need attendees; travel needs a route; lodging needs stay dates. The AI asks for missing details.

## API and persistence

`GET /api/workspace` returns the current workspace, revision, sample policy, and AI configuration status. `POST /api/workspace` takes `action`, `revision` and action-specific fields. Supported actions are `create`, `seed`, `review`, `approve`, `reject`, `clarify`, `override`, `amend`, and `reopen`.

The server commits the complete mutation only if its revision matches. Stale operations return HTTP 409 without overwriting newer decisions. All authentication checks are server-side. Supabase stores the data independently of Netlify functions, so function restarts and redeployments do not erase claims. No writable application disk is required.

The initial schema and revision-checked save function are in `supabase/schema.sql`. Run the file in the Supabase SQL Editor. Tables have RLS enabled and deny access to browser roles. Only the server secret role has grants. Future schema changes need deliberate migrations.

## Configuration

See `.env.example` for all names and `HOSTING.md` for instructions. Never commit populated environment files. `GROQ_API_KEY`, `SUPABASE_SECRET_KEY` and `SESSION_SECRET` are server-only secrets. `REVIEWER_PASSWORD` is a demo-only login credential to share privately with reviewers. Changing `SESSION_SECRET` invalidates existing sessions.

## Logging and error states

Structured JSON application logs include request IDs, action/stage, model, provider status, revision and elapsed time. They exclude claim text, claimant identities, raw prompts, provider response bodies and credentials. Login logs identify success/failure without recording passwords. The frontend has loading, empty, validation, success, unavailable-AI, provider/database failure and stale-write states.

## Tests

```sh
npm test
npm run typecheck
npm run build
npm run test:integration
```

Tests cover calendar validation, required fields, money precision, limit boundaries, receipts, duplicates, currency totals, approval gates, classification overrides, policy retrieval, citation validation, mocked two-stage AI success/failure, cookie tampering/expiration, and PostgreSQL revision checks and role permissions using PGlite, plus REST adapter contracts. Mocked provider tests do not prove live AI functionality. Run the live reviewer walkthrough after setting an API key.

## Completed and excluded scope

Implemented: usable responsive UI, persistent claim submission, deterministic policy checks, live-provider integration, evidence citations, uncertainty and clarification questions, human decisions, category overrides, clarification updates, historical reviews, structured logs, tests, Netlify configuration and Supabase schema.

Excluded: payments, payroll, tax calculations, receipt uploads/OCR, currency conversion, email delivery, policy-upload ingestion, editable policy UI, production user management, separate employee/reviewer accounts and tamper-proof external audit storage. The login and AI throttles are best effort and not production-grade distributed abuse protection; serverless instances do not share the in-memory login throttle. Prior policy versions must be retained in Git; historical exact policy text is not snapshotted into every review.

## Deployment status and limits

This is a standalone export for your own repository and hosting account. It has not been deployed to your Netlify/Supabase accounts. See `VERIFICATION.md` for the checks actually run on this export. Browser visual QA and real-provider verification remain required. Do not describe it as fully verified until the walkthrough passes with live AI and persisted data. Use only synthetic expenses in the shared demo workspace.

Add your live Netlify URL and mention that reviewers receive the demo password through private submission remarks.
