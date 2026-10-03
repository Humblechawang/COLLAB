const express = require('express');
const crypto = require('crypto');
const db = require('../db/pool');
const config = require('../config');
const { validate } = require('../utils/validate');
const { requireAuth, sha256 } = require('../middleware/auth');
const { loadMembership, requireMember, requireRole } = require('../middleware/authorize');
const { inviteLimiter } = require('../middleware/security');
const { sendInviteEmail } = require('../utils/email');
const { logAction } = require('../utils/audit');

const router = express.Router({ mergeParams: true });

router.post('/:teamId/invites', requireAuth, inviteLimiter, loadMembership(), requireMember(), requireRole('owner', 'admin'), validate('invite'), async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const dup = await db.query(
      `select id from invites where team_id = $1 and email = $2 and status = 'pending'`,
      [req.teamId, email],
    );
    if (dup.rows.length) {
      const err = new Error('This person already has a pending invite.');
      err.status = 409;
      return next(err);
    }
    const rawToken = crypto.randomBytes(32).toString('hex');
    const { rows } = await db.query(
      `insert into invites (team_id, email, role, token_hash, invited_by, expires_at)
       values ($1, $2, $3, $4, $5, now() + ($6 || ' hours')::interval)
       returning id, email, role, expires_at`,
      [req.teamId, email, role, sha256(rawToken), req.user.id, config.invite.expiryHours],
    );
    await sendInviteEmail({ to: email, teamId: req.teamId, rawToken });
    await logAction({ actorId: req.user.id, teamId: req.teamId, action: 'invite.created', target: email });
    res.status(201).json({ invite: rows[0] });
  } catch (err) { next(err); }
});

router.get('/:teamId/invites', requireAuth, loadMembership(), requireMember(), requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `select id, email, role, status, expires_at, created_at from invites
       where team_id = $1 and status = 'pending' order by created_at desc`,
      [req.teamId],
    );
    res.json({ invites: rows });
  } catch (err) { next(err); }
});

router.delete('/:teamId/invites/:inviteId', requireAuth, loadMembership(), requireMember(), requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    await db.query(
      `update invites set status = 'revoked' where id = $1 and team_id = $2 and status = 'pending'`,
      [req.params.inviteId, req.teamId],
    );
    await logAction({ actorId: req.user.id, teamId: req.teamId, action: 'invite.revoked', target: req.params.inviteId });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Accepting an invite: token is single-use, must match the signed-in user's
// email, and must not be expired. This is the only path into a team's
// membership table — there is no "join by guessing a slug" route.
router.post('/accept', requireAuth, validate('acceptInvite'), async (req, res, next) => {
  try {
    const tokenHash = sha256(req.body.token);
    const { rows } = await db.query(
      `select * from invites where token_hash = $1 and status = 'pending' and expires_at > now()`,
      [tokenHash],
    );
    const invite = rows[0];
    if (!invite) {
      const err = new Error('This invite is invalid or has expired.');
      err.status = 410;
      return next(err);
    }
    const { rows: userRows } = await db.query('select email from users where id = $1', [req.user.id]);
    if (userRows[0].email !== invite.email) {
      const err = new Error('This invite was sent to a different email address.');
      err.status = 403;
      return next(err);
    }

    // A single transaction guarantees the invite can never be marked accepted
    // without the membership row actually being created, and vice versa.
    await db.withTransaction(async (client) => {
      await client.query(
        `insert into members (team_id, user_id, role) values ($1, $2, $3)
         on conflict (team_id, user_id) do nothing`,
        [invite.team_id, req.user.id, invite.role],
      );
      await client.query(`update invites set status = 'accepted', accepted_at = now() where id = $1`, [invite.id]);
    });

    await logAction({ actorId: req.user.id, teamId: invite.team_id, action: 'invite.accepted' });
    res.json({ teamId: invite.team_id });
  } catch (err) { next(err); }
});

module.exports = router;
