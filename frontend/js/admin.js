/**
 * Campus Fix - Administrator Dashboard & Analytics Logic
 */

let allComplaints = [];
let staffMembers = [];
let selectedFaultForAction = null;

let trendChartInstance = null;
let categoryChartInstance = null;
let buildingChartInstance = null;
let staffChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = Auth.requireAuth(['admin']);
  if (!user) return;

  Auth.renderUserProfile();
  lucide.createIcons();

  await loadAdminOverview();
  await loadStaffList();
  await loadPendingApprovals();
  setupComplaintsTableFilters();

  // Route to the requested tab based on URL hash (e.g. #reports, #staff-mgmt, #complaints)
  const initialHash = (window.location.hash || '').replace('#', '');
  const validTabs = ['overview', 'complaints', 'reports', 'staff-mgmt'];
  if (initialHash && validTabs.includes(initialHash)) {
    switchTab(initialHash);
  } else {
    switchTab('overview');
  }

  // Handle in-page hash changes
  window.addEventListener('hashchange', () => {
    const newHash = (window.location.hash || '').replace('#', '');
    if (newHash && validTabs.includes(newHash)) {
      switchTab(newHash);
    }
  });
});

// Tab Switching
function switchTab(tabId) {
  const tabs = ['overview', 'complaints', 'reports', 'staff-mgmt'];
  if (!tabs.includes(tabId)) tabId = 'overview';

  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = t === tabId ? 'block' : 'none';
  });

  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.remove('active');
  });

  const activeLink = document.querySelector(`.sidebar-link[href="#${tabId}"]`) || 
                     document.querySelector(`.sidebar-link[href="admin-dashboard.html#${tabId}"]`);
  if (activeLink) activeLink.classList.add('active');

  if (tabId === 'complaints') {
    loadAllComplaints();
  } else if (tabId === 'staff-mgmt') {
    renderStaffDirectory();
    loadPendingApprovals();
  }
}

// 1. Load Overview Data & Chart.js Charts
async function loadAdminOverview() {
  const res = await API.call('/dashboard/admin');
  if (!res || !res.success) {
    API.showToast('Failed to load administrative analytics.', 'error');
    return;
  }

  // Set KPIs
  document.getElementById('admin-total-faults').textContent = res.stats.total;
  document.getElementById('admin-open-complaints').textContent = res.stats.open;
  document.getElementById('admin-critical-faults').textContent = res.stats.critical;
  document.getElementById('admin-in-progress').textContent = res.stats.in_progress;
  document.getElementById('admin-resolved').textContent = res.stats.resolved;
  document.getElementById('admin-overdue').textContent = res.stats.overdue;
  document.getElementById('admin-avg-time').textContent = `${res.stats.avg_resolution_hours} hrs`;

  const staffCount = (res.charts && res.charts.staff) ? res.charts.staff.length : 0;
  const staffEl = document.getElementById('admin-active-staff');
  if (staffEl) staffEl.textContent = staffCount;

  // Recurring Faults Alert
  const recurringBox = document.getElementById('recurring-alert-box');
  const recurringList = document.getElementById('recurring-list');
  if (res.recurring && res.recurring.length > 0) {
    recurringList.innerHTML = res.recurring.map(r => `
      <div style="margin-top: 4px;">
        • <strong>${escapeHtml(r.building_name)} (${escapeHtml(r.room_number)})</strong> has <strong>${r.recurrence_count} reported faults</strong> under Category: <em>${escapeHtml(r.category)}</em>. Facility inspection recommended.
      </div>
    `).join('');
    recurringBox.style.display = 'block';
  } else {
    recurringBox.style.display = 'none';
  }

  // Render Charts
  renderCharts(res.charts);
}

