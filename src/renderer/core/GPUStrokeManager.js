/**
 * GPU Stroke Manager - Optimized for GPU rendering
 * Converts stroke data into GPU-friendly format with instanced rendering
 */

export class GPUStrokeManager {
  constructor() {
    this.strokes = []
    this.currentStroke = null
    this.strokeIdCounter = 0
    this.gpuPoints = [] // Flattened points for GPU
  }

  startStroke(x, y, color, width) {
    this.currentStroke = {
      id: this.strokeIdCounter++,
      points: [{ x, y }],
      color: this.parseColor(color),
      width: width
    }
    return this.currentStroke
  }

  addPoint(x, y) {
    if (!this.currentStroke) return
    this.currentStroke.points.push({ x, y })
  }

  finishStroke() {
    if (!this.currentStroke) return null
    
    this.strokes.push(this.currentStroke)
    const finished = this.currentStroke
    this.currentStroke = null
    
    // Update GPU points cache
    this.updateGPUPoints()
    
    return finished
  }

  parseColor(colorString) {
    // Convert hex color to RGBA floats
    const hex = colorString.replace('#', '')
    return {
      r: parseInt(hex.substr(0, 2), 16) / 255,
      g: parseInt(hex.substr(2, 2), 16) / 255,
      b: parseInt(hex.substr(4, 2), 16) / 255,
      a: 1.0
    }
  }

  updateGPUPoints() {
    // Convert all stroke points to GPU-friendly format
    this.gpuPoints = []
    
    for (const stroke of this.strokes) {
      const color = stroke.color
      const width = stroke.width
      
      for (let i = 0; i < stroke.points.length; i++) {
        const point = stroke.points[i]
        
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
    const width = this.currentStroke.width
    
    for (const point of this.currentStroke.points) {
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
  }

  getStrokeCount() {
    return this.strokes.length + (this.currentStroke ? 1 : 0)
  }
}
