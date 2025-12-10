const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  listConnections: () => ipcRenderer.invoke('connections:list'),
  saveConnection: (conn) => ipcRenderer.invoke('connections:save', conn),
  deleteConnection: (id) => ipcRenderer.invoke('connections:delete', id),
  listObjects: (params) => ipcRenderer.invoke('s3:listObjects', params),
  uploadFile: (params) => ipcRenderer.invoke('s3:uploadFile', params),
  uploadBuffer: (params) => ipcRenderer.invoke('s3:uploadBuffer', params),
  createFolder: (params) => ipcRenderer.invoke('s3:createFolder', params),
  deleteObject: (params) => ipcRenderer.invoke('s3:deleteObject', params),
  deleteFolder: (params) => ipcRenderer.invoke('s3:deleteFolder', params),
  downloadFile: (params) => ipcRenderer.invoke('s3:downloadFile', params),
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  getFilesInDirectory: (dirPath) => ipcRenderer.invoke('fs:getFilesInDirectory', dirPath),
  onUploadProgress: (callback) => {
    ipcRenderer.on('upload:progress', (_event, data) => callback(data))
  },
  removeUploadProgressListener: () => {
    ipcRenderer.removeAllListeners('upload:progress')
  }
})
