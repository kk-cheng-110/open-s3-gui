const fs = require('fs')
const path = require('path')
const {app} = require('electron')
const {randomUUID} = require('crypto')

const fileName = 'connections.json'

function getStorePath() {
    const userData = app.getPath('userData')
    return path.join(userData, fileName)
}

function readAll() {
    const filePath = getStorePath()
    if (!fs.existsSync(filePath)) {
        return []
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(raw)
    } catch (e) {
        console.error('read connections error', e)
        return []
    }
}

function writeAll(list) {
    const filePath = getStorePath()
    try {
        fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8')
    } catch (e) {
        console.error('write connections error', e)
    }
}

function getConnections() {
    return readAll()
}

function saveConnection(conn) {
    const list = readAll()
    if (conn.id) {
        const idx = list.findIndex(item => item.id === conn.id)
        if (idx !== -1) {
            list[idx] = {...list[idx], ...conn}
        } else {
            list.push({...conn, id: conn.id})
        }
    } else {
        list.push({
            id: randomUUID(),
            name: conn.name || '未命名连接',
            host: conn.host || '',
            accessKeyId: conn.accessKeyId || '',
            accessKeySecret: conn.accessKeySecret || '',
            bucket: conn.bucket || '',
            region: conn.region || '',
            ssl: !!conn.ssl,
            forcePathStyle: conn.forcePathStyle !== undefined ? conn.forcePathStyle : false
        })
    }
    writeAll(list)
    return list
}

function deleteConnection(id) {
    const list = readAll()
    const next = list.filter(item => item.id !== id)
    writeAll(next)
    return next
}

function getConnectionById(id) {
    const list = readAll()
    return list.find(item => item.id === id) || null
}

module.exports = {
    getConnections,
    saveConnection,
    deleteConnection,
    getConnectionById
}
