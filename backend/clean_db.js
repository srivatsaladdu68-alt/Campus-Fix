const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'campus_fix.db');
const db = new Database(dbPath);

console.log('=======================================================');
console.log('🧹 PURGING DATABASE TO RETAIN ONLY 5 DEMO LOGINS');
console.log('=======================================================');

// 1. Disable foreign keys temporarily for clean cascade deletion
db.pragma('foreign_keys = OFF');

// 2. Wipe complaints, history, notifications, maintenance records
db.exec(`
  DELETE FROM fault_history;
  DELETE FROM maintenance_records;
  DELETE FROM notifications;
  DELETE FROM faults;
  DELETE FROM sqlite_sequence WHERE name IN ('faults', 'fault_history', 'maintenance_records', 'notifications');
`);

// 3. Delete all users EXCEPT the 6 official demo login accounts
const demoEmails = [
  'admin@vnrvjiet.in',
  'staff.prakash@vnrvjiet.in',
  'staff.naresh@vnrvjiet.in',
  'staff.ramesh@vnrvjiet.in',
  'staff.santosh@vnrvjiet.in',
  'staff.venkatesh@vnrvjiet.in',
  'staff.ramarao@vnrvjiet.in',
  'staff.krishna@vnrvjiet.in',
  'staff.harish@vnrvjiet.in',
  'staff.suresh@vnrvjiet.in',
  'staff.abhipray@vnrvjiet.in',
  'staff.lakshith@vnrvjiet.in',
  'staff.mike@vnrvjiet.in',
  'staff.sarah@vnrvjiet.in',
  'staff.david@vnrvjiet.in',
  'staff.kevin@vnrvjiet.in',
  '25071a6671@vnrvjiet.in',
  '25071a03b2@vnrvjiet.in',
  'student.srivatsa@vnrvjiet.in',
  'student.sidharth@vnrvjiet.in',
  'student.alex@vnrvjiet.in',
  'prof.prathyusha@vnrvjiet.in',
  'prof.pratyusha@vnrvjiet.in',
  'prof.sharma@vnrvjiet.in'
];

const placeholders = demoEmails.map(() => '?').join(',');
db.prepare(`DELETE FROM users WHERE email NOT IN (${placeholders})`).run(...demoEmails);

// 4. Update the retained demo accounts to standard clean profiles
db.prepare(`
  UPDATE users 
  SET full_name = 'Administrator', role = 'admin', approval_status = 'approved', is_active = 1, department = 'Campus Administration'
  WHERE email = 'admin@vnrvjiet.in'
`).run();

db.prepare(`
  UPDATE users 
  SET full_name = 'Prakash (Electrician)', role = 'staff', email = 'staff.prakash@vnrvjiet.in', staff_id = 'STF-ELEC-01', approval_status = 'approved', is_active = 1, department = 'Electrical & IT Maintenance'
  WHERE email IN ('staff.mike@vnrvjiet.in', 'staff.abhipray@vnrvjiet.in', 'staff.prakash@vnrvjiet.in') OR staff_id = 'STF-ELEC-01'
`).run();

db.prepare(`
  UPDATE users 
  SET full_name = 'Ramesh (Plumber)', role = 'staff', email = 'staff.ramesh@vnrvjiet.in', staff_id = 'STF-PLUM-02', approval_status = 'approved', is_active = 1, department = 'Plumbing & Facilities'
  WHERE email IN ('staff.sarah@vnrvjiet.in', 'staff.santosh@vnrvjiet.in', 'staff.ramesh@vnrvjiet.in') OR staff_id = 'STF-PLUM-02'
`).run();

db.prepare(`
  UPDATE users 
  SET full_name = 'Rama Rao (Carpenter)', email = 'staff.ramarao@vnrvjiet.in', role = 'staff', staff_id = 'STF-CARP-03', approval_status = 'approved', is_active = 1, department = 'Carpentry & Furniture Maintenance'
  WHERE email IN ('staff.david@vnrvjiet.in', 'staff.ramarao@vnrvjiet.in') OR staff_id = 'STF-CARP-03'
`).run();

