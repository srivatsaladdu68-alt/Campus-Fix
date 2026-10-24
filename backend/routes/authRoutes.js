const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticateToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

// Public authentication
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/buildings', authController.listBuildings);

// Authenticated user check
router.get('/me', authenticateToken, authController.getMe);

// Staff management (Admin only)
router.get('/staff', authenticateToken, requireRole(['admin']), authController.listStaff);
router.post('/staff', authenticateToken, requireRole(['admin']), authController.createStaff);

module.exports = router;
