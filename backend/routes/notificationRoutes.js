const express = require('express');
const router = express.Router();
const db = require('../database');
const authenticateToken = require('../middleware/authMiddleware');

// Get all notifications for current user
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.user_id;
    const notifications = db.prepare(`
      SELECT notification_id, fault_id, message, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId);

    const unreadCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(userId).count;

    return res.json({
      success: true,
      unread_count: unreadCount,
      notifications
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving notifications.' });
  }
});

// Mark single notification as read
router.patch('/:id/read', authenticateToken, (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.user_id;

    db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE notification_id = ? AND user_id = ?
    `).run(notificationId, userId);

    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error updating notification.' });
  }
});

// Mark all as read
router.post('/mark-all-read', authenticateToken, (req, res) => {
  try {
    const userId = req.user.user_id;

    db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ?
    `).run(userId);

    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error marking notifications read.' });
  }
});

module.exports = router;
