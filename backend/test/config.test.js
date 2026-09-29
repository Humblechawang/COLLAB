'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

test('production config refuses missing DATABASE_URL without printing secrets', () => {
  const result = spawnSync(process.execPath, ['-e', `
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'production';
    process.env.DATABASE_URL = '';
    process.env.DATABASE_MIGRATE_URL = 'postgres://u:p@localhost:5432/db';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    process.env.CORS_ORIGINS = 'https://example.com';
    process.env.COOKIES_SECURE = 'true';
    require('./src/config');
  `], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  assert.match(out, /DATABASE_URL/);
  assert.doesNotMatch(out, /postgres:\/\/u:p/);
});

test('production config refuses placeholder SUPABASE_URL', () => {
  const result = spawnSync(process.execPath, ['-e', `
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://u:p@db.example:6543/postgres';
    process.env.DATABASE_MIGRATE_URL = 'postgres://u:p@db.example:5432/postgres';
    process.env.SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_replace_me';
    process.env.CORS_ORIGINS = 'https://example.com';
    process.env.COOKIES_SECURE = 'true';
    require('./src/config');
  `], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
});

test('production config refuses postgres owner DATABASE_URL', () => {
  const result = spawnSync(process.execPath, ['-e', `
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://postgres.abc:x@db.example:6543/postgres';
    process.env.DATABASE_MIGRATE_URL = 'postgres://postgres.abc:x@db.example:5432/postgres';
    process.env.SUPABASE_URL = 'https://abc.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    process.env.CORS_ORIGINS = 'https://example.com';
    process.env.COOKIES_SECURE = 'true';
    require('./src/config');
  `], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  assert.match(out, /collab_api/);
});

test('CORS wildcards are rejected', () => {
  const result = spawnSync(process.execPath, ['-e', `
    process.env.NODE_ENV = 'test';
    process.env.CORS_ORIGINS = '*';
    require('./src/config');
  `], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
});
