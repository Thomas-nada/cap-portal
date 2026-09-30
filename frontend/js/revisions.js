// Helpers shared by the wizard, the proposal detail and the version modal for
// the structured revisions a CAP carries.
//
// A revision is one of:
//   replacement  { original, proposed, section }
//   addition     { type: 'addition', insert_after, proposed, section }
//   deletion     { type: 'deletion', original, proposed: '', section }
// The wizard's working model uses selection kinds 'replace' | 'add_after' | 'delete'.

export function revisionKind(r) {
    return r?.type === 'addition' ? 'add_after' : r?.type === 'deletion' ? 'delete' : 'replace';
}

// True when applying the revision would change the constitution draft.
export function revisionHasEffect(r) {
    if (!r) return false;
    if (r.type === 'addition') return !!(r.insert_after && r.proposed);
    if (r.type === 'deletion') return !!r.original;
    return !!(r.original && r.proposed);
}

export function countEffectiveRevisions(revisions) {
    return (revisions || []).filter(revisionHasEffect).length;
}

// Wizard selection (+ its proposed text) -> stored revision.
export function selectionToRevision(sel, proposed) {
    const section = sel.sectionId || '';
    if (sel.kind === 'add_after') return { type: 'addition', insert_after: sel.text || '', proposed: proposed || '', section };
    if (sel.kind === 'delete')    return { type: 'deletion', original: sel.text || '', proposed: '', section };
    return { original: sel.text || '', proposed: proposed || '', section };
}
