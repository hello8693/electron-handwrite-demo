问题分析（静态层错位）：
1) Tile 现在按 DPR 放大（Tile.canvas = TILE_SIZE * dpr），但绘制到 staticCtx 时未指定绘制尺寸，drawImage 默认使用源图像的像素尺寸。
2) staticCtx 在 renderStaticTiles 中已执行 setTransform(dpr) + 视口缩放，再叠加“源图像像素尺寸”，等于重复放大，导致 tile 拼接错位。
3) 解决方案：绘制 tile 时使用 drawImage(tile.canvas, worldX, worldY, TILE_SIZE, TILE_SIZE)，确保目的尺寸是世界单位，不受 tile 像素尺寸影响。
4) 同样问题影响 Canvas 2D 路径的 tile 绘制。

计划修改：
- 在 renderStaticTiles 和 renderCanvas2D 中绘制 tile 时，指定目标宽高 TILE_SIZE。
- 保持 Tile.render 内部 dpr 变换仅用于 tile 自身绘制。
