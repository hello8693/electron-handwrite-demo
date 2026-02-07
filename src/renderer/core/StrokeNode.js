/**
 * StrokeNode.js - WPF-inspired stroke node representation
 * 
 * Port of WPF's StrokeNode system for optimized stroke rendering.
 * Implements:
 * - Angle-based node culling (45°/20°/10° thresholds)
 * - Pressure-aware stroke segments
 * - Connecting quad geometry between nodes
 * - Ellipse and rectangle brush shapes
 */

/**
 * StrokeNodeData - Immutable data for a single node
 */
export class StrokeNodeData {
  constructor(x, y, pressure = 1.0, time = 0) {
    this.x = x
    this.y = y
    this.pressure = Math.max(0.0, Math.min(1.0, pressure))
    this.time = time
  }

  get position() {
    return { x: this.x, y: this.y }
  }

  isEmpty() {
    return this.x === 0 && this.y === 0
  }
}

/**
 * StrokeNode - Represents a single segment on stroke spine
 */
export class StrokeNode {
  constructor(index, nodeData, lastNodeData, isLastNode = false) {
    this.index = index
    this.thisNode = nodeData
    this.lastNode = lastNodeData || new StrokeNodeData(0, 0, 1.0)
    this.isLastNode = isLastNode
    this._bounds = null
  }

  get position() {
    return this.thisNode.position
  }

  get previousPosition() {
    return this.lastNode.position
  }

  get pressureFactor() {
    return this.thisNode.pressure
  }

  get previousPressureFactor() {
    return this.lastNode.pressure
  }

  get isValid() {
    return !this.thisNode.isEmpty()
  }

  /**
   * Get bounding rectangle for this node
   */
  getBounds(width = 2) {
    if (this._bounds) return this._bounds

    const radius = (width * this.pressureFactor) / 2
    this._bounds = {
      minX: this.thisNode.x - radius,
      minY: this.thisNode.y - radius,
      maxX: this.thisNode.x + radius,
      maxY: this.thisNode.y + radius,
      width: radius * 2,
      height: radius * 2
    }
    return this._bounds
  }

  /**
   * Get connecting quad between this node and previous node
   */
  getConnectingQuad(width = 2) {
    if (!this.isValid || this.lastNode.isEmpty()) {
      return null
    }

    const dx = this.thisNode.x - this.lastNode.x
    const dy = this.thisNode.y - this.lastNode.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    if (dist < 0.001) {
      return null
    }

    // Perpendicular vector (normalized)
    const nx = -dy / dist
    const ny = dx / dist

    const r0 = (width * this.lastNode.pressure) / 2
    const r1 = (width * this.thisNode.pressure) / 2

    // Four corners of the quad (A, B, C, D)
    return {
      a: { x: this.lastNode.x + nx * r0, y: this.lastNode.y + ny * r0 },
      b: { x: this.lastNode.x - nx * r0, y: this.lastNode.y - ny * r0 },
      c: { x: this.thisNode.x - nx * r1, y: this.thisNode.y + ny * r1 },
      d: { x: this.thisNode.x + nx * r1, y: this.thisNode.y + ny * r1 }
    }
  }
}

/**
 * StrokeNodeIterator - Iterates through stroke points and creates nodes
 */
export class StrokeNodeIterator {
  constructor(points, width = 2) {
    this.points = points
    this.width = width
    this.count = points.length
  }

  getNode(index) {
    if (index < 0 || index >= this.count) {
      return null
    }

    const point = this.points[index]
    const nodeData = new StrokeNodeData(
      point.x,
      point.y,
      point.pressure !== undefined ? point.pressure : 1.0,
      point.time || 0
    )

    const lastNodeData = index > 0
      ? new StrokeNodeData(
          this.points[index - 1].x,
          this.points[index - 1].y,
          this.points[index - 1].pressure !== undefined ? this.points[index - 1].pressure : 1.0,
          this.points[index - 1].time || 0
        )
      : null

    return new StrokeNode(index, nodeData, lastNodeData, index === this.count - 1)
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.count; i++) {
      yield this.getNode(i)
    }
  }
}

/**
 * Calculate angle delta from last stroke segment
 * @param {Object} prevPos - Previous position {x, y}
 * @param {Object} currPos - Current position {x, y}
 * @param {Object} lastAngleRef - Reference object with lastAngle property
 * @returns {number} Angle delta in degrees
 */
export function getAngleDeltaFromLast(prevPos, currPos, lastAngleRef) {
  if (!prevPos || !currPos) return 0

  const dx = currPos.x - prevPos.x
  const dy = currPos.y - prevPos.y
  
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return 0
  }

  let angle = Math.atan2(dy, dx) * (180 / Math.PI)
  if (angle < 0) angle += 360

  if (lastAngleRef.value === undefined) {
    lastAngleRef.value = angle
    return 0
  }

  let delta = Math.abs(angle - lastAngleRef.value)
  
  // Handle wrap-around (e.g., 359° to 1° is 2°, not 358°)
  if (delta > 180) {
    delta = 360 - delta
  }

  lastAngleRef.value = angle
  return delta
}

