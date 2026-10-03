const express = require('express');
const db = require('../db/pool');
const config = require('../config');
const { validate } = require('../utils/validate');
const {
  hashPassword, verifyPassword, signAccessToken, issueRefreshToken,
  rotateRefreshToken, revokeAllSessions, requireAuth,
  recordFailedLogin, clearFailedLogins,
} = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');

const router = express.Router();

const cookieOpts = (maxAgeMs) => ({
  httpOnly: true,
  secure: config.cookies.secure,
  sameSite: 'strict',
  maxAge: maxAgeMs,
  path: '/',
});

router.post('/signup', authLimiter, validate('signup'), async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body;
    const existing = await db.query('select id from users where email = $1', [email]);
    if (existing.rows.length) {
      const err = new Error('An account with this email already exists.');
      err.status = 409;
      return next(err);
    }
    const passwordHash = await hashPassword(password);
    const { rows } = await db.query(
      `insert into users (email, password_hash, full_name) values ($1, $2, $3)
       returning id, email, full_name, bio, avatar_url`,
      [email, passwordHash, fullName],
    );
    const user = rows[0];
    await issueSession(res, user, req);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/login', authLimiter, validate('login'), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { rows } = await db.query('select * from users where email = $1', [email]);
    const user = rows[0];

    // Constant-shape response whether the email exists or not, to avoid
    // leaking which emails are registered via response timing/content.
    const genericError = () => {
      const err = new Error('Incorrect email or password.');
      err.status = 401;
      return err;
    };
    if (!user) return next(genericError());

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const err = new Error('Too many failed attempts. Try again in a few minutes.');
      err.status = 423;
      return next(err);
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      await recordFailedLogin(user.id);
      return next(genericError());
    }

    await clearFailedLogins(user.id);
    await issueSession(res, user, req);
    res.json({ user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const raw = req.cookies?.refresh_token;
    if (!raw) {
      const err = new Error('Sign in required.');
      err.status = 401;
      return next(err);
    }
    const rotated = await rotateRefreshToken(raw, req);
    if (!rotated) {
      res.clearCookie('access_token');
      res.clearCookie('refresh_token');
      const err = new Error('Session expired. Please sign in again.');
      err.status = 401;
      return next(err);
    }
    const { rows } = await db.query('select id, email from users where id = $1', [rotated.userId]);
    const access = signAccessToken(rows[0]);
    res.cookie('access_token', access, cookieOpts(15 * 60 * 1000));
    res.cookie('refresh_token', rotated.refreshToken, cookieOpts(30 * 24 * 60 * 60 * 1000));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await revokeAllSessions(req.user.id);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'select id, email, full_name, bio, avatar_url from users where id = $1',
      [req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: publicUser(rows[0]) });
  } catch (err) { next(err); }
});

async function issueSession(res, user, req) {
  const access = signAccessToken(user);
  const refresh = await issueRefreshToken(user.id, req);
  res.cookie('access_token', access, cookieOpts(15 * 60 * 1000));
  res.cookie('refresh_token', refresh, cookieOpts(30 * 24 * 60 * 60 * 1000));
}

function publicUser(u) {
  return { id: u.id, email: u.email, fullName: u.full_name, bio: u.bio, avatarUrl: u.avatar_url };
}

module.exports = router;
