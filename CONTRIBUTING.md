# Contributing Guide

Thank you for your interest in contributing to the Electron Handwrite Demo!

## Development Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Development Mode**
   ```bash
   npm run dev
   ```
   This starts the Electron app with hot-reload enabled and WebGPU support.

3. **Build for Production**
   ```bash
   npm run build
   ```

4. **Preview Production Build**
   ```bash
   npm run preview
   ```

## Architecture Overview

The application supports **dual rendering modes**:

### WebGPU Mode (Native GPU Acceleration)

#### 1. WebGPU Renderer (`src/renderer/core/WebGPURenderer.js`)
- GPU-accelerated rendering using wgpu (via WebGPU API)
- Custom WGSL shaders for stroke rendering
- Hardware MSAA (4x anti-aliasing)
- Instanced rendering for high performance

**Key Components:**
- `WebGPURenderer`: Main GPU renderer class
- **GPU Pipeline**: Vertex and fragment shaders in WGSL
- **Storage Buffers**: Stroke data uploaded to GPU memory
- **Uniform Buffers**: Viewport transformation matrices
- **Command Encoder**: GPU command batching

**Rendering Pipeline:**
```
Stroke Data → Storage Buffer → GPU Memory
                ↓
Vertex Shader (WGSL) → Instance Quad Generation
                ↓
Fragment Shader → Color Output
                ↓
4x MSAA → Render Target
```

#### 2. GPU Stroke Manager (`src/renderer/core/GPUStrokeManager.js`)
- Converts stroke data to GPU-friendly format
- Manages stroke lifecycle for GPU rendering
- Batches points for efficient GPU upload

**Key Methods:**
- `startStroke()`: Initialize new GPU stroke
- `addPoint()`: Add point to current stroke
- `finishStroke()`: Finalize and upload to GPU
- `getAllGPUPoints()`: Get flattened GPU point array

### Canvas 2D Mode (CPU Fallback)

#### 1. Tile System (`src/renderer/core/TileSystem.js`)
- Manages 256x256 pixel canvas tiles
- Implements dirty flag system for incremental updates
- Handles tile visibility based on viewport

**Key Classes:**
- `Tile`: Individual canvas tile with stroke tracking
- `TileManager`: Manages tile grid and visibility

#### 2. Stroke Manager (`src/renderer/core/StrokeManager.js`)
- Manages stroke data and lifecycle
- Implements bucket-based spatial indexing
- Supports multi-touch with independent strokes

**Key Classes:**
- `Stroke`: Individual stroke with points and bounds
- `StrokeManager`: Manages all strokes and spatial queries

#### 3. Viewport System (`src/renderer/core/Viewport.js`)
- Handles pan and zoom transformations
- Converts between screen and world coordinates
- Manages zoom limits and constraints

**Key Class:**
- `Viewport`: Viewport transformation and coordinate conversion

### Rendering Pipelines

**WebGPU Pipeline:**
1. **Input Phase**: Pointer events create/update GPU strokes
2. **Data Upload**: Stroke data uploaded to GPU storage buffers
3. **Shader Execution**: WGSL shaders process each point instance
4. **Rasterization**: GPU rasterizes quads with MSAA
5. **Output**: Final frame rendered to canvas texture

**Canvas 2D Pipeline:**
1. **Input Phase**: Pointer events create/update strokes
2. **Live Layer**: Active strokes render in real-time
3. **Baking Phase**: Completed strokes bake into tiles
4. **Tile Cache**: Tiles render only when dirty
5. **Composite**: Live layer + tile cache → final output

## WebGPU Shader Development

### WGSL Shader Structure

The application uses **WGSL** (WebGPU Shading Language) shaders:

**Vertex Shader:**
- Generates quad geometry for each stroke point
- Transforms world coordinates to clip space
- Passes color to fragment shader

**Fragment Shader:**
- Outputs final pixel color
- Can be extended for texture sampling, effects

### Modifying Shaders

To modify the rendering shader in `WebGPURenderer.js`:

```javascript
const vertexShaderCode = `
  // Your custom vertex shader
  @vertex
  fn vs_main(...) -> VertexOutput {
    // Custom vertex processing
  }
`

const fragmentShaderCode = `
  // Your custom fragment shader
  @fragment
  fn fs_main(...) -> @location(0) vec4<f32> {
    // Custom fragment processing
  }
`
```

### Adding Compute Shaders

For advanced effects (e.g., stroke smoothing, collision detection):

```javascript
const computeShaderCode = `
  @compute @workgroup_size(64)
  fn cs_main(@builtin(global_invocation_id) id: vec3<u32>) {
    // Process stroke data in parallel
  }
`

const computePipeline = device.createComputePipeline({
  layout: 'auto',
  compute: {
    module: device.createShaderModule({ code: computeShaderCode }),
    entryPoint: 'cs_main'
  }
})
```

## Extension Points

