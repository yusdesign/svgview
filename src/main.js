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
    // Create a file input with folder selection enabled
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;  // Enables folder selection in Chrome/Edge
    input.multiple = true;
    input.directory = true;  // For broader browser support
    input.accept = '.svg,image/svg+xml';
    
    // Ask for a folder name first
    const folderName = prompt('📁 Enter a name for this folder collection:', new Date().toLocaleDateString());
    if (!folderName) {
      showNotification('📁 Cancelled', 'info');
      return;
    }

    // Wait for user to select a folder
    const files = await new Promise((resolve) => {
      input.onchange = (e) => resolve(e.target.files);
      input.click();
    });

    // Check if any files were selected
    if (!files || files.length === 0) {
      showNotification('📁 No files selected', 'info');
      return;
    }

    // Use the folder name as the collection name
    const folderPath = folderName;
    
    // Check if this folder already exists in the library
    if (svgLibrary[folderPath] && svgLibrary[folderPath].length > 0) {
      const confirmAdd = window.confirm(
        `📁 "${folderName}" already has ${svgLibrary[folderPath].length} SVGs.\n\nDo you want to add new files to this collection?`
      );
      if (!confirmAdd) return;
    }

    // Initialize the folder in the library if it doesn't exist
    if (!svgLibrary[folderPath]) {
      svgLibrary[folderPath] = [];
    }

    let loadedCount = 0;
    let errorCount = 0;

    // Process each file from the selected folder
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Skip non-SVG files
      if (!isSVG(file.name)) {
        continue;
      }

      // Check if this file already exists in this folder
      const exists = svgLibrary[folderPath].some(s => s.name === file.name);
      if (exists) {
        continue;
      }

      try {
        // Read the file content as text
        const content = await file.text();
        
        // Validate that it's actually an SVG
        if (!content.includes('<svg') && !content.includes('<?xml')) {
          console.warn('File is not a valid SVG:', file.name);
          // Still add as placeholder if invalid
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

        // Valid SVG - add to library
        svgLibrary[folderPath].push({
          name: file.name,
          content: content,
          size: file.size,
          type: 'svg',
          isPlaceholder: false
        });
        loadedCount++;
        
      } catch (error) {
        console.error('Error reading file:', file.name, error);
        errorCount++;
        
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

    // Save to localStorage and refresh the UI
    saveLibrary();
    rebuildFlatList();
    refreshGallery();
    updateUI();
    
    // Show success message
    if (loadedCount > 0) {
      showNotification(`✅ Loaded ${loadedCount} SVGs from "${folderName}"${errorCount > 0 ? ` (${errorCount} errors)` : ''}`, 'success');
    } else {
      showNotification('📁 No SVG files found in the selected folder', 'info');
    }
    
  } catch (error) {
    console.error('Web directory picker failed:', error);
    showNotification('❌ Failed to pick directory: ' + error.message, 'error');
  }
}

async function nativePickDirectory() {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    
    // Try the built-in picker first
    let result;
    try {
      result = await Filesystem.pickDirectory();
    } catch (e) {
      console.log('pickDirectory not available, using manual browse');
      // Fall through to manual browse
    }
    
    if (result && result.path) {
      // Use the result
      await loadFolder(result.path);
      return;
    }
    
    // Manual folder browser using readdir
    let currentPath = '';
    let currentDir = Directory.ExternalStorage;
    
    // Test if ExternalStorage works
    try {
      await Filesystem.readdir({ path: '', directory: Directory.ExternalStorage });
      currentDir = Directory.ExternalStorage;
    } catch {
      currentDir = Directory.Documents;
    }
    
    // Show a simple folder browser UI
    await browseFolders(currentPath, currentDir);
    
  } catch (error) {
    console.error('Picker failed:', error);
    await webPickDirectory();
  }
}

async function browseFolders(path = '') {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    
    // Use ExternalStorage as the base (this is /storage/emulated/0/)
    const result = await Filesystem.readdir({
      path: path,
      directory: Directory.ExternalStorage
    });
    
    const folders = result.files.filter(f => f.type === 'directory');
    const svgFiles = result.files.filter(f => f.type === 'file' && isSVG(f.name));
    
    // Build the UI
    let message = `📁 ${path || 'Internal Storage'}\n`;
    message += `─'.'─'─'─'─'─'─'─'─'─'\n`;
    message += `📂 ${folders.length} folders\n`;
    message += `📄 ${svgFiles.length} SVGs\n`;
    message += `─'.'─'─'─'─'─'─'─'─'─'\n\n`;
    
    // List folders
    folders.forEach((f, i) => {
      message += `  ${i+1}. 📁 ${f.name}\n`;
    });
    
    message += `\n📂 Enter number or folder name to open\n`;
    if (path) message += `🔙 Type ".." to go back\n`;
    message += `📂 Type "load" to load SVGs from here\n`;
    message += `❌ Type "cancel" to exit\n`;
    
    const choice = prompt(message, '');
    if (!choice || choice === 'cancel') return;
    
    if (choice === 'load') {
      await loadFolderContents(path);
      return;
    }
    
    if (choice === '..' && path) {
      const parent = path.split('/').slice(0, -1).join('/');
      await browseFolders(parent);
      return;
    }
    
    // Handle number selection
    const num = parseInt(choice);
    if (!isNaN(num) && num >= 1 && num <= folders.length) {
      const target = folders[num - 1];
      const newPath = path ? `${path}/${target.name}` : target.name;
      await browseFolders(newPath);
      return;
    }
    
    // Handle folder name
    const target = folders.find(f => f.name === choice);
    if (target) {
      const newPath = path ? `${path}/${choice}` : choice;
      await browseFolders(newPath);
      return;
    }
    
    await browseFolders(path);
    
  } catch (error) {
    console.error('Browse error:', error);
    showNotification('❌ Error browsing directory', 'error');
  }
}

