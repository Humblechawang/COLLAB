const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const ALLOWED_IMAGE = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const ALLOWED_DOC = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ...ALLOWED_IMAGE,
]);

if (!fs.existsSync(config.upload.dir)) fs.mkdirSync(config.upload.dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.upload.dir),
  filename: (req, file, cb) => {
    // Never trust the client's filename — generate our own to prevent path
    // traversal and to stop a filename like "../../etc/passwd" or an
    // executable extension from ever reaching the filesystem as-is.
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilterFactory(allowedSet) {
  return (req, file, cb) => {
    if (!allowedSet.has(file.mimetype)) {
      return cb(new Error('That file type is not supported.'));
    }
    cb(null, true);
  };
}

const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 4 },
  fileFilter: fileFilterFactory(ALLOWED_IMAGE),
});

const uploadDoc = multer({
  storage,
  limits: { fileSize: config.upload.maxMb * 1024 * 1024, files: 1 },
  fileFilter: fileFilterFactory(ALLOWED_DOC),
});

/**
 * Verifies the file's real content matches its declared type by reading its
 * magic bytes, so a .exe renamed to .png is caught even though multer's
 * fileFilter (which only sees the client-supplied mimetype) would miss it.
 * Also calls out to an external AV scanner if AV_SCAN_URL is configured.
 */
async function verifyAndScan(req, res, next) {
  try {
    if (!req.files?.length && !req.file) return next();
    const files = req.files || [req.file];
    const { fileTypeFromFile } = await import('file-type');

    for (const f of files) {
      const detected = await fileTypeFromFile(f.path);
      const declaredOk = detected && (detected.mime === f.mimetype || f.mimetype.startsWith('image/'));
      if (!detected || !declaredOk) {
        fs.unlinkSync(f.path);
        const err = new Error('The file content did not match its file type.');
        err.status = 422;
        return next(err);
      }

      if (config.upload.avScanUrl) {
        const clean = await scanWithExternalAv(f.path);
        if (!clean) {
          fs.unlinkSync(f.path);
          const err = new Error('This file failed a security scan and was rejected.');
          err.status = 422;
          return next(err);
        }
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

async function scanWithExternalAv(filePath) {
  // Placeholder for a real integration (ClamAV REST wrapper, VirusTotal, etc).
  // Wire this up before accepting uploads in production — until then,
  // AV_SCAN_URL should stay unset only in local development.
  const res = await fetch(config.upload.avScanUrl, {
    method: 'POST',
    body: fs.createReadStream(filePath),
  });
  const { clean } = await res.json();
  return clean === true;
}

module.exports = { uploadImage, uploadDoc, verifyAndScan };
