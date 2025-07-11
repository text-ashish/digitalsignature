// Canvas setup
const canvas = document.getElementById('signatureCanvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvasContainer');
const canvasOverlay = document.getElementById('canvasOverlay');

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let brushSize = 3;
let currentColor = '#000';
let signatureHistory = [];
let historyStep = -1;
let points = [];
let allStrokes = [];
let currentStroke = [];
let startTime = Date.now();
let strokeCount = 0;

// Initialize canvas
function initCanvas() {
    const rect = canvasContainer.getBoundingClientRect();
    canvas.width = rect.width - 32; // Account for padding
    canvas.height = 200;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    
    // Set white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    saveState();
}

// Save canvas state for undo functionality
function saveState() {
    historyStep++;
    if (historyStep < signatureHistory.length) {
        signatureHistory.length = historyStep;
    }
    signatureHistory.push(canvas.toDataURL());
}

// Mouse events
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// Touch events
canvas.addEventListener('touchstart', handleTouch);
canvas.addEventListener('touchmove', handleTouch);
canvas.addEventListener('touchend', stopDrawing);

function startDrawing(e) {
    isDrawing = true;
    currentStroke = [];
    canvasContainer.classList.add('active');
    canvasOverlay.classList.add('hidden');
    
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
    
    currentStroke.push([lastX, lastY]);
    points.push([lastX, lastY]);
}

function draw(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    currentStroke.push([currentX, currentY]);
    points.push([currentX, currentY]);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    lastX = currentX;
    lastY = currentY;
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    canvasContainer.classList.remove('active');
    
    if (currentStroke.length > 0) {
        allStrokes.push([...currentStroke]);
        strokeCount++;
        updateStats();
    }
    
    saveState();
}

function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 
                                   e.type === 'touchmove' ? 'mousemove' : 'mouseup', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

// Update statistics
function updateStats() {
    document.getElementById('strokeCount').textContent = strokeCount;
    const timeElapsed = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('timeSpent').textContent = timeElapsed + 's';
}

// Brush size control
document.getElementById('brushSize').addEventListener('input', function(e) {
    brushSize = e.target.value;
    ctx.lineWidth = brushSize;
    document.getElementById('brushSizeValue').textContent = brushSize + 'px';
});

// Color picker
document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', function() {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        this.classList.add('active');
        currentColor = this.dataset.color;
        ctx.strokeStyle = currentColor;
    });
});

// Clear signature
function clearSignature() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    canvasOverlay.classList.remove('hidden');
    canvasContainer.classList.remove('active');
    
    // Reset all tracking variables
    points = [];
    allStrokes = [];
    currentStroke = [];
    strokeCount = 0;
    startTime = Date.now();
    updateStats();
    
    saveState();
    showNotification('Signature cleared!');
}

// Undo function
function undoSignature() {
    if (historyStep > 0) {
        historyStep--;
        const img = new Image();
        img.onload = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = signatureHistory[historyStep];
        showNotification('Undo successful!');
    } else {
        showNotification('Nothing to undo!', 'error');
    }
}

// Redo function
function redoSignature() {
    if (historyStep < signatureHistory.length - 1) {
        historyStep++;
        const img = new Image();
        img.onload = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = signatureHistory[historyStep];
        showNotification('Redo successful!');
    } else {
        showNotification('Nothing to redo!', 'error');
    }
}

