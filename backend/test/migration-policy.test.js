'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { migrationDisposition } = require('../src/db/migration-policy');

test('the manually adopted baseline remains eligible for tracking', () => {
  assert.equal(migrationDisposition('20260930000000_baseline.sql'), 'baseline');
});

test('legacy auth/RLS migrations are held for a forward-only plan', () => {
  assert.equal(migrationDisposition('20260930001000_auth_profiles_rls.sql'), 'hold');
  assert.equal(migrationDisposition('20260930002000_express_only_rls.sql'), 'hold');
  assert.equal(migrationDisposition('20260930003000_rls_request_jwt.sql'), 'hold');
});

test('new migrations require explicit review and registration', () => {
  assert.equal(migrationDisposition('20261002000000_chat.sql'), 'unreviewed');
});
