# Electron Handwrite Demo

[English](#english) | [中文](#中文)

---

## English

A high-performance multi-touch handwriting whiteboard demo built with Electron, electron-vite, and Vue 3, featuring tile-based rendering for smooth drawing experience.

### Features

- ✨ **Multi-touch Support**: Draw with multiple fingers or styluses simultaneously
- 🎨 **Smooth Drawing**: Canvas-based rendering with optimized performance
- 🧩 **Tile-based Caching**: Efficient tile system for incremental rendering
- 🎯 **Spatial Indexing**: Bucket-based spatial indexing for fast stroke lookup
- 🔄 **Live Layer Architecture**: Separate live layer for active strokes and tile cache for finished strokes
- 🖱️ **Pan & Zoom**: Navigate the canvas with mouse/touchpad gestures
- ⚡ **Incremental Rendering**: Only updates affected tiles when strokes are completed
- 🎨 **Customizable Brush**: Adjustable color and width
- 📊 **Performance Metrics**: Real-time FPS counter and stroke count

### Architecture

The application uses a sophisticated rendering architecture:

1. **Live Layer**: Renders strokes currently being drawn in real-time
2. **Tile Cache**: Bakes completed strokes into 256x256 pixel tiles
3. **Spatial Indexing**: Organizes strokes into buckets for efficient queries
4. **Viewport System**: Handles pan and zoom transformations
5. **Incremental Updates**: Only redraws tiles affected by new strokes

### Technology Stack

- **Electron** ^28.0.0 - Cross-platform desktop framework
- **electron-vite** ^2.0.0 - Fast build tool for Electron apps
- **Vue 3** ^3.4.0 - Progressive JavaScript framework
- **Canvas 2D API** - High-performance rendering

### Project Structure

```
electron-handwrite-demo/
├── src/
│   ├── main/              # Main process
│   │   └── index.js       # Window creation, menu, DevTools
│   ├── preload/           # Preload scripts
│   │   └── index.js       # Context bridge
│   └── renderer/          # Renderer process
│       ├── components/    # Vue components
│       │   └── Whiteboard.vue  # Main whiteboard component
│       ├── core/          # Core rendering logic
│       │   ├── TileSystem.js    # Tile management
│       │   ├── StrokeManager.js # Stroke and spatial indexing
│       │   └── Viewport.js      # Pan/zoom handling
│       ├── App.vue        # Root component
│       ├── main.js        # Vue entry point
│       └── index.html     # HTML template
├── electron.vite.config.js  # Electron-vite configuration
└── package.json
```

### Installation

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Usage

1. **Drawing**: Click and drag with left mouse button or touch to draw
2. **Pan**: Click and drag with middle mouse button or right-click
3. **Zoom**: Use mouse wheel to zoom in/out
4. **Color**: Select brush color from the toolbar
5. **Width**: Adjust brush width using the slider
6. **Clear**: Remove all strokes from the canvas
7. **Reset View**: Reset pan and zoom to default

### Performance Optimization

The demo implements several optimizations:

- **Tile Caching**: Completed strokes are rendered once into tiles
- **Dirty Flag System**: Only redraws modified tiles
- **Spatial Indexing**: Fast lookup of strokes by location
- **Separate Live Layer**: Active strokes rendered independently
- **Viewport Culling**: Only renders visible tiles
- **RequestAnimationFrame**: Smooth 60 FPS rendering loop

### Future Extensions

The architecture supports easy extension with:

- 🎨 Additional brush types (pencil, marker, highlighter)
- 🧹 Eraser tool
- 📤 Export to image/PDF
- 💾 Save/load canvas state
- ⚡ WebGL/WebGPU acceleration
- 🔧 Undo/redo functionality
- 📝 Text tool
- 🖼️ Image insertion

### Cross-platform Testing

Tested on:
- ✅ Windows 10/11
- ✅ Linux (Ubuntu 20.04+)

### License

MIT

---

## 中文

一个基于 Electron、electron-vite 和 Vue 3 构建的高性能多点触控手写白板演示应用，采用瓦片式渲染实现流畅的绘图体验。

### 功能特性

- ✨ **多点触控支持**：同时使用多个手指或触控笔绘图
- 🎨 **流畅绘图**：基于 Canvas 的高性能渲染
- 🧩 **瓦片缓存**：高效的瓦片系统实现增量渲染
- 🎯 **空间索引**：基于桶的空间索引实现快速笔画查找
- 🔄 **分层渲染架构**：活动笔画实时层 + 完成笔画瓦片缓存层
- 🖱️ **平移和缩放**：使用鼠标/触控板手势导航画布
- ⚡ **增量渲染**：笔画完成时仅更新受影响的瓦片
- 🎨 **可自定义画笔**：可调整颜色和宽度
- 📊 **性能指标**：实时 FPS 计数器和笔画数量

### 架构设计

应用采用精巧的渲染架构：

1. **实时层**：实时渲染正在绘制的笔画
2. **瓦片缓存**：将完成的笔画烘焙到 256x256 像素的瓦片中
3. **空间索引**：将笔画组织到桶中以便高效查询
4. **视口系统**：处理平移和缩放变换
5. **增量更新**：仅重绘受新笔画影响的瓦片

### 技术栈

- **Electron** ^28.0.0 - 跨平台桌面应用框架
- **electron-vite** ^2.0.0 - Electron 应用的快速构建工具
- **Vue 3** ^3.4.0 - 渐进式 JavaScript 框架
- **Canvas 2D API** - 高性能渲染

### 项目结构

```
electron-handwrite-demo/
├── src/
│   ├── main/              # 主进程
│   │   └── index.js       # 窗口创建、菜单、开发工具
│   ├── preload/           # 预加载脚本
│   │   └── index.js       # 上下文桥接
│   └── renderer/          # 渲染进程
│       ├── components/    # Vue 组件
│       │   └── Whiteboard.vue  # 主白板组件
│       ├── core/          # 核心渲染逻辑
│       │   ├── TileSystem.js    # 瓦片管理
│       │   ├── StrokeManager.js # 笔画和空间索引
│       │   └── Viewport.js      # 平移/缩放处理
│       ├── App.vue        # 根组件
│       ├── main.js        # Vue 入口
│       └── index.html     # HTML 模板
├── electron.vite.config.js  # Electron-vite 配置
└── package.json
```

### 安装

```bash
# 安装依赖
npm install

# 开发模式（支持热重载）
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

### 使用说明

1. **绘图**：使用鼠标左键点击拖动或触摸绘制
2. **平移**：使用鼠标中键或右键点击拖动
3. **缩放**：使用鼠标滚轮放大/缩小
4. **颜色**：从工具栏选择画笔颜色
5. **宽度**：使用滑块调整画笔宽度
6. **清除**：从画布移除所有笔画
7. **重置视图**：将平移和缩放重置为默认值

### 性能优化

本演示实现了多项优化：

- **瓦片缓存**：完成的笔画只渲染一次到瓦片中
- **脏标记系统**：仅重绘修改过的瓦片
- **空间索引**：按位置快速查找笔画
- **独立实时层**：活动笔画独立渲染
- **视口裁剪**：仅渲染可见瓦片
- **RequestAnimationFrame**：平滑的 60 FPS 渲染循环

### 未来扩展

架构支持轻松扩展以下功能：

- 🎨 额外的画笔类型（铅笔、记号笔、荧光笔）
- 🧹 橡皮擦工具
- 📤 导出为图片/PDF
- 💾 保存/加载画布状态
- ⚡ WebGL/WebGPU 加速
- 🔧 撤销/重做功能
- 📝 文本工具
- 🖼️ 图片插入

### 跨平台测试

已测试平台：
- ✅ Windows 10/11
- ✅ Linux (Ubuntu 20.04+)

### 许可证

MIT
