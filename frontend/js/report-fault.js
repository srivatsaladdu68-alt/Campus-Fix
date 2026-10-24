/**
 * Campus Fix - Fault Reporting Client Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = Auth.requireAuth();
  if (!user) return;

  Auth.renderUserProfile();
  lucide.createIcons();

  // Set correct link for dashboard based on role
  const dashLink = document.getElementById('nav-dash-link');
  if (dashLink) {
    dashLink.href = Auth.getDashboardUrl(user.role);
  }
  const roleLabel = document.getElementById('sidebar-role-label');
  if (roleLabel) {
    roleLabel.textContent = user.role.toUpperCase();
  }

  await loadBuildings();
  setupImagePreview();
  setupDuplicateDetection();
  setupFormSubmit();
});

// Load Buildings Dropdown
async function loadBuildings() {
  const select = document.getElementById('building_id');
  const res = await API.call('/auth/buildings');

  if (res && res.success && res.buildings.length > 0) {
    select.innerHTML = '<option value="">Select Campus Building...</option>' + 
      res.buildings.map(b => `<option value="${b.building_id}">${escapeHtml(b.building_name)} (${b.building_code})</option>`).join('');
  } else {
    select.innerHTML = '<option value="">No buildings found</option>';
  }
}

// Image Preview & Validation
function setupImagePreview() {
  const fileInput = document.getElementById('fault-image');
  const previewContainer = document.getElementById('image-preview-container');
  const previewImg = document.getElementById('image-preview');

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        API.showToast('Selected image exceeds the 5MB size limit.', 'error');
        fileInput.value = '';
        previewContainer.style.display = 'none';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        previewImg.src = event.target.result;
        previewContainer.style.display = 'block';
      };
      reader.readAsDataURL(file);
    } else {
      previewContainer.style.display = 'none';
    }
  });
}

// Intelligent Real-Time Duplicate Detection
function setupDuplicateDetection() {
  const buildingSelect = document.getElementById('building_id');
  const roomInput = document.getElementById('room_number');
  const categorySelect = document.getElementById('category');
  const warningBox = document.getElementById('duplicate-warning');
  const warningText = document.getElementById('duplicate-warning-text');

  async function check() {
    const bId = buildingSelect.value;
    const room = roomInput.value.trim();
    const cat = categorySelect.value;

    if (bId && room && cat) {
      const res = await API.call(`/faults/check-duplicates?building_id=${bId}&room_number=${encodeURIComponent(room)}&category=${encodeURIComponent(cat)}`);
      if (res && res.has_duplicates && res.duplicates.length > 0) {
        const top = res.duplicates[0];
        warningText.innerHTML = `
          There is already an active complaint (<strong>${top.complaint_code} - "${escapeHtml(top.title)}"</strong>) reported for this location with status <span class="badge badge-reported">${top.status}</span>. Please verify before submitting.
        `;
        warningBox.style.display = 'block';
      } else {
        warningBox.style.display = 'none';
      }
    } else {
      warningBox.style.display = 'none';
    }
  }

  buildingSelect.addEventListener('change', check);
  roomInput.addEventListener('blur', check);
  categorySelect.addEventListener('change', check);
}

// Form Submission
function setupFormSubmit() {
  const form = document.getElementById('report-fault-form');
  const submitBtn = document.getElementById('submit-fault-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('title').value.trim();
    const item_name = document.getElementById('item_name').value.trim();
    const category = document.getElementById('category').value;
    const priority = document.getElementById('priority').value;
    const building_id = document.getElementById('building_id').value;
    const floor_number = document.getElementById('floor_number').value.trim();
    const room_number = document.getElementById('room_number').value.trim();
    const description = document.getElementById('description').value.trim();
    const fileInput = document.getElementById('fault-image');

    if (!title || !category || !building_id || !floor_number || !room_number || !description) {
      API.showToast('Please fill out all required fields marked with *', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('item_name', item_name || title);
    formData.append('category', category);
    formData.append('priority', priority);
    formData.append('building_id', building_id);
    formData.append('floor_number', floor_number);
    formData.append('room_number', room_number);
    formData.append('description', description);

    if (fileInput.files.length > 0) {
      formData.append('image', fileInput.files[0]);
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Submitting fault report...';

    const res = await API.call('/faults', 'POST', formData, true);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="send" style="width: 18px; height: 18px;"></i> Submit Fault Complaint';
    lucide.createIcons();

    if (res && res.success) {
      document.getElementById('modal-complaint-code').textContent = res.complaint_code;
      document.getElementById('modal-track-link').href = `track-complaints.html?code=${res.complaint_code}`;
      document.getElementById('success-modal').classList.add('open');
      lucide.createIcons();
    } else {
      API.showToast(res.message || 'Failed to submit complaint.', 'error');
    }
  });
}

function quickFillEquipment(itemName, category, title, priority) {
  document.getElementById('item_name').value = itemName;
  document.getElementById('category').value = category;
  document.getElementById('title').value = title;
  if (priority) {
    document.getElementById('priority').value = priority;
  }

  // Highlight selected card
  document.querySelectorAll('.quick-picker-card').forEach(card => card.classList.remove('active'));
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }

  API.showToast(`Selected equipment: ${itemName}`, 'info');
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
