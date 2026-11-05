'use strict';

const path = require('node:path');
const express = require('express');

const TITLE_MAX = 100;
const TEXT_MAX = 10000;
const COLUMNS = 'id, title, text, created_at, updated_at';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function parseId(raw) {
  if (!/^[1-9]\d*$/.test(raw)) throw new HttpError(400, 'Invalid id');
  const id = Number(raw);
  if (!Number.isSafeInteger(id)) throw new HttpError(400, 'Invalid id');
  return id;
}

/** Validate a POST/PUT body and return the cleaned { title, text }. */
function validateNote(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Invalid JSON body');
  }
  if (typeof body.title !== 'string' || body.title.trim() === '') {
    throw new HttpError(400, 'Title is required');
  }
  const title = body.title.trim();
  if (title.length > TITLE_MAX) {
    throw new HttpError(400, 'Title must be at most 100 characters');
  }
  let text = '';
  if (body.text !== undefined) {
    if (typeof body.text !== 'string' || body.text.length > TEXT_MAX) {
      throw new HttpError(400, 'Text must be a string of at most 10000 characters');
    }
    text = body.text;
  }
  return { title, text };
}

function createApp(db) {
  const app = express();
  app.disable('x-powered-by');

  const listNotes = db.prepare(`SELECT ${COLUMNS} FROM notes ORDER BY created_at DESC, id DESC`);
  const getNote = db.prepare(`SELECT ${COLUMNS} FROM notes WHERE id = ?`);
  const insertNote = db.prepare(
    'INSERT INTO notes (title, text, created_at, updated_at) VALUES (?, ?, ?, ?)'
  );
  const updateNote = db.prepare('UPDATE notes SET title = ?, text = ?, updated_at = ? WHERE id = ?');
  const deleteNote = db.prepare('DELETE FROM notes WHERE id = ?');

  const api = express.Router();
  api.use(express.json({ limit: '100kb' }));

  api.get('/notes', (req, res) => {
    res.json(listNotes.all());
  });

  api.post('/notes', (req, res) => {
    const { title, text } = validateNote(req.body);
    const now = new Date().toISOString();
    const info = insertNote.run(title, text, now, now);
    const note = getNote.get(info.lastInsertRowid);
    res.status(201).location(`/api/notes/${note.id}`).json(note);
  });

  api.put('/notes/:id', (req, res) => {
    const id = parseId(req.params.id);
    const { title, text } = validateNote(req.body);
    const info = updateNote.run(title, text, new Date().toISOString(), id);
    if (info.changes === 0) throw new HttpError(404, 'Note not found');
    res.json(getNote.get(id));
  });

  api.delete('/notes/:id', (req, res) => {
    const id = parseId(req.params.id);
    const info = deleteNote.run(id);
    if (info.changes === 0) throw new HttpError(404, 'Note not found');
    res.status(204).end();
  });

  api.use((req, res, next) => next(new HttpError(404, 'Not found')));

  app.use('/api', api);
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    if (err.type === 'entity.too.large') {
      return res
        .status(400)
        .json({ error: 'Text must be a string of at most 10000 characters' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
