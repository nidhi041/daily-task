# Day 2 — REST API Design (Fitness Coaching App)

**Context:** a fitness coaching app where a coach assigns **workout plans** to clients and the app tracks **progress analytics** from logged training sessions.

**Deliverables in this folder**

| File | What it is |
| --- | --- |
| `README.md` | This design document (endpoints, contracts, status codes, validation, assumptions, failure case, test method) |
| `server.js` | Runnable zero-dependency Node implementation of the 4 endpoints (in-memory, seeded data) |
| `evidence.txt` | Raw `curl.exe` transcripts (request + response headers + body) for every happy path and failure path |

Run it:

```bash
node .\server.js        # http://localhost:3000/api/v1
```

In a second PowerShell window, run all four example requests:

```powershell
.\test-api.ps1
```

---

## 1. Scope of this API

Four endpoints covering the two core flows of the app — **plan authoring** and **progress analytics**:

| # | Method | Path | Purpose |
| --- | --- | --- | --- |
| 1 | `GET` | `/api/v1/clients/{clientId}/workout-plans` | List a client's workout plans |
| 2 | `POST` | `/api/v1/clients/{clientId}/workout-plans` | Create (assign) a workout plan to a client |
| 3 | `POST` | `/api/v1/clients/{clientId}/workout-sessions` | Log a completed training session |
| 4 | `GET` | `/api/v1/clients/{clientId}/progress-summary?from=&to=` | Aggregated progress analytics for a date range |

## 2. Conventions

- **Versioning** — all paths are prefixed `/api/v1`. Breaking changes ship as `/api/v2`.
- **Resource nesting** — plans and sessions are always owned by a client, so the client id is in the path. This makes ownership checks explicit and prevents cross-client reads.
- **Success envelope** — `{ "data": …, "meta": { … } }`. `meta` carries counts/paging context, never business data.
- **Error envelope** — `{ "error": { code, message, details[], requestId } }`. `code` is a stable, machine-readable string; `message` is human-readable; `details[]` pinpoints offending fields; `requestId` correlates with server logs.
- **Field names** — `camelCase` in JSON; units always suffixed (`durationMinutes`, `targetWeightKg`, `restSeconds`) so no unit is implied.
- **Dates** — calendar dates as `YYYY-MM-DD` (UTC), timestamps as ISO‑8601 UTC.
- **Content type** — requests and responses are `application/json; charset=utf-8`. A request body that is not parseable JSON returns `400 INVALID_JSON`; a body over 1 MiB returns `413 PAYLOAD_TOO_LARGE`.

### Status code policy

| Code | Used when |
| --- | --- |
| `200 OK` | Successful read (list, analytics) |
| `201 Created` | Resource created; response carries a `Location` header |
| `400 Bad Request` | Syntactically valid JSON, but fields/query params fail validation |
| `404 Not Found` | Path addressed a resource that does not exist (client or route) |
| `405 Method Not Allowed` | Path exists but the HTTP method is not supported |
| `409 Conflict` | Request conflicts with current state (duplicate active plan title) |
| `413 Payload Too Large` | Body exceeds the 1 MiB limit |
| `422 Unprocessable Entity` | Body is well-formed, but a referenced entity is invalid for this client |
| `500 Internal Server Error` | Unexpected server fault |

---

## 3. Endpoint specifications

### 3.1 `GET /api/v1/clients/{clientId}/workout-plans`

Lists the client's plans, newest data as stored. Optional `?status=draft|active|archived` filter.

**Request** — no body. Query: `status` (optional, enum).

**Response `200`**

```json
{
  "data": [
    {
      "id": "plan-5001",
      "clientId": "c-1001",
      "title": "Hypertrophy Block A",
      "goal": "muscle_gain",
      "weeks": 8,
      "daysPerWeek": 4,
      "status": "active",
      "createdAt": "2026-11-01T09:00:00.000Z",
      "exercises": [
        { "name": "Back Squat", "sets": 4, "reps": 8, "restSeconds": 120, "targetWeightKg": 90 },
        { "name": "Bench Press", "sets": 4, "reps": 8, "restSeconds": 120, "targetWeightKg": 70 }
      ]
    }
  ],
  "meta": { "clientId": "c-1001", "count": 1 }
}
```

