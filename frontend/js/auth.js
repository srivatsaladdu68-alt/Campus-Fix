/**
 * Campus Fix - Authentication & Session Management
 */

function getUser() {
  const userStr = localStorage.getItem('user');
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}

function getToken() {
  return localStorage.getItem('token');
}

function isLoggedIn() {
  return !!getToken() && !!getUser();
}

function getDashboardUrl(role) {
  if (role === 'admin') return '/admin-dashboard.html';
  if (role === 'staff') return '/staff-dashboard.html';
  return '/dashboard.html'; // student and faculty
}

// Route Guard for Protected Dashboard Pages
function requireAuth(allowedRoles = []) {
  if (!isLoggedIn()) {
    window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    return null;
  }

  const user = getUser();
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Redirect to their respective dashboard
    window.location.href = getDashboardUrl(user.role);
    return null;
  }

  return user;
}

// Redirect if already logged in (used on login / register pages)
function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    const user = getUser();
    window.location.href = getDashboardUrl(user.role);
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

// Update Topbar and Sidebar Profile Elements
function renderUserProfile() {
  const user = getUser();
  if (!user) return;

  // Sidebar profile footer
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-display-role');
  const avatarEl = document.getElementById('user-avatar-initials');

  if (nameEl) nameEl.textContent = user.full_name;
  if (avatarEl) {
    const initials = user.full_name
      .split(' ')
      .filter(n => n.length > 0)
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    avatarEl.textContent = initials || 'U';
  }

  if (roleEl) {
    if (user.role === 'staff') {
      roleEl.textContent = 'TECHNICIAN';
      roleEl.style.color = '#34d399';
    } else if (user.role === 'admin') {
      roleEl.textContent = 'ADMINISTRATOR';
      roleEl.style.color = '#60a5fa';
    } else if (user.role === 'faculty') {
      roleEl.textContent = 'FACULTY';
      roleEl.style.color = 'var(--gold, #fbd784)';
    } else {
      roleEl.textContent = 'STUDENT';
      roleEl.style.color = 'var(--gold, #fbd784)';
    }
  }

  // Update brand subtitles across the sidebar header
  const brandSubtitles = document.querySelectorAll('.brand-subtitle, #sidebar-role-label');
  brandSubtitles.forEach(sub => {
    if (user.role === 'staff') {
      sub.textContent = 'Maintenance Staff';
      sub.style.color = 'var(--gold, #fbd784)';
    } else if (user.role === 'admin') {
      sub.textContent = 'Admin Control Center';
      sub.style.color = '#60a5fa';
    } else if (user.role === 'faculty') {
      sub.textContent = 'Faculty Portal';
      sub.style.color = 'var(--cream-muted, #94a3b8)';
    } else {
      sub.textContent = 'Student Portal';
      sub.style.color = 'var(--cream-muted, #94a3b8)';
    }
  });

  // Render role-appropriate sidebar navigation links
  renderSidebarNav(user);

  // Update topbar actions (e.g. on track-complaints)
  renderTopbarActions(user);

  // Poll notifications
  updateNotificationBadge();
  if (!window._notifIntervalStarted) {
    window._notifIntervalStarted = true;
    setInterval(updateNotificationBadge, 25000); // 25s polling
  }
}

