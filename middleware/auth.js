const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');
const db = require('../db/pool');

const hashPassword = (plain) => bcrypt.hash(plain, config.bcryptRounds);
const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

// Refresh tokens are random, opaque strings. We store only their SHA-256 hash,
// so a stolen database dump can never be replayed as a live session.
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl, issuer: 'collab-api' },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret, { issuer: 'collab-api' });
}

async function issueRefreshToken(userId, req) {
  const raw = crypto.randomBytes(48).toString('hex');
  const ttlMs = parseTtlToMs(config.jwt.refreshTtl);
  const ipHash = req?.ip ? sha256(req.ip) : null;
  await db.query(
    `insert into sessions (user_id, refresh_hash, user_agent, ip_hash, expires_at)
     values ($1, $2, $3, $4, now() + ($5 || ' milliseconds')::interval)`,
    [userId, sha256(raw), req?.headers['user-agent'] || null, ipHash, ttlMs],
  );
  return raw;
}

async function rotateRefreshToken(rawToken, req) {
  const hash = sha256(rawToken);
  const { rows } = await db.query(
    `select * from sessions where refresh_hash = $1 and revoked_at is null and expires_at > now()`,
    [hash],
  );
  const session = rows[0];
  if (!session) return null;

  // Rotation: revoke the used token immediately and issue a new one. If a
  // revoked token is ever presented again, that's a signal of theft/replay.
  await db.query('update sessions set revoked_at = now() where id = $1', [session.id]);
  const newRaw = await issueRefreshToken(session.user_id, req);
  return { userId: session.user_id, refreshToken: newRaw };
}

async function revokeAllSessions(userId) {
  await db.query('update sessions set revoked_at = now() where user_id = $1 and revoked_at is null', [userId]);
}

function parseTtlToMs(ttl) {
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) return 30 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
  return n * mult;
}

// --- Express middleware: requires a valid access token ---
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.access_token;
  if (!token) {
    const err = new Error('Sign in required.');
    err.status = 401;
    return next(err);
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    const err = new Error('Session expired. Please sign in again.');
    err.status = 401;
    next(err);
  }
}

// Account lockout after repeated failed logins, to blunt brute force even
// past the IP-based rate limiter (e.g. distributed attempts).
const LOCKOUT_THRESHOLD = 8;
const LOCKOUT_MINUTES = 15;

async function recordFailedLogin(userId) {
  await db.query(
    `update users set failed_logins = failed_logins + 1,
       locked_until = case when failed_logins + 1 >= $2
         then now() + ($3 || ' minutes')::interval else locked_until end
     where id = $1`,
    [userId, LOCKOUT_THRESHOLD, LOCKOUT_MINUTES],
  );
}

async function clearFailedLogins(userId) {
  await db.query('update users set failed_logins = 0, locked_until = null where id = $1', [userId]);
}

module.exports = {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllSessions,
  requireAuth,
  recordFailedLogin,
  clearFailedLogins,
  sha256,
};
