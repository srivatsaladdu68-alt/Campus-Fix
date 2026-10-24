const db = require('../database');

/**
 * Creates an in-app notification for a given user.
 * @param {number} userId 
 * @param {number|null} faultId 
 * @param {string} message 
 */
function createNotification(userId, faultId, message) {
  try {
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, fault_id, message, is_read, created_at)
      VALUES (?, ?, ?, 0, datetime('now'))
    `);
    stmt.run(userId, faultId, message);
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
}

/**
 * Notify all administrators (e.g. when a new complaint is filed or reopened)
 * @param {number|null} faultId
 * @param {string} message
 */
function notifyAdmins(faultId, message) {
  try {
    const admins = db.prepare("SELECT user_id FROM users WHERE role = 'admin' AND is_active = 1").all();
    for (const admin of admins) {
      createNotification(admin.user_id, faultId, message);
    }
  } catch (err) {
    console.error('Failed to notify admins:', err.message);
  }
}

module.exports = {
  createNotification,
  notifyAdmins
};
