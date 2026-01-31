<template>
  <div class="whiteboard-container">
    <canvas
      ref="canvasRef"
      class="whiteboard-canvas"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @wheel="onWheel"
    ></canvas>
    
    <!-- Bottom Toolbar - Minimalist MD3 Style -->
    <div class="toolbar-bottom">
      <!-- Left Section: Lock Button -->
      <div class="toolbar-section toolbar-left">
        <button 
          class="tool-btn"
          :class="{ active: isLocked }"
          @click="toggleLock"
          title="Lock/Unlock Canvas"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect v-if="!isLocked" x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path v-if="!isLocked" d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            <rect v-if="isLocked" x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path v-if="isLocked" d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </button>
      </div>

      <!-- Center Section: Mode Switcher -->
      <div class="toolbar-section toolbar-center">
        <button 
          class="tool-btn mode-btn"
          :class="{ active: currentTool === 'pen' }"
          @click="selectTool('pen')"
          title="Pen Tool"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
            <path d="M2 2l7.586 7.586"></path>
            <circle cx="11" cy="11" r="2"></circle>
          </svg>
        </button>
        
        <button 
          class="tool-btn mode-btn"
          :class="{ active: currentTool === 'eraser' }"
          @click="selectTool('eraser')"
          title="Eraser Tool"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 20H7L3 16c-1-1-1-2.5 0-3.5L11 4c1-1 2.5-1 3.5 0l5.5 5.5c1 1 1 2.5 0 3.5L13 20"></path>
            <path d="M6 17l5 5"></path>
          </svg>
        </button>

        <!-- Pen Settings Popup -->
        <div v-if="showPenPopup" class="pen-popup" @click.stop>
          <div class="popup-row">
            <label>Size</label>
            <input 
              type="range" 
              v-model.number="brushWidth" 
              min="1" 
              max="20"
              class="size-slider"
            />
            <span class="value-display">{{ brushWidth }}</span>
          </div>
          <div class="popup-row">
            <label>Color</label>
            <div class="color-picker-wrapper">
              <input 
                type="color" 
                v-model="brushColor"
                class="color-input"
                id="colorPicker"
              />
              <label for="colorPicker" class="color-preview" :style="{ background: brushColor }"></label>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Section: Page Navigation -->
      <div class="toolbar-section toolbar-right">
        <button 
          class="tool-btn"
          @click="newPage"
          title="New Page"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="11" x2="12" y2="17"></line>
            <line x1="9" y1="14" x2="15" y2="14"></line>
          </svg>
        </button>
        
        <button 
          class="tool-btn"
          @click="previousPage"
          :disabled="currentPage <= 1"
          title="Previous Page"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        
        <div class="page-indicator">
          {{ currentPage }} / {{ totalPages }}
        </div>
        
        <button 
          class="tool-btn"
          @click="nextPage"
          :disabled="currentPage >= totalPages"
          title="Next Page"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </div>

    <!-- Renderer Info (subtle, top-right corner) -->
    <div class="renderer-info">
      <select v-model="rendererType" @change="switchRenderer" class="renderer-select">
        <option value="webgpu">WebGPU</option>
        <option value="canvas">Canvas 2D</option>
      </select>
      <span class="info-text">{{ fps }} FPS</span>
    </div>

    <div v-if="!webgpuSupported && rendererType === 'webgpu'" class="warning-overlay">
      <div class="warning-message">
        <h3>WebGPU Not Available</h3>
        <p>WebGPU requires Electron 28+ with Vulkan enabled.</p>
        <p>Falling back to Canvas 2D renderer.</p>
        <button @click="handleFallbackToCanvas2D">Use Canvas 2D</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { WebGPURenderer } from '../core/WebGPURenderer.js'
import { GPUStrokeManager } from '../core/GPUStrokeManager.js'
import { Viewport } from '../core/Viewport.js'

// Legacy imports for Canvas 2D fallback
import { TileManager, TILE_SIZE } from '../core/TileSystem.js'
import { StrokeManager } from '../core/StrokeManager.js'

