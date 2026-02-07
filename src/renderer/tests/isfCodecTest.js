/**
 * Test ISF Codec compression and stroke node optimization
 */

import { ISFStrokeSerializer, GorillaCodec, DeltaDeltaTransform } from '../core/ISFCodec.js'
import { StrokeGeometryOptimizer } from '../core/StrokeNode.js'

// Generate test stroke data
function generateTestStroke(pointCount = 100) {
  const points = []
  for (let i = 0; i < pointCount; i++) {
    const t = i / pointCount
    const x = 100 + Math.sin(t * Math.PI * 4) * 200
    const y = 100 + Math.cos(t * Math.PI * 2) * 150
    const pressure = 0.5 + 0.5 * Math.sin(t * Math.PI * 3)
    const time = Date.now() + i * 10
    
    points.push({ x, y, pressure, time })
  }
  
  return {
    id: 'test-stroke-1',
    color: '#FF5733',
    width: 5,
    points,
    createdAt: Date.now()
  }
}

// Test Delta-Delta Transform
function testDeltaDeltaTransform() {
  console.log('\n=== Delta-Delta Transform Test ===')
  
  const values = [100, 102, 105, 109, 114, 120, 127]
  console.log('Original:', values)
  
  const encoded = DeltaDeltaTransform.encode(values)
  console.log('Delta-Delta encoded:', encoded)
  
  const decoded = DeltaDeltaTransform.decode(encoded)
  console.log('Decoded:', decoded)
  
  const match = values.every((v, i) => v === decoded[i])
  console.log('Match:', match ? '✓' : '✗')
}

// Test Gorilla Codec
function testGorillaCodec() {
  console.log('\n=== Gorilla Codec Test ===')
  
  const values = [10.5, 10.7, 10.9, 11.2, 11.6, 12.1, 12.7, 13.4]
  console.log('Original:', values)
  
  const encoded = GorillaCodec.encode(values, 2)
  console.log('Compressed bytes:', encoded.length)
  console.log('Original bytes:', values.length * 4, '(Float32)')
  
  const decoded = GorillaCodec.decode(encoded)
  console.log('Decoded:', decoded)
  
  const ratio = GorillaCodec.estimateCompressionRatio(values, 2)
  console.log('Compression ratio:', ratio.toFixed(2) + 'x')
}

// Test ISF Stroke Serialization
function testISFSerialization() {
  console.log('\n=== ISF Stroke Serialization Test ===')
  
  const stroke = generateTestStroke(50)
  console.log('Original stroke:', {
    id: stroke.id,
    pointCount: stroke.points.length,
    color: stroke.color,
    width: stroke.width
  })
  
  const serialized = ISFStrokeSerializer.serialize(stroke, { precision: 2 })
  console.log('Serialized bytes:', serialized.length)
  
  const stats = ISFStrokeSerializer.getCompressionStats(stroke)
  console.log('Compression stats:', {
    originalSize: stats.originalSize,
    compressedSize: stats.compressedSize,
    compressionRatio: stats.compressionRatio.toFixed(2) + 'x',
    bytesPerPoint: stats.bytesPerPoint.toFixed(2)
  })
  
  const deserialized = ISFStrokeSerializer.deserialize(serialized)
  console.log('Deserialized stroke:', {
    id: deserialized.id,
    pointCount: deserialized.points.length,
    color: deserialized.color,
    width: deserialized.width
  })
  
  // Verify first and last points
  console.log('First point match:', 
    Math.abs(stroke.points[0].x - deserialized.points[0].x) < 0.01 &&
    Math.abs(stroke.points[0].y - deserialized.points[0].y) < 0.01 ? '✓' : '✗'
  )
}

// Test Stroke Geometry Optimization
function testStrokeOptimization() {
  console.log('\n=== Stroke Geometry Optimization Test ===')
  
  const stroke = generateTestStroke(200)
  console.log('Original point count:', stroke.points.length)
  
  const optimizer = new StrokeGeometryOptimizer({
    angleTolerance: 45,
    largeNodeAngleTolerance: 20,
    transformAngleTolerance: 10
  })
  
  const result = optimizer.optimizeStrokeGeometry(stroke.points, stroke.width, {
    calculateBounds: true,
    hasComplexTransform: false
  })
  
  console.log('Optimized node count:', result.nodes.length)
  console.log('Reduction:', ((1 - result.nodes.length / stroke.points.length) * 100).toFixed(1) + '%')
  console.log('Bounds:', result.bounds)
  console.log('Connecting quads:', result.connectingQuads.length)
}

// Run all tests
export function runTests() {
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║  WPF Ink Codec & Optimization Tests         ║')
  console.log('╚══════════════════════════════════════════════╝')
  
  testDeltaDeltaTransform()
  testGorillaCodec()
  testISFSerialization()
  testStrokeOptimization()
  
  console.log('\n✓ All tests completed!')
}

// Run tests if loaded as module
if (import.meta.url === new URL(import.meta.url).href) {
  runTests()
}
