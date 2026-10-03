const express = require('express');
const db = require('../db/pool');
const { validate } = require('../utils/validate');
const { requireAuth } = require('../middleware/auth');
const { loadMembership, requireMember, requireRole, requirePublicOrMember } = require('../middleware/authorize');
const { logAction } = require('../utils/audit');

const router = express.Router();

router.post('/', requireAuth, validate('createTeam'), async (req, res, next) => {
  try {
    const { name, slug, tagline } = req.body;
    const existing = await db.query('select id from teams where slug = $1', [slug]);
    if (existing.rows.length) {
      const err = new Error('That team link is already taken.');
      err.status = 409;
      return next(err);
    }
    const { rows } = await db.query(
      `insert into teams (slug, name, tagline, created_by) values ($1, $2, $3, $4) returning *`,
      [slug, name, tagline || null, req.user.id],
    );
    const team = rows[0];
    await db.query(
      `insert into members (team_id, user_id, role) values ($1, $2, 'owner')`,
      [team.id, req.user.id],
    );
    await logAction({ actorId: req.user.id, teamId: team.id, action: 'team.created' });
    res.status(201).json({ team });
  } catch (err) { next(err); }
});

// Public team page — readable by anyone if the team is public, by members otherwise.
router.get('/:teamId', loadMembership(), requirePublicOrMember, async (req, res, next) => {
  try {
    const { rows } = await db.query('select * from teams where id = $1', [req.teamId]);
    if (!rows[0]) return res.status(404).json({ error: 'Team not found.' });
    res.json({ team: rows[0], viewerRole: req.membership?.role || null });
  } catch (err) { next(err); }
});

router.patch('/:teamId', loadMembership(), requireMember(), requireRole('owner', 'admin'), validate('updateTeam'), async (req, res, next) => {
  try {
    const { name, tagline, bio, isPublic } = req.body;
    const { rows } = await db.query(
      `update teams set
         name = coalesce($1, name),
         tagline = coalesce($2, tagline),
         bio = coalesce($3, bio),
         is_public = coalesce($4, is_public)
       where id = $5 returning *`,
      [name, tagline, bio, isPublic, req.teamId],
    );
    await logAction({ actorId: req.user.id, teamId: req.teamId, action: 'team.updated' });
    res.json({ team: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
