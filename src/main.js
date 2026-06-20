import './style.css';
import javascriptLogo from './assets/javascript.svg';
import viteLogo from './assets/vite.svg';
import heroImg from './assets/hero.png';
import { setupCounter } from './counter.js';

// ===== APP STATE =====
let svgLibrary = {};
let allSvgs = [];

// ===== UTILITIES =====
const isNative = () => window?.Capacitor?.isNativePlatform?.() || false;

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const isSVG = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  return ext === 'svg' || ext === 'svgz';
};

const getFolderName = (path) => {
  const parts = path.split(/[\/\\]/);
  return parts[parts.length - 1] || path;
};

// ===== STORAGE =====
function saveLibrary() {
  try {
    const data = { library: svgLibrary, timestamp: Date.now() };
    localStorage.setItem('svgview_library', JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save library:', e);
  }
}

function loadLibrary() {
  try {
    const raw = localStorage.getItem('svgview_library');
    if (raw) {
      const data = JSON.parse(raw);
      svgLibrary = data.library || {};
      rebuildFlatList();
      return true;
    }
  } catch (e) {
    console.warn('Could not load library:', e);
  }
  return false;
}

function rebuildFlatList() {
  allSvgs = [];
  for (const [folder, svgs] of Object.entries(svgLibrary)) {
    svgs.forEach(svg => {
      allSvgs.push({
        ...svg,
        folder: folder,
        folderName: getFolderName(folder)
      });
    });
  }
}

// ===== GENERATE PLACEHOLDER SVG =====
function generatePlaceholderSVG(name, color = '#646cff') {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <rect width="100" height="100" rx="12" fill="${color}" opacity="0.1"/>
      <rect x="20" y="20" width="60" height="60" rx="8" fill="${color}" opacity="0.2"/>
      <text x="50" y="55" font-family="Arial" font-size="14" text-anchor="middle" fill="${color}" opacity="0.6">SVG</text>
      <text x="50" y="75" font-family="Arial" font-size="8" text-anchor="middle" fill="${color}" opacity="0.4">${name.substring(0, 10)}</text>
    </svg>
  `;
}

// ===== RENDER FUNCTIONS =====
function renderSVG(svgData) {
  const card = document.createElement('div');
  card.className = 'svg-card';

  const preview = document.createElement('div');
  preview.className = 'svg-preview';
  
  // Use placeholder if content is missing or empty
  if (svgData.content && svgData.content.includes('<svg')) {
    preview.innerHTML = svgData.content;
  } else {
    preview.innerHTML = generatePlaceholderSVG(svgData.name || 'SVG', '#646cff');
  }

  const info = document.createElement('div');
  info.className = 'svg-info';
  
  const filename = document.createElement('div');
  filename.className = 'filename';
  filename.textContent = svgData.name || 'Unnamed';
  
  const filesize = document.createElement('div');
  filesize.className = 'filesize';
  filesize.textContent = svgData.folderName ? `📁 ${svgData.folderName}` : '📁 Unknown';

  info.appendChild(filename);
  info.appendChild(filesize);
  card.appendChild(preview);
  card.appendChild(info);

  card.addEventListener('click', () => {
    if (svgData.content && svgData.content.includes('<svg')) {
      openFullscreen(svgData);
    } else {
      showNotification('📄 This is a placeholder SVG', 'info');
    }
  });
  
  return card;
}

function openFullscreen(svgData) {
  let modal = document.querySelector('.modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" aria-label="Close">✕</button>
        <div id="modal-body"></div>
        <div class="modal-footer">
          <span class="modal-filename">${svgData.name}</span>
          <span class="modal-folder">📁 ${svgData.folderName || 'Unknown'}</span>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => {
      modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        modal.classList.remove('active');
      }
    });
  }

  const modalBody = modal.querySelector('#modal-body');
  const modalFilename = modal.querySelector('.modal-filename');
  const modalFolder = modal.querySelector('.modal-folder');
  
  modalBody.innerHTML = svgData.content || generatePlaceholderSVG(svgData.name);
  modalFilename.textContent = svgData.name;
  modalFolder.textContent = `📁 ${svgData.folderName || 'Unknown'}`;
  modal.classList.add('active');
}

// ===== DIRECTORY PICKER =====
async function pickDirectory() {
  try {
    if (isNative()) {
      await nativePickDirectory();
    } else {
      await webPickDirectory();
    }
  } catch (error) {
    console.error('Error picking directory:', error);
    showNotification('❌ Failed to pick directory', 'error');
  }
}

async function webPickDirectory() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;
    input.directory = true;
    input.accept = '.svg,image/svg+xml';
    
    const folderName = prompt('📁 Enter a name for this folder collection:', 'My SVGs');
    if (!folderName) return;

    const files = await new Promise((resolve) => {
      input.onchange = (e) => resolve(e.target.files);
      input.click();
    });

    if (!files || files.length === 0) {
      showNotification('📁 No files selected', 'info');
      return;
    }

    const folderPath = folderName;
    
    if (svgLibrary[folderPath] && svgLibrary[folderPath].length > 0) {
      const confirm = window.confirm(
        `📁 "${folderName}" already has ${svgLibrary[folderPath].length} SVGs.\n\nAdd new files?`
      );
      if (!confirm) return;
    }

    if (!svgLibrary[folderPath]) {
      svgLibrary[folderPath] = [];
    }

    let loadedCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!isSVG(file.name)) continue;

      const exists = svgLibrary[folderPath].some(s => s.name === file.name);
      if (exists) continue;

      try {
        const content = await file.text();
        if (!content.includes('<svg') && !content.includes('<?xml')) {
          // Still add as placeholder if invalid SVG
          svgLibrary[folderPath].push({
            name: file.name,
            content: generatePlaceholderSVG(file.name, '#ef4444'),
            size: file.size,
            type: 'svg',
            isPlaceholder: true
          });
          loadedCount++;
          continue;
        }

        svgLibrary[folderPath].push({
          name: file.name,
          content: content,
          size: file.size,
          type: 'svg'
        });
        loadedCount++;
      } catch (error) {
        console.error('Error reading file:', file.name, error);
        // Add as placeholder on error
        svgLibrary[folderPath].push({
          name: file.name,
          content: generatePlaceholderSVG(file.name, '#ef4444'),
          size: file.size || 0,
          type: 'svg',
          isPlaceholder: true
        });
        loadedCount++;
      }
    }

    saveLibrary();
    rebuildFlatList();
    refreshGallery();
    updateUI();
    showNotification(`✅ Loaded ${loadedCount} SVGs from "${folderName}"`, 'success');
  } catch (error) {
    console.error('Web directory picker failed:', error);
    showNotification('❌ Failed to pick directory', 'error');
  }
}

async function nativePickDirectory() {
  try {
    // Import the FilePicker plugin (you need to install it)
    const { FilePicker } = await import('@capacitor-community/file-picker');
    
    // THIS opens the actual Android system folder picker
    const result = await FilePicker.pickDirectory();
    
    if (!result || !result.path) {
      showNotification('📁 No directory selected', 'info');
      return;
    }
    
    // Now you have the real folder path the user picked
    const folderPath = result.path;
    const folderName = folderPath.split('/').pop() || 'Selected Folder';
    
    // Read files from the picked folder
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const dirContents = await Filesystem.readdir({
      path: folderPath,
      directory: Directory.ExternalStorage
    });
    
    // ... rest of loading logic
  } catch (error) {
    console.error('Picker failed:', error);
    showNotification('❌ Folder picker failed', 'error');
  }
}

function showFolderPickerUI(folders) {
  // Create a modal/overlay with folder list
  const overlay = document.createElement('div');
  overlay.className = 'folder-picker-overlay';
  overlay.innerHTML = `
    <div class="folder-picker-modal">
      <h3>📁 Select Folder</h3>
      <div class="folder-list">
        ${folders.map(f => `
          <div class="folder-item" data-path="${f.name}">
            📂 ${f.name}
          </div>
        `).join('')}
      </div>
      <button id="cancelFolderPicker">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // Add click handlers
  overlay.querySelectorAll('.folder-item').forEach(item => {
    item.addEventListener('click', async () => {
      const path = item.dataset.path;
      await loadFolderContents(path);
      overlay.remove();
    });
  });
}

// ===== GALLERY =====
function refreshGallery() {
  const existingGallery = document.querySelector('#svg-gallery');
  const container = document.querySelector('#app');
  
  if (!existingGallery) {
    const gallerySection = document.createElement('section');
    gallerySection.id = 'svg-gallery';
    gallerySection.innerHTML = `
      <div class="gallery-header">
        <div class="gallery-header-left">
          <h2>🌇 SVG Library</h2>
          <span id="folderCount" class="folder-count">0 folders</span>
        </div>
        <div class="gallery-actions">
          <button id="pickDirectoryBtn" class="pick-files-btn">📁 Pick Directory</button>
          <span id="fileCount" class="file-count">0 SVGs</span>
          <button id="settingsBtn" class="settings-btn">⚙️</button>
        </div>
      </div>
      <div id="gallery" class="gallery-grid"></div>
    `;
    
    const nextSteps = document.querySelector('#next-steps');
    if (nextSteps) {
      nextSteps.after(gallerySection);
    } else {
      container.appendChild(gallerySection);
    }
    
    const pickBtn = document.querySelector('#pickDirectoryBtn');
    const settingsBtn = document.querySelector('#settingsBtn');
    
    if (pickBtn) {
      pickBtn.addEventListener('click', pickDirectory);
    }
    
    if (settingsBtn) {
      settingsBtn.addEventListener('click', showSettings);
    }
  }
  
  const galleryContainer = document.querySelector('#gallery');
  if (!galleryContainer) return;
  
  galleryContainer.innerHTML = '';
  
  // Always show something - even if empty, show placeholders
  if (allSvgs.length === 0) {
    // Show sample placeholder SVGs so the gallery isn't empty
    const sampleData = [
      { name: 'sample-1.svg', content: generatePlaceholderSVG('Sample 1', '#646cff'), folderName: '📁 Welcome' },
      { name: 'sample-2.svg', content: generatePlaceholderSVG('Sample 2', '#535bf2'), folderName: '📁 Welcome' },
      { name: 'sample-3.svg', content: generatePlaceholderSVG('Sample 3', '#22c55e'), folderName: '📁 Welcome' },
      { name: 'sample-4.svg', content: generatePlaceholderSVG('Sample 4', '#ef4444'), folderName: '📁 Welcome' }
    ];
    
    const folderSection = document.createElement('div');
    folderSection.className = 'folder-section';
    folderSection.innerHTML = `<div class="folder-label">📁 Welcome (4 placeholders)</div>`;
    
    sampleData.forEach((svgData) => {
      const card = renderSVG(svgData);
      folderSection.appendChild(card);
    });
    
    galleryContainer.appendChild(folderSection);
    
    // Add a message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'empty-gallery';
    messageDiv.innerHTML = `
      <div class="empty-icon">📁</div>
      <h3>Load your SVG files</h3>
      <p>Click "Pick Directory" to select a folder with SVG files</p>
      <div class="demo-hint">
        <p>💡 Your library is saved locally</p>
        <p>📂 Each folder becomes a separate collection</p>
        <p>🎨 Placeholder SVGs shown until you load real ones</p>
      </div>
    `;
    galleryContainer.appendChild(messageDiv);
    return;
  }

  // Display SVGs grouped by folder
  for (const [folder, svgs] of Object.entries(svgLibrary)) {
    if (svgs.length === 0) continue;
    
    const folderSection = document.createElement('div');
    folderSection.className = 'folder-section';
    folderSection.innerHTML = `<div class="folder-label">📁 ${getFolderName(folder)} (${svgs.length})</div>`;
    
    svgs.forEach((svgData) => {
      const card = renderSVG({ ...svgData, folderName: getFolderName(folder) });
      folderSection.appendChild(card);
    });
    
    galleryContainer.appendChild(folderSection);
  }
}

function updateUI() {
  const fileCount = document.querySelector('#fileCount');
  const folderCount = document.querySelector('#folderCount');
  
  if (fileCount) {
    fileCount.textContent = `${allSvgs.length} SVGs`;
  }
  
  if (folderCount) {
    const folderCountValue = Object.keys(svgLibrary).filter(k => svgLibrary[k].length > 0).length;
    folderCount.textContent = `${folderCountValue} folders`;
  }
}

// ===== SETTINGS =====
function showSettings() {
  let settingsModal = document.querySelector('#settingsModal');
  if (!settingsModal) {
    settingsModal = document.createElement('div');
    settingsModal.id = 'settingsModal';
    settingsModal.className = 'modal settings-modal';
    settingsModal.innerHTML = `
      <div class="modal-content settings-content">
        <button class="modal-close" id="settingsClose">✕</button>
        <h2>⚙️ Settings</h2>
        
        <div class="settings-section">
          <h3>Documentation</h3>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img class="logo" src="${viteLogo}" alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank">
                <img class="button-icon" src="${javascriptLogo}" alt="">
                Learn more
              </a>
            </li>
          </ul>
        </div>
        
        <div class="settings-section">
          <h3>Connect with us</h3>
          <p>Join the Vite community</p>
          <ul>
            <li><a href="https://github.com/vitejs/vite" target="_blank"><svg class="button-icon" role="presentation" aria-hidden="true"><use href="/icons.svg#github-icon"></use></svg>GitHub</a></li>
            <li><a href="https://chat.vite.dev/" target="_blank"><svg class="button-icon" role="presentation" aria-hidden="true"><use href="/icons.svg#discord-icon"></use></svg>Discord</a></li>
            <li><a href="https://bsky.app/profile/vite.dev" target="_blank"><svg class="button-icon" role="presentation" aria-hidden="true"><use href="/icons.svg#bluesky-icon"></use></svg>Bluesky</a></li>
          </ul>
        </div>
        
        <div class="settings-section">
          <h3>📱 App Info</h3>
          <p>svgview v0.0.0</p>
          <p>Built with ❤️ using Vite + Capacitor</p>
          <button id="clearAllDataBtn" class="danger-btn">🗑️ Clear All Data</button>
        </div>
      </div>
    `;
    document.body.appendChild(settingsModal);
    
    settingsModal.querySelector('#settingsClose').addEventListener('click', () => {
      settingsModal.classList.remove('active');
    });
    
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
      }
    });
    
    settingsModal.querySelector('#clearAllDataBtn').addEventListener('click', () => {
      if (confirm('⚠️ Delete all SVGs from library?')) {
        svgLibrary = {};
        allSvgs = [];
        saveLibrary();
        refreshGallery();
        updateUI();
        showNotification('🗑️ All data cleared', 'info');
        settingsModal.classList.remove('active');
      }
    });
  }
  
  settingsModal.classList.add('active');
}

