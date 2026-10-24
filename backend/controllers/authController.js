const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'campus_fix_super_secret_jwt_key_2026_secure';

// Public Registration (Restricted to student/faculty roles)
function register(req, res) {
  try {
    const { full_name, email, phone, password, role } = req.body;

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

    // Role assignment security: public can only register as student or faculty
    let assignedRole = 'student';
    if (role && (role === 'student' || role === 'faculty')) {
      assignedRole = role;
    }

    const existing = db.prepare('SELECT user_id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const stmt = db.prepare(`
      INSERT INTO users (full_name, email, phone, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      full_name.trim(),
      email.toLowerCase().trim(),
      phone ? phone.trim() : null,
      password_hash,
      assignedRole
    );

    const user = {
      user_id: result.lastInsertRowid,
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone ? phone.trim() : null,
      role: assignedRole
    };

    const token = jwt.sign(
      { user_id: user.user_id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
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
    if (!user || user.is_active !== 1) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
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

module.exports = {
  register,
  login,
  getMe,
  listStaff,
  createStaff,
  listBuildings
};