**Validation / errors**

| Status | Code | Condition |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `status` present but not one of `draft`, `active`, `archived` |
| `404` | `CLIENT_NOT_FOUND` | No client with that id |

---

### 3.2 `POST /api/v1/clients/{clientId}/workout-plans`

Creates and assigns a workout plan to a client.

**Request body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `title` | string | yes | trimmed length 3–80; unique among the client's **active** plans |
| `goal` | string | yes | one of `muscle_gain`, `fat_loss`, `endurance`, `mobility`, `general_fitness` |
| `weeks` | integer | yes | 1–52 |
| `daysPerWeek` | integer | yes | 1–7 |
| `exercises` | array | yes | non-empty; each: `name` (2–80 chars), `sets` (int 1–10), `reps` (int 1–100), `restSeconds` (int 0–600, default 60), `targetWeightKg` (number 0–500, optional) |
| `status` | string | no | `draft` (default) \| `active` \| `archived` |

```json
{
  "title": "Strength Rebuild",
  "goal": "muscle_gain",
  "weeks": 6,
  "daysPerWeek": 3,
  "status": "active",
  "exercises": [
    { "name": "Deadlift", "sets": 4, "reps": 5, "restSeconds": 180, "targetWeightKg": 120 },
    { "name": "Overhead Press", "sets": 3, "reps": 8, "restSeconds": 120, "targetWeightKg": 45 }
  ]
}
```

**Response `201`** — `Location: /api/v1/clients/c-1002/workout-plans/plan-5003`; body `{ "data": { …created plan, with server-assigned id + createdAt… } }`.

**Validation / errors**

| Status | Code | Condition |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | any field rule above fails (all failures returned together) |
| `404` | `CLIENT_NOT_FOUND` | client id does not exist |
| `409` | `PLAN_TITLE_CONFLICT` | client already has an **active** plan with the same title (case-insensitive) |

---

### 3.3 `POST /api/v1/clients/{clientId}/workout-sessions`

Logs a completed training session — the source data for all analytics.

**Request body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `date` | string | yes | real calendar date `YYYY-MM-DD`; not more than 1 day in the future |
| `durationMinutes` | integer | yes | 1–600 |
| `perceivedExertion` | number | yes | 1–10 (RPE), one decimal |
| `planId` | string | no | if given, must exist **and** belong to this client |
| `exercises` | array | yes | non-empty; each: `name` (2–80 chars), `sets` (non-empty array of `{ reps: int 1–100, weightKg: number 0–500 }`) |
| `notes` | string | no | ≤ 500 chars |

```json
{
  "planId": "plan-5001",
  "date": "2026-11-20",
  "durationMinutes": 58,
  "perceivedExertion": 8.5,
  "notes": "Squat depth felt better.",
  "exercises": [
    { "name": "Back Squat", "sets": [{ "reps": 5, "weightKg": 100 }, { "reps": 5, "weightKg": 100 }, { "reps": 5, "weightKg": 100 }] },
    { "name": "Romanian Deadlift", "sets": [{ "reps": 8, "weightKg": 70 }, { "reps": 8, "weightKg": 70 }, { "reps": 8, "weightKg": 70 }] }
  ]
}
```

**Response `201`** — `Location: /api/v1/clients/c-1001/workout-sessions/sess-9006`; body `{ "data": { …session… } }`.

**Validation / errors**

| Status | Code | Condition |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | field rules above fail |
| `404` | `CLIENT_NOT_FOUND` | client id does not exist |
| `422` | `PLAN_NOT_FOUND` | `planId` references a plan that does not exist |
| `422` | `PLAN_CLIENT_MISMATCH` | `planId` exists but belongs to a different client |

> `422` rather than `404` is deliberate: the *request target* exists, but a **referenced** entity is semantically invalid. That keeps client-side handling of "wrong resource" vs "wrong payload" distinct.

---

