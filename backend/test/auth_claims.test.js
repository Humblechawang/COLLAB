'use strict';

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isEmailConfirmed, verifiedEmail } = require('../src/middleware/auth');
const { UUID_RE } = require('../src/middleware/authorize');

test('unverified JWT email is not trusted', () => {
  const payload = { sub: '11111111-1111-4111-8111-111111111111', email: 'a@b.co' };
  assert.equal(isEmailConfirmed(payload), false);
  assert.equal(verifiedEmail(payload), null);
});

test('confirmed email is accepted from user_metadata', () => {
  const payload = {
    sub: '11111111-1111-4111-8111-111111111111',
    email: 'a@b.co',
    user_metadata: { email_verified: true, email: 'a@b.co' },
  };
  assert.equal(isEmailConfirmed(payload), true);
  assert.equal(verifiedEmail(payload), 'a@b.co');
});

test('non-uuid member ids are rejected by the same pattern used in routes', () => {
  assert.equal(UUID_RE.test('not-a-uuid'), false);
  assert.equal(UUID_RE.test('11111111-1111-4111-8111-111111111111'), true);
});
