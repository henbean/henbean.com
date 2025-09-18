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
    this.contextMenu = null;
    this.selectedItem = null;
    this.imageCounter = 0;
    this.rulers = false;
    this.initialDragX = 0;
    this.initialDragY = 0;
    this.dragThreshold = 5;
    this.isDraggingImage = false;
    this.draggedDistance = 0;
    this.draggedElement = null;
    this.dragOffset = { x: 0, y: 0 };
    
    this.boundHandleDrag = this.handleDrag.bind(this);
    this.boundEndDrag = this.endDrag.bind(this);
    
    this.fixedContentHeight = 0;
    this.dynamicContentOffsetY = 0;
    this.imagesLoading = 0;
    
    this.DEFAULT_GRID_HEIGHT = 1500;
    this.gridHeight = this.DEFAULT_GRID_HEIGHT; //overriden by images.json

    this.zIndexCounter = 10;
    this.BASE_IMAGE_DIMENSION = 400; // for scale calculation
    
    this.rulerX = document.createElement('div');
    this.rulerX.className = 'ruler-x';
    document.body.appendChild(this.rulerX);
    
    this.rulerY = document.createElement('div');
    this.rulerY.className = 'ruler-y';
    document.body.appendChild(this.rulerY);
    
    this.profilePic = document.querySelector('.profile-pic');
    this.profileDropdown = document.querySelector('.profile-dropdown');

    this.modalOverlay = document.getElementById('modalOverlay');
    this.modalTitle = document.getElementById('modalTitle');
    this.modalText = document.getElementById('modalText');
    this.closeModalBtn = document.getElementById('closeModal');

    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.createContextMenu();
    this.loadImages();
    this.updateTransform();
    if (this.profileDropdown) {
      this.profileDropdown.classList.remove('show');
    }
    this.imageGrid.addEventListener('allImagesLoaded', this.onAllImagesLoaded.bind(this));
  }
  
  async loadImages() {
    try {
      const response = await fetch('images.json');
      if (response.ok) {
        const data = await response.json();
        
        if (data.gridState) {
          this.scale = data.gridState.scale || 1;
          this.panX = data.gridState.panX || 0;
          this.panY = data.gridState.panY || 0;
          this.gridHeight = data.gridState.gridHeight || this.DEFAULT_GRID_HEIGHT;
          this.imageGrid.style.minHeight = this.gridHeight + 'px';
        }
        
        if (data.images && data.images.length > 0) {
          data.images.forEach(imageData => {
            this.imagesLoading++;
            this.restoreImages(imageData);
          });
        }
      } else {
        console.log('No images.json found, starting with empty grid');
      }
    } catch (error) {
      console.error('Error loading images:', error);
    }
  }
  
  updateRulersUI() {
    if (this.rulers) {
      document.body.classList.add('rulers-enabled');
    } else {
      document.body.classList.remove('rulers-enabled');
      this.hideRulers();
    }
    const rulersCheckbox = this.contextMenu.querySelector('[data-action="toggleRulers"]');
    if (rulersCheckbox) {
      rulersCheckbox.checked = this.rulers;
    }
  }
  
  restoreImages(imageData) {
    const gridItem = document.createElement('div');
    gridItem.className = 'grid-item';
    gridItem.dataset.imageId = imageData.id;
    gridItem.dataset.originalName = imageData.originalName;
    gridItem.dataset.title = imageData.title || 'Untitled';
    gridItem.dataset.description = imageData.description || 'No description available.';
    gridItem.dataset.x = imageData.x;
    gridItem.dataset.y = imageData.y;
    gridItem.dataset.scale = imageData.scale || 1;
    gridItem.dataset.fixedToTop = imageData.fixedToTop || false;
    
    const img = document.createElement('img');
    img.src = `images/${imageData.filename}`;
    img.alt = 'Grid image';
    
    gridItem.style.position = 'absolute';
    gridItem.style.left = imageData.x + 'px';
    gridItem.style.top = imageData.y + 'px';
    
    gridItem.appendChild(img);
    this.imageGrid.appendChild(gridItem);
    this.setupDragAndDrop(gridItem);
    
    const infoOverlay = document.createElement('div');
    infoOverlay.className = 'grid-item-info-overlay';
    infoOverlay.innerHTML = `
      <h4 class="grid-item-title">${imageData.title || 'Untitled'}</h4>
      <p class="grid-item-description">${imageData.description || 'No description available.'}</p>
    `;
    gridItem.appendChild(infoOverlay);

    img.onload = () => {
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      const aspectRatio = naturalWidth / naturalHeight;

      let newWidth = 0;
      let newHeight = 0;
      const currentScale = parseFloat(gridItem.dataset.scale);

      if (naturalWidth > naturalHeight) {
        newWidth = this.BASE_IMAGE_DIMENSION * currentScale;
        newHeight = newWidth / aspectRatio;
      } else {
        newHeight = this.BASE_IMAGE_DIMENSION * currentScale;
        newWidth = newHeight * aspectRatio;
      }

      gridItem.style.width = newWidth + 'px';
      gridItem.style.height = newHeight + 'px';
      
      this.imagesLoading--;
      if (this.imagesLoading === 0) {
        this.imageGrid.dispatchEvent(new Event('allImagesLoaded'));
      }
    };

    gridItem.addEventListener('click', (e) => {
      if (this.draggedDistance > this.dragThreshold) {
        e.stopPropagation();
        this.draggedDistance = 0;
        return;
      }
      if (e.target.tagName !== 'A' && !this.isDraggingImage) {
        infoOverlay.classList.toggle('show');
      }
    });

    const idNum = parseInt(imageData.id.replace('img_', ''));
    if (idNum >= this.imageCounter) {
      this.imageCounter = idNum + 1;
    }
    
    gridItem.addEventListener('mouseover', () => {
      if (this.rulers) {
        this.updateRulers(gridItem);
      }
    });
    
    gridItem.addEventListener('mousemove', (e) => {
      if (this.rulers) {
        this.updateRulers(gridItem);
      }
    });
    
    gridItem.addEventListener('mouseout', () => {
      if (this.rulers) {
        this.hideRulers();
      }
    });
  }
  
  calculateFixedContentHeight() {
    this.fixedContentHeight = 0;
    const fixedItems = Array.from(this.imageGrid.querySelectorAll('.grid-item[data-fixed-to-top="true"]'));
    fixedItems.forEach(item => {
      const img = item.querySelector('img');
      if (img && img.complete) {
        this.fixedContentHeight += item.offsetHeight;
      } else if (img) {
        img.onload = () => {
          this.fixedContentHeight += item.offsetHeight;
        };
      }
    });
  }
  
  onAllImagesLoaded() {
    console.log('All images have loaded. Calculating fixed content height and dynamic offset.');
    this.fixedContentHeight = 0;
    let maxDynamicY = 0;

    const allGridItems = Array.from(this.imageGrid.querySelectorAll('.grid-item'));

    allGridItems.forEach(item => {
      if (item.dataset.fixedToTop === 'true') {
        this.fixedContentHeight += item.offsetHeight;
      } else {
        const itemTop = parseFloat(item.style.top) || 0;
        const itemHeight = item.offsetHeight;
        const distanceFromBottom = this.gridHeight - (itemTop + itemHeight);
        item.dataset.distanceFromBottom = distanceFromBottom;
        maxDynamicY = Math.max(maxDynamicY, itemTop + itemHeight);
      }
    });
    
    this.dynamicContentOffsetY = this.fixedContentHeight + 20;
    
    allGridItems.forEach(item => {
      if (item.dataset.fixedToTop !== 'true') {
        const currentDistanceFromBottom = parseFloat(item.dataset.distanceFromBottom) || 0;
        const newY = this.gridHeight - item.offsetHeight - currentDistanceFromBottom;

        item.style.top = Math.max(this.fixedContentHeight, newY) + 'px';
        item.dataset.y = parseFloat(item.style.top);
      }
    });
    this.updateGridLayout();
  }
  
  setGridHeight(newHeight) {
    const oldGridHeight = this.gridHeight;
    this.gridHeight = Math.max(newHeight, this.fixedContentHeight + 100);
    this.imageGrid.style.minHeight = this.gridHeight + 'px';

    Array.from(this.imageGrid.querySelectorAll('.grid-item')).forEach(item => {
      if (item.dataset.fixedToTop !== 'true') {
        const currentDistanceFromBottom = parseFloat(item.dataset.distanceFromBottom) || 0;
        
        const newY = this.gridHeight - item.offsetHeight - currentDistanceFromBottom;

        item.style.top = Math.max(this.fixedContentHeight, newY) + 'px';
        item.dataset.y = parseFloat(item.style.top);
      }
    });
    this.updateGridLayout();
  }
  
  createContextMenu() {
    this.contextMenu = document.createElement('div');
    this.contextMenu.className = 'context-menu';
    this.contextMenu.innerHTML = `
      <div class="context-menu-items">
        <div class="context-menu-item" data-action="scale" style="display: none;">scale</div>
        <div class="context-menu-item" data-action="addImage">add image</div>
        <div class="context-menu-item" data-action="setGridHeight">grid height</div>
        <label class="context-menu-item context-menu-item-rulers">
          <span>rulers</span>
          <input type="checkbox" data-action="toggleRulers" ${this.rulers ? 'checked' : ''}>
        </label>
        <div class="context-menu-item danger" data-action="delete" style="display: none;">delete</div>
      </div>
    `;
    document.body.appendChild(this.contextMenu);
    
    this.contextMenu.addEventListener('click', (e) => {
      const target = e.target;
      const action = target.getAttribute('data-action');
      if (action) {
        if (action === 'toggleRulers') {
          this.handleContextMenuAction(action, null);
          e.stopPropagation(); 
        } else if (action === 'addImage') {
          this.handleContextMenuAction(action, null);
        } else if (action === 'setGridHeight') {
          this.handleContextMenuAction(action, null);
        } else if (this.selectedItem) { 
          this.handleContextMenuAction(action, this.selectedItem);
        }
      }
    });
  }
  
  handleContextMenuAction(action, item) {
    switch (action) {
      case 'scale':
        this.scaleImage(item);
        break;
      case 'delete':
        this.deleteImage(item);
        break;
      case 'toggleRulers':
        this.toggleRulers();
        break;
      case 'addImage':
        this.imageInput.click();
        break;
      case 'setGridHeight':
        this.promptForGridHeight();
        break;
    }
  }
  
  toggleRulers() {
    this.rulers = !this.rulers;
    this.updateRulersUI();
  }
  
  promptForGridHeight() {
    const currentHeight = this.gridHeight;
    const newHeightStr = prompt(`Enter new grid height (current: ${currentHeight}px):`, currentHeight);

    if (newHeightStr !== null) {
      const newHeight = parseInt(newHeightStr);
      if (!isNaN(newHeight) && newHeight >= this.fixedContentHeight + 100) {
        this.setGridHeight(newHeight);
      } else {
        alert(`Please enter a valid number for grid height (minimum: ${this.fixedContentHeight + 100}px).`);
      }
    }
  }
  
  scaleImage(item) {
    const currentScale = parseFloat(item.dataset.scale) || 1;
    const newScaleStr = prompt(`Enter new scale (current: ${currentScale}):`, currentScale);
    
    if (newScaleStr !== null) {
      const newScale = parseFloat(newScaleStr);
      if (!isNaN(newScale) && newScale > 0.1 && newScale < 10) {
        item.dataset.scale = newScale;
        
        const imgElement = item.querySelector('img');
        if (imgElement) {
          const naturalWidth = imgElement.naturalWidth;
          const naturalHeight = imgElement.naturalHeight;
          const aspectRatio = naturalWidth / naturalHeight;

          let newWidth = 0;
          let newHeight = 0;

          if (naturalWidth > naturalHeight) {
            newWidth = this.BASE_IMAGE_DIMENSION * newScale;
            newHeight = newWidth / aspectRatio;
          } else {
            newHeight = this.BASE_IMAGE_DIMENSION * newScale;
            newWidth = newHeight * aspectRatio;
          }

          item.style.width = newWidth + 'px';
          item.style.height = newHeight + 'px';
        }
        this.updateGridLayout();
      } else {
        alert('Please enter a valid number for scale (e.g., 0.5 to 10).');
      }
    }
  }
  
  deleteImage(item) {
    if (confirm('Are you sure you want to delete this image?')) {
      item.remove();
      this.updateGridLayout();
    }
  }
  
  showContextMenu(e, item) {
    e.preventDefault();
    this.selectedItem = item;
    
    const scaleItem = this.contextMenu.querySelector('[data-action="scale"]');
    const deleteItem = this.contextMenu.querySelector('[data-action="delete"]');

    if (item) {
      scaleItem.style.display = 'block';
      deleteItem.style.display = 'block';
    } else {
      scaleItem.style.display = 'none';
      deleteItem.style.display = 'none';
    }

    this.contextMenu.style.left = e.clientX + 'px';
    this.contextMenu.style.top = e.clientY + 'px';
    this.contextMenu.classList.add('show');
  }
  
  hideContextMenu() {
    this.contextMenu.classList.remove('show');
    this.selectedItem = null;
  }
  
  openModal(title) {
    this.modalTitle.textContent = title;
    let content = "theres nothing here";

    if (title === "Socials") {
      content = `
        <ul>
          <li><a href="https://pinterest.com/hen_bean/_profile" target="_blank">pinterest.com/hen_bean/_profile</a></li>
          <li><a href="https://github.com/henbean" target="_blank">github.com/henbean</a></li>
          <li><a href="https://x.com/hen__bean" target="_blank">twitter.com/hen__bean</a></li>
          <li><a href="https://www.instagram.com/hen_bean/" target="_blank">instagram.com/hen_bean</a></li>
          <li><a href="https://bsky.app/profile/henbean.bsky.social" target="_blank">bsky.app/profile/henbean.bsky.social</a></li>
          <li><a href="https://www.youtube.com/channel/UCgAfQgM16ddHpCBBfIv70eg" target="_blank">youtube.com/channel/UCgAfQgM16ddHpCBBfIv70eg</a></li>
        </ul>
      `;
    } else if (title === "Commissions") {
      content = `
        <p>if your interested, drop an email at henbean@henbean.com</p>
      `;
    } else if (title === "Contact") {
      content = `
        <p>you can reach me at henbean@henbean.com</p>
      `;
    }

    this.modalText.innerHTML = content;
    this.modalOverlay.classList.add('show');
    document.body.classList.add('modal-open');
  }

  closeModal() {
    this.modalOverlay.classList.remove('show');
    document.body.classList.remove('modal-open');
  }

  setupEventListeners() {
    this.imageInput.addEventListener('change', (e) => {
      this.handleFileSelect(e);
    });
    
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
    
    this.gridContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom(e);
    });
    
    document.addEventListener('click', (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });
    
    this.gridContainer.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!e.target.closest('.grid-item')) {
        this.showContextMenu(e, null);
      }
    });
    
    const header = document.querySelector('.container');
    if (header) {
      header.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });
    }
    
    this.profilePic.addEventListener('click', (e) => {
      e.stopPropagation();
      this.profileDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!this.profileDropdown.contains(e.target) && !this.profilePic.contains(e.target)) {
        this.profileDropdown.classList.remove('show');
      }
    });
    
    const dropdownItems = this.profileDropdown.querySelectorAll('.profile-dropdown-item');
    dropdownItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const action = e.target.textContent;
        this.openModal(action);
        this.profileDropdown.classList.remove('show');
      });
    });

    this.closeModalBtn.addEventListener('click', () => this.closeModal());
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) {
        this.closeModal();
      }
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalOverlay.classList.contains('show')) {
        this.closeModal();
      }
    });
  }
  
  handleFileSelect(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        this.addImage(file);
      }
    });
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
    
    const imageId = `img_${this.imageCounter++}`;
    const filename = `${imageId}_${file.name}`;
    gridItem.dataset.imageId = imageId;
    gridItem.dataset.filename = filename;
    gridItem.dataset.originalName = file.name || 'image.png';
    gridItem.dataset.title = file.name || 'title';
    gridItem.dataset.description = 'description';
    gridItem.dataset.x = 0;
    gridItem.dataset.y = 0;
    gridItem.dataset.scale = 1;
    gridItem.dataset.fixedToTop = false;
    
    const img = document.createElement('img');
    img.src = imageSrc;
    img.alt = 'Grid image';
    
    const initialX = 0;
    const initialY = this.dynamicContentOffsetY;
    gridItem.style.position = 'absolute';
    gridItem.style.left = initialX + 'px';
    gridItem.style.top = initialY + 'px';
    gridItem.style.margin = '0';
    gridItem.dataset.x = initialX;
    gridItem.dataset.y = initialY;
    
    gridItem.appendChild(img);
    
    const infoOverlay = document.createElement('div');
    infoOverlay.className = 'grid-item-info-overlay';
    infoOverlay.innerHTML = `
      <h4 class="grid-item-title">${file.name || 'Untitled'}</h4>
      <p class="grid-item-description">No description available.</p>
    `;
    gridItem.appendChild(infoOverlay);

    img.onload = () => {
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      const aspectRatio = naturalWidth / naturalHeight;

      let newWidth = 0;
      let newHeight = 0;
      const currentScale = parseFloat(gridItem.dataset.scale);

      if (naturalWidth > naturalHeight) {
        newWidth = this.BASE_IMAGE_DIMENSION * currentScale;
        newHeight = newWidth / aspectRatio;
      } else {
        newHeight = this.BASE_IMAGE_DIMENSION * currentScale;
        newWidth = newHeight * aspectRatio;
      }

      gridItem.style.width = newWidth + 'px';
      gridItem.style.height = newHeight + 'px';
      
      if (gridItem.dataset.fixedToTop !== 'true') {
        const newImageHeight = gridItem.offsetHeight;
        const padding = 20;

        gridItem.dataset.distanceFromBottom = this.gridHeight - (initialY + newImageHeight);
        
        this.dynamicContentOffsetY = this.fixedContentHeight + padding;
        this.updateGridLayout();
      }
    };

    gridItem.addEventListener('click', (e) => {
      if (this.draggedDistance > this.dragThreshold) {
        e.stopPropagation();
        this.draggedDistance = 0;
        return;
      }
      if (e.target.tagName !== 'A' && !this.isDraggingImage) {
        infoOverlay.classList.toggle('show');
      }
    });

    gridItem.addEventListener('mouseover', () => {
      if (this.rulers) {
        this.updateRulers(gridItem);
      }
    });
    
    gridItem.addEventListener('mousemove', (e) => {
      if (this.rulers) {
        this.updateRulers(gridItem);
      }
    });
    
    gridItem.addEventListener('mouseout', () => {
      if (this.rulers) {
        this.hideRulers();
      }
    });
    
    return gridItem;
  }
  
  hideRulers() {
    this.rulerX.style.display = 'none';
    this.rulerY.style.display = 'none';
  }
  
  updateRulers(gridItem) {
    const rect = gridItem.getBoundingClientRect();
    const gridRect = this.imageGrid.getBoundingClientRect();
    
    const gridX = Math.round((rect.left - gridRect.left) / this.scale);
    const gridY = Math.round((rect.top - gridRect.top) / this.scale);
    const gridWidth = Math.round(rect.width / this.scale);
    const gridHeight = Math.round(rect.height / this.scale);
    
    this.rulerX.style.left = rect.left + 'px';
    this.rulerX.style.top = rect.top + 'px';
    this.rulerX.style.width = `calc(100vw - ${rect.left}px)`;
    this.rulerX.setAttribute('data-value', `X: ${gridX}px, Width: ${gridWidth}px`);
    this.rulerX.style.display = 'block';
    
    this.rulerY.style.left = rect.left + 'px';
    this.rulerY.style.top = rect.top + 'px';
    this.rulerY.style.height = `calc(100vh - ${rect.top}px)`;
    this.rulerY.setAttribute('data-value', `Y: ${gridY}px, Height: ${gridHeight}px`);
    this.rulerY.style.display = 'block';
  }
  
  updateGridLayout() {
    this.imageGrid.style.display = 'none';
    this.imageGrid.offsetHeight;
    this.imageGrid.style.display = 'grid';
  }
  
  setupDragAndDrop(element) {
    element.style.cursor = 'grab';
    element.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (e.target.tagName === 'IMG') {
        this.startDrag(e, element);
      }
    });
    
    element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showContextMenu(e, element);
    });
  }
  
  startDrag(e, element) {
    this.draggedElement = element;
    element.classList.add('dragging');
    
    this.draggedElement.style.zIndex = this.zIndexCounter++;
    this.isDraggingImage = true;
    this.initialDragX = e.clientX;
    this.initialDragY = e.clientY;
    this.draggedDistance = 0;
    
    const gridContainerRect = this.gridContainer.getBoundingClientRect();
    
    const currentGridItemX = parseFloat(element.dataset.x) || 0;
    const currentGridItemY = parseFloat(element.dataset.y) || 0;
 
    const mouseXInGridCoords = (e.clientX - gridContainerRect.left - this.panX) / this.scale;
    const mouseYInGridCoords = (e.clientY - gridContainerRect.top - this.panY) / this.scale;
 
    this.dragOffset.x = mouseXInGridCoords - currentGridItemX;
    this.dragOffset.y = mouseYInGridCoords - currentGridItemY;
    
    document.addEventListener('mousemove', this.boundHandleDrag);
    document.addEventListener('mouseup', this.boundEndDrag);
  }
  
  handleDrag(e) {
    if (!this.draggedElement) return;
    
    e.preventDefault();
    
    const gridContainerRect = this.gridContainer.getBoundingClientRect();
    
    const mouseXInGridCoords = (e.clientX - gridContainerRect.left - this.panX) / this.scale;
    const mouseYInGridCoords = (e.clientY - gridContainerRect.top - this.panY) / this.scale;
 
    const newLeft = mouseXInGridCoords - this.dragOffset.x;
    const newTop = mouseYInGridCoords - this.dragOffset.y;
    
    this.draggedDistance += Math.sqrt(e.movementX**2 + e.movementY**2);

    this.draggedElement.style.position = 'absolute';
    this.draggedElement.style.left = newLeft + 'px';
    this.draggedElement.style.top = newTop + 'px';
    this.draggedElement.style.margin = '0';
    
    this.draggedElement.dataset.x = newLeft;
    this.draggedElement.dataset.y = newTop;
  }
  
  endDrag() {
    if (this.draggedElement) {
      this.draggedElement.classList.remove('dragging');
      
      this.draggedElement.style.zIndex = this.zIndexCounter++;
      
      this.draggedElement = null;
      this.isDraggingImage = false;
      
      if (this.draggedElement.dataset.fixedToTop !== 'true') {
        const newY = parseFloat(this.draggedElement.style.top) || 0;
        const newHeight = this.draggedElement.offsetHeight;
        this.draggedElement.dataset.distanceFromBottom = this.gridHeight - (newY + newHeight);
      }
    }
    
    document.removeEventListener('mousemove', this.boundHandleDrag);
    document.removeEventListener('mouseup', this.boundEndDrag);
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
    
    const zoomPointX = (mouseX - this.panX) / this.scale;
    const zoomPointY = (mouseY - this.panY) / this.scale;
    
    this.panX = mouseX - zoomPointX * newScale;
    this.panY = mouseY - zoomPointY * newScale;
    
    this.scale = newScale;
    this.updateTransform();
  }
  
  updateTransform() {
    this.imageGrid.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.imageGrid = new ImageGrid();
});
