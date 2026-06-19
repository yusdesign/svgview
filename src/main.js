import './style.css';
import javascriptLogo from './assets/javascript.svg';
import viteLogo from './assets/vite.svg';
import heroImg from './assets/hero.png';
import { setupCounter } from './counter.js';

// 🌇 svgiew functionality
let svgFiles = [];

// Check if running on native platform
const isNative = () => window?.Capacitor?.isNativePlatform?.() || false;

// Format file size
const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

// Check if file is SVG
const isSVG = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  return ext === 'svg' || ext === 'svgz';
};

// Render 🌇 svgview gallery
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
  filesize.textContent = formatSize(svgData.size);

  info.appendChild(filename);
  info.appendChild(filesize);
  card.appendChild(preview);
  card.appendChild(info);

  card.addEventListener('click', () => openFullscreen(svgData));
  return card;
}

// Fullscreen modal
function openFullscreen(svgData) {
  let modal = document.querySelector('.modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" aria-label="Close">✕</button>
        <div id="modal-body"></div>
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
  modalBody.innerHTML = svgData.content;
  modal.classList.add('active');
}

// File picker
async function pickFiles() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg,image/svg+xml';
    input.multiple = true;
    
    const files = await new Promise((resolve) => {
      input.onchange = (e) => resolve(e.target.files);
      input.click();
    });

    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!isSVG(file.name)) {
        console.warn('Skipping non-SVG file:', file.name);
        continue;
      }

      try {
        const content = await file.text();
        if (!content.includes('<svg') && !content.includes('<?xml')) {
          console.warn('Invalid SVG file:', file.name);
          continue;
        }

        svgFiles.push({
          name: file.name,
          content: content,
          size: file.size,
          type: 'svg'
        });
        
        // Show notification
        showNotification(`✅ Loaded: ${file.name}`);
      } catch (error) {
        console.error('Error reading file:', file.name, error);
      }
    }

    refreshGallery();
    updateUI();
  } catch (error) {
    console.error('Error picking files:', error);
    alert('Failed to pick files. Please check permissions.');
  }
}

// Notification system
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Refresh gallery
function refreshGallery() {
  const existingGallery = document.querySelector('#svg-gallery');
  const container = document.querySelector('#app');
  
  if (!existingGallery) {
    // Create gallery section if it doesn't exist
    const gallerySection = document.createElement('section');
    gallerySection.id = 'svg-gallery';
    gallerySection.innerHTML = `
      <div class="gallery-header">
        <h2>🌇 svgview gallery</h2>
        <div class="gallery-actions">
          <button id="pickFilesBtn" class="pick-files-btn">📂 Load SVGs</button>
          <span id="fileCount" class="file-count">0 files</span>
          <button id="clearGalleryBtn" class="clear-btn" title="Clear all">🗑️</button>
        </div>
      </div>
      <div id="gallery" class="gallery-grid"></div>
    `;
    
    // Insert after next-steps section
    const nextSteps = document.querySelector('#next-steps');
    if (nextSteps) {
      nextSteps.after(gallerySection);
    } else {
      container.appendChild(gallerySection);
    }
    
    // Add event listeners for gallery controls
    const pickBtn = document.querySelector('#pickFilesBtn');
    const clearBtn = document.querySelector('#clearGalleryBtn');
    
    if (pickBtn) {
      pickBtn.addEventListener('click', () => {
        if (isNative()) {
          nativePickFiles();
        } else {
          pickFiles();
        }
      });
    }
    
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        svgFiles = [];
        refreshGallery();
        updateUI();
        showNotification('🗑️ Gallery cleared');
      });
    }
  }
  
  const galleryContainer = document.querySelector('#gallery');
  if (!galleryContainer) return;
  
  galleryContainer.innerHTML = '';
  
  if (svgFiles.length === 0) {
    galleryContainer.innerHTML = `
      <div class="empty-gallery">
        <div class="empty-icon">📂</div>
        <h3>No SVG files loaded</h3>
        <p>Click "Load SVGs" to select SVG files from your device</p>
        <div class="demo-hint">
          <p>💡 Drag & drop SVG files here</p>
        </div>
      </div>
    `;
    return;
  }

  svgFiles.forEach((svgData) => {
    galleryContainer.appendChild(renderSVG(svgData));
  });
}

