/**
 * Campus Fix - Maintenance Staff Dashboard Logic
 */

let staffTasks = [];
let activeTask = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = Auth.requireAuth(['staff', 'admin']);
  if (!user) return;

  Auth.renderUserProfile();
  lucide.createIcons();

  await loadStaffDashboard();
});

async function loadStaffDashboard() {
  const res = await API.call('/dashboard/staff');
  if (!res || !res.success) {
    API.showToast('Failed to load maintenance dashboard.', 'error');
    return;
  }

  // Update Stats
  document.getElementById('stat-total').textContent = res.stats.total;
  document.getElementById('stat-new').textContent = res.stats.new_assignments;
  document.getElementById('stat-in-progress').textContent = res.stats.in_progress;
  document.getElementById('stat-completed').textContent = res.stats.completed;
  document.getElementById('stat-overdue').textContent = res.stats.overdue;

  staffTasks = res.tasks || [];
  renderTasks(staffTasks);
}

function renderTasks(tasks) {
  const tbody = document.getElementById('staff-tasks-tbody');

  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: var(--cream-dim); padding: 2.5rem;">
          <div style="font-size: 1.1rem; font-weight: 600; color: var(--cream-pure);">No tasks currently assigned to you!</div>
          <p style="font-size: 0.85rem; margin-top: 0.35rem; color: var(--cream-muted);">Check back when the facilities admin assigns new repair tickets.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tasks.map(t => `
    <tr style="${t.is_overdue ? 'background-color: rgba(248, 113, 113, 0.12);' : ''}">
      <td>
        <span class="complaint-code-tag">${escapeHtml(t.complaint_code)}</span>
        <div style="margin-top: 4px;">${API.getPriorityBadge(t.priority)}</div>
        ${t.is_overdue ? '<span class="badge badge-overdue" style="margin-top: 4px;">Overdue</span>' : ''}
      </td>
      <td>
        ${t.image_path 
          ? `<img src="${t.image_path}" 
                  alt="${escapeHtml(t.item_name || 'Equipment')}" 
                  class="equipment-thumbnail" 
                  onclick="openTaskModal(${t.fault_id})" 
                  title="Click to view work order"
                  onerror="this.onerror=null;this.src='/images/projector_fault.svg';">`
          : `<span class="badge" style="background: rgba(148, 163, 184, 0.1); color: var(--cream-dim); border: 1px dashed var(--border-cream); font-size: 0.72rem;">No image attached</span>`
        }
      </td>
      <td style="max-width: 250px;">
        <span class="badge badge-verified" style="font-size: 0.72rem; margin-bottom: 2px; display: inline-block;">
          🔧 ${escapeHtml(t.item_name || 'Equipment')}
        </span>
        <div style="font-weight: 700; color: var(--cream-pure);">${escapeHtml(t.title)}</div>
        <div style="font-size: 0.8rem; color: var(--cream-muted); margin-top: 2px;">
          ${escapeHtml(t.description)}
        </div>
      </td>
      <td>
        <div style="font-weight: 600; color: var(--cream-pure);">${escapeHtml(t.building_name || 'Campus')}</div>
        <div style="font-size: 0.78rem; color: var(--cream-muted);">${escapeHtml(t.room_number)} (${escapeHtml(t.floor_number)})</div>
      </td>
      <td>${escapeHtml(t.category)}</td>
      <td>
        <div style="font-weight: 500; color: var(--cream-pure);">${escapeHtml(t.reporter_name || 'Reporter')}</div>
        <div style="font-size: 0.78rem; color: var(--cream-muted);">${escapeHtml(t.reporter_phone || '')}</div>
      </td>
      <td>
        <div style="font-size: 0.85rem; font-weight: 600; color: ${t.is_overdue ? '#f87171' : 'var(--cream-soft)'};">
          ${t.deadline ? API.formatDate(t.deadline) : 'No Deadline'}
        </div>
      </td>
      <td>${API.getStatusBadge(t.status)}</td>
      <td>
        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
          ${t.status === 'Assigned' ? `
            <button class="btn btn-secondary btn-sm" onclick="startTaskQuick(${t.fault_id})">
              <i data-lucide="play" style="width: 14px; height: 14px;"></i> Start
            </button>
          ` : ''}
          <button class="btn btn-outline btn-sm" onclick="openTaskModal(${t.fault_id})">
            <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i> Update
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  lucide.createIcons();
}

// Quick Start Task
async function startTaskQuick(faultId) {
  const res = await API.call(`/faults/${faultId}/status`, 'PATCH', {
    status: 'In Progress',
    notes: 'Technician accepted the assignment and began inspection/work.'
  });

  if (res && res.success) {
    API.showToast('Task transitioned to In Progress.', 'success');
    await loadStaffDashboard();
  } else {
    API.showToast(res.message || 'Failed to update task status.', 'error');
  }
}

// Open Task Action Modal
function openTaskModal(faultId) {
  const task = staffTasks.find(t => t.fault_id === faultId);
  if (!task) return;

  activeTask = task;
  document.getElementById('task-modal-code').textContent = task.complaint_code;
  document.getElementById('task-modal-title').textContent = task.title;
  document.getElementById('task-modal-location').textContent = `${task.building_name} - ${task.floor_number}, ${task.room_number}`;
  document.getElementById('task-modal-status-badge').innerHTML = API.getStatusBadge(task.status);

  // Set default status select
  const statusSelect = document.getElementById('task-action-status');
  if (task.status === 'In Progress') {
    statusSelect.value = 'Resolved';
  } else {
    statusSelect.value = 'In Progress';
  }

  document.getElementById('task-action-notes').value = '';
  document.getElementById('task-flag-resources').checked = false;

  document.getElementById('task-modal').classList.add('open');
}

function closeTaskModal() {
  document.getElementById('task-modal').classList.remove('open');
}

// Save Modal Updates
document.getElementById('save-task-action-btn').addEventListener('click', async () => {
  if (!activeTask) return;

  const status = document.getElementById('task-action-status').value;
  const notes = document.getElementById('task-action-notes').value.trim();
  const flagResources = document.getElementById('task-flag-resources').checked;

  if (!notes) {
    API.showToast('Please enter repair notes before saving.', 'error');
    return;
  }

  // 1. Add notes & flags
  await API.call(`/faults/${activeTask.fault_id}/notes`, 'POST', {
    repair_notes: notes,
    resources_flagged: flagResources
  });

  // 2. Update status
  const res = await API.call(`/faults/${activeTask.fault_id}/status`, 'PATCH', {
    status: status,
    notes: notes
  });

  if (res && res.success) {
    API.showToast(`Task successfully marked as ${status}!`, 'success');
    closeTaskModal();
    await loadStaffDashboard();
  } else {
    API.showToast(res.message || 'Failed to update task.', 'error');
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