### Adding New Brush Types (WebGPU)

Modify shader to support different brush types:

```javascript
// In storage buffer
struct Stroke {
  position: vec2<f32>,
  color: vec4<f32>,
  width: f32,
  brushType: u32,  // 0=round, 1=square, 2=texture
}

// In fragment shader
@fragment
fn fs_main(@location(0) color: vec4<f32>, 
           @location(1) brushType: u32) -> @location(0) vec4<f32> {
  switch(brushType) {
    case 0u: { return color; }  // Round brush
    case 1u: { return squareBrush(color); }
    case 2u: { return textureBrush(color); }
    default: { return color; }
  }
}
```

### Adding New Brush Types (Canvas 2D)

Modify `Stroke` class in `StrokeManager.js`:

```javascript
export class Stroke {
  constructor(id, color, width, brushType = 'round') {
    this.id = id
    this.color = color
    this.width = width
    this.brushType = brushType // Add brush type
    // ...
  }
}
```

Update rendering in `TileSystem.js` and `Whiteboard.vue`:

```javascript
// In tile render method
switch (stroke.brushType) {
  case 'round':
    ctx.lineCap = 'round'
    break
  case 'square':
    ctx.lineCap = 'square'
    break
  // Add more types...
}
```

### Adding Eraser Tool

1. Add eraser mode state
2. On stroke completion, find intersecting strokes
3. Remove or modify affected strokes
4. Mark affected tiles as dirty

Example:

```javascript
function eraseStroke(eraserStroke) {
  const affectedBuckets = getIntersectingBuckets(eraserStroke.bounds)
  
  affectedBuckets.forEach(bucket => {
    bucket.strokes.forEach(strokeId => {
      if (intersects(eraserStroke, strokeId)) {
        removeStroke(strokeId)
      }
    })
  })
}
```

### Adding Export Functionality

```javascript
async function exportToImage() {
  // Create temporary canvas with all tiles
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  // Calculate bounds of all strokes
  const bounds = calculateStrokeBounds(strokeManager.getAllStrokes())
  
  canvas.width = bounds.width
  canvas.height = bounds.height
  
  // Render all tiles to canvas
  tileManager.tiles.forEach(tile => {
    ctx.drawImage(tile.canvas, tile.x * TILE_SIZE, tile.y * TILE_SIZE)
  })
  
  // Export as PNG
  return canvas.toDataURL('image/png')
}
```

### Migrating to WebGL/WebGPU

For high-performance rendering:

1. Replace `TileSystem` with GPU-accelerated texture system
2. Use shaders for stroke rendering
3. Implement GPU-based spatial queries
4. Keep CPU-side spatial index for queries

Structure:

```javascript
class GPUTileSystem {
  constructor(renderer) {
    this.renderer = renderer // Three.js, Babylon.js, or raw WebGL
    this.textures = new Map()
  }
  
  renderTile(tile, strokes) {
    // Use GPU shaders for rendering
  }
}
```

### Adding Undo/Redo

Implement command pattern:

```javascript
class CommandManager {
  constructor() {
    this.undoStack = []
    this.redoStack = []
  }
  
  execute(command) {
    command.execute()
    this.undoStack.push(command)
    this.redoStack = []
  }
  
  undo() {
    if (this.undoStack.length > 0) {
      const command = this.undoStack.pop()
      command.undo()
      this.redoStack.push(command)
    }
  }
  
  redo() {
    if (this.redoStack.length > 0) {
      const command = this.redoStack.pop()
      command.execute()
      this.undoStack.push(command)
    }
  }
}

class AddStrokeCommand {
  constructor(stroke) {
    this.stroke = stroke
  }
  
  execute() {
    strokeManager.addStroke(this.stroke)
  }
  
  undo() {
    strokeManager.removeStroke(this.stroke.id)
  }
}
```

## Performance Optimization Tips

1. **Reduce Tile Size**: For dense drawings, smaller tiles (128px) may perform better
2. **Tile Pooling**: Reuse canvas objects instead of creating new ones
3. **Lazy Rendering**: Only render tiles when they become visible
4. **Web Workers**: Move stroke processing to worker threads
5. **Request Idle Callback**: Use `requestIdleCallback` for non-critical updates

## Testing

### Manual Testing
- Test with various pointer types (mouse, touch, stylus)
- Verify multi-touch simultaneous drawing
- Test pan/zoom at different scales
- Verify performance with 1000+ strokes

### Automated Testing
Consider adding:
- Unit tests for core systems (Tile, Stroke, Viewport)
- Integration tests for rendering pipeline
- Performance benchmarks

## Code Style

- Use ES6+ features
- Follow Vue 3 Composition API patterns
- Keep functions small and focused
- Add JSDoc comments for public APIs
- Use meaningful variable names

## Questions?

Feel free to open an issue for:
- Feature requests
- Bug reports
- Architecture questions
- Performance concerns
