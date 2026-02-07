/**
 * Stroke Manager - Manages strokes with bucket-based spatial indexing
 * 
 * Enhanced with WPF-inspired features:
 * - ISF serialization support
 * - Angle-based stroke optimization
 */

import { TILE_SIZE } from './TileSystem.js'
import { ISFStrokeSerializer } from './ISFCodec.js'
import { StrokeGeometryOptimizer } from './StrokeNode.js'

export class Stroke {
  constructor(id, color = '#000000', width = 2) {
    this.id = id
    this.color = color
    this.width = width
    this.points = []
    this.bounds = null
    this.createdAt = performance.now()
    this.updatedAt = this.createdAt
  }

  addPoint(x, y, pressure = 1.0, tilt = null, time = performance.now()) {
    this.points.push({ x, y, pressure, tilt, time })
    this.updateBounds(x, y)
    this.updatedAt = time
  }

  updateBounds(x, y, pressure = 1.0) {
    const radius = (this.width * Math.max(0.25, pressure)) / 2
    if (!this.bounds) {
      this.bounds = {
        minX: x - radius,
        minY: y - radius,
        maxX: x + radius,
        maxY: y + radius
      }
    } else {
      this.bounds.minX = Math.min(this.bounds.minX, x - radius)
      this.bounds.minY = Math.min(this.bounds.minY, y - radius)
      this.bounds.maxX = Math.max(this.bounds.maxX, x + radius)
      this.bounds.maxY = Math.max(this.bounds.maxY, y + radius)
    }
  }

  getBounds() {
    return this.bounds
  }
}

