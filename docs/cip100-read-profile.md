# CIP-100 read profile for CAPs

`profileVersion: 1.0`

The CAP portal publishes every Constitutional Amendment Proposal (CAP) and
Constitutional Issue Statement (CIS) as a CIP-100 JSON-LD document, so other
governance tools can index and cross-reference the CAP process. This is the
read contract: what the export guarantees, how to detect changes, and how the
content hash is computed. It is read-only. A future write path (signed
submissions) is out of scope here and will be its own profile.

## Endpoints

- `GET /cip100` — feed of every public proposal: `number`, `documentType`,
  `title`, `category`, `status`, `updatedAt`, `contentHash`, and a `cip100` URL.
- `GET /proposals/{n}/cip100` — one proposal as a full CIP-100 JSON-LD document
  (below). `Content-Type: application/ld+json`. Open CORS (`*`).

Both are public and unauthenticated.

## Document shape

```
{
  "@context": { ... CIP100 / CIP108 / CIPCAP ... },
  "hashAlgorithm": "blake2b-256",
  "authors": [{ "name": "<display name>", "id": "<stake address>" }],
  "body": {
    "title", "abstract", "motivation", "rationale", "impact", "references": [...],
    "cap": {
      "profileVersion": "1.0",
      "number", "documentType", "category", "status",
      "sourceUrl", "submittedAt", "updatedAt",
      "currentVersion", "portalContentHash",
      "authorship": { ... },
      "proposedRevisions": [...],
      "versionHistory": [ { version, changeSummary, contentHash, previousHash,
                           date, author, authorId, title, content } ],
      "discussion": [ ... ]
    }
  }
}
```

`documentType` is `CAP` or `CIS`. `status` is the lifecycle label
(`consultation` / `ready` / `done` / `withdrawn`) when set.

## Author identity and signature state

- Every author, comment, and version carries a **stable identifier**: the
  author's stake address, in the `id` / `authorId` field, next to the display
  `name`/`author`.
- `body.cap.authorship` states how authorship is proven:
  ```
  { "identifierType": "stakeAddress",
    "walletVerifiedAtSubmission": true,
    "documentSigned": false }
  ```
  Today the portal verifies the author's wallet with a CIP-8 signature at
  submission (that is what binds the stake address), but the exported document
  does not yet carry a per-document witness signature. When the write path lands,
  a signed document will carry a CIP-100 `authors[].witness` and `documentSigned`
  becomes true, so "is this signed" is always an explicit, checkable field rather
  than an assumption.

## Detecting changes, edits, withdrawals, and moderation

- **Proposal content changes**: follow `versionHistory`. Each entry has a
  `contentHash` and a `previousHash` forming a chain from `"genesis"`, so a
  consumer can tell a new version from an unchanged one and verify the chain.
- **Edits**: `updatedAt` is present on the proposal (`body.cap.updatedAt`) and on
  every visible comment. When it differs from the created `date`, the item has
  been edited.
- **Comment moderation and removals**: the discussion includes **every** comment,
  not only visible ones. A visible comment carries `author`, `authorId`,
  `date`, `updatedAt`, `status: "visible"`, and `body`. A non-visible comment is
  a **tombstone**: `{ id, status, updatedAt, inReplyTo? }` with no `body` and no
  author. This lets a consumer detect a removal explicitly (rather than inferring
  it from a comment that silently vanished) and keeps the reply structure intact,
  so a reply to a removed comment is never orphaned.
- **Withdrawn proposals** stay in the feed and the export with
  `status: "withdrawn"`; the content remains readable, since a withdrawal is a
  lifecycle state, not a takedown.
- **Admin-removed proposals** (`moderation_status = removed`) are currently
  withheld entirely (`GET /proposals/{n}/cip100` returns 404). Whether these
  should instead surface as a proposal-level tombstone is an open question below.

## Content integrity (hashing)

`hashAlgorithm` is **blake2b-256** and this is what a `contentHash` /
`portalContentHash` is:

```
contentHash = blake2b-256( canonical )        # 32-byte digest, 64 hex chars
canonical   = JSON of { "title": <title>,
                        "body": <version body, parsed>,
                        "previousHash": <prev or "genesis"> }
              serialized with sorted keys and compact (",",":") separators,
              UTF-8, ensure_ascii = false
```

- The chain: version 1 uses `previousHash = "genesis"`; each later version uses
  the previous version's `contentHash`.
- Canonical JSON (sorted keys, compact separators) means the digest is
  independent of stored key order or JSON whitespace.
- Reproducibility: the raw version body is available at
  `GET /proposals/{n}/versions/{v}`, so a consumer can recompute the digest
  independently with the rule above.
- Text normalization: every prose field the export serves (abstract, motivation,
  rationale, impact, and comment bodies) is normalized first, line endings to
  LF, trailing whitespace stripped per line and at the ends. This is why exported
  text is stable and does not vary by trailing whitespace.

## Versioning

`body.cap.profileVersion` is this profile's version. It is bumped when the shape
or semantics change in a way a consumer must notice. Additive fields that do not
change existing meaning may ship without a bump.

## Open questions (for discussion, not settled here)

- Whether admin-removed proposals should surface as a proposal-level tombstone
  (id + status, no content) instead of a 404, so removals are detectable.
- Whether comments should carry their own integrity hash, not just proposals.
- The write path: the signed-submission envelope and the exact canonical bytes a
  witness signature covers. That is a separate profile, to be agreed before any
  write-back.
