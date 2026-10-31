const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'campus_fix.db');
const db = new Database(dbPath);

console.log('Updating database for VNR Vignana Jyothi Institute of Engineering and Technology (VNRVJIET)...');

db.pragma('foreign_keys = OFF');

// 1. Clear old generic buildings
db.exec('DELETE FROM buildings;');
db.exec("DELETE FROM sqlite_sequence WHERE name = 'buildings';");

// 2. Insert official VNRVJIET Campus Blocks
const insertBuilding = db.prepare('INSERT INTO buildings (building_name, building_code) VALUES (?, ?)');

const vnrvjietBuildings = [
  ['E Block', 'E-BLOCK'],
  ['D Block', 'D-BLOCK'],
  ['C Block', 'C-BLOCK'],
  ['B Block', 'B-BLOCK'],
  ['A Block', 'A-BLOCK'],
  ['PG Block', 'PG-BLOCK'],
  ['Canteen', 'CANTEEN'],
  ['Synti Stage', 'SYNTI-STAGE'],
  ['Sports Block', 'SPORTS']
];

for (const b of vnrvjietBuildings) {
  insertBuilding.run(b[0], b[1]);
}

// 3. Update default user emails to @vnrvjiet.in
db.exec(`
  UPDATE users SET email = 'admin@vnrvjiet.in' WHERE email LIKE 'admin@%';
  UPDATE users SET email = 'staff.mike@vnrvjiet.in' WHERE email LIKE 'staff.mike@%';
  UPDATE users SET email = 'staff.sarah@vnrvjiet.in' WHERE email LIKE 'staff.sarah@%';
  UPDATE users SET email = 'prof.sharma@vnrvjiet.in' WHERE email LIKE 'prof.sharma@%';
  UPDATE users SET email = 'student.alex@vnrvjiet.in' WHERE email LIKE 'student.alex@%';
  UPDATE users SET email = 'student.priya@vnrvjiet.in' WHERE email LIKE 'student.priya@%';
`);

db.pragma('foreign_keys = ON');

const buildings = db.prepare('SELECT building_id, building_name, building_code FROM buildings').all();
console.log('VNRVJIET Campus Buildings successfully loaded:');
console.table(buildings);

db.close();
