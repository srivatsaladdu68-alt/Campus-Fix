const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'campus_fix.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL performance mode
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'faculty', 'staff', 'admin')),
      student_id TEXT,
      department TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      approval_status TEXT DEFAULT 'approved',
      approval_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS buildings (
      building_id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_name TEXT UNIQUE NOT NULL,
      building_code TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS faults (
      fault_id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_code TEXT UNIQUE NOT NULL,
      reported_by INTEGER NOT NULL,
      title TEXT NOT NULL,
      item_name TEXT,
      description TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN (
        'Electrical', 'Plumbing', 'Furniture', 'Classroom Equipment',
        'Laboratory Equipment', 'Network/IT', 'Washroom', 'Safety', 'Other'
      )),
      building_id INTEGER NOT NULL,
      floor_number TEXT NOT NULL,
      room_number TEXT NOT NULL,
      image_path TEXT,
      priority TEXT NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')),
      status TEXT NOT NULL DEFAULT 'Reported' CHECK(status IN (
        'Reported', 'Verified', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected', 'Reopened'
      )),
      assigned_to INTEGER,
      deadline DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (reported_by) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (building_id) REFERENCES buildings(building_id) ON DELETE RESTRICT,
      FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS fault_history (
      history_id INTEGER PRIMARY KEY AUTOINCREMENT,
      fault_id INTEGER NOT NULL,
      changed_by INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      notes TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (fault_id) REFERENCES faults(fault_id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      fault_id INTEGER,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (fault_id) REFERENCES faults(fault_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS maintenance_records (
      record_id INTEGER PRIMARY KEY AUTOINCREMENT,
      fault_id INTEGER NOT NULL,
      staff_id INTEGER NOT NULL,
      repair_notes TEXT,
      resources_flagged INTEGER DEFAULT 0,
      started_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY (fault_id) REFERENCES faults(fault_id) ON DELETE CASCADE,
      FOREIGN KEY (staff_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_faults_status ON faults(status);
    CREATE INDEX IF NOT EXISTS idx_faults_reported_by ON faults(reported_by);
    CREATE INDEX IF NOT EXISTS idx_faults_assigned_to ON faults(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_faults_building ON faults(building_id);
    CREATE INDEX IF NOT EXISTS idx_faults_category ON faults(category);
    CREATE INDEX IF NOT EXISTS idx_fault_history_fault ON fault_history(fault_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
  `;

  db.exec(schema);

  // Safe migration check for existing tables
  try {
    const userCols = db.pragma('table_info(users)').map(c => c.name);
    if (!userCols.includes('approval_status')) {
      db.exec("ALTER TABLE users ADD COLUMN approval_status TEXT DEFAULT 'approved'");
    }
    if (!userCols.includes('approval_notes')) {
      db.exec("ALTER TABLE users ADD COLUMN approval_notes TEXT");
    }
    if (!userCols.includes('roll_number')) {
      db.exec("ALTER TABLE users ADD COLUMN roll_number TEXT");
    }
    if (!userCols.includes('staff_id')) {
      db.exec("ALTER TABLE users ADD COLUMN staff_id TEXT");
    }
    // Backfill existing student roll numbers and staff IDs
    db.exec("UPDATE users SET roll_number = student_id WHERE role = 'student' AND (roll_number IS NULL OR roll_number = '') AND student_id IS NOT NULL");
    db.exec("UPDATE users SET staff_id = 'STF-ELEC-01' WHERE email = 'staff.mike@vnrvjiet.in' AND staff_id IS NULL");
    db.exec("UPDATE users SET staff_id = 'STF-PLUM-02' WHERE email = 'staff.sarah@vnrvjiet.in' AND staff_id IS NULL");

    // Remove iot_sensor_events table if present
    db.exec("DROP TABLE IF EXISTS iot_sensor_events");
  } catch (err) {
    console.error('Migration notice:', err.message);
  }
}

function seedDatabase() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    return;
  }

  console.log('Seeding initial database data...');

  // 1. Seed Buildings
  const insertBuilding = db.prepare(
    'INSERT INTO buildings (building_name, building_code) VALUES (?, ?)'
  );
  const buildings = [
    ['E Block', 'E-BLOCK'],
    ['D Block', 'D-BLOCK'],
    ['C Block', 'C-BLOCK'],
    ['A Block', 'A-BLOCK'],
    ['PG Block', 'PG-BLOCK'],
    ['Canteen', 'CANTEEN'],
    ['Synti Stage', 'SYNTI-STAGE'],
    ['Sports Block', 'SPORTS']
  ];
  for (const b of buildings) {
    insertBuilding.run(b[0], b[1]);
  }

  // 2. Seed Users
  const salt = bcrypt.genSaltSync(10);
  const adminPass = bcrypt.hashSync('Admin@123', salt);
  const staffPass = bcrypt.hashSync('Staff@123', salt);
  const userPass = bcrypt.hashSync('Student@123', salt);
  const facultyPass = bcrypt.hashSync('Faculty@123', salt);

  const insertUser = db.prepare(`
    INSERT INTO users (full_name, email, phone, password_hash, role, student_id, roll_number, staff_id, department, approval_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')
  `);

  insertUser.run('Administrator', 'admin@vnrvjiet.in', '+91 9876543210', adminPass, 'admin', null, null, null, 'Campus Administration');
  insertUser.run('Mike Johnson (Electrician)', 'staff.mike@vnrvjiet.in', '+91 9876543211', staffPass, 'staff', null, null, 'STF-ELEC-01', 'Electrical & IT Maintenance');
  insertUser.run('Sarah Williams (Plumber)', 'staff.sarah@vnrvjiet.in', '+91 9876543212', staffPass, 'staff', null, null, 'STF-PLUM-02', 'Plumbing & Facilities');
  insertUser.run('David Miller (Carpenter)', 'staff.david@vnrvjiet.in', '+91 9876543215', staffPass, 'staff', null, null, 'STF-CARP-03', 'Carpentry & Furniture Maintenance');
  insertUser.run('Prof. Rajesh Sharma', 'prof.sharma@vnrvjiet.in', '+91 9876543213', facultyPass, 'faculty', 'FAC-CS-102', 'FAC-CS-102', 'FAC-CS-102', 'Computer Science & Engineering');
  insertUser.run('Alex Morgan', 'student.alex@vnrvjiet.in', '+91 9876543214', userPass, 'student', '22071A0501', '22071A0501', null, 'Computer Science & Engineering');

  console.log('Database initialized with VNRVJIET campus buildings and 5 core demo user accounts.');
}

initSchema();
seedDatabase();

module.exports = db;
