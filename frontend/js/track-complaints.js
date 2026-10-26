/**
 * Campus Fix - Track Complaints Client Logic
 */

let currentFaults = [];
let selectedFault = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = Auth.requireAuth();
  if (!user) return;

  Auth.renderUserProfile();
  lucide.createIcons();

  setupFilters();
  await loadComplaints();

  // Check if URL has ?code=CF-2026-XXXX
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  if (code) {
    openDetailByCode(code);
  }
});

// Setup Filter Listeners
function setupFilters() {
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('filter-status');
  const categoryFilter = document.getElementById('filter-category');
  const priorityFilter = document.getElementById('filter-priority');
  const resetBtn = document.getElementById('reset-filters-btn');

  let debounceTimer;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadComplaints, 300);
    });
  }

  if (statusFilter) statusFilter.addEventListener('change', loadComplaints);
  if (categoryFilter) categoryFilter.addEventListener('change', loadComplaints);
  if (priorityFilter) priorityFilter.addEventListener('change', loadComplaints);

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (statusFilter) statusFilter.value = '';
      if (categoryFilter) categoryFilter.value = '';
      if (priorityFilter) priorityFilter.value = '';
      loadComplaints();
    });
  }
}

// Load Complaints from API
async function loadComplaints() {
  const searchInput = document.getElementById('search-input');
  const search = searchInput ? searchInput.value.trim() : '';
  const status = document.getElementById('filter-status') ? document.getElementById('filter-status').value : '';
  const category = document.getElementById('filter-category') ? document.getElementById('filter-category').value : '';
  const priority = document.getElementById('filter-priority') ? document.getElementById('filter-priority').value : '';

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (status) params.append('status', status);
  if (category) params.append('category', category);
  if (priority) params.append('priority', priority);

  const res = await API.call(`/faults?${params.toString()}`);
  const tbody = document.getElementById('complaints-tbody');
  const countEl = document.getElementById('results-count');

  if (!res || !res.success) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #f87171; padding: 2rem;">Failed to load complaints.</td></tr>';
    return;
  }

  currentFaults = res.faults || [];
  countEl.textContent = `${currentFaults.length} complaints found`;

  if (currentFaults.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: var(--cream-dim); padding: 2.5rem;">
          <p style="font-size: 1rem; font-weight: 600; color: var(--cream-soft);">No complaints matched your search filters.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = currentFaults.map(f => `
    <tr>
      <td>
        <span class="complaint-code-tag">${escapeHtml(f.complaint_code)}</span>
        ${f.is_overdue ? '<br><span class="badge badge-overdue" style="margin-top: 4px;">Overdue</span>' : ''}
      </td>
      <td>
        ${f.image_path 
          ? `<img src="${f.image_path}" 
                  alt="${escapeHtml(f.item_name || 'Equipment')}" 
                  class="equipment-thumbnail" 
                  onclick="openDetailModal(${f.fault_id})" 
                  title="Click to view photo"
                  onerror="this.onerror=null;this.src='/images/projector_fault.svg';">`
          : `<span class="badge" style="background: rgba(148, 163, 184, 0.1); color: var(--cream-dim); border: 1px dashed var(--border-cream); font-size: 0.72rem;">No image attached</span>`
        }
      </td>
      <td style="max-width: 270px;">
        <span class="badge badge-verified" style="font-size: 0.74rem; margin-bottom: 3px; display: inline-block;">
          🔧 ${escapeHtml(f.item_name || 'Facility Item')}
        </span>
        <div style="font-weight: 700; color: var(--primary);">${escapeHtml(f.title)}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${escapeHtml(f.description)}
        </div>
      </td>
      <td>
        <div style="font-weight: 500;">${escapeHtml(f.building_name || 'Campus')}</div>
        <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(f.room_number)} (${escapeHtml(f.floor_number)})</div>
      </td>
      <td>${escapeHtml(f.category)}</td>
      <td>${API.getPriorityBadge(f.priority)}</td>
      <td>${API.getStatusBadge(f.status)}</td>
      <td>
        ${f.staff_name ? `<span style="font-weight: 600; font-size: 0.85rem; color: var(--secondary);">${escapeHtml(f.staff_name)}</span>` : '<span style="color: #94a3b8; font-size: 0.82rem;">Unassigned</span>'}
      </td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="openDetailModal(${f.fault_id})">
          <i data-lucide="eye" style="width: 14px; height: 14px;"></i> View
        </button>
      </td>
    </tr>
  `).join('');

  lucide.createIcons();
}

