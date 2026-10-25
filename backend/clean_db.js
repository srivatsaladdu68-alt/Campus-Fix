const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'campus_fix.db');
const db = new Database(dbPath);

console.log('Purging false / mock data from SQLite database...');

// Disable foreign keys temporarily for clean cascade wipe
db.pragma('foreign_keys = OFF');

db.exec(`
  DELETE FROM fault_history;
  DELETE FROM maintenance_records;
  DELETE FROM notifications;
  DELETE FROM faults;
  DELETE FROM sqlite_sequence WHERE name IN ('faults', 'fault_history', 'maintenance_records', 'notifications');
`);

db.pragma('foreign_keys = ON');

// Verify counts
const faultCount = db.prepare('SELECT COUNT(*) as count FROM faults').get().count;
const notifCount = db.prepare('SELECT COUNT(*) as count FROM notifications').get().count;
const histCount = db.prepare('SELECT COUNT(*) as count FROM fault_history').get().count;
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
const bldCount = db.prepare('SELECT COUNT(*) as count FROM buildings').get().count;

console.log(`Database cleaned successfully!`);
console.log(`Faults remaining: ${faultCount}`);
console.log(`History remaining: ${histCount}`);
console.log(`Notifications remaining: ${notifCount}`);
console.log(`Users preserved: ${userCount}`);
console.log(`Buildings preserved: ${bldCount}`);

db.close();
