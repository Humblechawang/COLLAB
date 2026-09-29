'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

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
