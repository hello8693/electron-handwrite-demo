/**
 * Viewport Manager - Handles pan and zoom transformations
 */

export class Viewport {
  constructor(width, height) {
    this.x = 0 // World space X offset
    this.y = 0 // World space Y offset
    this.width = width
    this.height = height
    this.scale = 1.0
    this.minScale = 0.1
    this.maxScale = 5.0
  }

  resize(width, height) {
    this.width = width
    this.height = height
  }

  screenToWorld(screenX, screenY) {
    return {
      x: this.x + screenX / this.scale,
      y: this.y + screenY / this.scale
    }
  }

  worldToScreen(worldX, worldY) {
    return {
      x: (worldX - this.x) * this.scale,
      y: (worldY - this.y) * this.scale
    }
  }

  pan(deltaX, deltaY) {
    this.x -= deltaX / this.scale
    this.y -= deltaY / this.scale
  }

  zoom(delta, centerX, centerY) {
    const oldScale = this.scale
    this.scale *= delta > 0 ? 1.1 : 0.9
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale))

    // Zoom towards cursor position
    if (oldScale !== this.scale) {
      const worldPos = {
        x: this.x + centerX / oldScale,
        y: this.y + centerY / oldScale
      }
      this.x = worldPos.x - centerX / this.scale
      this.y = worldPos.y - centerY / this.scale
    }
  }

  getTransform() {
    return {
      x: this.x,
      y: this.y,
      scale: this.scale
    }
  }

  reset() {
    this.x = 0
    this.y = 0
    this.scale = 1.0
  }
}
