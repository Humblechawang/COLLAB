'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rejectUploads } = require('../src/middleware/upload');

test('multipart uploads are rejected with 503', () => {
  const req = { headers: { 'content-type': 'multipart/form-data; boundary=x' } };
  let captured;
  rejectUploads(req, {}, (err) => { captured = err; });
  assert.equal(captured.status, 503);
});

test('json requests are not treated as uploads', () => {
  const req = { headers: { 'content-type': 'application/json' } };
  let called = false;
  rejectUploads(req, {}, () => { called = true; });
  assert.equal(called, true);
});
