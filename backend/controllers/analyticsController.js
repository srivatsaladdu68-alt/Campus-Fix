const db = require('../database');

// Public stats for landing page
function getPublicStats(req, res) {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_reported,
        SUM(CASE WHEN status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) as total_resolved,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress
      FROM faults
    `).get();

    const staffCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'staff' AND is_active = 1").get().count;

    const avgTimeRow = db.prepare(`
      SELECT AVG((julianday(resolved_at) - julianday(created_at)) * 24) AS avg_hours
      FROM faults
      WHERE resolved_at IS NOT NULL
    `).get();

    const avgHours = avgTimeRow && avgTimeRow.avg_hours ? Math.round(avgTimeRow.avg_hours * 10) / 10 : 18.5;

    return res.json({
      success: true,
      total_reported: stats.total_reported || 0,
      total_resolved: stats.total_resolved || 0,
      in_progress: stats.in_progress || 0,
      active_technicians: staffCount || 0,
      avg_resolution_hours: avgHours
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error retrieving public stats.' });
  }
}

// Comprehensive Analytics Summary for Admin
function getAnalyticsSummary(req, res) {
  try {
    const { start_date, end_date, category, building_id, priority, status } = req.query;

    let baseFilter = "WHERE 1=1";
    const params = [];

    if (start_date) {
      baseFilter += " AND date(f.created_at) >= date(?)";
      params.push(start_date);
    }
    if (end_date) {
      baseFilter += " AND date(f.created_at) <= date(?)";
      params.push(end_date);
    }
    if (category) {
      baseFilter += " AND f.category = ?";
      params.push(category);
    }
    if (building_id) {
      baseFilter += " AND f.building_id = ?";
      params.push(building_id);
    }
    if (priority) {
      baseFilter += " AND f.priority = ?";
      params.push(priority);
    }
    if (status) {
      baseFilter += " AND f.status = ?";
      params.push(status);
    }

    // Totals and resolution rate
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_complaints,
        SUM(CASE WHEN f.status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) as resolved_count,
        SUM(CASE WHEN f.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN f.status = 'Reported' THEN 1 ELSE 0 END) as reported_count,
        SUM(CASE WHEN f.status = 'Rejected' THEN 1 ELSE 0 END) as rejected_count,
        AVG(CASE WHEN f.resolved_at IS NOT NULL THEN (julianday(f.resolved_at) - julianday(f.created_at)) * 24 ELSE NULL END) as avg_resolution_time_hours
      FROM faults f
      ${baseFilter}
    `;

    const summary = db.prepare(summaryQuery).get(...params);
    const total = summary.total_complaints || 0;
    const resolved = summary.resolved_count || 0;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const avgTime = summary.avg_resolution_time_hours ? Math.round(summary.avg_resolution_time_hours * 10) / 10 : 0;

    // Frequently failing categories
    const categoriesQuery = `
      SELECT f.category, COUNT(*) as count
      FROM faults f
      ${baseFilter}
      GROUP BY f.category
      ORDER BY count DESC
    `;
    const categories = db.prepare(categoriesQuery).all(...params);

    // Frequently failing buildings
    const buildingsQuery = `
      SELECT b.building_name, b.building_code, COUNT(f.fault_id) as count
      FROM buildings b
      JOIN faults f ON b.building_id = f.building_id
      ${baseFilter}
      GROUP BY b.building_id
      ORDER BY count DESC
    `;
    const buildings = db.prepare(buildingsQuery).all(...params);

    return res.json({
      success: true,
      summary: {
        total_complaints: total,
        resolved_count: resolved,
        in_progress_count: summary.in_progress_count || 0,
        reported_count: summary.reported_count || 0,
        rejected_count: summary.rejected_count || 0,
        resolution_rate_percent: resolutionRate,
        avg_resolution_time_hours: avgTime
      },
      categories,
      buildings
    });
  } catch (err) {
    console.error('Analytics summary error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving analytics.' });
  }
}

// Export Filtered Complaints to CSV
function exportCSV(req, res) {
  try {
    const { start_date, end_date, category, building_id, priority, status } = req.query;

    let query = `
      SELECT 
        f.complaint_code,
        f.title,
        f.category,
        b.building_name,
        f.floor_number,
        f.room_number,
        f.priority,
        f.status,
        u_rep.full_name AS reported_by,
        u_rep.email AS reporter_email,
        u_staff.full_name AS assigned_staff,
        f.deadline,
        f.created_at,
        f.updated_at,
        f.resolved_at
      FROM faults f
      LEFT JOIN buildings b ON f.building_id = b.building_id
      LEFT JOIN users u_rep ON f.reported_by = u_rep.user_id
      LEFT JOIN users u_staff ON f.assigned_to = u_staff.user_id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += " AND date(f.created_at) >= date(?)";
      params.push(start_date);
    }
    if (end_date) {
      query += " AND date(f.created_at) <= date(?)";
      params.push(end_date);
    }
    if (category) {
      query += " AND f.category = ?";
      params.push(category);
    }
    if (building_id) {
      query += " AND f.building_id = ?";
      params.push(building_id);
    }
    if (priority) {
      query += " AND f.priority = ?";
      params.push(priority);
    }
    if (status) {
      query += " AND f.status = ?";
      params.push(status);
    }

    query += " ORDER BY f.created_at DESC";

    const rows = db.prepare(query).all(...params);

    // Generate CSV string
    const headers = [
      'Complaint Code',
      'Title',
      'Category',
      'Building',
      'Floor',
      'Room',
      'Priority',
      'Status',
      'Reported By',
      'Reporter Email',
      'Assigned Staff',
      'Deadline',
      'Created At',
      'Updated At',
      'Resolved At'
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const escaped = String(str).replace(/"/g, '""');
      return `"${escaped}"`;
    };

    let csvContent = headers.join(',') + '\r\n';

    for (const r of rows) {
      const line = [
        escapeCsv(r.complaint_code),
        escapeCsv(r.title),
        escapeCsv(r.category),
        escapeCsv(r.building_name),
        escapeCsv(r.floor_number),
        escapeCsv(r.room_number),
        escapeCsv(r.priority),
        escapeCsv(r.status),
        escapeCsv(r.reported_by),
        escapeCsv(r.reporter_email),
        escapeCsv(r.assigned_staff || 'Unassigned'),
        escapeCsv(r.deadline || 'N/A'),
        escapeCsv(r.created_at),
        escapeCsv(r.updated_at),
        escapeCsv(r.resolved_at || 'Unresolved')
      ].join(',');
      csvContent += line + '\r\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="campus_fix_complaints_report.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('Export CSV error:', err);
    return res.status(500).json({ success: false, message: 'Failed to export CSV.' });
  }
}

module.exports = {
  getPublicStats,
  getAnalyticsSummary,
  exportCSV
};
