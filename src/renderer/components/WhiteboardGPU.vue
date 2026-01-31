<template>
  <div class="whiteboard-container">
    <div class="toolbar">
      <div class="tool-group">
        <label>Renderer:</label>
        <select v-model="rendererType" @change="switchRenderer">
          <option value="webgpu">WebGPU (Native)</option>
          <option value="canvas">Canvas 2D</option>
        </select>
      </div>
      <div class="tool-group">
        <label>Color:</label>
        <input type="color" v-model="brushColor" />
      </div>
      <div class="tool-group">
        <label>Width:</label>
        <input type="range" v-model.number="brushWidth" min="1" max="20" />
        <span>{{ brushWidth }}px</span>
      </div>
      <div class="tool-group">
        <button @click="clearCanvas">Clear</button>
        <button @click="resetView">Reset View</button>
      </div>
      <div class="info">
        <span class="renderer-badge" :class="{ 'gpu-active': isWebGPU }">
          {{ rendererType === 'webgpu' ? '⚡ GPU' : '🖼️ CPU' }}
        </span>
        <span>Zoom: {{ (viewport.scale * 100).toFixed(0) }}%</span>
        <span>Points: {{ pointCount }}</span>
        <span>FPS: {{ fps }}</span>
      </div>
    </div>
    <canvas
      ref="canvasRef"
      class="whiteboard-canvas"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @wheel="onWheel"
    ></canvas>
    <div v-if="!webgpuSupported && rendererType === 'webgpu'" class="warning-overlay">
      <div class="warning-message">
        <h3>⚠️ WebGPU Not Available</h3>
        <p>WebGPU requires Electron 28+ with Vulkan enabled.</p>
        <p>Falling back to Canvas 2D renderer.</p>
        <button @click="rendererType = 'canvas'; switchRenderer()">Use Canvas 2D</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { WebGPURenderer } from '../core/WebGPURenderer.js'
import { GPUStrokeManager } from '../core/GPUStrokeManager.js'
import { Viewport } from '../core/Viewport.js'

// Legacy imports for Canvas 2D fallback
import { TileManager, TILE_SIZE } from '../core/TileSystem.js'
import { StrokeManager } from '../core/StrokeManager.js'

const canvasRef = ref(null)
const brushColor = ref('#000000')
const brushWidth = ref(2)
const pointCount = ref(0)
const fps = ref(0)
const rendererType = ref('webgpu')
const webgpuSupported = ref(true)
const isWebGPU = ref(false)

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

onMounted(async () => {
  canvas = canvasRef.value
  viewport = new Viewport(window.innerWidth, window.innerHeight)
  
  // Try to initialize WebGPU
  await initializeRenderer()
  
  // Setup canvas
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  
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
  canvas.setPointerCapture(event.pointerId)
  
  // Right click or middle click for panning
  if (event.button === 1 || event.button === 2) {
    isPanning = true
    lastPanPos = { x: event.clientX, y: event.clientY }
    return
  }
  
  // Left click for drawing
  if (event.button === 0) {
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
</script>

<style scoped>
.whiteboard-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.whiteboard-canvas {
  display: block;
  cursor: crosshair;
  touch-action: none;
}

.toolbar {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.95);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 20px;
  align-items: center;
  z-index: 1000;
  font-size: 14px;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-group label {
  font-weight: 500;
  color: #333;
}

.tool-group select {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 13px;
}

.tool-group input[type="color"] {
  width: 40px;
  height: 30px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.tool-group input[type="range"] {
  width: 100px;
}

.tool-group button {
  padding: 6px 12px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.tool-group button:hover {
  background: #45a049;
}

.info {
  display: flex;
  gap: 15px;
  color: #666;
  font-size: 12px;
  border-left: 1px solid #ddd;
  padding-left: 20px;
}

.info span {
  white-space: nowrap;
}

.renderer-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;
  background: #f0f0f0;
}

.renderer-badge.gpu-active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

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
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  text-align: center;
  max-width: 400px;
}

.warning-message h3 {
  margin: 0 0 15px 0;
  color: #ff9800;
}

.warning-message p {
  margin: 10px 0;
  color: #666;
}

.warning-message button {
  margin-top: 20px;
  padding: 10px 20px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.warning-message button:hover {
  background: #1976D2;
}
</style>