/**
 * WPF-inspired stroke geometry optimizer
 * Reduces node count by culling nodes based on angle and pressure changes
 */
export class StrokeGeometryOptimizer {
  constructor(options = {}) {
    this.angleTolerance = options.angleTolerance || 45 // Default 45° from WPF
    this.largeNodeAngleTolerance = options.largeNodeAngleTolerance || 20 // 20° for nodes > 40px
    this.transformAngleTolerance = options.transformAngleTolerance || 10 // 10° for complex transforms
    this.largeNodeThreshold = options.largeNodeThreshold || 40 // px
    this.areaChangeThreshold = options.areaChangeThreshold || 0.70 // 70% min/max ratio
  }

  /**
   * Optimize stroke geometry using WPF's angle-based culling
   * @param {Array} points - Array of {x, y, pressure} points
   * @param {number} width - Stroke width
   * @param {Object} options - { calculateBounds, hasComplexTransform }
   * @returns {Object} { nodes, bounds, connectingQuads }
   */
  optimizeStrokeGeometry(points, width, options = {}) {
    const { calculateBounds = true, hasComplexTransform = false } = options
    
    if (points.length === 0) {
      return { nodes: [], bounds: null, connectingQuads: [] }
    }

    const iterator = new StrokeNodeIterator(points, width)
    const optimizedNodes = []
    const connectingQuads = []
    
    let bounds = null
    let lastAngle = { value: undefined }
    let lastRect = null
    let previousPreviousNodeRendered = false

    // Determine angle tolerance based on stroke characteristics
    let angleTolerance = this.angleTolerance
    
    for (let index = 0; index < iterator.count; index++) {
      const strokeNode = iterator.getNode(index)
      const strokeNodeBounds = strokeNode.getBounds(width)

      if (calculateBounds) {
        if (!bounds) {
          bounds = { ...strokeNodeBounds }
        } else {
          bounds.minX = Math.min(bounds.minX, strokeNodeBounds.minX)
          bounds.minY = Math.min(bounds.minY, strokeNodeBounds.minY)
          bounds.maxX = Math.max(bounds.maxX, strokeNodeBounds.maxX)
          bounds.maxY = Math.max(bounds.maxY, strokeNodeBounds.maxY)
          bounds.width = bounds.maxX - bounds.minX
          bounds.height = bounds.maxY - bounds.minY
        }
      }

      // Adjust angle tolerance based on node size and transform
      if (hasComplexTransform) {
        angleTolerance = this.transformAngleTolerance
      } else if (strokeNodeBounds.height > this.largeNodeThreshold || 
                 strokeNodeBounds.width > this.largeNodeThreshold) {
        angleTolerance = this.largeNodeAngleTolerance
      } else {
        angleTolerance = this.angleTolerance
      }

      // Calculate angle delta
      const delta = getAngleDeltaFromLast(
        strokeNode.previousPosition,
        strokeNode.position,
        lastAngle
      )

      const directionChanged = delta > angleTolerance && delta < (360 - angleTolerance)

      // Check area change
      let areaChangedOverThreshold = false
      if (lastRect) {
        const prevArea = lastRect.height * lastRect.width
        const currArea = strokeNodeBounds.height * strokeNodeBounds.width
        const minMax = Math.min(prevArea, currArea) / Math.max(prevArea, currArea)
        if (minMax <= this.areaChangeThreshold) {
          areaChangedOverThreshold = true
        }
      }

      lastRect = strokeNodeBounds

      // Render node if: first 2 nodes, last 2 nodes, direction changed, or area changed
      const shouldRenderNode = 
        index <= 1 || 
        index >= iterator.count - 2 || 
        directionChanged || 
        areaChangedOverThreshold

      if (shouldRenderNode) {
        // Special case: direction changed and previous node wasn't rendered
        if (directionChanged && !previousPreviousNodeRendered && index > 1 && index < iterator.count - 1) {
          // Insert previous node
          const prevNode = iterator.getNode(index - 1)
          if (prevNode) {
            optimizedNodes.push(prevNode)
          }
          previousPreviousNodeRendered = true
        }

        optimizedNodes.push(strokeNode)
      }

      if (!directionChanged) {
        previousPreviousNodeRendered = false
      }

      // Add connecting quad
      const quad = strokeNode.getConnectingQuad(width)
      if (quad) {
        connectingQuads.push(quad)
      }
    }

    return {
      nodes: optimizedNodes,
      bounds,
      connectingQuads
    }
  }
}
