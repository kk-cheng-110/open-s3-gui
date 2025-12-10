const {
    S3Client,
    ListObjectsV2Command,
    PutObjectCommand,
    DeleteObjectCommand,
    DeleteObjectsCommand,
    GetObjectCommand,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand
} = require('@aws-sdk/client-s3')
const {getConnectionById} = require('./connectionStore')
const fs = require('fs')
const path = require('path')

// 分片大小：10MB
const CHUNK_SIZE = 10 * 1024 * 1024
// 大文件阈值：100MB，超过此大小的文件使用分片上传
const MULTIPART_THRESHOLD = 15 * 1024 * 1024

function createS3Client(conn) {
    return new S3Client({
        endpoint: conn.host,
        region: conn.region || 'us-east-1',
        credentials: {
            accessKeyId: conn.accessKeyId,
            secretAccessKey: conn.accessKeySecret
        },
        forcePathStyle: conn.forcePathStyle !== undefined ? conn.forcePathStyle : false
    })
}

async function listObjects(connectionId, prefix = '') {
    const conn = getConnectionById(connectionId)
    if (!conn || !conn.bucket) {
        throw new Error('连接或 bucket 未配置完整')
    }

    const client = createS3Client(conn)
    const command = new ListObjectsV2Command({
        Bucket: conn.bucket,
        Prefix: prefix,
        Delimiter: '/'
    })

    const res = await client.send(command)

    // 过滤文件：排除以 / 结尾的空对象（文件夹占位符）
    const files = (res.Contents || [])
        .filter(o => {
            // 排除以 / 结尾的对象
            if (o.Key.endsWith('/')) {
                return false
            }
            // 排除当前前缀本身（如果存在）
            if (o.Key === prefix) {
                return false
            }
            return true
        })
        .map(o => ({
            key: o.Key,
            size: o.Size,
            lastModified: o.LastModified
        }))

    return {
        prefix,
        folders: (res.CommonPrefixes || []).map(p => p.Prefix),
        files
    }
}

async function uploadFile(connectionId, prefix, filePath, onProgress, customFileName = null) {
    const conn = getConnectionById(connectionId)
    if (!conn || !conn.bucket) {
        throw new Error('连接或 bucket 未配置完整')
    }

    if (!filePath || typeof filePath !== 'string') {
        throw new Error('无效的文件路径')
    }

    const fileName = customFileName || path.basename(filePath)
    const key = prefix ? `${prefix}${fileName}` : fileName
    const stats = fs.statSync(filePath)
    const fileSize = stats.size

    // 如果文件大于阈值，使用分片上传
    if (fileSize > MULTIPART_THRESHOLD) {
        return uploadFileMultipart(conn, key, filePath, fileSize, onProgress)
    }

    // 小文件使用普通上传
    const fileStream = fs.createReadStream(filePath)
    const client = createS3Client(conn)
    const command = new PutObjectCommand({
        Bucket: conn.bucket,
        Key: key,
        Body: fileStream,
        ContentLength: fileSize
    })

    // 简单的进度模拟（真实进度需要通过 stream 事件监听）
    let uploaded = 0
    if (onProgress) {
        const interval = setInterval(() => {
            uploaded = Math.min(uploaded + fileSize / 20, fileSize)
            onProgress(uploaded, fileSize)
            if (uploaded >= fileSize) {
                clearInterval(interval)
            }
        }, 100)
    }

    await client.send(command)
    return {key, size: fileSize}
}

