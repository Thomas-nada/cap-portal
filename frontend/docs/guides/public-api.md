# Public API

The CAP Portal exposes a fully public REST API. You can read all proposals, comments, and versions without authentication. To write — post comments or submit proposals — you authenticate with a Cardano wallet.

Interactive documentation with a built-in "Try it out" feature is available at:

**`http://your-server/docs`** (Swagger UI)  
**`http://your-server/redoc`** (ReDoc)

---

## Base URL

```
http://your-server:8000
```

All responses are JSON. All request bodies should be `Content-Type: application/json`.

---

## Authentication

Protected endpoints require a JWT Bearer token obtained through a CIP-30 wallet challenge-response flow.

### Step 1 — Get a challenge

```http
GET /auth/challenge
```

```json
{ "challenge": "cap-auth:1747123456:a3f9..." }
```

### Step 2 — Sign the challenge with your wallet

Use your CIP-30 wallet's `signData()` method. The payload must be hex-encoded:

```javascript
const challengeHex = Array.from(new TextEncoder().encode(challenge))
  .map(b => b.toString(16).padStart(2, '0')).join('');

const { signature, key } = await walletApi.signData(stakeAddressHex, challengeHex);
```

### Step 3 — Verify and receive your token

```http
POST /auth/verify
Content-Type: application/json

{
  "stake_address": "stake1u...",
  "challenge": "cap-auth:1747123456:a3f9...",
  "signature": "<hex from signData>",
  "key":       "<hex from signData>",
  "display_name": "Optional Name"
}
```

```json
{
  "token": "eyJ...",
  "stake_address": "stake1u...",
  "display_name": "Optional Name",
  "is_editor": false
}
```

### Step 4 — Use the token

Include it as a Bearer token on all subsequent requests:

```http
Authorization: Bearer eyJ...
```

Tokens are valid for **24 hours**.

---

## Proposals

### List all proposals

```http
GET /proposals
```

Returns an array of proposal summaries including `number`, `title`, `stage`, `author_display_name`, `created_at`.

### Get a single proposal

```http
GET /proposals/{number}
```

Returns full proposal detail including `structured` content (abstract, motivation, analysis, impact, exhibits, revisions).

### Create a proposal *(requires auth)*

```http
POST /proposals
Authorization: Bearer <token>

{
  "title": "My Proposal Title",
  "type": "CAP",
  "structured": {
    "abstract":   "A brief summary.",
    "motivation": "Why this is needed.",
    "analysis":   "How the change works and how to verify it.",
    "impact":     "Practical consequences if adopted.",
    "exhibits":   "Links and supporting references.",
    "revisions":  [
      { "original": "Exact current constitutional text.", "proposed": "Your replacement wording.", "section": "Article II Section 6" }
    ]
  }
}
```

`structured` is a free-form object — the API does not enforce a fixed schema on its keys — but the fields above are what the portal's own Amendment Wizard generates, and what every other client should produce for consistency. Content supports Markdown.

### Get proposal versions

```http
GET /proposals/{number}/versions
```

Returns the full version history including content hashes forming a tamper-evident chain.

---

## Comments

### List comments

```http
GET /proposals/{number}/comments
```

### Post a comment *(requires auth)*

```http
POST /proposals/{number}/comments
Authorization: Bearer <token>

{ "body": "Comment text. Markdown is supported." }
```

---

## Suggestions

Suggestions are proposed edits to a specific section of a proposal.

### List suggestions

```http
GET /proposals/{number}/suggestions
```

### Submit a suggestion *(requires auth)*

```http
POST /proposals/{number}/suggestions
Authorization: Bearer <token>

{
  "field":            "motivation",
  "suggested_value":  "The suggested replacement text for that field.",
  "reason":           "Optional explanation."
}
```

---

## Rate Limits

| Endpoint group        | Limit         |
|-----------------------|---------------|
| Auth (challenge/verify) | 10 / minute |
| Read endpoints        | 60 / minute   |
| Write endpoints       | 20 / minute   |

Rate limit headers are included in every response (`X-RateLimit-Limit`, `X-RateLimit-Remaining`).

---

## CORS

The API allows requests from any origin (`*`). Credentials (cookies) are not used — only the `Authorization` header.
