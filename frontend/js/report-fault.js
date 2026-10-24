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

// Helper to format file sizes
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Image Preview, Metadata Display & Client Validation (File Explorer / Drag & Drop)
function setupImagePreview() {
  const fileInput = document.getElementById('fault-image');
  const dropzone = document.getElementById('upload-dropzone');
  const previewContainer = document.getElementById('image-preview-container');
  const previewImg = document.getElementById('image-preview');
  const filenameEl = document.getElementById('image-filename');
  const filesizeEl = document.getElementById('image-filesize');
  const errorMsg = document.getElementById('image-error-msg');
  const removeBtn = document.getElementById('remove-image-btn');
  const changeBtn = document.getElementById('change-image-btn');

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  // 1. Click Dropzone -> Opens Windows File Explorer
  if (dropzone) {
    dropzone.addEventListener('click', () => {
      fileInput.click();
    });

    // Drag & Drop handlers
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.style.borderColor = 'var(--cream-gold)';
        dropzone.style.background = 'rgba(99, 102, 241, 0.18)';
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.style.borderColor = 'var(--border-cream)';
        dropzone.style.background = 'var(--bg-surface)';
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        fileInput.files = dt.files;
        handleFileSelection(dt.files[0]);
      }
    });
  }

  // 2. Change / Browse Again Button -> Re-opens File Explorer
  if (changeBtn) {
    changeBtn.addEventListener('click', () => {
      fileInput.click();
    });
  }

  // 3. File Input Change Event (from File Explorer selection)
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });

  function handleFileSelection(file) {
    errorMsg.style.display = 'none';
    errorMsg.textContent = '';

    if (!file) {
      previewContainer.style.display = 'none';
      if (dropzone) dropzone.style.display = 'block';
      return;
    }

    // Validate File Extension and Mime
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExt) || !allowedTypes.includes(file.type)) {
      errorMsg.textContent = 'Unsupported file format! Only JPG, JPEG, PNG, and WEBP image formats are accepted.';
      errorMsg.style.display = 'block';
      fileInput.value = '';
      previewContainer.style.display = 'none';
      if (dropzone) dropzone.style.display = 'block';
      return;
    }

    // Validate File Size (Max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      errorMsg.textContent = `The selected file size (${formatFileSize(file.size)}) exceeds the maximum 5 MB limit. Please select a smaller photo.`;
      errorMsg.style.display = 'block';
      fileInput.value = '';
      previewContainer.style.display = 'none';
      if (dropzone) dropzone.style.display = 'block';
      return;
    }

    // Render Preview and File Info
    filenameEl.textContent = file.name;
    filesizeEl.textContent = formatFileSize(file.size);

    const reader = new FileReader();
    reader.onload = (event) => {
      previewImg.src = event.target.result;
      if (dropzone) dropzone.style.display = 'none';
      previewContainer.style.display = 'block';
      lucide.createIcons();
    };
    reader.readAsDataURL(file);
  }

  // 4. Remove Selected Image
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      fileInput.value = '';
      previewContainer.style.display = 'none';
      if (dropzone) dropzone.style.display = 'block';
      errorMsg.style.display = 'none';
      previewImg.src = '#';
    });
  }
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

// Form Submission with Optional Image
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

    // Append optional image if selected
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
