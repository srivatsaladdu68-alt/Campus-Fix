const db = require('../database');

// User Dashboard Data
function getUserDashboard(req, res) {
  try {
    const userId = req.user.user_id;

    const stats = db.prepare(`
      SELECT 
        COUNT(*) AS total_complaints,
        SUM(CASE WHEN status IN ('Reported', 'Verified', 'Assigned') THEN 1 ELSE 0 END) AS pending_complaints,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress_complaints,
        SUM(CASE WHEN status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS resolved_complaints
      FROM faults
      WHERE reported_by = ?
    `).get(userId);

    const recentComplaints = db.prepare(`
      SELECT 
        f.fault_id, f.complaint_code, f.title, f.category, f.priority, f.status, f.created_at, f.updated_at,
        b.building_name, b.building_code, f.room_number,
        u_staff.full_name AS staff_name
      FROM faults f
      LEFT JOIN buildings b ON f.building_id = b.building_id
      LEFT JOIN users u_staff ON f.assigned_to = u_staff.user_id
      WHERE f.reported_by = ?
      ORDER BY f.created_at DESC
      LIMIT 5
    `).all(userId);

    const recentNotifications = db.prepare(`
      SELECT notification_id, fault_id, message, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(userId);

    return res.json({
      success: true,
      stats: {
        total: stats.total_complaints || 0,
        pending: stats.pending_complaints || 0,
        in_progress: stats.in_progress_complaints || 0,
        resolved: stats.resolved_complaints || 0
      },
      recent_complaints: recentComplaints,
      notifications: recentNotifications
    });
  } catch (err) {
    console.error('User dashboard error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving user dashboard.' });
  }
}

// Staff Dashboard Data
function getStaffDashboard(req, res) {
  try {
    const staffId = req.user.user_id;

    const stats = db.prepare(`
      SELECT 
        COUNT(*) AS total_assigned,
        SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END) AS new_assignments,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS completed,
        SUM(CASE 
          WHEN deadline IS NOT NULL AND deadline < datetime('now') AND status NOT IN ('Resolved', 'Closed', 'Rejected') 
          THEN 1 ELSE 0 
        END) AS overdue
      FROM faults
      WHERE assigned_to = ?
    `).get(staffId);

    const tasks = db.prepare(`
      SELECT 
        f.*,
        b.building_name,
        b.building_code,
        u_rep.full_name AS reporter_name,
        u_rep.phone AS reporter_phone,
        CASE 
          WHEN f.deadline IS NOT NULL AND f.deadline < datetime('now') AND f.status NOT IN ('Resolved', 'Closed', 'Rejected')
          THEN 1 ELSE 0 
        END AS is_overdue
      FROM faults f
      LEFT JOIN buildings b ON f.building_id = b.building_id
      LEFT JOIN users u_rep ON f.reported_by = u_rep.user_id
      WHERE f.assigned_to = ?
      ORDER BY 
        CASE f.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 END ASC,
        f.created_at DESC
    `).all(staffId);

    return res.json({
      success: true,
      stats: {
        total: stats.total_assigned || 0,
        new_assignments: stats.new_assignments || 0,
        in_progress: stats.in_progress || 0,
        completed: stats.completed || 0,
        overdue: stats.overdue || 0
      },
      tasks
    });
  } catch (err) {
    console.error('Staff dashboard error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving staff dashboard.' });
  }
}

// Admin Dashboard Data
function getAdminDashboard(req, res) {
  try {
    const counts = db.prepare(`
      SELECT 
        COUNT(*) AS total_faults,
        SUM(CASE WHEN status NOT IN ('Resolved', 'Closed', 'Rejected') THEN 1 ELSE 0 END) AS open_complaints,
        SUM(CASE WHEN priority = 'Critical' AND status NOT IN ('Resolved', 'Closed', 'Rejected') THEN 1 ELSE 0 END) AS critical_faults,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE 
          WHEN deadline IS NOT NULL AND deadline < datetime('now') AND status NOT IN ('Resolved', 'Closed', 'Rejected') 
          THEN 1 ELSE 0 
        END) AS overdue
      FROM faults
    `).get();

    // Average resolution time in hours
    const avgTimeRow = db.prepare(`
      SELECT AVG((julianday(resolved_at) - julianday(created_at)) * 24) AS avg_resolution_hours
      FROM faults
      WHERE resolved_at IS NOT NULL
    `).get();

    const avgHours = avgTimeRow && avgTimeRow.avg_resolution_hours ? Math.round(avgTimeRow.avg_resolution_hours * 10) / 10 : 0;

    // Faults by Category
    const categoryStats = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM faults
      GROUP BY category
      ORDER BY count DESC
    `).all();

    // Faults by Building
    const buildingStats = db.prepare(`
      SELECT b.building_name, b.building_code, COUNT(f.fault_id) as count
      FROM buildings b
      LEFT JOIN faults f ON b.building_id = f.building_id
      GROUP BY b.building_id
      ORDER BY count DESC
    `).all();

    // Trends by Date (Last 7 days)
    const trends = db.prepare(`
      SELECT 
        strftime('%Y-%m-%d', created_at) as date,
        COUNT(*) as total_reported,
        SUM(CASE WHEN status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) as total_resolved
      FROM faults
      WHERE created_at >= date('now', '-14 days')
      GROUP BY date
      ORDER BY date ASC
    `).all();

    // Staff Workload
    const staffWorkload = db.prepare(`
      SELECT 
        u.user_id,
        u.full_name,
        COUNT(f.fault_id) AS total_assigned,
        SUM(CASE WHEN f.status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS completed_tasks,
        SUM(CASE WHEN f.status = 'In Progress' THEN 1 ELSE 0 END) AS active_tasks
      FROM users u
      LEFT JOIN faults f ON u.user_id = f.assigned_to
      WHERE u.role = 'staff' AND u.is_active = 1
      GROUP BY u.user_id
    `).all();

    // Recurring problems: Locations with 2 or more reports
    const recurringLocations = db.prepare(`
      SELECT 
        b.building_name,
        f.room_number,
        f.category,
        COUNT(*) as recurrence_count
      FROM faults f
      JOIN buildings b ON f.building_id = b.building_id
      GROUP BY f.building_id, LOWER(f.room_number), f.category
      HAVING recurrence_count >= 2
      ORDER BY recurrence_count DESC
    `).all();

    return res.json({
      success: true,
      stats: {
        total: counts.total_faults || 0,
        open: counts.open_complaints || 0,
        critical: counts.critical_faults || 0,
        in_progress: counts.in_progress || 0,
        resolved: counts.resolved || 0,
        overdue: counts.overdue || 0,
        avg_resolution_hours: avgHours
      },
      charts: {
        categories: categoryStats,
        buildings: buildingStats,
        trends: trends,
        staff: staffWorkload
      },
      recurring: recurringLocations
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving admin dashboard.' });
  }
}

module.exports = {
  getUserDashboard,
  getStaffDashboard,
  getAdminDashboard
};