db.prepare(`
  UPDATE users 
  SET full_name = 'Harish (Lab Technician)', role = 'staff', email = 'staff.harish@vnrvjiet.in', staff_id = 'STF-LAB-04', approval_status = 'approved', is_active = 1, department = 'Laboratory & IT Infrastructure'
  WHERE email IN ('staff.kevin@vnrvjiet.in', 'staff.lakshith@vnrvjiet.in', 'staff.harish@vnrvjiet.in') OR staff_id IN ('STF-WIFI-04', 'STF-LAB-04')
`).run();

db.prepare(`
  UPDATE users 
  SET full_name = 'Srivatsa', email = '25071a6671@vnrvjiet.in', role = 'student', student_id = '25071A6671', roll_number = '25071A6671', approval_status = 'approved', is_active = 1, department = 'Computer Science & Engineering'
  WHERE email IN ('student.alex@vnrvjiet.in', 'student.srivatsa@vnrvjiet.in', '25071a6671@vnrvjiet.in') OR (role = 'student' AND (full_name LIKE '%Alex%' OR roll_number IN ('22071A0501', '25071A6671')))
`).run();

db.prepare(`
  UPDATE users 
  SET full_name = 'Sidharth', email = '25071a03b2@vnrvjiet.in', role = 'student', student_id = '25071A03B2', roll_number = '25071A03B2', approval_status = 'approved', is_active = 1, department = 'Mechanical Engineering'
  WHERE email IN ('student.sidharth@vnrvjiet.in', '25071a03b2@vnrvjiet.in') OR roll_number IN ('25071A0875', '25071A03B2')
`).run();

db.prepare(`
  UPDATE users 
  SET full_name = 'Prof. Prathyusha', email = 'prof.prathyusha@vnrvjiet.in', role = 'faculty', student_id = 'FAC-CS-102', roll_number = 'FAC-CS-102', staff_id = 'FAC-CS-102', approval_status = 'approved', is_active = 1, department = 'Computer Science & Engineering'
  WHERE email IN ('prof.sharma@vnrvjiet.in', 'prof.pratyusha@vnrvjiet.in', 'prof.prathyusha@vnrvjiet.in') OR (role = 'faculty' AND (full_name LIKE '%Sharma%' OR full_name LIKE '%Pratyusha%'))
`).run();

// 5. Re-enable foreign keys
db.pragma('foreign_keys = ON');

// 6. Clean orphaned uploaded test images (preserve standard SVG assets)
const uploadsDir = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadsDir)) {
  const files = fs.readdirSync(uploadsDir);
  let removedCount = 0;
  for (const file of files) {
    if (!file.endsWith('.svg')) {
      try {
        fs.unlinkSync(path.join(uploadsDir, file));
        removedCount++;
      } catch (e) {
        // ignore
      }
    }
  }
  console.log(`Cleaned ${removedCount} test image file(s) from backend/uploads/`);
}

// 7. Summary
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
const faultCount = db.prepare('SELECT COUNT(*) as count FROM faults').get().count;
const notifCount = db.prepare('SELECT COUNT(*) as count FROM notifications').get().count;
const histCount = db.prepare('SELECT COUNT(*) as count FROM fault_history').get().count;
const maintCount = db.prepare('SELECT COUNT(*) as count FROM maintenance_records').get().count;
const bldCount = db.prepare('SELECT COUNT(*) as count FROM buildings').get().count;

console.log('\n📊 DATABASE SUMMARY AFTER PURGE:');
console.table([
  { Table: 'users', Rows_Remaining: userCount, Status: 'Preserved 5 Demo Logins Only' },
  { Table: 'faults', Rows_Remaining: faultCount, Status: 'Cleaned' },
  { Table: 'fault_history', Rows_Remaining: histCount, Status: 'Cleaned' },
  { Table: 'maintenance_records', Rows_Remaining: maintCount, Status: 'Cleaned' },
  { Table: 'notifications', Rows_Remaining: notifCount, Status: 'Cleaned' },
  { Table: 'buildings', Rows_Remaining: bldCount, Status: 'Preserved Campus Blocks' }
]);

console.log('\n👥 REMAINING DEMO USERS IN DATABASE:');
const users = db.prepare('SELECT user_id, full_name, email, role, roll_number, staff_id, approval_status FROM users ORDER BY user_id ASC').all();
console.table(users);

db.close();
console.log('✅ Database cleanup completed successfully!');
