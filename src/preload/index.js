import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onClearCanvas: (callback) => {
    ipcRenderer.on('clear-canvas', callback)
  }
})
