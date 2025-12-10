const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const {
  getConnections,
  saveConnection,
  deleteConnection
} = require('./connectionStore')
const { listObjects, uploadFile, uploadBuffer, deleteObject, deleteFolder, downloadFile, createFolder } = require('./s3Client')

let mainWindow

// 递归获取文件夹中的所有文件
function getAllFilesInDirectory(dirPath, baseDir = dirPath) {
  const files = []
  const items = fs.readdirSync(dirPath, { withFileTypes: true })
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item.name)
    
    if (item.isDirectory()) {
      // 递归遍历子文件夹
      files.push(...getAllFilesInDirectory(fullPath, baseDir))
    } else if (item.isFile()) {
      // 计算相对路径
      const relativePath = path.relative(baseDir, fullPath)
      files.push({
        fullPath,
        relativePath: relativePath.replace(/\\/g, '/')  // 统一使用 / 作为分隔符
      })
    }
  }
  
  return files
}

function createWindow () {
  // 设置窗口图标
  const iconPath = path.join(__dirname, '../build/icon.png')
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  const isDev = !app.isPackaged
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  ipcMain.handle('connections:list', async () => {
    return getConnections()
  })

  ipcMain.handle('connections:save', async (_event, conn) => {
    return saveConnection(conn)
  })

  ipcMain.handle('connections:delete', async (_event, id) => {
    return deleteConnection(id)
  })

  ipcMain.handle('s3:listObjects', async (_event, payload) => {
    const { connectionId, prefix } = payload
    return listObjects(connectionId, prefix || '')
  })

  ipcMain.handle('s3:uploadFile', async (_event, payload) => {
    const { connectionId, prefix, filePath, customFileName } = payload
    return uploadFile(connectionId, prefix, filePath, (uploaded, total) => {
      mainWindow.webContents.send('upload:progress', { filePath, uploaded, total })
    }, customFileName)
  })

  ipcMain.handle('s3:uploadBuffer', async (_event, payload) => {
    const { connectionId, prefix, fileName, buffer } = payload
    
    // 直接从 Buffer 上传，不需要创建临时文件
    return uploadBuffer(connectionId, prefix, fileName, buffer, (uploaded, total) => {
      mainWindow.webContents.send('upload:progress', { filePath: fileName, uploaded, total })
    })
  })

  ipcMain.handle('s3:createFolder', async (_event, payload) => {
    const { connectionId, folderKey } = payload
    return createFolder(connectionId, folderKey)
  })

  ipcMain.handle('s3:deleteObject', async (_event, payload) => {
    const { connectionId, key } = payload
    return deleteObject(connectionId, key)
  })

  ipcMain.handle('s3:deleteFolder', async (_event, payload) => {
    const { connectionId, prefix } = payload
    return deleteFolder(connectionId, prefix)
  })

  ipcMain.handle('s3:downloadFile', async (_event, payload) => {
    const { connectionId, key, defaultName } = payload
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName || path.basename(key),
      title: '选择保存位置'
    })
    
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    
    return downloadFile(connectionId, key, result.filePath)
  })

  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'openDirectory', 'multiSelections'],
      title: '选择要上传的文件或文件夹'
    })
    
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true }
    }
    
    return { filePaths: result.filePaths }
  })

  // 获取文件夹中的所有文件（保留目录结构）
  ipcMain.handle('fs:getFilesInDirectory', async (_event, dirPath) => {
    try {
      const stats = fs.statSync(dirPath)
      
      if (stats.isFile()) {
        // 如果是文件，直接返回
        return [{
          fullPath: dirPath,
          relativePath: path.basename(dirPath)
        }]
      } else if (stats.isDirectory()) {
        // 如果是文件夹，递归获取所有文件
        const folderName = path.basename(dirPath)
        const files = getAllFilesInDirectory(dirPath)
        
        // 在每个文件的相对路径前加上文件夹名
        return files.map(file => ({
          fullPath: file.fullPath,
          relativePath: `${folderName}/${file.relativePath}`
        }))
      }
      
      return []
    } catch (err) {
      throw new Error(`获取文件失败: ${err.message}`)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
