'use strict';

process.env.NODE_ENV = 'test';
process.env.APP_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canDeleteOwnedResource, requireRole } = require('../src/middleware/authorize');
const { schemas } = require('../src/utils/validate');

test('password signup is removed; callers must use Supabase Auth', async () => {
  process.env.NODE_ENV = 'test';
  const { createApp } = require('../src/app');
  const app = createApp();
  const http = require('http');
  await new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const req = http.request({
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: '/api/auth/signup',
        headers: { 'content-type': 'application/json' },
      }, (res) => {
        assert.equal(res.statusCode, 410);
        server.close();
        resolve();
      });
      req.on('error', reject);
      req.end(JSON.stringify({ fullName: 'Test User', email: 'a@b.co', password: 'ValidPass1x' }));
    });
  });
});

test('GET team with a non-uuid id does not become another team', async () => {
  process.env.NODE_ENV = 'test';
  const { createApp } = require('../src/app');
  const app = createApp();
  const http = require('http');
  await new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const req = http.request({
        host: '127.0.0.1',
        port,
        method: 'GET',
        path: '/api/teams/other-team-slug',
      }, (res) => {
        assert.equal(res.statusCode, 400);
        server.close();
        resolve();
      });
      req.on('error', reject);
      req.end();
    });
  });
});

test('members may delete only their own content while owner/admin may delete team content', () => {
  const memberId = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';

  assert.equal(canDeleteOwnedResource(memberId, memberId, 'member'), true);
  assert.equal(canDeleteOwnedResource(otherId, memberId, 'member'), false);
  assert.equal(canDeleteOwnedResource(otherId, memberId, 'admin'), true);
  assert.equal(canDeleteOwnedResource(otherId, memberId, 'owner'), true);
  assert.equal(canDeleteOwnedResource(otherId, null, 'admin'), false);
});

test('only owners and admins pass the team-management role gate', () => {
  function authorize(role) {
    let called = false;
    let error;
    requireRole('owner', 'admin')({ membership: role ? { role } : null }, {}, (nextError) => {
      called = true;
      error = nextError;
    });
    return { called, error };
  }

  assert.deepEqual(authorize('owner'), { called: true, error: undefined });
  assert.deepEqual(authorize('admin'), { called: true, error: undefined });
  assert.equal(authorize('member').error.status, 403);
  assert.equal(authorize(null).error.status, 403);
});

test('visibility can be explicitly disabled and empty team updates are rejected', () => {
  assert.deepEqual(schemas.updateTeam.parse({ isPublic: false }), { isPublic: false });
  assert.equal(schemas.updateTeam.safeParse({}).success, false);
});

test('invite validation cannot grant owner role', () => {
  assert.equal(schemas.invite.safeParse({ email: 'new@example.com', role: 'admin' }).success, true);
  assert.equal(schemas.invite.safeParse({ email: 'new@example.com', role: 'owner' }).success, false);
});
