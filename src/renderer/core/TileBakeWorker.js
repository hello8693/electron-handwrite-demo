let workerInstance = null

export function createTileBakeWorker() {
  if (workerInstance) return workerInstance

  const worker = new Worker(new URL('../workers/tileBakeWorker.js', import.meta.url), { type: 'module' })
  let seq = 0
  const pending = new Map()

  worker.onmessage = (event) => {
    const { id, tiles, error } = event.data
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    if (error) {
      entry.reject(new Error(error))
      return
    }
    entry.resolve(tiles)
  }

  workerInstance = {
    rebake({ tiles, strokes, eraseStrokes, tileSize, dpr }) {
      const id = seq++
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        worker.postMessage({ id, tiles, strokes, eraseStrokes, tileSize, dpr })
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
