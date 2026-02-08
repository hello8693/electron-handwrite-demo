<template>
  <div class="whiteboard-container">
    <canvas
      ref="staticCanvasRef"
      class="whiteboard-canvas static-layer"
    ></canvas>
    <canvas
      ref="canvasRef"
      class="whiteboard-canvas live-layer"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
      @dragstart.prevent
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
            <label>Smooth</label>
            <input 
              type="range" 
              v-model.number="smoothness" 
              min="0.1" 
              max="0.6"
              step="0.05"
              class="size-slider"
            />
            <span class="value-display">{{ smoothness.toFixed(2) }}</span>
          </div>
          <div class="popup-row toggle-row">
            <label>Smooth On</label>
            <input type="checkbox" v-model="smoothingEnabled" class="toggle-input" />
          </div>
          <div class="popup-row">
            <label>Speed</label>
            <input 
              type="range" 
              v-model.number="speedLow" 
              min="0.05" 
              max="1.0"
              step="0.05"
              class="size-slider"
            />
            <span class="value-display">{{ speedLow.toFixed(2) }}</span>
          </div>
          <div class="popup-row">
            <label>Speed+</label>
            <input 
              type="range" 
              v-model.number="speedHigh" 
              min="0.6" 
              max="3.0"
              step="0.1"
              class="size-slider"
            />
            <span class="value-display">{{ speedHigh.toFixed(2) }}</span>
          </div>
          <div class="popup-row">
            <label>MinSm</label>
            <input 
              type="range" 
              v-model.number="minSmooth" 
              min="0.05" 
              max="0.6"
              step="0.05"
              class="size-slider"
            />
            <span class="value-display">{{ minSmooth.toFixed(2) }}</span>
          </div>
          <div class="popup-row">
            <label>MaxSm</label>
            <input 
              type="range" 
              v-model.number="maxSmooth" 
              min="0.2" 
              max="0.95"
              step="0.05"
              class="size-slider"
            />
            <span class="value-display">{{ maxSmooth.toFixed(2) }}</span>
          </div>
          <div class="popup-row">
            <label>Wmin</label>
            <input 
              type="range" 
              v-model.number="minWidthScale" 
              min="0.2" 
              max="1.2"
              step="0.05"
              class="size-slider"
            />
            <span class="value-display">{{ minWidthScale.toFixed(2) }}</span>
          </div>
          <div class="popup-row">
            <label>Wmax</label>
            <input 
              type="range" 
              v-model.number="maxWidthScale" 
              min="0.8" 
              max="2.4"
              step="0.05"
              class="size-slider"
            />
            <span class="value-display">{{ maxWidthScale.toFixed(2) }}</span>
          </div>
          <div class="popup-row">
            <label>Curve</label>
            <input 
              type="range" 
              v-model.number="curvatureBoost" 
              min="0" 
              max="1"
              step="0.05"
              class="size-slider"
            />
            <span class="value-display">{{ curvatureBoost.toFixed(2) }}</span>
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

      <!-- Right Section: Save/Load and Page Navigation -->
      <div class="toolbar-section toolbar-right">
        <!-- Save/Load buttons -->
        <button 
          class="tool-btn"
          @click="saveToISF"
          title="Save to ISF (WPF Format)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
        </button>
        
        <button 
          class="tool-btn"
          @click="loadFromISF"
          title="Load from ISF (WPF Format)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <path d="M12 18v-6"></path>
            <polyline points="9 15 12 18 15 15"></polyline>
          </svg>
        </button>

        <div class="toolbar-divider"></div>

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
import { loadInkWasm, createInkWorker } from '../core/WasmInkEngine.js'
import { createTileBakeWorker } from '../core/TileBakeWorker.js'

// Legacy imports for Canvas 2D fallback
import { TileManager, TILE_SIZE } from '../core/TileSystem.js'
import { StrokeManager } from '../core/StrokeManager.js'

const canvasRef = ref(null)
const staticCanvasRef = ref(null)
const brushColor = ref('#1F1F1F')
const brushWidth = ref(2)
const smoothness = ref(0.2)
const smoothingEnabled = ref(true)
const speedLow = ref(0.2)
const speedHigh = ref(1.6)
const minSmooth = ref(0.12)
const maxSmooth = ref(0.55)
const minWidthScale = ref(0.45)
const maxWidthScale = ref(1.35)
const curvatureBoost = ref(0.5)
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

