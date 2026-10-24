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
      is_active INTEGER DEFAULT 1
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

    CREATE TABLE IF NOT EXISTS iot_sensor_events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      location TEXT NOT NULL,
      event_type TEXT NOT NULL,
      measured_value REAL NOT NULL,
      threshold_value REAL NOT NULL,
      alert_status TEXT NOT NULL,
      fault_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (fault_id) REFERENCES faults(fault_id) ON DELETE SET NULL
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
    ['Science & Research Complex', 'SRC'],
    ['Computer Science & Engineering Building', 'CSE'],
    ['Central Campus Library', 'LIB'],
    ['Main Administrative Block', 'ADM'],
    ['Student Hostel Block A', 'SHA'],
    ['Sports & Recreation Center', 'SPORTS']
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
    INSERT INTO users (full_name, email, phone, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `);

  const adminId = insertUser.run('Campus Administrator', 'admin@campusfix.edu', '+91 9876543210', adminPass, 'admin').lastInsertRowid;
  const mikeId = insertUser.run('Mike Johnson (Electrical & IT)', 'staff.mike@campusfix.edu', '+91 9876543211', staffPass, 'staff').lastInsertRowid;
  const sarahId = insertUser.run('Sarah Williams (Plumbing & HVAC)', 'staff.sarah@campusfix.edu', '+91 9876543212', staffPass, 'staff').lastInsertRowid;
  const facultyId = insertUser.run('Prof. Rajesh Sharma', 'prof.sharma@campusfix.edu', '+91 9876543213', facultyPass, 'faculty').lastInsertRowid;
  const alexId = insertUser.run('Alex Morgan (Student)', 'student.alex@campusfix.edu', '+91 9876543214', userPass, 'student').lastInsertRowid;
  const priyaId = insertUser.run('Priya Patel (Student)', 'student.priya@campusfix.edu', '+91 9876543215', userPass, 'student').lastInsertRowid;

  // 3. Seed Realistic Complaints
  const insertFault = db.prepare(`
    INSERT INTO faults (
      complaint_code, reported_by, title, description, category,
      building_id, floor_number, room_number, priority, status,
      assigned_to, deadline, created_at, updated_at, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertHistory = db.prepare(`
    INSERT INTO fault_history (fault_id, changed_by, old_status, new_status, notes, changed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertNotification = db.prepare(`
    INSERT INTO notifications (user_id, fault_id, message, is_read, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMaintenance = db.prepare(`
    INSERT INTO maintenance_records (fault_id, staff_id, repair_notes, resources_flagged, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Sample faults data
  const sampleFaults = [
    {
      code: 'CF-2026-1001',
      reported_by: alexId,
      title: 'Ceiling Projector HDMI Port Damaged',
      description: 'The ceiling mounted projector in Room 302 has a loose HDMI input connector causing intermittent blackouts during lectures.',
      category: 'Classroom Equipment',
      building_id: 2, // CSE
      floor: '3rd Floor',
      room: 'Room 302',
      priority: 'High',
      status: 'In Progress',
      assigned_to: mikeId,
      deadline: '2026-10-25 18:00:00',
      created_at: '2026-10-22 09:30:00',
      updated_at: '2026-10-23 11:00:00',
      resolved_at: null,
      history: [
        { by: alexId, old: null, new: 'Reported', notes: 'Initial complaint filed with classroom details.', time: '2026-10-22 09:30:00' },
        { by: adminId, old: 'Reported', new: 'Verified', notes: 'Complaint verified with department coordinator.', time: '2026-10-22 11:15:00' },
        { by: adminId, old: 'Verified', new: 'Assigned', notes: 'Assigned to Mike Johnson (Electrical & IT).', time: '2026-10-22 14:00:00' },
        { by: mikeId, old: 'Assigned', new: 'In Progress', notes: 'Checked cable harness. Replacement adapter ordered from store.', time: '2026-10-23 11:00:00' }
      ],
      maint: { staff: mikeId, notes: 'Inspected projector mount. HDMI breakout port pins bent. Sourcing spare adapter cable.', flag: 0, start: '2026-10-23 11:00:00', end: null }
    },
    {
      code: 'CF-2026-1002',
      reported_by: priyaId,
      title: 'Water Pipe Leakage Under Sink',
      description: 'Major water leakage from supply pipe in 2nd floor female restroom causing pooling on the tile floor.',
      category: 'Washroom',
      building_id: 1, // SRC
      floor: '2nd Floor',
      room: 'Restroom 2B',
      priority: 'Critical',
      status: 'Assigned',
      assigned_to: sarahId,
      deadline: '2026-10-24 14:00:00',
      created_at: '2026-10-23 08:15:00',
      updated_at: '2026-10-23 09:30:00',
      resolved_at: null,
      history: [
        { by: priyaId, old: null, new: 'Reported', notes: 'Reported urgent water leak.', time: '2026-10-23 08:15:00' },
        { by: adminId, old: 'Reported', new: 'Verified', notes: 'Critical water hazard acknowledged.', time: '2026-10-23 08:45:00' },
        { by: adminId, old: 'Verified', new: 'Assigned', notes: 'Assigned with urgent priority to Sarah Williams.', time: '2026-10-23 09:30:00' }
      ],
      maint: null
    },
    {
      code: 'CF-2026-1003',
      reported_by: facultyId,
      title: 'Lab 4 Central AC Compressor Tripping',
      description: 'Air conditioning in the Advanced AI Research Lab shuts down within 10 minutes, causing server rack temperature warnings.',
      category: 'Electrical',
      building_id: 2, // CSE
      floor: 'Ground Floor',
      room: 'Research Lab 4',
      priority: 'Critical',
      status: 'In Progress',
      assigned_to: mikeId,
      deadline: '2026-10-24 12:00:00',
      created_at: '2026-10-21 14:00:00',
      updated_at: '2026-10-22 10:00:00',
      resolved_at: null,
      history: [
        { by: facultyId, old: null, new: 'Reported', notes: 'High server heat warning recorded.', time: '2026-10-21 14:00:00' },
        { by: adminId, old: 'Reported', new: 'Assigned', notes: 'Expedited directly to Mike Johnson.', time: '2026-10-21 15:00:00' },
        { by: mikeId, old: 'Assigned', new: 'In Progress', notes: 'Testing circuit breaker and capacitor.', time: '2026-10-22 10:00:00' }
      ],
      maint: { staff: mikeId, notes: 'Condenser coils need high-pressure cleaning. Breaker load tested OK.', flag: 1, start: '2026-10-22 10:00:00', end: null }
    },
    {
      code: 'CF-2026-1004',
      reported_by: alexId,
      title: 'Broken Ergonomic Study Chairs',
      description: 'Three study chairs in the quiet reading bay have broken hydraulic gas cylinders and tilted bases.',
      category: 'Furniture',
      building_id: 3, // LIB
      floor: '1st Floor',
      room: 'Quiet Study Bay C',
      priority: 'Low',
      status: 'Resolved',
      assigned_to: sarahId,
      deadline: '2026-10-20 17:00:00',
      created_at: '2026-10-18 10:00:00',
      updated_at: '2026-10-19 16:30:00',
      resolved_at: '2026-10-19 16:30:00',
      history: [
        { by: alexId, old: null, new: 'Reported', notes: 'Complaint filed.', time: '2026-10-18 10:00:00' },
        { by: adminId, old: 'Reported', new: 'Assigned', notes: 'Assigned to Sarah.', time: '2026-10-18 11:30:00' },
        { by: sarahId, old: 'Assigned', new: 'In Progress', notes: 'Replaced gas lifts and caster wheels.', time: '2026-10-19 14:00:00' },
        { by: sarahId, old: 'In Progress', new: 'Resolved', notes: 'All 3 chairs repaired and tested.', time: '2026-10-19 16:30:00' }
      ],
      maint: { staff: sarahId, notes: 'Installed new heavy-duty cylinders and tightened base screws.', flag: 0, start: '2026-10-19 14:00:00', end: '2026-10-19 16:30:00' }
    },
    {
      code: 'CF-2026-1005',
      reported_by: priyaId,
      title: 'Hostel Wi-Fi Access Point Offline',
      description: 'Access Point on corridor Wing 2 is flashing red and no IP address is assigned to connected student laptops.',
      category: 'Network/IT',
      building_id: 5, // Hostel Block A
      floor: '2nd Floor',
      room: 'Corridor Wing 2',
      priority: 'Medium',
      status: 'Reported',
      assigned_to: null,
      deadline: '2026-10-26 12:00:00',
      created_at: '2026-10-24 10:00:00',
      updated_at: '2026-10-24 10:00:00',
      resolved_at: null,
      history: [
        { by: priyaId, old: null, new: 'Reported', notes: 'Submitted by student via mobile portal.', time: '2026-10-24 10:00:00' }
      ],
      maint: null
    },
    {
      code: 'CF-2026-1006',
      reported_by: facultyId,
      title: 'Fume Hood Exhaust Failure',
      description: 'Chemistry Lab B fume hood velocity sensor triggered an audible alarm; airflow inadequate for hazardous vapor extraction.',
      category: 'Laboratory Equipment',
      building_id: 1, // Science Complex
      floor: '3rd Floor',
      room: 'Organic Chemistry Lab B',
      priority: 'Critical',
      status: 'Verified',
      assigned_to: null,
      deadline: '2026-10-24 16:00:00',
      created_at: '2026-10-24 07:45:00',
      updated_at: '2026-10-24 08:30:00',
      resolved_at: null,
      history: [
        { by: facultyId, old: null, new: 'Reported', notes: 'Urgent lab safety notice.', time: '2026-10-24 07:45:00' },
        { by: adminId, old: 'Reported', new: 'Verified', notes: 'Verified safety urgency. Awaiting dedicated HVAC technician.', time: '2026-10-24 08:30:00' }
      ],
      maint: null
    }
  ];

  for (const f of sampleFaults) {
    const fRes = insertFault.run(
      f.code, f.reported_by, f.title, f.description, f.category,
      f.building_id, f.floor, f.room, f.priority, f.status,
      f.assigned_to, f.deadline, f.created_at, f.updated_at, f.resolved_at
    );
    const faultId = fRes.lastInsertRowid;

    for (const h of f.history) {
      insertHistory.run(faultId, h.by, h.old, h.new, h.notes, h.time);
    }

    if (f.maint) {
      insertMaintenance.run(
        faultId, f.maint.staff, f.maint.notes, f.maint.flag, f.maint.start, f.maint.end
      );
    }

    // Seed notifications for user
    insertNotification.run(
      f.reported_by,
      faultId,
      `Your complaint [${f.code}] "${f.title}" is currently marked as ${f.status}.`,
      0,
      f.updated_at
    );
  }

  // Seed sample IoT event telemetry for future smart campus demonstration
  const insertIoT = db.prepare(`
    INSERT INTO iot_sensor_events (device_id, location, event_type, measured_value, threshold_value, alert_status, fault_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertIoT.run('IOT-WATER-202', 'Science Complex - Restroom 2B', 'water_flow_leak', 8.5, 3.0, 'TRIGGERED', 2, '2026-10-23 08:14:00');
  insertIoT.run('IOT-TEMP-404', 'CSE Building - Research Lab 4', 'temperature_high', 34.2, 26.0, 'TRIGGERED', 3, '2026-10-21 13:58:00');
  insertIoT.run('IOT-POWER-101', 'Central Campus Library - Bay C', 'voltage_fluctuation', 255.0, 240.0, 'NORMAL', null, '2026-10-24 09:00:00');

  console.log('Database seeded successfully with default users and test complaints!');
}

initSchema();
seedDatabase();

module.exports = db;