// Render Chart.js
function renderCharts(chartData) {
  if (!chartData) return;
  const trendEl = document.getElementById('trendChart');
  if (!trendEl) return;

  Chart.defaults.color = '#b0a99c';
  Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";

  // Chart 1: Trends
  const trendCtx = document.getElementById('trendChart').getContext('2d');
  if (trendChartInstance) trendChartInstance.destroy();

  const trendLabels = chartData.trends.map(t => t.date);
  const reportedData = chartData.trends.map(t => t.total_reported);
  const resolvedData = chartData.trends.map(t => t.total_resolved);

  trendChartInstance = new Chart(trendCtx, {
    type: 'line',
    data: {
      labels: trendLabels.length > 0 ? trendLabels : ['Today'],
      datasets: [
        {
          label: 'Faults Reported',
          data: reportedData.length > 0 ? reportedData : [0],
          borderColor: '#7c7eff',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          tension: 0.3,
          fill: true
        },
        {
          label: 'Faults Resolved',
          data: resolvedData.length > 0 ? resolvedData : [0],
          borderColor: '#fbd784',
          backgroundColor: 'rgba(251, 215, 132, 0.15)',
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { color: '#f4efe6' } } },
      scales: {
        y: { grid: { color: 'rgba(244, 239, 230, 0.08)' }, ticks: { color: '#b0a99c' } },
        x: { grid: { color: 'rgba(244, 239, 230, 0.04)' }, ticks: { color: '#b0a99c' } }
      }
    }
  });

  // Chart 2: Categories Doughnut
  const catCtx = document.getElementById('categoryChart').getContext('2d');
  if (categoryChartInstance) categoryChartInstance.destroy();

  const catLabels = chartData.categories.map(c => c.category);
  const catCounts = chartData.categories.map(c => c.count);

  categoryChartInstance = new Chart(catCtx, {
    type: 'doughnut',
    data: {
      labels: catLabels.length > 0 ? catLabels : ['General'],
      datasets: [{
        data: catCounts.length > 0 ? catCounts : [0],
        backgroundColor: [
          '#6366f1', '#fbd784', '#34d399', '#38bdf8', '#fb923c', '#a5b4fc', '#e879f9', '#94a3b8'
        ],
        borderColor: '#12132b',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, color: '#f4efe6' } } }
    }
  });

  // Chart 3: Buildings Bar
  const buildCtx = document.getElementById('buildingChart').getContext('2d');
  if (buildingChartInstance) buildingChartInstance.destroy();

  const buildLabels = chartData.buildings.map(b => b.building_code || b.building_name.split(' ')[0]);
  const buildCounts = chartData.buildings.map(b => b.count);

  buildingChartInstance = new Chart(buildCtx, {
    type: 'bar',
    data: {
      labels: buildLabels,
      datasets: [{
        label: 'Reported Faults',
        data: buildCounts,
        backgroundColor: 'rgba(99, 102, 241, 0.75)',
        borderColor: '#7c7eff',
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(244, 239, 230, 0.08)' }, ticks: { precision: 0, color: '#b0a99c' } },
        x: { grid: { display: false }, ticks: { color: '#f4efe6' } }
      }
    }
  });

  // Chart 4: Staff Workload
  const staffCtx = document.getElementById('staffChart').getContext('2d');
  if (staffChartInstance) staffChartInstance.destroy();

  const staffNames = chartData.staff.map(s => s.full_name.split(' ')[0]);
  const assignedCounts = chartData.staff.map(s => s.total_assigned);
  const completedCounts = chartData.staff.map(s => s.completed_tasks);

  staffChartInstance = new Chart(staffCtx, {
    type: 'bar',
    data: {
      labels: staffNames.length > 0 ? staffNames : ['No Staff'],
      datasets: [
        {
          label: 'Total Assigned',
          data: assignedCounts.length > 0 ? assignedCounts : [0],
          backgroundColor: 'rgba(99, 102, 241, 0.8)',
          borderColor: '#7c7eff',
          borderWidth: 1,
          borderRadius: 6
        },
        {
          label: 'Completed Tasks',
          data: completedCounts.length > 0 ? completedCounts : [0],
          backgroundColor: 'rgba(251, 215, 132, 0.8)',
          borderColor: '#fbd784',
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { color: '#f4efe6' } } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(244, 239, 230, 0.08)' }, ticks: { precision: 0, color: '#b0a99c' } },
        x: { grid: { display: false }, ticks: { color: '#f4efe6' } }
      }
    }
  });
}

// 2. Complaints Table & Filtering
function setupComplaintsTableFilters() {
  const search = document.getElementById('admin-search-input');
  const status = document.getElementById('admin-filter-status');
  const category = document.getElementById('admin-filter-category');
  const priority = document.getElementById('admin-filter-priority');
  const resetBtn = document.getElementById('admin-reset-btn');

  let debounceTimer;
  search.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadAllComplaints, 300);
  });

  status.addEventListener('change', loadAllComplaints);
  category.addEventListener('change', loadAllComplaints);
  priority.addEventListener('change', loadAllComplaints);

  resetBtn.addEventListener('click', () => {
    search.value = '';
    status.value = '';
    category.value = '';
    priority.value = '';
    loadAllComplaints();
  });
}

