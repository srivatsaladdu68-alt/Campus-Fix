const express = require('express');
const router = express.Router();
const db = require('../database');
const { notifyAdmins } = require('../services/notificationService');

// Ingest IoT sensor event telemetry (Extensible IoT architecture)
router.post('/events', (req, res) => {
  try {
    const { device_id, location, event_type, measured_value, threshold_value, alert_status, auto_create_fault } = req.body;

    if (!device_id || !location || !event_type || measured_value === undefined || threshold_value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Required IoT fields: device_id, location, event_type, measured_value, threshold_value'
      });
    }

    const status = alert_status || (measured_value > threshold_value ? 'TRIGGERED' : 'NORMAL');
    let generatedFaultId = null;

    // If critical alert and auto-creation requested, create a fault ticket automatically
    if (status === 'TRIGGERED' && auto_create_fault) {
      const code = `IOT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const title = `[Automated IoT Alert] ${event_type.replace('_', ' ').toUpperCase()} at ${location}`;
      const desc = `Autonomous sensor ${device_id} detected abnormal reading of ${measured_value} exceeding safety threshold of ${threshold_value}.`;
      
      const admin = db.prepare("SELECT user_id FROM users WHERE role = 'admin' LIMIT 1").get();
      const building = db.prepare("SELECT building_id FROM buildings LIMIT 1").get();

      if (admin && building) {
        const insertFault = db.prepare(`
          INSERT INTO faults (complaint_code, reported_by, title, description, category, building_id, floor_number, room_number, priority, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'Other', ?, 'Ground', 'Sensor Zone', 'Critical', 'Reported', datetime('now'), datetime('now'))
        `);
        const resF = insertFault.run(code, admin.user_id, title, desc, building.building_id);
        generatedFaultId = resF.lastInsertRowid;

        notifyAdmins(generatedFaultId, `CRITICAL IoT ALERT: Sensor ${device_id} triggered ticket [${code}].`);
      }
    }

    const insertEvent = db.prepare(`
      INSERT INTO iot_sensor_events (device_id, location, event_type, measured_value, threshold_value, alert_status, fault_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    const result = insertEvent.run(device_id, location, event_type, measured_value, threshold_value, status, generatedFaultId);

    return res.status(201).json({
      success: true,
      message: 'IoT sensor telemetry logged successfully.',
      event_id: result.lastInsertRowid,
      alert_status: status,
      auto_fault_id: generatedFaultId
    });
  } catch (err) {
    console.error('IoT event error:', err);
    return res.status(500).json({ success: false, message: 'Server error processing IoT telemetry.' });
  }
});

// List recent IoT events
router.get('/events', (req, res) => {
  try {
    const events = db.prepare(`
      SELECT * FROM iot_sensor_events
      ORDER BY created_at DESC
      LIMIT 20
    `).all();

    return res.json({ success: true, count: events.length, events });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error retrieving IoT events.' });
  }
});

module.exports = router;
