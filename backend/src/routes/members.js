const express = require('express');
const db = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { loadMembership, requireMember, requireRole, UUID_RE } = require('../middleware/authorize');
const { logAction } = require('../utils/audit');

const router = express.Router({ mergeParams: true });

router.get('/:teamId/members', requireAuth, loadMembership(), requireMember(), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      req,
      `select u.id, u.full_name, u.bio, u.avatar_url, m.role, m.title, m.joined_at
       from members m join profiles u on u.id = m.user_id
       where m.team_id = $1 order by m.joined_at asc`,
      [req.teamId],
    );
    res.json({ members: rows });
  } catch (err) { next(err); }
});

router.patch('/:teamId/members/:userId/role', requireAuth, loadMembership(), requireMember(), requireRole('owner'), async (req, res, next) => {
  try {
    if (!UUID_RE.test(String(req.params.userId))) {
      const err = new Error('Member not found.');
      err.status = 404;
      return next(err);
    }
    const { role } = req.body;
    if (!['owner', 'admin', 'member'].includes(role)) {
      const err = new Error('Invalid role.');
      err.status = 422;
      return next(err);
    }

    await db.withTransaction(req, async (client) => {
      await client.query('select 1 from members where team_id = $1 for update', [req.teamId]);
      const { rows: target } = await client.query(
        'select role from members where team_id = $1 and user_id = $2',
        [req.teamId, req.params.userId],
      );
      if (!target[0]) {
        const err = new Error('Member not found.');
        err.status = 404;
        throw err;
      }

      if (target[0].role === 'owner' && role !== 'owner') {
        const { rows } = await client.query(
          `select count(*)::int as n from members where team_id = $1 and role = 'owner'`,
          [req.teamId],
        );
        if (rows[0].n <= 1) {
          const err = new Error('A team needs at least one owner.');
          err.status = 422;
          throw err;
        }
      }

      await client.query(
        'update members set role = $1 where team_id = $2 and user_id = $3',
        [role, req.teamId, req.params.userId],
      );
    });

    await logAction(req, {
      actorId: req.user.id,
      teamId: req.teamId,
      action: 'member.role_changed',
      target: req.params.userId,
      metadata: { role },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:teamId/members/:userId', requireAuth, loadMembership(), requireMember(), requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    if (!UUID_RE.test(String(req.params.userId))) {
      const err = new Error('Member not found.');
      err.status = 404;
      return next(err);
    }
    await db.withTransaction(req, async (client) => {
      await client.query('select 1 from members where team_id = $1 for update', [req.teamId]);
      const { rows: target } = await client.query(
        'select role from members where team_id = $1 and user_id = $2',
        [req.teamId, req.params.userId],
      );
      if (!target[0]) {
        const err = new Error('Member not found.');
        err.status = 404;
        throw err;
      }

      if (target[0].role === 'owner') {
        const { rows } = await client.query(
          `select count(*)::int as n from members where team_id = $1 and role = 'owner'`,
          [req.teamId],
        );
        if (rows[0].n <= 1) {
          const err = new Error('A team needs at least one owner.');
          err.status = 422;
          throw err;
        }
        if (req.membership.role !== 'owner') {
          const err = new Error('You do not have permission to do that.');
          err.status = 403;
          throw err;
        }
      }

      await client.query('delete from members where team_id = $1 and user_id = $2', [req.teamId, req.params.userId]);
    });

    await logAction(req, { actorId: req.user.id, teamId: req.teamId, action: 'member.removed', target: req.params.userId });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