async function loadAllComplaints() {
  const search = document.getElementById('admin-search-input').value.trim();
  const status = document.getElementById('admin-filter-status').value;
  const category = document.getElementById('admin-filter-category').value;
  const priority = document.getElementById('admin-filter-priority').value;

  const params = new URLSearchParams();
  params.append('all', 'true');
  if (search) params.append('search', search);
  if (status) params.append('status', status);
  if (category) params.append('category', category);
  if (priority) params.append('priority', priority);

  const res = await API.call(`/faults?${params.toString()}`);
  const tbody = document.getElementById('admin-complaints-tbody');
  const countEl = document.getElementById('admin-complaints-count');

  if (!res || !res.success) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: red;">Failed to load complaints.</td></tr>';
    return;
  }

  allComplaints = res.faults || [];
  countEl.textContent = `${allComplaints.length} complaints`;

  // Render Unassigned Quick-Dispatch box on Overview Tab
  const unassignedBox = document.getElementById('unassigned-dispatch-box');
  const unassignedList = document.getElementById('unassigned-quick-list');
  if (unassignedBox && unassignedList) {
    const unassigned = allComplaints.filter(f => !f.assigned_to && !['Resolved', 'Closed', 'Rejected'].includes(f.status));
    if (unassigned.length > 0) {
      unassignedBox.style.display = 'block';
      unassignedList.innerHTML = unassigned.slice(0, 5).map(f => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); padding: 0.85rem 1.15rem; border-radius: var(--radius-sm); border: 1px solid var(--border-cream); flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span class="complaint-code-tag">${escapeHtml(f.complaint_code)}</span>
            <div>
              <div style="font-weight: 700; color: var(--cream-pure); font-size: 0.95rem;">${escapeHtml(f.title)}</div>
              <div style="font-size: 0.8rem; color: var(--cream-muted); margin-top: 2px;">
                🔧 ${escapeHtml(f.item_name || f.category)} &bull; ${escapeHtml(f.building_name)} (${escapeHtml(f.room_number)}) &bull; ${API.getPriorityBadge(f.priority)}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <a href="track-complaints.html?code=${encodeURIComponent(f.complaint_code)}" class="btn btn-outline btn-sm" title="View Full Details" style="display: inline-flex; align-items: center; gap: 0.35rem;">
              <i data-lucide="eye" style="width: 14px; height: 14px;"></i> View
            </a>
          </div>
        </div>
      `).join('');
    } else {
      unassignedBox.style.display = 'none';
    }
  }

  if (allComplaints.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">No complaints match the filter.</td></tr>';
    return;
  }

  tbody.innerHTML = allComplaints.map(f => `
    <tr style="${f.is_overdue ? 'background-color: #fff1f2;' : ''}">
      <td>
        <span class="complaint-code-tag">${escapeHtml(f.complaint_code)}</span>
        ${f.is_overdue ? '<br><span class="badge badge-overdue" style="margin-top: 4px;">Overdue</span>' : ''}
      </td>
      <td>
        ${f.image_path 
          ? `<img src="${f.image_path}" 
                  alt="${escapeHtml(f.item_name || 'Equipment')}" 
                  class="equipment-thumbnail" 
                  onclick="window.location.href='track-complaints.html?code=${encodeURIComponent(f.complaint_code)}'" 
                  title="Click to view details"
                  onerror="this.onerror=null;this.src='/images/projector_fault.svg';">`
          : `<span class="badge" style="background: rgba(148, 163, 184, 0.1); color: var(--cream-dim); border: 1px dashed var(--border-cream); font-size: 0.72rem;">No image attached</span>`
        }
      </td>
      <td style="max-width: 220px;">
        <span class="badge badge-verified" style="font-size: 0.72rem; margin-bottom: 2px; display: inline-block;">
          🔧 ${escapeHtml(f.item_name || 'Equipment')}
        </span>
        <div style="font-weight: 700; color: var(--cream-pure);">${escapeHtml(f.title)}</div>
        <div style="font-size: 0.78rem; color: var(--cream-muted);">${API.formatDate(f.created_at)}</div>
      </td>
      <td>
        <div style="font-weight: 600; color: var(--cream-pure);">${escapeHtml(f.building_name || 'Campus')}</div>
        <div style="font-size: 0.78rem; color: var(--cream-muted);">${escapeHtml(f.room_number)}</div>
      </td>
      <td>${escapeHtml(f.category)}</td>
      <td>${API.getPriorityBadge(f.priority)}</td>
      <td>
        <div style="font-size: 0.88rem; font-weight: 600; color: var(--cream-pure);">${escapeHtml(f.reporter_name || 'User')}</div>
        <div style="font-size: 0.75rem; color: var(--cream-dim);">
          ${f.reporter_student_id ? `<span style="font-weight:700;color:var(--electric-indigo-bright);">${escapeHtml(f.reporter_student_id)}</span> &bull; ` : ''}${escapeHtml(f.reporter_department || f.reporter_email || '')}
        </div>
      </td>
      <td>
        ${f.staff_name ? `
          <div>
            <div style="font-weight: 600; color: var(--cream-gold); font-size: 0.86rem;">${escapeHtml(f.staff_name)}</div>
            ${f.staff_code ? `<div style="font-size: 0.72rem; color: var(--cream-muted); font-family: monospace;">${escapeHtml(f.staff_code)}</div>` : ''}
          </div>
        ` : '<span style="color:var(--cream-dim);font-size:0.82rem;">Unassigned</span>'}
      </td>
      <td>${API.getStatusBadge(f.status)}</td>
      <td>
        <a href="track-complaints.html?code=${encodeURIComponent(f.complaint_code)}" class="btn btn-outline btn-sm" title="View Full Details" style="display: inline-flex; align-items: center; gap: 0.35rem;">
          <i data-lucide="eye" style="width: 14px; height: 14px;"></i> View
        </a>
      </td>
    </tr>
  `).join('');

  lucide.createIcons();
}

// 3. Staff Management & Assignment
async function loadStaffList() {
  const res = await API.call('/auth/staff');
  if (res && res.success) {
    staffMembers = res.staff || [];
    const select = document.getElementById('assign-staff-select');
    select.innerHTML = '<option value="">Select Technician...</option>' + 
      staffMembers.map(s => `<option value="${s.user_id}">${escapeHtml(s.full_name)} (${s.phone || s.email})</option>`).join('');
  }
}

function openAssignModal(faultId) {
  const fault = allComplaints.find(f => f.fault_id === faultId);
  if (!fault) return;

  selectedFaultForAction = fault;
  const titleEl = document.getElementById('assign-modal-title');
  if (titleEl) {
    titleEl.textContent = `Assign Maintenance Staff: ${fault.item_name || fault.title}`;
  }
  document.getElementById('assign-modal-code').textContent = fault.complaint_code;
  document.getElementById('assign-priority-select').value = fault.priority || 'Medium';

  if (fault.deadline) {
    try {
      const d = new Date(fault.deadline);
      const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      document.getElementById('assign-deadline').value = localIso;
    } catch(e) {}
  } else {
    document.getElementById('assign-deadline').value = '';
  }

  if (fault.assigned_to) {
    document.getElementById('assign-staff-select').value = fault.assigned_to;
  } else {
    document.getElementById('assign-staff-select').value = '';
  }
  document.getElementById('assign-notes').value = '';

  const confirmBtn = document.getElementById('confirm-assign-btn');
  if (confirmBtn) {
    confirmBtn.textContent = 'Confirm Assignment';
  }

  document.getElementById('assign-modal').classList.add('open');
}

function closeAssignModal() {
  document.getElementById('assign-modal').classList.remove('open');
}

const adminConfirmAssignBtn = document.getElementById('confirm-assign-btn');
if (adminConfirmAssignBtn) {
  adminConfirmAssignBtn.addEventListener('click', async () => {
    if (!selectedFaultForAction) return;

    const staffId = document.getElementById('assign-staff-select').value;
    const priority = document.getElementById('assign-priority-select').value;
    const deadline = document.getElementById('assign-deadline').value;
    const notes = document.getElementById('assign-notes').value.trim();

    if (!staffId) {
      API.showToast('Please select a maintenance staff member.', 'error');
      return;
    }

    adminConfirmAssignBtn.disabled = true;
    adminConfirmAssignBtn.textContent = 'Assigning...';

    try {
      // 1. Assign Staff
      const resAssign = await API.call(`/faults/${selectedFaultForAction.fault_id}/assign`, 'PATCH', {
        staff_id: parseInt(staffId),
        deadline: deadline ? deadline.replace('T', ' ') + ':00' : undefined,
        notes: notes || undefined
      });

      // 2. Update priority if modified
      if (priority !== selectedFaultForAction.priority) {
        await API.call(`/faults/${selectedFaultForAction.fault_id}/priority`, 'PATCH', { priority });
      }

      if (resAssign && resAssign.success) {
        closeAssignModal();
        API.showToast(resAssign.message || 'Staff assigned successfully!', 'success');
        await loadAdminOverview();
        await loadAllComplaints();
      } else {
        API.showToast(resAssign ? resAssign.message : 'Failed to assign staff.', 'error');
      }
    } catch (err) {
      console.error('Admin assignment error:', err);
      API.showToast('Error assigning staff: ' + err.message, 'error');
    } finally {
      adminConfirmAssignBtn.disabled = false;
      adminConfirmAssignBtn.textContent = 'Confirm Assignment';
    }
  });
}

// 4. Status Update Modal
function openStatusModal(faultId) {
  const fault = allComplaints.find(f => f.fault_id === faultId);
  if (!fault) return;

  selectedFaultForAction = fault;
  document.getElementById('change-status-select').value = fault.status;
  document.getElementById('change-status-notes').value = '';
  document.getElementById('status-modal').classList.add('open');
}

function closeStatusModal() {
  document.getElementById('status-modal').classList.remove('open');
}

document.getElementById('confirm-status-btn').addEventListener('click', async () => {
  if (!selectedFaultForAction) return;

  const status = document.getElementById('change-status-select').value;
  const notes = document.getElementById('change-status-notes').value.trim();

  const res = await API.call(`/faults/${selectedFaultForAction.fault_id}/status`, 'PATCH', {
    status,
    notes: notes || undefined
  });

  if (res && res.success) {
    API.showToast(`Status updated to ${status}.`, 'success');
    closeStatusModal();
    await loadAdminOverview();
    await loadAllComplaints();
  } else {
    API.showToast(res.message || 'Failed to update status.', 'error');
  }
});

// 5. Staff Directory Tab
function renderStaffDirectory() {
  const tbody = document.getElementById('staff-directory-tbody');
  if (staffMembers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No staff registered yet.</td></tr>';
    return;
  }

  tbody.innerHTML = staffMembers.map(s => `
    <tr>
      <td style="font-weight: 700; color: var(--cream-pure);">${escapeHtml(s.full_name)}</td>
      <td>
        <span style="font-family: monospace; font-weight: 700; color: var(--cream-gold); background: rgba(251, 215, 132, 0.1); padding: 2px 7px; border-radius: 4px; border: 1px solid rgba(251, 215, 132, 0.2);">
          ${escapeHtml(s.staff_id || 'STF-GEN')}
        </span>
      </td>
      <td>${escapeHtml(s.email)}</td>
      <td>${escapeHtml(s.phone || 'N/A')}</td>
      <td><span style="color: var(--cream-soft); font-size: 0.84rem;">${escapeHtml(s.department || 'General Facilities')}</span></td>
    </tr>
  `).join('');
}

// 6. Pending Account Approvals (Staff & Students)
let pendingApprovals = [];

async function loadPendingApprovals() {
  const res = await API.call('/auth/pending-approvals');
  const tbody = document.getElementById('pending-approvals-tbody');
  const countBadge = document.getElementById('pending-approvals-count');
  const sidebarBadge = document.getElementById('sidebar-pending-badge');

  if (!res || !res.success) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: red; padding: 2rem;">Failed to load pending requests.</td></tr>';
    return;
  }

  pendingApprovals = res.pending || [];
  const count = pendingApprovals.length;

  if (countBadge) countBadge.textContent = `${count} Pending`;
  if (sidebarBadge) {
    if (count > 0) {
      sidebarBadge.textContent = count;
      sidebarBadge.style.display = 'inline-block';
    } else {
      sidebarBadge.style.display = 'none';
    }
  }

  if (!tbody) return;

  if (pendingApprovals.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: var(--cream-dim); padding: 2.5rem;">
          <div style="font-size: 1rem; font-weight: 600; color: var(--cream-soft); margin-bottom: 0.25rem;">No pending registration requests!</div>
          <p style="font-size: 0.82rem; color: var(--cream-muted);">All campus accounts and staff technicians have been verified.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pendingApprovals.map(u => {
    let roleBadgeColor = 'var(--electric-indigo-bright)';
    let roleBadgeBg = 'rgba(99, 102, 241, 0.2)';
    if (u.role === 'faculty') {
      roleBadgeColor = '#34d399';
      roleBadgeBg = 'rgba(52, 211, 153, 0.2)';
    } else if (u.role === 'staff') {
      roleBadgeColor = 'var(--cream-gold)';
      roleBadgeBg = 'rgba(251, 215, 132, 0.2)';
    }

    const idVal = u.roll_number || u.staff_id || '—';

    return `
      <tr>
        <td style="font-weight: 700; color: var(--cream-pure);">${escapeHtml(u.full_name)}</td>
        <td>
          <span style="font-family: monospace; font-weight: 700; color: var(--cream-gold); background: rgba(251, 215, 132, 0.1); padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(251, 215, 132, 0.25);">
            ${escapeHtml(idVal)}
          </span>
        </td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.phone || 'N/A')}</td>
        <td><span class="badge" style="background: ${roleBadgeBg}; color: ${roleBadgeColor}; text-transform: uppercase; font-size: 0.74rem; font-weight: 700;">${escapeHtml(u.role)}</span></td>
        <td><span style="color: var(--cream-soft); font-size: 0.84rem; font-weight: 500;">${escapeHtml(u.department || (u.role === 'staff' ? 'General Facilities' : 'Campus User'))}</span></td>
        <td style="font-size: 0.8rem; color: var(--cream-muted);">${API.formatDate(u.created_at)}</td>
        <td><span class="badge" style="background: rgba(251, 215, 132, 0.15); color: var(--cream-gold);">Pending Review</span></td>
        <td>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-sm btn-gold" onclick="approveUserRegistration(${u.user_id}, '${escapeHtml(u.full_name)}', this)">
              <i data-lucide="check" style="width: 14px; height: 14px;"></i> Approve
            </button>
            <button class="btn btn-sm btn-outline" style="border-color: #f87171; color: #f87171;" onclick="rejectUserRegistration(${u.user_id}, '${escapeHtml(u.full_name)}', this)">
              <i data-lucide="x" style="width: 14px; height: 14px;"></i> Reject
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

