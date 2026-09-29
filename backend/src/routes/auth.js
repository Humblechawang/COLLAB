const express = require('express');
const db = require('../db/pool');
const { validate } = require('../utils/validate');
const { requireAuth, requireConfirmedEmail } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');
const { logAction } = require('../utils/audit');

const router = express.Router();

function gone(req, res) {
  res.status(410).json({
    error: 'Use Supabase Auth for sign-up, sign-in, and password reset.',
    requestId: req.id,
  });
}

router.post('/signup', authLimiter, gone);
router.post('/login', authLimiter, gone);
router.post('/refresh', gone);

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await logAction(req, { actorId: req.user.id, action: 'auth.logout' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, requireConfirmedEmail, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      req,
      'select id, full_name, bio, avatar_url from profiles where id = $1',
      [req.user.id],
    );
    if (!rows[0]) {
      const { rows: created } = await db.query(
        req,
        `insert into profiles (id, full_name)
         values ($1, $2)
         on conflict (id) do update set full_name = coalesce(nullif(profiles.full_name, ''), excluded.full_name)
         returning id, full_name, bio, avatar_url`,
        [req.user.id, profileNameFromEmail(req.user.email)],
      );
      return res.json({ user: publicUser(created[0], req.user.email) });
    }
    res.json({ user: publicUser(rows[0], req.user.email) });
  } catch (err) { next(err); }
});

router.patch('/me', requireAuth, requireConfirmedEmail, validate('updateProfile'), async (req, res, next) => {
  try {
    const { fullName, bio } = req.body;
    const { rows } = await db.query(
      req,
      `update profiles set
         full_name = coalesce($1, full_name),
         bio = coalesce($2, bio)
       where id = $3
       returning id, full_name, bio, avatar_url`,
      [fullName || null, bio || null, req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: publicUser(rows[0], req.user.email) });
  } catch (err) { next(err); }
});

function profileNameFromEmail(email) {
  const local = String(email || '').split('@')[0].slice(0, 80);
  return local.length >= 2 ? local : 'Member';
}

function publicUser(u, email) {
  return { id: u.id, email: email || null, fullName: u.full_name, bio: u.bio, avatarUrl: u.avatar_url };
}

module.exports = router;
