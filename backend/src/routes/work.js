const express = require('express');
const db = require('../db/pool');
const config = require('../config');
const { validate } = require('../utils/validate');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { loadMembership, requireMember, requirePublicOrMember } = require('../middleware/authorize');
const { rejectUploads } = require('../middleware/upload');
const { logAction } = require('../utils/audit');

const router = express.Router({ mergeParams: true });

async function loadTeamWork(req, teamId, workId) {
  const { rows } = await db.query(
    req,
    `select id, created_by from work_items where id = $1 and team_id = $2 and deleted_at is null`,
    [workId, teamId],
  );
  return rows[0] || null;
}

router.get('/:teamId/work', optionalAuth, loadMembership(), requirePublicOrMember, async (req, res, next) => {
  try {
    const visClause = req.membership ? '' : `and w.visibility = 'public'`;
    const limit = Math.min(config.listLimit, 50);
    const { rows } = await db.query(
      req,
      `select w.id, w.title, w.description, w.status, w.link_url, w.visibility, w.created_at,
              coalesce((select json_agg(json_build_object('name', file_name, 'size', size_bytes) order by id)
                        from work_attachments where work_item_id = w.id), '[]') as attachments
       from work_items w
       where w.team_id = $1 and w.deleted_at is null ${visClause}
       order by w.created_at desc
       limit $2`,
      [req.teamId, limit],
    );
    res.json({ work: rows });
  } catch (err) { next(err); }
});

router.post('/:teamId/work', requireAuth, loadMembership(), requireMember(), rejectUploads, validate('createWorkItem'), async (req, res, next) => {
  try {
    const { title, description, status, linkUrl, visibility } = req.body;
    const { rows } = await db.query(
      req,
      `insert into work_items (team_id, created_by, title, description, status, link_url, visibility)
       values ($1, $2, $3, $4, $5, $6, $7) returning id, created_at`,
      [req.teamId, req.user.id, title, description || null, status, linkUrl || null, visibility],
    );
    const item = rows[0];
    await logAction(req, { actorId: req.user.id, teamId: req.teamId, action: 'work.created', target: item.id });
    res.status(201).json({ workItem: item });
  } catch (err) { next(err); }
});

router.delete('/:teamId/work/:workId', requireAuth, loadMembership(), requireMember(), async (req, res, next) => {
  try {
    const item = await loadTeamWork(req, req.teamId, req.params.workId);
    if (!item) return res.status(404).json({ error: 'Work item not found.' });
    const canDelete = item.created_by === req.user.id || ['owner', 'admin'].includes(req.membership.role);
    if (!canDelete) {
      const err = new Error('You can only remove work you added.');
      err.status = 403;
      return next(err);
    }
    await db.query(req, 'update work_items set deleted_at = now() where id = $1 and team_id = $2', [req.params.workId, req.teamId]);
    await logAction(req, { actorId: req.user.id, teamId: req.teamId, action: 'work.deleted', target: req.params.workId });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
