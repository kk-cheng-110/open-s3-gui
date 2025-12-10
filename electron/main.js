const {app, BrowserWindow, ipcMain, dialog, shell} = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const {
    getConnections,
    saveConnection,
    deleteConnection
} = require('./connectionStore')
const {
    listObjects,
    uploadFile,
    uploadBuffer,
    deleteObject,
    deleteFolder,
    downloadFile,
    createFolder
} = require('./s3Client')

let mainWindow

// GitHub Release 配置
const GITHUB_REPO = 'kk-cheng-110/open-s3-gui'
const CURRENT_VERSION = app.getVersion()

// 检查更新
function checkForUpdates() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_REPO}/releases/latest`,
            method: 'GET',
            headers: {
                'User-Agent': 'Open-S3-Client'
            }
        }

        https.get(options, (res) => {
            let data = ''

            res.on('data', (chunk) => {
                data += chunk
            })

            res.on('end', () => {
                try {
                    const release = JSON.parse(data)
                    const latestVersion = release.tag_name.replace(/^v/, '')

                    // 获取当前平台对应的下载链接
                    const platform = process.platform
                    const assets = release.assets || []
                    let downloadAsset = null

                    // 根据平台匹配安装包
                    if (platform === 'darwin') {
                        // macOS: 优先 dmg
                        downloadAsset = assets.find(a => a.name.endsWith('.dmg')) ||
                            assets.find(a => a.name.endsWith('-mac.zip'))
                    } else if (platform === 'win32') {
                        // Windows: 优先 exe
                        downloadAsset = assets.find(a => a.name.endsWith('.exe'))
                    } else if (platform === 'linux') {
                        // Linux: 优先 AppImage
                        downloadAsset = assets.find(a => a.name.endsWith('.AppImage')) ||
                            assets.find(a => a.name.endsWith('.deb'))
                    }

                    resolve({
                        hasUpdate: compareVersions(latestVersion, CURRENT_VERSION) > 0,
                        currentVersion: CURRENT_VERSION,
                        latestVersion: latestVersion,
                        releaseUrl: release.html_url,
                        downloadUrl: downloadAsset ? downloadAsset.browser_download_url : release.html_url,
                        downloadName: downloadAsset ? downloadAsset.name : '',
                        releaseNotes: release.body || '暂无更新说明'
                    })
                } catch (err) {
                    reject(err)
                }
            })
        }).on('error', (err) => {
            reject(err)
        })
    })
}

// 版本比较（简单实现）
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number)
    const parts2 = v2.split('.').map(Number)

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0
        const p2 = parts2[i] || 0
        if (p1 > p2) return 1
        if (p1 < p2) return -1
    }
    return 0
}

// 递归获取文件夹中的所有文件
function getAllFilesInDirectory(dirPath, baseDir = dirPath) {
    const files = []
    const items = fs.readdirSync(dirPath, {withFileTypes: true})

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

function createWindow() {
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
        // 开发模式下可通过快捷键打开 DevTools (Cmd/Ctrl + Shift + I)
        // mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }
}

app.whenReady().then(() => {
    createWindow()

    // 启动时检查更新
    setTimeout(() => {
        checkForUpdates()
            .then(updateInfo => {
                if (updateInfo.hasUpdate) {
                    mainWindow.webContents.send('update:available', updateInfo)
                }
            })
            .catch(err => {
                console.error('检查更新失败:', err)
            })
    }, 3000) // 延迟3秒，避免启动时阻塞

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
        const {connectionId, prefix} = payload
        return listObjects(connectionId, prefix || '')
    })

    ipcMain.handle('s3:uploadFile', async (_event, payload) => {
        const {connectionId, prefix, filePath, customFileName} = payload
        return uploadFile(connectionId, prefix, filePath, (uploaded, total) => {
            mainWindow.webContents.send('upload:progress', {filePath, uploaded, total})
        }, customFileName)
    })

    ipcMain.handle('s3:uploadBuffer', async (_event, payload) => {
        const {connectionId, prefix, fileName, buffer} = payload

        // 直接从 Buffer 上传，不需要创建临时文件
        return uploadBuffer(connectionId, prefix, fileName, buffer, (uploaded, total) => {
            mainWindow.webContents.send('upload:progress', {filePath: fileName, uploaded, total})
        })
    })

    ipcMain.handle('s3:createFolder', async (_event, payload) => {
        const {connectionId, folderKey} = payload
        return createFolder(connectionId, folderKey)
    })

    ipcMain.handle('s3:deleteObject', async (_event, payload) => {
        const {connectionId, key} = payload
        return deleteObject(connectionId, key)
    })

    ipcMain.handle('s3:deleteFolder', async (_event, payload) => {
        const {connectionId, prefix} = payload
        return deleteFolder(connectionId, prefix)
    })

    ipcMain.handle('s3:downloadFile', async (_event, payload) => {
        const {connectionId, key, defaultName} = payload
        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: defaultName || path.basename(key),
            title: '选择保存位置'
        })

        if (result.canceled || !result.filePath) {
            return {canceled: true}
        }

        return downloadFile(connectionId, key, result.filePath)
    })

    ipcMain.handle('dialog:openFile', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile', 'openDirectory', 'multiSelections'],
            title: '选择要上传的文件或文件夹'
        })

        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
            return {canceled: true}
        }

        return {filePaths: result.filePaths}
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

    // 检查更新
    ipcMain.handle('update:check', async () => {
        try {
            return await checkForUpdates()
        } catch (err) {
            throw new Error(`检查更新失败: ${err.message}`)
        }
    })

    // 下载并安装更新
    ipcMain.handle('update:download', async (_event, url, fileName) => {
        try {
            const result = await dialog.showSaveDialog(mainWindow, {
                defaultPath: fileName,
                title: '选择保存位置'
            })

            if (result.canceled || !result.filePath) {
                return {canceled: true}
            }

            // 下载文件
            return new Promise((resolve, reject) => {
                const file = fs.createWriteStream(result.filePath)

                https.get(url, (response) => {
                    // 处理重定向
                    if (response.statusCode === 302 || response.statusCode === 301) {
                        https.get(response.headers.location, (redirectResponse) => {
                            const totalSize = parseInt(redirectResponse.headers['content-length'], 10)
                            let downloadedSize = 0

                            redirectResponse.on('data', (chunk) => {
                                downloadedSize += chunk.length
                                const progress = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0
                                mainWindow.webContents.send('update:progress', {
                                    downloaded: downloadedSize,
                                    total: totalSize,
                                    progress: progress
                                })
                            })

                            redirectResponse.pipe(file)

                            file.on('finish', () => {
                                file.close()
                                resolve({success: true, filePath: result.filePath})
                            })
                        }).on('error', (err) => {
                            fs.unlink(result.filePath, () => {
                            })
                            reject(err)
                        })
                    } else {
                        const totalSize = parseInt(response.headers['content-length'], 10)
                        let downloadedSize = 0

                        response.on('data', (chunk) => {
                            downloadedSize += chunk.length
                            const progress = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0
                            mainWindow.webContents.send('update:progress', {
                                downloaded: downloadedSize,
                                total: totalSize,
                                progress: progress
                            })
                        })

                        response.pipe(file)

                        file.on('finish', () => {
                            file.close()
                            resolve({success: true, filePath: result.filePath})
                        })
                    }
                }).on('error', (err) => {
                    fs.unlink(result.filePath, () => {
                    })
                    reject(err)
                })
            })
        } catch (err) {
            throw new Error(`下载失败: ${err.message}`)
        }
    })

    // 打开下载页面
    ipcMain.handle('update:openDownload', async (_event, url) => {
        shell.openExternal(url)
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
