const db = require('./database');

const arg = process.argv[2] ? process.argv[2].toLowerCase() : 'summary';

if (arg === 'users') {
  console.log('\n👥 USERS TABLE (Latest 20):');
  const users = db.prepare(`
    SELECT user_id, full_name, email, role,
           COALESCE(roll_number, student_id) as roll_no, staff_id,
           department, approval_status, is_active, created_at
    FROM users
    ORDER BY user_id DESC
    LIMIT 20
  `).all();
  console.table(users);
} else if (arg === 'faults' || arg === 'complaints') {
  console.log('\n🛠️ FAULTS TABLE (Latest 20):');
  const faults = db.prepare(`
    SELECT fault_id, complaint_code, title, category, priority, status,
           building_id, room_number, created_at
    FROM faults
    ORDER BY fault_id DESC
    LIMIT 20
  `).all();
  console.table(faults);
} else if (arg === 'notifications') {
  console.log('\n🔔 NOTIFICATIONS TABLE (Latest 20):');
  const notifs = db.prepare(`
    SELECT notification_id, user_id, message, is_read, created_at
    FROM notifications
    ORDER BY notification_id DESC
    LIMIT 20
  `).all();
  console.table(notifs);
} else if (arg === 'buildings') {
  console.log('\n🏢 BUILDINGS TABLE:');
  const buildings = db.prepare('SELECT * FROM buildings').all();
  console.table(buildings);
} else {
  console.log('=======================================================');
  console.log('📊 CAMPUS FIX DATABASE OVERVIEW (campus_fix.db)');
  console.log('=======================================================');

  const tables = ['users', 'faults', 'fault_history', 'buildings', 'notifications', 'maintenance_records'];
  const summary = tables.map(table => {
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
      return { Table: table, Total_Rows: count };
    } catch (e) {
      return { Table: table, Total_Rows: 'N/A' };
    }
  });
  console.table(summary);

  console.log('\n💡 Tip: To inspect a specific table in detail, run:');
  console.log('   node view_db.js users');
  console.log('   node view_db.js faults');
  console.log('   node view_db.js notifications');
  console.log('   node view_db.js buildings\n');
}
