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

  // Sidebar profile
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-display-role');
  const avatarEl = document.getElementById('user-avatar-initials');

  if (nameEl) nameEl.textContent = user.full_name;
  if (roleEl) roleEl.textContent = user.role.toUpperCase();
  if (avatarEl) {
    const initials = user.full_name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    avatarEl.textContent = initials || 'U';
  }

  // Poll notifications
  updateNotificationBadge();
  setInterval(updateNotificationBadge, 25000); // 25s polling
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