// Load manual signature
function loadManualSignature(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Scale image to fit canvas
                const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                const x = (canvas.width - img.width * scale) / 2;
                const y = (canvas.height - img.height * scale) / 2;
                
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                canvasOverlay.classList.add('hidden');
                canvasContainer.classList.add('active');
                saveState();
                showNotification('Signature uploaded successfully!');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Enhanced smooth signature function with fallback
async function smoothSignature() {
    if (points.length === 0 && allStrokes.length === 0) {
        showNotification('Nothing to enhance! Please draw something first.', 'error');
        return;
    }

    showLoading(true);
    
    try {
        // Try to use Perfect Freehand if available
        if (window.perfectFreehand && window.perfectFreehand.getStroke) {
            await enhanceWithPerfectFreehand();
        } else {
            // Fallback to basic smoothing
            await enhanceWithBasicSmoothing();
        }
        
        showNotification('Signature enhanced successfully!');
        saveState();
    } catch (error) {
        console.error('Enhancement error:', error);
        showNotification('Enhancement failed, trying basic smoothing...', 'error');
        
        // Try fallback method
        try {
            await enhanceWithBasicSmoothing();
            showNotification('Signature enhanced with basic smoothing!');
            saveState();
        } catch (fallbackError) {
            console.error('Fallback enhancement error:', fallbackError);
            showNotification('Failed to enhance signature. Please try again.', 'error');
        }
    } finally {
        showLoading(false);
    }
}

// Enhanced smoothing with Perfect Freehand
async function enhanceWithPerfectFreehand() {
    return new Promise((resolve, reject) => {
        try {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Process each stroke separately
            allStrokes.forEach(stroke => {
                if (stroke.length > 1) {
                    const smoothedStroke = window.perfectFreehand.getStroke(stroke, {
                        size: brushSize * 2,
                        thinning: 0.5,
                        smoothing: 0.5,
                        streamline: 0.5,
                        simulatePressure: true
                    });

                    if (smoothedStroke.length > 0) {
                        drawSmoothPath(smoothedStroke);
                    }
                }
            });

            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

// Basic smoothing fallback
async function enhanceWithBasicSmoothing() {
    return new Promise((resolve, reject) => {
        try {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Apply basic smoothing to each stroke
            allStrokes.forEach(stroke => {
                if (stroke.length > 2) {
                    const smoothedStroke = applyBasicSmoothing(stroke);
                    drawBasicSmoothPath(smoothedStroke);
                }
            });

            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

// Basic smoothing algorithm
function applyBasicSmoothing(points) {
    if (points.length < 3) return points;
    
    const smoothed = [points[0]];
    
    for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];
        
        const smoothedX = (prev[0] + curr[0] + next[0]) / 3;
        const smoothedY = (prev[1] + curr[1] + next[1]) / 3;
        
        smoothed.push([smoothedX, smoothedY]);
    }
    
    smoothed.push(points[points.length - 1]);
    return smoothed;
}

// Draw smooth path for Perfect Freehand
function drawSmoothPath(stroke) {
    if (stroke.length === 0) return;
    
    ctx.beginPath();
    ctx.moveTo(stroke[0][0], stroke[0][1]);
    
    for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i][0], stroke[i][1]);
    }
    
    ctx.closePath();
    ctx.fillStyle = currentColor;
    ctx.fill();
}

// Draw basic smooth path
function drawBasicSmoothPath(stroke) {
    if (stroke.length === 0) return;
    
    ctx.beginPath();
    ctx.moveTo(stroke[0][0], stroke[0][1]);
    
    for (let i = 1; i < stroke.length - 1; i++) {
        const currentPoint = stroke[i];
        const nextPoint = stroke[i + 1];
        const cpx = (currentPoint[0] + nextPoint[0]) / 2;
        const cpy = (currentPoint[1] + nextPoint[1]) / 2;
        
        ctx.quadraticCurveTo(currentPoint[0], currentPoint[1], cpx, cpy);
    }
    
    ctx.lineTo(stroke[stroke.length - 1][0], stroke[stroke.length - 1][1]);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.stroke();
}

// Download signature
function downloadSignature() {
    const format = document.getElementById('formatSelect').value;
    const isEmpty = isCanvasEmpty();
    
    if (isEmpty) {
        showNotification('Please create a signature first!', 'error');
        return;
    }
    
    showLoading(true);
    
    setTimeout(() => {
        try {
            if (format === 'pdf') {
                downloadAsPDF();
            } else if (format === 'svg') {
                downloadAsSVG();
            } else {
                downloadAsImage(format);
            }
            showNotification(`Signature downloaded as ${format.toUpperCase()}!`);
        } catch (error) {
            console.error('Download error:', error);
            showNotification('Error downloading signature!', 'error');
        } finally {
            showLoading(false);
        }
    }, 1000);
}

function downloadAsImage(format) {
    const link = document.createElement('a');
    link.download = `signature.${format}`;
    
    if (format === 'png') {
        link.href = canvas.toDataURL('image/png');
    } else if (format === 'jpg') {
        // Create a new canvas with white background for JPG
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Fill with white background
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw the signature on top
        tempCtx.drawImage(canvas, 0, 0);
        
        link.href = tempCanvas.toDataURL('image/jpeg', 0.95);
    }
    
    link.click();
}

function downloadAsSVG() {
    const svgData = generateSVG();
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.download = 'signature.svg';
    link.href = url;
    link.click();
    
    URL.revokeObjectURL(url);
}

function generateSVG() {
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
            <rect width="100%" height="100%" fill="white"/>
            <image href="${canvas.toDataURL()}" width="${canvas.width}" height="${canvas.height}"/>
        </svg>
    `;
    return svg;
}

function downloadAsPDF() {
    if (typeof html2pdf === 'undefined') {
        showNotification('PDF export not available. Please download as PNG instead.', 'error');
        return;
    }
    
    const imgData = canvas.toDataURL('image/png');
    const opt = {
        margin: 1,
        filename: 'signature.pdf',
        image: { type: 'png', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    const element = document.createElement('div');
    element.innerHTML = `<img src="${imgData}" style="width: 100%; max-width: 400px;">`;
    html2pdf().from(element).set(opt).save();
}

function isCanvasEmpty() {
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    const blankCtx = blank.getContext('2d');
    blankCtx.fillStyle = 'white';
    blankCtx.fillRect(0, 0, blank.width, blank.height);
    
    return canvas.toDataURL() === blank.toDataURL();
}

// Drag and drop functionality
const uploadArea = document.querySelector('.upload-area');

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        const input = document.getElementById('uploadSignature');
        input.files = files;
        loadManualSignature(input);
    }
});

// Utility functions
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    notificationText.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.toggle('show', show);
    }
}

// Create floating particles
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        particlesContainer.appendChild(particle);
    }
}

// Initialize on page load
window.addEventListener('load', () => {
    initCanvas();
    createParticles();
    updateStats();
});

window.addEventListener('resize', () => {
    setTimeout(initCanvas, 100);
});

// Load Perfect Freehand library dynamically
(function loadPerfectFreehand() {
    if (window.perfectFreehand) return;
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/perfect-freehand@1.0.3/dist/perfect-freehand.min.js';
    script.onload = () => {
        console.log('Perfect Freehand library loaded successfully');
    };
    script.onerror = () => {
        console.warn('Perfect Freehand library failed to load, will use basic smoothing');
    };
    document.head.appendChild(script);
})();