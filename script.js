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
    
    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.updateTransform();
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
    
    // Prevent context menu
    this.gridContainer.addEventListener('contextmenu', (e) => {
      e.preventDefault();
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
    };
    reader.readAsDataURL(file);
  }
  
  createGridItem(imageSrc, file) {
    const gridItem = document.createElement('div');
    gridItem.className = 'grid-item';
    
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
  }
  
  updateTransform() {
    this.imageGrid.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
  }
}

// Initialize the image grid when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new ImageGrid();
});
