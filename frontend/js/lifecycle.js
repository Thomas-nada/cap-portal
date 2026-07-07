// Single source of truth for proposal lifecycle staging + counts, so the
// dashboard, board, and registry can never disagree on what "In Consultation"
// means. CAPs and CIS both go through the same lifecycle and are counted alike.

export const LIFECYCLE = ['consultation', 'ready', 'done', 'withdrawn'];

export function getStage(p) {
    const lc = (p.labels || []).map(l => l.name.toLowerCase());
    for (const s of LIFECYCLE) { if (lc.includes(s)) return s; }
    return p.state === 'closed' ? 'done' : 'consultation';
}

export function computeStageCounts(proposals) {
    const counts = { consultation: 0, ready: 0, done: 0, withdrawn: 0 };
    for (const p of (proposals || [])) counts[getStage(p)]++;
    return counts;
}
