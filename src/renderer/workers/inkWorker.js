let wasmModule = null

async function initWasm() {
  if (wasmModule) return wasmModule
  const mod = await import('../wasm/ink_engine/pkg/ink_engine.js')
  if (typeof mod.default === 'function') {
    await mod.default()
  }
  wasmModule = mod
  return wasmModule
}

self.onmessage = async (event) => {
  const { id, points, widths, color } = event.data
  try {
    const wasm = await initWasm()
    const pts = points instanceof Float32Array ? points : new Float32Array(points)
    const wds = widths instanceof Float32Array ? widths : new Float32Array(widths)
    const col = color instanceof Float32Array ? color : new Float32Array(color)
    const out = wasm.build_mesh(pts, wds, col)
    const vertices = out instanceof Float32Array ? out : new Float32Array(out)
    self.postMessage({ id, vertices }, [vertices.buffer])
  } catch (error) {
    self.postMessage({ id, error: error?.message || String(error) })
  }
}
