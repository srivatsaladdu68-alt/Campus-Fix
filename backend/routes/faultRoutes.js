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
    const safeName = `fault-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
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

// Check duplicates in real-time (can be called before submission)
router.get('/check-duplicates', authenticateToken, faultController.checkDuplicates);

// Submit fault with optional image
router.post('/', authenticateToken, upload.single('image'), faultController.createFault);

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
