/**
 * Campus Fix - Automated Test & Verification Suite
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000/api';

async function request(url, options = {}) {
  const fullUrl = `${BASE_URL}${url}`;
  const headers = options.headers || {};
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(fullUrl, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, data };
}

let adminToken = '';
let staffToken = '';
let studentToken = '';
let testFaultId = null;

async function runTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING CAMPUS FIX FULL SYSTEM VERIFICATION SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const health = await request('/health');
    assert(health.status === 200 && health.data.status === 'online', 'Server health check responds online');

    // 2. Admin Login
    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@vnrvjiet.in', password: 'Admin@123' }
    });
    assert(adminLogin.status === 200 && adminLogin.data.token, 'Admin login succeeds with valid token');
    adminToken = adminLogin.data.token;

    // 3. Staff Login
    const staffLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'staff.mike@vnrvjiet.in', password: 'Staff@123' }
    });
    assert(staffLogin.status === 200 && staffLogin.data.user.role === 'staff', 'Staff login succeeds with staff role');
    staffToken = staffLogin.data.token;

    // 4. Invalid Password Handling
    const badLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@vnrvjiet.in', password: 'WrongPassword' }
    });
    assert(badLogin.status === 401, 'Invalid password correctly rejected with 401');

    // 5. User Registration & Admin Approval Workflow
    const uniqueEmail = `test.student.${Date.now()}@vnrvjiet.in`;
    const registerRes = await request('/auth/register', {
      method: 'POST',
      body: {
        full_name: 'Test Student',
        email: uniqueEmail,
        phone: '+91 99999 11111',
        password: 'Password@123',
        role: 'student'
      }
    });
    assert(registerRes.status === 201 && registerRes.data.pending_approval === true, 'Student account registration submitted with pending_approval: true');
    const newStudentId = registerRes.data.user.user_id;

    // Verify unapproved login attempt is blocked
    const unapprovedLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: uniqueEmail, password: 'Password@123' }
    });
    assert(unapprovedLogin.status === 403 && unapprovedLogin.data.code === 'PENDING_APPROVAL', 'Pre-approval login blocked with 403 PENDING_APPROVAL');

    // Admin approves student
    const approveRes = await request(`/auth/approve/${newStudentId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { notes: 'Verified VNRVJIET student credentials' }
    });
    assert(approveRes.status === 200 && approveRes.data.success, 'Admin approves student registration request');

    // Student logs in after admin approval
    const approvedLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: uniqueEmail, password: 'Password@123' }
    });
    assert(approvedLogin.status === 200 && approvedLogin.data.token, 'Student logs in successfully after approval');
    studentToken = approvedLogin.data.token;

    const dupRegister = await request('/auth/register', {
      method: 'POST',
      body: {
        full_name: 'Duplicate Student',
        email: uniqueEmail,
        password: 'Password@123',
        role: 'student'
      }
    });
    assert(dupRegister.status === 409, 'Duplicate email registration prevented with 409 Conflict');

    // 6. Role Protection Test: Student cannot access Admin endpoints
    const unauthStaffList = await request('/auth/staff', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(unauthStaffList.status === 403, 'Role-based protection restricts student from accessing admin endpoints (403)');

    // 7. Fault Submission by Student
    const faultRes = await request('/faults', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        title: 'Broken fluorescent tube flickering',
        description: 'Room 101 tube light is violently flickering making it impossible to read.',
        category: 'Electrical',
        building_id: 1,
        floor_number: '1st Floor',
        room_number: 'Room 101',
        priority: 'High'
      }
    });
    assert(faultRes.status === 201 && faultRes.data.complaint_code, `Fault submission succeeds with code ${faultRes.data?.complaint_code}`);
    testFaultId = faultRes.data.fault_id;

    // 8. Duplicate Detection Warning Check
    const dupCheck = await request(`/faults/check-duplicates?building_id=1&room_number=Room 101&category=Electrical`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(dupCheck.data.has_duplicates === true, 'Intelligent duplicate detection successfully flags open issue in same room & category');

    // 9. Admin Dashboard KPIs & Charts
    const adminDash = await request('/dashboard/admin', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminDash.status === 200 && adminDash.data.stats.total > 0 && adminDash.data.charts.categories.length > 0, 'Admin dashboard returns genuine database counts and Chart.js datasets');

    // 10. Admin Staff Assignment
    const assignRes = await request(`/faults/${testFaultId}/assign`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        staff_id: 2, // Mike Johnson
        notes: 'Assigned for immediate electrical inspection.'
      }
    });
    assert(assignRes.status === 200, 'Admin successfully assigns maintenance staff');

    // 11. Staff Dashboard & Task Work Order
    const staffDash = await request('/dashboard/staff', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const foundTask = staffDash.data.tasks.find(t => t.fault_id === testFaultId);
    assert(foundTask && foundTask.status === 'Assigned', 'Assigned task appears in staff dashboard work order queue');

    // 12. Staff Starts Work and Adds Repair Notes
    const startRes = await request(`/faults/${testFaultId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { status: 'In Progress', notes: 'Replaced ballast and starter.' }
    });
    assert(startRes.status === 200 && startRes.data.new_status === 'In Progress', 'Staff transitions task to In Progress');

    const notesRes = await request(`/faults/${testFaultId}/notes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        repair_notes: 'Replaced electronic choke and tube. Testing luminance.',
        resources_flagged: false
      }
    });
    assert(notesRes.status === 200, 'Staff records repair notes and maintenance history');

    // 13. Staff Completes Task
    const resolveRes = await request(`/faults/${testFaultId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { status: 'Resolved', notes: 'Work finished. Luminance tested normal.' }
    });
    assert(resolveRes.status === 200 && resolveRes.data.new_status === 'Resolved', 'Staff marks task as Resolved');

    // 14. Student Checks Detail & Timeline
    const detailRes = await request(`/faults/${testFaultId}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(detailRes.status === 200 && detailRes.data.history.length >= 4, 'Full complaint history and audit log properly recorded');

    // 15. Student Reopens Fault
    const reopenRes = await request(`/faults/${testFaultId}/reopen`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { reason: 'Tube stopped working after 30 minutes.' }
    });
    assert(reopenRes.status === 200 && reopenRes.data.status === 'Reopened', 'Student successfully reopens complaint with persistent issue reason');

    // 16. In-App Notifications
    const notifRes = await request('/notifications', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(notifRes.status === 200 && notifRes.data.notifications.length > 0, 'In-app notification system delivered status alerts to user');

    // 17. CSV Export
    const csvRes = await request(`/analytics/export?token=${adminToken}`);
    assert(csvRes.status === 200 && csvRes.data.includes('Complaint Code,Title,Category'), 'Admin CSV export generates valid downloadable spreadsheet data');

    // 18. IoT Sensor Telemetry & Auto Alert Ingestion
    const iotRes = await request('/iot/events', {
      method: 'POST',
      body: {
        device_id: 'IOT-WATER-99',
        location: 'Science Complex Restroom 3',
        event_type: 'water_leak',
        measured_value: 9.8,
        threshold_value: 4.0,
        alert_status: 'TRIGGERED',
        auto_create_fault: true
      }
    });
    assert(iotRes.status === 201 && iotRes.data.auto_fault_id !== null, 'IoT telemetry event ingested with automated fault ticket creation');

    console.log('\n========================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================');
  } catch (err) {
    console.error('Test execution error:', err);
  }
}

runTests();
