<template>
  <div class="whiteboard-container">
    <div class="toolbar">
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
        <span>Zoom: {{ (viewport.scale * 100).toFixed(0) }}%</span>
        <span>Strokes: {{ strokeCount }}</span>
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
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { TileManager, TILE_SIZE } from '../core/TileSystem.js'
import { StrokeManager } from '../core/StrokeManager.js'
import { Viewport } from '../core/Viewport.js'

const canvasRef = ref(null)
const brushColor = ref('#000000')
const brushWidth = ref(2)
const strokeCount = ref(0)
const fps = ref(0)

let canvas = null
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

onMounted(() => {
  canvas = canvasRef.value
  ctx = canvas.getContext('2d', { alpha: false })
  
  // Create live layer canvas
  liveCanvas = document.createElement('canvas')
  liveCtx = liveCanvas.getContext('2d', { willReadFrequently: false })
  
  // Initialize systems
  tileManager = new TileManager()
  strokeManager = new StrokeManager()
  viewport = new Viewport(window.innerWidth, window.innerHeight)
  
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
})

function resizeCanvas() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  liveCanvas.width = canvas.width
  liveCanvas.height = canvas.height
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
  
  // Render live layer (current strokes being drawn)
  liveCtx.clearRect(0, 0, liveCanvas.width, liveCanvas.height)
  liveCtx.save()
  liveCtx.scale(viewport.scale, viewport.scale)
  liveCtx.translate(-viewport.x, -viewport.y)
  
  // Draw active strokes
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
  
  // Composite live layer onto main canvas
  ctx.restore()
  ctx.drawImage(liveCanvas, 0, 0)
  
  animationId = requestAnimationFrame(render)
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
    const stroke = strokeManager.startStroke(
      worldPos.x,
      worldPos.y,
      brushColor.value,
      brushWidth.value
    )
    
    activePointers.set(event.pointerId, {
      stroke: stroke,
      lastPos: worldPos
    })
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
  const pressure = event.pressure || 1.0
  
  strokeManager.addPointToStroke(pointerData.stroke, worldPos.x, worldPos.y, pressure)
  pointerData.lastPos = worldPos
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
    // Finish stroke and bake into tiles
    const finishedStroke = strokeManager.finishStroke(pointerData.stroke)
    
    if (finishedStroke && finishedStroke.bounds) {
      // Mark affected tiles as dirty
      const affectedTiles = tileManager.getAffectedTiles(finishedStroke.bounds)
      affectedTiles.forEach(tile => {
        tile.addStroke(finishedStroke.id)
      })
    }
    
    activePointers.delete(event.pointerId)
    strokeCount.value = strokeManager.getAllStrokes().size
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
  strokeManager.clear()
  tileManager.clearAll()
  activePointers.clear()
  strokeCount.value = 0
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
</style>
