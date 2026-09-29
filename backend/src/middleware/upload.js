function rejectUploads(req, res, next) {
  const ct = String(req.headers['content-type'] || '');
  if (ct.toLowerCase().includes('multipart/form-data')) {
    const err = new Error('File uploads are disabled.');
    err.status = 503;
    return next(err);
  }
  next();
}

module.exports = { rejectUploads };