// Open Detail by complaint code (e.g. direct link)
async function openDetailByCode(code) {
  const res = await API.call(`/faults/${code}`);
  if (res && res.success) {
    renderDetailModal(res);
  } else {
    API.showToast('Could not find complaint details.', 'error');
  }
}

// Open Detail Modal
async function openDetailModal(faultId) {
  const res = await API.call(`/faults/${faultId}`);
  if (res && res.success) {
    renderDetailModal(res);
  } else {
    API.showToast('Failed to load complaint details.', 'error');
  }
}

// Render Details & Interactive Visual Timeline
function renderDetailModal(data) {
  const f = data.fault;
  selectedFault = f;

  document.getElementById('modal-code').textContent = f.complaint_code;
  document.getElementById('modal-title').textContent = f.title;
  document.getElementById('modal-item-name').innerHTML = `🔧 ${escapeHtml(f.item_name || f.title)}`;
  document.getElementById('modal-location').textContent = `${f.building_name} (${f.building_code}) - ${f.floor_number}, ${f.room_number}`;
  document.getElementById('modal-cat-pri').innerHTML = `${escapeHtml(f.category)} | ${API.getPriorityBadge(f.priority)}`;
  
  // Reporter details: Name, Roll Number/ID, Department, Contact
  const roleLabel = f.reporter_role ? f.reporter_role.toUpperCase() : 'STUDENT';
  const rollNo = f.reporter_student_id ? ` &bull; <strong>Roll / ID:</strong> ${escapeHtml(f.reporter_student_id)}` : '';
  const dept = f.reporter_department ? ` &bull; <strong>Dept:</strong> ${escapeHtml(f.reporter_department)}` : '';
  const phone = f.reporter_phone ? ` &bull; <strong>Phone:</strong> ${escapeHtml(f.reporter_phone)}` : '';

  document.getElementById('modal-reporter-full').innerHTML = `
    <div style="font-weight: 700; color: var(--primary); font-size: 0.95rem;">
      ${escapeHtml(f.reporter_name || 'Campus Member')} 
      <span class="user-role-badge" style="background:#e0e7ff;color:#3730a3;font-size:0.72rem;margin-left:6px;">${roleLabel}</span>
    </div>
    <div style="font-size: 0.85rem; color: #475569; margin-top: 3px;">
      <strong>Email:</strong> ${escapeHtml(f.reporter_email || 'N/A')}${rollNo}${dept}${phone}
    </div>
  `;

  document.getElementById('modal-staff').textContent = f.staff_name ? `${f.staff_name} (${f.staff_phone || 'Staff'})` : 'Unassigned';
  document.getElementById('modal-description').textContent = f.description;

  // Handle Photo or No Image Message
  const imgBox = document.getElementById('modal-image-box');
  const imgTag = document.getElementById('modal-image');
  const noImgBox = document.getElementById('modal-no-image');
  if (f.image_path) {
    imgTag.src = f.image_path;
    imgBox.style.display = 'block';
    if (noImgBox) noImgBox.style.display = 'none';
  } else {
    imgBox.style.display = 'none';
    if (noImgBox) noImgBox.style.display = 'block';
  }

  // Handle Maintenance Notes
  const maintBox = document.getElementById('modal-maint-box');
  const maintNotes = document.getElementById('modal-maint-notes');
  if (data.maintenance && data.maintenance.repair_notes) {
    maintNotes.textContent = data.maintenance.repair_notes;
    maintBox.style.display = 'block';
  } else {
    maintBox.style.display = 'none';
  }

  // Render Visual Timeline Steps
  renderTimeline(f.status);

  // Render Audit History
  const historyList = document.getElementById('modal-history-list');
  if (data.history && data.history.length > 0) {
    historyList.innerHTML = data.history.map(h => `
      <div style="padding: 0.85rem 1rem; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(244, 239, 230, 0.12); border-left: 3px solid var(--electric-indigo-bright, #6366f1); border-radius: var(--radius-sm); font-size: 0.88rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap; gap: 0.5rem;">
          <strong style="color: var(--cream-gold, #fbd784); font-weight: 700; font-size: 0.92rem;">
            ${escapeHtml(h.changed_by_name || 'System')} 
            <span style="color: #a5b4fc; font-weight: 500; font-size: 0.78rem; text-transform: uppercase; margin-left: 4px;">(${escapeHtml(h.changed_by_role || 'user')})</span>
          </strong>
          <span style="color: #94a3b8; font-size: 0.8rem;">${API.formatDate(h.changed_at)}</span>
        </div>
        <div style="color: #f8fafc; font-size: 0.88rem; line-height: 1.45;">${escapeHtml(h.notes || `Transitioned to ${h.new_status}`)}</div>
      </div>
    `).join('');
  } else {
    historyList.innerHTML = '<div style="color: var(--cream-dim, #94a3b8); font-size: 0.85rem; padding: 0.5rem 0;">No history records found.</div>';
  }

  // Setup Modal Footer Actions (e.g. Reopen Button)
  const footer = document.getElementById('modal-footer-actions');
  const user = Auth.getUser();
  let footerHtml = '<button type="button" class="btn btn-outline" onclick="closeDetailModal()">Close</button>';

  // Reopen button visible if status is Resolved or Closed and user is reporter or admin
  if (['Resolved', 'Closed'].includes(f.status) && (user.role === 'admin' || user.user_id === f.reported_by)) {
    footerHtml += `
      <button type="button" class="btn btn-primary" style="background: var(--status-reopened);" onclick="openReopenModal()">
        <i data-lucide="rotate-ccw" style="width: 16px; height: 16px;"></i> Reopen Complaint
      </button>
    `;
  }

  footer.innerHTML = footerHtml;
  document.getElementById('detail-modal').classList.add('open');
  lucide.createIcons();
}

