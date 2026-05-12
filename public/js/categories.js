// === Category Management ===
let allCategories = [];

// === Emoji Picker ===
const EMOJIS = [
  '💼', '📚', '🏋️', '🎨', '📖', '💻', '🧠', '🎵',
  '✍️', '🧘', '🏃', '🎯', '📝', '🔬', '🌱', '🎓',
  '⚕️', '🛠️', '🎮', '📸', '💪', '🧹', '📞', '🛒',
  '✏️', '📋', '🗂️', '⏰', '💡', '🌟', '🎵', '🎧'
];

function renderEmojiGrid() {
  const grid = $('emojiGrid');
  if (!grid) return;
  grid.innerHTML = EMOJIS.map(emoji =>
    `<button type="button" class="emoji-option" data-emoji="${emoji}">${emoji}</button>`
  ).join('');

  grid.querySelectorAll('.emoji-option').forEach(btn => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.emoji-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      catIcon.value = btn.dataset.emoji;
    });
  });
}

// === Modal ===
const categoryModal = $('categoryModal');
const modalTitle = $('modalTitle');
const catName = $('catName');
const catIcon = $('catIcon');
const catColor = $('catColor');
const catId = $('catId');

function openModal(category = null) {
  if (category) {
    modalTitle.textContent = 'Edit Category';
    catName.value = category.name;
    catIcon.value = category.icon || '';
    catColor.value = category.color;
    catId.value = category.id;
  } else {
    modalTitle.textContent = 'Add Category';
    catName.value = '';
    catIcon.value = '';
    catColor.value = '#4CAF50';
    catId.value = '';
  }
  renderEmojiGrid();

  // Highlight the selected emoji if editing
  if (catIcon.value) {
    const selectedBtn = document.querySelector(`.emoji-option[data-emoji="${catIcon.value}"]`);
    if (selectedBtn) selectedBtn.classList.add('selected');
  }

  categoryModal.classList.remove('hidden');
  catName.focus();
}

function closeModal() {
  categoryModal.classList.add('hidden');
}

// === Load Categories ===
async function loadCategories() {
  try {
    const res = await fetch(BASE_PATH + '/api/categories');
    allCategories = await res.json();
    window.allCategories = allCategories;
    
    renderCategoriesList();
    renderTimerCategories(allCategories);
  } catch (e) {
    console.error('Failed to load categories:', e);
  }
}

// === Render Categories List ===
function renderCategoriesList() {
  const list = $('categoriesList');
  if (!list) return;
  
  if (allCategories.length === 0) {
    list.innerHTML = '<div class="empty-state">No categories yet. Create your first one!</div>';
    return;
  }
  
  list.innerHTML = allCategories.map(cat => `
    <div class="category-card" style="border-left-color: ${cat.color}">
      <div class="cat-icon">${cat.icon || '📌'}</div>
      <div class="cat-info">
        <div class="cat-name">${cat.name}</div>
        <div class="cat-stats">${cat.color}</div>
      </div>
      <div class="cat-actions">
        <button class="btn-icon edit-cat" data-id="${cat.id}" title="Edit">✏️</button>
        <button class="btn-icon delete-cat" data-id="${cat.id}" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
  
  // Event listeners
  list.querySelectorAll('.edit-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = allCategories.find(c => c.id === btn.dataset.id);
      if (cat) openModal(cat);
    });
  });
  
  list.querySelectorAll('.delete-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = allCategories.find(c => c.id === btn.dataset.id);
      if (cat && confirm(`Delete "${cat.name}"? This won't remove past sessions.`)) {
        deleteCategory(cat.id);
      }
    });
  });
}

// === CRUD Operations ===
async function saveCategory() {
  const name = catName.value.trim();
  if (!name) {
    alert('Please enter a category name.');
    return;
  }
  
  const data = {
    name,
    icon: catIcon.value.trim() || '📌',
    color: catColor.value
  };
  
  const editingId = catId.value;
  
  try {
    if (editingId) {
      await fetch(BASE_PATH + '/api/categories/' + editingId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      await fetch(BASE_PATH + '/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }
    
    closeModal();
    await loadCategories();
  } catch (e) {
    console.error('Failed to save category:', e);
    alert('Failed to save category.');
  }
}

async function deleteCategory(id) {
  try {
    await fetch(BASE_PATH + '/api/categories/' + id, { method: 'DELETE' });
    await loadCategories();
  } catch (e) {
    console.error('Failed to delete category:', e);
  }
}

// === Event Listeners ===
document.addEventListener('DOMContentLoaded', () => {
  $('addCategoryBtn').addEventListener('click', () => openModal());
  $('saveCategoryBtn').addEventListener('click', saveCategory);
  
  document.querySelectorAll('.modal-close, .modal-cancel').forEach(el => {
    el.addEventListener('click', closeModal);
  });
  
  categoryModal.addEventListener('click', (e) => {
    if (e.target === categoryModal) closeModal();
  });
  
  // Enter key to save
  catName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveCategory();
  });
  
  // Initialize
  init();
});

// Export
window.loadCategories = loadCategories;
window.allCategories = allCategories;
