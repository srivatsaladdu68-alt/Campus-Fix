/**
 * Campus Fix - API Client & Utility Library
 */

const API_BASE = '/api';

// Toast Notification Manager
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';
  if (type === 'warning') icon = '🔔';

  toast.innerHTML = `
    <span>${icon}</span>
    <div style="flex: 1; font-weight: 500;">${message}</div>
    <button style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:1rem;" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// Core API Request Helper
async function apiCall(endpoint, method = 'GET', data = null, isFormData = false) {
  const token = localStorage.getItem('token');
  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (data && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const options = {
    method,
    headers
  };

  if (data) {
    options.body = isFormData ? data : JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    
    // Handle unauthorized session
    if (response.status === 401) {
      const publicPages = ['/', '/index.html', '/login.html', '/register.html'];
      const currentPath = window.location.pathname;
      if (!publicPages.includes(currentPath)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html?expired=1';
        return;
      }
    }

    const result = await response.json();

    if (response.status === 403 && result.message && result.message.includes('no longer exists')) {
      const publicPages = ['/', '/index.html', '/login.html', '/register.html'];
      const currentPath = window.location.pathname;
      if (!publicPages.includes(currentPath)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        showToast('Your session has expired or account was reset. Please sign in again.', 'warning');
        setTimeout(() => {
          window.location.href = '/login.html?expired=1';
        }, 1200);
        return result;
      }
    }

    return result;
  } catch (err) {
    console.error(`API Error on ${method} ${endpoint}:`, err);
    showToast('Network error or server connection failed.', 'error');
    return { success: false, message: 'Network connection error' };
  }
}

// Format Date & Time
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Format Status Badge HTML
function getStatusBadge(status) {
  const map = {
    'Reported': 'badge-reported',
    'Verified': 'badge-verified',
    'Assigned': 'badge-assigned',
    'In Progress': 'badge-in-progress',
    'Resolved': 'badge-resolved',
    'Closed': 'badge-closed',
    'Rejected': 'badge-rejected',
    'Reopened': 'badge-reopened'
  };
  const cls = map[status] || 'badge-closed';
  return `<span class="badge ${cls}">${status}</span>`;
}

// Format Priority Badge HTML
function getPriorityBadge(priority) {
  const map = {
    'Low': 'badge-low',
    'Medium': 'badge-medium',
    'High': 'badge-high',
    'Critical': 'badge-critical'
  };
  const cls = map[priority] || 'badge-medium';
  return `<span class="badge ${cls}">${priority}</span>`;
}

window.API = {
  call: apiCall,
  showToast,
  formatDate,
  getStatusBadge,
  getPriorityBadge
};