export class StrokeManager {
  constructor() {
    this.strokes = new Map() // All strokes by ID
    this.currentStroke = null
    this.strokeCounter = 0
    this.spatialBuckets = new Map() // Bucket-based spatial index
    
    // WPF-inspired features
    this.geometryOptimizer = new StrokeGeometryOptimizer({
      angleTolerance: 45,
      largeNodeAngleTolerance: 20,
      transformAngleTolerance: 10,
      largeNodeThreshold: 40,
      areaChangeThreshold: 0.70
    })
    this.useAngleCulling = false // Disabled by default for Canvas2D (can enable for optimization)
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

  startStroke(x, y, color = '#000000', width = 2, time = performance.now()) {
    const id = `stroke_${this.strokeCounter++}`
    const stroke = new Stroke(id, color, width)
    stroke.addPoint(x, y, 1.0, null, time)
    this.currentStroke = stroke
    return stroke
  }

  addPointToStroke(stroke, x, y, pressure = 1.0, tilt = null, time = performance.now()) {
    if (!stroke) return null
    stroke.addPoint(x, y, pressure, tilt, time)
    return stroke
  }

  addPointToCurrentStroke(x, y, pressure = 1.0, tilt = null, time = performance.now()) {
    if (!this.currentStroke) return null
    this.currentStroke.addPoint(x, y, pressure, tilt, time)
    return this.currentStroke
  }

  finishStroke(stroke = null) {
    const strokeToFinish = stroke || this.currentStroke
    if (!strokeToFinish) return null
    
    this.strokes.set(strokeToFinish.id, strokeToFinish)
    this.addStrokeToBuckets(strokeToFinish)
    
    if (this.currentStroke === strokeToFinish) {
      this.currentStroke = null
    }
    
    return strokeToFinish
  }

  getStroke(id) {
    return this.strokes.get(id)
  }

  getAllStrokes() {
    return this.strokes
  }

  getStrokesInBucket(tileX, tileY) {
    const key = this.getBucketKey(tileX, tileY)
    return this.spatialBuckets.get(key) || new Set()
  }

  clear() {
    this.strokes.clear()
    this.spatialBuckets.clear()
    this.currentStroke = null
  }

  /**
   * ISF Serialization Support
   */

  /**
   * Serialize a stroke to ISF format
   */
  serializeStroke(stroke, options = {}) {
    return ISFStrokeSerializer.serialize(stroke, options)
  }

  /**
   * Deserialize a stroke from ISF format
   */
  deserializeStroke(bytes) {
    return ISFStrokeSerializer.deserialize(bytes)
  }

  /**
   * Serialize all strokes to ISF format
   */
  serializeAllStrokes(options = {}) {
    const serialized = []
    const allStrokes = Array.from(this.strokes.values())
    if (this.currentStroke) {
      allStrokes.push(this.currentStroke)
    }

    for (const stroke of allStrokes) {
      const bytes = this.serializeStroke(stroke, options)
      serialized.push(bytes)
    }

    // Combine all strokes with count header
    const totalSize = serialized.reduce((sum, bytes) => sum + bytes.length, 0)
    const result = new Uint8Array(4 + totalSize)
    
    // Write stroke count
    new DataView(result.buffer).setUint32(0, serialized.length, true)
    
    // Write all strokes
    let offset = 4
    for (const bytes of serialized) {
      result.set(bytes, offset)
      offset += bytes.length
    }

    return result
  }

  /**
   * Load strokes from ISF serialized data
   */
  loadFromISF(bytes) {
    this.clear()
    
    // Read stroke count
    const count = new DataView(bytes.buffer).getUint32(0, true)
    let offset = 4

    const loadedStrokes = []
    
    for (let i = 0; i < count; i++) {
      // Read stroke length
      const length = new DataView(bytes.buffer).getUint32(offset, true)
      const strokeBytes = bytes.slice(offset, offset + length)
      offset += length

      const stroke = this.deserializeStroke(strokeBytes)
      loadedStrokes.push(stroke)
    }

    // Add loaded strokes
    for (const stroke of loadedStrokes) {
      const strokeObj = new Stroke(stroke.id, stroke.color, stroke.width)
      strokeObj.points = stroke.points
      strokeObj.createdAt = stroke.timestamp
      
      // Recalculate bounds
      for (const point of stroke.points) {
        strokeObj.updateBounds(point.x, point.y, point.pressure || 1.0)
      }
      
      this.strokes.set(strokeObj.id, strokeObj)
      this.addStrokeToBuckets(strokeObj)
    }

    return loadedStrokes
  }

  /**
   * Get compression statistics for current strokes
   */
  getCompressionStats() {
    const allStrokes = Array.from(this.strokes.values())
    if (this.currentStroke) {
      allStrokes.push(this.currentStroke)
    }

    const stats = {
      strokeCount: allStrokes.length,
      totalPoints: 0,
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 0,
      avgBytesPerPoint: 0,
      perStrokeStats: []
    }

    for (const stroke of allStrokes) {
      const strokeStats = ISFStrokeSerializer.getCompressionStats(stroke)
      stats.totalPoints += strokeStats.pointCount
      stats.originalSize += strokeStats.originalSize
      stats.compressedSize += strokeStats.compressedSize
      stats.perStrokeStats.push(strokeStats)
    }

    stats.compressionRatio = stats.originalSize / stats.compressedSize
    stats.avgBytesPerPoint = stats.compressedSize / stats.totalPoints

    return stats
  }

  /**
   * Enable/disable angle-based node culling
   */
  setAngleCulling(enabled) {
    this.useAngleCulling = !!enabled
  }

  /**
   * Optimize stroke geometry using WPF's angle-based algorithm
   */
  optimizeStrokeGeometry(stroke) {
    if (!this.useAngleCulling || !stroke || !stroke.points || stroke.points.length === 0) {
      return stroke
    }

    const result = this.geometryOptimizer.optimizeStrokeGeometry(
      stroke.points,
      stroke.width,
      { calculateBounds: true, hasComplexTransform: false }
    )

    // Update stroke with optimized points
    stroke.points = result.nodes.map(node => ({
      x: node.position.x,
      y: node.position.y,
      pressure: node.pressureFactor,
      time: node.thisNode.time
    }))
    
    stroke.bounds = result.bounds
    stroke._originalPointCount = result.nodes.length
    stroke._compressionRatio = result.nodes.length > 0 ? 
      (stroke.points.length / result.nodes.length) : 1

    return stroke
  }
}
