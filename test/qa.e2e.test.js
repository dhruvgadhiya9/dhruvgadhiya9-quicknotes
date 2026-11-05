'use strict';

// QA end-to-end tests (QUI-5). Exercises the full HTTP stack: Express app,
// SQLite (in-memory) and the static frontend. Max 5 tests by project rule.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');

let app;

beforeEach(() => {
  app = createApp(openDb(':memory:'));
});

const add = (body) => request(app).post('/api/notes').send(body);

test('add: valid note is created; empty, blank, missing and >100 char titles are rejected', async () => {
  const ok = await add({ title: '  Hello  ', text: 'body' });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.title, 'Hello');
  assert.equal(ok.body.text, 'body');

  assert.equal((await add({ title: 'a'.repeat(100) })).status, 201);

  for (const bad of [{ title: '' }, { title: '   ' }, { text: 'no title' }, { title: 42 }, { title: 'a'.repeat(101) }]) {
    const res = await add(bad);
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(bad).slice(0, 40)}`);
    assert.ok(res.body.error);
  }

  const list = await request(app).get('/api/notes');
  assert.equal(list.body.length, 2, 'rejected notes must not be stored');
});

test('list: returns notes newest first and the app serves the single-page UI', async () => {
  for (const title of ['one', 'two', 'three']) await add({ title });
  const list = await request(app).get('/api/notes');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((n) => n.title), ['three', 'two', 'one']);

  const page = await request(app).get('/');
  assert.equal(page.status, 200);
  assert.match(page.text, /QuickNotes/);
  assert.equal((await request(app).get('/app.js')).status, 200);
  assert.equal((await request(app).get('/styles.css')).status, 200);
});

test('edit: PUT updates title and text, persists, and rejects invalid titles', async () => {
  const { body: note } = await add({ title: 'Old', text: 'old text' });

  const res = await request(app).put(`/api/notes/${note.id}`).send({ title: 'New', text: 'new text' });
  assert.equal(res.status, 200);
  assert.equal(res.body.title, 'New');
  assert.equal(res.body.text, 'new text');
  assert.equal(res.body.created_at, note.created_at);

  assert.equal((await request(app).put(`/api/notes/${note.id}`).send({ title: '  ' })).status, 400);
  assert.equal((await request(app).put(`/api/notes/${note.id}`).send({ title: 'a'.repeat(101) })).status, 400);

  const list = await request(app).get('/api/notes');
  assert.equal(list.body[0].title, 'New');
  assert.equal(list.body[0].text, 'new text');
});

test('delete: DELETE removes only the target note', async () => {
  const a = (await add({ title: 'keep' })).body;
  const b = (await add({ title: 'remove' })).body;

  const del = await request(app).delete(`/api/notes/${b.id}`);
  assert.equal(del.status, 204);

  const list = await request(app).get('/api/notes');
  assert.deepEqual(list.body.map((n) => n.id), [a.id]);
});

test('404 handling: unknown ids and routes return JSON errors; bad ids return 400', async () => {
  const put = await request(app).put('/api/notes/9999').send({ title: 'x' });
  assert.equal(put.status, 404);
  assert.deepEqual(put.body, { error: 'Note not found' });

  const del = await request(app).delete('/api/notes/9999');
  assert.equal(del.status, 404);
  assert.deepEqual(del.body, { error: 'Note not found' });

  const route = await request(app).get('/api/unknown');
  assert.equal(route.status, 404);
  assert.ok(route.body.error);

  assert.equal((await request(app).delete('/api/notes/abc')).status, 400);
});
