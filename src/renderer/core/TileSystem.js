/**
 * Tile System - Manages canvas tiles for efficient rendering
 * Each tile is a fixed-size canvas that caches rendered strokes
 */

export const TILE_SIZE = 256

export class Tile {
  constructor(x, y) {
    this.x = x // Tile grid X coordinate
    this.y = y // Tile grid Y coordinate
    this.canvas = document.createElement('canvas')
    this.canvas.width = TILE_SIZE
    this.canvas.height = TILE_SIZE
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false })
    this.dirty = false
    this.strokes = [] // Stroke IDs that affect this tile
    this.eraseStrokes = [] // Erase stroke IDs affecting this tile
  }

  clear() {
    this.ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE)
    this.strokes = []
    this.eraseStrokes = []
    this.dirty = true
  }

  addStroke(strokeId) {
    if (!this.strokes.includes(strokeId)) {
      this.strokes.push(strokeId)
      this.dirty = true
    }
  }

  addEraseStroke(strokeId) {
    if (!this.eraseStrokes.includes(strokeId)) {
      this.eraseStrokes.push(strokeId)
      this.dirty = true
    }
  }

  render(strokes, viewport, eraseStrokes) {
    if (!this.dirty) return

    this.ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE)
    
    // Calculate tile world bounds
    const worldX = this.x * TILE_SIZE
    const worldY = this.y * TILE_SIZE
    
    this.ctx.save()
    
    // Draw strokes that intersect this tile
    for (const strokeId of this.strokes) {
      const stroke = strokes.get(strokeId)
      if (!stroke) continue
      
      this.ctx.beginPath()
      this.ctx.strokeStyle = stroke.color
      this.ctx.lineWidth = stroke.width
      this.ctx.lineCap = 'round'
      this.ctx.lineJoin = 'round'
      
      let firstPoint = true
      for (const point of stroke.points) {
        const x = point.x - worldX
        const y = point.y - worldY
        
        if (firstPoint) {
          this.ctx.moveTo(x, y)
          firstPoint = false
        } else {
          this.ctx.lineTo(x, y)
        }
      }
      
      this.ctx.stroke()
    }

    // Apply erase strokes (destination-out)
    if (eraseStrokes && this.eraseStrokes.length > 0) {
      this.ctx.globalCompositeOperation = 'destination-out'
      for (const eraseId of this.eraseStrokes) {
        const eraseStroke = eraseStrokes.get(eraseId)
        if (!eraseStroke) continue

        this.ctx.beginPath()
        this.ctx.lineWidth = eraseStroke.width
        this.ctx.lineCap = 'round'
        this.ctx.lineJoin = 'round'

        let firstPoint = true
        for (const point of eraseStroke.points) {
          const x = point.x - worldX
          const y = point.y - worldY
          if (firstPoint) {
            this.ctx.moveTo(x, y)
            firstPoint = false
          } else {
            this.ctx.lineTo(x, y)
          }
        }
        this.ctx.stroke()
      }
      this.ctx.globalCompositeOperation = 'source-over'
    }
    
    this.ctx.restore()
    this.dirty = false
  }
}

export class TileManager {
  constructor() {
    this.tiles = new Map() // Key: "x,y", Value: Tile
    this.activeTiles = new Set() // Currently visible tiles
  }

  getTileKey(x, y) {
    return `${x},${y}`
  }

  worldToTile(worldX, worldY) {
    return {
      x: Math.floor(worldX / TILE_SIZE),
      y: Math.floor(worldY / TILE_SIZE)
    }
  }

  getTile(tileX, tileY) {
    const key = this.getTileKey(tileX, tileY)
    if (!this.tiles.has(key)) {
      this.tiles.set(key, new Tile(tileX, tileY))
    }
    return this.tiles.get(key)
  }

  getAffectedTiles(bounds) {
    const tiles = []
    const startTile = this.worldToTile(bounds.minX, bounds.minY)
    const endTile = this.worldToTile(bounds.maxX, bounds.maxY)
    
    for (let y = startTile.y; y <= endTile.y; y++) {
      for (let x = startTile.x; x <= endTile.x; x++) {
        tiles.push(this.getTile(x, y))
      }
    }
    
    return tiles
  }

  getVisibleTiles(viewport) {
    const tiles = []
    const startTile = this.worldToTile(viewport.x, viewport.y)
    const endTile = this.worldToTile(
      viewport.x + viewport.width / viewport.scale,
      viewport.y + viewport.height / viewport.scale
    )
    
    for (let y = startTile.y; y <= endTile.y; y++) {
      for (let x = startTile.x; x <= endTile.x; x++) {
        tiles.push(this.getTile(x, y))
      }
    }
    
    return tiles
  }

  clearAll() {
    this.tiles.forEach(tile => tile.clear())
  }

  renderTiles(strokes, viewport) {
    const visibleTiles = this.getVisibleTiles(viewport)
    visibleTiles.forEach(tile => {
      tile.render(strokes, viewport)
    })
    return visibleTiles
  }

  renderTilesWithErase(strokes, eraseStrokes, viewport) {
    const visibleTiles = this.getVisibleTiles(viewport)
    visibleTiles.forEach(tile => {
      tile.render(strokes, viewport, eraseStrokes)
    })
    return visibleTiles
  }
}