// 分片上传函数
async function uploadFileMultipart(conn, key, filePath, fileSize, onProgress) {
    const client = createS3Client(conn)
    let uploadId = null

    try {
        // 1. 初始化分片上传
        const createCommand = new CreateMultipartUploadCommand({
            Bucket: conn.bucket,
            Key: key
        })
        const createResponse = await client.send(createCommand)
        uploadId = createResponse.UploadId

        // 2. 计算分片数量
        const numParts = Math.ceil(fileSize / CHUNK_SIZE)
        const uploadedParts = []
        let uploadedBytes = 0

        // 3. 上传每个分片
        for (let partNumber = 1; partNumber <= numParts; partNumber++) {
            const start = (partNumber - 1) * CHUNK_SIZE
            const end = Math.min(start + CHUNK_SIZE, fileSize)
            const partSize = end - start

            // 读取分片数据
            const buffer = Buffer.alloc(partSize)
            const fd = fs.openSync(filePath, 'r')
            fs.readSync(fd, buffer, 0, partSize, start)
            fs.closeSync(fd)

            // 上传分片
            const uploadPartCommand = new UploadPartCommand({
                Bucket: conn.bucket,
                Key: key,
                UploadId: uploadId,
                PartNumber: partNumber,
                Body: buffer,
                ContentLength: partSize
            })

            const uploadPartResponse = await client.send(uploadPartCommand)

            uploadedParts.push({
                PartNumber: partNumber,
                ETag: uploadPartResponse.ETag
            })

            // 更新进度
            uploadedBytes += partSize
            if (onProgress) {
                onProgress(uploadedBytes, fileSize)
            }
        }

        // 4. 完成分片上传
        const completeCommand = new CompleteMultipartUploadCommand({
            Bucket: conn.bucket,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: uploadedParts
            }
        })

        await client.send(completeCommand)

        return {key, size: fileSize}
    } catch (error) {
        // 如果上传失败，取消分片上传
        if (uploadId) {
            try {
                const abortCommand = new AbortMultipartUploadCommand({
                    Bucket: conn.bucket,
                    Key: key,
                    UploadId: uploadId
                })
                await client.send(abortCommand)
            } catch (abortError) {
                console.error('取消分片上传失败:', abortError)
            }
        }
        throw error
    }
}

// 直接从 Buffer 上传，适用于拖拽上传等场景
async function uploadBuffer(connectionId, prefix, fileName, buffer, onProgress) {
    const conn = getConnectionById(connectionId)
    if (!conn || !conn.bucket) {
        throw new Error('连接或 bucket 未配置完整')
    }

    if (!fileName || !buffer) {
        throw new Error('文件名和数据不能为空')
    }

    const key = prefix ? `${prefix}${fileName}` : fileName
    const bufferData = Buffer.from(buffer)
    const fileSize = bufferData.length

    // 如果文件大于阈值，使用分片上传
    if (fileSize > MULTIPART_THRESHOLD) {
        return uploadBufferMultipart(conn, key, bufferData, fileSize, onProgress)
    }

    // 小文件使用普通上传
    const client = createS3Client(conn)
    const command = new PutObjectCommand({
        Bucket: conn.bucket,
        Key: key,
        Body: bufferData,
        ContentLength: fileSize
    })

    // 简单的进度模拟
    let uploaded = 0
    if (onProgress) {
        const interval = setInterval(() => {
            uploaded = Math.min(uploaded + fileSize / 20, fileSize)
            onProgress(uploaded, fileSize)
            if (uploaded >= fileSize) {
                clearInterval(interval)
            }
        }, 100)
    }

    await client.send(command)
    return {key, size: fileSize}
}

