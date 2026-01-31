/**
 * WebGPU Native Renderer
 * High-performance GPU-accelerated rendering using wgpu (via WebGPU API)
 * This provides near-native performance without C++ bindings
 */

export class WebGPURenderer {
  constructor() {
    this.device = null
    this.context = null
    this.pipeline = null
    this.canvas = null
    this.format = null
    this.strokeBuffer = null
    this.uniformBuffer = null
    this.bindGroup = null
    this.commandQueue = []
    this.maxStrokes = 10000
    this.msaaTexture = null // For 4x MSAA
  }

  async initialize(canvas) {
    this.canvas = canvas
    
    // Check WebGPU support
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported in this browser. Electron 28+ required with --enable-features=Vulkan flag')
    }

    // Request adapter
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    })
    
    if (!adapter) {
      throw new Error('Failed to get WebGPU adapter')
    }

    // Request device
    this.device = await adapter.requestDevice({
      requiredFeatures: [],
      requiredLimits: {
        maxBufferSize: 256 * 1024 * 1024, // 256MB for stroke data
        maxStorageBufferBindingSize: 128 * 1024 * 1024
      }
    })

    // Configure canvas context
    this.context = canvas.getContext('webgpu')
    this.format = navigator.gpu.getPreferredCanvasFormat()
    
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    })

    // Create render pipeline
    await this.createPipeline()
    
    // Create buffers
    this.createBuffers()

    // Create MSAA texture
    this.createMSAATexture()

    console.log('WebGPU renderer initialized successfully')
    return true
  }

  createMSAATexture() {
    if (this.msaaTexture) {
      this.msaaTexture.destroy()
    }
    
    this.msaaTexture = this.device.createTexture({
      size: {
        width: this.canvas.width,
        height: this.canvas.height
      },
      sampleCount: 4,
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    })
  }

  async createPipeline() {
    // Vertex shader for stroke rendering
    const vertexShaderCode = `
      struct Uniforms {
        viewProjection: mat4x4<f32>,
        viewport: vec4<f32>, // x, y, width, height
      }
      
      struct Stroke {
        position: vec2<f32>,
        color: vec4<f32>,
        width: f32,
        _padding: f32,
      }
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var<storage, read> strokes: array<Stroke>;
      
      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec4<f32>,
      }
      
      @vertex
      fn vs_main(
        @builtin(vertex_index) vertexIndex: u32,
        @builtin(instance_index) instanceIndex: u32
      ) -> VertexOutput {
        var output: VertexOutput;
        
        let stroke = strokes[instanceIndex];
        
        // Generate quad vertices for each stroke point
        var quadVertices = array<vec2<f32>, 6>(
          vec2<f32>(-1.0, -1.0),
          vec2<f32>(1.0, -1.0),
          vec2<f32>(-1.0, 1.0),
          vec2<f32>(-1.0, 1.0),
          vec2<f32>(1.0, -1.0),
          vec2<f32>(1.0, 1.0)
        );
        
        let vertex = quadVertices[vertexIndex];
        let radius = stroke.width * 0.5;
        let worldPos = stroke.position + vertex * radius;
        
        output.position = uniforms.viewProjection * vec4<f32>(worldPos, 0.0, 1.0);
        output.color = stroke.color;
        
        return output;
      }
    `

    // Fragment shader
    const fragmentShaderCode = `
      @fragment
      fn fs_main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
        return color;
      }
    `

    const shaderModule = this.device.createShaderModule({
      code: vertexShaderCode + '\n' + fragmentShaderCode
    })

    // Create bind group layout
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' }
        }
      ]
    })

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout]
    })

    // Create render pipeline
    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main'
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: this.format,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            }
          }
        }]
      },
      primitive: {
        topology: 'triangle-list'
      },
      multisample: {
        count: 4 // 4x MSAA for smooth lines
      }
    })

    this.bindGroupLayout = bindGroupLayout
  }

  createBuffers() {
    // Uniform buffer for viewport transform
    this.uniformBuffer = this.device.createBuffer({
      size: 80, // mat4x4 (64 bytes) + vec4 (16 bytes)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })

    // Stroke buffer (storage buffer for GPU instancing)
    const strokeDataSize = 32 // vec2 pos + vec4 color + float width + padding
    this.strokeBuffer = this.device.createBuffer({
      size: strokeDataSize * this.maxStrokes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })

    // Create bind group
    this.bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer }
        },
        {
          binding: 1,
          resource: { buffer: this.strokeBuffer }
        }
      ]
    })
  }

  updateViewport(viewport) {
    // Create orthographic projection matrix
    const left = viewport.x
    const right = viewport.x + viewport.width / viewport.scale
    const top = viewport.y
    const bottom = viewport.y + viewport.height / viewport.scale

    const projection = new Float32Array([
      2 / (right - left), 0, 0, 0,
      0, 2 / (top - bottom), 0, 0,
      0, 0, -1, 0,
      -(right + left) / (right - left), -(top + bottom) / (top - bottom), 0, 1
    ])

    const viewportData = new Float32Array([
      viewport.x, viewport.y, viewport.width, viewport.height
    ])

    // Combine into single buffer
    const uniformData = new Float32Array(20)
    uniformData.set(projection, 0)
    uniformData.set(viewportData, 16)

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData)
  }

  updateStrokes(strokes) {
    // Convert strokes to GPU format
    const strokeData = new Float32Array(strokes.length * 8) // 8 floats per stroke
    
    strokes.forEach((stroke, i) => {
      const offset = i * 8
      // Position (2 floats)
      strokeData[offset + 0] = stroke.x
      strokeData[offset + 1] = stroke.y
      // Color (4 floats - RGBA)
      strokeData[offset + 2] = stroke.r
      strokeData[offset + 3] = stroke.g
      strokeData[offset + 4] = stroke.b
      strokeData[offset + 5] = stroke.a
      // Width (1 float)
      strokeData[offset + 6] = stroke.width
      // Padding (1 float)
      strokeData[offset + 7] = 0
    })

    this.device.queue.writeBuffer(this.strokeBuffer, 0, strokeData)
  }

  render(strokes, viewport) {
    if (!this.device || !this.pipeline) return

    // Update uniforms
    this.updateViewport(viewport)

    // Update stroke data
    this.updateStrokes(strokes)

    // Begin render pass
    const commandEncoder = this.device.createCommandEncoder()
    const textureView = this.context.getCurrentTexture().createView()
    const msaaView = this.msaaTexture.createView()

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: msaaView, // Render to MSAA texture
        resolveTarget: textureView, // Resolve to canvas
        clearValue: { r: 1, g: 1, b: 1, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    })

    renderPass.setPipeline(this.pipeline)
    renderPass.setBindGroup(0, this.bindGroup)
    
    // Draw strokes (6 vertices per stroke quad, instanced)
    renderPass.draw(6, strokes.length, 0, 0)
    
    renderPass.end()

    this.device.queue.submit([commandEncoder.finish()])
  }

  resize(width, height) {
    if (this.canvas) {
      this.canvas.width = width
      this.canvas.height = height
      // Recreate MSAA texture with new size
      this.createMSAATexture()
    }
  }

  destroy() {
    if (this.device) {
      this.strokeBuffer?.destroy()
      this.uniformBuffer?.destroy()
      this.msaaTexture?.destroy()
      this.device.destroy()
    }
  }
}