const canvasRef = ref(null)
const brushColor = ref('#1F1F1F')
const brushWidth = ref(2)
const pointCount = ref(0)
const fps = ref(0)
const rendererType = ref('webgpu')
const webgpuSupported = ref(true)
const isWebGPU = ref(false)

// New toolbar state
const isLocked = ref(false)
const currentTool = ref('pen')
const showPenPopup = ref(false)
const currentPage = ref(1)
const totalPages = ref(1)
const pages = ref([]) // Store page data

let canvas = null
let webgpuRenderer = null
let gpuStrokeManager = null

// Canvas 2D fallback
let ctx = null
let liveCanvas = null
let liveCtx = null
let tileManager = null
let strokeManager = null

let viewport = null
const activePointers = new Map()
let isPanning = false
let lastPanPos = null
let animationId = null

// FPS tracking
let lastFrameTime = 0
let frameCount = 0

// Watch for pen tool selection to show/hide popup
watch(currentTool, (newTool) => {
  if (newTool === 'pen') {
    showPenPopup.value = true
  } else {
    showPenPopup.value = false
  }
})

// Close popup when clicking outside
const handleClickOutside = (event) => {
  if (showPenPopup.value && !event.target.closest('.toolbar-center')) {
    showPenPopup.value = false
  }
}

