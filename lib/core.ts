export const CATEGORIES = ['Meals', 'Travel', 'Lodging', 'Office supplies', 'Other'] as const;
export type Category = typeof CATEGORIES[number];
export type Status = 'Pending' | 'Approved' | 'Rejected' | 'Clarification requested';
export type Section = {
    id: string;
    title: string;
    text: string;
    category?: Category;
    limit?: number;
};
export const POLICY = { version: 'sample-1.0', name: 'Sample expense policy', currency: 'INR', sections: [
        { id: 'P1', title: 'Business purpose & eligibility', text: 'Expenses must have a clear business purpose. Personal purchases are not reimbursable. If business purpose is unclear, ask for clarification. All decisions require a human reviewer.' },
        { id: 'P2', title: 'Receipts', text: 'A receipt is required for every claim. A missing receipt requires clarification; it is not an automatic rejection.' },
        { id: 'P3', title: 'Meals', category: 'Meals', limit: 1000, text: 'Business meals are limited to INR 1,000 per claim. Record the business purpose and attendees. Missing attendee information requires clarification.' },
        { id: 'P4', title: 'Travel', category: 'Travel', limit: 5000, text: 'Business transport, including taxis, trains and buses, is limited to INR 5,000 per claim. State the origin, destination and business purpose.' },
        { id: 'P5', title: 'Lodging', category: 'Lodging', limit: 6000, text: 'Business accommodation is limited to INR 6,000 per claim. State the stay dates and business purpose. This sample uses a per-claim limit, not a nightly limit.' },
        { id: 'P6', title: 'Office supplies', category: 'Office supplies', limit: 2500, text: 'Work-related stationery and small office supplies are limited to INR 2,500 per claim. Equipment, subscriptions and unclear purchases need separate human review.' },
        { id: 'P7', title: 'Uncovered categories & currencies', category: 'Other', text: 'Other categories have no configured limit and need human review. Limits are defined only for INR. Other supported currencies need human review; do not convert or compare them to INR limits.' },
        { id: 'P8', title: 'Dates & duplicate review', text: 'Use a real calendar date no later than today in Asia/Kolkata. Claims with the same claimant, date, amount and currency are potential duplicates and need review; do not automatically discard them.' },
    ] as Section[] };
