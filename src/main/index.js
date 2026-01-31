import { app, BrowserWindow, Menu } from 'electron'
import { join } from 'path'

// Enable WebGPU and Vulkan support
app.commandLine.appendSwitch('enable-features', 'Vulkan')
app.commandLine.appendSwitch('enable-unsafe-webgpu')
app.commandLine.appendSwitch('use-vulkan')
app.commandLine.appendSwitch('enable-gpu-rasterization')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Enable WebGPU support
      enableBlinkFeatures: 'WebGPU',
      // Enable GPU acceleration
      backgroundThrottling: false
    }
  })

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Create menu
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Clear Canvas',
          click: () => {
            mainWindow.webContents.send('clear-canvas')
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' }
      ]
    },
    {
      label: 'Renderer',
      submenu: [
        {
          label: 'WebGPU Info',
          click: async () => {
            const result = await mainWindow.webContents.executeJavaScript(`
              (async () => {
                if (!navigator.gpu) return 'WebGPU not available';
                try {
                  const adapter = await navigator.gpu.requestAdapter();
                  if (!adapter) return 'No adapter found';
                  const info = await adapter.requestAdapterInfo?.() || {};
                  return \`GPU: \${info.device || 'Unknown'}\\nVendor: \${info.vendor || 'Unknown'}\\nArchitecture: \${info.architecture || 'Unknown'}\`;
                } catch (e) {
                  return 'Error: ' + e.message;
                }
              })()
            `)
            console.log('WebGPU Info:', result)
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            console.log('Electron Handwrite Demo v2.0.0 - Native GPU Rendering')
          }
        }
      ]
    }
  ])
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
