const express = require('express');
const crypto = require('crypto');
const db = require('../db/pool');
const config = require('../config');
const { validate } = require('../utils/validate');
const { requireAuth, requireConfirmedEmail, sha256 } = require('../middleware/auth');
const { loadMembership, requireMember, requireRole } = require('../middleware/authorize');
const { inviteLimiter } = require('../middleware/security');
const { sendInviteEmail } = require('../utils/email');
const { logAction } = require('../utils/audit');

const router = express.Router({ mergeParams: true });

router.post('/:teamId/invites', requireAuth, inviteLimiter, loadMembership(), requireMember(), requireRole('owner', 'admin'), validate('invite'), async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const dup = await db.query(
      req,
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
      req,
      `insert into invites (team_id, email, role, token_hash, invited_by, expires_at)
       values ($1, $2, $3, $4, $5, now() + ($6 || ' hours')::interval)
       returning id, email, role, expires_at`,
      [req.teamId, email, role, sha256(rawToken), req.user.id, config.invite.expiryHours],
    );
    await sendInviteEmail({ to: email, teamId: req.teamId, rawToken });
    await logAction(req, { actorId: req.user.id, teamId: req.teamId, action: 'invite.created', target: email });
    res.status(201).json({ invite: rows[0] });
  } catch (err) { next(err); }
});

router.get('/:teamId/invites', requireAuth, loadMembership(), requireMember(), requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      req,
      `select id, email, role, status, expires_at, created_at from invites
       where team_id = $1 and status = 'pending' order by created_at desc`,
      [req.teamId],
    );
    res.json({ invites: rows });
  } catch (err) { next(err); }
});

router.delete('/:teamId/invites/:inviteId', requireAuth, loadMembership(), requireMember(), requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      req,
      `update invites set status = 'revoked' where id = $1 and team_id = $2 and status = 'pending'`,
      [req.params.inviteId, req.teamId],
    );
    if (!rowCount) {
      const err = new Error('Invite not found.');
      err.status = 404;
      return next(err);
    }
    await logAction(req, { actorId: req.user.id, teamId: req.teamId, action: 'invite.revoked', target: req.params.inviteId });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/accept', requireAuth, requireConfirmedEmail, validate('acceptInvite'), async (req, res, next) => {
  try {
    const tokenHash = sha256(req.body.token);
    const email = (req.user.email || '').toLowerCase();
    const result = await db.withTransaction(req, async (client) => {
      const { rows } = await client.query(
        'select public.accept_team_invite($1, $2) as team_id',
        [tokenHash, email],
      );
      const teamId = rows[0] && rows[0].team_id;
      if (!teamId) {
        const err = new Error('This invite is invalid or has expired.');
        err.status = 410;
        throw err;
      }
      return { team_id: teamId };
    });

    await logAction(req, { actorId: req.user.id, teamId: result.team_id, action: 'invite.accepted' });
    res.json({ teamId: result.team_id });
  } catch (err) {
    if (err.code === 'P0001' || /invite/i.test(err.message || '')) {
      err.status = err.status || 410;
      err.publicMessage = err.message;
    }
    next(err);
  }
});

module.exports = router;
