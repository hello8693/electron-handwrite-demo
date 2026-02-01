let wasmModule = null

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
