import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateClaim, newClaim, checks, totals, applyDecision, sampleClaims, type AIReview } from '../lib/core.ts';
import { validateEvidence, retrievePolicy, runReview } from '../lib/ai.ts';
const base = { claimant: 'Test Employee', date: '2026-01-01', category: 'Meals', amount: 1000, currency: 'INR', description: 'Client workshop lunch with Asha and Ravi.', receipt: true };
const review: AIReview = { category: 'Meals', uncertain: false, summary: 'Advisory result.', assessment: 'may_comply', findings: [{ message: 'Receipt available.', sectionIds: ['P2'] }], questions: [], model: 'test', at: '2026-01-01', policyVersion: 'sample-1.0' };
test('invalid calendar dates, future dates, required fields and decimal precision are rejected', () => {
    assert.equal(validateClaim(base, '2026-01-02').length, 0);
    for (const change of [{ date: '2026-02-30' }, { date: '2027-01-01' }, { date: 'bad' }, { amount: 0 }, { amount: -1 }, { amount: 0.001 }, { amount: Infinity }, { claimant: ' ' }, { description: '' }, { receipt: 'yes' }, { currency: 'ZZZ' }, { category: 'Invalid' }])
        assert.ok(validateClaim({ ...base, ...change }, '2026-03-01').length, JSON.stringify(change));
});
test('limit boundary, missing receipt and unsupported currency checks', () => {
    const c = newClaim(base, 'test');
    assert.ok(checks(c, [c]).every(x => x.level === 'pass'));
    c.amount = 1000.01;
    assert.ok(checks(c, [c]).some(x => x.message.includes('Exceeds')));
    c.receipt = false;
    assert.ok(checks(c, [c]).some(x => x.level === 'warning'));
    c.currency = 'USD';
    const findings = checks(c, [c]);
    assert.ok(findings.some(x => x.message.includes('No USD limit')));
    assert.ok(!findings.some(x => x.message.includes('Exceeds')));
});
test('duplicates are normalized, currency-specific and exclude the current claim', () => {
    const a = newClaim(base, 'test'), b = newClaim({ ...base, claimant: ' test employee ' }, 'test');
    assert.ok(checks(a, [a, b]).some(x => x.message.includes('Potential duplicate')));
    b.currency = 'USD';
    assert.ok(!checks(a, [a, b]).some(x => x.message.includes('Potential duplicate')));
});
test('totals use integer cents and never combine currencies', () => {
    const a = newClaim({ ...base, amount: 0.1 }, 'test'), b = newClaim({ ...base, amount: 0.2 }, 'test'), c = newClaim({ ...base, currency: 'USD', amount: 5 }, 'test');
    assert.deepEqual(totals([a, b, c]), { INR: 30, USD: 500 });
});
test('approval requires review and reason; closed decisions cannot be overwritten', () => {
    const c = newClaim(base, 'test');
    assert.throws(() => applyDecision(c, 'approve', 'Checked', 'test'), /AI review/);
    c.review = structuredClone(review);
    assert.throws(() => applyDecision(c, 'approve', ' ', 'test'), /reason/);
    applyDecision(c, 'approve', 'Reviewed evidence', 'reviewer');
    assert.equal(c.status, 'Approved');
    assert.equal(c.history.at(-1)?.actor, 'reviewer');
    assert.throws(() => applyDecision(c, 'reject', 'Changed my mind', 'reviewer'), /closed/);
});
test('classification override invalidates review but preserves old evidence and resets status', () => {
    const c = newClaim(base, 'test');
    c.review = structuredClone(review);
    c.status = 'Clarification requested';
    applyDecision(c, 'override', 'Transport receipt, not a meal', 'reviewer', 'Travel');
    assert.equal(c.category, 'Travel');
    assert.equal(c.review, null);
    assert.equal(c.status, 'Pending');
    assert.equal((c.history.at(-1)?.details as any).previous.review.summary, review.summary);
});
test('retrieval includes category and common evidence but excludes unrelated limits', () => {
    const ids = retrievePolicy('Travel').map(x => x.id);
    assert.ok(ids.includes('P4'));
    assert.ok(ids.includes('P2'));
    assert.ok(!ids.includes('P5'));
});
test('unknown citations, missing citations and malformed model results are rejected', () => {
    validateEvidence(review, retrievePolicy('Meals'));
    assert.throws(() => validateEvidence({ ...review, findings: [{ message: 'Invented', sectionIds: ['P99'] }] }, retrievePolicy('Meals')), /citations/);
    assert.throws(() => validateEvidence({ ...review, findings: [{ message: 'Uncited', sectionIds: [] }] }, retrievePolicy('Meals')), /citations/);
    assert.throws(() => validateEvidence({ ...review, findings: [] }, retrievePolicy('Meals')), /invalid review/);
});
test('AI pipeline uses two structured stages and cannot mark flagged claims compliant', async () => {
    const calls: any[] = [];
    const mock = (async (_url: any, init: any) => { calls.push(JSON.parse(init.body)); const output = calls.length === 1 ? { category: 'Meals', uncertain: true, reason: 'Ambiguous' } : { ...review, questions: [] }; return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(output) }] }] }); }) as typeof fetch;
    const c = newClaim({ ...base, receipt: false }, 'test');
    const result = await runReview(c, [c], 'fake-test-key', 'test-model', 'test-request', mock);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].text.format.strict, true);
    assert.equal(result.assessment, 'clarification');
    assert.equal(result.uncertain, true);
    assert.ok(result.questions.length);
    assert.equal(c.review, null);
});
test('provider failures and invalid citations never produce a saved review', async () => {
    const c = newClaim(base, 'test');
    await assert.rejects(() => runReview(c, [c], 'test', 'test', 'test', (async () => new Response('', { status: 429 })) as typeof fetch), /quota/);
    assert.equal(c.review, null);
    let n = 0;
    const mock = (async () => Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(++n === 1 ? { category: 'Meals', uncertain: false, reason: 'Meal' } : { ...review, findings: [{ message: 'Bad', sectionIds: ['P99'] }] }) }] }] })) as typeof fetch;
    await assert.rejects(() => runReview(c, [c], 'test', 'test', 'test', mock), /citations/);
});
test('sample dataset contains receipt, duplicate, foreign currency and limit edge cases', () => {
    const cs = sampleClaims('tester');
    assert.equal(cs.length, 6);
    assert.ok(cs.some(c => !c.receipt));
    assert.ok(cs.some(c => c.currency === 'USD'));
    assert.ok(cs.some(c => checks(c, cs).some(f => f.message.includes('Potential duplicate'))));
    assert.ok(cs.some(c => checks(c, cs).some(f => f.message.includes('Exceeds'))));
});
