function boundsIntersect(bounds, rect) {
  if (!bounds) return false
  return !(
    bounds.maxX < rect.x ||
    bounds.minX > rect.x + rect.size ||
    bounds.maxY < rect.y ||
    bounds.minY > rect.y + rect.size
  )
}

function drawStroke(ctx, stroke, tileX, tileY, tileSize) {
  const worldX = tileX * tileSize
  const worldY = tileY * tileSize

  ctx.strokeStyle = stroke.color
  ctx.fillStyle = stroke.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (stroke.widths && stroke.widths.length === stroke.points.length) {
    for (let i = 1; i < stroke.points.length; i++) {
      const p0 = stroke.points[i - 1]
      const p1 = stroke.points[i]
      const w0 = stroke.widths[i - 1]
      const w1 = stroke.widths[i]
      const w = (w0 + w1) * 0.5

      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(p0.x - worldX, p0.y - worldY)
      ctx.lineTo(p1.x - worldX, p1.y - worldY)
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(p1.x - worldX, p1.y - worldY, w1 * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }

    if (stroke.points.length === 1) {
      const p0 = stroke.points[0]
      const w0 = stroke.widths[0]
      ctx.beginPath()
      ctx.arc(p0.x - worldX, p0.y - worldY, w0 * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    ctx.lineWidth = stroke.width
    ctx.beginPath()
    let firstPoint = true
    for (const point of stroke.points) {
      const x = point.x - worldX
      const y = point.y - worldY
      if (firstPoint) {
        ctx.moveTo(x, y)
        firstPoint = false
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
  }
}

function drawErase(ctx, stroke, tileX, tileY, tileSize) {
  const worldX = tileX * tileSize
  const worldY = tileY * tileSize

  ctx.beginPath()
  ctx.lineWidth = stroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  let firstPoint = true
  for (const point of stroke.points) {
    const x = point.x - worldX
    const y = point.y - worldY
    if (firstPoint) {
      ctx.moveTo(x, y)
      firstPoint = false
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
}

self.onmessage = (event) => {
  const { id, tiles, strokes, eraseStrokes, tileSize, dpr } = event.data
  try {
    const results = []
    for (const tile of tiles) {
      const rect = { x: tile.x * tileSize, y: tile.y * tileSize, size: tileSize }
      const canvas = new OffscreenCanvas(Math.floor(tileSize * dpr), Math.floor(tileSize * dpr))
      const ctx = canvas.getContext('2d')
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      for (const stroke of strokes) {
        if (!boundsIntersect(stroke.bounds, rect)) continue
        drawStroke(ctx, stroke, tile.x, tile.y, tileSize)
      }

      if (eraseStrokes && eraseStrokes.length > 0) {
        ctx.globalCompositeOperation = 'destination-out'
        for (const stroke of eraseStrokes) {
          if (!boundsIntersect(stroke.bounds, rect)) continue
          drawErase(ctx, stroke, tile.x, tile.y, tileSize)
        }
        ctx.globalCompositeOperation = 'source-over'
      }

      const bitmap = canvas.transferToImageBitmap()
      results.push({ x: tile.x, y: tile.y, bitmap })
    }

    self.postMessage({ id, tiles: results }, results.map((t) => t.bitmap))
  } catch (error) {
    self.postMessage({ id, error: error?.message || String(error) })
  }
}
