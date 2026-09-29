const express = require('express');
const db = require('../db/pool');
const { validate } = require('../utils/validate');
const { requireAuth } = require('../middleware/auth');
const { loadMembership, requireMember, requirePublicOrMember } = require('../middleware/authorize');
const { uploadDoc, verifyAndScan } = require('../middleware/upload');
const { logAction } = require('../utils/audit');

const router = express.Router({ mergeParams: true });

router.get('/:teamId/work', loadMembership(), requirePublicOrMember, async (req, res, next) => {
  try {
    const visClause = req.membership ? '' : `and w.visibility = 'public'`;
    const { rows } = await db.query(
      `select w.id, w.title, w.description, w.status, w.link_url, w.visibility, w.created_at,
              coalesce((select json_agg(json_build_object('name', file_name, 'size', size_bytes) order by id)
                        from work_attachments where work_item_id = w.id), '[]') as attachments
       from work_items w
       where w.team_id = $1 and w.deleted_at is null ${visClause}
       order by w.created_at desc`,
      [req.teamId],
    );
    res.json({ work: rows });
  } catch (err) { next(err); }
});

router.post('/:teamId/work', requireAuth, loadMembership(), requireMember(), uploadDoc.single('attachment'), verifyAndScan, validate('createWorkItem'), async (req, res, next) => {
  try {
    const { title, description, status, linkUrl, visibility } = req.body;
    const { rows } = await db.query(
      `insert into work_items (team_id, created_by, title, description, status, link_url, visibility)
       values ($1, $2, $3, $4, $5, $6, $7) returning id, created_at`,
      [req.teamId, req.user.id, title, description || null, status, linkUrl || null, visibility],
    );
    const item = rows[0];
    if (req.file) {
      await db.query(
        `insert into work_attachments (work_item_id, storage_key, file_name, mime_type, size_bytes)
         values ($1, $2, $3, $4, $5)`,
        [item.id, req.file.filename, req.file.originalname.slice(0, 200), req.file.mimetype, req.file.size],
      );
    }
    await logAction({ actorId: req.user.id, teamId: req.teamId, action: 'work.created', target: item.id });
    res.status(201).json({ workItem: item });
  } catch (err) { next(err); }
});

router.delete('/:teamId/work/:workId', requireAuth, loadMembership(), requireMember(), async (req, res, next) => {
  try {
    const { rows } = await db.query('select created_by from work_items where id = $1 and team_id = $2', [req.params.workId, req.teamId]);
    if (!rows[0]) return res.status(404).json({ error: 'Work item not found.' });
    const canDelete = rows[0].created_by === req.user.id || ['owner', 'admin'].includes(req.membership.role);
    if (!canDelete) {
      const err = new Error('You can only remove work you added.');
      err.status = 403;
      return next(err);
    }
    await db.query('update work_items set deleted_at = now() where id = $1', [req.params.workId]);
    await logAction({ actorId: req.user.id, teamId: req.teamId, action: 'work.deleted', target: req.params.workId });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
