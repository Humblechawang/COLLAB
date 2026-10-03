// Centralized, validated configuration. The app refuses to boot with weak or
// missing secrets instead of silently running insecurely in production.
require('dotenv').config();

const required = (name) => {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
};

const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  // Fail fast rather than deploy with placeholder secrets.
  ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'].forEach(required);
  if ((process.env.JWT_ACCESS_SECRET || '').length < 32) {
    throw new Error('JWT_ACCESS_SECRET is too short for production use (need 32+ chars).');
  }
  if (process.env.COOKIES_SECURE !== 'true') {
    throw new Error('COOKIES_SECURE must be true in production.');
  }
}

module.exports = {
  isProd,
  port: parseInt(process.env.PORT || '4000', 10),
  db: {
    url: process.env.DATABASE_URL || 'postgres://collab:collab@localhost:5432/collab',
    ssl: process.env.DATABASE_SSL === 'true',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-only-insecure-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-only-insecure-secret-change-me-2',
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL || '30d',
  },
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()),
  },
  cookies: {
    secure: process.env.COOKIES_SECURE === 'true',
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  invite: {
    expiryHours: parseInt(process.env.INVITE_EXPIRY_HOURS || '168', 10),
  },
  upload: {
    maxMb: parseInt(process.env.MAX_UPLOAD_MB || '10', 10),
    dir: process.env.UPLOAD_DIR || './uploads',
    driver: process.env.STORAGE_DRIVER || 'local',
    avScanUrl: process.env.AV_SCAN_URL || '',
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
};