export type Finding = {
    level: 'pass' | 'warning' | 'review';
    message: string;
    sectionId: string;
};
export type AIReview = {
    category: Category;
    uncertain: boolean;
    summary: string;
    findings: {
        message: string;
        sectionIds: string[];
    }[];
    questions: string[];
    assessment: 'may_comply' | 'clarification' | 'review';
    model: string;
    at: string;
    policyVersion: string;
};
export type Event = {
    id: string;
    at: string;
    actor: string;
    type: string;
    reason: string;
    details?: unknown;
};
export type Claim = {
    id: string;
    claimant: string;
    date: string;
    category: Category | 'Unclassified';
    amount: number;
    currency: string;
    description: string;
    receipt: boolean;
    status: Status;
    review: AIReview | null;
    history: Event[];
    createdAt: string;
};
export type Workspace = {
    claims: Claim[];
};
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function validateClaim(x: any, now = today()): string[] {
    const e: string[] = [];
    if (typeof x?.claimant !== 'string' || !x.claimant.trim() || x.claimant.length > 120)
        e.push('Claimant is required (maximum 120 characters).');
    if (typeof x?.description !== 'string' || x.description.trim().length < 5 || x.description.length > 2000)
        e.push('Description must contain 5–2,000 characters.');
    if (typeof x?.amount !== 'number' || !Number.isFinite(x.amount) || x.amount <= 0 || x.amount > 10000000 || Math.abs(x.amount * 100 - Math.round(x.amount * 100)) > 0.000001)
        e.push('Amount must be positive, at most 10,000,000, with up to two decimal places.');
    if (!['INR', 'USD', 'EUR', 'GBP'].includes(x?.currency))
        e.push('Select a supported currency.');
    if (![...CATEGORIES, 'Unclassified'].includes(x?.category))
        e.push('Select a valid category.');
    if (typeof x?.receipt !== 'boolean')
        e.push('Receipt availability must be yes or no.');
    if (typeof x?.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || !Number.isFinite(Date.parse(x.date)) || new Date(x.date).toISOString().slice(0, 10) !== x.date || x.date < '2000-01-01' || x.date > now)
        e.push('Use a real date from 2000 through today (India time).');
    return e;
}
export function effectiveCategory(c: Claim): Claim['category'] { return c.category !== 'Unclassified' ? c.category : c.review?.category ?? 'Unclassified'; }
export function checks(c: Claim, all: Claim[]): Finding[] {
    const f: Finding[] = [];
    const add = (level: Finding['level'], message: string, sectionId: string) => f.push({ level, message, sectionId });
    add(c.receipt ? 'pass' : 'warning', c.receipt ? 'Receipt marked available.' : 'Receipt missing. Ask the claimant to provide one.', 'P2');
    const dup = all.filter(x => x.id !== c.id && x.claimant.trim().toLowerCase() === c.claimant.trim().toLowerCase() && x.date === c.date && Math.round(x.amount * 100) === Math.round(c.amount * 100) && x.currency === c.currency);
    add(dup.length ? 'review' : 'pass', dup.length ? `Potential duplicate: ${dup.map(x => x.id).join(', ')}. Confirm whether these are separate expenses.` : 'No potential duplicate found.', 'P8');
    const category = effectiveCategory(c);
    const rule = POLICY.sections.find(s => s.category === category);
    if (c.currency !== 'INR')
        add('review', `No ${c.currency} limit is configured. Currency conversion is not performed.`, 'P7');
    else if (rule?.limit !== undefined)
        add(c.amount > rule.limit ? 'review' : 'pass', c.amount > rule.limit ? `Exceeds the ${category} limit of INR ${rule.limit.toLocaleString('en-IN')} per claim.` : `Within the ${category} limit of INR ${rule.limit.toLocaleString('en-IN')} per claim.`, rule.id);
    else
        add('review', category === 'Unclassified' ? 'Category is not classified yet.' : 'No category limit is configured; human review is required.', 'P7');
    return f;
}
export function totals(claims: Claim[]) { return claims.reduce<Record<string, number>>((a, c) => { a[c.currency] = (a[c.currency] ?? 0) + Math.round(c.amount * 100); return a; }, {}); }
export function event(actor: string, type: string, reason: string, details?: unknown): Event { return { id: crypto.randomUUID(), at: new Date().toISOString(), actor, type, reason, ...(details === undefined ? {} : { details }) }; }
export function newClaim(input: any, actor: string): Claim {
    const errors = validateClaim(input);
    if (errors.length)
        throw new Error(errors.join(' '));
    return { id: `CL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, claimant: input.claimant.trim(), date: input.date, category: input.category, amount: input.amount, currency: input.currency, description: input.description.trim(), receipt: input.receipt, status: 'Pending', review: null, createdAt: new Date().toISOString(), history: [event(actor, 'Submitted', 'Claim created.')] };
}
export function applyDecision(c: Claim, action: string, reason: string, actor: string, category?: Category) {
    if (!reason?.trim() || reason.length > 2000)
        throw new Error('A reason is required (maximum 2,000 characters).');
    if (c.status === 'Approved' || c.status === 'Rejected')
        throw new Error('This claim is closed. Reopen it before changing the review.');
    if (action === 'override') {
        if (!CATEGORIES.includes(category!))
            throw new Error('Select a valid category.');
        const previous = { category: c.category, review: c.review };
        c.category = category!;
        c.review = null;
        c.status = 'Pending';
        c.history.push(event(actor, 'Category overridden', reason, { previous, newCategory: category }));
    }
    else {
        const map: Record<string, Status> = { approve: 'Approved', reject: 'Rejected', clarify: 'Clarification requested' };
        if (!map[action])
            throw new Error('Unknown decision.');
        if (action === 'approve' && !c.review)
            throw new Error('Run an AI review before approval.');
        c.status = map[action];
        c.history.push(event(actor, map[action], reason, { policyVersion: POLICY.version, review: c.review }));
    }
}
export function sampleClaims(actor: string): Claim[] {
    const date = today();
    return [
        { claimant: 'Ananya Rao', category: 'Meals', amount: 840, description: 'Lunch with Priya and Dev for the client onboarding workshop.', receipt: true },
        { claimant: 'Rohan Mehta', category: 'Unclassified', amount: 1250, description: 'Cab from Bengaluru airport to the client office for the quarterly review.', receipt: true },
        { claimant: 'Meera Shah', category: 'Lodging', amount: 7200, description: 'Hotel stay for customer training, check-in and check-out dates to be confirmed.', receipt: true },
        { claimant: 'Arjun Nair', category: 'Meals', amount: 650, description: 'Team lunch after the product planning session.', receipt: false },
        { claimant: 'Rohan Mehta', category: 'Travel', amount: 1250, description: 'Airport cab for client quarterly review.', receipt: true },
        { claimant: 'Sara Khan', category: 'Other', amount: 49, description: 'Monthly design software subscription for the product team.', receipt: true, currency: 'USD' },
    ].map(x => newClaim({ date, currency: 'INR', ...x }, actor));
}
