/**
 * GPU Stroke Manager - Optimized for GPU rendering
 * Converts stroke data into GPU-friendly format with instanced rendering
 * Maintains bounds + tile buckets for spatial queries
 */

import { TILE_SIZE } from './TileSystem.js'

export class GPUStrokeManager {
  constructor() {
    this.strokes = []
    this.currentStroke = null
    this.strokeIdCounter = 0
    this.gpuPoints = [] // Flattened points for GPU
    this.gpuVertices = new Float32Array(0) // Triangulated mesh vertices
    this.spatialBuckets = new Map() // tile bucket index
    this.wasm = null
    this.wasmWorker = null
    this.strokeMeshes = new Map()
    this.smoothingEnabled = true

    this.minWidthScale = 0.4
    this.maxWidthScale = 1.6
    this.speedInfluence = 0.02 // higher = thinner when faster
    this.headTaperFactor = 2.4
    this.tailTaperFactor = 2.8
    this.velocitySmoothing = 0.45
    this.resampleSpacing = 0.2
    this.minSmoothing = 0.12
    this.maxSmoothing = 0.55
    this.speedLow = 0.2
    this.speedHigh = 1.6
    this.widthMinScale = 0.45
    this.widthMaxScale = 1.35
    this.curvatureBoost = 0.5
  }

  setSmoothing({ spacingFactor, speedLow, speedHigh, minSmooth, maxSmooth, minWidthScale, maxWidthScale, curvatureBoost } = {}) {
    if (typeof spacingFactor === 'number') {
      this.resampleSpacing = Math.max(0.05, Math.min(0.8, spacingFactor))
      this.minSmoothing = Math.max(0.05, Math.min(0.4, spacingFactor * 0.6))
      this.maxSmoothing = Math.max(0.2, Math.min(0.8, spacingFactor * 2.5))
    }
    if (typeof speedLow === 'number') this.speedLow = Math.max(0.01, speedLow)
    if (typeof speedHigh === 'number') this.speedHigh = Math.max(this.speedLow + 0.01, speedHigh)
    if (typeof minSmooth === 'number') this.minSmoothing = Math.max(0.02, Math.min(0.8, minSmooth))
    if (typeof maxSmooth === 'number') this.maxSmoothing = Math.max(this.minSmoothing, Math.min(0.95, maxSmooth))
    if (typeof minWidthScale === 'number') this.widthMinScale = Math.max(0.1, Math.min(1.5, minWidthScale))
    if (typeof maxWidthScale === 'number') this.widthMaxScale = Math.max(this.widthMinScale, Math.min(3, maxWidthScale))
    if (typeof curvatureBoost === 'number') this.curvatureBoost = Math.max(0, Math.min(1, curvatureBoost))
  }

  setWasmEngine(wasm) {
    this.wasm = wasm
  }

  setWasmWorker(worker) {
    this.wasmWorker = worker
  }

  setSmoothingEnabled(enabled) {
    this.smoothingEnabled = !!enabled
  }


  startStroke(x, y, color, width, pressure = 1.0, tilt = null, time = performance.now()) {
    this.currentStroke = {
      id: this.strokeIdCounter++,
      points: [{ x, y, pressure, tilt, time }],
      bounds: {
        minX: x - width / 2,
        minY: y - width / 2,
        maxX: x + width / 2,
        maxY: y + width / 2
      },
      color: this.parseColor(color),
      width: width,
      createdAt: time,
      updatedAt: time,
      totalLength: 0,
      lastVelocity: 0,
      isFinished: false,
      lastFiltered: { x, y }
    }
    return this.currentStroke
  }

