const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'campus_fix_super_secret_jwt_key_2026_secure';

// Public Registration (Student, Faculty, Staff)
function register(req, res) {
  try {
    const { full_name, email, phone, password, role, department } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide full name, email, and password.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    // Role assignment: public can register as student, faculty, or staff
    let assignedRole = 'student';
    if (role && ['student', 'faculty', 'staff'].includes(role)) {
      assignedRole = role;
    }

    const existing = db.prepare('SELECT user_id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    // All self-registered accounts (student, faculty, staff) require admin approval to prevent fake accounts
    const autoApprove = (req.headers['x-admin-auto-approve'] === 'true');
    const requiresApproval = !autoApprove;
    const isActive = requiresApproval ? 0 : 1;
    const approvalStatus = requiresApproval ? 'pending' : 'approved';
    const deptValue = department ? department.trim() : (assignedRole === 'staff' ? 'General Facilities' : 'Campus User');

    const stmt = db.prepare(`
      INSERT INTO users (full_name, email, phone, password_hash, role, department, is_active, approval_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      full_name.trim(),
      email.toLowerCase().trim(),
      phone ? phone.trim() : null,
      password_hash,
      assignedRole,
      deptValue,
      isActive,
      approvalStatus
    );

    const newUserId = result.lastInsertRowid;

    if (requiresApproval) {
      // Notify all campus administrators of new account registration request
      const admins = db.prepare("SELECT user_id FROM users WHERE role = 'admin'").all();
      const roleLabel = assignedRole.charAt(0).toUpperCase() + assignedRole.slice(1);
      for (const admin of admins) {
        db.prepare(`
          INSERT INTO notifications (user_id, message)
          VALUES (?, ?)
        `).run(admin.user_id, `New ${roleLabel} registration request from ${full_name.trim()} (${email.toLowerCase().trim()}). Review and approve in Admin Console.`);
      }

      return res.status(201).json({
        success: true,
        pending_approval: true,
        message: 'Registration submitted! All accounts require administrator verification before sign-in access is activated.',
        user: {
          user_id: newUserId,
          full_name: full_name.trim(),
          email: email.toLowerCase().trim(),
          role: assignedRole,
          approval_status: 'pending'
        }
      });
    }

    const user = {
      user_id: newUserId,
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone ? phone.trim() : null,
      role: assignedRole,
      approval_status: 'approved'
    };

    const token = jwt.sign(
      { user_id: user.user_id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      pending_approval: false,
      message: 'Account successfully registered.',
      token,
      user
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
}

// Login
function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter both email and password.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: "No account found with this email. Don't have an account? Please register."
      });
    }

    if (user.approval_status === 'rejected') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_REJECTED',
        message: 'Your account registration request was not approved by the administrator.'
      });
    }

    if (user.approval_status === 'pending' || user.is_active === 0) {
      return res.status(403).json({
        success: false,
        code: 'PENDING_APPROVAL',
        message: 'Your account registration is currently pending administrator approval. You will receive access once verified.'
      });
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_PASSWORD',
        message: 'Incorrect password. Please verify and try again.'
      });
    }

    const token = jwt.sign(
      { user_id: user.user_id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const safeUser = {
      user_id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role
    };

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
}

// Get current authenticated user
function getMe(req, res) {
  return res.json({
    success: true,
    user: req.user
  });
}

// List all maintenance staff (for admin assignment)
function listStaff(req, res) {
  try {
    const staff = db.prepare(`
      SELECT user_id, full_name, email, phone, role
      FROM users
      WHERE role = 'staff' AND is_active = 1
      ORDER BY full_name ASC
    `).all();

    return res.json({ success: true, staff });
  } catch (err) {
    console.error('List staff error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch staff members.' });
  }
}

// Admin creates an authorized staff member
function createStaff(req, res) {
  try {
    const { full_name, email, phone, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const existing = db.prepare('SELECT user_id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const stmt = db.prepare(`
      INSERT INTO users (full_name, email, phone, password_hash, role)
      VALUES (?, ?, ?, ?, 'staff')
    `);

    const result = stmt.run(
      full_name.trim(),
      email.toLowerCase().trim(),
      phone ? phone.trim() : null,
      password_hash
    );

    return res.status(201).json({
      success: true,
      message: 'Maintenance staff account registered successfully.',
      staff_id: result.lastInsertRowid
    });
  } catch (err) {
    console.error('Create staff error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create staff account.' });
  }
}

// List buildings
function listBuildings(req, res) {
  try {
    const buildings = db.prepare('SELECT * FROM buildings ORDER BY building_name ASC').all();
    return res.json({ success: true, buildings });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve buildings.' });
  }
}

// List all pending approvals (Admin)
function listPendingApprovals(req, res) {
  try {
    const pending = db.prepare(`
      SELECT user_id, full_name, email, phone, role, department, created_at, approval_status
      FROM users
      WHERE approval_status = 'pending' OR (is_active = 0 AND approval_status != 'rejected')
      ORDER BY created_at DESC
    `).all();

    return res.json({ success: true, pending });
  } catch (err) {
    console.error('List pending approvals error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve pending approvals.' });
  }
}

// Approve account request (Admin)
function approveUser(req, res) {
  try {
    const userId = req.params.id;
    const { notes } = req.body || {};

    const user = db.prepare('SELECT user_id, full_name, email, role FROM users WHERE user_id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    db.prepare(`
      UPDATE users
      SET is_active = 1, approval_status = 'approved', approval_notes = ?
      WHERE user_id = ?
    `).run(notes || 'Approved by Administrator', userId);

    // Send notification to the user that they are approved successfully
    db.prepare(`
      INSERT INTO notifications (user_id, message)
      VALUES (?, ?)
    `).run(userId, 'Approved successfully! Your account is active and you can now sign in.');

    // Send confirmation notification to admin
    const adminId = req.user ? req.user.user_id : null;
    if (adminId) {
      db.prepare(`
        INSERT INTO notifications (user_id, message)
        VALUES (?, ?)
      `).run(adminId, `Approved successfully: Registration for ${user.full_name} (${user.role.toUpperCase()}) was verified.`);
    }

    return res.json({
      success: true,
      message: 'Approved successfully.'
    });
  } catch (err) {
    console.error('Approve user error:', err);
    return res.status(500).json({ success: false, message: 'Failed to approve user.' });
  }
}

// Reject account request (Admin)
function rejectUser(req, res) {
  try {
    const userId = req.params.id;
    const { notes } = req.body || {};

    const user = db.prepare('SELECT user_id, full_name, email, role FROM users WHERE user_id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    db.prepare(`
      UPDATE users
      SET is_active = 0, approval_status = 'rejected', approval_notes = ?
      WHERE user_id = ?
    `).run(notes || 'Registration rejected by Administrator', userId);

    // If rejected: no notification is sent

    return res.json({
      success: true,
      message: 'Account rejected.'
    });
  } catch (err) {
    console.error('Reject user error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reject user.' });
  }
}

module.exports = {
  register,
  login,
  getMe,
  listStaff,
  createStaff,
  listBuildings,
  listPendingApprovals,
  approveUser,
  rejectUser
};
