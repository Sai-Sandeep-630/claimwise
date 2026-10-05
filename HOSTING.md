# Free-tier setup: GitHub + Netlify + Supabase

This version uses Netlify for the Next.js frontend/backend and Supabase PostgreSQL for persistent data. There is no SQLite file or paid disk requirement. Hosting/database free tiers have quotas and availability limits. The AI workflow uses Groq, which offers a rate-limited free plan. Check your account limits before review.

## 1. Create the Supabase database

1. Sign in at https://supabase.com and create a project on the Free plan.
2. Choose a project name, region and database password. Wait for setup to finish.
3. Open **SQL Editor → New query**.
4. Open the included `supabase/schema.sql` file in your editor, copy its complete contents into the SQL editor, and run it.
5. The script creates `claimwise_workspaces` and an atomic save function. It enables row-level security and denies browser roles access. Do not disable these protections.
6. Copy your **Project URL**, such as `https://abcdef.supabase.co`.
7. In **Settings → API Keys**, copy a **secret key** (normally `sb_secret_...`). This app uses it only in server code. Do not use the publishable/anon key. A legacy `service_role` key is also supported, but new secret keys are preferred.
8. Ensure the project's Data API is enabled; this app connects through its REST API.

You do not need to create Supabase Auth users. The application has a demo reviewer password and a signed session cookie. Everyone using that password shares one demo workspace.

## 2. Upload the project to GitHub

Extract this ZIP. The folder containing `package.json`, `README.md` and `netlify.toml` is the project root.

Create a new empty GitHub repository. Using Git from that folder:

```sh
git init
git add .
git commit -m "Build expense review assistant"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Replace the repository URL. You may instead use GitHub's **Add file → Upload files**, but upload the extracted contents, not the ZIP itself, and include `.env.example` and `.gitignore`. Make sure `package.json` is at the repository root rather than inside an extra nested directory.

Keep the repository public for easy evaluator access, or explicitly grant access if you choose private. The source includes the requested repository documents but no private assignment text. Never upload populated `.env.local` files, API keys, passwords or tokens. Do not put the demo password in your public README.

## 3. Import the repository into Netlify

1. Sign in at https://app.netlify.com and select the Free plan.
2. Choose **Add new project / Import an existing project**, then **GitHub**.
3. Authorize access to the relevant repository and select it.
4. Use these build settings (also supplied by `netlify.toml`):

| Setting | Value |
|---|---|
| Base directory | Leave blank if the project is at the repo root |
| Build command | `npm run build` |
| Publish directory | `.next` |
| Node version | `24` |

Netlify detects Next.js and supplies the appropriate adapter. Do not use static export, drag-and-drop hosting, the old Render instructions, or a Docker runtime for this version.

## 4. Add environment variables

In Netlify's project environment-variable settings, add the following for the production deployment, ensuring they are available to **Functions/runtime** (the default all-scopes option is fine). Keep values out of `netlify.toml`.

| Name | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_SECRET_KEY` | Your server-only Supabase secret key |
| `GROQ_API_KEY` | Your Groq API key |
| `GROQ_MODEL` | `openai/gpt-oss-20b` |
| `REVIEWER_PASSWORD` | A unique demo-only password of at least 12 characters |
| `SESSION_SECRET` | A random secret of at least 32 characters |
| `APP_URL` | Exact production URL, e.g. `https://your-project.netlify.app` |

To generate `SESSION_SECRET` locally:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

If Netlify assigns the URL only after the first deployment, set `APP_URL` after it appears and **redeploy**. Include `https://` and omit a trailing slash. A custom-domain change also requires updating this variable. Use the production URL to test; preview URLs intentionally fail the origin check while `APP_URL` points to production.

## 5. Deploy and check reviewer access

1. Trigger a production deployment. Check the build log if it fails.
2. Open the Netlify URL and enter your demo reviewer password.
3. Click **Explore sample claims** to populate the initially empty database.
4. Run **AI review** on a claim; inspect its summary and expand a policy citation.
5. Exercise a duplicate, missing receipt, exceeded limit and unsupported currency.
6. Request clarification, update the claim information, rerun AI review and make a decision with a reason.
7. Override a category and confirm the old review remains in history.
8. Refresh the page and redeploy once to confirm data stays in Supabase.
9. Open the URL in an incognito browser. Ensure a reviewer can reach the app login without your Netlify account. If Netlify-level access protection is enabled, configure access for the reviewer or make that project accessible; the app's own password still protects its data.

Submit the GitHub URL, Netlify URL and demo reviewer password in the private remarks. Never submit your Groq key, Supabase secret key or session secret. No username is required for the demo login.

## Local development (optional)

Install Node 24 and run:

```sh
npm ci
```

Copy `.env.example` to `.env.local` (`Copy-Item .env.example .env.local` in Windows PowerShell, or `cp .env.example .env.local` on macOS/Linux). Populate the same variables, but use `APP_URL=http://localhost:3000`. You still need to run the SQL setup in Supabase.

```sh
npm test
npm run build
npm run test:integration
npm start
```

Open http://localhost:3000. For development use `npm run dev`. The automated tests use a local test database and mocked provider; they do not require your real service credentials.

## Free-tier and review-period limitations

- Netlify free projects can pause when the account's monthly usage limits are exhausted. Check usage before and during evaluation.
- Supabase may pause low-activity free projects after seven days. Check the dashboard and restore the project if necessary before review. No uptime guarantee is implied by using free tiers.
- Groq free-plan quotas apply. The app performs two model calls per review; monitor token and request limits in your Groq console.
- The app uses a shared demo password and sample expenses. It is not an organization-wide production authentication system.

## Troubleshooting

- **Database setup incomplete:** set both Supabase variables and redeploy.
- **Database unavailable:** confirm the project is active, run the SQL file, enable the Data API, and check that the secret key belongs to that project. Server logs include the upstream HTTP status without exposing the key.
- **Invalid origin / login redirects to the wrong URL:** set `APP_URL` to the current production URL and redeploy.
- **Login unavailable:** check the password and secret minimum lengths.
- **Live AI setup pending:** add `GROQ_API_KEY` and redeploy.
- **AI provider failed / timeout:** check quota, model access and provider status, then retry. The app never substitutes a fake review.
- **Conflict:** another request changed the workspace. Reload and retry.
- **Module or build errors:** confirm Node 24, the included `package-lock.json`, and the correct repository root. Do not mix this version with the earlier SQLite/Render files.

Official references checked for this version:
- https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/
- https://docs.netlify.com/build/functions/configuration/
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/platform/free-project-pausing

- https://console.groq.com/docs/structured-outputs
- https://console.groq.com/docs/rate-limits
