/**
 * Campus Fix - Notifications Client Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = Auth.requireAuth();
  if (!user) return;

  Auth.renderUserProfile();
  lucide.createIcons();

  const dashLink = document.getElementById('nav-dash-link');
  if (dashLink) {
    dashLink.href = Auth.getDashboardUrl(user.role);
  }
  const roleLabel = document.getElementById('sidebar-role-label');
  if (roleLabel) {
    roleLabel.textContent = user.role.toUpperCase();
  }

  await loadNotificationsList();
});

async function loadNotificationsList() {
  const res = await API.call('/notifications');
  const container = document.getElementById('notifications-list-container');
  const label = document.getElementById('unread-status-label');

  if (!res || !res.success) {
    container.innerHTML = '<div style="text-align: center; color: red;">Failed to load notifications.</div>';
    return;
  }

  label.textContent = `${res.unread_count} unread notifications`;

  if (res.notifications.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 3rem;">
        <i data-lucide="bell-off" style="width: 40px; height: 40px; margin-bottom: 0.75rem; color: #cbd5e1;"></i>
        <div style="font-weight: 600; font-size: 1.05rem;">No notifications right now</div>
        <p style="font-size: 0.85rem; margin-top: 0.25rem;">You will receive alerts when technicians update your complaints.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = res.notifications.map(n => `
    <div style="padding: 1rem 1.25rem; background: ${n.is_read ? '#ffffff' : '#eff6ff'}; border: 1px solid ${n.is_read ? 'var(--border-color)' : '#bfdbfe'}; border-radius: var(--radius-md); display: flex; align-items: start; justify-content: space-between; gap: 1rem; transition: var(--transition);">
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
          ${!n.is_read ? '<span style="width: 8px; height: 8px; border-radius: 50%; background: #2563eb; display: inline-block;"></span>' : ''}
          <span style="font-weight: ${n.is_read ? '500' : '700'}; color: var(--text-main); font-size: 0.95rem;">
            ${escapeHtml(n.message)}
          </span>
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted);">
          ${API.formatDate(n.created_at)}
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        ${!n.is_read ? `
          <button class="btn btn-outline btn-sm" onclick="markOneRead(${n.notification_id})" title="Mark as Read">
            <i data-lucide="check" style="width: 14px; height: 14px;"></i>
          </button>
        ` : ''}
        ${n.fault_id ? `
          <a href="track-complaints.html?code=${n.fault_id}" class="btn btn-outline btn-sm" title="View Complaint">
            View
          </a>
        ` : ''}
      </div>
    </div>
  `).join('');

  lucide.createIcons();
}

async function markOneRead(notifId) {
  const res = await API.call(`/notifications/${notifId}/read`, 'PATCH');
  if (res && res.success) {
    await loadNotificationsList();
    Auth.updateNotificationBadge();
  }
}

async function markAllNotificationsAsRead() {
  const res = await API.call('/notifications/mark-all-read', 'POST');
  if (res && res.success) {
    API.showToast('All notifications marked as read.', 'success');
    await loadNotificationsList();
    Auth.updateNotificationBadge();
  }
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
