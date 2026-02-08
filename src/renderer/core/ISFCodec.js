/**
 * ISFCodec.js - Ink Serialized Format Codec
 * 
 * Port of WPF's ISF (Ink Serialized Format) with multi-codec compression.
 * Implements:
 * - Delta-Delta transform for smooth curves
 * - Gorilla codec for time-series data (positions, pressure)
 * - Variable-length integer encoding
 * - Stroke descriptor with packet properties
 */

/**
 * Delta-Delta Transform
 * Encodes differences of differences to reduce entropy for smooth curves
 */
export class DeltaDeltaTransform {
  /**
   * Encode array using delta-delta transform
   * @param {Array<number>} values - Input values
   * @returns {Array<number>} Delta-delta encoded values
   */
  static encode(values) {
    if (values.length === 0) return []
    if (values.length === 1) return [values[0]]
    if (values.length === 2) return [values[0], values[1] - values[0]]

    const encoded = [values[0], values[1] - values[0]]
    let lastDelta = values[1] - values[0]

    for (let i = 2; i < values.length; i++) {
      const delta = values[i] - values[i - 1]
      const deltaDelta = delta - lastDelta
      encoded.push(deltaDelta)
      lastDelta = delta
    }

    return encoded
  }

  /**
   * Decode delta-delta encoded array
   * @param {Array<number>} encoded - Delta-delta encoded values
   * @returns {Array<number>} Original values
   */
  static decode(encoded) {
    if (encoded.length === 0) return []
    if (encoded.length === 1) return [encoded[0]]
    if (encoded.length === 2) return [encoded[0], encoded[0] + encoded[1]]

    const decoded = [encoded[0], encoded[0] + encoded[1]]
    let lastDelta = encoded[1]

    for (let i = 2; i < encoded.length; i++) {
      const delta = lastDelta + encoded[i]
      decoded.push(decoded[i - 1] + delta)
      lastDelta = delta
    }

    return decoded
  }
}

/**
 * Variable-length integer encoding (LEB128-style)
 */
export class VarIntCodec {
  /**
   * Encode signed integer to variable-length bytes
   * @param {number} value - Integer value
   * @returns {Uint8Array} Encoded bytes
   */
  static encode(value) {
    const bytes = []
    let v = Math.floor(value)
    const negative = v < 0
    
    if (negative) {
      v = -v
    }

    do {
      let byte = v & 0x7F
      v >>>= 7
      
      if (v !== 0) {
        byte |= 0x80 // More bytes follow
      }
      
      bytes.push(byte)
    } while (v !== 0)

    // Set sign bit in first byte
    if (negative) {
      bytes[0] |= 0x40
    }

    return new Uint8Array(bytes)
  }

  /**
   * Decode variable-length bytes to signed integer
   * @param {Uint8Array} bytes - Encoded bytes
   * @param {number} offset - Start offset
   * @returns {Object} { value, bytesRead }
   */
  static decode(bytes, offset = 0) {
    let value = 0
    let shift = 0
    let bytesRead = 0
    const negative = (bytes[offset] & 0x40) !== 0

    while (offset + bytesRead < bytes.length) {
      const byte = bytes[offset + bytesRead]
      bytesRead++
      
      value |= (byte & 0x7F) << shift
      shift += 7
      
      if ((byte & 0x80) === 0) {
        break
      }
    }

    if (negative) {
      value = -value
    }

    return { value, bytesRead }
  }
}

/**
 * Gorilla Codec - Optimized for time-series data
 * Based on Facebook's Gorilla time-series compression
 */
export class GorillaCodec {
  /**
   * Encode float array using Gorilla compression
   * @param {Array<number>} values - Float values
   * @param {number} precision - Decimal places to preserve (default: 2)
   * @returns {Uint8Array} Compressed bytes
   */
  static encode(values, precision = 2) {
    if (values.length === 0) return new Uint8Array(0)

    const scale = Math.pow(10, precision)
    const scaledValues = values.map(v => Math.round(v * scale))
    
    // Use delta-delta transform first
    const deltaDeltas = DeltaDeltaTransform.encode(scaledValues)
    
    // Encode using variable-length integers
    const encoded = []
    
    // Header: count and precision
    const countBytes = VarIntCodec.encode(values.length)
    encoded.push(...countBytes, precision)
    
    for (const value of deltaDeltas) {
      const bytes = VarIntCodec.encode(value)
      encoded.push(...bytes)
    }

    return new Uint8Array(encoded)
  }