onMounted(async () => {
  canvas = canvasRef.value
  viewport = new Viewport(window.innerWidth, window.innerHeight)
  
  // Initialize first page
  pages.value = [{ strokes: [] }]
  
  // Try to initialize WebGPU
  await initializeRenderer()
  
  // Setup canvas
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  window.addEventListener('click', handleClickOutside)
  
  // Start render loop
  render()
  
  // Listen for clear canvas event from main process
  if (window.electronAPI) {
    window.electronAPI.onClearCanvas(() => {
      clearCanvas()
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
  window.removeEventListener('click', handleClickOutside)
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  if (webgpuRenderer) {
    webgpuRenderer.destroy()
  }
})

async function initializeRenderer() {
  if (rendererType.value === 'webgpu') {
    try {
      webgpuRenderer = new WebGPURenderer()
      await webgpuRenderer.initialize(canvas)
      gpuStrokeManager = new GPUStrokeManager()
      isWebGPU.value = true
      webgpuSupported.value = true
      console.log('✅ WebGPU renderer initialized')
    } catch (err) {
      console.warn('WebGPU not available, falling back to Canvas 2D:', err.message)
      if (webgpuRenderer && typeof webgpuRenderer.destroy === 'function') {
        try {
          webgpuRenderer.destroy()
        } catch (error) {
          console.warn('Failed to clean up WebGPU renderer during Canvas 2D fallback:', error)
        }
        webgpuRenderer = null
      }
      webgpuSupported.value = false
      rendererType.value = 'canvas'
      initializeCanvas2D()
    }
  } else {
    initializeCanvas2D()
  }
}

function initializeCanvas2D() {
  ctx = canvas.getContext('2d', { alpha: false })
  liveCanvas = document.createElement('canvas')
  liveCtx = liveCanvas.getContext('2d', { willReadFrequently: false })
  tileManager = new TileManager()
  strokeManager = new StrokeManager()
  isWebGPU.value = false
  console.log('✅ Canvas 2D renderer initialized')
}

async function switchRenderer() {
  // Clear current renderer
  if (webgpuRenderer) {
    webgpuRenderer.destroy()
    webgpuRenderer = null
  }
  
  // Clear canvas
  clearCanvas()
  
  // Initialize new renderer
  await initializeRenderer()
  resizeCanvas()
}

function resizeCanvas() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  
  if (liveCanvas) {
    liveCanvas.width = canvas.width
    liveCanvas.height = canvas.height
  }
  
  if (webgpuRenderer) {
    webgpuRenderer.resize(canvas.width, canvas.height)
  }
  
  viewport.resize(canvas.width, canvas.height)
}

function render() {
  const now = performance.now()
  
  // Calculate FPS
  frameCount++
  if (now - lastFrameTime >= 1000) {
    fps.value = frameCount
    frameCount = 0
    lastFrameTime = now
  }
  
  if (isWebGPU.value && webgpuRenderer) {
    // WebGPU rendering path
    const gpuPoints = gpuStrokeManager.getAllGPUPoints()
    pointCount.value = gpuPoints.length
    
    if (gpuPoints.length > 0) {
      webgpuRenderer.render(gpuPoints, viewport)
    }
  } else if (ctx && tileManager) {
    // Canvas 2D rendering path (legacy)
    renderCanvas2D()
  }
  
  animationId = requestAnimationFrame(render)
}

function renderCanvas2D() {
  // Clear main canvas
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  ctx.save()
  
  // Apply viewport transform
  ctx.scale(viewport.scale, viewport.scale)
  ctx.translate(-viewport.x, -viewport.y)
  
  // Render tile cache layer
  const visibleTiles = tileManager.renderTiles(
    strokeManager.getAllStrokes(),
    viewport
  )
  
  for (const tile of visibleTiles) {
    const worldX = tile.x * TILE_SIZE
    const worldY = tile.y * TILE_SIZE
    ctx.drawImage(tile.canvas, worldX, worldY)
  }
  
  // Render live layer
  liveCtx.clearRect(0, 0, liveCanvas.width, liveCanvas.height)
  liveCtx.save()
  liveCtx.scale(viewport.scale, viewport.scale)
  liveCtx.translate(-viewport.x, -viewport.y)
  
  activePointers.forEach((pointerData) => {
    const stroke = pointerData.stroke
    if (!stroke || stroke.points.length < 2) return
    
    liveCtx.beginPath()
    liveCtx.strokeStyle = stroke.color
    liveCtx.lineWidth = stroke.width
    liveCtx.lineCap = 'round'
    liveCtx.lineJoin = 'round'
    
    liveCtx.moveTo(stroke.points[0].x, stroke.points[0].y)
    for (let i = 1; i < stroke.points.length; i++) {
      liveCtx.lineTo(stroke.points[i].x, stroke.points[i].y)
    }
    liveCtx.stroke()
  })
  
  liveCtx.restore()
  ctx.restore()
  ctx.drawImage(liveCanvas, 0, 0)
  
  pointCount.value = Array.from(strokeManager.getAllStrokes().values())
    .reduce((sum, stroke) => sum + stroke.points.length, 0)
}

function onPointerDown(event) {
  event.preventDefault()
  
  // Don't allow drawing if locked
  if (isLocked.value) {
    return
  }
  
  canvas.setPointerCapture(event.pointerId)
  
  // Right/middle mouse buttons pan; non-mouse pointers skip this path.
  if (event.pointerType === 'mouse' && (event.button === 1 || event.button === 2)) {
    isPanning = true
    lastPanPos = { x: event.clientX, y: event.clientY }
    return
  }
  
  // Non-mouse inputs use primary contact, while mouse inputs require the left button.
  const shouldInitiateDrawing = event.pointerType === 'mouse' ? event.button === 0 : event.isPrimary
  
  // Primary contact for drawing (pen only, eraser handled separately)
  if (shouldInitiateDrawing && currentTool.value === 'pen') {
    const worldPos = viewport.screenToWorld(event.clientX, event.clientY)
    
    if (isWebGPU.value) {
      const stroke = gpuStrokeManager.startStroke(
        worldPos.x,
        worldPos.y,
        brushColor.value,
        brushWidth.value
      )
      activePointers.set(event.pointerId, { stroke })
    } else {
      const stroke = strokeManager.startStroke(
        worldPos.x,
        worldPos.y,
        brushColor.value,
        brushWidth.value
      )
      activePointers.set(event.pointerId, { stroke, lastPos: worldPos })
    }
  }
}

function onPointerMove(event) {
  event.preventDefault()
  
  if (isPanning && lastPanPos) {
    const deltaX = event.clientX - lastPanPos.x
    const deltaY = event.clientY - lastPanPos.y
    viewport.pan(deltaX, deltaY)
    lastPanPos = { x: event.clientX, y: event.clientY }
    return
  }
  
  const pointerData = activePointers.get(event.pointerId)
  if (!pointerData || !pointerData.stroke) return
  
  const worldPos = viewport.screenToWorld(event.clientX, event.clientY)
  
  if (isWebGPU.value) {
    gpuStrokeManager.addPoint(worldPos.x, worldPos.y)
  } else {
    strokeManager.addPointToStroke(pointerData.stroke, worldPos.x, worldPos.y)
    pointerData.lastPos = worldPos
  }
}

function onPointerUp(event) {
  event.preventDefault()
  canvas.releasePointerCapture(event.pointerId)
  
  if (isPanning) {
    isPanning = false
    lastPanPos = null
    return
  }
  
  const pointerData = activePointers.get(event.pointerId)
  if (pointerData && pointerData.stroke) {
    if (isWebGPU.value) {
      gpuStrokeManager.finishStroke()
    } else {
      const finishedStroke = strokeManager.finishStroke(pointerData.stroke)
      
      if (finishedStroke && finishedStroke.bounds) {
        const affectedTiles = tileManager.getAffectedTiles(finishedStroke.bounds)
        affectedTiles.forEach(tile => {
          tile.addStroke(finishedStroke.id)
        })
      }
    }
    
    activePointers.delete(event.pointerId)
  }
}

function onPointerCancel(event) {
  onPointerUp(event)
}

function onWheel(event) {
  event.preventDefault()
  viewport.zoom(event.deltaY, event.clientX, event.clientY)
}

function clearCanvas() {
  if (isWebGPU.value) {
    gpuStrokeManager.clear()
  } else {
    strokeManager.clear()
    tileManager.clearAll()
  }
  activePointers.clear()
  pointCount.value = 0
}

function resetView() {
  viewport.reset()
}

function handleFallbackToCanvas2D() {
  rendererType.value = 'canvas'
  switchRenderer()
}

// Toolbar functions
function toggleLock() {
  isLocked.value = !isLocked.value
}

function selectTool(tool) {
  currentTool.value = tool
  if (tool === 'pen') {
    showPenPopup.value = true
  } else {
    showPenPopup.value = false
  }
}

function newPage() {
  // Save current page state
  savePage()
  
  // Add new page
  pages.value.push({ strokes: [] })
  currentPage.value = pages.value.length
  totalPages.value = pages.value.length
  
  // Clear canvas for new page
  clearCanvas()
}

function previousPage() {
  if (currentPage.value > 1) {
    savePage()
    currentPage.value--
    loadPage(currentPage.value - 1)
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    savePage()
    currentPage.value++
    loadPage(currentPage.value - 1)
  }
}

function savePage() {
  // Save current strokes to page
  if (isWebGPU.value) {
    pages.value[currentPage.value - 1] = {
      strokes: gpuStrokeManager.getAllGPUPoints()
    }
  } else {
    pages.value[currentPage.value - 1] = {
      strokes: Array.from(strokeManager.getAllStrokes().values())
    }
  }
}

function loadPage(index) {
  clearCanvas()
  // Load page strokes
  const pageData = pages.value[index]
  if (pageData && pageData.strokes) {
    // TODO: Implement stroke loading
    // For now, just clear the canvas
  }
}

</script>

<style scoped>
/* Material Design 3 Color Tokens - Monet Style */
:root {
  --md-sys-color-primary: #006494;
  --md-sys-color-on-primary: #ffffff;
  --md-sys-color-surface: #fafafa;
  --md-sys-color-on-surface: #1f1f1f;
  --md-sys-color-outline: #73777f;
  --md-sys-color-surface-variant: #e7e0ec;
}

.whiteboard-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #fafafa;
}

.whiteboard-canvas {
  display: block;
  cursor: crosshair;
  touch-action: none;
}

/* Bottom Toolbar - Minimalist Design */
.toolbar-bottom {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 32px;
  align-items: center;
  background: var(--md-sys-color-surface);
  border: 1px solid var(--md-sys-color-outline);
  padding: 12px 24px;
  z-index: 1000;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-left {
  padding-right: 16px;
  border-right: 1px solid var(--md-sys-color-outline);
}

.toolbar-center {
  position: relative;
  padding: 0 16px;
  border-right: 1px solid var(--md-sys-color-outline);
  gap: 12px;
}

.toolbar-right {
  padding-left: 16px;
  gap: 8px;
}

/* Tool Buttons - Flat, No Shadow */
.tool-btn {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--md-sys-color-on-surface);
  cursor: pointer;
  transition: background-color 0.2s ease;
  padding: 0;
}

.tool-btn:hover {
  background: rgba(0, 100, 148, 0.08);
}

.tool-btn.active {
  background: rgba(0, 100, 148, 0.12);
  color: var(--md-sys-color-primary);
}

.tool-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.tool-btn:disabled:hover {
  background: transparent;
}

.tool-btn svg {
  width: 24px;
  height: 24px;
}

/* Page Indicator */
.page-indicator {
  padding: 0 16px;
  font-size: 14px;
  color: var(--md-sys-color-on-surface);
  font-weight: 500;
  min-width: 70px;
  text-align: center;
}

/* Pen Settings Popup */
.pen-popup {
  position: absolute;
  bottom: 70px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--md-sys-color-surface);
  border: 1px solid var(--md-sys-color-outline);
  padding: 20px;
  min-width: 240px;
  z-index: 1001;
}

