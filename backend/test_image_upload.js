/**
 * Automated Test Suite for Image Upload & Validation Feature
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const db = require('./database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'campus_fix_super_secret_jwt_key_2026_secure';

// Helper to make multipart request
function makeMultipartRequest(options, fields, fileInfo, token) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Authorization': `Bearer ${token}`
    };

    let postData = Buffer.alloc(0);

    // Append fields
    for (const [key, value] of Object.entries(fields)) {
      const fieldHeader = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
      );
      postData = Buffer.concat([postData, fieldHeader]);
    }

    // Append file if provided
    if (fileInfo) {
      const fileHeader = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${fileInfo.fieldname}"; filename="${fileInfo.filename}"\r\nContent-Type: ${fileInfo.mimetype}\r\n\r\n`
      );
      postData = Buffer.concat([postData, fileHeader, fileInfo.buffer, Buffer.from('\r\n')]);
    }

    // End boundary
    postData = Buffer.concat([postData, Buffer.from(`--${boundary}--\r\n`)]);

    headers['Content-Length'] = postData.length;

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: options.path,
      method: options.method || 'POST',
      headers: headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING CAMPUS FIX IMAGE UPLOAD TEST SUITE');
  console.log('========================================================\n');

  // Generate tokens
  const student = db.prepare("SELECT user_id, email, role FROM users WHERE role = 'student' LIMIT 1").get();
  const studentToken = jwt.sign({ user_id: student.user_id, email: student.email, role: 'student' }, JWT_SECRET);

  const building = db.prepare('SELECT building_id FROM buildings LIMIT 1').get();

  // Test assets
  // Valid JPEG header: FF D8 FF E0
  const validJpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48]);
  // Valid PNG header: 89 50 4E 47 0D 0A 1A 0A
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
  // Fake file disguised as image (e.g. bash script / executable)
  const fakeJpgBuffer = Buffer.from('#!/bin/bash\necho "Disguised malicious file"\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName, extraInfo = '') {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${extraInfo}`);
    }
  }

  try {
    // Test 1: Submit complaint with valid JPG image
    const res1 = await makeMultipartRequest(
      { path: '/api/faults' },
      {
        title: 'Broken Library Study Chair Gas Lift',
        item_name: 'Ergonomic Study Chair',
        description: 'Seat tilts backwards and hydraulic lift does not stay at height.',
        category: 'Furniture',
        priority: 'Medium',
        building_id: building.building_id,
        floor_number: '1st Floor',
        room_number: 'Quiet Reading Bay C'
      },
      {
        fieldname: 'image',
        filename: 'chair_photo.jpg',
        mimetype: 'image/jpeg',
        buffer: validJpgBuffer
      },
      studentToken
    );

    assert(res1.status === 201 && res1.body.success, 'Test 1: Submit complaint with valid JPG image');
    const fault1 = db.prepare('SELECT * FROM faults WHERE complaint_code = ?').get(res1.body.complaint_code);
    assert(fault1 && fault1.image_path && fault1.image_path.startsWith('/uploads/fault-'), 'Test 1b: Image reference saved in SQLite');

    // Test 2: Submit complaint with valid PNG image
    const res2 = await makeMultipartRequest(
      { path: '/api/faults' },
      {
        title: 'Restroom Sink Pipe Drip',
        item_name: 'Under-Sink Water Pipe',
        description: 'Continuous leaking from compression valve under the second basin.',
        category: 'Plumbing',
        priority: 'High',
        building_id: building.building_id,
        floor_number: '2nd Floor',
        room_number: 'Washroom 204'
      },
      {
        fieldname: 'image',
        filename: 'pipe_leak.png',
        mimetype: 'image/png',
        buffer: validPngBuffer
      },
      studentToken
    );

    assert(res2.status === 201 && res2.body.success, 'Test 2: Submit complaint with valid PNG image');

    // Test 3: Submit complaint without an image
    const res3 = await makeMultipartRequest(
      { path: '/api/faults' },
      {
        title: 'Flickering Classroom Tube Light',
        item_name: 'Fluorescent Tube Light',
        description: 'Corner light flickering causing eye strain during lectures.',
        category: 'Electrical',
        priority: 'Low',
        building_id: building.building_id,
        floor_number: '3rd Floor',
        room_number: 'Room 305'
      },
      null,
      studentToken
    );

    assert(res3.status === 201 && res3.body.success, 'Test 3: Submit complaint without an image');
    const fault3 = db.prepare('SELECT * FROM faults WHERE complaint_code = ?').get(res3.body.complaint_code);
    assert(fault3 && fault3.image_path === null, 'Test 3b: Complaint without image has NULL image_path');

    // Test 7: Attempt to upload file larger than 5MB
    const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024, 0); // 6MB
    const res7 = await makeMultipartRequest(
      { path: '/api/faults' },
      {
        title: 'Oversized Image Fault',
        item_name: 'Projector',
        description: 'Testing oversized image rejection',
        category: 'Classroom Equipment',
        priority: 'Low',
        building_id: building.building_id,
        floor_number: '1st Floor',
        room_number: 'Room 101'
      },
      {
        fieldname: 'image',
        filename: 'huge_file.jpg',
        mimetype: 'image/jpeg',
        buffer: oversizedBuffer
      },
      studentToken
    );

    assert(res7.status === 400 && res7.body.message.includes('exceeds the 5MB size limit'), 'Test 7: Reject file larger than 5MB');

    // Test 8: Attempt to upload unsupported file type (e.g. .exe or .pdf)
    const res8 = await makeMultipartRequest(
      { path: '/api/faults' },
      {
        title: 'Unsupported File Type Fault',
        item_name: 'PC',
        description: 'Testing unsupported mime',
        category: 'Network/IT',
        priority: 'Low',
        building_id: building.building_id,
        floor_number: '1st Floor',
        room_number: 'Room 101'
      },
      {
        fieldname: 'image',
        filename: 'document.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 test')
      },
      studentToken
    );

    assert(res8.status === 400 && res8.body.message.includes('Invalid image type'), 'Test 8: Reject unsupported file type');

    // Test 9: Attempt to upload disguised file (fake extension)
    const res9 = await makeMultipartRequest(
      { path: '/api/faults' },
      {
        title: 'Disguised Executable Fault',
        item_name: 'Server',
        description: 'Testing magic bytes security against disguised files',
        category: 'Network/IT',
        priority: 'High',
        building_id: building.building_id,
        floor_number: '1st Floor',
        room_number: 'Server Room'
      },
      {
        fieldname: 'image',
        filename: 'exploit.jpg',
        mimetype: 'image/jpeg',
        buffer: fakeJpgBuffer
      },
      studentToken
    );

    assert(res9.status === 400 && res9.body.message.includes('Security validation failed'), 'Test 9: Magic bytes detect and reject disguised non-image files');

    // Test 10: Verify database persistence and retrieval
    const dbFaults = db.prepare('SELECT fault_id, complaint_code, item_name, image_path FROM faults').all();
    assert(dbFaults.length >= 3, 'Test 10: Complaints and image references persisted in SQLite database');

    console.log('\n========================================================');
    console.log(`🏁 TEST RESULTS: ${passed}/${total} TESTS PASSED`);
    console.log('========================================================\n');
  } catch (err) {
    console.error('Test execution failed:', err);
  }
}

// If server is running on 3000, run suite
runTests();