const supportsPointerEvents = typeof window !== 'undefined' && 'PointerEvent' in window

let canvas = null
let webgpuRenderer = null
let gpuStrokeManager = null
let inkWorker = null
let tileBakeWorker = null

let staticCanvas = null
let staticCtx = null
let staticTileManager = null
let staticStrokes = null

// Canvas 2D fallback
let ctx = null
let liveCanvas = null
let liveCtx = null
let tileManager = null
let strokeManager = null
let eraseStrokeManager = null
let eraseStrokes = null

let viewport = null
const activePointers = new Map()
let isPanning = false
let lastPanPos = null
let animationId = null
let dpr = 1
let tileDpr = 1
let zoomRebakeTimer = null
let pendingTileDpr = null

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

watch(smoothness, (value) => {
  if (gpuStrokeManager) {
    gpuStrokeManager.setSmoothing({ spacingFactor: value })
  }
})

watch(smoothingEnabled, (value) => {
  if (gpuStrokeManager) {
    gpuStrokeManager.setSmoothingEnabled(value)
  }
})


watch([speedLow, speedHigh, minSmooth, maxSmooth, minWidthScale, maxWidthScale, curvatureBoost], () => {
  if (gpuStrokeManager) {
    gpuStrokeManager.setSmoothing({
      speedLow: speedLow.value,
      speedHigh: speedHigh.value,
      minSmooth: minSmooth.value,
      maxSmooth: maxSmooth.value,
      minWidthScale: minWidthScale.value,
      maxWidthScale: maxWidthScale.value,
      curvatureBoost: curvatureBoost.value
    })
  }
})

// Close popup when clicking outside
const handleClickOutside = (event) => {
  if (showPenPopup.value && !event.target.closest('.toolbar-center')) {
    showPenPopup.value = false
  }
}

onMounted(async () => {
  console.log('[Whiteboard] mounted')
  canvas = canvasRef.value
  staticCanvas = staticCanvasRef.value
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
      console.log('[Whiteboard] clear-canvas event')
      clearCanvas()
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
  window.removeEventListener('click', handleClickOutside)
  tileBakeWorker?.terminate()
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  if (webgpuRenderer) {
    webgpuRenderer.destroy()
  }
})

