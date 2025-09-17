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
    this.devMode = false; // Add devMode state
    this.isDraggingImage = false; // Flag to differentiate click from drag
    this.draggedDistance = 0; // Track distance dragged
    this.initialDragX = 0;
    this.initialDragY = 0;
    this.dragThreshold = 5; // Minimum pixels to consider it a drag
    this.wasDragged = false; // Flag to prevent click after drag
    
    this.fixedContentHeight = 0; // Tracks the cumulative height of fixed-to-top images
    this.dynamicContentOffsetY = 0; // Offset for new images added below fixed content
    this.imagesLoading = 0; // Counter for images still loading
    
    this.DEFAULT_GRID_HEIGHT = 2000; // grid height
    this.gridHeight = this.DEFAULT_GRID_HEIGHT; // Current grid height

    // For managing z-index of overlapping images
    this.zIndexCounter = 10;
    this.BASE_IMAGE_DIMENSION = 400; // Define a base dimension for scale calculation
    
    // Global rulers for dev mode
    this.rulerX = document.createElement('div');
    this.rulerX.className = 'ruler-x';
    document.body.appendChild(this.rulerX);
    
    this.rulerY = document.createElement('div');
    this.rulerY.className = 'ruler-y';
    document.body.appendChild(this.rulerY);
    
    this.profilePic = document.querySelector('.profile-pic');
    this.profileDropdown = document.querySelector('.profile-dropdown');

    // Modal elements
    this.modalOverlay = document.getElementById('modalOverlay');
    this.modalTitle = document.getElementById('modalTitle');
    this.modalText = document.getElementById('modalText');
    this.closeModalBtn = document.getElementById('closeModal');

    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.createContextMenu();
    this.loadImagesFromServer();
    this.updateTransform();
    // Ensure profile dropdown is hidden on initialization
    if (this.profileDropdown) {
      this.profileDropdown.classList.remove('show');
    }
    this.imageGrid.style.minHeight = this.gridHeight + 'px'; // Set initial grid height
    this.imageGrid.addEventListener('allImagesLoaded', this.onAllImagesLoaded.bind(this));
  }
  
  // Load images from the server's JSON file
  async loadImagesFromServer() {
    try {
      const response = await fetch('images.json');
      if (response.ok) {
        const data = await response.json();
        
        // Restore grid state
        if (data.gridState) {
          this.scale = data.gridState.scale || 1;
          this.panX = data.gridState.panX || 0;
          this.panY = data.gridState.panY || 0;
        }
        
        // Restore images
        if (data.images && data.images.length > 0) {
          data.images.forEach(imageData => {
            this.imagesLoading++; // Increment counter for each image
            this.restoreImageFromServer(imageData);
          });
        }
      } else {
        console.log('No images.json found, starting with empty grid');
      }
    } catch (error) {
      console.error('Error loading images from server:', error);
    }
  }
  
  updateDevModeUI() {
    if (this.devMode) {
      document.body.classList.add('dev-mode-enabled');
    } else {
      document.body.classList.remove('dev-mode-enabled');
      this.hideRulers(); // Hide rulers when dev mode is disabled
    }
    // Update context menu item text
    const devModeCheckbox = this.contextMenu.querySelector('[data-action="toggleDevMode"]');
    if (devModeCheckbox) {
      devModeCheckbox.checked = this.devMode;
    }
  }
  
  // Restore a single image from server data
  restoreImageFromServer(imageData) {
    const gridItem = document.createElement('div');
    gridItem.className = 'grid-item';
    gridItem.dataset.imageId = imageData.id;
    gridItem.dataset.originalName = imageData.originalName;
    gridItem.dataset.title = imageData.title || 'Untitled';
    gridItem.dataset.description = imageData.description || 'No description available.';
    gridItem.dataset.x = imageData.x; // Store initial x
    gridItem.dataset.y = imageData.y; // Store initial y
    gridItem.dataset.scale = imageData.scale || 1; // Store initial scale
    gridItem.dataset.fixedToTop = imageData.fixedToTop || false; // Store fixedToTop status
    
    const img = document.createElement('img');
    img.src = `images/${imageData.filename}`; // Load from images folder
    img.alt = 'Grid image';
    
    // Set position and size
    gridItem.style.position = 'absolute';
    gridItem.style.left = imageData.x + 'px';
    gridItem.style.top = imageData.y + 'px';
    
    gridItem.appendChild(img);
    this.imageGrid.appendChild(gridItem);
    this.setupDragAndDrop(gridItem);
    
    // Add info overlay
    const infoOverlay = document.createElement('div');
    infoOverlay.className = 'grid-item-info-overlay';
    infoOverlay.innerHTML = `
      <h4 class="grid-item-title">${imageData.title || 'Untitled'}</h4>
      <p class="grid-item-description">${imageData.description || 'No description available.'}</p>
    `;
    gridItem.appendChild(infoOverlay);

    // Adjust info overlay size and position after image loads
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
      
      // Removed z-index for fixed images as per user request
      this.imagesLoading--; // Decrement counter
      if (this.imagesLoading === 0) {
        this.imageGrid.dispatchEvent(new Event('allImagesLoaded'));
      }
    };
    
    gridItem.addEventListener('click', (e) => {
      if (e.target.tagName !== 'A' && !this.isDraggingImage && !this.wasDragged) { // Only toggle if not dragging and not clicking a link
        infoOverlay.classList.toggle('show');
      }
    });

    // Update counter to avoid ID conflicts
    const idNum = parseInt(imageData.id.replace('img_', ''));
    if (idNum >= this.imageCounter) {
      this.imageCounter = idNum + 1;
    }
    
    // Add rulers for dev mode (similar to createGridItem)
    gridItem.addEventListener('mouseover', () => {
      if (this.devMode) {
        this.updateRulers(gridItem);
      }
    });
    
    gridItem.addEventListener('mousemove', (e) => {
      if (this.devMode) {
        this.updateRulers(gridItem);
      }
    });
    
    gridItem.addEventListener('mouseout', () => {
      if (this.devMode) {
        this.hideRulers();
      }
    });
  }
  
  // Calculate the total height occupied by fixed-to-top images
  calculateFixedContentHeight() {
    this.fixedContentHeight = 0; // Reset before recalculating
    const fixedItems = Array.from(this.imageGrid.querySelectorAll('.grid-item[data-fixed-to-top="true"]'));
    fixedItems.forEach(item => {
      // Ensure image is loaded before getting offsetHeight
      const img = item.querySelector('img');
      if (img && img.complete) {
        this.fixedContentHeight += item.offsetHeight;
      } else if (img) {
        img.onload = () => {
          this.fixedContentHeight += item.offsetHeight;
        };
      }
    });
    // Optional: Call updateGridLayout or similar to ensure grid adjusts if needed
    // this.updateGridLayout(); 
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
        const distanceFromBottom = this.gridHeight - (itemTop + itemHeight); // Calculate distance from bottom
        item.dataset.distanceFromBottom = distanceFromBottom; // Store for later use
        maxDynamicY = Math.max(maxDynamicY, itemTop + itemHeight);
      }
    });
    
    // dynamicContentOffsetY should be the max of where fixed content ends or the lowest dynamic item.
    // We add a padding (e.g., 20px) to ensure there's space at the top for new dynamic items.
    this.dynamicContentOffsetY = this.fixedContentHeight + 20; // Initial placement for new dynamic images, just below fixed content
    
    // Position dynamic images based on their distanceFromBottom
    allGridItems.forEach(item => {
      if (item.dataset.fixedToTop !== 'true') {
        const currentDistanceFromBottom = parseFloat(item.dataset.distanceFromBottom) || 0;
        const newY = this.gridHeight - item.offsetHeight - currentDistanceFromBottom;

        item.style.top = Math.max(this.fixedContentHeight, newY) + 'px'; // Ensure it doesn't go above fixed content
        item.dataset.y = parseFloat(item.style.top); // Update dataset as well
      }
    });
    this.updateGridLayout();
  }
  
  setGridHeight(newHeight) {
    const oldGridHeight = this.gridHeight;
    this.gridHeight = Math.max(newHeight, this.fixedContentHeight + 100); // Ensure minimum height below fixed content
    this.imageGrid.style.minHeight = this.gridHeight + 'px';

    const heightDifference = this.gridHeight - oldGridHeight;

    // Reposition dynamic images to maintain their distance from the bottom
    Array.from(this.imageGrid.querySelectorAll('.grid-item')).forEach(item => {
      if (item.dataset.fixedToTop !== 'true') {
        const currentY = parseFloat(item.dataset.y) || 0;
        const currentDistanceFromBottom = parseFloat(item.dataset.distanceFromBottom) || 0; // Use stored distance
        
        // Calculate new Y based on new gridHeight and stored distanceFromBottom
        const newY = this.gridHeight - item.offsetHeight - currentDistanceFromBottom;

        item.style.top = Math.max(this.fixedContentHeight, newY) + 'px'; // Ensure it doesn't go above fixed content
        item.dataset.y = parseFloat(item.style.top); // Update dataset
      }
    });
    this.updateGridLayout();
  }
  
  createContextMenu() {
    this.contextMenu = document.createElement('div');
    this.contextMenu.className = 'context-menu';
    this.contextMenu.innerHTML = `
      <div class="context-menu-items">
        <div class="context-menu-item" data-action="scale" style="display: none;">Scale</div>
        <div class="context-menu-item" data-action="addImage">Add Image</div>
        <label class="context-menu-item context-menu-item-devmode">
          <span>Rulers</span>
          <input type="checkbox" data-action="toggleDevMode" ${this.devMode ? 'checked' : ''}>
        </label>
        <div class="context-menu-item danger" data-action="delete" style="display: none;">Delete</div>
      </div>
    `;
    document.body.appendChild(this.contextMenu);
    
    // Add click handlers for menu items
    this.contextMenu.addEventListener('click', (e) => {
      const target = e.target;
      const action = target.getAttribute('data-action');
      if (action) {
        // If action is not 'toggleDevMode', it needs a selected item
        if (action === 'toggleDevMode') {
          this.handleContextMenuAction(action, null);
          // Prevent menu from closing if only toggling checkbox
          e.stopPropagation(); 
        } else if (action === 'addImage') {
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
      case 'toggleDevMode':
        this.toggleDevMode();
        break;
      case 'addImage':
        this.imageInput.click();
        break;
    }
  }
  
  toggleDevMode() {
    this.devMode = !this.devMode;
    this.updateDevModeUI();
  }
  
  scaleImage(item) {
    const currentScale = parseFloat(item.dataset.scale) || 1;
    const newScaleStr = prompt(`Enter new scale (current: ${currentScale}):`, currentScale);
    
    if (newScaleStr !== null) { // User didn't cancel
      const newScale = parseFloat(newScaleStr);
      if (!isNaN(newScale) && newScale > 0.1 && newScale < 10) { // Basic validation
        item.dataset.scale = newScale; // Update dataset
        
        // Find the img element within the gridItem to get natural dimensions
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
        this.updateGridLayout(); // Re-render grid if needed
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

    if (item) { // An image item was right-clicked
      scaleItem.style.display = 'block';
      deleteItem.style.display = 'block';
    } else { // Grid or header was right-clicked
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
    let content = "placehold"; // Default placeholder

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

    this.modalText.innerHTML = content; // Use innerHTM
    this.modalOverlay.classList.add('show');
    document.body.classList.add('modal-open');
  }

  closeModal() {
    this.modalOverlay.classList.remove('show');
    document.body.classList.remove('modal-open');
  }

  setupEventListeners() {
    // File input
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
      // Only show context menu if not an image
      if (!e.target.closest('.grid-item')) {
        this.showContextMenu(e, null); // Pass null as no item is selected for grid context menu
      }
    });
    
    // Also prevent context menu on the header area
    const header = document.querySelector('.container');
    if (header) {
      header.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });
    }
    
    // Profile picture dropdown
    this.profilePic.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent document click from closing it immediately
      this.profileDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!this.profileDropdown.contains(e.target) && !this.profilePic.contains(e.target)) {
        this.profileDropdown.classList.remove('show');
      }
    });
    
    // Profile dropdown menu item clicks
    const dropdownItems = this.profileDropdown.querySelectorAll('.profile-dropdown-item');
    dropdownItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const action = e.target.textContent;
        this.openModal(action);
        this.profileDropdown.classList.remove('show'); // Hide dropdown after selection
      });
    });

    // Close modal event listeners
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
    
    // Generate unique ID and filename for this image
    const imageId = `img_${this.imageCounter++}`;
    const filename = `${imageId}_${file.name}`;
    gridItem.dataset.imageId = imageId;
    gridItem.dataset.filename = filename;
    gridItem.dataset.originalName = file.name || 'image';
    gridItem.dataset.title = file.name || 'Untitled'; // Default title
    gridItem.dataset.description = 'No description available.'; // Default description
    gridItem.dataset.x = 0; // Default x for new image
    gridItem.dataset.y = 0; // Default y for new image
    gridItem.dataset.scale = 1; // Default scale for new image
    gridItem.dataset.fixedToTop = false; // Default for new images
    
    const img = document.createElement('img');
    img.src = imageSrc;
    img.alt = 'Grid image';
    
    // Set initial position for new (non-fixed) images at the top of the dynamic content area
    const initialX = 0;
    const initialY = this.dynamicContentOffsetY; // Place at the current top of dynamic content
    gridItem.style.position = 'absolute';
    gridItem.style.left = initialX + 'px';
    gridItem.style.top = initialY + 'px';
    gridItem.style.margin = '0';
    gridItem.dataset.x = initialX; // Store initial x in dataset
    gridItem.dataset.y = initialY; // Store initial y in dataset

    gridItem.appendChild(img);
    
    // Add rulers for dev mode
    // Removed ruler creation here
    
    // Add info overlay
    const infoOverlay = document.createElement('div');
    infoOverlay.className = 'grid-item-info-overlay';
    infoOverlay.innerHTML = `
      <h4 class="grid-item-title">${file.name || 'Untitled'}</h4>
      <p class="grid-item-description">No description available.</p>
    `;
    gridItem.appendChild(infoOverlay);

    // Adjust info overlay size and position after image loads
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
      
      // Removed z-index for fixed images as per user request
      // For dynamic images, update the offset (only for newly added images)
      if (gridItem.dataset.fixedToTop !== 'true') {
        const newImageHeight = gridItem.offsetHeight; // Get rendered height of the new image
        const padding = 20;

        // Store distanceFromBottom for the newly added image
        gridItem.dataset.distanceFromBottom = this.gridHeight - (initialY + newImageHeight); // initialY is its top

        // Push down all other dynamic images
        Array.from(this.imageGrid.querySelectorAll('.grid-item')).forEach(item => {
          if (item !== gridItem && item.dataset.fixedToTop !== 'true') {
            const currentY = parseFloat(item.dataset.y) || 0;
            const newY = currentY + newImageHeight + padding;
            item.style.top = newY + 'px';
            item.dataset.y = newY; // Update dataset
          }
        });
        
        // Update dynamicContentOffsetY for the next new image
        this.dynamicContentOffsetY = initialY; // The next new image will appear at this 'top' spot
        this.updateGridLayout(); // Update grid layout after adding a new dynamic image
      }
    };

    gridItem.addEventListener('click', (e) => {
      if (e.target.tagName !== 'A' && !this.isDraggingImage && !this.wasDragged) { // Only toggle if not dragging and not clicking a link
        infoOverlay.classList.toggle('show');
      }
    });

    gridItem.addEventListener('mouseover', () => {
      if (this.devMode) {
        this.updateRulers(gridItem);
      }
    });
    
    gridItem.addEventListener('mousemove', (e) => {
      if (this.devMode) {
        this.updateRulers(gridItem);
      }
    });
    
    gridItem.addEventListener('mouseout', () => {
      if (this.devMode) {
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
    
    // Calculate position relative to the grid (taking pan and scale into account)
    const gridX = Math.round((rect.left - gridRect.left) / this.scale);
    const gridY = Math.round((rect.top - gridRect.top) / this.scale);
    const gridWidth = Math.round(rect.width / this.scale);
    const gridHeight = Math.round(rect.height / this.scale);
    
    // Update X ruler (visual position still viewport-relative)
    this.rulerX.style.left = rect.left + 'px';
    this.rulerX.style.top = rect.top + 'px';
    this.rulerX.style.width = `calc(100vw - ${rect.left}px)`; // Span to the right of the viewport
    this.rulerX.setAttribute('data-value', `X: ${gridX}px, Width: ${gridWidth}px`);
    this.rulerX.style.display = 'block';
    
    // Update Y ruler (visual position still viewport-relative)
    this.rulerY.style.left = rect.left + 'px';
    this.rulerY.style.top = rect.top + 'px';
    this.rulerY.style.height = `calc(100vh - ${rect.top}px)`; // Span to the bottom of the viewport
    this.rulerY.setAttribute('data-value', `Y: ${gridY}px, Height: ${gridHeight}px`);
    this.rulerY.style.display = 'block';
  }
  
  updateGridLayout() {
    // Force grid to recalculate layout
    this.imageGrid.style.display = 'none';
    this.imageGrid.offsetHeight; // Trigger reflow
    this.imageGrid.style.display = 'grid';
  }
  
  setupDragAndDrop(element) {
    // Removed condition to prevent dragging fixedToTop images as per user request
    element.style.cursor = 'grab'; // Restore grab cursor for all draggable items
    element.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Only start drag if the actual image is clicked
      if (e.target.tagName === 'IMG') {
        this.startDrag(e, element);
      }
    });
    
    // Add right-click context menu (still on the grid-item for the whole area)
    element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showContextMenu(e, element);
    });
  }
  
  startDrag(e, element) {
    this.draggedElement = element;
    element.classList.add('dragging');
    
    // Immediately update z-index when dragging starts
    this.draggedElement.style.zIndex = this.zIndexCounter++;
    this.isDraggingImage = true; // Set flag when dragging starts
    this.initialDragX = e.clientX;
    this.initialDragY = e.clientY;
    this.draggedDistance = 0; // Reset distance for new drag
    
    const gridContainerRect = this.gridContainer.getBoundingClientRect();
    
    // Get the untransformed position from dataset
    const currentGridItemX = parseFloat(element.dataset.x) || 0;
    const currentGridItemY = parseFloat(element.dataset.y) || 0;
 
    // Calculate mouse position relative to the gridContainer, then reverse pan and scale
    const mouseXInGridCoords = (e.clientX - gridContainerRect.left - this.panX) / this.scale;
    const mouseYInGridCoords = (e.clientY - gridContainerRect.top - this.panY) / this.scale;
 
    // dragOffset.x will be the distance from the mouse click to the top-left of the element,
    // all in the imageGrid's untransformed coordinate system.
    this.dragOffset.x = mouseXInGridCoords - currentGridItemX;
    this.dragOffset.y = mouseYInGridCoords - currentGridItemY;
    
    document.addEventListener('mousemove', this.handleDrag.bind(this));
    document.addEventListener('mouseup', this.endDrag.bind(this));
  }
  
  handleDrag(e) {
    if (!this.draggedElement) return;
    
    e.preventDefault();
    
    const gridContainerRect = this.gridContainer.getBoundingClientRect();
    
    // mouse position relative to the imageGrid's untransformed origin
    const mouseXInGridCoords = (e.clientX - gridContainerRect.left - this.panX) / this.scale;
    const mouseYInGridCoords = (e.clientY - gridContainerRect.top - this.panY) / this.scale;
 
    // New position for gridItem.style.left/top
    const newLeft = mouseXInGridCoords - this.dragOffset.x;
    const newTop = mouseYInGridCoords - this.dragOffset.y;
    
    // Update dragged distance
    this.draggedDistance += Math.sqrt(e.movementX**2 + e.movementY**2);

    this.draggedElement.style.position = 'absolute';
    this.draggedElement.style.left = newLeft + 'px';
    this.draggedElement.style.top = newTop + 'px';
    this.draggedElement.style.margin = '0';
    
    // Update dataset with new untransformed position
    this.draggedElement.dataset.x = newLeft;
    this.draggedElement.dataset.y = newTop;
  }
  
  endDrag() {
    if (this.draggedElement) {
      this.draggedElement.classList.remove('dragging');
      
      // Update z-index so the most recently dragged item is on top
      this.draggedElement.style.zIndex = this.zIndexCounter++;
      
      this.draggedElement = null;
      this.isDraggingImage = false; // Reset flag when dragging ends
      
      if (this.draggedElement.dataset.fixedToTop !== 'true') {
        // Update distanceFromBottom for dynamic images after dragging
        const newY = parseFloat(this.draggedElement.style.top) || 0;
        const newHeight = this.draggedElement.offsetHeight;
        this.draggedElement.dataset.distanceFromBottom = this.gridHeight - (newY + newHeight);
      }
      
      if (this.draggedDistance > this.dragThreshold) {
        this.wasDragged = true;
        setTimeout(() => { this.wasDragged = false; }, 50);
      }
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
