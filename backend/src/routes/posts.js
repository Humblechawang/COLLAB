const express = require('express');
const createDOMPurify = require('isomorphic-dompurify');
const db = require('../db/pool');
const config = require('../config');
const { validate } = require('../utils/validate');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { loadMembership, requireMember, requirePublicOrMember } = require('../middleware/authorize');
const { rejectUploads } = require('../middleware/upload');
const { logAction } = require('../utils/audit');

const router = express.Router({ mergeParams: true });

const clean = (s) => createDOMPurify.sanitize(s, { ALLOWED_TAGS: [] });

async function loadTeamPost(req, teamId, postId) {
  const { rows } = await db.query(
    req,
    `select id, author_id from posts where id = $1 and team_id = $2 and deleted_at is null`,
    [postId, teamId],
  );
  return rows[0] || null;
}

router.get('/:teamId/posts', optionalAuth, loadMembership(), requirePublicOrMember, async (req, res, next) => {
  try {
    const visClause = req.membership ? '' : `and p.visibility = 'public'`;
    const limit = Math.min(config.listLimit, 50);
    const { rows } = await db.query(
      req,
      `select p.id, p.tag, p.body, p.link_url, p.visibility, p.created_at,
              u.id as author_id, u.full_name as author_name, u.avatar_url as author_avatar,
              (select count(*)::int from post_likes where post_id = p.id) as likes,
              (select count(*)::int from post_comments where post_id = p.id and deleted_at is null) as comment_count,
              coalesce((select json_agg(storage_key order by position) from post_images where post_id = p.id), '[]') as images
       from posts p join profiles u on u.id = p.author_id
       where p.team_id = $1 and p.deleted_at is null ${visClause}
       order by p.created_at desc limit $2`,
      [req.teamId, limit],
    );
    res.json({ posts: rows });
  } catch (err) { next(err); }
});

router.post('/:teamId/posts', requireAuth, loadMembership(), requireMember(), rejectUploads, validate('createPost'), async (req, res, next) => {
  try {
    const { tag, body, linkUrl, visibility } = req.body;
    const { rows } = await db.query(
      req,
      `insert into posts (team_id, author_id, tag, body, link_url, visibility)
       values ($1, $2, $3, $4, $5, $6) returning id, created_at`,
      [req.teamId, req.user.id, tag, clean(body), linkUrl || null, visibility],
    );
    const post = rows[0];
    await logAction(req, { actorId: req.user.id, teamId: req.teamId, action: 'post.created', target: post.id });
    res.status(201).json({ post });
  } catch (err) { next(err); }
});

router.delete('/:teamId/posts/:postId', requireAuth, loadMembership(), requireMember(), async (req, res, next) => {
  try {
    const post = await loadTeamPost(req, req.teamId, req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    const isOwnerOfPost = post.author_id === req.user.id;
    const isAdmin = ['owner', 'admin'].includes(req.membership.role);
    if (!isOwnerOfPost && !isAdmin) {
      const err = new Error('You can only delete your own posts.');
      err.status = 403;
      return next(err);
    }
    await db.query(req, 'update posts set deleted_at = now() where id = $1 and team_id = $2', [req.params.postId, req.teamId]);
    await logAction(req, { actorId: req.user.id, teamId: req.teamId, action: 'post.deleted', target: req.params.postId });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:teamId/posts/:postId/like', requireAuth, loadMembership(), requireMember(), async (req, res, next) => {
  try {
    const post = await loadTeamPost(req, req.teamId, req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    await db.query(
      req,
      `insert into post_likes (post_id, user_id) values ($1, $2) on conflict do nothing`,
      [post.id, req.user.id],
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:teamId/posts/:postId/like', requireAuth, loadMembership(), requireMember(), async (req, res, next) => {
  try {
    const post = await loadTeamPost(req, req.teamId, req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    await db.query(req, 'delete from post_likes where post_id = $1 and user_id = $2', [post.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:teamId/posts/:postId/comments', requireAuth, loadMembership(), requireMember(), validate('comment'), async (req, res, next) => {
  try {
    const post = await loadTeamPost(req, req.teamId, req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    const { rows } = await db.query(
      req,
      `insert into post_comments (post_id, author_id, body) values ($1, $2, $3)
       returning id, created_at`,
      [post.id, req.user.id, clean(req.body.body)],
    );
    res.status(201).json({ comment: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
