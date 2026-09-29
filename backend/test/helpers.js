'use strict';

const http = require('http');
const { spawnSync } = require('child_process');
const path = require('path');

const backendRoot = path.join(__dirname, '..');

function testEnv() {
  return {
    ...process.env,
    NODE_ENV: 'test',
    APP_ENV: 'test',
    DATABASE_SSL: 'false',
    DATABASE_MIGRATE_URL: process.env.DATABASE_MIGRATE_URL || 'postgres://collab:collab@localhost:5432/collab',
    DATABASE_URL: process.env.DATABASE_URL || process.env.DATABASE_MIGRATE_URL || 'postgres://collab:collab@localhost:5432/collab',
    APP_DB_USER: process.env.APP_DB_USER || 'collab_app',
    APP_DB_PASSWORD: process.env.APP_DB_PASSWORD || 'collab_app_dev',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'ci-test-access-secret-which-is-32-chars-min',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'ci-test-refresh-secret-which-is-32-chars',
    CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:8080',
    COOKIES_SECURE: 'false',
    TRUST_PROXY_HOPS: '0',
    RATE_LIMIT_MAX: '10000',
    AUTH_RATE_LIMIT_MAX: '10000',
  };
}

function applyTestEnv() {
  const env = testEnv();
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) process.env[k] = v;
  }
  return env;
}

function migrateOrThrow() {
  const env = testEnv();
  const result = spawnSync(process.execPath, ['src/db/migrate.js'], {
    cwd: backendRoot,
    env,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
    const err = new Error('migrate failed');
    err.output = combined;
    err.status = result.status;
    throw err;
  }
}

function parseCookies(setCookieHeaders) {
  const jar = {};
  for (const header of setCookieHeaders || []) {
    const part = String(header).split(';')[0];
    const eq = part.indexOf('=');
    if (eq > 0) jar[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
  }
  return jar;
}

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

function request(app, { method, path: urlPath, json, headers, cookieJar }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const body = json ? Buffer.from(JSON.stringify(json)) : null;
      const reqHeaders = {
        ...(headers || {}),
      };
      if (json) {
        reqHeaders['content-type'] = 'application/json';
        reqHeaders['content-length'] = String(body.length);
      }
      if (cookieJar && Object.keys(cookieJar).length) {
        reqHeaders.cookie = cookieHeader(cookieJar);
      }
      const req = http.request({
        host: '127.0.0.1',
        port,
        method,
        path: urlPath,
        headers: reqHeaders,
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          server.close();
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
          const setCookie = res.headers['set-cookie'] || [];
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
            cookies: { ...cookieJar, ...parseCookies(setCookie) },
          });
        });
      });
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (body) req.write(body);
      req.end();
    });
  });
}

function unique(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

module.exports = {
  applyTestEnv,
  migrateOrThrow,
  request,
  unique,
  testEnv,
};
