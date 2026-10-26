const db = require('../database');
const fs = require('fs');
const { createNotification, notifyAdmins } = require('../services/notificationService');

// Helper to generate a unique complaint code like CF-2026-1042
function generateComplaintCode() {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `CF-${year}-${randomNum}`;
}

// Helper to calculate default deadline based on urgency
function calculateDeadline(priority) {
  const now = new Date();
  let hoursToAdd = 72; // default Medium: 3 days
  if (priority === 'Critical') hoursToAdd = 24; // 1 day
  else if (priority === 'High') hoursToAdd = 48; // 2 days
  else if (priority === 'Low') hoursToAdd = 120; // 5 days

  const deadline = new Date(now.getTime() + hoursToAdd * 60 * 60 * 1000);
  return deadline.toISOString().replace('T', ' ').substring(0, 19);
}

// Submit a new fault report
function createFault(req, res) {
  try {
    const { title, item_name, description, category, building_id, floor_number, room_number, priority } = req.body;

    if (!title || !description || !category || !building_id || !floor_number || !room_number) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields: title, description, category, building, floor, and room.'
      });
    }

    const validCategories = [
      'Electrical', 'Plumbing', 'Furniture', 'Classroom Equipment',
      'Laboratory Equipment', 'Network/IT', 'Washroom', 'Safety', 'Other'
    ];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ success: false, message: 'Invalid fault category provided.' });
    }

    const validPriorities = ['Low', 'Medium', 'High', 'Critical'];
    const chosenPriority = validPriorities.includes(priority) ? priority : 'Medium';

    // Image path if uploaded, or default icon
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    const itemName = item_name ? item_name.trim() : title.trim();

    // Check for potential duplicate complaints in same room and category
    const activeDuplicates = db.prepare(`
      SELECT fault_id, complaint_code, title, item_name, status
      FROM faults
      WHERE building_id = ? AND LOWER(room_number) = LOWER(?) AND category = ?
        AND status NOT IN ('Resolved', 'Closed', 'Rejected')
    `).all(building_id, room_number.trim(), category);

    let complaintCode = generateComplaintCode();
    // Ensure code uniqueness
    while (db.prepare('SELECT fault_id FROM faults WHERE complaint_code = ?').get(complaintCode)) {
      complaintCode = generateComplaintCode();
    }

    const deadline = calculateDeadline(chosenPriority);
    const userId = req.user.user_id;

    const insertFault = db.prepare(`
      INSERT INTO faults (
        complaint_code, reported_by, title, item_name, description, category,
        building_id, floor_number, room_number, image_path, priority,
        status, deadline, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Reported', ?, datetime('now'), datetime('now'))
    `);

    const result = insertFault.run(
      complaintCode,
      userId,
      title.trim(),
      itemName,
      description.trim(),
      category,
      building_id,
      floor_number.trim(),
      room_number.trim(),
      imagePath,
      chosenPriority,
      deadline
    );

    const faultId = result.lastInsertRowid;

    // Record in history audit
    db.prepare(`
      INSERT INTO fault_history (fault_id, changed_by, old_status, new_status, notes, changed_at)
      VALUES (?, ?, NULL, 'Reported', 'Complaint submitted by user', datetime('now'))
    `).run(faultId, userId);

    // Notifications
    createNotification(
      userId,
      faultId,
      `Your complaint [${complaintCode}] has been successfully registered.`
    );
    notifyAdmins(
      faultId,
      `New complaint [${complaintCode}] reported: "${title.trim()}" in ${room_number.trim()} (${category}).`
    );

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully.',
      complaint_code: complaintCode,
      fault_id: faultId,
      has_duplicates: activeDuplicates.length > 0,
      active_duplicates: activeDuplicates
    });
  } catch (err) {
    console.error('Create fault error:', err);
    // Clean up uploaded file if complaint could not be saved
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('Failed to unlink orphaned file:', unlinkErr);
      }
    }
    return res.status(500).json({ success: false, message: 'Server error creating fault complaint.' });
  }
}