  /**
   * Decode Gorilla compressed data
   * @param {Uint8Array} bytes - Compressed bytes
   * @returns {Array<number>} Original float values
   */
  static decode(bytes) {
    if (bytes.length === 0) return []

    let offset = 0
    
    // Read header
    const countResult = VarIntCodec.decode(bytes, offset)
    const count = countResult.value
    offset += countResult.bytesRead
    
    const precision = bytes[offset++]
    const scale = Math.pow(10, precision)
    
    // Read delta-delta values
    const deltaDeltas = []
    while (deltaDeltas.length < count && offset < bytes.length) {
      const result = VarIntCodec.decode(bytes, offset)
      deltaDeltas.push(result.value)
      offset += result.bytesRead
    }
    
    // Decode delta-delta transform
    const scaledValues = DeltaDeltaTransform.decode(deltaDeltas)
    
    // Unscale to original floats
    return scaledValues.map(v => v / scale)
  }

  /**
   * Estimate compression ratio
   * @param {Array<number>} values - Original values
   * @returns {number} Estimated compression ratio (original/compressed)
   */
  static estimateCompressionRatio(values, precision = 2) {
    if (values.length === 0) return 1

    const originalBytes = values.length * 4 // Float32
    const compressed = this.encode(values, precision)
    return originalBytes / compressed.length
  }
}

/**
 * StrokePacket - Represents stroke data with packet properties
 */
export class StrokePacket {
  constructor(points) {
    this.x = []
    this.y = []
    this.pressure = []
    this.time = []
    
    for (const point of points) {
      this.x.push(point.x || 0)
      this.y.push(point.y || 0)
      this.pressure.push(point.pressure !== undefined ? point.pressure : 1.0)
      this.time.push(point.time || 0)
    }
  }

  get count() {
    return this.x.length
  }

  getPoint(index) {
    if (index < 0 || index >= this.count) return null
    
    return {
      x: this.x[index],
      y: this.y[index],
      pressure: this.pressure[index],
      time: this.time[index]
    }
  }
}

/**
 * StrokeDescriptor - Metadata for stroke serialization
 */
export class StrokeDescriptor {
  constructor(stroke) {
    this.version = 1 // ISF version
    this.strokeId = stroke.id || 0
    this.color = stroke.color || '#000000'
    this.width = stroke.width || 2
    this.timestamp = stroke.createdAt || Date.now()
    
    // Packet properties flags
    this.hasX = true
    this.hasY = true
    this.hasPressure = stroke.points?.some(p => p.pressure !== undefined) || false
    this.hasTime = stroke.points?.some(p => p.time !== undefined) || false
  }

  toBytes() {
    const flags = 
      (this.hasX ? 0x01 : 0) |
      (this.hasY ? 0x02 : 0) |
      (this.hasPressure ? 0x04 : 0) |
      (this.hasTime ? 0x08 : 0)

    // Simple binary format: [version, flags, strokeId, color (RGB), width]
    const bytes = []
    
    bytes.push(this.version)
    bytes.push(flags)
    
    // Stroke ID as varint
    const idBytes = VarIntCodec.encode(this.strokeId)
    bytes.push(...idBytes)
    
    // Color as RGB (3 bytes)
    const color = this.parseColor(this.color)
    bytes.push(color.r, color.g, color.b)
    
    // Width as varint (scaled by 100 for precision)
    const widthBytes = VarIntCodec.encode(Math.round(this.width * 100))
    bytes.push(...widthBytes)
    
    return new Uint8Array(bytes)
  }

  static fromBytes(bytes, offset = 0) {
    let pos = offset
    
    const descriptor = new StrokeDescriptor({ points: [] })
    descriptor.version = bytes[pos++]
    
    const flags = bytes[pos++]
    descriptor.hasX = (flags & 0x01) !== 0
    descriptor.hasY = (flags & 0x02) !== 0
    descriptor.hasPressure = (flags & 0x04) !== 0
    descriptor.hasTime = (flags & 0x08) !== 0
    
    // Stroke ID
    const idResult = VarIntCodec.decode(bytes, pos)
    descriptor.strokeId = idResult.value
    pos += idResult.bytesRead
    
    // Color - convert back to hex format for consistency
    const r = bytes[pos].toString(16).padStart(2, '0')
    const g = bytes[pos + 1].toString(16).padStart(2, '0')
    const b = bytes[pos + 2].toString(16).padStart(2, '0')
    descriptor.color = `#${r}${g}${b}`
    pos += 3
    
    // Width
    const widthResult = VarIntCodec.decode(bytes, pos)
    descriptor.width = widthResult.value / 100
    pos += widthResult.bytesRead
    
    return { descriptor, bytesRead: pos - offset }
  }

