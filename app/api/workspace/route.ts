import { readWorkspace, saveWorkspace } from '@/lib/storage';
import { sameOrigin } from '@/lib/auth';
import { getReviewer } from '@/lib/auth';
import { POLICY, CATEGORIES, checks, newClaim, sampleClaims, applyDecision, event, validateClaim, type Workspace } from '@/lib/core';
import { runReview } from '@/lib/ai';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const settings = () => ({OPENAI_API_KEY:process.env.OPENAI_API_KEY,OPENAI_MODEL:process.env.OPENAI_MODEL});
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function identity() { const user = await getReviewer(); if (!user)
    throw new Error('AUTH_REQUIRED'); return user; }
export async function GET() { try {
    const user = await identity();
    const row = await readWorkspace(user.userId);
    return reply({ workspace: row ? row.data : { claims: [] }, revision: row?.revision ?? 0, policy: POLICY, aiConfigured: !!settings().OPENAI_API_KEY, actor: user.email ?? 'Reviewer' });
}
catch (e) {
    return failure(e);
} }
function failure(e: unknown, requestId?: string) { const message = e instanceof Error ? e.message : 'Unexpected error'; const status = message === 'AUTH_REQUIRED' ? 401 : message === 'CONFLICT' ? 409 : (message === 'AI_NOT_CONFIGURED' || message === 'DATABASE_NOT_CONFIGURED') ? 503 : message === 'NOT_FOUND' ? 404 : message.startsWith('INVALID:') ? 400 : 502; console.error(JSON.stringify({ event: 'request_failed', requestId, status, code: status === 502 ? 'BACKEND_ERROR' : message.slice(0, 80) })); return reply({ error: message === 'CONFLICT' ? 'This workspace changed in another session. Reload and try again.' : message === 'AUTH_REQUIRED' ? 'Please sign in to use this workspace.' : message === 'AI_NOT_CONFIGURED' ? 'Live AI is not configured. Add OPENAI_API_KEY securely to the deployment to enable reviews.' : message === 'DATABASE_NOT_CONFIGURED' ? 'Database setup is incomplete. Configure SUPABASE_URL and SUPABASE_SECRET_KEY on the server.' : message === 'NOT_FOUND' ? 'Claim not found.' : status === 400 ? message.slice(8) : 'The operation could not be completed. The AI provider or database may be unavailable. Retry shortly.', requestId }, status); }
export async function POST(request: Request) {
    const requestId = crypto.randomUUID(), start = Date.now();
    try {
        if (!sameOrigin(request))
            return reply({ error: 'Cross-origin writes are not allowed.' }, 403);
        const user = await identity();
        const raw = await request.text();
        if (raw.length > 16000)
            return reply({ error: 'Request is too large.' }, 413);
        let body: any;
        try {
            body = JSON.parse(raw);
        }
        catch {
            return reply({ error: 'Invalid JSON.' }, 400);
        }
        const row = await readWorkspace(user.userId);
        const revision = row?.revision ?? 0;
        if (body.revision !== revision)
            throw new Error('CONFLICT');
        const workspace: Workspace = row ? row.data : { claims: [] };
        const actor = user.email ?? user.userId;
        if (body.action === 'create') {
            if (workspace.claims.length >= 100)
                throw new Error('INVALID:This demo supports up to 100 claims.');
            try {
                workspace.claims.unshift(newClaim(body.claim, actor));
            }
            catch (e) {
                throw new Error('INVALID:' + (e as Error).message);
            }
        }
        else if (body.action === 'seed') {
            if (workspace.claims.length)
                throw new Error('INVALID:Sample data can only be added to an empty workspace.');
            workspace.claims = sampleClaims(actor);
        }
        else {
            const c = workspace.claims.find(x => x.id === body.id);
            if (!c)
                throw new Error('NOT_FOUND');
            if (body.action === 'review') {
                if (c.status === 'Approved' || c.status === 'Rejected')
                    throw new Error('INVALID:Reopen this claim before running another review.');
                if (!settings().OPENAI_API_KEY)
                    throw new Error('AI_NOT_CONFIGURED');
                const recent = c.history.filter(e => e.type === 'AI reviewed' && Date.now() - Date.parse(e.at) < 60000);
                if (recent.length >= 2)
                    throw new Error('INVALID:Wait one minute before reviewing this claim again.');
                const review = await runReview(c, workspace.claims, settings().OPENAI_API_KEY!, settings().OPENAI_MODEL || 'gpt-4.1-mini', requestId);
                c.review = review;
                c.history.push(event(actor, 'AI reviewed', 'Advisory review generated; human decision required.', { review, requestId }));
            }
            else if (body.action === 'amend') {
                if (c.status === 'Approved' || c.status === 'Rejected')
                    throw new Error('INVALID:Reopen this claim before adding information.');
                if (!body.reason?.trim() || body.reason.length > 2000)
                    throw new Error('INVALID:Explain what information changed.');
                const errors = validateClaim({ ...c, description: body.description, receipt: body.receipt });
                if (errors.length)
                    throw new Error('INVALID:' + errors.join(' '));
                c.history.push(event(actor, 'Information updated', body.reason, { previous: { description: c.description, receipt: c.receipt, review: c.review }, next: { description: body.description, receipt: body.receipt } }));
                c.description = body.description.trim();
                c.receipt = body.receipt;
                c.review = null;
                c.status = 'Pending';
            }
            else if (body.action === 'reopen') {
                if (!['Approved', 'Rejected'].includes(c.status))
                    throw new Error('INVALID:Only closed claims can be reopened.');
                if (!body.reason?.trim() || body.reason.length > 2000)
                    throw new Error('INVALID:Provide a reason to reopen.');
                c.history.push(event(actor, 'Reopened', body.reason, { previousStatus: c.status, previousReview: c.review }));
                c.status = 'Pending';
                c.review = null;
            }
            else {
                try {
                    applyDecision(c, body.action, body.reason, actor, body.category);
                    const last = c.history[c.history.length - 1];
                    last.details = { ...(last.details as Record<string, unknown> ?? {}), checks: checks(c, workspace.claims) };
                }
                catch (e) {
                    throw new Error('INVALID:' + (e as Error).message);
                }
            }
        }
        const saved = await saveWorkspace(user.userId, revision, workspace);
        if (!saved) throw new Error('CONFLICT');
        console.log(JSON.stringify({ event: 'workspace_mutation', requestId, action: body.action, claimId: body.id ?? null, revision: revision + 1, durationMs: Date.now() - start }));
        return reply({ workspace, revision: revision + 1 });
    }
    catch (e) {
        return failure(e, requestId);
    }
}