// Buffer 分片上传函数
async function uploadBufferMultipart(conn, key, bufferData, fileSize, onProgress) {
    const client = createS3Client(conn)
    let uploadId = null

    try {
        // 1. 初始化分片上传
        const createCommand = new CreateMultipartUploadCommand({
            Bucket: conn.bucket,
            Key: key
        })
        const createResponse = await client.send(createCommand)
        uploadId = createResponse.UploadId

        // 2. 计算分片数量
        const numParts = Math.ceil(fileSize / CHUNK_SIZE)
        const uploadedParts = []
        let uploadedBytes = 0

        // 3. 上传每个分片
        for (let partNumber = 1; partNumber <= numParts; partNumber++) {
            const start = (partNumber - 1) * CHUNK_SIZE
            const end = Math.min(start + CHUNK_SIZE, fileSize)
            const partBuffer = bufferData.slice(start, end)

            // 上传分片
            const uploadPartCommand = new UploadPartCommand({
                Bucket: conn.bucket,
                Key: key,
                UploadId: uploadId,
                PartNumber: partNumber,
                Body: partBuffer,
                ContentLength: partBuffer.length
            })

            const uploadPartResponse = await client.send(uploadPartCommand)

            uploadedParts.push({
                PartNumber: partNumber,
                ETag: uploadPartResponse.ETag
            })

            // 更新进度
            uploadedBytes += partBuffer.length
            if (onProgress) {
                onProgress(uploadedBytes, fileSize)
            }
        }

        // 4. 完成分片上传
        const completeCommand = new CompleteMultipartUploadCommand({
            Bucket: conn.bucket,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: uploadedParts
            }
        })

        await client.send(completeCommand)

        return {key, size: fileSize}
    } catch (error) {
        // 如果上传失败，取消分片上传
        if (uploadId) {
            try {
                const abortCommand = new AbortMultipartUploadCommand({
                    Bucket: conn.bucket,
                    Key: key,
                    UploadId: uploadId
                })
                await client.send(abortCommand)
            } catch (abortError) {
                console.error('取消分片上传失败:', abortError)
            }
        }
        throw error
    }
}

async function deleteObject(connectionId, key) {
    const conn = getConnectionById(connectionId)
    if (!conn || !conn.bucket) {
        throw new Error('连接或 bucket 未配置完整')
    }

    const client = createS3Client(conn)
    const command = new DeleteObjectCommand({
        Bucket: conn.bucket,
        Key: key
    })

    await client.send(command)
    return {key}
}

async function deleteFolder(connectionId, prefix) {
    const conn = getConnectionById(connectionId)
    if (!conn || !conn.bucket) {
        throw new Error('连接或 bucket 未配置完整')
    }

    const client = createS3Client(conn)

    // 先列出所有对象
    const listCommand = new ListObjectsV2Command({
        Bucket: conn.bucket,
        Prefix: prefix
    })
    const listRes = await client.send(listCommand)

    if (!listRes.Contents || listRes.Contents.length === 0) {
        return {deleted: 0}
    }

    // 批量删除
    const objects = listRes.Contents.map(item => ({Key: item.Key}))
    const deleteCommand = new DeleteObjectsCommand({
        Bucket: conn.bucket,
        Delete: {
            Objects: objects
        }
    })

    const deleteRes = await client.send(deleteCommand)
    return {deleted: deleteRes.Deleted?.length || 0}
}

async function downloadFile(connectionId, key, savePath) {
    const conn = getConnectionById(connectionId)
    if (!conn || !conn.bucket) {
        throw new Error('连接或 bucket 未配置完整')
    }

    const client = createS3Client(conn)
    const command = new GetObjectCommand({
        Bucket: conn.bucket,
        Key: key
    })

    const res = await client.send(command)
    const writeStream = fs.createWriteStream(savePath)

    return new Promise((resolve, reject) => {
        res.Body.pipe(writeStream)
        writeStream.on('finish', () => resolve({key, savePath}))
        writeStream.on('error', reject)
    })
}

async function createFolder(connectionId, folderKey) {
    const conn = getConnectionById(connectionId)
    if (!conn || !conn.bucket) {
        throw new Error('连接或 bucket 未配置完整')
    }

    const client = createS3Client(conn)
    // S3 中文件夹通过上传一个空对象实现，键名以 / 结尾
    const command = new PutObjectCommand({
        Bucket: conn.bucket,
        Key: folderKey,
        Body: Buffer.from(''),
        ContentLength: 0
    })

    await client.send(command)
    return {folderKey}
}

module.exports = {
    listObjects,
    uploadFile,
    uploadBuffer,
    createFolder,
    deleteObject,
    deleteFolder,
    downloadFile
}
