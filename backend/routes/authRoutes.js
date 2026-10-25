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

// Staff management & Account Approvals (Admin only)
router.get('/staff', authenticateToken, requireRole(['admin']), authController.listStaff);
router.post('/staff', authenticateToken, requireRole(['admin']), authController.createStaff);
router.get('/pending-approvals', authenticateToken, requireRole(['admin']), authController.listPendingApprovals);
router.put('/approve/:id', authenticateToken, requireRole(['admin']), authController.approveUser);
router.put('/reject/:id', authenticateToken, requireRole(['admin']), authController.rejectUser);

module.exports = router;
