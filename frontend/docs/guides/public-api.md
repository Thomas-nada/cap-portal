# Public API

The CAP Portal exposes a fully public REST API. You can read all proposals, comments, and versions without authentication. To write — post comments, submit proposals, or follow a proposal — you either provide an email address or authenticate with a Cardano wallet.

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

Returns full proposal detail including `structured` content (abstract, motivation, rationale, specification, references).

### Create a proposal *(requires auth)*

```http
POST /proposals
Authorization: Bearer <token>

{
  "title": "My Proposal Title",
  "structured": {
    "abstract":      "A brief summary.",
    "motivation":    "Why this is needed.",
    "rationale":     "Why this solution.",
    "specification": "Technical details.",
    "references":    "Links and sources."
  }
}
```

All fields in `structured` except `abstract` are optional. Content supports Markdown.

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

{ "content": "Comment text. Markdown is supported." }
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
  "section":  "motivation",
  "old_text": "The original text to replace.",
  "new_text": "The suggested replacement.",
  "note":     "Optional explanation."
}
```

---

## Follow / Unfollow

Anyone can subscribe to email updates for a proposal — no wallet required.

### Subscribe

```http
POST /proposals/{number}/subscribe

{ "email": "you@example.com" }
```

### Check subscription status

```http
GET /proposals/{number}/subscribe?email=you@example.com
```

```json
{ "subscribed": true }
```

### Unsubscribe

```http
DELETE /proposals/{number}/subscribe

{ "email": "you@example.com" }
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

---

## Example: Building a third-party client

The Norwegian-language CAP portal (`/norsk-portal`) was built using only this API as a proof of concept. It demonstrates:

- Reading and displaying proposals without authentication
- Email-based follow/unfollow
- Full CIP-30 wallet authentication
- Posting comments after login

The source code is in `E:\CAP-Local\norsk-portal\` and is a good reference implementation.
