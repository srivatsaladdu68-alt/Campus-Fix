/**
 * Campus Fix - Student / Faculty Dashboard Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = Auth.requireAuth(['student', 'faculty']);
  if (!user) return;

  Auth.renderUserProfile();
  lucide.createIcons();

  const welcomeEl = document.getElementById('welcome-message');
  if (welcomeEl) {
    welcomeEl.textContent = `Welcome back, ${user.full_name.split(' ')[0]}!`;
  }

  await loadDashboardData();
});

async function loadDashboardData() {
  const res = await API.call('/dashboard/user');
  if (!res || !res.success) {
    API.showToast('Failed to load dashboard metrics.', 'error');
    return;
  }

  // Update metrics
  document.getElementById('metric-total').textContent = res.stats.total;
  document.getElementById('metric-pending').textContent = res.stats.pending;
  document.getElementById('metric-progress').textContent = res.stats.in_progress;
  document.getElementById('metric-resolved').textContent = res.stats.resolved;

  // Render recent complaints
  const tbody = document.getElementById('recent-complaints-tbody');
  if (res.recent_complaints.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--cream-dim); padding: 2.5rem;">
          <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--cream-pure);">No complaints reported yet</div>
          <p style="font-size: 0.85rem; margin-bottom: 1rem; color: var(--cream-muted);">Spot an issue on campus? Report it right away to alert facilities.</p>
          <a href="report-fault.html" class="btn btn-gold btn-sm">Report a Fault</a>
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = res.recent_complaints.map(f => `
      <tr>
        <td>
          <span class="complaint-code-tag">${f.complaint_code}</span>
        </td>
        <td>
          ${f.image_path 
            ? `<img src="${f.image_path}" alt="Photo" class="equipment-thumbnail" style="width:40px;height:40px;border-radius:6px;object-fit:cover;cursor:pointer;" onclick="window.open('${f.image_path}', '_blank')" title="Click to view full image">`
            : `<span style="color: var(--cream-dim); font-size: 0.75rem;">No image attached</span>`
          }
        </td>
        <td>
          <div style="font-weight: 600; color: var(--cream-pure);">${escapeHtml(f.title)}</div>
          <div style="font-size: 0.78rem; color: var(--cream-muted);">${API.formatDate(f.created_at)}</div>
        </td>
        <td>
          <span style="font-size: 0.85rem; font-weight: 500;">${escapeHtml(f.building_name || 'Campus')}</span>
          <span style="font-size: 0.78rem; color: var(--cream-muted); display: block;">${escapeHtml(f.room_number)}</span>
        </td>
        <td>${escapeHtml(f.category)}</td>
        <td>${API.getPriorityBadge(f.priority)}</td>
        <td>${API.getStatusBadge(f.status)}</td>
        <td>
          <a href="track-complaints.html?code=${encodeURIComponent(f.complaint_code)}" class="btn btn-outline btn-sm" title="Track Progress">
            <i data-lucide="eye" style="width: 14px; height: 14px;"></i> Track
          </a>
        </td>
      </tr>
    `).join('');
  }

  // Render recent notifications
  const notifList = document.getElementById('recent-notifications-list');
  if (res.notifications.length === 0) {
    notifList.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 1.5rem; font-size: 0.88rem;">
        No notifications yet. Status updates will appear here when technicians take action.
      </div>
    `;
  } else {
    notifList.innerHTML = res.notifications.map(n => `
      <div style="padding: 0.95rem 1.15rem; background: ${n.is_read ? 'var(--bg-deep)' : 'rgba(99, 102, 241, 0.12)'}; border: 1px solid ${n.is_read ? 'var(--border-cream)' : 'var(--electric-indigo)'}; border-radius: var(--radius-md); font-size: 0.88rem; margin-bottom: 0.5rem;">
        <div style="font-weight: ${n.is_read ? '500' : '700'}; color: var(--cream-pure); margin-bottom: 0.25rem;">
          ${escapeHtml(n.message)}
        </div>
        <div style="font-size: 0.75rem; color: var(--cream-muted);">
          ${API.formatDate(n.created_at)}
        </div>
      </div>
    `).join('');
  }

  lucide.createIcons();
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
