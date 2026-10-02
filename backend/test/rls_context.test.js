process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { rlsClaimsFor, sslOption } = require('../src/db/pool');
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

test('Postgres TLS loads a configured CA without disabling certificate validation', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-ca-'));
  const caPath = path.join(directory, 'root.crt');
  const ca = '-----BEGIN CERTIFICATE-----\nTEST CA\n-----END CERTIFICATE-----\n';
  fs.writeFileSync(caPath, ca);
  try {
    const ssl = sslOption({ ssl: true, sslRejectUnauthorized: true, sslCaFile: caPath });
    assert.equal(ssl.rejectUnauthorized, true);
    assert.equal(ssl.ca.toString(), ca);
    assert.equal(sslOption({ ssl: false }), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('live Auth user confirmation uses email_confirmed_at not JWT claims', () => {
  assert.equal(isLiveEmailConfirmed({ email: 'a@b.co' }), false);
  assert.equal(isLiveEmailConfirmed({ email: 'a@b.co', email_confirmed_at: '2026-01-01T00:00:00Z' }), true);
});
