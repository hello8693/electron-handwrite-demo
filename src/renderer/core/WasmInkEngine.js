let wasmModule = null
let workerInstance = null

export async function loadInkWasm() {
  if (wasmModule) return wasmModule
  try {
    const mod = await import('../wasm/ink_engine/pkg/ink_engine.js')
    if (typeof mod.default === 'function') {
      await mod.default()
    }
    wasmModule = mod
    console.log('[WASM] ink_engine loaded')
    return wasmModule
  } catch (err) {
    console.warn('[WASM] ink_engine not available, falling back to JS:', err?.message || err)
    return null
  }
}

export function createInkWorker() {
  if (workerInstance) return workerInstance

  const worker = new Worker(new URL('../workers/inkWorker.js', import.meta.url), { type: 'module' })
  let seq = 0
  const pending = new Map()

  worker.onmessage = (event) => {
    const { id, vertices, error } = event.data
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    if (error) {
      entry.reject(new Error(error))
      return
    }
    const output = vertices instanceof Float32Array ? vertices : new Float32Array(vertices)
    entry.resolve(output)
  }

  workerInstance = {
    buildMesh(points, widths, color) {
      const id = seq++
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        worker.postMessage(
          { id, points, widths, color },
          [points.buffer, widths.buffer]
        )
      })
    },
    terminate() {
      worker.terminate()
      pending.clear()
      workerInstance = null
    }
  }

  return workerInstance
}
