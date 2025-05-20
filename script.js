// script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Toggle ---
    const themeToggle = document.getElementById('theme-toggle');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    const htmlElement = document.documentElement;
    const applyTheme = (theme) => {
        if (theme === 'dark') { htmlElement.classList.add('dark'); sunIcon.style.display = 'none'; moonIcon.style.display = 'block'; } 
        else { htmlElement.classList.remove('dark'); sunIcon.style.display = 'block'; moonIcon.style.display = 'none'; }
    };
    const savedTheme = localStorage.getItem('theme');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    if (savedTheme) applyTheme(savedTheme); else applyTheme(prefersDarkScheme.matches ? 'dark' : 'light');
    themeToggle.addEventListener('click', () => { const newTheme = htmlElement.classList.contains('dark') ? 'light' : 'dark'; applyTheme(newTheme); localStorage.setItem('theme', newTheme); });
    prefersDarkScheme.addEventListener('change', (e) => { if (!localStorage.getItem('theme')) applyTheme(e.matches ? 'dark' : 'light'); });

    // --- Modal ---
    const modal = document.getElementById('modal');
    const modalMessage = document.getElementById('modal-message');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    function showModal(message) { modalMessage.textContent = message; modal.classList.add('active'); }
    modalCloseBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    // --- Globals ---
    const fileUpload = document.getElementById('file-upload');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imageCanvas = document.getElementById('image-canvas');
    const imagePlaceholder = document.getElementById('image-placeholder');
    const toolsContainer = document.getElementById('tools-container');
    const loadingSpinner = document.getElementById('loading-spinner'); 
    const ctx = imageCanvas.getContext('2d');
    let cropper = null, originalImage = null, currentImageStateForCanvas = null;
    
    let originalFileName = '';
    let originalFileType = '';
    let originalCanvasWidth = 0; 
    let originalCanvasHeight = 0;
    let currentAspectRatio = NaN; // For crop presets, NaN means free
    let isViewingOriginal = false; 

    let currentFilters = { brightness: 100, contrast: 100, grayscale: 0, sepia: 0, invert: 0 };

    // --- History for Undo/Redo ---
    let historyStack = [];
    let historyPointer = -1;
    const MAX_HISTORY_STATES = 20; 

    // --- UI Elements ---
    const cropBtn = document.getElementById('crop-btn');
    const cropActionsDiv = document.getElementById('crop-actions');
    const confirmCropBtn = document.getElementById('confirm-crop-btn');
    const cancelCropBtn = document.getElementById('cancel-crop-btn');
    const cropInstructions = document.getElementById('crop-instructions');
    const cropPresetButtons = document.querySelectorAll('.crop-preset-group .btn-preset');

    const rotateLeftBtn = document.getElementById('rotate-left-btn');
    const rotateRightBtn = document.getElementById('rotate-right-btn');
    const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
    const flipVerticalBtn = document.getElementById('flip-vertical-btn');
    const brightnessSlider = document.getElementById('brightness-slider');
    const contrastSlider = document.getElementById('contrast-slider');
    const brightnessValueDisplay = document.getElementById('brightness-value');
    const contrastValueDisplay = document.getElementById('contrast-value');
    const resizeWidthInput = document.getElementById('resize-width');
    const resizeHeightInput = document.getElementById('resize-height');
    const aspectRatioLock = document.getElementById('aspect-ratio-lock');
    const resizeBtn = document.getElementById('resize-btn');
    const fileFormatSelect = document.getElementById('file-format');
    const jpegQualitySection = document.getElementById('jpeg-quality-section');
    const jpegQualitySlider = document.getElementById('jpeg-quality');
    const jpegQualityValueDisplay = document.getElementById('jpeg-quality-value');
    const downloadBtn = document.getElementById('download-btn');
    
    const historyControlsDiv = document.getElementById('history-controls'); 
    const viewOriginalBtn = document.getElementById('view-original-btn'); 
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const resetAllBtn = document.getElementById('reset-all-btn');
    
    const toolSectionElements = [ 
        document.getElementById('transform-tool-section'),
        document.getElementById('filters-tool-section'),
        document.getElementById('resize-tool-section'),
        document.getElementById('download-tool-section')
    ];
    const imageInfoDisplayDiv = document.getElementById('image-info-display');
    const infoFileName = document.getElementById('info-file-name');
    const infoOriginalDims = document.getElementById('info-original-dims');
    const infoCurrentDims = document.getElementById('info-current-dims');
    const infoFileType = document.getElementById('info-file-type');

    // --- Loading Spinner Control ---
    function showSpinner() {
        if(loadingSpinner) loadingSpinner.classList.remove('hidden');
    }
    function hideSpinner() {
        if(loadingSpinner) loadingSpinner.classList.add('hidden');
    }

    // --- History Management ---
    function saveStateToHistory(stateDataURL) {
        if (historyPointer < historyStack.length - 1) {
            historyStack = historyStack.slice(0, historyPointer + 1);
        }
        historyStack.push(stateDataURL);
        historyPointer++;
        if (historyStack.length > MAX_HISTORY_STATES) {
            historyStack.shift(); 
            historyPointer--; 
        }
        updateUndoRedoButtons();
    }

    function updateUndoRedoButtons() {
        undoBtn.disabled = historyPointer <= 0;
        redoBtn.disabled = historyPointer >= historyStack.length - 1;
        viewOriginalBtn.disabled = !originalImage; 
        historyControlsDiv.classList.toggle('hidden', !originalImage ); 
    }
    
    function clearHistory() {
        historyStack = [];
        historyPointer = -1;
        updateUndoRedoButtons();
    }

    function loadStateFromHistory(stateDataURL) {
        currentImageStateForCanvas = stateDataURL; 
        const img = new Image();
        img.onload = () => {
            imageCanvas.width = img.naturalWidth;
            imageCanvas.height = img.naturalHeight;
            ctx.clearRect(0,0, imageCanvas.width, imageCanvas.height);
            ctx.drawImage(img, 0, 0);
            
            resizeWidthInput.value = imageCanvas.width;
            resizeHeightInput.value = imageCanvas.height;
            updateImageInfoDisplay();
        };
        img.onerror = () => showModal("Error loading history state.");
        img.src = stateDataURL;
    }

    undoBtn.addEventListener('click', () => {
        if (historyPointer > 0) {
            historyPointer--;
            loadStateFromHistory(historyStack[historyPointer]);
            updateUndoRedoButtons();
        }
    });

    redoBtn.addEventListener('click', () => {
        if (historyPointer < historyStack.length - 1) {
            historyPointer++;
            loadStateFromHistory(historyStack[historyPointer]);
            updateUndoRedoButtons();
        }
    });


    // --- Image Info Display Logic ---
    function updateImageInfoDisplay() {
        if (!originalImage) { 
            imageInfoDisplayDiv.classList.add('hidden');
            return;
        }
        infoFileName.textContent = originalFileName || '-';
        infoOriginalDims.textContent = (originalCanvasWidth && originalCanvasHeight) ? `${originalCanvasWidth} x ${originalCanvasHeight} px` : '-';
        infoCurrentDims.textContent = (imageCanvas.width && imageCanvas.height) ? `${imageCanvas.width} x ${imageCanvas.height} px` : '-';
        infoFileType.textContent = originalFileType ? originalFileType.toUpperCase().replace('IMAGE/', '') : '-';
        imageInfoDisplayDiv.classList.remove('hidden');
    }


    // --- Main image drawing function (Commits state AND saves to history) ---
    function drawImageToCanvasAndCommit(sourceDataUrl, shouldSaveToHistory = true, callback) {
        showSpinner(); 
        if (cropper) { cropper.destroy(); cropper = null; setCropUIVisible(false); }
        const img = new Image();
        img.onload = () => {
            if (sourceDataUrl === originalImage && (!originalCanvasWidth || !originalCanvasHeight) ) { 
                originalCanvasWidth = img.naturalWidth;
                originalCanvasHeight = img.naturalHeight;
            }
            imageCanvas.width = img.naturalWidth;
            imageCanvas.height = img.naturalHeight;
            applyCombinedFiltersToContext(); 
            ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
            currentImageStateForCanvas = imageCanvas.toDataURL(); 
            
            if (shouldSaveToHistory) {
                saveStateToHistory(currentImageStateForCanvas);
            }
            
            imagePlaceholder.style.display = 'none'; imageCanvas.style.display = 'block';
            toolsContainer.classList.remove('hidden'); 
            
            if (!cropper) {
                document.querySelectorAll('#tools-container .tool-section button, #tools-container .tool-section input, #tools-container .tool-section select').forEach(el => el.disabled = false);
            }

            resizeWidthInput.value = imageCanvas.width;
            resizeHeightInput.value = imageCanvas.height;
            updateImageInfoDisplay(); 
            updateUndoRedoButtons(); 
            hideSpinner(); 
            if (callback) callback();
        };
        img.onerror = () => { 
            showModal('Error loading image for canvas.'); 
            hideSpinner(); 
            resetEditorState(); 
        };
        img.src = sourceDataUrl;
    }

    // --- Preview function for non-committing filter changes (e.g., sliders) ---
    function previewFiltersOnCanvas() {
        if (!currentImageStateForCanvas || cropper || isViewingOriginal) return; 
        const img = new Image();
        img.onload = () => {
            if (imageCanvas.width !== img.naturalWidth || imageCanvas.height !== img.naturalHeight) {
                imageCanvas.width = img.naturalWidth;
                imageCanvas.height = img.naturalHeight;
            }
            ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
            applyCombinedFiltersToContext(); 
            ctx.drawImage(img, 0, 0, imageCanvas.width, imageCanvas.height);
        };
        img.onerror = () => console.error("Error loading image for filter preview.");
        img.src = currentImageStateForCanvas; 
    }
    
    // --- File Upload & Drag/Drop ---
    function handleNewFile(file) {
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            showModal('Invalid file type.'); fileUpload.value = ''; return;
        }
        originalFileName = file.name; 
        originalFileType = file.type; 
        clearHistory(); 
        showSpinner(); 

        const reader = new FileReader();
        reader.onloadstart = () => { 
            showSpinner();
        };
        reader.onload = (e) => {
            originalImage = e.target.result; 
            currentImageStateForCanvas = originalImage; 
            originalCanvasWidth = 0; originalCanvasHeight = 0; 
            resetAllFiltersAndDraw(currentImageStateForCanvas, true); 
            currentAspectRatio = NaN;
            updateActivePresetButton();
        };
        reader.onerror = () => {
            hideSpinner();
            showModal("Error reading file.");
        }
        reader.readAsDataURL(file);
    }
    fileUpload.addEventListener('change', (e) => handleNewFile(e.target.files[0]));
    imagePreviewContainer.addEventListener('dragover', (e) => { e.preventDefault(); imagePreviewContainer.classList.add('dragover'); });
    imagePreviewContainer.addEventListener('dragleave', () => imagePreviewContainer.classList.remove('dragover'));
    imagePreviewContainer.addEventListener('drop', (e) => { e.preventDefault(); imagePreviewContainer.classList.remove('dragover'); handleNewFile(e.dataTransfer.files[0]); });
    
    // --- Editor Reset ---
    function resetEditorState() {
        if (cropper) { cropper.destroy(); cropper = null; }
        setCropUIVisible(false); 
        originalImage = null; currentImageStateForCanvas = null;
        originalCanvasWidth = 0; originalCanvasHeight = 0;
        originalFileName = ''; originalFileType = '';
        currentAspectRatio = NaN; 
        clearHistory(); 
        ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        imageCanvas.width = 0; imageCanvas.height = 0; 
        imageCanvas.style.display = 'none'; imagePlaceholder.style.display = 'block';
        toolsContainer.classList.add('hidden'); 
        historyControlsDiv.classList.add('hidden'); 
        imageInfoDisplayDiv.classList.add('hidden'); 
        hideSpinner(); 
        fileUpload.value = '';
        resetFilterControlsToDefaults();
        updateActivePresetButton();
        resizeWidthInput.value = ''; resizeHeightInput.value = '';
    }

    // --- Filter Logic ---
    function applyCombinedFiltersToContext() {
        ctx.filter = `brightness(${currentFilters.brightness}%) contrast(${currentFilters.contrast}%) grayscale(${currentFilters.grayscale}%) sepia(${currentFilters.sepia}%) invert(${currentFilters.invert}%)`;
    }
    brightnessSlider.addEventListener('input', (e) => { 
        if (cropper) return;
        currentFilters.brightness = e.target.value; 
        brightnessValueDisplay.textContent = e.target.value;
        previewFiltersOnCanvas(); 
    });
    brightnessSlider.addEventListener('change', () => { 
        if (cropper || !currentImageStateForCanvas) return;
        drawImageToCanvasAndCommit(currentImageStateForCanvas);
    });
    contrastSlider.addEventListener('input', (e) => { 
        if (cropper) return;
        currentFilters.contrast = e.target.value; 
        contrastValueDisplay.textContent = e.target.value;
        previewFiltersOnCanvas(); 
    });
    contrastSlider.addEventListener('change', () => { 
        if (cropper || !currentImageStateForCanvas) return;
        drawImageToCanvasAndCommit(currentImageStateForCanvas);
    });

    ['grayscale', 'sepia', 'invert'].forEach(type => {
        document.getElementById(`filter-${type}`).addEventListener('click', () => {
            if (cropper) return; 
            currentFilters[type] = currentFilters[type] === 100 ? 0 : 100;
            drawImageToCanvasAndCommit(currentImageStateForCanvas); 
        });
    });
    document.getElementById('filter-none').addEventListener('click', () => {
        if (cropper) return;
        resetFilterControlsToDefaults();
        drawImageToCanvasAndCommit(currentImageStateForCanvas); 
    });
    function resetFilterControlsToDefaults() {
        currentFilters = { brightness: 100, contrast: 100, grayscale: 0, sepia: 0, invert: 0 };
        brightnessSlider.value = 100; contrastSlider.value = 100;
        brightnessValueDisplay.textContent = 100; contrastValueDisplay.textContent = 100;
    }
    function resetAllFiltersAndDraw(sourceDataUrl, saveToHistory = true, callback) { 
        resetFilterControlsToDefaults();
        if (sourceDataUrl) drawImageToCanvasAndCommit(sourceDataUrl, saveToHistory, callback);
    }

    // --- Transform Logic (Commits changes) ---
    function performTransformation(transformationFn) {
        if (!currentImageStateForCanvas || cropper) return;
        showSpinner();
        const imgForTransform = new Image();
        imgForTransform.onload = () => {
            const tempCanvasForTransform = document.createElement('canvas');
            const tempCtxForTransform = tempCanvasForTransform.getContext('2d');
            tempCanvasForTransform.width = imgForTransform.naturalWidth;
            tempCanvasForTransform.height = imgForTransform.naturalHeight;
            tempCtxForTransform.filter = `brightness(${currentFilters.brightness}%) contrast(${currentFilters.contrast}%) grayscale(${currentFilters.grayscale}%) sepia(${currentFilters.sepia}%) invert(${currentFilters.invert}%)`;
            tempCtxForTransform.drawImage(imgForTransform, 0, 0);
            const stateWithLiveFilters = tempCanvasForTransform.toDataURL();
            
            const finalTransformImg = new Image();
            finalTransformImg.onload = () => {
                const transformedCanvas = document.createElement('canvas');
                const transformedCtx = transformedCanvas.getContext('2d');
                transformationFn(finalTransformImg, transformedCanvas, transformedCtx); 
                const newDataURL = transformedCanvas.toDataURL();
                drawImageToCanvasAndCommit(newDataURL); 
                updateImageInfoDisplay();
            };
            finalTransformImg.src = stateWithLiveFilters;
        };
        imgForTransform.src = currentImageStateForCanvas; 
    }

    rotateLeftBtn.addEventListener('click', () => performTransformation((img, tCanvas, tCtx) => {
        tCanvas.width = img.height; tCanvas.height = img.width;
        tCtx.translate(tCanvas.width / 2, tCanvas.height / 2);
        tCtx.rotate(-90 * Math.PI / 180);
        tCtx.drawImage(img, -img.width / 2, -img.height / 2);
    }));
    rotateRightBtn.addEventListener('click', () => performTransformation((img, tCanvas, tCtx) => {
        tCanvas.width = img.height; tCanvas.height = img.width;
        tCtx.translate(tCanvas.width / 2, tCanvas.height / 2);
        tCtx.rotate(90 * Math.PI / 180);
        tCtx.drawImage(img, -img.width / 2, -img.height / 2);
    }));
    flipHorizontalBtn.addEventListener('click', () => performTransformation((img, tCanvas, tCtx) => {
        tCanvas.width = img.width; tCanvas.height = img.height;
        tCtx.translate(img.width, 0); tCtx.scale(-1, 1);
        tCtx.drawImage(img, 0, 0);
    }));
    flipVerticalBtn.addEventListener('click', () => performTransformation((img, tCanvas, tCtx) => {
        tCanvas.width = img.width; tCanvas.height = img.height;
        tCtx.translate(0, img.height); tCtx.scale(1, -1);
        tCtx.drawImage(img, 0, 0);
    }));


    // --- Resize Logic (Commits changes) ---
    function updateResizeInputsBasedOnAspectRatio(changedInput) { /* ... same ... */ }
    resizeWidthInput.addEventListener('input', () => updateResizeInputsBasedOnAspectRatio('width'));
    resizeHeightInput.addEventListener('input', () => updateResizeInputsBasedOnAspectRatio('height'));
    resizeBtn.addEventListener('click', () => {
        if (!currentImageStateForCanvas || cropper) { showModal('Upload an image and ensure no crop is active.'); return; }
        const width = parseInt(resizeWidthInput.value); const height = parseInt(resizeHeightInput.value);
        if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) { showModal('Valid positive dimensions required.'); return; }
        
        performTransformation((img, tCanvas, tCtx) => {
            tCanvas.width = width; tCanvas.height = height;
            tCtx.drawImage(img, 0, 0, width, height); 
        });
    });

    // --- Crop Logic ---
    function updateActivePresetButton() {
        cropPresetButtons.forEach(button => {
            const ratio = parseFloat(button.dataset.ratio);
            // Check for NaN explicitly for the "Free" button
            if ((isNaN(currentAspectRatio) && isNaN(ratio)) || currentAspectRatio === ratio) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    cropPresetButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentAspectRatio = parseFloat(button.dataset.ratio); // This will be NaN for "Free"
            updateActivePresetButton();
            if (cropper) {
                cropper.setAspectRatio(currentAspectRatio);
            }
        });
    });
    
    function setCropUIVisible(visible) {
        cropBtn.classList.toggle('hidden', visible);
        cropActionsDiv.classList.toggle('hidden', !visible);
        cropInstructions.style.display = visible ? 'block' : 'none';
        cropBtn.disabled = visible;

        toolSectionElements.forEach(section => {
            if (section) { 
                section.style.opacity = visible ? '0.5' : '1';
                section.style.pointerEvents = visible ? 'none' : 'auto';
                section.querySelectorAll('button, input, select').forEach(control => {
                    control.disabled = visible;
                });
            }
        });
        cropPresetButtons.forEach(btn => btn.disabled = visible);
    }
    cropBtn.addEventListener('click', () => {
        if (!currentImageStateForCanvas) { showModal('Please upload an image first.'); return; }
        if (cropper) { cropper.destroy(); cropper = null; setCropUIVisible(false); return; }
        showSpinner();
        const imgForCrop = new Image();
        imgForCrop.onload = () => {
            const tempCanvasForCrop = document.createElement('canvas');
            const tempCtxForCrop = tempCanvasForCrop.getContext('2d');
            tempCanvasForCrop.width = imgForCrop.naturalWidth;
            tempCanvasForCrop.height = imgForCrop.naturalHeight;
            tempCtxForCrop.filter = `brightness(${currentFilters.brightness}%) contrast(${currentFilters.contrast}%) grayscale(${currentFilters.grayscale}%) sepia(${currentFilters.sepia}%) invert(${currentFilters.invert}%)`;
            tempCtxForCrop.drawImage(imgForCrop, 0, 0);
            const stateWithLiveFilters = tempCanvasForCrop.toDataURL();

            drawImageToCanvasAndCommit(stateWithLiveFilters, false, () => { 
                cropper = new Cropper(imageCanvas, { 
                    aspectRatio: currentAspectRatio, 
                    viewMode: 1, background: true, autoCropArea: 0.8, responsive: true,
                    modal: true, guides: true, center: true, highlight: true,
                    cropBoxMovable: true, cropBoxResizable: true,
                    ready: () => { hideSpinner(); } 
                });
                setCropUIVisible(true);
            });
        };
        imgForCrop.onerror = () => {
            hideSpinner();
            showModal("Error preparing image for crop.");
        }
        imgForCrop.src = currentImageStateForCanvas; 
    });

    confirmCropBtn.addEventListener('click', () => {
        if (!cropper) return;
        showSpinner();
        const croppedCanvas = cropper.getCroppedCanvas({});
        const croppedDataUrl = croppedCanvas.toDataURL(fileFormatSelect.value === 'image/jpeg' ? 'image/jpeg' : 'image/png');
        cropper.destroy(); cropper = null;
        setCropUIVisible(false);
        currentImageStateForCanvas = croppedDataUrl; 
        resetAllFiltersAndDraw(currentImageStateForCanvas, true); 
        showModal('Image cropped.');
    });

    cancelCropBtn.addEventListener('click', () => {
        if (!cropper) return;
        cropper.destroy(); cropper = null;
        setCropUIVisible(false);
        drawImageToCanvasAndCommit(currentImageStateForCanvas, false); 
    });

    // --- "View Original" Button Logic ---
    viewOriginalBtn.addEventListener('mousedown', () => {
        if (!originalImage || cropper || isViewingOriginal) return;
        isViewingOriginal = true;
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
            if (imageCanvas.width !== img.naturalWidth || imageCanvas.height !== img.naturalHeight) {
                imageCanvas.width = img.naturalWidth;
                imageCanvas.height = img.naturalHeight;
            }
            ctx.filter = 'none'; // No filters when viewing original
            ctx.drawImage(img, 0, 0);
        };
        img.src = originalImage;
    });

    function restorePreview() {
        if (isViewingOriginal) {
            isViewingOriginal = false;
            if (currentImageStateForCanvas) {
                previewFiltersOnCanvas(); 
            } else if (originalImage) { 
                drawImageToCanvasAndCommit(originalImage, false); 
            }
        }
    }
    viewOriginalBtn.addEventListener('mouseup', restorePreview);
    viewOriginalBtn.addEventListener('mouseleave', restorePreview); 
    viewOriginalBtn.addEventListener('touchstart', (e) => {
        e.preventDefault(); 
        if (!originalImage || cropper || isViewingOriginal) return;
        isViewingOriginal = true;
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
            if (imageCanvas.width !== img.naturalWidth || imageCanvas.height !== img.naturalHeight) {
                imageCanvas.width = img.naturalWidth;
                imageCanvas.height = img.naturalHeight;
            }
            ctx.filter = 'none';
            ctx.drawImage(img, 0, 0);
        };
        img.src = originalImage;
    }, { passive: false });
    viewOriginalBtn.addEventListener('touchend', restorePreview);
    viewOriginalBtn.addEventListener('touchcancel', restorePreview);


    // --- Format & Download ---
    fileFormatSelect.addEventListener('change', () => { /* ... same ... */ });
    jpegQualitySlider.addEventListener('input', (e) => { /* ... same ... */ });
    downloadBtn.addEventListener('click', () => { /* ... same ... */ });

    // --- Reset All ---
    resetAllBtn.addEventListener('click', () => {
        if (originalImage) {
            currentImageStateForCanvas = originalImage; 
            originalCanvasWidth = 0; originalCanvasHeight = 0; 
            originalFileName = ''; originalFileType = ''; 
            currentAspectRatio = NaN; 
            clearHistory(); 
            resetAllFiltersAndDraw(originalImage, true); 
            updateActivePresetButton();
            showModal('All changes reset.');
        } else {
            resetEditorState(); 
        }
    });
    
    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (event) => {
        const isCtrlOrCmd = event.ctrlKey || event.metaKey;
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        if (isCtrlOrCmd && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            if (!undoBtn.disabled) undoBtn.click();
        } else if (isCtrlOrCmd && event.key.toLowerCase() === 'y') {
            event.preventDefault();
            if (!redoBtn.disabled) redoBtn.click();
        } else if (isCtrlOrCmd && event.key.toLowerCase() === 'o') {
            event.preventDefault();
            fileUpload.click(); 
        } else if (isCtrlOrCmd && event.key.toLowerCase() === 's') {
            event.preventDefault();
            if (originalImage && !downloadBtn.disabled) downloadBtn.click();
        }
    });

    resetEditorState(); 
});
