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

  // Test 2: Staff registration
  const staffEmail = `new.electrician.${Date.now()}@vnrvjiet.in`;
  const registerStaff = await request('/auth/register', {
    method: 'POST',
    body: {
      full_name: 'David Miller',
      email: staffEmail,
      phone: '+91 98888 77777',
      role: 'staff',
      department: 'Electrical & IT Maintenance',
      password: 'StaffPassword@123'
    }
  });
  const staffUserId = registerStaff.data.user?.user_id;
  console.log(registerStaff.status === 201 && registerStaff.data.pending_approval === true
    ? '✅ [PASS] 2. Staff self-registration successfully submitted with pending_approval: true'
    : '❌ [FAIL] 2. Staff registration failed', registerStaff);

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
  const foundInPending = pendingList.data.pending?.some(u => u.email === staffEmail);
  console.log(pendingList.status === 200 && foundInPending
    ? '✅ [PASS] 4. Admin successfully retrieves pending approval list containing new staff applicant'
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

  console.log('\n🏁 ALL APPROVAL WORKFLOW TESTS COMPLETED!');
}

runApprovalTests();
