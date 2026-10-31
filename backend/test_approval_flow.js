const http = require('http');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const postData = options.body ? JSON.stringify(options.body) : null;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: `/api${path}`,
      method: options.method || 'GET',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runApprovalTests() {
  console.log('🧪 RUNNING ACCOUNT REGISTRATION & ADMIN APPROVAL TEST SUITE\n');

  // Test 1: Random non-existent email on login
  const randomLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'nonexistent.user.12345@vnrvjiet.in', password: 'SomePassword@123' }
  });
  console.log(randomLogin.status === 401 && randomLogin.data.code === 'USER_NOT_FOUND' 
    ? '✅ [PASS] 1. Unrecognized email correctly returns USER_NOT_FOUND code & registration prompt'
    : '❌ [FAIL] 1. Random email login failed', randomLogin);

  // Test 1b: Disallowed non-vnrvjiet email on login
  const foreignLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'intruder@gmail.com', password: 'SomePassword@123' }
  });
  console.log(foreignLogin.status === 400 && foreignLogin.data.code === 'INVALID_DOMAIN'
    ? '✅ [PASS] 1b. Non-vnrvjiet email rejected on login with INVALID_DOMAIN'
    : '❌ [FAIL] 1b. Non-vnrvjiet email allowed on login', foreignLogin);

  // Test 1c: Disallowed non-vnrvjiet email on registration
  const foreignRegister = await request('/auth/register', {
    method: 'POST',
    body: {
      full_name: 'Outsider User',
      email: 'outsider@gmail.com',
      password: 'Password@123',
      role: 'student',
      roll_number: '25071A9999'
    }
  });
  console.log(foreignRegister.status === 400 && foreignRegister.data.message.includes('@vnrvjiet.in')
    ? '✅ [PASS] 1c. Non-vnrvjiet email rejected on registration'
    : '❌ [FAIL] 1c. Non-vnrvjiet email allowed on registration', foreignRegister);

  // Test 2: Staff registration
  // Test 2: Staff registration with staff_id
  const staffEmail = `new.electrician.${Date.now()}@vnrvjiet.in`;
  const staffIdCode = `STF-ELEC-${Date.now().toString().slice(-4)}`;
  const registerStaff = await request('/auth/register', {
    method: 'POST',
    body: {
      full_name: 'David Miller',
      email: staffEmail,
      phone: '+91 98888 77777',
      role: 'staff',
      staff_id: staffIdCode,
      department: 'Electrical & IT Maintenance',
      password: 'StaffPassword@123'
    }
  });
  const staffUserId = registerStaff.data.user?.user_id;
  console.log(registerStaff.status === 201 && registerStaff.data.pending_approval === true && registerStaff.data.user?.staff_id === staffIdCode
    ? '✅ [PASS] 2. Staff self-registration successfully submitted with staff_id & pending_approval: true'
    : '❌ [FAIL] 2. Staff registration failed', registerStaff);

  // Test 2b: Staff registration without staff_id is rejected (400)
  const noStaffIdRes = await request('/auth/register', {
    method: 'POST',
    body: {
      full_name: 'Invalid Staff',
      email: `no.id.${Date.now()}@vnrvjiet.in`,
      role: 'staff',
      password: 'StaffPassword@123'
    }
  });
  console.log(noStaffIdRes.status === 400
    ? '✅ [PASS] 2b. Staff registration without staff_id rejected with 400'
    : '❌ [FAIL] 2b. Staff without staff_id check failed', noStaffIdRes);

  // Test 3: Attempt to log in before admin approval
  const preApprovalLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: staffEmail, password: 'StaffPassword@123' }
  });
  console.log(preApprovalLogin.status === 403 && preApprovalLogin.data.code === 'PENDING_APPROVAL'
    ? '✅ [PASS] 3. Login before admin approval correctly blocked with 403 PENDING_APPROVAL'
    : '❌ [FAIL] 3. Pre-approval login check failed', preApprovalLogin);

  // Test 4: Admin login & check pending approvals
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@vnrvjiet.in', password: 'Admin@123' }
  });
  const adminToken = adminLogin.data.token;

  const pendingList = await request('/auth/pending-approvals', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const foundInPending = pendingList.data.pending?.some(u => u.email === staffEmail && u.staff_id === staffIdCode);
  console.log(pendingList.status === 200 && foundInPending
    ? '✅ [PASS] 4. Admin successfully retrieves pending approval list containing staff with staff_id'
    : '❌ [FAIL] 4. Admin pending approvals retrieval failed', pendingList);

  // Test 5: Admin approves staff applicant
  const approveRes = await request(`/auth/approve/${staffUserId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { notes: 'Verified credentials and satisfied with trade experience' }
  });
  console.log(approveRes.status === 200 && approveRes.data.success
    ? '✅ [PASS] 5. Admin successfully approves and activates staff account'
    : '❌ [FAIL] 5. Admin approval failed', approveRes);

  // Test 6: Staff logs in successfully after approval
  const postApprovalLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: staffEmail, password: 'StaffPassword@123' }
  });
  console.log(postApprovalLogin.status === 200 && postApprovalLogin.data.token && postApprovalLogin.data.user.role === 'staff'
    ? '✅ [PASS] 6. Staff successfully logs in after admin approval with full technician access'
    : '❌ [FAIL] 6. Post-approval login failed', postApprovalLogin);

  // Test 7: Student registration with roll_number & pending approval
  const fakeStudentEmail = `fake.applicant.${Date.now()}@vnrvjiet.in`;
  const fakeStudentRoll = `22071A${Date.now().toString().slice(-4)}`;
  const registerFakeStudent = await request('/auth/register', {
    method: 'POST',
    body: {
      full_name: 'Suspicious Applicant',
      email: fakeStudentEmail,
      roll_number: fakeStudentRoll,
      phone: '+91 12345 67890',
      role: 'student',
      password: 'FakePassword@123'
    }
  });
  const fakeStudentId = registerFakeStudent.data.user?.user_id;
  console.log(registerFakeStudent.status === 201 && registerFakeStudent.data.pending_approval === true && registerFakeStudent.data.user?.roll_number === fakeStudentRoll
    ? '✅ [PASS] 7. Student registration correctly submitted with roll_number & pending_approval: true'
    : '❌ [FAIL] 7. Student registration failed', registerFakeStudent);

  // Test 7b: Student registration without roll_number is rejected (400)
  const noRollStudentRes = await request('/auth/register', {
    method: 'POST',
    body: {
      full_name: 'Invalid Student',
      email: `no.roll.${Date.now()}@vnrvjiet.in`,
      role: 'student',
      password: 'StudentPassword@123'
    }
  });
  console.log(noRollStudentRes.status === 400
    ? '✅ [PASS] 7b. Student registration without roll_number rejected with 400'
    : '❌ [FAIL] 7b. Student without roll_number check failed', noRollStudentRes);

  // Test 8: Verify admin received in-app notification about registration request
  const notifRes = await request('/notifications', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const hasRegNotif = notifRes.data.notifications?.some(n => n.message.includes('registration request') && n.message.includes('Suspicious Applicant'));
  console.log(notifRes.status === 200 && hasRegNotif
    ? '✅ [PASS] 8. Admin automatically receives in-app notification when a new user registers'
    : '❌ [FAIL] 8. Admin notification for registration check failed', notifRes);

  // Test 9: Admin rejects fake applicant
  const rejectRes = await request(`/auth/reject/${fakeStudentId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { notes: 'Unverified student ID - not found in official college roll' }
  });
  console.log(rejectRes.status === 200 && rejectRes.data.success
    ? '✅ [PASS] 9. Admin successfully rejects unverified/fake applicant'
    : '❌ [FAIL] 9. Admin rejection failed', rejectRes);

  // Test 10: Rejected applicant attempts to log in
  const rejectedLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: fakeStudentEmail, password: 'FakePassword@123' }
  });
  console.log(rejectedLogin.status === 403 && rejectedLogin.data.code === 'ACCOUNT_REJECTED'
    ? '✅ [PASS] 10. Rejected account login correctly blocked with 403 ACCOUNT_REJECTED'
    : '❌ [FAIL] 10. Rejected login check failed', rejectedLogin);

  // Test 11: Faculty registration with faculty_id & academic department
  const facultyEmail = `prof.test.${Date.now()}@vnrvjiet.in`;
  const facultyIdCode = `FAC-CSE-${Date.now().toString().slice(-4)}`;
  const registerFaculty = await request('/auth/register', {
    method: 'POST',
    body: {
      full_name: 'Dr. Ramesh Kumar',
      email: facultyEmail,
      role: 'faculty',
      faculty_id: facultyIdCode,
      department: 'Computer Science & Engineering',
      phone: '+91 94444 33333',
      password: 'FacultyPassword@123'
    }
  });
  const facultyUserId = registerFaculty.data.user?.user_id;
  console.log(registerFaculty.status === 201 && registerFaculty.data.pending_approval === true && registerFaculty.data.user?.staff_id === facultyIdCode
    ? '✅ [PASS] 11. Faculty registration successfully submitted with faculty_id & academic department'
    : '❌ [FAIL] 11. Faculty registration failed', registerFaculty);

  // Admin approves faculty
  const approveFaculty = await request(`/auth/approve/${facultyUserId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { notes: 'Verified faculty CSE credentials' }
  });
  console.log(approveFaculty.status === 200 && approveFaculty.data.success
    ? '✅ [PASS] 11b. Admin successfully approves faculty account'
    : '❌ [FAIL] 11b. Faculty approval failed', approveFaculty);

  // Faculty logs in after approval
  const facultyLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: facultyEmail, password: 'FacultyPassword@123' }
  });
  console.log(facultyLogin.status === 200 && facultyLogin.data.token && facultyLogin.data.user.role === 'faculty'
    ? '✅ [PASS] 11c. Faculty successfully logs in with valid faculty credentials'
    : '❌ [FAIL] 11c. Faculty login failed', facultyLogin);

  console.log('\n🏁 ALL APPROVAL, FACULTY, STAFF & STUDENT WORKFLOW TESTS COMPLETED!');
}

runApprovalTests();
