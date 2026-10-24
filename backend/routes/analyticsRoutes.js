const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authenticateToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

// Public stats and charts for landing page and live-stats (no auth needed)
router.get('/public-stats', analyticsController.getPublicStats);
router.get('/public-charts', analyticsController.getPublicCharts);

// Protected admin analytics
router.get('/summary', authenticateToken, requireRole(['admin']), analyticsController.getAnalyticsSummary);
router.get('/export', authenticateToken, requireRole(['admin']), analyticsController.exportCSV);

module.exports = router;
