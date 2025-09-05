class ImageGrid {
  constructor() {
    this.gridContainer = document.getElementById('gridContainer');
    this.imageGrid = document.getElementById('imageGrid');
    this.imageInput = document.getElementById('imageInput');
    this.addImageBtn = document.getElementById('addImageBtn');
    
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.lastPanX = 0;
    this.lastPanY = 0;
    this.draggedElement = null;
    this.dragOffset = { x: 0, y: 0 };
    this.contextMenu = null;
    this.selectedItem = null;
    this.imageCounter = 0;
    
    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.createContextMenu();
    this.loadSavedState();
    this.updateTransform();
  }
  
  // Save current state to localStorage
  saveState() {
    const images = [];
    const gridItems = this.imageGrid.querySelectorAll('.grid-item');
    
    gridItems.forEach(item => {
      const img = item.querySelector('img');
      if (img) {
        images.push({
          id: item.dataset.imageId,
          data: img.src,
          x: parseInt(item.style.left) || 0,
          y: parseInt(item.style.top) || 0,
          width: parseInt(item.style.width) || 200,
          height: parseInt(item.style.height) || 200,
          originalName: item.dataset.originalName || 'image'
        });
      }
    });
    
    const state = {
      images: images,
      gridState: {
        scale: this.scale,
        panX: this.panX,
        panY: this.panY
      }
    };
    
    localStorage.setItem('imageGridState', JSON.stringify(state));
  }
  
  // Load saved state from localStorage
  loadSavedState() {
    const savedState = localStorage.getItem('imageGridState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        
        // Restore grid state
        if (state.gridState) {
          this.scale = state.gridState.scale || 1;
          this.panX = state.gridState.panX || 0;
          this.panY = state.gridState.panY || 0;
        }
        
        // Restore images
        if (state.images && state.images.length > 0) {
          state.images.forEach(imageData => {
            this.restoreImage(imageData);
          });
        }
      } catch (error) {
        console.error('Error loading saved state:', error);
      }
    }
  }
  
  // Restore a single image from saved data
  restoreImage(imageData) {
    const gridItem = document.createElement('div');
    gridItem.className = 'grid-item';
    gridItem.dataset.imageId = imageData.id;
    gridItem.dataset.originalName = imageData.originalName;
    
    const img = document.createElement('img');
    img.src = imageData.data;
    img.alt = 'Grid image';
    
    // Set position and size
    gridItem.style.position = 'absolute';
    gridItem.style.left = imageData.x + 'px';
    gridItem.style.top = imageData.y + 'px';
    gridItem.style.width = imageData.width + 'px';
    gridItem.style.height = imageData.height + 'px';
    gridItem.style.margin = '0';
    
    gridItem.appendChild(img);
    this.imageGrid.appendChild(gridItem);
    this.setupDragAndDrop(gridItem);
    
    // Update counter to avoid ID conflicts
    const idNum = parseInt(imageData.id.replace('img_', ''));
    if (idNum >= this.imageCounter) {
      this.imageCounter = idNum + 1;
    }
  }
  
  createContextMenu() {
    this.contextMenu = document.createElement('div');
    this.contextMenu.className = 'context-menu';
    this.contextMenu.innerHTML = `
      <div class="context-menu-title">Config</div>
      <div class="context-menu-items">
        <div class="context-menu-item" data-action="resize">Resize</div>
        <div class="context-menu-item danger" data-action="delete">Delete</div>
      </div>
    `;
    document.body.appendChild(this.contextMenu);
    
    // Add click handlers for menu items
    this.contextMenu.addEventListener('click', (e) => {
      const action = e.target.getAttribute('data-action');
      if (action && this.selectedItem) {
        this.handleContextMenuAction(action, this.selectedItem);
      }
      this.hideContextMenu();
    });
  }
  
  handleContextMenuAction(action, item) {
    switch (action) {
      case 'resize':
        this.resizeImage(item);
        break;
      case 'delete':
        this.deleteImage(item);
        break;
    }
  }
  
  resizeImage(item) {
    const currentSize = parseInt(item.style.width) || 200;
    const newSize = prompt(`Enter new size (current: ${currentSize}px):`, currentSize);
    
    if (newSize && !isNaN(newSize) && newSize > 0) {
      const size = Math.max(50, Math.min(500, parseInt(newSize))); // Limit between 50-500px
      item.style.width = size + 'px';
      item.style.height = size + 'px';
      this.updateGridLayout();
      this.saveState(); // Save after resize
    }
  }
  
  deleteImage(item) {
    if (confirm('Are you sure you want to delete this image?')) {
      item.remove();
      this.updateGridLayout();
      this.saveState(); // Save after deletion
    }
  }
  
  showContextMenu(e, item) {
    e.preventDefault();
    this.selectedItem = item;
    
    this.contextMenu.style.left = e.clientX + 'px';
    this.contextMenu.style.top = e.clientY + 'px';
    this.contextMenu.classList.add('show');
  }
  
  hideContextMenu() {
    this.contextMenu.classList.remove('show');
    this.selectedItem = null;
  }
  
  setupEventListeners() {
    // File input
    this.addImageBtn.addEventListener('click', () => {
      this.imageInput.click();
    });
    
    this.imageInput.addEventListener('change', (e) => {
      this.handleFileSelect(e);
    });
    
    // Pan functionality
    this.gridContainer.addEventListener('mousedown', (e) => {
      if (e.target === this.gridContainer || e.target === this.imageGrid) {
        this.startPan(e);
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.pan(e);
      }
    });
    
    document.addEventListener('mouseup', () => {
      this.endPan();
    });
    
    // Zoom functionality
    this.gridContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom(e);
    });
    
    // Hide context menu when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });
    
    // Prevent context menu on grid container
    this.gridContainer.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    
    // Save state when page is about to unload
    window.addEventListener('beforeunload', () => {
      this.saveState();
    });
  }
  
  handleFileSelect(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        this.addImage(file);
      }
    });
    // Reset input
    e.target.value = '';
  }
  
  addImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const gridItem = this.createGridItem(e.target.result, file);
      this.imageGrid.appendChild(gridItem);
      this.setupDragAndDrop(gridItem);
      this.saveState(); // Save after adding new image
    };
    reader.readAsDataURL(file);
  }
  
  createGridItem(imageSrc, file) {
    const gridItem = document.createElement('div');
    gridItem.className = 'grid-item';
    
    // Generate unique ID for this image
    const imageId = `img_${this.imageCounter++}`;
    gridItem.dataset.imageId = imageId;
    gridItem.dataset.originalName = file.name || 'image';
    
    const img = document.createElement('img');
    img.src = imageSrc;
    img.alt = 'Grid image';
    
    // Calculate size based on image resolution
    img.onload = () => {
      const baseSize = 200; // Base grid cell size
      const minSize = 100;  // Minimum size
      const maxSize = 400;  // Maximum size
      
      // Calculate total pixels
      const totalPixels = img.naturalWidth * img.naturalHeight;
      
      // Calculate size multiplier based on resolution
      // Higher resolution = larger size
      let sizeMultiplier = 1;
      if (totalPixels > 0) {
        // Use logarithmic scale to prevent extremely large images
        sizeMultiplier = Math.log10(totalPixels / 100000) + 1;
        sizeMultiplier = Math.max(0.5, Math.min(2, sizeMultiplier)); // Clamp between 0.5x and 2x
      }
      
      const calculatedSize = Math.round(baseSize * sizeMultiplier);
      const finalSize = Math.max(minSize, Math.min(maxSize, calculatedSize));
      
      // Set the grid item size
      gridItem.style.width = finalSize + 'px';
      gridItem.style.height = finalSize + 'px';
      
      // Update grid layout if needed
      this.updateGridLayout();
    };
    
    gridItem.appendChild(img);
    
    return gridItem;
  }
  
  updateGridLayout() {
    // Force grid to recalculate layout
    this.imageGrid.style.display = 'none';
    this.imageGrid.offsetHeight; // Trigger reflow
    this.imageGrid.style.display = 'grid';
  }
  
  setupDragAndDrop(element) {
    element.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.startDrag(e, element);
    });
    
    // Add right-click context menu
    element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showContextMenu(e, element);
    });
  }
  
  startDrag(e, element) {
    this.draggedElement = element;
    element.classList.add('dragging');
    
    const rect = element.getBoundingClientRect();
    const gridRect = this.imageGrid.getBoundingClientRect();
    
    this.dragOffset.x = e.clientX - rect.left;
    this.dragOffset.y = e.clientY - rect.top;
    
    document.addEventListener('mousemove', this.handleDrag.bind(this));
    document.addEventListener('mouseup', this.endDrag.bind(this));
  }
  
  handleDrag(e) {
    if (!this.draggedElement) return;
    
    e.preventDefault();
    
    const gridRect = this.imageGrid.getBoundingClientRect();
    const x = (e.clientX - gridRect.left - this.dragOffset.x) / this.scale;
    const y = (e.clientY - gridRect.top - this.dragOffset.y) / this.scale;
    
    this.draggedElement.style.position = 'absolute';
    this.draggedElement.style.left = x + 'px';
    this.draggedElement.style.top = y + 'px';
    this.draggedElement.style.margin = '0';
  }
  
  endDrag() {
    if (this.draggedElement) {
      this.draggedElement.classList.remove('dragging');
      this.draggedElement = null;
      this.saveState(); // Save after drag ends
    }
    
    document.removeEventListener('mousemove', this.handleDrag.bind(this));
    document.removeEventListener('mouseup', this.endDrag.bind(this));
  }
  
  startPan(e) {
    this.isPanning = true;
    this.gridContainer.classList.add('panning');
    this.lastPanX = e.clientX;
    this.lastPanY = e.clientY;
  }
  
  pan(e) {
    if (!this.isPanning) return;
    
    const deltaX = e.clientX - this.lastPanX;
    const deltaY = e.clientY - this.lastPanY;
    
    // No pan limits - free movement
    this.panX += deltaX;
    this.panY += deltaY;
    
    this.lastPanX = e.clientX;
    this.lastPanY = e.clientY;
    
    this.updateTransform();
  }
  
  endPan() {
    this.isPanning = false;
    this.gridContainer.classList.remove('panning');
    this.saveState(); // Save after pan ends
  }
  
  zoom(e) {
    const rect = this.gridContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.25, Math.min(5, this.scale * zoomFactor));
    
    // Calculate zoom point relative to current pan
    const zoomPointX = (mouseX - this.panX) / this.scale;
    const zoomPointY = (mouseY - this.panY) / this.scale;
    
    // Adjust pan to zoom towards mouse position
    this.panX = mouseX - zoomPointX * newScale;
    this.panY = mouseY - zoomPointY * newScale;
    
    this.scale = newScale;
    this.updateTransform();
    this.saveState(); // Save after zoom
  }
  
  updateTransform() {
    this.imageGrid.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
  }
}

// Initialize the image grid when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new ImageGrid();
});
