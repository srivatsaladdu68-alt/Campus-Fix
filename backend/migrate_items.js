const db = require('./database');

// 1. Add columns to users and faults if not exists
try { db.exec('ALTER TABLE users ADD COLUMN student_id TEXT;'); } catch(e){}
try { db.exec('ALTER TABLE users ADD COLUMN department TEXT;'); } catch(e){}
try { db.exec('ALTER TABLE faults ADD COLUMN item_name TEXT;'); } catch(e){}

// 2. Update users with Student ID / Roll Number and Department
const updateUser = db.prepare('UPDATE users SET student_id = ?, department = ? WHERE email = ?');
updateUser.run('STU-2024-CS-041', 'Computer Science & Engineering', 'student.alex@campusfix.edu');
updateUser.run('STU-2024-EC-089', 'Electronics & Communication', 'student.priya@campusfix.edu');
updateUser.run('FAC-CS-102', 'Computer Science & Engineering', 'prof.sharma@campusfix.edu');
updateUser.run('EMP-TECH-01', 'Electrical & Maintenance Dept', 'staff.mike@campusfix.edu');
updateUser.run('EMP-TECH-02', 'Plumbing & Civil Facilities', 'staff.sarah@campusfix.edu');
updateUser.run('ADMIN-DIR-01', 'Campus Facilities Directorate', 'admin@campusfix.edu');

// 3. Update faults with exact item names and image paths
const updateFault = db.prepare('UPDATE faults SET item_name = ?, image_path = ? WHERE complaint_code = ?');
updateFault.run('Ceiling Projector', '/uploads/projector_fault.svg', 'CF-2026-1001');
updateFault.run('Under-Sink Water Pipe', '/uploads/pipe_leak_fault.svg', 'CF-2026-1002');
updateFault.run('Central AC Compressor', '/uploads/ac_fault.svg', 'CF-2026-1003');
updateFault.run('Ergonomic Study Chair', '/uploads/chair_broken_fault.svg', 'CF-2026-1004');
updateFault.run('Wi-Fi Access Point Router', '/uploads/wifi_fault.svg', 'CF-2026-1005');
updateFault.run('Fume Hood Velocity Sensor', '/uploads/pipe_leak_fault.svg', 'CF-2026-1006');

// Tube lights and other items
db.prepare("UPDATE faults SET item_name = 'Fluorescent Tube Light T12', image_path = '/uploads/tubelight_fault.svg' WHERE title LIKE '%tube%' OR title LIKE '%light%'").run();
db.prepare("UPDATE faults SET item_name = 'Restroom Water Pipe', image_path = '/uploads/pipe_leak_fault.svg' WHERE title LIKE '%water%' AND (item_name IS NULL OR item_name = '')").run();
db.prepare("UPDATE faults SET item_name = 'Laboratory Equipment Unit', image_path = '/uploads/projector_fault.svg' WHERE item_name IS NULL OR item_name = ''").run();

console.log('=== MIGRATION & IMAGE LINKING COMPLETE ===');
const faults = db.prepare('SELECT fault_id, complaint_code, item_name, image_path, reported_by FROM faults LIMIT 6').all();
console.table(faults);
const users = db.prepare('SELECT user_id, full_name, student_id, department, role FROM users LIMIT 6').all();
console.table(users);
