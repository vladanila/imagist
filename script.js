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
    const modalConfirmBtn = document.getElementById('modal-confirm-btn'); 
    const modalCancelBtn = document.getElementById('modal-cancel-btn');  
    let currentModalAction = null; 

    function showModal(message, type = 'info', confirmAction = null) {
        modalMessage.textContent = message;
        currentModalAction = confirmAction;

        if (type === 'confirmation') {
            modalConfirmBtn.textContent = 'Confirm';
            modalCancelBtn.classList.remove('hidden');
        } else { 
            modalConfirmBtn.textContent = 'OK';
            modalCancelBtn.classList.add('hidden');
        }
        modal.classList.add('active');
    }

    function closeModal() {
        modal.classList.remove('active');
        currentModalAction = null; 
    }

    modalConfirmBtn.addEventListener('click', () => {
        if (currentModalAction) {
            currentModalAction(); 
        }
        closeModal();
    });
    modalCancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { 
        if (e.target === modal) closeModal();
    });


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
    let currentAspectRatio = NaN; 
    let isViewingOriginal = false; 

    let currentFilters = { brightness: 100, contrast: 100, grayscale: 0, sepia: 0, invert: 0 };
    let textObjects = []; 

    // --- History for Undo/Redo ---
    let historyStack = [];
    let historyPointer = -1;
    const MAX_HISTORY_STATES = 20; 

    // --- UI Elements ---
    const editFileNameInput = document.getElementById('edit-file-name');
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

    const textInput = document.getElementById('text-input');
    const fontFamilySelect = document.getElementById('font-family-select');
    const fontSizeInput = document.getElementById('font-size-input');
    const fontColorInput = document.getElementById('font-color-input');
    const addTextBtn = document.getElementById('add-text-btn');
    const clearAllTextBtn = document.getElementById('clear-all-text-btn');
    
    const toolSectionElements = [ 
        document.getElementById('crop-tool-section'), 
        document.getElementById('transform-tool-section'),
        document.getElementById('filters-tool-section'),
        document.getElementById('text-tool-section'), 
        document.getElementById('resize-tool-section'),
        document.getElementById('download-tool-section')
    ];
    const imageInfoDisplayDiv = document.getElementById('image-info-display');
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
        historyStack.push({
            imageData: stateDataURL,
            texts: JSON.parse(JSON.stringify(textObjects)),
            filters: JSON.parse(JSON.stringify(currentFilters)) 
        });
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

    function loadStateFromHistory(historyEntry) {
        currentImageStateForCanvas = historyEntry.imageData; 
        textObjects = JSON.parse(JSON.stringify(historyEntry.texts)); 
        currentFilters = JSON.parse(JSON.stringify(historyEntry.filters)); 

        brightnessSlider.value = currentFilters.brightness;
        brightnessValueDisplay.textContent = currentFilters.brightness;
        contrastSlider.value = currentFilters.contrast;
        contrastValueDisplay.textContent = currentFilters.contrast;

        const img = new Image();
        img.onload = () => {
            imageCanvas.width = img.naturalWidth;
            imageCanvas.height = img.naturalHeight;
            ctx.clearRect(0,0, imageCanvas.width, imageCanvas.height);
            // The history state's imageData already has its specific filters baked in.
            // We don't re-apply global currentFilters here, but draw the image as is.
            // Then draw the text objects associated with that history state.
            ctx.drawImage(img, 0, 0);
            drawAllText(); // Draw the restored text objects
            
            resizeWidthInput.value = imageCanvas.width;
            resizeHeightInput.value = imageCanvas.height;
            updateImageInfoDisplay();
        };
        img.onerror = () => showModal("Error loading history state.");
        img.src = currentImageStateForCanvas; 
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
            editFileNameInput.value = ''; 
            editFileNameInput.disabled = true;
            return;
        }
        if (editFileNameInput.value === '' || editFileNameInput.value === 'Imagist_edited' || editFileNameInput.value === 'edited_image') {
            const nameWithoutExtension = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;
            editFileNameInput.value = nameWithoutExtension || 'edited_image';
        }
        editFileNameInput.disabled = false;

        infoOriginalDims.textContent = (originalCanvasWidth && originalCanvasHeight) ? `${originalCanvasWidth} x ${originalCanvasHeight} px` : '-';
        infoCurrentDims.textContent = (imageCanvas.width && imageCanvas.height) ? `${Math.round(imageCanvas.width)} x ${Math.round(imageCanvas.height)} px` : '-';
        infoFileType.textContent = originalFileType ? originalFileType.toUpperCase().replace('IMAGE/', '') : '-';
        imageInfoDisplayDiv.classList.remove('hidden');
    }

    // --- Text Rendering ---
    function drawAllText() {
        if (isViewingOriginal) return; 
        textObjects.forEach(textObj => {
            ctx.font = `${textObj.size}px ${textObj.fontFamily}`; 
            ctx.fillStyle = textObj.color;
            ctx.textAlign = 'left'; 
            ctx.textBaseline = 'top'; 
            const lines = textObj.text.split('\n');
            lines.forEach((line, index) => {
                ctx.fillText(line, textObj.x, textObj.y + (index * textObj.size * 1.2)); 
            });
        });
    }
    
    // --- Main image drawing function (Commits state AND saves to history) ---
    // This function is responsible for drawing the sourceDataUrl (which should be a base image state)
    // onto the canvas, applying current global filters and text, then saving the result.
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
            
            applyCombinedFiltersToContext(); // Apply current filter values
            ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight); // Draw the base image
            drawAllText(); // Draw text on top
            
            const committedStateDataURL = imageCanvas.toDataURL();
            currentImageStateForCanvas = committedStateDataURL; // This is now the new base state
            
            if (shouldSaveToHistory) {
                saveStateToHistory(committedStateDataURL);
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
        img.src = sourceDataUrl; // sourceDataUrl is typically currentImageStateForCanvas or originalImage
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
            applyCombinedFiltersToContext(); // Applies currentFilters from the global object
            ctx.drawImage(img, 0, 0, imageCanvas.width, imageCanvas.height); // Draw base image
            drawAllText(); // Draw text on top
        };
        img.onerror = () => console.error("Error loading image for filter preview.");
        img.src = currentImageStateForCanvas; // Use the last committed state as base for preview
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
        textObjects = []; 
        showSpinner(); 

        const reader = new FileReader();
        reader.onloadstart = () => { 
            showSpinner();
        };
        reader.onload = (e) => {
            originalImage = e.target.result; 
            currentImageStateForCanvas = originalImage; 
            originalCanvasWidth = 0; originalCanvasHeight = 0; 
            
            const nameWithoutExtension = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;
            editFileNameInput.value = nameWithoutExtension || 'edited_image';

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
        textObjects = []; 
        clearHistory(); 
        ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        imageCanvas.width = 0; imageCanvas.height = 0; 
        imageCanvas.style.display = 'none'; 
        imagePlaceholder.textContent = "Drag & drop an image here, or click 'Choose File' above.";
        imagePlaceholder.style.display = 'block';
        toolsContainer.classList.add('hidden'); 
        historyControlsDiv.classList.add('hidden'); 
        imageInfoDisplayDiv.classList.add('hidden'); 
        editFileNameInput.value = ''; 
        editFileNameInput.disabled = true; 
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
        if (cropper || isViewingOriginal) return;
        currentFilters.brightness = e.target.value; 
        brightnessValueDisplay.textContent = e.target.value;
        previewFiltersOnCanvas(); 
    });
    brightnessSlider.addEventListener('change', () => { 
        if (cropper || !currentImageStateForCanvas || isViewingOriginal) return;
        drawImageToCanvasAndCommit(currentImageStateForCanvas);
    });
    contrastSlider.addEventListener('input', (e) => { 
        if (cropper || isViewingOriginal) return;
        currentFilters.contrast = e.target.value; 
        contrastValueDisplay.textContent = e.target.value;
        previewFiltersOnCanvas(); 
    });
    contrastSlider.addEventListener('change', () => { 
        if (cropper || !currentImageStateForCanvas || isViewingOriginal) return;
        drawImageToCanvasAndCommit(currentImageStateForCanvas);
    });

    // Corrected logic for discrete filters to be exclusive
    ['grayscale', 'sepia', 'invert'].forEach(type => {
        document.getElementById(`filter-${type}`).addEventListener('click', () => {
            if (cropper || isViewingOriginal) return; 
            
            const wasActive = currentFilters[type] === 100;

            // Reset all discrete filter values (grayscale, sepia, invert)
            // Brightness and contrast are preserved.
            currentFilters.grayscale = 0;
            currentFilters.sepia = 0;
            currentFilters.invert = 0;

            if (!wasActive) {
                currentFilters[type] = 100; // Activate the clicked one
            }
            // Redraw using the current base image state, applying the newly set filters
            drawImageToCanvasAndCommit(currentImageStateForCanvas); 
        });
    });

    document.getElementById('filter-none').addEventListener('click', () => {
        if (cropper || isViewingOriginal) return;
        // This will reset brightness/contrast to 100 and discrete filters to 0
        resetFilterControlsToDefaults(); 
        // Redraw using the current base image state, applying the now default filters
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

    // --- Text Tool Logic ---
    addTextBtn.addEventListener('click', () => {
        if (!currentImageStateForCanvas || cropper || isViewingOriginal) {
            showModal("Please load an image and ensure no crop or view original is active.");
            return;
        }
        const text = textInput.value.trim();
        if (!text) {
            showModal("Please enter some text.");
            return;
        }
        const newTextObject = {
            text: text,
            x: 50, 
            y: 50, 
            fontFamily: fontFamilySelect.value,
            size: parseInt(fontSizeInput.value) || 30,
            color: fontColorInput.value
        };
        textObjects.push(newTextObject);
        textInput.value = ''; 
        drawImageToCanvasAndCommit(currentImageStateForCanvas); 
    });

    clearAllTextBtn.addEventListener('click', () => {
        if (textObjects.length === 0) { showModal("No text to clear."); return; }
        if (isViewingOriginal) return;
        textObjects = []; 
        drawImageToCanvasAndCommit(currentImageStateForCanvas); 
        showModal("All text cleared.");
    });

    // --- Transform Logic (Commits changes) ---
    function performTransformation(transformationFn) {
        if (!currentImageStateForCanvas || cropper || isViewingOriginal) return;
        showSpinner();
        const imgForTransform = new Image();
        imgForTransform.onload = () => {
            const tempCanvasForTransform = document.createElement('canvas');
            const tempCtxForTransform = tempCanvasForTransform.getContext('2d');
            tempCanvasForTransform.width = imgForTransform.naturalWidth;
            tempCanvasForTransform.height = imgForTransform.naturalHeight;
            tempCtxForTransform.filter = `brightness(${currentFilters.brightness}%) contrast(${currentFilters.contrast}%) grayscale(${currentFilters.grayscale}%) sepia(${currentFilters.sepia}%) invert(${currentFilters.invert}%)`;
            tempCtxForTransform.drawImage(imgForTransform, 0, 0);
            textObjects.forEach(textObj => { 
                tempCtxForTransform.font = `${textObj.size}px ${textObj.fontFamily}`;
                tempCtxForTransform.fillStyle = textObj.color;
                tempCtxForTransform.textAlign = 'left';
                tempCtxForTransform.textBaseline = 'top';
                const lines = textObj.text.split('\n');
                lines.forEach((line, index) => {
                    tempCtxForTransform.fillText(line, textObj.x, textObj.y + (index * textObj.size * 1.2));
                });
            });
            const stateWithAllEffects = tempCanvasForTransform.toDataURL();
            
            const finalTransformImg = new Image();
            finalTransformImg.onload = () => {
                const transformedCanvas = document.createElement('canvas');
                const transformedCtx = transformedCanvas.getContext('2d');
                transformationFn(finalTransformImg, transformedCanvas, transformedCtx); 
                const newDataURL = transformedCanvas.toDataURL();
                currentImageStateForCanvas = newDataURL; 
                saveStateToHistory(currentImageStateForCanvas); 
                
                const displayImg = new Image();
                displayImg.onload = () => {
                    imageCanvas.width = displayImg.naturalWidth;
                    imageCanvas.height = displayImg.naturalHeight;
                    ctx.clearRect(0,0,imageCanvas.width, imageCanvas.height);
                    ctx.drawImage(displayImg,0,0); 
                    updateImageInfoDisplay();
                    updateUndoRedoButtons();
                    hideSpinner();
                }
                displayImg.src = currentImageStateForCanvas;
            };
            finalTransformImg.src = stateWithAllEffects;
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
        if (!currentImageStateForCanvas || cropper || isViewingOriginal) { showModal('Upload an image and ensure no crop/view original is active.'); return; }
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
            if ((isNaN(currentAspectRatio) && isNaN(ratio)) || currentAspectRatio === ratio) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    cropPresetButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentAspectRatio = parseFloat(button.dataset.ratio); 
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
            if (section && section.id !== 'crop-tool-section') { 
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
        if (!currentImageStateForCanvas || isViewingOriginal) { showModal('Please upload an image and ensure not viewing original.'); return; }
        if (cropper) { 
            cropper.destroy(); 
            cropper = null; 
            setCropUIVisible(false); 
            drawImageToCanvasAndCommit(currentImageStateForCanvas, false); 
            return; 
        }
        showSpinner();
        const imgForCrop = new Image();
        imgForCrop.onload = () => {
            const tempCanvasForCrop = document.createElement('canvas');
            const tempCtxForCrop = tempCanvasForCrop.getContext('2d');
            tempCanvasForCrop.width = imgForCrop.naturalWidth;
            tempCanvasForCrop.height = imgForCrop.naturalHeight;
            tempCtxForCrop.filter = `brightness(${currentFilters.brightness}%) contrast(${currentFilters.contrast}%) grayscale(${currentFilters.grayscale}%) sepia(${currentFilters.sepia}%) invert(${currentFilters.invert}%)`;
            tempCtxForCrop.drawImage(imgForCrop, 0, 0);
            textObjects.forEach(textObj => {
                tempCtxForCrop.font = `${textObj.size}px ${textObj.fontFamily}`;
                tempCtxForCrop.fillStyle = textObj.color;
                tempCtxForCrop.textAlign = 'left'; tempCtxForCrop.textBaseline = 'top';
                const lines = textObj.text.split('\n');
                lines.forEach((line, index) => {
                    tempCtxForCrop.fillText(line, textObj.x, textObj.y + (index * textObj.size * 1.2));
                });
            });
            const stateWithAllEffects = tempCanvasForCrop.toDataURL();

            // Draw this fully effected state to the main canvas for Cropper, but DON'T save to history yet.
            // The callback will initialize Cropper.js.
            // We pass 'false' for applyGlobalFiltersAndText because stateWithAllEffects already has them.
            drawImageToCanvasAndCommit(stateWithAllEffects, false, () => { 
                cropper = new Cropper(imageCanvas, { 
                    aspectRatio: currentAspectRatio, 
                    viewMode: 1, background: true, autoCropArea: 0.8, responsive: true,
                    modal: true, guides: true, center: true, highlight: true,
                    cropBoxMovable: true, cropBoxResizable: true,
                    ready: () => { 
                        hideSpinner(); 
                        setCropUIVisible(true); 
                    } 
                });
            });
        };
        imgForCrop.onerror = () => { hideSpinner(); showModal("Error preparing image for crop."); }
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
        textObjects = []; // Text from before crop is baked in, clear for new text on cropped base
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
        showSpinner();
        const img = new Image();
        img.onload = () => {
            imageCanvas.width = img.naturalWidth;
            imageCanvas.height = img.naturalHeight;
            ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
            ctx.filter = 'none'; 
            ctx.drawImage(img, 0, 0);
            hideSpinner();
        };
        img.onerror = () => { hideSpinner(); showModal("Error loading original image."); }
        img.src = originalImage;
    });

    function restorePreview() {
        if (isViewingOriginal) {
            isViewingOriginal = false;
            if (currentImageStateForCanvas) {
                previewFiltersOnCanvas(); 
            } else if (originalImage) { 
                drawImageToCanvasAndCommit(originalImage, false); 
            } else {
                resetEditorState(); 
            }
        }
    }
    viewOriginalBtn.addEventListener('mouseup', restorePreview);
    viewOriginalBtn.addEventListener('mouseleave', restorePreview); 
    viewOriginalBtn.addEventListener('touchstart', (e) => {
        e.preventDefault(); 
        if (!originalImage || cropper || isViewingOriginal) return;
        isViewingOriginal = true;
        showSpinner();
        const img = new Image();
        img.onload = () => {
            imageCanvas.width = img.naturalWidth;
            imageCanvas.height = img.naturalHeight;
            ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
            ctx.filter = 'none';
            ctx.drawImage(img, 0, 0);
            hideSpinner();
        };
        img.onerror = () => { hideSpinner(); showModal("Error loading original image."); }
        img.src = originalImage;
    }, { passive: false });
    viewOriginalBtn.addEventListener('touchend', restorePreview);
    viewOriginalBtn.addEventListener('touchcancel', restorePreview);


    // --- Format & Download ---
    fileFormatSelect.addEventListener('change', () => { 
        jpegQualitySection.classList.toggle('hidden', fileFormatSelect.value !== 'image/jpeg');
    });
    jpegQualitySlider.addEventListener('input', (e) => { 
        jpegQualityValueDisplay.textContent = parseFloat(e.target.value).toFixed(2);
    });
    downloadBtn.addEventListener('click', () => {
        if (!currentImageStateForCanvas) { showModal('No image to download.'); return; }
        if (cropper) { showModal('Confirm or cancel crop first.'); return;}
        
        showSpinner(); 

        const imgToDownload = new Image();
        imgToDownload.onload = () => {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = imgToDownload.naturalWidth; 
            tempCanvas.height = imgToDownload.naturalHeight; 
            
            // Apply the final set of filters and text from current state
            tempCtx.filter = `brightness(${currentFilters.brightness}%) contrast(${currentFilters.contrast}%) grayscale(${currentFilters.grayscale}%) sepia(${currentFilters.sepia}%) invert(${currentFilters.invert}%)`;
            tempCtx.drawImage(imgToDownload, 0, 0, tempCanvas.width, tempCanvas.height);
             textObjects.forEach(textObj => {
                tempCtx.font = `${textObj.size}px ${textObj.fontFamily}`; 
                tempCtx.fillStyle = textObj.color;
                tempCtx.textAlign = 'left';
                tempCtx.textBaseline = 'top';
                const lines = textObj.text.split('\n');
                lines.forEach((line, index) => {
                    tempCtx.fillText(line, textObj.x, textObj.y + (index * textObj.size * 1.2));
                });
            });


            const format = fileFormatSelect.value;
            const quality = (format === 'image/jpeg') ? parseFloat(jpegQualitySlider.value) : undefined;
            const dataURL = tempCanvas.toDataURL(format, quality); 
            const link = document.createElement('a');
            
            let userFileName = editFileNameInput.value.trim() || 'Imagist_edited';
            userFileName = userFileName.replace(/[<>:"/\\|?*]+/g, '_'); 
            
            const extension = format.split('/')[1];
            link.download = `${userFileName}.${extension}`;
            link.href = dataURL;
            document.body.appendChild(link); 
            link.click(); 
            document.body.removeChild(link);
            hideSpinner(); 
            showModal(`Image downloaded as ${link.download}`);
        };
        imgToDownload.onerror = () => {
            hideSpinner();
            showModal("Error preparing image for download.");
        }
        imgToDownload.src = currentImageStateForCanvas; 
    });

    // --- Reset All ---
    resetAllBtn.addEventListener('click', () => {
        showModal(
            "Are you sure you want to reset all changes? This action cannot be undone.",
            'confirmation', 
            () => { 
                if (originalImage) {
                    textObjects = []; 
                    currentImageStateForCanvas = originalImage; 
                    originalCanvasWidth = 0; originalCanvasHeight = 0; 
                    const nameWithoutExtension = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;
                    editFileNameInput.value = nameWithoutExtension || 'edited_image';

                    currentAspectRatio = NaN; 
                    clearHistory(); 
                    resetAllFiltersAndDraw(originalImage, true); 
                    updateActivePresetButton();
                    showModal('All changes have been reset.'); 
                } else {
                    resetEditorState(); 
                }
            }
        );
    });
    
    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (event) => {
        const isCtrlOrCmd = event.ctrlKey || event.metaKey;
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            if (event.key === 'Escape' && modal.classList.contains('active')) {
                closeModal();
            }
            return;
        }
        
        if (event.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        } else if (isCtrlOrCmd && event.key.toLowerCase() === 'z') {
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