async function loadFolderContents(path = '') {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    
    const result = await Filesystem.readdir({
      path: path,
      directory: Directory.ExternalStorage
    });
    
    const svgFiles = result.files.filter(f => f.type === 'file' && isSVG(f.name));
    const folderName = path.split('/').pop() || 'Root';
    
    if (svgFiles.length === 0) {
      showNotification(`📁 No SVG files in "${folderName}"`, 'info');
      return;
    }
    
    if (!svgLibrary[folderName]) {
      svgLibrary[folderName] = [];
    }
    
    let loadedCount = 0;
    for (const file of svgFiles) {
      const exists = svgLibrary[folderName].some(s => s.name === file.name);
      if (exists) continue;
      
      try {
        const filePath = path ? `${path}/${file.name}` : file.name;
        const content = await Filesystem.readFile({
          path: filePath,
          directory: Directory.ExternalStorage,
          encoding: 'utf8'
        });
        
        if (content.data && content.data.includes('<svg')) {
          svgLibrary[folderName].push({
            name: file.name,
            content: content.data,
            size: file.size || 0,
            type: 'svg',
            fullPath: filePath
          });
          loadedCount++;
        }
      } catch (error) {
        console.error('Error loading SVG:', file.name, error);
      }
    }
    
    saveLibrary();
    rebuildFlatList();
    refreshGallery();
    updateUI();
    showNotification(`✅ Loaded ${loadedCount} SVGs from "${folderName}"`, 'success');
    
  } catch (error) {
    console.error('Error loading folder:', error);
    showNotification('❌ Failed to load folder', 'error');
  }
}

function showFolderPickerUI(folders, currentPath = '', svgCount = 0) {
  // Remove existing picker if any
  const existing = document.querySelector('.folder-picker-overlay');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.className = 'folder-picker-overlay';
  overlay.innerHTML = `
    <div class="folder-picker-modal">
      <div class="folder-picker-header">
        <h3>📁 ${currentPath || 'Internal Storage'}</h3>
        <button class="folder-picker-close">✕</button>
      </div>
      <div class="folder-picker-path">
        <span>📂 ${currentPath || '/'}</span>
        ${currentPath ? `<button class="folder-picker-up">🔙 Up</button>` : ''}
      </div>
      <div class="folder-picker-list">
        ${folders.length === 0 ? '<div class="folder-picker-empty">📭 No folders found</div>' : ''}
        ${folders.map(f => `
          <div class="folder-picker-item" data-path="${f.name}" data-type="${f.type}">
            <span class="folder-icon">📁</span>
            <span class="folder-name">${f.name}</span>
            <span class="folder-arrow">›</span>
          </div>
        `).join('')}
      </div>
      <div class="folder-picker-footer">
        <button class="folder-picker-load" id="loadFromHereBtn">📂 Load SVGs (${svgCount})</button>
        <button class="folder-picker-cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // Handle folder clicks
  overlay.querySelectorAll('.folder-picker-item').forEach(item => {
    item.addEventListener('click', async () => {
      const path = item.dataset.path;
      const newPath = currentPath ? `${currentPath}/${path}` : path;
      await browseFoldersWithUI(newPath);
    });
  });
  
  // Up button
  const upBtn = overlay.querySelector('.folder-picker-up');
  if (upBtn) {
    upBtn.addEventListener('click', async () => {
      const parent = currentPath.split('/').slice(0, -1).join('/');
      await browseFoldersWithUI(parent);
    });
  }
  
  // Load from current folder
  overlay.querySelector('#loadFromHereBtn').addEventListener('click', async () => {
    await loadFolderContents(currentPath);
    overlay.remove();
  });
  
  // Close buttons
  overlay.querySelector('.folder-picker-close').addEventListener('click', () => {
    overlay.remove();
  });
  
  overlay.querySelector('.folder-picker-cancel').addEventListener('click', () => {
    overlay.remove();
  });
  
  // Click outside to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
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
  // Set up the main HTML
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

  // Setup drag and drop for web
  setupDragDrop();

  // Load saved library
  loadLibrary();
  refreshGallery();
  updateUI();

  // Log initialization
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
