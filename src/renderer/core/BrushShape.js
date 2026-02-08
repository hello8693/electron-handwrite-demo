/**
 * BrushShape.js - WPF StylusShape implementation
 * 
 * Port of WPF's StylusShape system for brush tip rendering.
 * Supports:
 * - Ellipse and Rectangle tip shapes
 * - Tip rotation
 * - Independent width/height
 * - Highlighter mode (alpha blending)
 */

export const BrushTip = {
  ELLIPSE: 'ellipse',
  RECTANGLE: 'rectangle'
}

/**
 * BrushShape - Defines the brush tip shape and properties
 */
export class BrushShape {
  constructor(tip = BrushTip.ELLIPSE, width = 2, height = 2, rotation = 0) {
    this.tip = tip
    this.width = Math.max(0.5, Math.min(100, width))
    this.height = Math.max(0.5, Math.min(100, height))
    // Normalize rotation to 0-360 range
    this.rotation = rotation === 0 ? 0 : ((rotation % 360) + 360) % 360
    this._vertices = null
    
    if (tip === BrushTip.RECTANGLE) {
      this._computeRectangleVertices()
    }
  }

  /**
   * Check if this is an ellipse shape
   */
  get isEllipse() {
    return this.tip === BrushTip.ELLIPSE
  }

  /**
   * Check if this is a rectangle shape
   */
  get isRectangle() {
    return this.tip === BrushTip.RECTANGLE
  }

  /**
   * Get the transform matrix for this brush shape
   */
  getTransformMatrix() {
    // Create transform: scale by width/height, then rotate
    const radians = (this.rotation * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    
    return {
      a: this.width * cos / 2,
      b: this.width * sin / 2,
      c: -this.height * sin / 2,
      d: this.height * cos / 2,
      tx: 0,
      ty: 0
    }
  }

  /**
   * Compute vertices for rectangle brush tip
   * @private
   */
  _computeRectangleVertices() {
    const hw = this.width / 2
    const hh = this.height / 2
    
    // Base rectangle vertices (unrotated)
    const baseVertices = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh }
    ]
    
    // Apply rotation if needed
    if (this.rotation !== 0) {
      const radians = (this.rotation * Math.PI) / 180
      const cos = Math.cos(radians)
      const sin = Math.sin(radians)
      
      this._vertices = baseVertices.map(v => ({
        x: v.x * cos - v.y * sin,
        y: v.x * sin + v.y * cos
      }))
    } else {
      this._vertices = baseVertices
    }
  }

  /**
   * Get rectangle vertices for this brush shape
   */
  getVertices() {
    if (!this._vertices) {
      this._computeRectangleVertices()
    }
    return this._vertices
  }

  /**
   * Get bounds of the brush shape
   */
  getBounds() {
    if (this.isEllipse) {
      // For ellipse, approximate bounds with rectangle
      const transform = this.getTransformMatrix()
      const extent = Math.max(
        Math.abs(transform.a) + Math.abs(transform.c),
        Math.abs(transform.b) + Math.abs(transform.d)
      )
      return {
        width: extent * 2,
        height: extent * 2
      }
    } else {
      // For rectangle, calculate actual bounds from vertices
      const vertices = this.getVertices()
      let minX = Infinity, minY = Infinity
      let maxX = -Infinity, maxY = -Infinity
      
      for (const v of vertices) {
        minX = Math.min(minX, v.x)
        minY = Math.min(minY, v.y)
        maxX = Math.max(maxX, v.x)
        maxY = Math.max(maxY, v.y)
      }
      
      return {
        width: maxX - minX,
        height: maxY - minY
      }
    }
  }

  /**
   * Clone this brush shape
   */
  clone() {
    return new BrushShape(this.tip, this.width, this.height, this.rotation)
  }
}

/**
 * DrawingAttributes - Stroke rendering attributes
 * Ported from WPF DrawingAttributes
 */
export class DrawingAttributes {
  constructor(options = {}) {
    this.color = options.color || '#000000'
    this.width = options.width || 2
    this.height = options.height || 2
    this.stylusTip = options.stylusTip || BrushTip.ELLIPSE
    this.stylusTipTransform = options.stylusTipTransform || null
    this.isHighlighter = options.isHighlighter || false
    this.ignorePressure = options.ignorePressure || false
    this.rotation = options.rotation || 0
  }

  /**
   * Get the brush shape for this drawing attribute
   */
  getBrushShape() {
    return new BrushShape(
      this.stylusTip,
      this.width,
      this.height,
      this.rotation
    )
  }

  /**
   * Get highlighter attributes (with alpha override)
   */
  getHighlighterAttributes() {
    if (!this.isHighlighter) {
      return this
    }

    // For highlighter, override alpha to ensure visibility
    const color = this.parseColor(this.color)
    const highlighterColor = `rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`
    
    return {
      ...this,
      color: highlighterColor,
      _isHighlighterOverride: true
    }
  }

  /**
   * Parse color string to RGB components
   */
  parseColor(color) {
    if (typeof color === 'string') {
      if (color.startsWith('#')) {
        const hex = color.slice(1)
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: hex.length > 6 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
        }
      } else if (color.startsWith('rgb')) {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
        if (match) {
          return {
            r: parseInt(match[1]),
            g: parseInt(match[2]),
            b: parseInt(match[3]),
            a: match[4] ? parseFloat(match[4]) : 1
          }
        }
      }
    }
    return { r: 0, g: 0, b: 0, a: 1 }
  }

  /**
   * Clone these drawing attributes
   */
  clone() {
    return new DrawingAttributes({
      color: this.color,
      width: this.width,
      height: this.height,
      stylusTip: this.stylusTip,
      stylusTipTransform: this.stylusTipTransform,
      isHighlighter: this.isHighlighter,
      ignorePressure: this.ignorePressure,
      rotation: this.rotation
    })
  }
}
