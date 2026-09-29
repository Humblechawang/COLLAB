process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rlsClaimsFor } = require('../src/db/pool');
const { isLiveEmailConfirmed } = require('../src/middleware/auth');

test('RLS claims for a user are only sub and role authenticated', () => {
  const claims = rlsClaimsFor({ user: { id: '11111111-1111-4111-8111-111111111111', email: 'a@b.co' } });
  assert.deepEqual(Object.keys(claims).sort(), ['role', 'sub']);
  assert.equal(claims.role, 'authenticated');
  assert.equal(claims.sub, '11111111-1111-4111-8111-111111111111');
  assert.equal(claims.email, undefined);
});

test('anonymous RLS claims are role anon only', () => {
  assert.deepEqual(rlsClaimsFor({}), { role: 'anon' });
});

test('live Auth user confirmation uses email_confirmed_at not JWT claims', () => {
  assert.equal(isLiveEmailConfirmed({ email: 'a@b.co' }), false);
  assert.equal(isLiveEmailConfirmed({ email: 'a@b.co', email_confirmed_at: '2026-01-01T00:00:00Z' }), true);
});
