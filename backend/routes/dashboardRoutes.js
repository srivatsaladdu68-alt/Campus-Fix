const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authenticateToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

router.get('/user', authenticateToken, dashboardController.getUserDashboard);
router.get('/staff', authenticateToken, requireRole(['staff', 'admin']), dashboardController.getStaffDashboard);
router.get('/admin', authenticateToken, requireRole(['admin']), dashboardController.getAdminDashboard);

module.exports = router;
