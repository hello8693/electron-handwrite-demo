/**
 * Stroke Manager - Manages strokes with bucket-based spatial indexing
 */

import { TILE_SIZE } from './TileSystem.js'

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
}