  addPoint(x, y, pressure = 1.0, tilt = null, time = performance.now()) {
    if (!this.currentStroke) return
    const points = this.currentStroke.points
    const last = points[points.length - 1]
    if (!last) {
      points.push({ x, y, pressure, tilt, time, length: 0, velocity: 0 })
      this.updateBounds(this.currentStroke, x, y, pressure)
      this.currentStroke.updatedAt = time
      return
    }

    const dx = x - last.x
    const dy = y - last.y
    const dist = Math.hypot(dx, dy)
    const spacing = this.smoothingEnabled
      ? Math.max(0.35, this.currentStroke.width * this.resampleSpacing)
      : Math.max(0.15, this.currentStroke.width * 0.15)

    let fx = x
    let fy = y

    if (this.smoothingEnabled) {
      const dtRaw = Math.max(1, time - (last.time ?? time))
      const speedRaw = dist / dtRaw
      const t = this.smoothstep(this.speedLow, this.speedHigh, speedRaw)
      let alpha = this.lerp(this.minSmoothing, this.maxSmoothing, t)

      const prev = points[points.length - 2]
      if (prev) {
        const v1x = last.x - prev.x
        const v1y = last.y - prev.y
        const v2x = x - last.x
        const v2y = y - last.y
        const len1 = Math.hypot(v1x, v1y) || 1
        const len2 = Math.hypot(v2x, v2y) || 1
        const dot = (v1x * v2x + v1y * v2y) / (len1 * len2)
        const curvature = 1 - Math.max(-1, Math.min(1, dot))
        alpha = alpha * (1 - curvature * this.curvatureBoost)
      }
      const lastFiltered = this.currentStroke.lastFiltered || { x: last.x, y: last.y }
      fx = this.lerp(lastFiltered.x, x, alpha)
      fy = this.lerp(lastFiltered.y, y, alpha)
      this.currentStroke.lastFiltered = { x: fx, y: fy }
    }
    const fdx = fx - last.x
    const fdy = fy - last.y
    const fdist = Math.hypot(fdx, fdy)

    if (fdist <= spacing) {
      const length = (last.length ?? 0) + fdist
      const instVelocity = fdist / Math.max(1, time - (last.time ?? time))
      const velocity = this.lerp(this.currentStroke.lastVelocity, instVelocity, this.velocitySmoothing)
      points.push({ x: fx, y: fy, pressure, tilt, time, length, velocity })
      this.currentStroke.lastVelocity = velocity
      this.currentStroke.totalLength = length
      this.updateBounds(this.currentStroke, fx, fy, pressure)
      this.currentStroke.updatedAt = time
      return
    }

    const steps = Math.ceil(fdist / spacing)
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const px = last.x + fdx * t
      const py = last.y + fdy * t
      const timeAt = time + t
      const segDist = Math.hypot(px - (points[points.length - 1]?.x ?? last.x), py - (points[points.length - 1]?.y ?? last.y))
      const length = (points[points.length - 1]?.length ?? last.length ?? 0) + segDist
      const instVelocity = segDist / Math.max(1, timeAt - (points[points.length - 1]?.time ?? timeAt))
      const velocity = this.lerp(this.currentStroke.lastVelocity, instVelocity, this.velocitySmoothing)
      points.push({
        x: px,
        y: py,
        pressure,
        tilt,
        time: timeAt,
        length,
        velocity
      })
      this.currentStroke.lastVelocity = velocity
      this.currentStroke.totalLength = length
      this.updateBounds(this.currentStroke, px, py, pressure)
    }
    this.currentStroke.updatedAt = time
  }

  finishStroke() {
    if (!this.currentStroke) return null
    
    this.strokes.push(this.currentStroke)
    const finished = this.currentStroke
    finished.isFinished = true
    this.currentStroke = null

    this.addStrokeToBuckets(finished)
    
    // Update GPU points cache
    this.updateGPUPoints()

    this.requestMeshForStroke(finished)
    
    return finished
  }

  getBucketKey(tileX, tileY) {
    return `${tileX},${tileY}`
  }

  worldToTile(worldX, worldY) {
    return {
      x: Math.floor(worldX / TILE_SIZE),
      y: Math.floor(worldY / TILE_SIZE)
    }
  }

  updateBounds(stroke, x, y, pressure = 1.0) {
    const radius = (stroke.width * Math.max(0.25, pressure)) / 2
    if (!stroke.bounds) {
      stroke.bounds = {
        minX: x - radius,
        minY: y - radius,
        maxX: x + radius,
        maxY: y + radius
      }
      return
    }
    stroke.bounds.minX = Math.min(stroke.bounds.minX, x - radius)
    stroke.bounds.minY = Math.min(stroke.bounds.minY, y - radius)
    stroke.bounds.maxX = Math.max(stroke.bounds.maxX, x + radius)
    stroke.bounds.maxY = Math.max(stroke.bounds.maxY, y + radius)
  }

  addStrokeToBuckets(stroke) {
    if (!stroke.bounds) return

    const startTile = this.worldToTile(stroke.bounds.minX, stroke.bounds.minY)
    const endTile = this.worldToTile(stroke.bounds.maxX, stroke.bounds.maxY)

    for (let y = startTile.y; y <= endTile.y; y++) {
      for (let x = startTile.x; x <= endTile.x; x++) {
        const key = this.getBucketKey(x, y)
        if (!this.spatialBuckets.has(key)) {
          this.spatialBuckets.set(key, new Set())
        }
        this.spatialBuckets.get(key).add(stroke.id)
      }
    }
  }

  getStroke(id) {
    return this.strokes.find((s) => s.id === id)
  }

  getStrokesInBucket(tileX, tileY) {
    const key = this.getBucketKey(tileX, tileY)
    return this.spatialBuckets.get(key) || new Set()
  }

  parseColor(colorString) {
    // Convert hex color to RGBA floats
    const hex = colorString.replace('#', '')
    return {
      r: parseInt(hex.substring(0, 2), 16) / 255,
      g: parseInt(hex.substring(2, 4), 16) / 255,
      b: parseInt(hex.substring(4, 6), 16) / 255,
      a: 1.0
    }
  }

  updateGPUPoints() {
    // Convert all stroke points to GPU-friendly format
    this.gpuPoints = []
    
    for (const stroke of this.strokes) {
      const color = stroke.color
      const baseWidth = stroke.width
      
      for (let i = 0; i < stroke.points.length; i++) {
        const point = stroke.points[i]
        const width = this.computePointWidth(stroke, i, baseWidth)
        
        this.gpuPoints.push({
          x: point.x,
          y: point.y,
          r: color.r,
          g: color.g,
          b: color.b,
          a: color.a,
          width: width
        })
      }
    }
  }

  getCurrentStrokeGPUPoints() {
    if (!this.currentStroke) return []
    
    const points = []
    const color = this.currentStroke.color
    const baseWidth = this.currentStroke.width
    
    for (let i = 0; i < this.currentStroke.points.length; i++) {
      const point = this.currentStroke.points[i]
      const width = this.computePointWidth(this.currentStroke, i, baseWidth)
      points.push({
        x: point.x,
        y: point.y,
        r: color.r,
        g: color.g,
        b: color.b,
        a: color.a,
        width: width
      })
    }
    
    return points
  }

  getGPUPoints() {
    return this.gpuPoints
  }

  getAllGPUPoints() {
    // Combine finished strokes and current stroke
    const allPoints = [...this.gpuPoints]
    if (this.currentStroke) {
      allPoints.push(...this.getCurrentStrokeGPUPoints())
    }
    return allPoints
  }

  clear() {
    this.strokes = []
    this.gpuPoints = []
    this.currentStroke = null
    this.spatialBuckets.clear()
    this.gpuVertices = new Float32Array(0)
    this.strokeMeshes.clear()
  }

  computePointWidth(stroke, index, baseWidth) {
    const point = stroke.points[index]
    if (!point) return baseWidth

    const prev = stroke.points[Math.max(0, index - 1)]
    const dt = Math.max(1, (point.time ?? 0) - (prev.time ?? 0))
    const dx = point.x - prev.x
    const dy = point.y - prev.y
    const speed = point.velocity ?? (Math.hypot(dx, dy) / dt)

    const speedScale = 1 / (1 + speed * this.speedInfluence)
    const pressureScale = Math.max(0.25, point.pressure ?? 1)
    const total = stroke.totalLength ?? 0
    const headLength = Math.min(Math.max(6, baseWidth * this.headTaperFactor), total * 0.45)
    const tailLength = Math.min(Math.max(8, baseWidth * this.tailTaperFactor), total * 0.45)
    const headTaper = headLength > 0 ? this.smoothstep(0, headLength, point.length ?? 0) : 1
    const tailTaper = stroke.isFinished
      ? (tailLength > 0
        ? this.smoothstep(0, tailLength, (stroke.totalLength ?? 0) - (point.length ?? 0))
        : 1)
      : 1
    const width = baseWidth * pressureScale * speedScale * headTaper * tailTaper

    return Math.max(baseWidth * this.widthMinScale, Math.min(baseWidth * this.widthMaxScale, width))
  }

  getStrokeWidths(stroke) {
    if (!stroke) return []
    const widths = new Array(stroke.points.length)
    for (let i = 0; i < stroke.points.length; i++) {
      widths[i] = this.computePointWidth(stroke, i, stroke.width)
    }
    return widths
  }

  buildMeshFromStroke(stroke) {
    const vertices = []
    if (!stroke || stroke.points.length === 0) return new Float32Array(0)
    if (stroke.points.length === 1) {
      const p = stroke.points[0]
      const radius = this.computePointWidth(stroke, 0, stroke.width) * 0.5
      const color = stroke.color
      const steps = 24
      const center = { x: p.x, y: p.y, r: color.r, g: color.g, b: color.b, a: color.a }
      for (let i = 0; i < steps; i++) {
        const a0 = (i / steps) * Math.PI * 2
        const a1 = ((i + 1) / steps) * Math.PI * 2
        const p0 = { x: p.x + Math.cos(a0) * radius, y: p.y + Math.sin(a0) * radius, r: color.r, g: color.g, b: color.b, a: color.a }
        const p1 = { x: p.x + Math.cos(a1) * radius, y: p.y + Math.sin(a1) * radius, r: color.r, g: color.g, b: color.b, a: color.a }
        vertices.push(center, p0, p1)
      }
      return this.flattenVertices(vertices)
    }

    const points = stroke.points
    const baseWidth = stroke.width
    const count = points.length
    const dirs = []
    const norms = []

    for (let i = 0; i < count - 1; i++) {
      const p0 = points[i]
      const p1 = points[i + 1]
      const dx = p1.x - p0.x
      const dy = p1.y - p0.y
      const len = Math.hypot(dx, dy) || 1
      const dir = { x: dx / len, y: dy / len }
      dirs.push(dir)
      norms.push({ x: -dir.y, y: dir.x })
    }

    const leftPrev = new Array(count)
    const rightPrev = new Array(count)
    const leftNext = new Array(count)
    const rightNext = new Array(count)
    const join = new Array(count).fill('miter')

    for (let i = 0; i < count; i++) {
      const p = points[i]
      const radius = this.computePointWidth(stroke, i, baseWidth) * 0.5

      if (i === 0) {
        const n = norms[0]
        leftPrev[i] = leftNext[i] = { x: p.x + n.x * radius, y: p.y + n.y * radius }
        rightPrev[i] = rightNext[i] = { x: p.x - n.x * radius, y: p.y - n.y * radius }
        continue
      }
      if (i === count - 1) {
        const n = norms[count - 2]
        leftPrev[i] = leftNext[i] = { x: p.x + n.x * radius, y: p.y + n.y * radius }
        rightPrev[i] = rightNext[i] = { x: p.x - n.x * radius, y: p.y - n.y * radius }
        continue
      }

      const n0 = norms[i - 1]
      const n1 = norms[i]
      const miter = { x: n0.x + n1.x, y: n0.y + n1.y }
      const miterLen = Math.hypot(miter.x, miter.y)
      if (miterLen < 1e-4) {
        leftPrev[i] = { x: p.x + n0.x * radius, y: p.y + n0.y * radius }
        rightPrev[i] = { x: p.x - n0.x * radius, y: p.y - n0.y * radius }
        leftNext[i] = { x: p.x + n1.x * radius, y: p.y + n1.y * radius }
        rightNext[i] = { x: p.x - n1.x * radius, y: p.y - n1.y * radius }
        join[i] = 'round'
        continue
      }

      const miterDir = { x: miter.x / miterLen, y: miter.y / miterLen }
      const dot = miterDir.x * n1.x + miterDir.y * n1.y
      const miterLength = dot !== 0 ? radius / dot : radius
      const miterLimit = 4.0

      if (Math.abs(miterLength) <= miterLimit * radius) {
        leftPrev[i] = leftNext[i] = { x: p.x + miterDir.x * miterLength, y: p.y + miterDir.y * miterLength }
        rightPrev[i] = rightNext[i] = { x: p.x - miterDir.x * miterLength, y: p.y - miterDir.y * miterLength }
      } else {
        leftPrev[i] = { x: p.x + n0.x * radius, y: p.y + n0.y * radius }
        rightPrev[i] = { x: p.x - n0.x * radius, y: p.y - n0.y * radius }
        leftNext[i] = { x: p.x + n1.x * radius, y: p.y + n1.y * radius }
        rightNext[i] = { x: p.x - n1.x * radius, y: p.y - n1.y * radius }
        join[i] = 'round'
      }
    }

    const pushTri = (a, b, c) => {
      vertices.push(a, b, c)
    }

    const color = stroke.color
    const toVertex = (p) => ({ x: p.x, y: p.y, r: color.r, g: color.g, b: color.b, a: color.a })

    for (let i = 0; i < count - 1; i++) {
      const l0 = leftNext[i]
      const r0 = rightNext[i]
      const l1 = leftPrev[i + 1]
      const r1 = rightPrev[i + 1]
      pushTri(toVertex(l0), toVertex(r0), toVertex(r1))
      pushTri(toVertex(l0), toVertex(r1), toVertex(l1))
    }

    // Round joins
    for (let i = 1; i < count - 1; i++) {
      if (join[i] !== 'round') continue
      const p = points[i]
      const radius = this.computePointWidth(stroke, i, baseWidth) * 0.5
      const d0 = dirs[i - 1]
      const d1 = dirs[i]
      const n0 = { x: -d0.y, y: d0.x }
      const n1 = { x: -d1.y, y: d1.x }
      const cross = d0.x * d1.y - d0.y * d1.x
      const outer0 = cross >= 0 ? n0 : { x: -n0.x, y: -n0.y }
      const outer1 = cross >= 0 ? n1 : { x: -n1.x, y: -n1.y }

      const a0 = Math.atan2(outer0.y, outer0.x)
      let a1 = Math.atan2(outer1.y, outer1.x)
      while (a1 < a0) a1 += Math.PI * 2
      const angle = a1 - a0
      const steps = Math.max(4, Math.ceil(angle / (Math.PI / 8)))

      for (let s = 0; s < steps; s++) {
        const t0 = a0 + (angle * s) / steps
        const t1 = a0 + (angle * (s + 1)) / steps
        const p0 = { x: p.x + Math.cos(t0) * radius, y: p.y + Math.sin(t0) * radius }
        const p1 = { x: p.x + Math.cos(t1) * radius, y: p.y + Math.sin(t1) * radius }
        pushTri(toVertex({ x: p.x, y: p.y }), toVertex(p0), toVertex(p1))
      }
    }

    // Round caps
    const addCap = (center, normal, index) => {
      const radius = this.computePointWidth(stroke, index, baseWidth) * 0.5
      const a0 = Math.atan2(-normal.y, -normal.x)
      let a1 = Math.atan2(normal.y, normal.x)
      while (a1 < a0) a1 += Math.PI * 2
      const angle = a1 - a0
      const steps = Math.max(6, Math.ceil(angle / (Math.PI / 10)))
      for (let s = 0; s < steps; s++) {
        const t0 = a0 + (angle * s) / steps
        const t1 = a0 + (angle * (s + 1)) / steps
        const p0 = { x: center.x + Math.cos(t0) * radius, y: center.y + Math.sin(t0) * radius }
        const p1 = { x: center.x + Math.cos(t1) * radius, y: center.y + Math.sin(t1) * radius }
        pushTri(toVertex({ x: center.x, y: center.y }), toVertex(p0), toVertex(p1))
      }
    }

    addCap(points[0], norms[0], 0)
    addCap(points[count - 1], norms[count - 2], count - 1)

    return this.flattenVertices(vertices)
  }

  updateGPUPoints() {
    // Convert all stroke points to GPU-friendly format
    this.gpuPoints = []
    this.gpuVertices = new Float32Array(0)
    
    for (const stroke of this.strokes) {
      const color = stroke.color
      const baseWidth = stroke.width
      
      for (let i = 0; i < stroke.points.length; i++) {
        const point = stroke.points[i]
        const width = this.computePointWidth(stroke, i, baseWidth)
        
        this.gpuPoints.push({
          x: point.x,
          y: point.y,
          r: color.r,
          g: color.g,
          b: color.b,
          a: color.a,
          width: width
        })
      }

      const cached = this.strokeMeshes.get(stroke.id)
      if (cached) {
        this.gpuVertices = this.concatFloat32(this.gpuVertices, cached)
      } else {
        const mesh = this.buildMeshForStroke(stroke)
        this.gpuVertices = this.concatFloat32(this.gpuVertices, mesh)
        if (this.wasmWorker) {
          this.requestMeshForStroke(stroke)
        }
      }
    }
  }

  getCurrentStrokeGPUVertices() {
    if (!this.currentStroke) return new Float32Array(0)
    return this.buildMeshForStroke(this.currentStroke)
  }

  getGPUVertices() {
    return this.gpuVertices
  }

  getAllGPUVertices() {
    if (!this.currentStroke) return this.gpuVertices
    const current = this.getCurrentStrokeGPUVertices()
    return this.concatFloat32(this.gpuVertices, current)
  }

  buildMeshForStroke(stroke) {
    if (!stroke || stroke.points.length === 0) return new Float32Array(0)
    const cached = this.strokeMeshes.get(stroke.id)
    if (cached) return cached
    if (this.wasm?.build_mesh) {
      const n = stroke.points.length
      const points = new Float32Array(n * 2)
      const widths = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        const p = stroke.points[i]
        points[i * 2] = p.x
        points[i * 2 + 1] = p.y
        widths[i] = this.computePointWidth(stroke, i, stroke.width)
      }
      const color = new Float32Array([stroke.color.r, stroke.color.g, stroke.color.b, stroke.color.a])
      const out = this.wasm.build_mesh(points, widths, color)
      return out instanceof Float32Array ? out : new Float32Array(out)
    }
    return this.buildMeshFromStroke(stroke)
  }


  requestMeshForStroke(stroke) {
    if (!this.wasmWorker || !stroke) return
    const n = stroke.points.length
    if (n === 0) return
    const points = new Float32Array(n * 2)
    const widths = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const p = stroke.points[i]
      points[i * 2] = p.x
      points[i * 2 + 1] = p.y
      widths[i] = this.computePointWidth(stroke, i, stroke.width)
    }
    const color = new Float32Array([stroke.color.r, stroke.color.g, stroke.color.b, stroke.color.a])

    this.wasmWorker
      .buildMesh(points, widths, color)
      .then((mesh) => {
        this.strokeMeshes.set(stroke.id, mesh)
        this.updateGPUPoints()
      })
      .catch(() => {})
  }

  flattenVertices(vertices) {
    if (!vertices || vertices.length === 0) return new Float32Array(0)
    const data = new Float32Array(vertices.length * 6)
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i]
      const offset = i * 6
      data[offset + 0] = v.x
      data[offset + 1] = v.y
      data[offset + 2] = v.r
      data[offset + 3] = v.g
      data[offset + 4] = v.b
      data[offset + 5] = v.a
    }
    return data
  }

  concatFloat32(a, b) {
    if (!a || a.length === 0) return b
    if (!b || b.length === 0) return a
    const out = new Float32Array(a.length + b.length)
    out.set(a, 0)
    out.set(b, a.length)
    return out
  }

  smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)
  }

  lerp(a, b, t) {
    return a + (b - a) * t
  }

  getStrokeCount() {
    return this.strokes.length + (this.currentStroke ? 1 : 0)
  }
}