// List faults with filtering, search, and role isolation
function getFaults(req, res) {
  try {
    const { status, category, building_id, priority, search, staff_id, sort, page = 1, limit = 50 } = req.query;

    let query = `
      SELECT 
        f.*,
        b.building_name,
        b.building_code,
        u_rep.full_name AS reporter_name,
        u_rep.email AS reporter_email,
        u_rep.phone AS reporter_phone,
        u_rep.student_id AS reporter_student_id,
        u_rep.department AS reporter_department,
        u_rep.role AS reporter_role,
        u_staff.full_name AS staff_name,
        u_staff.email AS staff_email,
        u_staff.phone AS staff_phone,
        CASE 
          WHEN f.deadline IS NOT NULL AND f.deadline < datetime('now') AND f.status NOT IN ('Resolved', 'Closed', 'Rejected')
          THEN 1 ELSE 0 
        END AS is_overdue
      FROM faults f
      LEFT JOIN buildings b ON f.building_id = b.building_id
      LEFT JOIN users u_rep ON f.reported_by = u_rep.user_id
      LEFT JOIN users u_staff ON f.assigned_to = u_staff.user_id
      WHERE 1=1
    `;

    const params = [];

    // Role-based scoping
    if (req.user.role === 'student' || req.user.role === 'faculty') {
      query += ` AND f.reported_by = ?`;
      params.push(req.user.user_id);
    } else if (req.user.role === 'staff' && !req.query.all) {
      // Staff defaults to assigned to them unless query param `all=true`
      query += ` AND f.assigned_to = ?`;
      params.push(req.user.user_id);
    }

    if (staff_id) {
      query += ` AND f.assigned_to = ?`;
      params.push(staff_id);
    }

    if (status) {
      query += ` AND f.status = ?`;
      params.push(status);
    }

    if (category) {
      query += ` AND f.category = ?`;
      params.push(category);
    }

    if (building_id) {
      query += ` AND f.building_id = ?`;
      params.push(building_id);
    }

    if (priority) {
      query += ` AND f.priority = ?`;
      params.push(priority);
    }

    if (search) {
      query += ` AND (f.complaint_code LIKE ? OR f.title LIKE ? OR f.description LIKE ? OR f.room_number LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    // Sorting
    if (sort === 'oldest') {
      query += ` ORDER BY f.created_at ASC`;
    } else if (sort === 'priority') {
      query += ` ORDER BY CASE f.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 END ASC, f.created_at DESC`;
    } else {
      query += ` ORDER BY f.created_at DESC`;
    }

    // Pagination
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const faults = db.prepare(query).all(...params);

    return res.json({
      success: true,
      count: faults.length,
      page: parseInt(page),
      faults
    });
  } catch (err) {
    console.error('Get faults error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving faults.' });
  }
}

// Get single fault with timeline and history
function getFaultById(req, res) {
  try {
    const faultId = req.params.id;

    const fault = db.prepare(`
      SELECT 
        f.*,
        b.building_name,
        b.building_code,
        u_rep.full_name AS reporter_name,
        u_rep.email AS reporter_email,
        u_rep.phone AS reporter_phone,
        u_rep.student_id AS reporter_student_id,
        u_rep.department AS reporter_department,
        u_rep.role AS reporter_role,
        u_staff.full_name AS staff_name,
        u_staff.email AS staff_email,
        u_staff.phone AS staff_phone,
        CASE 
          WHEN f.deadline IS NOT NULL AND f.deadline < datetime('now') AND f.status NOT IN ('Resolved', 'Closed', 'Rejected')
          THEN 1 ELSE 0 
        END AS is_overdue
      FROM faults f
      LEFT JOIN buildings b ON f.building_id = b.building_id
      LEFT JOIN users u_rep ON f.reported_by = u_rep.user_id
      LEFT JOIN users u_staff ON f.assigned_to = u_staff.user_id
      WHERE f.fault_id = ? OR f.complaint_code = ?
    `).get(faultId, faultId);

    if (!fault) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Authorization check: students/faculty can only view their own
    if ((req.user.role === 'student' || req.user.role === 'faculty') && fault.reported_by !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this complaint.' });
    }

    // Get audit history
    const history = db.prepare(`
      SELECT 
        h.*,
        u.full_name AS changed_by_name,
        u.role AS changed_by_role
      FROM fault_history h
      LEFT JOIN users u ON h.changed_by = u.user_id
      WHERE h.fault_id = ?
      ORDER BY h.changed_at ASC
    `).all(fault.fault_id);

    // Get maintenance record
    const maintenance = db.prepare(`
      SELECT 
        m.*,
        u.full_name AS staff_name
      FROM maintenance_records m
      LEFT JOIN users u ON m.staff_id = u.user_id
      WHERE m.fault_id = ?
      ORDER BY m.record_id DESC
      LIMIT 1
    `).get(fault.fault_id);

    return res.json({
      success: true,
      fault,
      history,
      maintenance: maintenance || null
    });
  } catch (err) {
    console.error('Get fault by ID error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving complaint details.' });
  }
}

// Update status
function updateStatus(req, res) {
  try {
    const faultId = req.params.id;
    const { status, notes } = req.body;

    const validStatuses = ['Reported', 'Verified', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected', 'Reopened'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const fault = db.prepare('SELECT * FROM faults WHERE fault_id = ?').get(faultId);
    if (!fault) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Role validation
    if (req.user.role === 'staff') {
      if (fault.assigned_to !== req.user.user_id) {
        return res.status(403).json({ success: false, message: 'Staff can only update tasks assigned to them.' });
      }
      const allowedStaffTransitions = ['In Progress', 'Resolved'];
      if (!allowedStaffTransitions.includes(status)) {
        return res.status(403).json({
          success: false,
          message: 'Staff members can only transition tasks to "In Progress" or "Resolved".'
        });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators and assigned staff can update status.' });
    }

    const oldStatus = fault.status;
    let resolvedAt = fault.resolved_at;
    if (status === 'Resolved' && !resolvedAt) {
      resolvedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
    } else if (status === 'Reopened' || status === 'In Progress') {
      resolvedAt = null;
    }

    db.prepare(`
      UPDATE faults
      SET status = ?, resolved_at = ?, updated_at = datetime('now')
      WHERE fault_id = ?
    `).run(status, resolvedAt, faultId);

    // Audit trail
    const auditNote = notes || `Status updated from ${oldStatus} to ${status}`;
    db.prepare(`
      INSERT INTO fault_history (fault_id, changed_by, old_status, new_status, notes, changed_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(faultId, req.user.user_id, oldStatus, status, auditNote);

    // Update maintenance record if staff completes or starts
    if (req.user.role === 'staff' || fault.assigned_to) {
      const existingMaint = db.prepare('SELECT record_id FROM maintenance_records WHERE fault_id = ?').get(faultId);
      const staffId = fault.assigned_to || req.user.user_id;

      if (status === 'In Progress') {
        if (!existingMaint) {
          db.prepare(`
            INSERT INTO maintenance_records (fault_id, staff_id, repair_notes, started_at)
            VALUES (?, ?, ?, datetime('now'))
          `).run(faultId, staffId, auditNote);
        }
      } else if (status === 'Resolved') {
        if (existingMaint) {
          db.prepare(`
            UPDATE maintenance_records
            SET completed_at = datetime('now'), repair_notes = COALESCE(?, repair_notes)
            WHERE record_id = ?
          `).run(auditNote, existingMaint.record_id);
        } else {
          db.prepare(`
            INSERT INTO maintenance_records (fault_id, staff_id, repair_notes, started_at, completed_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
          `).run(faultId, staffId, auditNote);
        }
      }
    }

    // Notifications
    createNotification(
      fault.reported_by,
      faultId,
      `Your complaint [${fault.complaint_code}] status has been updated to "${status}".`
    );

    if (fault.assigned_to && fault.assigned_to !== req.user.user_id) {
      createNotification(
        fault.assigned_to,
        faultId,
        `Complaint [${fault.complaint_code}] was marked as "${status}" by ${req.user.full_name}.`
      );
    }

    return res.json({
      success: true,
      message: `Status updated to ${status}.`,
      old_status: oldStatus,
      new_status: status
    });
  } catch (err) {
    console.error('Update status error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating status.' });
  }
}

// Assign maintenance staff (Admin only)
function assignStaff(req, res) {
  try {
    const faultId = req.params.id;
    const { staff_id, deadline, notes } = req.body;

    if (!staff_id) {
      return res.status(400).json({ success: false, message: 'Please specify a maintenance staff member.' });
    }

    const staff = db.prepare("SELECT user_id, full_name, email FROM users WHERE user_id = ? AND role = 'staff' AND is_active = 1").get(staff_id);
    if (!staff) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive maintenance staff member.' });
    }

    const fault = db.prepare('SELECT * FROM faults WHERE fault_id = ?').get(faultId);
    if (!fault) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const oldStatus = fault.status;
    const newStatus = (fault.status === 'Reported' || fault.status === 'Verified') ? 'Assigned' : fault.status;

    let targetDeadline = fault.deadline;
    if (deadline) {
      targetDeadline = String(deadline).replace('T', ' ');
      if (targetDeadline.length === 16) {
        targetDeadline += ':00';
      }
    }

    db.prepare(`
      UPDATE faults
      SET assigned_to = ?, status = ?, deadline = ?, updated_at = datetime('now')
      WHERE fault_id = ?
    `).run(staff_id, newStatus, targetDeadline, faultId);

    const auditNotes = notes || `Assigned to staff ${staff.full_name}.`;
    db.prepare(`
      INSERT INTO fault_history (fault_id, changed_by, old_status, new_status, notes, changed_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(faultId, req.user.user_id, oldStatus, newStatus, auditNotes);

    // Notifications
    createNotification(
      staff.user_id,
      faultId,
      `New maintenance task assigned to you: [${fault.complaint_code}] "${fault.title}".`
    );

    createNotification(
      fault.reported_by,
      faultId,
      `A maintenance technician (${staff.full_name}) has been assigned to your complaint [${fault.complaint_code}].`
    );

    return res.json({
      success: true,
      message: `Successfully assigned to ${staff.full_name}.`,
      status: newStatus
    });
  } catch (err) {
    console.error('Assign staff error:', err);
    return res.status(500).json({ success: false, message: 'Server error assigning staff.' });
  }
}

// Update priority (Admin only)
function updatePriority(req, res) {
  try {
    const faultId = req.params.id;
    const { priority } = req.body;

    const validPriorities = ['Low', 'Medium', 'High', 'Critical'];
    if (!priority || !validPriorities.includes(priority)) {
      return res.status(400).json({ success: false, message: 'Invalid priority.' });
    }

    const fault = db.prepare('SELECT * FROM faults WHERE fault_id = ?').get(faultId);
    if (!fault) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const newDeadline = calculateDeadline(priority);

    db.prepare(`
      UPDATE faults
      SET priority = ?, deadline = ?, updated_at = datetime('now')
      WHERE fault_id = ?
    `).run(priority, newDeadline, faultId);

    db.prepare(`
      INSERT INTO fault_history (fault_id, changed_by, old_status, new_status, notes, changed_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(faultId, req.user.user_id, fault.status, fault.status, `Priority adjusted to ${priority}`);

    return res.json({
      success: true,
      message: `Priority updated to ${priority}.`,
      deadline: newDeadline
    });
  } catch (err) {
    console.error('Update priority error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating priority.' });
  }
}

// Add repair notes and flag resources (Staff or Admin)
function addRepairNotes(req, res) {
  try {
    const faultId = req.params.id;
    const { repair_notes, resources_flagged } = req.body;

    const fault = db.prepare('SELECT * FROM faults WHERE fault_id = ?').get(faultId);
    if (!fault) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    if (req.user.role === 'staff' && fault.assigned_to !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized. You can only add notes to tasks assigned to you.' });
    }

    const flagVal = resources_flagged ? 1 : 0;
    const existing = db.prepare('SELECT record_id FROM maintenance_records WHERE fault_id = ?').get(faultId);

    if (existing) {
      db.prepare(`
        UPDATE maintenance_records
        SET repair_notes = ?, resources_flagged = ?
        WHERE record_id = ?
      `).run(repair_notes || '', flagVal, existing.record_id);
    } else {
      db.prepare(`
        INSERT INTO maintenance_records (fault_id, staff_id, repair_notes, resources_flagged, started_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(faultId, req.user.user_id, repair_notes || '', flagVal);
    }

    // Add entry to history
    const historyNote = flagVal === 1 
      ? `Repair Note: ${repair_notes || ''} [FLAGGED: Additional Resources/Parts Required]`
      : `Repair Note: ${repair_notes || ''}`;

    db.prepare(`
      INSERT INTO fault_history (fault_id, changed_by, old_status, new_status, notes, changed_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(faultId, req.user.user_id, fault.status, fault.status, historyNote);

    if (flagVal === 1) {
      notifyAdmins(
        faultId,
        `RESOURCE ALERT: Staff ${req.user.full_name} flagged complaint [${fault.complaint_code}] as requiring additional equipment/materials.`
      );
    }

    return res.json({
      success: true,
      message: 'Repair notes saved successfully.'
    });
  } catch (err) {
    console.error('Add repair notes error:', err);
    return res.status(500).json({ success: false, message: 'Server error saving repair notes.' });
  }
}

// Reopen a complaint (Reporter or Admin)
function reopenFault(req, res) {
  try {
    const faultId = req.params.id;
    const { reason } = req.body;

    const fault = db.prepare('SELECT * FROM faults WHERE fault_id = ?').get(faultId);
    if (!fault) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Rule: Only the student/faculty who reported it OR an admin can reopen
    if (req.user.role !== 'admin' && fault.reported_by !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'You can only reopen complaints submitted by yourself.' });
    }

    // Rule: Must be in Resolved or Closed state to reopen
    if (!['Resolved', 'Closed'].includes(fault.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only resolved or closed complaints can be reopened.'
      });
    }

    const oldStatus = fault.status;
    const newDeadline = calculateDeadline('High');

    db.prepare(`
      UPDATE faults
      SET status = 'Reopened', resolved_at = NULL, deadline = ?, updated_at = datetime('now')
      WHERE fault_id = ?
    `).run(newDeadline, faultId);

    const auditNotes = reason ? `Complaint reopened by user: "${reason}"` : 'Complaint reopened because the issue persisted.';
    db.prepare(`
      INSERT INTO fault_history (fault_id, changed_by, old_status, new_status, notes, changed_at)
      VALUES (?, ?, ?, 'Reopened', ?, datetime('now'))
    `).run(faultId, req.user.user_id, oldStatus, auditNotes);

    notifyAdmins(
      faultId,
      `Complaint [${fault.complaint_code}] was REOPENED: ${auditNotes}`
    );

    if (fault.assigned_to) {
      createNotification(
        fault.assigned_to,
        faultId,
        `Task [${fault.complaint_code}] has been reopened by user. Reason: ${reason || 'Issue persisted.'}`
      );
    }

    return res.json({
      success: true,
      message: 'Complaint has been reopened.',
      status: 'Reopened'
    });
  } catch (err) {
    console.error('Reopen fault error:', err);
    return res.status(500).json({ success: false, message: 'Server error reopening complaint.' });
  }
}

// Pre-check for duplicate complaints in real-time
function checkDuplicates(req, res) {
  try {
    const { building_id, room_number, category } = req.query;

    if (!building_id || !room_number || !category) {
      return res.json({ success: true, duplicates: [] });
    }

    const duplicates = db.prepare(`
      SELECT fault_id, complaint_code, title, status, priority, created_at
      FROM faults
      WHERE building_id = ? AND LOWER(TRIM(room_number)) = LOWER(TRIM(?)) AND category = ?
        AND status NOT IN ('Resolved', 'Closed', 'Rejected')
    `).all(building_id, room_number, category);

    return res.json({
      success: true,
      has_duplicates: duplicates.length > 0,
      duplicates
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error checking duplicate reports.' });
  }
}

module.exports = {
  createFault,
  getFaults,
  getFaultById,
  updateStatus,
  assignStaff,
  updatePriority,
  addRepairNotes,
  reopenFault,
  checkDuplicates
};