function renderSidebarNav(user) {
  const sidebarNav = document.querySelector('.sidebar-nav');
  if (!sidebarNav) return;

  const pathname = window.location.pathname.toLowerCase();
  const currentPage = pathname.substring(pathname.lastIndexOf('/') + 1) || 'index.html';

  // Do not rewrite tabs on admin-dashboard.html itself
  if (currentPage === 'admin-dashboard.html') return;

  if (user.role === 'staff') {
    const isAssigned = currentPage === 'staff-dashboard.html';
    const isAllComplaints = currentPage === 'track-complaints.html';
    const isNotif = currentPage === 'notifications.html';

    sidebarNav.innerHTML = `
      <span class="nav-category">Main Menu</span>
      <a href="staff-dashboard.html" class="sidebar-link ${isAssigned ? 'active' : ''}">
        <i data-lucide="wrench"></i>
        <span>My Assigned Tasks</span>
      </a>
      <a href="track-complaints.html" class="sidebar-link ${isAllComplaints ? 'active' : ''}">
        <i data-lucide="search"></i>
        <span>All Complaints</span>
      </a>
      <a href="notifications.html" class="sidebar-link ${isNotif ? 'active' : ''}">
        <i data-lucide="bell"></i>
        <span>Notifications</span>
      </a>
    `;
  } else if (user.role === 'admin') {
    const isNotif = currentPage === 'notifications.html';
    const isAllComplaints = currentPage === 'track-complaints.html';

    sidebarNav.innerHTML = `
      <a href="admin-dashboard.html#overview" class="sidebar-link">
        <i data-lucide="layout-dashboard"></i>
        <span>Analytics Overview</span>
      </a>
      <a href="admin-dashboard.html#complaints" class="sidebar-link ${isAllComplaints ? 'active' : ''}">
        <i data-lucide="user-check"></i>
        <span>Assign Staff & Tickets</span>
      </a>
      <a href="admin-dashboard.html#reports" class="sidebar-link">
        <i data-lucide="file-spreadsheet"></i>
        <span>Reports & CSV Export</span>
      </a>
      <a href="admin-dashboard.html#staff-mgmt" class="sidebar-link">
        <i data-lucide="user-check"></i>
        <span>Account Approvals & Staff</span>
        <span class="badge" id="sidebar-pending-badge" style="display: none; margin-left: auto; background: var(--cream-gold); color: #0b0c1e; font-weight: 700; font-size: 0.7rem; padding: 2px 6px; border-radius: 9999px;">0</span>
      </a>
      <a href="notifications.html" class="sidebar-link ${isNotif ? 'active' : ''}">
        <i data-lucide="bell"></i>
        <span>Notifications</span>
        <span class="badge" id="unread-notif-count" style="display: none; margin-left: auto; background: var(--electric-indigo); color: white; font-weight: 700; font-size: 0.7rem; padding: 2px 6px; border-radius: 9999px;">0</span>
      </a>
    `;
  } else {
    // Student or Faculty
    const isDash = currentPage === 'dashboard.html';
    const isReport = currentPage === 'report-fault.html';
    const isTrack = currentPage === 'track-complaints.html';
    const isNotif = currentPage === 'notifications.html';

    sidebarNav.innerHTML = `
      <span class="nav-category">Main Menu</span>
      <a href="dashboard.html" class="sidebar-link ${isDash ? 'active' : ''}">
        <i data-lucide="layout-dashboard"></i>
        <span>My Dashboard</span>
      </a>
      <a href="report-fault.html" class="sidebar-link ${isReport ? 'active' : ''}">
        <i data-lucide="plus-circle"></i>
        <span>Report Fault</span>
      </a>
      <a href="track-complaints.html" class="sidebar-link ${isTrack ? 'active' : ''}">
        <i data-lucide="search"></i>
        <span>Track Complaints</span>
      </a>
      <a href="notifications.html" class="sidebar-link ${isNotif ? 'active' : ''}">
        <i data-lucide="bell"></i>
        <span>Notifications</span>
      </a>
    `;
  }

  // Refresh Lucide SVG icons for newly rendered navigation items
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function renderTopbarActions(user) {
  const topbarActions = document.querySelector('.topbar-actions');
  if (!topbarActions) return;

  const pathname = window.location.pathname.toLowerCase();
  const currentPage = pathname.substring(pathname.lastIndexOf('/') + 1) || 'index.html';

  if (currentPage === 'track-complaints.html') {
    if (user.role === 'staff') {
      topbarActions.innerHTML = `
        <a href="staff-dashboard.html" class="btn btn-gold">
          <i data-lucide="wrench" style="width: 18px; height: 18px;"></i>
          My Assigned Tasks
        </a>
      `;
    } else if (user.role === 'admin') {
      topbarActions.innerHTML = `
        <a href="admin-dashboard.html" class="btn btn-gold">
          <i data-lucide="shield" style="width: 18px; height: 18px;"></i>
          Admin Console
        </a>
      `;
    } else {
      topbarActions.innerHTML = `
        <a href="report-fault.html" class="btn btn-gold">
          <i data-lucide="plus" style="width: 18px; height: 18px;"></i>
          Report New Fault
        </a>
      `;
    }
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }
}

async function updateNotificationBadge() {
  if (!isLoggedIn()) return;
  const badge = document.getElementById('unread-notif-count');
  if (!badge) return;

  const res = await API.call('/notifications');
  if (res && res.success) {
    if (res.unread_count > 0) {
      badge.textContent = res.unread_count > 9 ? '9+' : res.unread_count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
}

window.Auth = {
  getUser,
  getToken,
  isLoggedIn,
  getDashboardUrl,
  requireAuth,
  redirectIfLoggedIn,
  logout,
  renderUserProfile,
  updateNotificationBadge
};
