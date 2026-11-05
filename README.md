# QuickNotes

Project: QuickNotes — a minimal single-page notes app.

Node.js + Express + SQLite (one `notes` table). Express also serves the static frontend from `public/`.

## Run

Requires Node.js 18 or newer.

```bash
npm install
npm start          # http://localhost:3000
```

Environment variables:

- `PORT` — port to listen on (default `3000`)
- `DB_PATH` — SQLite file (default `data/notes.db`, created on first start)

## Test

```bash
npm test
```

API tests use `node:test` and `supertest` with an in-memory database.

## API

- Human-readable contract: [docs/api.md](docs/api.md)
- OpenAPI: [docs/api/openapi.yaml](docs/api/openapi.yaml)

| Method | Path             | Description              |
|--------|------------------|--------------------------|
| GET    | `/api/notes`     | List notes, newest first |
| POST   | `/api/notes`     | Create a note            |
| PUT    | `/api/notes/:id` | Replace title and text   |
| DELETE | `/api/notes/:id` | Delete a note            |