// Render Timeline Progress
function renderTimeline(currentStatus) {
  const steps = ['Reported', 'Verified', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
  const timelineEl = document.getElementById('modal-timeline');

  if (currentStatus === 'Rejected') {
    timelineEl.innerHTML = `
      <div style="text-align: center; width: 100%; color: #dc2626; font-weight: 700; padding: 1rem; background: #fee2e2; border-radius: var(--radius-md);">
        ⚠️ This complaint was reviewed and marked as REJECTED by Administration.
      </div>
    `;
    return;
  }

  if (currentStatus === 'Reopened') {
    timelineEl.innerHTML = `
      <div style="text-align: center; width: 100%; color: #c2410c; font-weight: 700; padding: 1rem; background: #ffedd5; border-radius: var(--radius-md);">
        🔄 Complaint has been REOPENED and returned to high-priority maintenance queue.
      </div>
    `;
    return;
  }

  const currentIndex = steps.indexOf(currentStatus);

  timelineEl.innerHTML = steps.map((step, idx) => {
    let stateClass = '';
    let icon = idx + 1;

    if (currentIndex >= idx) {
      if (currentIndex === idx) {
        stateClass = 'active';
        icon = '●';
      } else {
        stateClass = 'completed';
        icon = '✓';
      }
    }

    return `
      <div class="timeline-step ${stateClass}">
        <div class="timeline-dot">${icon}</div>
        <div class="timeline-label">${step}</div>
      </div>
    `;
  }).join('');
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.remove('open');
}

// Reopen Modal Logic
function openReopenModal() {
  document.getElementById('reopen-reason').value = '';
  document.getElementById('reopen-modal').classList.add('open');
}

function closeReopenModal() {
  document.getElementById('reopen-modal').classList.remove('open');
}

document.getElementById('confirm-reopen-btn').addEventListener('click', async () => {
  if (!selectedFault) return;
  const reason = document.getElementById('reopen-reason').value.trim();

  if (!reason) {
    API.showToast('Please state a reason for reopening this complaint.', 'error');
    return;
  }

  const res = await API.call(`/faults/${selectedFault.fault_id}/reopen`, 'POST', { reason });
  if (res && res.success) {
    API.showToast('Complaint reopened successfully!', 'success');
    closeReopenModal();
    closeDetailModal();
    await loadComplaints();
  } else {
    API.showToast(res.message || 'Failed to reopen complaint.', 'error');
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