// ===== NOTIFICATIONS =====
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// ===== SETUP =====
function setupApp() {
  document.querySelector('#app').innerHTML = `
    <section id="center">
      <div class="hero">
        <img src="${heroImg}" class="base" width="170" height="179">
        <img src="${javascriptLogo}" class="framework" alt="JavaScript logo"/>
        <img src="${viteLogo}" class="vite" alt="Vite logo" />
      </div>
      <div>
        <h1>🌇 svgview</h1>
        <p>Your local SVG library</p>
      </div>
    </section>
    <div class="ticks"></div>
    <section id="spacer"></section>
  `;

  // Drag and drop for web
  setupDragDrop();

  // Load saved library
  loadLibrary();
  refreshGallery();
  updateUI();

  console.log('🌇 svgview initialized!');
  console.log(`📚 Loaded ${allSvgs.length} SVGs from ${Object.keys(svgLibrary).length} folders`);
}

// ===== DRAG & DROP =====
function setupDragDrop() {
  let dragCounter = 0;

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    document.body.classList.add('drag-over');
  });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      document.body.classList.remove('drag-over');
    }
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    document.body.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const folderName = prompt('📁 Enter folder name for dropped SVGs:', 'Dropped SVGs');
    if (!folderName) return;

    if (!svgLibrary[folderName]) {
      svgLibrary[folderName] = [];
    }

    let loadedCount = 0;
    for (const file of files) {
      if (!isSVG(file.name)) continue;
      
      const exists = svgLibrary[folderName].some(s => s.name === file.name);
      if (exists) continue;

      try {
        const content = await file.text();
        if (content.includes('<svg') || content.includes('<?xml')) {
          svgLibrary[folderName].push({
            name: file.name,
            content: content,
            size: file.size,
            type: 'svg'
          });
        } else {
          svgLibrary[folderName].push({
            name: file.name,
            content: generatePlaceholderSVG(file.name, '#ef4444'),
            size: file.size,
            type: 'svg',
            isPlaceholder: true
          });
        }
        loadedCount++;
      } catch (error) {
        console.error('Error reading file:', file.name, error);
        svgLibrary[folderName].push({
          name: file.name,
          content: generatePlaceholderSVG(file.name, '#ef4444'),
          size: file.size || 0,
          type: 'svg',
          isPlaceholder: true
        });
        loadedCount++;
      }
    }

    saveLibrary();
    rebuildFlatList();
    refreshGallery();
    updateUI();
    showNotification(`✅ Loaded ${loadedCount} SVGs from "${folderName}"`, 'success');
  });
}

// ===== START =====
setupApp();