async function approveUserRegistration(userId, name, btn) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Approving...';
  }

  const res = await API.call(`/auth/approve/${userId}`, 'PUT', { notes: 'Approved by Administrator' });
  if (res && res.success) {
    API.showToast('Approved successfully', 'success');
    await loadPendingApprovals();
    await loadStaffList();
    renderStaffDirectory();
    if (typeof Auth !== 'undefined' && Auth.updateNotificationBadge) {
      Auth.updateNotificationBadge();
    }
  } else {
    API.showToast(res.message || 'Failed to approve user.', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px;"></i> Approve';
      lucide.createIcons();
    }
  }
}

async function rejectUserRegistration(userId, name, btn) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Rejecting...';
  }

  const res = await API.call(`/auth/reject/${userId}`, 'PUT', { notes: 'Registration rejected by Administrator' });
  if (res && res.success) {
    API.showToast('Account rejected', 'info');
    await loadPendingApprovals();
    if (typeof Auth !== 'undefined' && Auth.updateNotificationBadge) {
      Auth.updateNotificationBadge();
    }
  } else {
    API.showToast(res.message || 'Failed to reject user.', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="x" style="width: 14px; height: 14px;"></i> Reject';
      lucide.createIcons();
    }
  }
}

// 6. CSV Export Functionality
function exportDataCSV() {
  const token = localStorage.getItem('token');
  window.location.href = `/api/analytics/export?token=${token}`;
}

function downloadFilteredCSV() {
  const token = localStorage.getItem('token');
  const startDate = document.getElementById('report-start-date').value;
  const endDate = document.getElementById('report-end-date').value;
  const category = document.getElementById('report-category').value;
  const status = document.getElementById('report-status').value;

  const params = new URLSearchParams();
  params.append('token', token);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (category) params.append('category', category);
  if (status) params.append('status', status);

  window.location.href = `/api/analytics/export?${params.toString()}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