### 3.4 `GET /api/v1/clients/{clientId}/progress-summary?from=&to=`

Aggregates the client's sessions in a date range into progress analytics.

**Query params**

| Param | Required | Validation |
| --- | --- | --- |
| `from` | yes | `YYYY-MM-DD`, real date |
| `to` | yes | `YYYY-MM-DD`, real date, `≥ from`, range ≤ 366 days |

**Response `200`**

```json
{
  "data": {
    "clientId": "c-1001",
    "from": "2026-11-01",
    "to": "2026-11-30",
    "sessionsCompleted": 4,
    "plannedSessions": 17,
    "adherencePercent": 23.5,
    "totalVolumeKg": 11477.5,
    "averageDurationMinutes": 61.3,
    "averagePerceivedExertion": 7.8,
    "volumeByExercise": [
      { "name": "Back Squat", "volumeKg": 7445 },
      { "name": "Bench Press", "volumeKg": 2352.5 },
      { "name": "Romanian Deadlift", "volumeKg": 1680 }
    ]
  },
  "meta": { "clientId": "c-1001", "activePlanId": "plan-5001", "rangeDays": 30 }
}
```

**Validation / errors**

| Status | Code | Condition |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `from`/`to` missing or malformed; `from > to`; range > 366 days |
| `404` | `CLIENT_NOT_FOUND` | client id does not exist |

---

## 4. The error response contract

Every non-2xx response uses exactly this shape — no exceptions, no bare strings:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body failed validation.",
    "details": [
      { "field": "weeks", "issue": "must be an integer between 1 and 52" }
    ],
    "requestId": "927229e4-0572-45d5-baa6-f3b402d2cd41"
  }
}
```

Why this shape:
- `code` is stable and safe for clients to branch on; `message` can be reworded without breaking anyone.
- `details[]` lets a UI highlight every bad field in one round trip instead of failing one field at a time.
- `details` is omitted entirely when there is nothing field-specific (e.g. `CLIENT_NOT_FOUND`).
- `requestId` is echoed in server logs, so a support ticket can be traced to a single request.

---

## 5. Failure case (documented in depth)

**Scenario:** a coach submits a new plan from the form while some inputs are still empty/defaulted — `title` was never filled in, `goal` is a stale client-side value, `weeks` and `daysPerWeek` are `0` and `9`, and no exercises were added.

**Request**

```bash
curl.exe -i -X POST http://localhost:4000/api/v1/clients/c-1001/workout-plans \
  -H "Content-Type: application/json" \
  -d '{"goal":"hypertrophy_blast","weeks":0,"daysPerWeek":9,"exercises":[]}'
```

**Response `400 Bad Request`** (evidence `E5`)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body failed validation.",
    "details": [
      { "field": "title",       "issue": "is required and must be a string of 3-80 characters" },
      { "field": "goal",        "issue": "must be one of: muscle_gain, fat_loss, endurance, mobility, general_fitness" },
      { "field": "weeks",       "issue": "must be an integer between 1 and 52" },
      { "field": "daysPerWeek", "issue": "must be an integer between 1 and 7" },
      { "field": "exercises",   "issue": "must be a non-empty array" }
    ],
    "requestId": "927229e4-0572-45d5-baa6-f3b402d2cd41"
  }
}
```

**Why the API behaves this way**

- Validation runs **before** any write, so a rejected request leaves the datastore untouched — no partial plans.
- All field errors are collected and returned together (fail-fast per field, fail-slow across fields) so the coach fixes the form in one pass.
- The response never leaks a stack trace or internal ids; only the `requestId` is exposed for correlation.
- `422` is reserved for the case where the body is well-formed but references the wrong client's plan (evidence `E9`), which keeps "bad payload" (`400`) and "wrong relationship" (`422`) distinguishable.

---

## 6. Assumptions

Recorded because the brief did not specify them:

1. **Auth is out of scope for Day 2.** In production every route would require a coach bearer token, and `clientId` would be checked against the coach's roster. The ownership rule that *is* enforced here is client↔plan↔session consistency.
2. **Client identity is coach-scoped.** `clientId` values (`c-1001`) are opaque; the seeded examples belong to one coach (`coach-7`).
3. **"Volume" = Σ(reps × weightKg) per set**, summed over the range. Bodyweight/machine work is logged with `weightKg: 0` and therefore contributes 0 volume (see the seeded rowing sessions for `c-1002`).
4. **Adherence** = `sessionsCompleted ÷ plannedSessions`, where `plannedSessions` = the client's **active** plan's `daysPerWeek` × (range days ÷ 7), rounded. It is intentionally a simple, explainable ratio; it can exceed 100% if a client trains more than planned, which is left visible rather than clamped.
5. **A client has at most one `active` plan** for analytics purposes; older plans are `archived`. Title uniqueness is only enforced among active plans.
6. **Storage is in-memory and seeded** so the evidence is byte-for-byte reproducible. Ids are server-assigned (`plan-5003`, `sess-9006`); clients never supply them.
7. **Timezone** — session `date` is a calendar date in UTC; the "not in the future" rule allows a 1-day grace window so clients in ahead-of-UTC zones are not rejected at midnight.
8. **Pagination is omitted** — a client's plans and a ≤366-day session window are small enough to return whole.
9. **No personal health data** is modelled beyond weight, duration and RPE; nothing here is medical advice.

---

## 7. How I tested it

- **Tool:** `curl.exe` 8.22.0 on Windows PowerShell (Postman is equivalent — the same nine requests import directly as raw `POST`/`GET` calls; the JSON bodies above are copy-paste ready).
- **Method:** started the server with `node server.js`, then issued each request with `curl.exe -s -i` so the transcript captures the **status line, response headers and body** — not just the body. JSON bodies were piped to `curl --data-binary "@-"` over stdin to avoid Windows shell quoting problems.
- **Coverage:** all four endpoints on happy paths, plus five failure paths (validation, conflict, unknown client, inverted date range, cross-client plan reference).
- **Verification of the numbers:** the analytics response was hand-checked against the seeded sessions — 4 sessions in range, `Σ reps × weight = 11477.5 kg`, mean duration `(62+55+70+58)/4 = 61.25 → 61.3`, mean RPE `7.75 → 7.8`, adherence `4/17 = 23.5%`. The per-exercise breakdown sums back to the total (7445 + 2352.5 + 1680 = 11477.5), confirming no double counting.
- **Determinism:** the summary was requested before and after `E3` created `sess-9006`, and `sessionsCompleted` correctly moved 3 → 4, confirming the POST actually mutated state and the GET re-read it.

### Evidence index (`evidence.txt`)

| ID | Request | Result |
| --- | --- | --- |
| `E1` | `GET …/clients/c-1001/workout-plans` | `200 OK`, 1 plan |
| `E2` | `POST …/clients/c-1002/workout-plans` | `201 Created` + `Location`, `plan-5003` |
| `E3` | `POST …/clients/c-1001/workout-sessions` | `201 Created` + `Location`, `sess-9006` |
| `E4` | `GET …/clients/c-1001/progress-summary?from=2026-11-01&to=2026-11-30` | `200 OK`, 4 sessions, 11477.5 kg |
| `E5` | `POST …/clients/c-1001/workout-plans` with invalid body | **`400 VALIDATION_ERROR`** (5 field details) |
| `E6` | `POST …/clients/c-1002/workout-plans` duplicate active title | `409 PLAN_TITLE_CONFLICT` |
| `E7` | `GET …/clients/c-9999/workout-plans` | `404 CLIENT_NOT_FOUND` |
| `E8` | `GET …/progress-summary?from=2026-11-30&to=2026-11-01` | `400 VALIDATION_ERROR` |
| `E9` | `POST …/clients/c-1001/workout-sessions` with `c-1002`'s plan | `422 PLAN_CLIENT_MISMATCH` |

> Evidence note: `E6`–`E9` were captured from the same running process as `E1`–`E5`, so their `requestId` values differ but the responses are genuine, unedited HTTP output. In a real Postman collection these would be stored as example responses alongside each request.