.popup-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.popup-row:last-child {
  margin-bottom: 0;
}

.popup-row label {
  font-size: 14px;
  color: var(--md-sys-color-on-surface);
  min-width: 50px;
  font-weight: 500;
}

.size-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--md-sys-color-outline);
  outline: none;
}

.size-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: var(--md-sys-color-primary);
  cursor: pointer;
  border: none;
}

.size-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: var(--md-sys-color-primary);
  cursor: pointer;
  border: none;
}

.value-display {
  font-size: 14px;
  color: var(--md-sys-color-on-surface);
  min-width: 30px;
  text-align: right;
  font-weight: 500;
}

.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.color-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.color-preview {
  width: 40px;
  height: 40px;
  border: 2px solid var(--md-sys-color-outline);
  cursor: pointer;
  display: block;
  transition: border-color 0.2s ease;
}

.color-preview:hover {
  border-color: var(--md-sys-color-primary);
}

/* Renderer Info - Subtle Top Right */
.renderer-info {
  position: fixed;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--md-sys-color-on-surface);
  z-index: 999;
}

.renderer-select {
  padding: 4px 8px;
  border: 1px solid var(--md-sys-color-outline);
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  font-size: 12px;
  cursor: pointer;
  outline: none;
}

.renderer-select:hover {
  border-color: var(--md-sys-color-primary);
}

.info-text {
  color: var(--md-sys-color-on-surface);
  opacity: 0.6;
}

/* Warning Overlay */
.warning-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.warning-message {
  background: var(--md-sys-color-surface);
  padding: 24px;
  border: 1px solid var(--md-sys-color-outline);
  max-width: 400px;
}

.warning-message h3 {
  margin: 0 0 12px 0;
  color: var(--md-sys-color-on-surface);
  font-size: 18px;
  font-weight: 500;
}

.warning-message p {
  margin: 8px 0;
  color: var(--md-sys-color-on-surface);
  font-size: 14px;
  opacity: 0.87;
}

.warning-message button {
  margin-top: 16px;
  padding: 8px 16px;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border: none;
  cursor: pointer;
  font-size: 14px;
}

.warning-message button:hover {
  background: #005080;
}
</style>
