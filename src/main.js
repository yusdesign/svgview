import './style.css';
import javascriptLogo from './assets/javascript.svg';
import viteLogo from './assets/vite.svg';
import heroImg from './assets/hero.png';
import { setupCounter } from './counter.js';

// ===== APP STATE =====
let svgLibrary = {}; // { folderPath: [svgData, ...] }
let currentFolder = null;
let allSvgs = []; // Flat array for gallery display

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
    const data = {
      library: svgLibrary,
      timestamp: Date.now()
    };
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

// ===== RENDER FUNCTIONS =====
function renderSVG(svgData) {
  const card = document.createElement('div');
  card.className = 'svg-card';

  const preview = document.createElement('div');
  preview.className = 'svg-preview';
  preview.innerHTML = svgData.content;

  const info = document.createElement('div');
  info.className = 'svg-info';
  
  const filename = document.createElement('div');
  filename.className = 'filename';
  filename.textContent = svgData.name;
  
  const filesize = document.createElement('div');
  filesize.className = 'filesize';
  filesize.textContent = `${formatSize(svgData.size)} • ${svgData.folderName || 'Unknown folder'}`;

  info.appendChild(filename);
  info.appendChild(filesize);
  card.appendChild(preview);
  card.appendChild(info);

  card.addEventListener('click', () => openFullscreen(svgData));
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
  
  modalBody.innerHTML = svgData.content;
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
    // Use webkitdirectory for folder selection with browse UI
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;
    input.directory = true; // For older browsers
    
    // Add accept filter for SVG
    input.accept = '.svg,image/svg+xml';
    
    // Show nice prompt
    const folderName = prompt('📁 Enter a name for this folder collection:', new Date().toLocaleDateString());
    if (!folderName) return;

    const files = await new Promise((resolve) => {
      input.onchange = (e) => resolve(e.target.files);
      input.click();
    });

    if (!files || files.length === 0) {
      showNotification('📁 No files selected', 'info');
      return;
    }

    // Process files from the selected folder
    const folderPath = folderName;
    
    // Check if folder already exists
    if (svgLibrary[folderPath] && svgLibrary[folderPath].length > 0) {
      const confirm = window.confirm(
        `📁 "${folderName}" already has ${svgLibrary[folderPath].length} SVGs.\n\nDo you want to add new files from this folder?`
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
        if (!content.includes('<svg') && !content.includes('<?xml')) continue;

        svgLibrary[folderPath].push({
          name: file.name,
          content: content,
          size: file.size,
          type: 'svg'
        });
        loadedCount++;
      } catch (error) {
        console.error('Error reading file:', file.name, error);
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
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    
    // Try to use the native file picker if available
    try {
      // Some Capacitor plugins support directory picker
      const result = await Filesystem.readdir({
        path: '',
        directory: Directory.Documents
      });

      // Show folders in a dropdown
      const folders = result.files.filter(f => f.type === 'directory' && f.name !== '..');
      
      if (folders.length === 0) {
        // If no folders, offer to create one or browse from root
        const createNew = confirm('📁 No folders found. Would you like to create a new folder?');
        if (createNew) {
          const newFolder = prompt('📁 Enter new folder name:', 'SVG_Library');
          if (newFolder) {
            await Filesystem.mkdir({
              path: newFolder,
              directory: Directory.Documents
            });
            showNotification(`✅ Created folder: ${newFolder}`, 'success');
            // Retry after creation
            await nativePickDirectory();
          }
        } else {
          // Fallback to web picker
          await webPickDirectory();
        }
        return;
      }

      // Build a nice UI for folder selection
      const folderOptions = folders.map(f => f.name);
      folderOptions.push('📁 Browse from root');
      folderOptions.push('📁 Create new folder');
      
      const selected = prompt(
        `📁 Available folders:\n\n${folders.map((f, i) => `  ${i+1}. ${f.name}`).join('\n')}\n\nOptions:\n  📁 Browse from root\n  📁 Create new folder\n\nEnter folder name:`,
        folders[0]?.name || ''
      );
      
      if (!selected) return;
      
      if (selected === '📁 Browse from root') {
        // Try root directory
        const rootResult = await Filesystem.readdir({
          path: '',
          directory: Directory.ExternalStorage || Directory.Documents
        });
        // ... handle root browsing
        showNotification('📁 Browse from root - select a folder', 'info');
        return;
      }
      
      if (selected === '📁 Create new folder') {
        const newFolder = prompt('📁 Enter new folder name:', 'SVG_Library');
        if (newFolder) {
          await Filesystem.mkdir({
            path: newFolder,
            directory: Directory.Documents
          });
          showNotification(`✅ Created folder: ${newFolder}`, 'success');
          await nativePickDirectory();
        }
        return;
      }

      // Load from selected folder
      const folderName = selected;
      const folderFiles = await Filesystem.readdir({
        path: folderName,
        directory: Directory.Documents
      });

      const svgFiles = folderFiles.files.filter(f => isSVG(f.name));
      
      if (svgFiles.length === 0) {
        showNotification(`📁 No SVG files found in "${folderName}"`, 'info');
        return;
      }

      if (!svgLibrary[folderName]) {
        svgLibrary[folderName] = [];
      }

      let loadedCount = 0;
      for (const file of svgFiles) {
        const exists = svgLibrary[folderName].some(s => s.name === file.name);
        if (exists) continue;

        const content = await Filesystem.readFile({
          path: `${folderName}/${file.name}`,
          directory: Directory.Documents,
          encoding: 'utf8'
        });

        svgLibrary[folderName].push({
          name: file.name,
          content: content.data,
          size: file.size || 0,
          type: 'svg'
        });
        loadedCount++;
      }

      saveLibrary();
      rebuildFlatList();
      refreshGallery();
      updateUI();
      showNotification(`✅ Loaded ${loadedCount} SVGs from "${folderName}"`, 'success');
      
    } catch (error) {
      console.error('Native directory picker failed:', error);
      // Fallback to web picker
      showNotification('📁 Using web file picker instead', 'info');
      await webPickDirectory();
    }
  } catch (error) {
    console.error('Native picker failed:', error);
    await webPickDirectory();
  }
}

async function webPickFiles() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg,image/svg+xml';
    input.multiple = true;
    input.webkitdirectory = true; // This enables folder selection!
    
    const files = await new Promise((resolve) => {
      input.onchange = (e) => resolve(e.target.files);
      input.click();
    });

    if (!files || files.length === 0) return;

    const folderName = files[0].webkitRelativePath.split('/')[0] || 'Unknown Folder';
    const folderPath = folderName;
    
    // Check if folder already exists
    if (svgLibrary[folderPath]) {
      const confirm = window.confirm(
        `📁 "${folderName}" already has ${svgLibrary[folderPath].length} SVGs.\n\nDo you want to add new files from this folder?`
      );
      if (!confirm) return;
    }

    // Initialize folder in library
    if (!svgLibrary[folderPath]) {
      svgLibrary[folderPath] = [];
    }

    let loadedCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!isSVG(file.name)) continue;

      // Check if file already exists in this folder
      const exists = svgLibrary[folderPath].some(s => s.name === file.name);
      if (exists) continue;

      try {
        const content = await file.text();
        if (!content.includes('<svg') && !content.includes('<?xml')) continue;

        svgLibrary[folderPath].push({
          name: file.name,
          content: content,
          size: file.size,
          type: 'svg'
        });
        loadedCount++;
      } catch (error) {
        console.error('Error reading file:', file.name, error);
      }
    }

    saveLibrary();
    rebuildFlatList();
    refreshGallery();
    updateUI();
    showNotification(`✅ Loaded ${loadedCount} SVGs from "${folderName}"`, 'success');
  } catch (error) {
    console.error('Web picker failed:', error);
    showNotification('❌ Failed to pick files', 'error');
  }
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
          <button id="clearGalleryBtn" class="clear-btn" title="Clear Library">🗑️</button>
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
    const clearBtn = document.querySelector('#clearGalleryBtn');
    
    if (pickBtn) {
      pickBtn.addEventListener('click', pickDirectory);
    }
    
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('🗑️ Clear all SVG files from library?')) {
          svgLibrary = {};
          allSvgs = [];
          saveLibrary();
          refreshGallery();
          updateUI();
          showNotification('🗑️ Library cleared', 'info');
        }
      });
    }
  }
  
  const galleryContainer = document.querySelector('#gallery');
  if (!galleryContainer) return;
  
  galleryContainer.innerHTML = '';
  
  if (allSvgs.length === 0) {
    galleryContainer.innerHTML = `
      <div class="empty-gallery">
        <div class="empty-icon">📁</div>
        <h3>No SVG files loaded</h3>
        <p>Click "Pick Directory" to select a folder with SVG files</p>
        <div class="demo-hint">
          <p>💡 Your library is saved locally</p>
          <p>📂 Each folder becomes a separate collection</p>
        </div>
      </div>
    `;
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
  // Set up HTML
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
        <div class="quick-actions">
          <button id="quickLoadBtn" class="quick-load-btn">📁 Pick Directory</button>
          <span class="shortcut-hint">or press <kbd>⌘O</kbd> / <kbd>Ctrl+O</kbd></span>
        </div>
      </div>
      <button id="counter" type="button" class="counter"></button>
    </section>

    <div class="ticks"></div>

    <section id="next-steps">
      <div id="docs">
        <svg class="icon" role="presentation" aria-hidden="true"><use href="/icons.svg#documentation-icon"></use></svg>
        <h2>Documentation</h2>
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
      <div id="social">
        <svg class="icon" role="presentation" aria-hidden="true"><use href="/icons.svg#social-icon"></use></svg>
        <h2>Connect with us</h2>
        <p>Join the Vite community</p>
        <ul>
          <li><a href="https://github.com/vitejs/vite" target="_blank"><svg class="button-icon" role="presentation" aria-hidden="true"><use href="/icons.svg#github-icon"></use></svg>GitHub</a></li>
          <li><a href="https://chat.vite.dev/" target="_blank"><svg class="button-icon" role="presentation" aria-hidden="true"><use href="/icons.svg#discord-icon"></use></svg>Discord</a></li>
          <li><a href="https://bsky.app/profile/vite.dev" target="_blank"><svg class="button-icon" role="presentation" aria-hidden="true"><use href="/icons.svg#bluesky-icon"></use></svg>Bluesky</a></li>
        </ul>
      </div>
    </section>

    <div class="ticks"></div>
    <section id="spacer"></section>
  `;

  setupCounter(document.querySelector('#counter'));

  // In setupApp(), add a custom folder picker UI
  function setupFolderPickerUI() {
    const pickBtn = document.querySelector('#pickDirectoryBtn');
    if (pickBtn) {
      // Add a dropdown for folder management
      const folderManager = document.createElement('div');
      folderManager.className = 'folder-manager';
      folderManager.innerHTML = `
        <button class="folder-manager-btn" title="Manage Folders">📁</button>
        <div class="folder-dropdown hidden">
          <div class="folder-list"></div>
          <button class="create-folder-btn">➕ New Folder</button>
        </div>
      `;
      pickBtn.parentNode.insertBefore(folderManager, pickBtn.nextSibling);
    }
  }

  // Quick load button
  const quickLoadBtn = document.querySelector('#quickLoadBtn');
  if (quickLoadBtn) {
    quickLoadBtn.addEventListener('click', pickDirectory);
  }

  // Drag and drop for web
  setupDragDrop();

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
      e.preventDefault();
      pickDirectory();
    }
  });

  // Load saved library
  loadLibrary();
  refreshGallery();
  updateUI();

  console.log('🌇 svgview initialized!');
  console.log(`📚 Loaded ${allSvgs.length} SVGs from ${Object.keys(svgLibrary).length} folders`);
  console.log('💡 Press ⌘O / Ctrl+O to pick a directory');
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

    const items = e.dataTransfer.items;
    if (!items) return;

    // Check if it's a folder
    let isFolder = false;
    for (const item of items) {
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry && entry.isDirectory) {
          isFolder = true;
          break;
        }
      }
    }

    if (isFolder) {
      // Handle folder drop
      const folderName = prompt('📁 Enter a name for this folder:', 'My SVGs');
      if (!folderName) return;

      const files = e.dataTransfer.files;
      const folderPath = folderName;

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
          if (!content.includes('<svg') && !content.includes('<?xml')) continue;

          svgLibrary[folderPath].push({
            name: file.name,
            content: content,
            size: file.size,
            type: 'svg'
          });
          loadedCount++;
        } catch (error) {
          console.error('Error reading file:', file.name, error);
        }
      }

      saveLibrary();
      rebuildFlatList();
      refreshGallery();
      updateUI();
      showNotification(`✅ Loaded ${loadedCount} SVGs from "${folderName}"`, 'success');
    } else {
      // Single file drop - prompt for folder
      const files = e.dataTransfer.files;
      const svgFiles = Array.from(files).filter(f => isSVG(f.name));
      
      if (svgFiles.length === 0) {
        showNotification('📁 No SVG files found', 'info');
        return;
      }

      const folderName = prompt(`📁 Enter folder name for ${svgFiles.length} SVGs:`, 'Dropped SVGs');
      if (!folderName) return;

      const folderPath = folderName;
      if (!svgLibrary[folderPath]) {
        svgLibrary[folderPath] = [];
      }

      let loadedCount = 0;
      for (const file of svgFiles) {
        const exists = svgLibrary[folderPath].some(s => s.name === file.name);
        if (exists) continue;

        try {
          const content = await file.text();
          if (!content.includes('<svg') && !content.includes('<?xml')) continue;

          svgLibrary[folderPath].push({
            name: file.name,
            content: content,
            size: file.size,
            type: 'svg'
          });
          loadedCount++;
        } catch (error) {
          console.error('Error reading file:', file.name, error);
        }
      }

      saveLibrary();
      rebuildFlatList();
      refreshGallery();
      updateUI();
      showNotification(`✅ Loaded ${loadedCount} SVGs from "${folderName}"`, 'success');
    }
  });
}

// ===== START =====
setupApp();
