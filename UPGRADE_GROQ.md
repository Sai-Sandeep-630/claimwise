# Update an existing deployment to Groq

1. Extract this ZIP to a temporary folder. Copy the contents of its `claimwise` folder into your existing local Git project folder, replacing matching files. Keep your existing `.git` folder and private `.env.local`. Do not upload the ZIP itself.
2. In that existing project folder run:

```sh
git add .
git commit -m "Switch AI reviews to Groq"
git push
```

3. In Netlify environment variables add `GROQ_API_KEY` with your private Groq key and `GROQ_MODEL` with `openai/gpt-oss-20b`. Keep the existing Supabase, reviewer-password, session-secret and APP_URL variables. Old OPENAI_API_KEY and OPENAI_MODEL variables are unused and can be removed.
4. Trigger a new production deployment after saving the variables. Open the app, sign in and run AI review on one sample claim. Check its policy citations and decision history.

No database migration is needed for this update. For local use, update `.env.local` to the new Groq variable names too. Do not send keys in chat or commit them. Free-plan quotas can cause temporary failures; retry later when the quota resets. See HOSTING.md for the complete setup.
