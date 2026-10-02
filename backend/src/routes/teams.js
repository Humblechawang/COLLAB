const express = require('express');
const db = require('../db/pool');
const { validate } = require('../utils/validate');
const { requireAuth, optionalAuth, requireConfirmedEmail } = require('../middleware/auth');
const { loadMembership, requireMember, requireRole, requirePublicOrMember } = require('../middleware/authorize');
const { logAction } = require('../utils/audit');

const router = express.Router();

router.post('/', requireAuth, requireConfirmedEmail, validate('createTeam'), async (req, res, next) => {
  try {
    const { name, slug, tagline } = req.body;
    const existing = await db.query(req, 'select id from teams where slug = $1', [slug]);
    if (existing.rows.length) {
      const err = new Error('That team link is already taken.');
      err.status = 409;
      return next(err);
    }

    const team = await db.withTransaction(req, async (client) => {
      const { rows } = await client.query(
        `insert into teams (slug, name, tagline, created_by) values ($1, $2, $3, $4) returning *`,
        [slug, name, tagline || null, req.user.id],
      );
      const created = rows[0];
      await client.query(
        `insert into members (team_id, user_id, role) values ($1, $2, 'owner')`,
        [created.id, req.user.id],
      );
      return created;
    });

    await logAction(req, { actorId: req.user.id, teamId: team.id, action: 'team.created' });
    res.status(201).json({ team });
  } catch (err) { next(err); }
});

router.get('/:teamId', optionalAuth, loadMembership(), requirePublicOrMember, async (req, res, next) => {
  try {
    const { rows } = await db.query(req, 'select * from teams where id = $1', [req.teamId]);
    if (!rows[0]) return res.status(404).json({ error: 'Team not found.' });
    res.json({ team: rows[0], viewerRole: req.membership?.role || null });
  } catch (err) { next(err); }
});

router.patch(
  '/:teamId',
  requireAuth,
  loadMembership(),
  requireMember(),
  requireRole('owner', 'admin'),
  validate('updateTeam'),
  async (req, res, next) => {
    try {
      const { name, tagline, bio, isPublic } = req.body;
      const { rows } = await db.query(
        req,
        `update teams set
           name = coalesce($1, name),
           tagline = coalesce($2, tagline),
           bio = coalesce($3, bio),
           is_public = coalesce($4, is_public)
         where id = $5 returning *`,
        [name ?? null, tagline ?? null, bio ?? null, isPublic ?? null, req.teamId],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Team not found.' });
      await logAction(req, {
        actorId: req.user.id,
        teamId: req.teamId,
        action: typeof isPublic === 'boolean' ? 'team.visibility_changed' : 'team.updated',
        target: req.teamId,
        metadata: typeof isPublic === 'boolean' ? { isPublic } : undefined,
      });
      res.json({ team: rows[0] });
    } catch (err) { next(err); }
  },
);

module.exports = router;