  parseColor(color) {
    // Parse hex or rgb color to RGB components
    if (typeof color === 'string') {
      if (color.startsWith('#')) {
        const hex = color.slice(1)
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16)
        }
      } else if (color.startsWith('rgb(') || color.startsWith('rgba(')) {
        // Parse rgb(r, g, b) or rgba(r, g, b, a) format
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
        if (match) {
          return {
            r: parseInt(match[1]),
            g: parseInt(match[2]),
            b: parseInt(match[3])
          }
        }
      }
    }
    
    // Default to black
    return { r: 0, g: 0, b: 0 }
  }
}

/**
 * ISF Stroke Serializer
 */
export class ISFStrokeSerializer {
  /**
   * Serialize stroke to ISF format
   * @param {Object} stroke - Stroke object with points, color, width
   * @param {Object} options - { precision }
   * @returns {Uint8Array} Serialized bytes
   */
  static serialize(stroke, options = {}) {
    const { precision = 2 } = options
    
    // Create descriptor
    const descriptor = new StrokeDescriptor(stroke)
    const descriptorBytes = descriptor.toBytes()
    
    // Create packet
    const packet = new StrokePacket(stroke.points || [])
    
    // Compress each property using Gorilla codec
    const xCompressed = GorillaCodec.encode(packet.x, precision)
    const yCompressed = GorillaCodec.encode(packet.y, precision)
    const pressureCompressed = descriptor.hasPressure 
      ? GorillaCodec.encode(packet.pressure, 3) // Higher precision for pressure
      : new Uint8Array(0)
    const timeCompressed = descriptor.hasTime
      ? GorillaCodec.encode(packet.time, 0) // No decimal places for time
      : new Uint8Array(0)
    
    // Combine all parts
    const totalLength = 
      4 + // Length header
      descriptorBytes.length +
      4 + xCompressed.length +
      4 + yCompressed.length +
      4 + pressureCompressed.length +
      4 + timeCompressed.length
    
    const result = new Uint8Array(totalLength)
    let offset = 0
    
    // Write total length
    new DataView(result.buffer).setUint32(offset, totalLength, true)
    offset += 4
    
    // Write descriptor
    result.set(descriptorBytes, offset)
    offset += descriptorBytes.length
    
    // Write compressed data with length prefixes
    const writeCompressed = (data) => {
      new DataView(result.buffer).setUint32(offset, data.length, true)
      offset += 4
      result.set(data, offset)
      offset += data.length
    }
    
    writeCompressed(xCompressed)
    writeCompressed(yCompressed)
    writeCompressed(pressureCompressed)
    writeCompressed(timeCompressed)
    
    return result
  }

  /**
   * Deserialize stroke from ISF format
   * @param {Uint8Array} bytes - Serialized bytes
   * @returns {Object} Stroke object
   */
  static deserialize(bytes) {
    let offset = 0
    
    // Read total length
    const totalLength = new DataView(bytes.buffer).getUint32(offset, true)
    offset += 4
    
    // Read descriptor
    const descriptorResult = StrokeDescriptor.fromBytes(bytes, offset)
    const descriptor = descriptorResult.descriptor
    offset += descriptorResult.bytesRead
    
    // Read compressed data
    const readCompressed = () => {
      const length = new DataView(bytes.buffer).getUint32(offset, true)
      offset += 4
      const data = bytes.slice(offset, offset + length)
      offset += length
      return data
    }
    
    const xCompressed = readCompressed()
    const yCompressed = readCompressed()
    const pressureCompressed = readCompressed()
    const timeCompressed = readCompressed()
    
    // Decompress
    const x = GorillaCodec.decode(xCompressed)
    const y = GorillaCodec.decode(yCompressed)
    const pressure = descriptor.hasPressure 
      ? GorillaCodec.decode(pressureCompressed)
      : x.map(() => 1.0)
    const time = descriptor.hasTime
      ? GorillaCodec.decode(timeCompressed)
      : x.map(() => 0)
    
    // Reconstruct points
    const points = []
    for (let i = 0; i < x.length; i++) {
      points.push({
        x: x[i],
        y: y[i],
        pressure: pressure[i],
        time: time[i]
      })
    }
    
    return {
      id: descriptor.strokeId,
      color: descriptor.color,
      width: descriptor.width,
      points,
      timestamp: descriptor.timestamp
    }
  }

  /**
   * Get compression statistics
   * @param {Object} stroke - Stroke object
   * @returns {Object} Statistics
   */
  static getCompressionStats(stroke) {
    const serialized = this.serialize(stroke)
    const pointCount = stroke.points?.length || 0
    const originalSize = pointCount * 16 // 4 floats per point (x, y, pressure, time)
    
    return {
      originalSize,
      compressedSize: serialized.length,
      compressionRatio: originalSize / serialized.length,
      pointCount,
      bytesPerPoint: serialized.length / pointCount
    }
  }
}
