require('dotenv').config();

const required = (name) => {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
};

const isPlaceholder = (value) => {
  if (!value) return true;
  const s = String(value).toLowerCase();
  return (
    s.includes('replace_me')
    || s.includes('your_project')
    || s.includes('user:password@host')
    || s.includes('sb_publishable_replace')
  );
};

const nodeEnv = process.env.NODE_ENV || 'development';
const appEnv = process.env.APP_ENV || nodeEnv;
const isTest = nodeEnv === 'test';
const isProd = nodeEnv === 'production' || appEnv === 'production';
const isProdLike = isProd || appEnv === 'staging';

function parseTrustProxyHops() {
  const raw = process.env.TRUST_PROXY_HOPS;
  if (raw === undefined || raw === '') return isProdLike ? 1 : 0;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0 || n > 5) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5.');
  }
  return n;
}

function parseCorsOrigins() {
  const raw = process.env.CORS_ORIGINS;
  if (!raw || !raw.trim()) {
    if (isProdLike) {
      throw new Error('CORS_ORIGINS is required in staging and production.');
    }
    return ['http://localhost:8080', 'http://127.0.0.1:8080'];
  }
  const origins = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (origins.some((o) => o === '*' || o.includes('*'))) {
    throw new Error('CORS_ORIGINS must be an explicit allowlist; wildcards are not allowed.');
  }
  return origins;
}

function runtimeDbUser(connectionString) {
  try {
    return decodeURIComponent(new URL(connectionString).username || '');
  } catch {
    return '';
  }
}

function assertRuntimeDbRole(connectionString) {
  const user = runtimeDbUser(connectionString);
  if (!user) {
    throw new Error('DATABASE_URL must include a username (collab_api).');
  }
  if (/^postgres(\.|$)/i.test(user) || user === 'supabase_admin' || user === 'supabase_auth_admin') {
    throw new Error('DATABASE_URL must use collab_api, not a superuser, owner, or Auth admin role.');
  }
}

if (!isTest) {
  required('DATABASE_URL');
  required('DATABASE_MIGRATE_URL');
  required('SUPABASE_URL');
  required('SUPABASE_PUBLISHABLE_KEY');
  if (isPlaceholder(process.env.DATABASE_URL) || isPlaceholder(process.env.SUPABASE_URL)) {
    throw new Error('DATABASE_URL and SUPABASE_URL must be real Supabase values, not placeholders.');
  }
  assertRuntimeDbRole(process.env.DATABASE_URL);
}

if (isProdLike && !isTest) {
  required('CORS_ORIGINS');
  if (process.env.COOKIES_SECURE !== 'true' && isProd) {
    throw new Error('COOKIES_SECURE must be true in production.');
  }
}

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');

module.exports = {
  nodeEnv,
  appEnv,
  isProd,
  isProdLike,
  isTest,
  port: parseInt(process.env.PORT || '4000', 10),
  trustProxyHops: parseTrustProxyHops(),
  db: {
    url: process.env.DATABASE_URL || '',
    migrateUrl: process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL || '',
    ssl: process.env.DATABASE_SSL !== 'false',
    sslRejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
  },
  supabase: {
    url: supabaseUrl,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
    issuer: supabaseUrl ? `${supabaseUrl}/auth/v1` : '',
  },
  cors: { origins: parseCorsOrigins() },
  cookies: { secure: process.env.COOKIES_SECURE === 'true' },
  invite: { expiryHours: parseInt(process.env.INVITE_EXPIRY_HOURS || '168', 10) },
  upload: {
    enabled: false,
    maxMb: parseInt(process.env.MAX_UPLOAD_MB || '10', 10),
  },
  email: {
    provider: process.env.EMAIL_PROVIDER || 'resend',
    apiKey: process.env.EMAIL_API_KEY || '',
    from: process.env.EMAIL_FROM || 'Collab <no-reply@collab.app>',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
  },
  listLimit: parseInt(process.env.LIST_LIMIT_MAX || '50', 10),
};
