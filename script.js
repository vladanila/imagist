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
    const ctx = imageCanvas.getContext('2d');
    let cropper = null, originalImage = null, currentImageStateForCanvas = null;
    
    let originalFileName = '';
    let originalFileType = '';
    let originalCanvasWidth = 0; 
    let originalCanvasHeight = 0;
    let currentAspectRatio = NaN; // For crop presets

    let currentFilters = { brightness: 100, contrast: 100, grayscale: 0, sepia: 0, invert: 0 };

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


    // --- Main image drawing function (Commits state) ---
    function drawImageToCanvasAndCommit(sourceDataUrl, callback) {
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
            
            imagePlaceholder.style.display = 'none'; imageCanvas.style.display = 'block';
            toolsContainer.classList.remove('hidden'); 
            resetAllBtn.classList.remove('hidden');
            
            if (!cropper) {
                document.querySelectorAll('#tools-container .tool-section button, #tools-container .tool-section input, #tools-container .tool-section select').forEach(el => el.disabled = false);
            }

            resizeWidthInput.value = imageCanvas.width;
            resizeHeightInput.value = imageCanvas.height;
            updateImageInfoDisplay(); 
            if (callback) callback();
        };
        img.onerror = () => { showModal('Error loading image for canvas.'); resetEditorState(); };
        img.src = sourceDataUrl;
    }

    // --- Preview function for non-committing filter changes (e.g., sliders) ---
    function previewFiltersOnCanvas() {
        if (!currentImageStateForCanvas || cropper) return;
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

        const reader = new FileReader();
        reader.onload = (e) => {
            originalImage = e.target.result; 
            currentImageStateForCanvas = originalImage; 
            originalCanvasWidth = 0; originalCanvasHeight = 0; 
            resetAllFiltersAndDraw(currentImageStateForCanvas); 
            currentAspectRatio = NaN;
            updateActivePresetButton();
        };
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
        ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        imageCanvas.width = 0; imageCanvas.height = 0; 
        imageCanvas.style.display = 'none'; imagePlaceholder.style.display = 'block';
        toolsContainer.classList.add('hidden'); 
        resetAllBtn.classList.add('hidden');
        imageInfoDisplayDiv.classList.add('hidden'); 
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
    contrastSlider.addEventListener('input', (e) => { 
        if (cropper) return;
        currentFilters.contrast = e.target.value; 
        contrastValueDisplay.textContent = e.target.value;
        previewFiltersOnCanvas(); 
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
    function resetAllFiltersAndDraw(sourceDataUrl, callback) { 
        resetFilterControlsToDefaults();
        if (sourceDataUrl) drawImageToCanvasAndCommit(sourceDataUrl, callback);
    }

    // --- Transform Logic (Commits changes) ---
    function rotateImage(degrees) {
        if (!currentImageStateForCanvas || cropper) return;
        const img = new Image();
        img.onload = () => {
            const oldWidth = imageCanvas.width; const oldHeight = imageCanvas.height;
            let newWidth = oldWidth; let newHeight = oldHeight;
            if (degrees === 90 || degrees === -90) { newWidth = oldHeight; newHeight = oldWidth; }
            imageCanvas.width = newWidth; imageCanvas.height = newHeight;
            ctx.clearRect(0,0,newWidth, newHeight); 
            ctx.translate(newWidth / 2, newHeight / 2); ctx.rotate(degrees * Math.PI / 180);
            const tempImgForFilter = new Image(); 
            tempImgForFilter.onload = () => {
                applyCombinedFiltersToContext(); 
                ctx.drawImage(tempImgForFilter, -oldWidth / 2, -oldHeight / 2, oldWidth, oldHeight);
                ctx.setTransform(1, 0, 0, 1, 0, 0); 
                currentImageStateForCanvas = imageCanvas.toDataURL(); 
                resizeWidthInput.value = newWidth; resizeHeightInput.value = newHeight;
                updateImageInfoDisplay(); 
            }
            tempImgForFilter.src = currentImageStateForCanvas; 
        };
        img.src = currentImageStateForCanvas; 
    }
    function flipImage(direction) { 
        if (!currentImageStateForCanvas || cropper) return;
        const img = new Image();
        img.onload = () => {
            const imgWidth = imageCanvas.width; const imgHeight = imageCanvas.height;
            ctx.clearRect(0,0,imgWidth, imgHeight);
            if (direction === 'horizontal') { ctx.translate(imgWidth, 0); ctx.scale(-1, 1); } 
            else if (direction === 'vertical') { ctx.translate(0, imgHeight); ctx.scale(1, -1); }
            const tempImgForFilter = new Image();
            tempImgForFilter.onload = () => {
                applyCombinedFiltersToContext();
                ctx.drawImage(tempImgForFilter, 0, 0, imgWidth, imgHeight);
                ctx.setTransform(1, 0, 0, 1, 0, 0); 
                currentImageStateForCanvas = imageCanvas.toDataURL(); 
                updateImageInfoDisplay(); 
            }
            tempImgForFilter.src = currentImageStateForCanvas;
        };
        img.src = currentImageStateForCanvas;
    }
    rotateLeftBtn.addEventListener('click', () => rotateImage(-90));
    rotateRightBtn.addEventListener('click', () => rotateImage(90));
    flipHorizontalBtn.addEventListener('click', () => flipImage('horizontal'));
    flipVerticalBtn.addEventListener('click', () => flipImage('vertical'));

    // --- Resize Logic (Commits changes) ---
    function updateResizeInputsBasedOnAspectRatio(changedInput) { 
        if (!aspectRatioLock.checked || !imageCanvas.width || !imageCanvas.height) return;
        const currentCanvasWidth = imageCanvas.width; const currentCanvasHeight = imageCanvas.height;
        const aspectRatio = (currentCanvasWidth > 0) ? currentCanvasHeight / currentCanvasWidth : 0;
        if (changedInput === 'width') {
            const newWidth = parseInt(resizeWidthInput.value);
            if (!isNaN(newWidth) && newWidth > 0 && aspectRatio > 0) resizeHeightInput.value = Math.round(newWidth * aspectRatio);
             else if (newWidth <=0 && aspectRatio > 0) resizeHeightInput.value = ''; 
        } else if (changedInput === 'height') {
            const newHeight = parseInt(resizeHeightInput.value);
            const invAspectRatio = (currentCanvasHeight > 0) ? currentCanvasWidth / currentCanvasHeight : 0;
            if (!isNaN(newHeight) && newHeight > 0 && invAspectRatio > 0) resizeWidthInput.value = Math.round(newHeight * invAspectRatio);
            else if (newHeight <= 0 && invAspectRatio > 0) resizeWidthInput.value = ''; 
        }
    }
    resizeWidthInput.addEventListener('input', () => updateResizeInputsBasedOnAspectRatio('width'));
    resizeHeightInput.addEventListener('input', () => updateResizeInputsBasedOnAspectRatio('height'));
    resizeBtn.addEventListener('click', () => {
        if (!currentImageStateForCanvas || cropper) { showModal('Upload an image and ensure no crop is active.'); return; }
        const width = parseInt(resizeWidthInput.value); const height = parseInt(resizeHeightInput.value);
        if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) { showModal('Valid positive dimensions required.'); return; }
        const tempImg = new Image();
        tempImg.onload = () => { 
            imageCanvas.width = width; imageCanvas.height = height;
            applyCombinedFiltersToContext(); 
            ctx.drawImage(tempImg, 0, 0, width, height); 
            currentImageStateForCanvas = imageCanvas.toDataURL(); 
            updateImageInfoDisplay(); 
        };
        tempImg.src = currentImageStateForCanvas; 
    });

    // --- Crop Logic ---
    function updateActivePresetButton() {
        cropPresetButtons.forEach(button => {
            const ratio = parseFloat(button.dataset.ratio);
            if ( (isNaN(currentAspectRatio) && isNaN(ratio)) || (currentAspectRatio === ratio) ) {
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
        
        const imgForCrop = new Image();
        imgForCrop.onload = () => {
            const tempCanvasForCrop = document.createElement('canvas');
            const tempCtxForCrop = tempCanvasForCrop.getContext('2d');
            tempCanvasForCrop.width = imgForCrop.naturalWidth;
            tempCanvasForCrop.height = imgForCrop.naturalHeight;
            tempCtxForCrop.filter = `brightness(${currentFilters.brightness}%) contrast(${currentFilters.contrast}%) grayscale(${currentFilters.grayscale}%) sepia(${currentFilters.sepia}%) invert(${currentFilters.invert}%)`;
            tempCtxForCrop.drawImage(imgForCrop, 0, 0);
            const stateWithLiveFilters = tempCanvasForCrop.toDataURL();

            drawImageToCanvasAndCommit(stateWithLiveFilters, () => {
                cropper = new Cropper(imageCanvas, { 
                    aspectRatio: currentAspectRatio, 
                    viewMode: 1, background: true, autoCropArea: 0.8, responsive: true,
                    modal: true, guides: true, center: true, highlight: true,
                    cropBoxMovable: true, cropBoxResizable: true,
                });
                setCropUIVisible(true);
            });
        };
        imgForCrop.src = currentImageStateForCanvas; 
    });
    confirmCropBtn.addEventListener('click', () => {
        if (!cropper) return;
        const croppedCanvas = cropper.getCroppedCanvas();
        const croppedDataUrl = croppedCanvas.toDataURL(fileFormatSelect.value === 'image/jpeg' ? 'image/jpeg' : 'image/png');
        cropper.destroy(); cropper = null;
        setCropUIVisible(false);
        currentImageStateForCanvas = croppedDataUrl; 
        resetAllFiltersAndDraw(currentImageStateForCanvas); 
        showModal('Image cropped.');
    });
    cancelCropBtn.addEventListener('click', () => {
        if (!cropper) return;
        cropper.destroy(); cropper = null;
        setCropUIVisible(false);
        drawImageToCanvasAndCommit(currentImageStateForCanvas); 
    });

    // --- Format & Download ---
    fileFormatSelect.addEventListener('change', () => {
        jpegQualitySection.classList.toggle('hidden', fileFormatSelect.value !== 'image/jpeg');
    });
    jpegQualitySlider.addEventListener('input', (e) => { jpegQualityValueDisplay.textContent = parseFloat(e.target.value).toFixed(2); });
    downloadBtn.addEventListener('click', () => {
        if (!currentImageStateForCanvas) { showModal('No image to download.'); return; }
        if (cropper) { showModal('Confirm or cancel crop first.'); return;}
        
        const imgToDownload = new Image();
        imgToDownload.onload = () => {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = imgToDownload.naturalWidth;
            tempCanvas.height = imgToDownload.naturalHeight;
            tempCtx.filter = `brightness(${currentFilters.brightness}%) contrast(${currentFilters.contrast}%) grayscale(${currentFilters.grayscale}%) sepia(${currentFilters.sepia}%) invert(${currentFilters.invert}%)`;
            tempCtx.drawImage(imgToDownload, 0, 0);

            const format = fileFormatSelect.value;
            const quality = (format === 'image/jpeg') ? parseFloat(jpegQualitySlider.value) : undefined;
            const dataURL = tempCanvas.toDataURL(format, quality); 
            const link = document.createElement('a');
            const extension = format.split('/')[1];
            link.download = `Imagist_edited.${extension}`;
            link.href = dataURL;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            showModal(`Image downloaded as Imagist_edited.${extension}`);
        };
        imgToDownload.src = currentImageStateForCanvas; 
    });

    // --- Reset All ---
    resetAllBtn.addEventListener('click', () => {
        if (originalImage) {
            currentImageStateForCanvas = originalImage; 
            originalCanvasWidth = 0; originalCanvasHeight = 0; 
            originalFileName = ''; originalFileType = ''; 
            currentAspectRatio = NaN; 
            resetAllFiltersAndDraw(originalImage); 
            updateActivePresetButton();
            showModal('All changes reset.');
        } else {
            resetEditorState(); 
        }
    });
    
    resetEditorState(); 
});