async function initializeRenderer() {
  console.log('[Whiteboard] initializeRenderer', { rendererType: rendererType.value })
  if (rendererType.value === 'webgpu') {
    try {
      webgpuRenderer = new WebGPURenderer()
      await webgpuRenderer.initialize(canvas)
      gpuStrokeManager = new GPUStrokeManager()
      const wasm = await loadInkWasm()
      if (wasm?.build_mesh) {
        gpuStrokeManager.setWasmEngine(wasm)
      }
      inkWorker = createInkWorker()
      if (inkWorker) {
        gpuStrokeManager.setWasmWorker(inkWorker)
      }
      tileBakeWorker = createTileBakeWorker()
      staticCtx = staticCanvas.getContext('2d', { alpha: false })
      staticTileManager = new TileManager(dpr)
      staticStrokes = new Map()
      eraseStrokeManager = new StrokeManager()
      eraseStrokes = new Map()
      gpuStrokeManager.setSmoothing({
        spacingFactor: smoothness.value,
        speedLow: speedLow.value,
        speedHigh: speedHigh.value,
        minSmooth: minSmooth.value,
        maxSmooth: maxSmooth.value,
        minWidthScale: minWidthScale.value,
        maxWidthScale: maxWidthScale.value,
        curvatureBoost: curvatureBoost.value
      })
      gpuStrokeManager.setSmoothingEnabled(smoothingEnabled.value)
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
  console.log('[Whiteboard] initializeCanvas2D')
  ctx = canvas.getContext('2d', { alpha: false })
  liveCanvas = document.createElement('canvas')
  liveCtx = liveCanvas.getContext('2d', { willReadFrequently: false })
  tileManager = new TileManager(dpr)
  strokeManager = new StrokeManager()
  eraseStrokeManager = new StrokeManager()
  eraseStrokes = new Map()
  staticCtx = staticCanvas.getContext('2d', { alpha: false })
  isWebGPU.value = false
  console.log('✅ Canvas 2D renderer initialized')
}

async function switchRenderer() {
  console.log('[Whiteboard] switchRenderer', { rendererType: rendererType.value })
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
  console.log('[Whiteboard] resizeCanvas', { w: window.innerWidth, h: window.innerHeight })
  dpr = window.devicePixelRatio || 1
  tileDpr = dpr
  canvas.width = Math.floor(window.innerWidth * dpr)
  canvas.height = Math.floor(window.innerHeight * dpr)

  if (staticCanvas) {
    staticCanvas.width = canvas.width
    staticCanvas.height = canvas.height
  }
  
  if (liveCanvas) {
    liveCanvas.width = canvas.width
    liveCanvas.height = canvas.height
  }
  
  if (webgpuRenderer) {
    webgpuRenderer.resize(canvas.width, canvas.height)
  }

  staticTileManager?.setDpr(tileDpr)
  tileManager?.setDpr(tileDpr)
  
  viewport.resize(window.innerWidth, window.innerHeight)
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
    renderStaticTiles()
    // WebGPU rendering path
    const gpuVertices = gpuStrokeManager.getCurrentStrokeGPUVertices()
    pointCount.value = Math.floor(gpuVertices.length / 6)
    webgpuRenderer.render(gpuVertices, viewport)
  } else if (ctx && tileManager) {
    // Canvas 2D rendering path (legacy)
    renderCanvas2D()
  }
  
  animationId = requestAnimationFrame(render)
}

function renderCanvas2D() {
  // Clear main canvas
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = viewport.scale <= 1.1
  if (ctx.imageSmoothingEnabled) {
    ctx.imageSmoothingQuality = 'high'
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr)
  
  ctx.save()
  
  // Apply viewport transform
  ctx.scale(viewport.scale, viewport.scale)
  ctx.translate(-viewport.x, -viewport.y)
  
  // Render tile cache layer
  const visibleTiles = tileManager.renderTilesWithErase(
    strokeManager.getAllStrokes(),
    eraseStrokes,
    viewport
  )
  
  for (const tile of visibleTiles) {
    const worldX = tile.x * TILE_SIZE
    const worldY = tile.y * TILE_SIZE
    ctx.drawImage(tile.canvas, worldX, worldY, TILE_SIZE, TILE_SIZE)
  }

  renderActiveErasers(ctx)
  
  // Render live layer
  liveCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
  liveCtx.clearRect(0, 0, liveCanvas.width / dpr, liveCanvas.height / dpr)
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

function renderStaticTiles() {
  if (!staticCtx || !staticTileManager || !staticStrokes) return

  staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
  staticCtx.imageSmoothingEnabled = viewport.scale <= 1.1
  if (staticCtx.imageSmoothingEnabled) {
    staticCtx.imageSmoothingQuality = 'high'
  }
  staticCtx.fillStyle = '#ffffff'
  staticCtx.fillRect(0, 0, staticCanvas.width / dpr, staticCanvas.height / dpr)

  staticCtx.save()
  staticCtx.scale(viewport.scale, viewport.scale)
  staticCtx.translate(-viewport.x, -viewport.y)

  const visibleTiles = staticTileManager.renderTilesWithErase(staticStrokes, eraseStrokes, viewport)
  for (const tile of visibleTiles) {
    const worldX = tile.x * TILE_SIZE
    const worldY = tile.y * TILE_SIZE
    staticCtx.drawImage(tile.canvas, worldX, worldY, TILE_SIZE, TILE_SIZE)
  }

  renderActiveErasers(staticCtx)

  staticCtx.restore()
}

function onPointerDown(event) {
  event.preventDefault()
  console.log('[Whiteboard] pointerdown', {
    type: event.pointerType,
    id: event.pointerId,
    button: event.button,
    x: event.clientX,
    y: event.clientY,
    isPrimary: event.isPrimary,
    tool: currentTool.value,
    locked: isLocked.value
  })
  
  // Don't allow drawing if locked
  if (isLocked.value) {
    return
  }
  
  const pointerId = event.pointerId ?? 1
  if (event.pointerId != null && canvas?.setPointerCapture) {
    canvas.setPointerCapture(pointerId)
  }
  
  // Right/middle mouse buttons pan; non-mouse pointers skip this path.
  if (event.pointerType === 'mouse' && (event.button === 1 || event.button === 2)) {
    isPanning = true
    lastPanPos = { x: event.clientX, y: event.clientY }
    return
  }
  
  // Non-mouse inputs use primary contact, while mouse inputs require the left button.
  const shouldInitiateDrawing = event.pointerType === 'mouse' ? event.button === 0 : event.isPrimary
  
  const pressure = event.pressure || 0.0
  const tilt = event.tiltX != null || event.tiltY != null ? { x: event.tiltX, y: event.tiltY } : null
  const time = event.timeStamp || performance.now()

  if (!shouldInitiateDrawing) return
  if (event.pointerType !== 'mouse') {
    const buttons = event.buttons ?? 0
    if (buttons === 0 && pressure <= 0) return
  }

  if (currentTool.value === 'pen') {
    const worldPos = viewport.screenToWorld(event.clientX, event.clientY)
    console.log('[Whiteboard] startStroke', { worldPos, isWebGPU: isWebGPU.value })
    
    if (isWebGPU.value) {
      const stroke = gpuStrokeManager.startStroke(
        worldPos.x,
        worldPos.y,
        brushColor.value,
        brushWidth.value,
        pressure,
        tilt,
        time
      )
      activePointers.set(pointerId, { stroke })
    } else {
      const stroke = strokeManager.startStroke(
        worldPos.x,
        worldPos.y,
        brushColor.value,
        brushWidth.value,
        time
      )
      activePointers.set(pointerId, { stroke, lastPos: worldPos })
    }
    return
  }

  if (currentTool.value === 'eraser') {
    const worldPos = viewport.screenToWorld(event.clientX, event.clientY)
    const eraseWidth = Math.max(8, brushWidth.value * 2.5)
    const stroke = eraseStrokeManager.startStroke(
      worldPos.x,
      worldPos.y,
      '#000000',
      eraseWidth,
      time
    )
    activePointers.set(pointerId, { stroke, isEraser: true })
  }
}

function onPointerMove(event) {
  event.preventDefault()
  console.log('[Whiteboard] pointermove', {
    type: event.pointerType,
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    isPanning
  })
  
  if (isPanning && lastPanPos) {
    const deltaX = event.clientX - lastPanPos.x
    const deltaY = event.clientY - lastPanPos.y
    viewport.pan(deltaX, deltaY)
    lastPanPos = { x: event.clientX, y: event.clientY }
    return
  }
  
  const pointerId = event.pointerId ?? 1
  let pointerData = activePointers.get(pointerId)

  if (!pointerData || !pointerData.stroke) {
    const buttons = event.buttons ?? 0
    const isPressed = event.pointerType === 'mouse'
      ? (buttons & 1) === 1
      : (buttons > 0 || (event.pressure ?? 0) > 0)
    const canStartOnMove = !isLocked.value && isPressed

    console.log('[Whiteboard] pointermove missing pointerData', {
      pointerId,
      buttons,
      isPressed,
      canStartOnMove,
      activePointers: activePointers.size
    })

    if (canStartOnMove && currentTool.value === 'pen') {
      const worldPos = viewport.screenToWorld(event.clientX, event.clientY)
      console.log('[Whiteboard] startStroke (move fallback)', { worldPos, isWebGPU: isWebGPU.value })
      const pressure = event.pressure || 0.0
      const tilt = event.tiltX != null || event.tiltY != null ? { x: event.tiltX, y: event.tiltY } : null
      const time = event.timeStamp || performance.now()

      if (isWebGPU.value) {
        const stroke = gpuStrokeManager.startStroke(
          worldPos.x,
          worldPos.y,
          brushColor.value,
          brushWidth.value,
          pressure,
          tilt,
          time
        )
        activePointers.set(pointerId, { stroke })
      } else {
        const stroke = strokeManager.startStroke(
          worldPos.x,
          worldPos.y,
          brushColor.value,
          brushWidth.value,
          time
        )
        activePointers.set(pointerId, { stroke, lastPos: worldPos })
      }

      pointerData = activePointers.get(pointerId)
    } else if (canStartOnMove && currentTool.value === 'eraser') {
      const worldPos = viewport.screenToWorld(event.clientX, event.clientY)
      const time = event.timeStamp || performance.now()
      const eraseWidth = Math.max(8, brushWidth.value * 2.5)
      const stroke = eraseStrokeManager.startStroke(
        worldPos.x,
        worldPos.y,
        '#000000',
        eraseWidth,
        time
      )
      activePointers.set(pointerId, { stroke, isEraser: true })
      pointerData = activePointers.get(pointerId)
    } else {
      return
    }
  }
  
  const worldPos = viewport.screenToWorld(event.clientX, event.clientY)
  const pressure = event.pressure || 0.0
  const tilt = event.tiltX != null || event.tiltY != null ? { x: event.tiltX, y: event.tiltY } : null
  const time = event.timeStamp || performance.now()
  
  if (pointerData.isEraser) {
    eraseStrokeManager.addPointToStroke(pointerData.stroke, worldPos.x, worldPos.y, pressure, tilt, time)
    pointerData.lastPos = worldPos
    return
  }

  if (isWebGPU.value) {
    gpuStrokeManager.addPoint(worldPos.x, worldPos.y, pressure, tilt, time)
  } else {
    strokeManager.addPointToStroke(pointerData.stroke, worldPos.x, worldPos.y, pressure, tilt, time)
    pointerData.lastPos = worldPos
  }
}

function onPointerUp(event) {
  event.preventDefault()
  console.log('[Whiteboard] pointerup', {
    type: event.pointerType,
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY
  })
  const pointerId = event.pointerId ?? 1
  if (event.pointerId != null && canvas?.releasePointerCapture) {
    canvas.releasePointerCapture(pointerId)
  }
  
  if (isPanning) {
    isPanning = false
    lastPanPos = null
    return
  }
  
  const pointerData = activePointers.get(pointerId)
  if (pointerData && pointerData.stroke) {
    if (pointerData.isEraser) {
      const finishedErase = eraseStrokeManager.finishStroke(pointerData.stroke)
      if (finishedErase && finishedErase.bounds) {
        eraseStrokes.set(finishedErase.id, finishedErase)
        const manager = isWebGPU.value ? staticTileManager : tileManager
        if (manager) {
          const affectedTiles = manager.getAffectedTiles(finishedErase.bounds)
          affectedTiles.forEach(tile => {
            tile.addEraseStroke(finishedErase.id)
          })
        }
      }
      activePointers.delete(pointerId)
      return
    }

    if (isWebGPU.value) {
      const finished = gpuStrokeManager.finishStroke()
      if (finished && staticTileManager && staticStrokes) {
        const widths = gpuStrokeManager.getStrokeWidths(finished)
        const bakedStroke = {
          id: `gpu_${finished.id}`,
          color: rgbaFromColor(finished.color),
          width: finished.width,
          widths,
          points: finished.points,
          bounds: finished.bounds
        }
        staticStrokes.set(bakedStroke.id, bakedStroke)

        if (bakedStroke.bounds) {
          const affectedTiles = staticTileManager.getAffectedTiles(bakedStroke.bounds)
          affectedTiles.forEach(tile => {
            tile.addStroke(bakedStroke.id)
          })
        }
      }
    } else {
      const finishedStroke = strokeManager.finishStroke(pointerData.stroke)
      
      if (finishedStroke && finishedStroke.bounds) {
        const affectedTiles = tileManager.getAffectedTiles(finishedStroke.bounds)
        affectedTiles.forEach(tile => {
          tile.addStroke(finishedStroke.id)
        })
      }
    }
    
    activePointers.delete(pointerId)
  }
}

function onPointerCancel(event) {
  onPointerUp(event)
}

function onMouseDown(event) {
  if (supportsPointerEvents) return
  onPointerDown({
    ...event,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: event.button === 0,
    pressure: 1.0
  })
}

function onMouseMove(event) {
  if (supportsPointerEvents) return
  onPointerMove({
    ...event,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    pressure: 1.0
  })
}

function onMouseUp(event) {
  if (supportsPointerEvents) return
  onPointerUp({
    ...event,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    pressure: 1.0
  })
}

function onTouchStart(event) {
  if (supportsPointerEvents) return
  event.preventDefault()
  handleTouches(event, onPointerDown)
}

function onTouchMove(event) {
  if (supportsPointerEvents) return
  event.preventDefault()
  handleTouches(event, onPointerMove)
}

function onTouchEnd(event) {
  if (supportsPointerEvents) return
  event.preventDefault()
  handleTouches(event, onPointerUp)
}

function handleTouches(event, handler) {
  const primaryId = event.touches[0]?.identifier
  for (const touch of event.changedTouches) {
    handler({
      pointerId: touch.identifier,
      pointerType: 'touch',
      isPrimary: primaryId == null ? true : touch.identifier === primaryId,
      clientX: touch.clientX,
      clientY: touch.clientY,
      pressure: touch.force || 1.0,
      preventDefault: () => event.preventDefault()
    })
  }
}

function onWheel(event) {
  event.preventDefault()
  console.log('[Whiteboard] wheel', { deltaY: event.deltaY, x: event.clientX, y: event.clientY })
  viewport.zoom(event.deltaY, event.clientX, event.clientY)
  updateTileDprForZoom(true)
  scheduleZoomRebake()
}

function updateTileDprForZoom(defer = false) {
  const zoomFactor = Math.min(2, Math.max(1, viewport.scale))
  const next = dpr * zoomFactor
  if (Math.abs(next - tileDpr) < 0.1) return
  if (defer) {
    pendingTileDpr = next
    return
  }
  tileDpr = next
  staticTileManager?.setDpr(tileDpr)
  tileManager?.setDpr(tileDpr)
}

function scheduleZoomRebake() {
  if (zoomRebakeTimer) {
    clearTimeout(zoomRebakeTimer)
  }
  zoomRebakeTimer = setTimeout(() => {
    if (pendingTileDpr != null) {
      tileDpr = pendingTileDpr
      pendingTileDpr = null
      staticTileManager?.setDpr(tileDpr)
      tileManager?.setDpr(tileDpr)
    }
    const tiles = staticTileManager?.getVisibleTiles(viewport) || []
    if (tileBakeWorker && staticStrokes && tiles.length > 0) {
      const strokeList = Array.from(staticStrokes.values())
      const eraseList = eraseStrokes ? Array.from(eraseStrokes.values()) : []
      tileBakeWorker
        .rebake({
          tiles: tiles.map((t) => ({ x: t.x, y: t.y })),
          strokes: strokeList,
          eraseStrokes: eraseList,
          tileSize: TILE_SIZE,
          dpr: tileDpr
        })
        .then((results) => {
          results.forEach((entry) => {
            const tile = staticTileManager.getTile(entry.x, entry.y)
            tile.ctx.setTransform(1, 0, 0, 1, 0, 0)
            tile.ctx.clearRect(0, 0, tile.canvas.width, tile.canvas.height)
            tile.ctx.drawImage(entry.bitmap, 0, 0)
            tile.dirty = false
            entry.bitmap.close?.()
          })
        })
        .catch(() => {})
    } else {
      staticTileManager?.renderTilesWithErase(staticStrokes, eraseStrokes, viewport)
    }
    tileManager?.renderTilesWithErase(strokeManager?.getAllStrokes?.(), eraseStrokes, viewport)
  }, 160)
}

function clearCanvas() {
  console.log('[Whiteboard] clearCanvas')
  if (isWebGPU.value) {
    gpuStrokeManager.clear()
    staticStrokes?.clear()
    staticTileManager?.clearAll()
    eraseStrokes?.clear()
  } else {
    strokeManager.clear()
    tileManager.clearAll()
    eraseStrokes?.clear()
  }
  activePointers.clear()
  pointCount.value = 0
}

function renderActiveErasers(targetCtx) {
  if (!targetCtx) return
  const erasers = [...activePointers.values()].filter((p) => p.isEraser && p.stroke)
  if (erasers.length === 0) return

  targetCtx.save()
  targetCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
  targetCtx.scale(viewport.scale, viewport.scale)
  targetCtx.translate(-viewport.x, -viewport.y)
  targetCtx.globalCompositeOperation = 'destination-out'
  for (const entry of erasers) {
    const stroke = entry.stroke
    if (!stroke || stroke.points.length === 0) continue
    targetCtx.beginPath()
    targetCtx.lineWidth = stroke.width
    targetCtx.lineCap = 'round'
    targetCtx.lineJoin = 'round'
    let first = true
    for (const point of stroke.points) {
      const x = point.x
      const y = point.y
      if (first) {
        targetCtx.moveTo(x, y)
        first = false
      } else {
        targetCtx.lineTo(x, y)
      }
    }
    targetCtx.stroke()
  }
  targetCtx.restore()
}

function resetView() {
  console.log('[Whiteboard] resetView')
  viewport.reset()
}

function handleFallbackToCanvas2D() {
  rendererType.value = 'canvas'
  switchRenderer()
}

// Toolbar functions
function toggleLock() {
  console.log('[Whiteboard] toggleLock', { next: !isLocked.value })
  isLocked.value = !isLocked.value
}

function selectTool(tool) {
  console.log('[Whiteboard] selectTool', { tool })
  currentTool.value = tool
  if (tool === 'pen') {
    showPenPopup.value = true
  } else {
    showPenPopup.value = false
  }
}

function rgbaFromColor(color) {
  if (!color) return 'rgba(0,0,0,1)'
  const r = Math.round((color.r ?? 0) * 255)
  const g = Math.round((color.g ?? 0) * 255)
  const b = Math.round((color.b ?? 0) * 255)
  const a = color.a ?? 1
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// ISF Save/Load functions
function saveToISF() {
  console.log('[Whiteboard] saveToISF')
  
  try {
    const manager = isWebGPU.value ? gpuStrokeManager : strokeManager
    const serialized = manager.serializeAllStrokes({ precision: 2 })
    
    // Get compression stats
    const stats = manager.getCompressionStats()
    console.log('[ISF] Compression stats:', {
      strokeCount: stats.strokeCount,
      totalPoints: stats.totalPoints,
      originalSize: `${(stats.originalSize / 1024).toFixed(2)} KB`,
      compressedSize: `${(stats.compressedSize / 1024).toFixed(2)} KB`,
      compressionRatio: `${stats.compressionRatio.toFixed(2)}x`,
      avgBytesPerPoint: `${stats.avgBytesPerPoint.toFixed(2)} bytes`
    })
    
    // Create download
    const blob = new Blob([serialized], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `whiteboard-${Date.now()}.isf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    console.log('[ISF] Saved successfully:', {
      filename: a.download,
      size: `${(serialized.length / 1024).toFixed(2)} KB`
    })
    
    // Show success message
    alert(`Saved to ISF format!\n\nStrokes: ${stats.strokeCount}\nPoints: ${stats.totalPoints}\nCompression: ${stats.compressionRatio.toFixed(2)}x\nSize: ${(serialized.length / 1024).toFixed(2)} KB`)
  } catch (error) {
    console.error('[ISF] Save error:', error)
    alert(`Failed to save: ${error.message}`)
  }
}

function loadFromISF() {
  console.log('[Whiteboard] loadFromISF')
  
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.isf'
  
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    try {
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      
      console.log('[ISF] Loading file:', {
        filename: file.name,
        size: `${(bytes.length / 1024).toFixed(2)} KB`
      })
      
      const manager = isWebGPU.value ? gpuStrokeManager : strokeManager
      const loadedStrokes = manager.loadFromISF(bytes)
      
      console.log('[ISF] Loaded successfully:', {
        strokeCount: loadedStrokes.length,
        totalPoints: loadedStrokes.reduce((sum, s) => sum + s.points.length, 0)
      })
      
      // Show success message
      alert(`Loaded from ISF format!\n\nStrokes: ${loadedStrokes.length}\nPoints: ${loadedStrokes.reduce((sum, s) => sum + s.points.length, 0)}`)
      
      // Trigger re-render
      pointCount.value = loadedStrokes.reduce((sum, s) => sum + s.points.length, 0)
    } catch (error) {
      console.error('[ISF] Load error:', error)
      alert(`Failed to load: ${error.message}`)
    }
  }
  
  input.click()
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
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  cursor: crosshair;
  touch-action: none;
}

.static-layer {
  z-index: 1;
}

.live-layer {
  z-index: 2;
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

/* Toolbar Divider */
.toolbar-divider {
  width: 1px;
  height: 24px;
  background: var(--md-sys-color-outline);
  margin: 0 8px;
  opacity: 0.3;
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
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--md-sys-color-surface-variant);
  outline: none;
  border-radius: 999px;
}

.size-slider::-webkit-slider-runnable-track {
  height: 6px;
  background: var(--md-sys-color-surface-variant);
  border-radius: 999px;
}

.size-slider::-moz-range-track {
  height: 6px;
  background: var(--md-sys-color-surface-variant);
  border-radius: 999px;
}

.size-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: var(--md-sys-color-primary);
  cursor: pointer;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
}

.size-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: var(--md-sys-color-primary);
  cursor: pointer;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
}

.value-display {
  font-size: 14px;
  color: var(--md-sys-color-on-surface);
  min-width: 30px;
  text-align: right;
  font-weight: 500;
}

.toggle-row {
  justify-content: space-between;
}

.toggle-input {
  width: 18px;
  height: 18px;
  accent-color: var(--md-sys-color-primary);
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
