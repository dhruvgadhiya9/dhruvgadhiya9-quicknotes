'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');

let app;

beforeEach(() => {
  // Fresh in-memory database for every test.
  app = createApp(openDb(':memory:'));
});

test('POST creates a note with a trimmed title and GET lists it', async () => {
  const created = await request(app)
    .post('/api/notes')
    .send({ title: '  Groceries  ', text: 'Milk\nEggs' });
  assert.equal(created.status, 201);
  assert.equal(created.body.title, 'Groceries');
  assert.equal(created.body.text, 'Milk\nEggs');
  assert.equal(created.headers.location, `/api/notes/${created.body.id}`);
  assert.ok(created.body.created_at);

  const list = await request(app).get('/api/notes');
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].id, created.body.id);
});

test('GET returns notes newest first', async () => {
  await request(app).post('/api/notes').send({ title: 'First' });
  await request(app).post('/api/notes').send({ title: 'Second' });
  const list = await request(app).get('/api/notes');
  assert.deepEqual(
    list.body.map((n) => n.title),
    ['Second', 'First']
  );
});

test('POST rejects missing, blank and too long titles', async () => {
  const missing = await request(app).post('/api/notes').send({ text: 'x' });
  assert.equal(missing.status, 400);
  assert.deepEqual(missing.body, { error: 'Title is required' });

  const blank = await request(app).post('/api/notes').send({ title: '   ' });
  assert.equal(blank.status, 400);
  assert.equal(blank.body.error, 'Title is required');

  const long = await request(app).post('/api/notes').send({ title: 'a'.repeat(101) });
  assert.equal(long.status, 400);
  assert.equal(long.body.error, 'Title must be at most 100 characters');

  const ok = await request(app).post('/api/notes').send({ title: 'a'.repeat(100) });
  assert.equal(ok.status, 201);

  const badJson = await request(app)
    .post('/api/notes')
    .set('Content-Type', 'application/json')
    .send('{not json');
  assert.equal(badJson.status, 400);
  assert.equal(badJson.body.error, 'Invalid JSON body');
});

test('PUT updates a note, keeps created_at, and validates', async () => {
  const created = await request(app).post('/api/notes').send({ title: 'Old', text: 'old' });
  const id = created.body.id;

  const updated = await request(app).put(`/api/notes/${id}`).send({ title: 'New' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.title, 'New');
  assert.equal(updated.body.text, '');
  assert.equal(updated.body.created_at, created.body.created_at);

  const invalid = await request(app).put(`/api/notes/${id}`).send({ title: '' });
  assert.equal(invalid.status, 400);

  const missing = await request(app).put('/api/notes/9999').send({ title: 'x' });
  assert.equal(missing.status, 404);
  assert.deepEqual(missing.body, { error: 'Note not found' });

  const badId = await request(app).put('/api/notes/abc').send({ title: 'x' });
  assert.equal(badId.status, 400);
  assert.deepEqual(badId.body, { error: 'Invalid id' });
});

test('DELETE removes a note, then returns 404', async () => {
  const created = await request(app).post('/api/notes').send({ title: 'Temp' });
  const id = created.body.id;

  const del = await request(app).delete(`/api/notes/${id}`);
  assert.equal(del.status, 204);

  const again = await request(app).delete(`/api/notes/${id}`);
  assert.equal(again.status, 404);

  const list = await request(app).get('/api/notes');
  assert.deepEqual(list.body, []);
});

test('SQL injection strings are stored as plain text and unknown API routes 404', async () => {
  const evil = "x'); DROP TABLE notes;--";
  const created = await request(app).post('/api/notes').send({ title: evil, text: '<script>1</script>' });
  assert.equal(created.status, 201);
  assert.equal(created.body.title, evil);
  assert.equal(created.body.text, '<script>1</script>');

  const list = await request(app).get('/api/notes');
  assert.equal(list.body.length, 1);

  const unknown = await request(app).get('/api/nope');
  assert.equal(unknown.status, 404);
  assert.deepEqual(unknown.body, { error: 'Not found' });
});
