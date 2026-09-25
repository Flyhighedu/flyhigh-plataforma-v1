const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('review', {
  request: (command, payload) => ipcRenderer.invoke('review:request', command, payload),
  bounds: bounds => ipcRenderer.send('review:bounds', bounds),
  onState: callback => ipcRenderer.on('review:state', (_event, state) => callback(state)),
  onResize: callback => ipcRenderer.on('review:resize', () => callback()),
  onProgress: callback => ipcRenderer.on('review:progress', (_event, message) => callback(message)),
});
