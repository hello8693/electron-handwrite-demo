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
    this.vertexBuffer = null
    this.vertexCapacity = 0
    this.uniformBuffer = null
    this.bindGroup = null
    this.commandQueue = []
    this.maxStrokes = 20000
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
      
      struct VertexInput {
        @location(0) position: vec2<f32>,
        @location(1) color: vec4<f32>,
      }
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      
      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec4<f32>,
      }
      
      @vertex
      fn vs_main(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = uniforms.viewProjection * vec4<f32>(input.position, 0.0, 1.0);
        output.color = input.color;
        
        return output;
      }
    `

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
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x4' }
            ]
          }
        ]
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

    // Create bind group
    this.bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer }
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

  updateVertices(vertices) {
    const data = vertices instanceof Float32Array
      ? vertices
      : new Float32Array(vertices.length * 6)

    if (!(vertices instanceof Float32Array)) {
      vertices.forEach((v, i) => {
        const offset = i * 6
        data[offset + 0] = v.x
        data[offset + 1] = v.y
        data[offset + 2] = v.r
        data[offset + 3] = v.g
        data[offset + 4] = v.b
        data[offset + 5] = v.a
      })
    }

    this.ensureVertexBuffer(data.byteLength)
    this.device.queue.writeBuffer(this.vertexBuffer, 0, data)
    return data.length / 6
  }

  ensureVertexBuffer(byteLength) {
    if (this.vertexBuffer && this.vertexCapacity >= byteLength) return
    if (this.vertexBuffer) {
      this.vertexBuffer.destroy()
    }
    this.vertexCapacity = Math.max(byteLength, 1024 * 1024)
    this.vertexBuffer = this.device.createBuffer({
      size: this.vertexCapacity,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    })
  }

  render(vertices, viewport) {
    if (!this.device || !this.pipeline) return

    // Update uniforms
    this.updateViewport(viewport)

    // Update vertex data
    const vertexCount = this.updateVertices(vertices)

    // Begin render pass
    const commandEncoder = this.device.createCommandEncoder()
    const textureView = this.context.getCurrentTexture().createView()
    const msaaView = this.msaaTexture.createView()

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: msaaView, // Render to MSAA texture
        resolveTarget: textureView, // Resolve to canvas
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    })

    renderPass.setPipeline(this.pipeline)
    renderPass.setBindGroup(0, this.bindGroup)
    renderPass.setVertexBuffer(0, this.vertexBuffer)
    
    renderPass.draw(vertexCount, 1, 0, 0)
    
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
      this.vertexBuffer?.destroy()
      this.uniformBuffer?.destroy()
      this.msaaTexture?.destroy()
      this.device.destroy()
    }
  }
}
