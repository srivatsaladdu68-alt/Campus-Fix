const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const faultController = require('../controllers/faultController');
const authenticateToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

// Configure Multer for secure image uploads
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    // Unique server-side sanitized filename
    const safeName = `fault-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

  if (allowedExts.includes(ext) && allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image type. Only JPG, JPEG, PNG, and WEBP formats are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware to validate actual file contents (Magic Bytes) to block disguised executables
function validateImageMagicBytes(req, res, next) {
  if (!req.file) {
    return next();
  }

  const filePath = req.file.path;
  try {
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    const hex = buffer.toString('hex');
    const isJpeg = hex.startsWith('ffd8ff');
    const isPng = hex.startsWith('89504e47');
    const isWebp = hex.startsWith('52494646') && buffer.toString('ascii', 8, 12) === 'WEBP';
    const isSvg = buffer.toString('utf8').includes('<svg') || buffer.toString('utf8').includes('<?xml');

    if (!isJpeg && !isPng && !isWebp && !isSvg) {
      // Delete malicious or corrupted file
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: 'Security validation failed: The uploaded file content does not match a valid image format.'
      });
    }

    next();
  } catch (err) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return res.status(500).json({ success: false, message: 'Failed to validate uploaded image content.' });
  }
}

// Multer error handling wrapper
function handleUpload(req, res, next) {
  upload.single('image')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'The uploaded file exceeds the 5MB size limit. Please upload an image smaller than 5MB.'
        });
      }
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}

// Check duplicates in real-time
router.get('/check-duplicates', authenticateToken, faultController.checkDuplicates);

// Submit fault with optional image (validated, sanitized, and stored)
router.post('/', authenticateToken, handleUpload, validateImageMagicBytes, faultController.createFault);

// List faults (filtered by role and query params)
router.get('/', authenticateToken, faultController.getFaults);

// Get single fault details with history
router.get('/:id', authenticateToken, faultController.getFaultById);

// Update status
router.patch('/:id/status', authenticateToken, faultController.updateStatus);

// Assign staff (Admin only)
router.patch('/:id/assign', authenticateToken, requireRole(['admin']), faultController.assignStaff);

// Update priority (Admin only)
router.patch('/:id/priority', authenticateToken, requireRole(['admin']), faultController.updatePriority);

// Add repair notes and flag resources (Staff or Admin)
router.post('/:id/notes', authenticateToken, requireRole(['staff', 'admin']), faultController.addRepairNotes);

// Reopen a resolved/closed complaint (Reporter or Admin)
router.post('/:id/reopen', authenticateToken, faultController.reopenFault);

module.exports = router;
