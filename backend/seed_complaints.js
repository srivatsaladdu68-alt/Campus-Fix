const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'campus_fix.db');
const db = new Database(dbPath);

console.log('Seeding realistic VNRVJIET complaints across campus blocks...');

const complaints = [
  {
    code: 'CF-2026-1001',
    title: 'Ceiling projector HDMI port damaged',
    description: 'Projector port in Classroom E-204 is loose and signal drops intermittently during lectures.',
    category: 'Classroom Equipment',
    building_id: 1, // E Block
    floor_number: '2nd Floor',
    room_number: 'Room E-204',
    item_name: 'Overhead Projector',
    priority: 'High',
    status: 'In Progress',
    reported_by: 5, // Alex Morgan
    assigned_to: 2, // Mike Johnson
    created_at: new Date(Date.now() - 3 * 86400000).toISOString()
  },
  {
    code: 'CF-2026-1002',
    title: 'Fluorescent tube violently flickering',
    description: 'Fluorescent light tube T12 flickering strobe causing distraction.',
    category: 'Electrical',
    building_id: 1, // E Block
    floor_number: '1st Floor',
    room_number: 'Room E-102',
    item_name: 'Tube Light T12',
    priority: 'Medium',
    status: 'Assigned',
    reported_by: 6, // Priya Patel
    assigned_to: 2, // Mike Johnson
    created_at: new Date(Date.now() - 2 * 86400000).toISOString()
  },
  {
    code: 'CF-2026-1003',
    title: 'Water cooler tap continuous leakage',
    description: 'Water filtration cooler tap in D Block corridor leaking continuously causing slippery floor.',
    category: 'Plumbing',
    building_id: 2, // D Block
    floor_number: 'Ground Floor',
    room_number: 'Corridor 01',
    item_name: 'Water Cooler',
    priority: 'High',
    status: 'In Progress',
    reported_by: 5,
    assigned_to: 3, // Sarah Williams
    created_at: new Date(Date.now() - 4 * 86400000).toISOString()
  },
  {
    code: 'CF-2026-1004',
    title: 'Computer Lab 3 network port dead',
    description: 'Station 14 Ethernet port is disconnected and not receiving IP lease.',
    category: 'Network/IT',
    building_id: 3, // C Block
    floor_number: '2nd Floor',
    room_number: 'Lab 3',
    item_name: 'Network Switch / Port',
    priority: 'Medium',
    status: 'Verified',
    reported_by: 4, // Prof Sharma
    assigned_to: 2, // Mike Johnson
    created_at: new Date(Date.now() - 1 * 86400000).toISOString()
  },
  {
    code: 'CF-2026-1005',
    title: 'Auditorium central ceiling fan regulator sparking',
    description: 'Switchboard fan regulator sparking when rotated between speeds 3 and 4.',
    category: 'Electrical',
    building_id: 4, // A Block
    floor_number: '1st Floor',
    room_number: 'Main Audi',
    item_name: 'Ceiling Fan Regulator',
    priority: 'Critical',
    status: 'In Progress',
    reported_by: 4,
    assigned_to: 2, // Mike Johnson
    created_at: new Date(Date.now() - 5 * 86400000).toISOString()
  },
  {
    code: 'CF-2026-1006',
    title: 'AC temperature sensor error code E4',
    description: 'Split air conditioner in PG Seminar Hall showing fault code E4 and blowing warm air.',
    category: 'Classroom Equipment',
    building_id: 5, // PG Block
    floor_number: '3rd Floor',
    room_number: 'PG Hall 301',
    item_name: 'Air Conditioner',
    priority: 'High',
    status: 'Assigned',
    reported_by: 4,
    assigned_to: 3,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString()
  },
  {
    code: 'CF-2026-1007',
    title: 'Wash basin drainage pipe blocked',
    description: 'Hand wash basin in main campus canteen overflowing due to drain blockage.',
    category: 'Washroom',
    building_id: 6, // Canteen
    floor_number: 'Ground Floor',
    room_number: 'Dining Area',
    item_name: 'Wash Basin',
    priority: 'High',
    status: 'Resolved',
    reported_by: 5,
    assigned_to: 3,
    created_at: new Date(Date.now() - 6 * 86400000).toISOString()
  },
  {
    code: 'CF-2026-1008',
    title: 'Synti Stage main spotlight dimmer tripped',
    description: 'Stage illumination spotlight dimmer rack tripped breaker during cultural rehearsal.',
    category: 'Electrical',
    building_id: 7, // Synti Stage
    floor_number: 'Open Stage',
    room_number: 'Control Panel',
    item_name: 'Stage Lighting Dimmer',
    priority: 'Critical',
    status: 'In Progress',
    reported_by: 5,
    assigned_to: 2, // Mike Johnson
    created_at: new Date(Date.now() - 1 * 86400000).toISOString()
  },
  {
    code: 'CF-2026-1009',
    title: 'Synti Stage audio XLR socket loose',
    description: 'Front stage left audio microphone XLR port disconnected from mixer snake.',
    category: 'Classroom Equipment',
    building_id: 7, // Synti Stage
    floor_number: 'Open Stage',
    room_number: 'Stage Left',
    item_name: 'Stage Audio System',
    priority: 'Medium',
    status: 'Reported',
    reported_by: 6,
    assigned_to: null,
    created_at: new Date(Date.now() - 8 * 3600000).toISOString()
  },
  {
    code: 'CF-2026-1010',
    title: 'Indoor badminton court floodlight ballast burnt out',
    description: 'High-bay LED floodlight #4 over court 2 not powering on.',
    category: 'Electrical',
    building_id: 8, // Sports Block
    floor_number: 'Ground Floor',
    room_number: 'Badminton Hall',
    item_name: 'High-Bay Floodlight',
    priority: 'High',
    status: 'Resolved',
    reported_by: 5,
    assigned_to: 2,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString()
  }
];

const insertStmt = db.prepare(`
  INSERT INTO faults (
    complaint_code, title, description, category, building_id, floor_number, room_number,
    item_name, priority, status, reported_by, assigned_to, created_at, updated_at
  ) VALUES (
    @code, @title, @description, @category, @building_id, @floor_number, @room_number,
    @item_name, @priority, @status, @reported_by, @assigned_to, @created_at, @created_at
  )
`);

const insertHistory = db.prepare(`
  INSERT INTO fault_history (fault_id, changed_by, old_status, new_status, notes, changed_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

for (const c of complaints) {
  const info = insertStmt.run(c);
  insertHistory.run(info.lastInsertRowid, c.reported_by, null, c.status, `Complaint created with status ${c.status}`, c.created_at);
}

console.log(`Seeded ${complaints.length} VNRVJIET complaints successfully!`);
const counts = db.prepare(`
  SELECT b.building_name, b.building_code, COUNT(f.fault_id) as count
  FROM buildings b
  LEFT JOIN faults f ON b.building_id = f.building_id
  GROUP BY b.building_id
`).all();
console.table(counts);

db.close();
