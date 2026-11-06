const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'campus_fix.db');
const db = new Database(dbPath);

console.log('=======================================================');
console.log('🧹 CLEARING ALL DATA EXCEPT USERS');
console.log('=======================================================');

// 1. Disable foreign keys temporarily for clean wipe
db.pragma('foreign_keys = OFF');

// 2. Wipe complaints, history, notifications, maintenance records
db.exec(`
  DELETE FROM fault_history;
  DELETE FROM maintenance_records;
  DELETE FROM notifications;
  DELETE FROM faults;
  DELETE FROM sqlite_sequence WHERE name IN ('faults', 'fault_history', 'maintenance_records', 'notifications');
`);

// 3. Re-enable foreign keys
db.pragma('foreign_keys = ON');

// 4. Clean orphaned uploaded images (preserve standard SVG assets)
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
  console.log(`Cleaned ${removedCount} uploaded file(s) from backend/uploads/`);
}

// 5. Summary
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
const faultCount = db.prepare('SELECT COUNT(*) as count FROM faults').get().count;
const notifCount = db.prepare('SELECT COUNT(*) as count FROM notifications').get().count;
const histCount = db.prepare('SELECT COUNT(*) as count FROM fault_history').get().count;
const maintCount = db.prepare('SELECT COUNT(*) as count FROM maintenance_records').get().count;
const bldCount = db.prepare('SELECT COUNT(*) as count FROM buildings').get().count;

console.log('\n📊 DATABASE SUMMARY:');
console.table([
  { Table: 'users', Rows_Remaining: userCount, Status: 'Preserved All Users' },
  { Table: 'buildings', Rows_Remaining: bldCount, Status: 'Preserved Campus Blocks' },
  { Table: 'faults', Rows_Remaining: faultCount, Status: 'Cleared' },
  { Table: 'fault_history', Rows_Remaining: histCount, Status: 'Cleared' },
  { Table: 'maintenance_records', Rows_Remaining: maintCount, Status: 'Cleared' },
  { Table: 'notifications', Rows_Remaining: notifCount, Status: 'Cleared' }
]);

console.log('\n👥 PRESERVED USERS IN DATABASE:');
const users = db.prepare('SELECT user_id, full_name, email, role, department FROM users ORDER BY user_id ASC').all();
console.table(users);

db.close();
console.log('\n✅ Database reset completed! All complaint and activity data cleared, all users preserved.');
