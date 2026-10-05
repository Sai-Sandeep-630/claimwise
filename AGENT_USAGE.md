# Agent assistance record

## Tools and responsibility

Codex assisted with scoping, React UI, API logic, sample policy, AI integration, tests and documentation. The initial prototype used a hosted React/Vinext starter; this export was adapted to standard Next.js, Node 24 and SQLite so it can run independently. Shell commands, TypeScript, Node tests and SQLite were used for validation. Official OpenAI, Next.js and Render documentation informed API shape and hosting instructions. No subagents or delegated agent tasks were used.

The submission owner should review and understand every file. This record does not claim unaided authorship or independent human verification. Private assignment statements and evaluation material are not reproduced.

## Representative prompts (paraphrased)

- Build a small expense review application with a clearly labelled sample policy.
- Keep amounts, duplicate checks and configured limits deterministic; use AI for classification and evidence-based explanations.
- Require human decisions with reasons and preserve previous review history.
- Package the source with setup documentation and independent hosting instructions.

## Important decisions and rejected suggestions

- Used TypeScript for the API instead of the initially discussed Python backend, sharing types and validation with the React UI.
- Rejected fake AI reviews when credentials are missing. The interface reports unavailability and approval requires an actual saved review.
- Used exact metadata retrieval for eight policy sections instead of an unnecessary vector database.
- Used integer cents and separate currency totals instead of summing floating-point amounts across currencies.
- Used an atomic revision check to reject stale writes rather than overwriting concurrent decisions.
- Removed hosted identity-header dependencies from this export and replaced them with server-verified demo sessions.
- Included a persistent disk in hosting instructions instead of relying on an ephemeral filesystem.

## Mistakes caught and corrected

- Initial hosted identity code used the wrong property (`id` instead of `userId`); corrected after inspecting the helper.
- Type checking caught untyped JSON response use in the original frontend.
- Added an explicit `.env.example` exception to the environment-file ignore rule.
- Added a deterministic-check snapshot to decision history so later duplicate submissions do not obscure the checks present at decision time.
- The independent export required its own authentication, database adapter and deployment instructions; simply copying the hosted project would not have been enough.

## Verification

See `VERIFICATION.md` for export-specific results. Rule and AI-contract tests use a mocked provider. No live-provider success is claimed without configured API access. No browser visual QA is claimed. Credentials and temporary test databases are excluded from the repository package.

Export-specific checks also caught unused connector modules copied from the starter and a standalone-server start-command mismatch. Removed the unused modules and added explicit standalone asset packaging/start scripts. The sandbox blocks network-interface enumeration, so the integration test binds to an explicit loopback address rather than changing application behavior.

## Netlify/Supabase adaptation

The user selected GitHub and Netlify free-tier hosting. Replaced local SQLite storage with Supabase REST access and a PostgreSQL revision-checked RPC. Added RLS and explicit role grants, `netlify.toml`, a new environment template and Netlify-specific instructions. Removed Docker, Render and local-disk instructions from this package to avoid conflicting setup paths. Reduced each model-call timeout to 18 seconds so the two calls plus bounded database access fit within Netlify's documented synchronous limit.

New database tests execute the actual SQL with PGlite (PostgreSQL WASM), verify stale writes and restricted grants, and exercise the HTTP adapter with a local test gateway. This does not claim a successful hosted Supabase request or Netlify deployment. The demo login throttle is per process and is documented as best effort in a serverless environment.

## Groq migration

At the user's request for free-tier AI, Codex replaced the OpenAI Responses integration with Groq Chat Completions and the strict-schema-capable `openai/gpt-oss-20b` model. Representative prompt: switch the provider without weakening evidence validation or human approval. Updated server environment names, documentation and mocked provider tests. No work was delegated. Rejected the shortcut of merely placing a Groq key in the old OpenAI configuration: the endpoint and response contract differ. Verified the migration with unit tests, a production build and the local HTTP/database integration suite. A real Groq call still requires the user's private deployment configuration.
