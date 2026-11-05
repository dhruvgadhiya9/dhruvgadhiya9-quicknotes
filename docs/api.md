# QuickNotes API Contract

REST + JSON, served by Express under `/api`. No authentication. Backend and frontend both build from this file.

## Conventions

- Base path: `/api`. Same origin as the page, so no CORS is needed.
- Requests with a body use `Content-Type: application/json`.
- All responses except `204` are `application/json; charset=utf-8`.
- Timestamps are ISO 8601 UTC strings with milliseconds, for example `2025-01-31T12:34:56.789Z`.
- `id` is a positive integer assigned by the server.

## Note object

| Field        | Type    | Notes                                       |
|--------------|---------|---------------------------------------------|
| `id`         | integer | Primary key, auto-increment                 |
| `title`      | string  | Required, trimmed, 1–100 chars              |
| `text`       | string  | Optional, defaults to `""`, max 10000 chars |
| `created_at` | string  | Set on insert, never changes                |
| `updated_at` | string  | Set on insert, refreshed on every update    |

```json
{
  "id": 1,
  "title": "Groceries",
  "text": "Milk\nEggs",
  "created_at": "2025-01-31T12:34:56.789Z",
  "updated_at": "2025-01-31T12:34:56.789Z"
}
```

## Database

One table, `notes`:

```sql
CREATE TABLE IF NOT EXISTS notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  text       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Always use parameterized queries (`?` placeholders).

## Validation rules (POST and PUT)

- Body must be a JSON object. Otherwise `400`.
- `title`: required, must be a string. It is trimmed first. After trimming it must be 1–100 characters.
- `text`: optional. If present it must be a string of at most 10000 characters. If omitted, POST stores `""`, and PUT sets it to `""` (PUT replaces the whole note).
- Unknown fields are ignored. `id`, `created_at` and `updated_at` in the body are ignored.
- Text is stored and returned as-is. The API does not escape HTML. Clients must render it with `textContent`.

## Error format

Every error response has this body:

```json
{ "error": "Title is required" }
```

`error` is a short human-readable string. Messages used:

| Status | Message                                           | When                                    |
|--------|---------------------------------------------------|-----------------------------------------|
| 400    | `Title is required`                               | Missing, non-string, or blank title     |
| 400    | `Title must be at most 100 characters`            | Title longer than 100 after trim        |
| 400    | `Text must be a string of at most 10000 characters` | Bad `text`                            |
| 400    | `Invalid JSON body`                               | Malformed JSON or body not an object    |
| 400    | `Invalid id`                                      | `:id` is not a positive integer         |
| 404    | `Note not found`                                  | No note with that id                    |
| 404    | `Not found`                                       | Unknown `/api/*` route                  |
| 500    | `Internal server error`                           | Unexpected failure, no internal details |

## Endpoints

### GET /api/notes

List all notes, newest first (`created_at` descending, `id` descending as tie-breaker).

Response `200`:

```json
[
  { "id": 2, "title": "Second", "text": "", "created_at": "2025-01-31T13:00:00.000Z", "updated_at": "2025-01-31T13:00:00.000Z" },
  { "id": 1, "title": "First", "text": "Hello", "created_at": "2025-01-31T12:00:00.000Z", "updated_at": "2025-01-31T12:00:00.000Z" }
]
```

With no notes the response is `200` with `[]`.

### POST /api/notes

Create a note.

Request:

```json
{ "title": "Groceries", "text": "Milk\nEggs" }
```

Response `201` with the created note (see Note object). Also sets `Location: /api/notes/1`.

Errors: `400` for validation.

```json
{ "error": "Title is required" }
```

### PUT /api/notes/:id

Replace the title and text of an existing note. `updated_at` is refreshed. `created_at` is kept.

Request:

```json
{ "title": "Groceries (edited)", "text": "Milk" }
```

Response `200` with the updated note:

```json
{
  "id": 1,
  "title": "Groceries (edited)",
  "text": "Milk",
  "created_at": "2025-01-31T12:34:56.789Z",
  "updated_at": "2025-01-31T14:00:00.000Z"
}
```

Errors: `400` for validation or invalid id, `404` if the note does not exist.

### DELETE /api/notes/:id

Delete a note.

Response `204` with no body.

Errors: `400` for invalid id, `404` if the note does not exist (`{ "error": "Note not found" }`).

## Status code summary

| Code | Used for                                          |
|------|---------------------------------------------------|
| 200  | GET list, PUT success                             |
| 201  | POST success                                      |
| 204  | DELETE success                                    |
| 400  | Validation error, bad id, malformed JSON          |
| 404  | Note or route not found                           |
| 500  | Unexpected server error                           |

## Client notes

- Check `res.ok`. On failure, read `{ error }` from the JSON body if present, but show the fixed UI messages from `docs/design/spec.md`.
- A `204` response has no body. Do not call `res.json()` on it.
- Send the trimmed title. The server trims too and is the source of truth.