// Update UI counters
function updateUI() {
  const fileCount = document.querySelector('#fileCount');
  if (fileCount) {
    fileCount.textContent = `${svgFiles.length} files`;
  }
}

// Native picker for Capacitor
async function nativePickFiles() {
  try {
    // Import Capacitor dynamically
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    
    const result = await Filesystem.readdir({
      path: '',
      directory: Directory.Documents
    });

    const files = result.files.filter(f => isSVG(f.name));
    
    if (files.length === 0) {
      alert('No SVG files found in Documents folder');
      return;
    }

    for (const file of files) {
      const content = await Filesystem.readFile({
        path: file.name,
        directory: Directory.Documents,
        encoding: 'utf8'
      });

      svgFiles.push({
        name: file.name,
        content: content.data,
        size: file.size || 0,
        type: 'svg'
      });
    }

    refreshGallery();
    updateUI();
    showNotification(`✅ Loaded ${files.length} SVG files`);
  } catch (error) {
    console.error('Native picker failed:', error);
    // Fallback to web picker
    pickFiles();
  }
}

// Setup drag and drop
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

    let loadedCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!isSVG(file.name)) continue;

      try {
        const content = await file.text();
        if (!content.includes('<svg') && !content.includes('<?xml')) continue;

        svgFiles.push({
          name: file.name,
          content: content,
          size: file.size,
          type: 'svg'
        });
        loadedCount++;
      } catch (error) {
        console.error('Error reading dropped file:', file.name, error);
      }
    }

    refreshGallery();
    updateUI();
    if (loadedCount > 0) {
      showNotification(`✅ Loaded ${loadedCount} SVG files via drag & drop`);
    }
  });
}

// Main application setup
function setupApp() {
  // Set up the main HTML with Vite template
  document.querySelector('#app').innerHTML = `
    <section id="center">
      <div class="hero">
        <img src="${heroImg}" class="base" width="170" height="179">
        <img src="${javascriptLogo}" class="framework" alt="JavaScript logo"/>
        <img src="${viteLogo}" class="vite" alt="Vite logo" />
      </div>
      <div>
        <h1>🌇 svgview + Vite</h1>
        <p>Load and view SVG files with ease</p>
        <div class="quick-actions">
          <button id="quickLoadBtn" class="quick-load-btn">📂 Load SVG Files</button>
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

  // Setup counter
  setupCounter(document.querySelector('#counter'));

  // Add quick load button handler
  const quickLoadBtn = document.querySelector('#quickLoadBtn');
  if (quickLoadBtn) {
    quickLoadBtn.addEventListener('click', () => {
      if (isNative()) {
        nativePickFiles();
      } else {
        pickFiles();
      }
    });
  }

  // Setup drag and drop
  setupDragDrop();

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
      e.preventDefault();
      if (isNative()) {
        nativePickFiles();
      } else {
        pickFiles();
      }
    }
    if (e.key === 'Escape') {
      const modal = document.querySelector('.modal');
      if (modal && modal.classList.contains('active')) {
        modal.classList.remove('active');
      }
    }
  });

  // Initialize gallery
  refreshGallery();
  updateUI();

  // Check if running on native
  if (isNative()) {
    console.log('📱 Running on Capacitor native platform');
    // Load Capacitor plugins dynamically
    import('@capacitor/device').then(({ Device }) => {
      Device.getInfo().then(info => {
        console.log('📱 Device:', info.model, info.platform);
      }).catch(() => {});
    }).catch(() => {});
  } else {
    console.log('🌐 Running on web platform');
  }

  console.log('🌇 svgview + Vite initialized!');
  console.log('💡 Press ⌘O / Ctrl+O to load SVG files');
  console.log('📂 Drag & drop SVG files anywhere');
}

// Start the app
setupApp();
