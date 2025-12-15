<template>
  <div class="browser">
    <div v-if="!currentConnectionId" class="empty-state">
      <div class="empty-icon">📁</div>
      <div class="empty-text">请在左侧选择一个连接</div>
      <button class="primary" @click="$emit('openConnectionForm')">或者新增连接</button>
    </div>

    <div v-else class="browser-content">
      <!-- 文件列表区域（支持拖拽） -->
      <div
          class="file-area"
          @drop="onDrop"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @contextmenu="onAreaContextMenu"
          :class="{ 'drag-over': isDragOver }"
      >
        <!-- 顶部工具栏 -->
        <div class="toolbar">
          <div class="path-bar">
            <button class="path-btn home-btn" @click="goToRoot" title="返回根目录">
              <n-icon><home-outline /></n-icon>
            </button>
            <span class="path-separator">/</span>
            
            <!-- 路径编辑模式 -->
            <div v-if="pathEditMode" class="path-input-wrapper">
              <input 
                ref="pathInput"
                v-model="pathInputValue" 
                class="path-input"
                placeholder="输入路径，回车跳转"
                @keyup.enter="navigateToPath"
                @keyup.esc="exitPathEditMode"
                @keydown="handlePathInputKeydown"
                @blur="exitPathEditMode"
              />
            </div>
            
            <!-- 路径面包屑模式 -->
            <div v-else class="path-breadcrumb" @click="enterPathEditMode">
              <template v-if="pathParts.length === 0">
                <span class="path-text">根目录</span>
              </template>
              <template v-else>
                <template v-for="(part, idx) in pathParts" :key="idx">
                  <button class="path-btn" @click.stop="goToPath(idx)">
                    {{ part }}
                  </button>
                  <span v-if="idx < pathParts.length - 1" class="path-separator">/</span>
                </template>
              </template>
            </div>
          </div>
          <div class="toolbar-actions">
            <n-button text @click="toggleViewMode" :title="viewMode === 'grid' ? '列表模式' : '卡片模式'">
              <template #icon>
                <n-icon>
                  <grid-outline v-if="viewMode === 'grid'"/>
                  <list-outline v-else/>
                </n-icon>
              </template>
            </n-button>
            <n-dropdown :options="uploadOptions" @select="handleUploadSelect">
              <n-button text title="上传">
                <template #icon>
                  <n-icon>
                    <cloud-upload-outline/>
                  </n-icon>
                </template>
              </n-button>
            </n-dropdown>
            <n-button text @click="reload" title="刷新">
              <template #icon>
                <n-icon>
                  <refresh-outline/>
                </n-icon>
              </template>
            </n-button>
          </div>
        </div>

        <!-- 文件网格 -->
        <div class="file-content" @click="onContentClick">
          <div v-if="loading" class="loading">加载中...</div>
          <div v-else-if="folders.length === 0 && files.length === 0" class="empty-folder">
            <div class="empty-icon">📂</div>
            <div class="empty-text">当前文件夹为空</div>
            <div class="empty-hint">请使用工具栏的“上传”按钮，或右键选择操作</div>
          </div>
          <div v-else>
            <!-- 列表模式：表格布局 -->
            <div v-if="viewMode === 'list'" class="file-list">
              <!-- 表头 -->
              <div class="list-header">
                <div class="header-name">名称</div>
                <div class="header-kind">类型</div>
                <div class="header-size">大小</div>
                <div class="header-date">修改时间</div>
              </div>

              <!-- 文件夹 -->
              <div
                  v-for="(folder, idx) in folders"
                  :key="folder"
                  :class="['file-item', 'folder', { selected: isSelected(folder) }]"
                  @click="toggleSelect(folder, idx, $event)"
                  @dblclick="enterFolder(folder)"
                  @contextmenu="onContextMenu($event, folder, 'folder')"
                  draggable="false"
              >
                <div class="item-name">
                  <div class="file-icon">📁</div>
                  <div class="file-name" :title="lastPart(folder)">{{ lastPart(folder) }}</div>
                </div>
                <div class="item-kind">文件夹</div>
                <div class="item-size">--</div>
                <div class="item-date">--</div>
              </div>

              <!-- 文件 -->
              <div
                  v-for="(file, idx) in files"
                  :key="file.key"
                  :class="['file-item', { selected: isSelected(file.key) }]"
                  @click="toggleSelect(file.key, folders.length + idx, $event)"
                  @contextmenu="onContextMenu($event, file.key, 'file')"
                  draggable="true"
                  @dragstart="onFileDragStart($event, file.key)"
              >
                <div class="item-name">
                  <div class="file-icon">📄</div>
                  <div class="file-name" :title="file.key">{{ fileName(file.key) }}</div>
                </div>
                <div class="item-kind">{{ getFileKind(file.key) }}</div>
                <div class="item-size">{{ formatSize(file.size) }}</div>
                <div class="item-date">{{ formatDate(file.lastModified) }}</div>
              </div>
            </div>

            <!-- 网格模式：卡片布局 -->
            <div v-else class="file-grid">
              <!-- 文件夹 -->
              <div
                  v-for="(folder, idx) in folders"
                  :key="folder"
                  :class="['file-item', 'folder', { selected: isSelected(folder) }]"
                  @click="toggleSelect(folder, idx, $event)"
                  @dblclick="enterFolder(folder)"
                  @contextmenu="onContextMenu($event, folder, 'folder')"
                  draggable="false"
              >
                <div class="file-icon">📁</div>
                <div class="file-info">
                  <div class="file-name" :title="lastPart(folder)">{{ lastPart(folder) }}</div>
                </div>
              </div>

              <!-- 文件 -->
              <div
                  v-for="(file, idx) in files"
                  :key="file.key"
                  :class="['file-item', { selected: isSelected(file.key) }]"
                  @click="toggleSelect(file.key, folders.length + idx, $event)"
                  @contextmenu="onContextMenu($event, file.key, 'file')"
                  draggable="true"
                  @dragstart="onFileDragStart($event, file.key)"
              >
                <div class="file-icon">📄</div>
                <div class="file-info">
                  <div class="file-name" :title="file.key">{{ fileName(file.key) }}</div>
                  <div class="file-size">{{ formatSize(file.size) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 状态栏（右下角） -->
        <div class="status-bar">
          <span v-if="selectedCount > 0" class="status-selected">
            已选中 {{ selectedCount }} 项
          </span>
          <span v-else class="status-total">
            共 {{ totalCount }} 项
          </span>
        </div>
      </div>
    </div>

    <!-- 右下角上传列表面板 -->
    <div v-if="uploadList.length > 0" class="upload-panel">
      <div class="upload-header">
        <span>上传列表 ({{ uploadList.length }})</span>
        <button class="close-btn" @click="clearCompleted">清空已完成</button>
      </div>
      <div class="upload-list">
        <div v-for="item in uploadList" :key="item.id" class="upload-item">
          <div class="upload-info">
            <div class="upload-name" :title="item.name">{{ item.name }}</div>
            <div class="upload-status">
              <span v-if="item.status === 'uploading'">
                {{ formatSize(item.uploaded) }} / {{ formatSize(item.total) }}
              </span>
              <span v-else-if="item.status === 'success'" class="success">✓ 完成</span>
              <span v-else-if="item.status === 'error'" class="error">✕ 失败</span>
            </div>
          </div>
          <div class="upload-progress">
            <div
                class="upload-progress-bar"
                :style="{ width: item.progress + '%' }"
                :class="{ error: item.status === 'error', success: item.status === 'success' }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右键菜单 -->
    <div v-if="contextMenu.show" class="context-menu"
         :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }">
      <template v-if="contextMenu.type === 'area'">
        <div class="context-menu-item" @click="openCreateFolderDialog">
          <span>📁</span> 新建文件夹
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" @click="openFileUploadDialog">
          <span>📄</span> 上传文件
        </div>
        <div class="context-menu-item" @click="openFolderUploadDialog">
          <span>📁</span> 上传文件夹
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" @click="refreshFromMenu">
          <span>🔄</span> 刷新
        </div>
      </template>
      <template v-else>
        <div class="context-menu-item" @click="downloadItem">
          <span>📄</span> 下载
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" @click="deleteItem">
          <span>🗑️</span> 删除
        </div>
      </template>
    </div>

    <!-- 全局点击关闭菜单 -->
    <div v-if="contextMenu.show" class="context-overlay" @click="closeContextMenu"></div>

    <!-- 删除确认对话框 -->
    <div v-if="deleteConfirm.show" class="dialog-mask" @click.self="closeDeleteConfirm">
      <div class="dialog confirm-dialog">
        <div class="dialog-icon">
          <span class="icon-warning">⚠️</span>
        </div>
        <h3>确认删除</h3>
        <p v-if="deleteConfirm.type === 'multiple'" class="confirm-message">
          {{ deleteConfirm.name }}
        </p>
        <p v-else class="confirm-message">
          确定要删除{{ deleteConfirm.type === 'folder' ? '文件夹' : '文件' }}
          <strong>{{ deleteConfirm.name }}</strong> 吗？
        </p>
        <p v-if="deleteConfirm.type === 'folder' || deleteConfirm.type === 'multiple'" class="confirm-warning">
          此操作不可恢复！
        </p>
        <div class="dialog-actions">
          <n-button @click="closeDeleteConfirm">取消</n-button>
          <n-button type="error" @click="confirmDelete">确认删除</n-button>
        </div>
      </div>
    </div>

    <!-- 新建文件夹对话框 -->
    <div v-if="createFolderDialog.show" class="dialog-mask" @click.self="closeCreateFolderDialog">
      <div class="dialog input-dialog">
        <div class="dialog-icon">
          <span class="icon-folder">📁</span>
        </div>
        <h3>新建文件夹</h3>
        <input
            ref="folderNameInput"
            v-model="createFolderDialog.name"
            type="text"
            class="folder-input"
            placeholder="请输入文件夹名称"
            @keyup.enter="confirmCreateFolder"
            @keyup.esc="closeCreateFolderDialog"
        />
        <div class="dialog-actions">
          <n-button @click="closeCreateFolderDialog">取消</n-button>
          <n-button type="primary" @click="confirmCreateFolder" :disabled="!createFolderDialog.name.trim()">创建
          </n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {watch, ref, computed, onMounted, onBeforeUnmount, nextTick} from 'vue'
import {NButton, NIcon, NDropdown} from 'naive-ui'
import {
  GridOutline,
  ListOutline,
  CloudUploadOutline,
  RefreshOutline,
  HomeOutline
} from '@vicons/ionicons5'

const props = defineProps({
  currentConnectionId: {
    type: String,
    default: ''
  }
})

const prefix = ref('')
const folders = ref([])
const files = ref([])
const loading = ref(false)
const isDragOver = ref(false)
const uploadList = ref([])
let uploadIdCounter = 0

// 路径编辑模式
const pathEditMode = ref(false)
const pathInputValue = ref('')
const pathInput = ref(null)

// 视图模式：grid (卡片) 或 list (列表)
const viewMode = ref('grid')

// 多选相关
const selectedItems = ref(new Set())
const lastClickedIndex = ref(-1)

const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  target: '',
  type: ''
})

const deleteConfirm = ref({
  show: false,
  target: '',
  type: '',
  name: ''
})

const createFolderDialog = ref({
  show: false,
  name: ''
})

const folderNameInput = ref(null)

const pathParts = computed(() => {
  if (!prefix.value) return []
  return prefix.value.split('/').filter(Boolean)
})

const allItems = computed(() => {
  return [
    ...folders.value.map(f => ({key: f, type: 'folder', name: lastPart(f)})),
    ...files.value.map(f => ({key: f.key, type: 'file', name: fileName(f.key), size: f.size}))
  ]
})

const selectedCount = computed(() => selectedItems.value.size)

const totalCount = computed(() => folders.value.length + files.value.length)

// 上传选项
const uploadOptions = [
  {
    label: '上传文件',
    key: 'file'
  },
  {
    label: '上传文件夹',
    key: 'folder'
  }
]

// 处理上传选择
function handleUploadSelect(key) {
  if (key === 'file') {
    openFileUploadDialog()
  } else if (key === 'folder') {
    openFolderUploadDialog()
  }
}

async function reload() {
  if (!window.electron || !props.currentConnectionId) return
  loading.value = true
  try {
    const res = await window.electron.listObjects({
      connectionId: props.currentConnectionId,
      prefix: prefix.value
    })
    folders.value = res.folders || []
    files.value = res.files || []
    selectedItems.value.clear()  // 刷新时清空选中
  } catch (e) {
    alert('加载对象列表失败：' + e.message)
  } finally {
    loading.value = false
  }
}

function enterFolder(folderPrefix) {
  prefix.value = folderPrefix
  reload()
}

function goToRoot() {
  prefix.value = ''
  reload()
}

function goToPath(idx) {
  const parts = pathParts.value.slice(0, idx + 1)
  prefix.value = parts.join('/') + '/'
  reload()
}

// 进入路径编辑模式
async function enterPathEditMode() {
  pathInputValue.value = prefix.value
  pathEditMode.value = true
  await nextTick()
  pathInput.value?.focus()
  pathInput.value?.select()
}

// 退出路径编辑模式
function exitPathEditMode() {
  pathEditMode.value = false
  pathInputValue.value = ''
}

// 导航到输入的路径
function navigateToPath() {
  let targetPath = pathInputValue.value.trim()
  
  // 移除开头和结尾的多余斜杠
  targetPath = targetPath.replace(/^\/+/, '').replace(/\/+$/, '')
  
  // 如果不为空，确保以 / 结尾
  if (targetPath) {
    targetPath = targetPath + '/'
  }
  
  prefix.value = targetPath
  exitPathEditMode()
  reload()
}

// 处理路径输入框的键盘事件
function handlePathInputKeydown(e) {
  // 当输入框激活时，阻止 Ctrl/Cmd + A 的全局事件，让浏览器默认行为生效（选中输入框文本）
  if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
    e.stopPropagation()
  }
}

// 视图模式切换
function toggleViewMode() {
  viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
}

// 多选功能
function isSelected(key) {
  return selectedItems.value.has(key)
}

function toggleSelect(key, index, event) {
  // 阻止双击时的选择逻辑
  if (event.detail === 2) {
    return
  }

  if (event.metaKey || event.ctrlKey) {
    // Cmd/Ctrl + 单击：切换单个选中
    if (selectedItems.value.has(key)) {
      selectedItems.value.delete(key)
    } else {
      selectedItems.value.add(key)
    }
    lastClickedIndex.value = index
  } else if (event.shiftKey && lastClickedIndex.value !== -1) {
    // Shift + 单击：范围选择
    const start = Math.min(lastClickedIndex.value, index)
    const end = Math.max(lastClickedIndex.value, index)
    selectedItems.value.clear()
    for (let i = start; i <= end; i++) {
      if (allItems.value[i]) {
        selectedItems.value.add(allItems.value[i].key)
      }
    }
    lastClickedIndex.value = index
  } else {
    // 普通单击：单选
    selectedItems.value.clear()
    selectedItems.value.add(key)
    lastClickedIndex.value = index
  }
}

function selectAll() {
  selectedItems.value.clear()
  allItems.value.forEach(item => {
    selectedItems.value.add(item.key)
  })
}

function clearSelection() {
  selectedItems.value.clear()
}

function onContentClick(e) {
  // 点击的是 .file-content 或 .file-grid/.file-list 的空白区域时取消选择
  if (e.target.classList.contains('file-content') ||
      e.target.classList.contains('file-grid') ||
      e.target.classList.contains('file-list')) {
    clearSelection()
  }
}

function handleKeyDown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
    e.preventDefault()
    selectAll()
  } else if (e.key === 'Escape') {
    clearSelection()
  }
}

function lastPart(p) {
  const parts = p.split('/').filter(Boolean)
  return parts[parts.length - 1]
}

function fileName(key) {
  const parts = key.split('/')
  return parts[parts.length - 1]
}

function formatSize(size) {
  if (!size && size !== 0) return '-'
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  if (size < 1024 * 1024 * 1024) return (size / 1024 / 1024).toFixed(1) + ' MB'
  return (size / 1024 / 1024 / 1024).toFixed(1) + ' GB'
}

// 格式化日期
function formatDate(date) {
  if (!date) return '--'

  const d = new Date(date)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const fileDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  const timeStr = d.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit', hour12: false})

  if (fileDate.getTime() === today.getTime()) {
    return `今天 ${timeStr}`
  } else if (fileDate.getTime() === yesterday.getTime()) {
    return `昨天 ${timeStr}`
  } else if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日 ${timeStr}`
  } else {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  }
}

// 获取文件类型
function getFileKind(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  const kindMap = {
    'txt': '文本文档',
    'pdf': 'PDF 文档',
    'doc': 'Word 文档',
    'docx': 'Word 文档',
    'xls': 'Excel 表格',
    'xlsx': 'Excel 表格',
    'ppt': 'PowerPoint 演示文稿',
    'pptx': 'PowerPoint 演示文稿',
    'jpg': 'JPEG 图像',
    'jpeg': 'JPEG 图像',
    'png': 'PNG 图像',
    'gif': 'GIF 图像',
    'svg': 'SVG 图像',
    'zip': 'ZIP 压缩文件',
    'rar': 'RAR 压缩文件',
    '7z': '7z 压缩文件',
    'mp4': 'MP4 视频',
    'avi': 'AVI 视频',
    'mp3': 'MP3 音频',
    'wav': 'WAV 音频',
    'js': 'JavaScript 文件',
    'json': 'JSON 文件',
    'html': 'HTML 文档',
    'css': 'CSS 样式表',
    'py': 'Python 文件',
    'java': 'Java 文件',
    'md': 'Markdown 文档'
  }
  return kindMap[ext] || `${ext.toUpperCase()} 文件`
}

// 拖拽上传
function onDragOver(e) {
  e.preventDefault()
  isDragOver.value = true
}

function onDragLeave(e) {
  e.preventDefault()
  isDragOver.value = false
}

async function onDrop(e) {
  e.preventDefault()
  isDragOver.value = false

  if (!window.electron || !props.currentConnectionId) return

  // 直接使用 e.dataTransfer.files 而不是 items
  const files = Array.from(e.dataTransfer.files || [])

  // 调试：输出文件信息
  console.log('=== 拖拽上传调试 ===')
  console.log('文件数量:', files.length)
  files.forEach((file, idx) => {
    console.log(`文件 ${idx + 1}:`, {
      name: file.name,
      size: file.size,
      type: file.type,
      path: file.path,
      hasPath: !!file.path
    })
  })

  for (const file of files) {
    const uploadId = ++uploadIdCounter
    const item = {
      id: uploadId,
      name: file.name,
      path: file.path || file.name,
      total: file.size,
      uploaded: 0,
      progress: 0,
      status: 'uploading'
    }
    uploadList.value.push(item)

    try {
      // Electron 环境下拖拽的文件通常都有 path 属性
      if (file.path) {
        console.log('使用文件路径上传:', file.path)
        await window.electron.uploadFile({
          connectionId: props.currentConnectionId,
          prefix: prefix.value,
          filePath: file.path
        })
      } else {
        // 没有 path 属性，可能的原因：
        // 1. 在浏览器中直接访问（非 Electron 环境）
        // 2. Electron 33.4+ 的严格沙箱机制
        console.error('无法获取文件路径')
        console.error('window.electron 是否存在:', !!window.electron)
        console.error('当前环境:', {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          isElectron: /Electron/i.test(navigator.userAgent)
        })
        throw new Error('拖拽上传不可用，请使用工具栏的“上传”按钮选择文件')
      }

      const idx = uploadList.value.findIndex(u => u.id === uploadId)
      if (idx !== -1) {
        uploadList.value[idx].status = 'success'
        uploadList.value[idx].progress = 100
        uploadList.value[idx].uploaded = uploadList.value[idx].total
      }
      reload()
    } catch (err) {
      const idx = uploadList.value.findIndex(u => u.id === uploadId)
      if (idx !== -1) {
        uploadList.value[idx].status = 'error'
      }
      console.error('上传失败', err)
      alert(`上传失败：${file.name}\n${err.message}`)
    }
  }
}

function handleUploadProgress(data) {
  const item = uploadList.value.find(u => u.path === data.filePath && u.status === 'uploading')
  if (item) {
    item.uploaded = data.uploaded
    item.total = data.total
    item.progress = Math.floor((data.uploaded / data.total) * 100)
  }
}

function clearCompleted() {
  uploadList.value = uploadList.value.filter(u => u.status === 'uploading')
}

// 右键菜单
function onContextMenu(e, target, type) {
  e.preventDefault()
  e.stopPropagation()
  contextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    target,
    type
  }
}

function onAreaContextMenu(e) {
  // 只有点击的是 .file-area 或 .file-content 才显示空白菜单
  if (e.target.classList.contains('file-area') ||
      e.target.classList.contains('file-content') ||
      e.target.classList.contains('empty-folder')) {
    e.preventDefault()
    contextMenu.value = {
      show: true,
      x: e.clientX,
      y: e.clientY,
      target: '',
      type: 'area'
    }
  }
}

function closeContextMenu() {
  contextMenu.value.show = false
}

// 从菜单中刷新
function refreshFromMenu() {
  closeContextMenu()
  reload()
}

function downloadItem() {
  if (!window.electron || !props.currentConnectionId) return

  const key = contextMenu.value.target
  const name = contextMenu.value.type === 'folder' ? lastPart(key) : fileName(key)

  if (contextMenu.value.type === 'folder') {
    alert('文件夹下载功能待实现，请先下载单个文件')
    closeContextMenu()
    return
  }

  window.electron.downloadFile({
    connectionId: props.currentConnectionId,
    key,
    defaultName: name
  }).then(res => {
    if (!res.canceled) {
      alert('下载成功：' + res.savePath)
    }
  }).catch(err => {
    alert('下载失败：' + err.message)
  })

  closeContextMenu()
}

// 上传文件
async function openFileUploadDialog() {
  closeContextMenu()

  if (!window.electron || !props.currentConnectionId) return

  const result = await window.electron.openFileDialog()
  if (result.canceled || !result.filePaths) return

  // 遍历所有选中的文件
  for (const filePath of result.filePaths) {
    const uploadId = ++uploadIdCounter
    const fileName = filePath.split(/[\\/]/).pop() || filePath // 兼容 Windows 和 Unix 路径
    const item = {
      id: uploadId,
      name: fileName,
      path: filePath,
      total: 0,
      uploaded: 0,
      progress: 0,
      status: 'uploading'
    }
    uploadList.value.push(item)

    try {
      await window.electron.uploadFile({
        connectionId: props.currentConnectionId,
        prefix: prefix.value,
        filePath: filePath
      })
      const idx = uploadList.value.findIndex(u => u.id === uploadId)
      if (idx !== -1) {
        uploadList.value[idx].status = 'success'
        uploadList.value[idx].progress = 100
      }
    } catch (err) {
      const idx = uploadList.value.findIndex(u => u.id === uploadId)
      if (idx !== -1) {
        uploadList.value[idx].status = 'error'
      }
      console.error('上传失败', err)
      alert(`上传失败：${fileName}\n${err.message}`)
    }
  }

  // 所有文件上传完成后刷新
  reload()
}

// 上传文件夹
async function openFolderUploadDialog() {
  closeContextMenu()

  if (!window.electron || !props.currentConnectionId) return

  const result = await window.electron.openDirectoryDialog()
  if (result.canceled || !result.filePaths) return

  // 遍历所有选中的文件夹
  for (const selectedPath of result.filePaths) {
    try {
      // 获取该路径下的所有文件（如果是文件夹则递归获取）
      const files = await window.electron.getFilesInDirectory(selectedPath)

      // 为每个文件创建上传任务
      for (const file of files) {
        const uploadId = ++uploadIdCounter
        const item = {
          id: uploadId,
          name: file.relativePath,  // 显示相对路径
          path: file.fullPath,
          total: 0,
          uploaded: 0,
          progress: 0,
          status: 'uploading'
        }
        uploadList.value.push(item)

        try {
          // 上传文件，使用相对路径作为 S3 中的文件名
          await window.electron.uploadFile({
            connectionId: props.currentConnectionId,
            prefix: prefix.value,
            filePath: file.fullPath,
            customFileName: file.relativePath  // 保留目录结构
          })
          const idx = uploadList.value.findIndex(u => u.id === uploadId)
          if (idx !== -1) {
            uploadList.value[idx].status = 'success'
            uploadList.value[idx].progress = 100
          }
        } catch (err) {
          const idx = uploadList.value.findIndex(u => u.id === uploadId)
          if (idx !== -1) {
            uploadList.value[idx].status = 'error'
          }
          console.error('上传失败', err)
          alert(`上传失败：${file.relativePath}\n${err.message}`)
        }
      }

      // 所有文件上传完成后刷新
      reload()
    } catch (err) {
      console.error('获取文件失败', err)
      alert(`获取文件失败：${err.message}`)
    }
  }
}

function deleteItem() {
  // 如果有多选，且右击的项在选中项中，则删除所有选中项
  const isTargetSelected = selectedItems.value.has(contextMenu.value.target)
  const hasMultipleSelection = selectedItems.value.size > 0

  if (isTargetSelected && hasMultipleSelection) {
    // 批量删除选中的所有项
    const itemsToDelete = Array.from(selectedItems.value)
    const folderCount = itemsToDelete.filter(key => key.endsWith('/')).length
    const fileCount = itemsToDelete.length - folderCount

    let message = `确定要删除选中的 ${itemsToDelete.length} 项吗？`
    if (folderCount > 0 && fileCount > 0) {
      message = `确定要删除选中的 ${folderCount} 个文件夹和 ${fileCount} 个文件吗？`
    } else if (folderCount > 0) {
      message = `确定要删除选中的 ${folderCount} 个文件夹吗？`
    } else {
      message = `确定要删除选中的 ${fileCount} 个文件吗？`
    }

    deleteConfirm.value = {
      show: true,
      target: itemsToDelete,  // 传递数组
      type: 'multiple',
      name: message
    }
  } else {
    // 单个删除
    deleteConfirm.value = {
      show: true,
      target: contextMenu.value.target,
      type: contextMenu.value.type,
      name: contextMenu.value.type === 'folder' ? lastPart(contextMenu.value.target) : fileName(contextMenu.value.target)
    }
  }
  closeContextMenu()
}

function closeDeleteConfirm() {
  deleteConfirm.value.show = false
}

async function confirmDelete() {
  if (!window.electron || !props.currentConnectionId) return

  try {
    if (deleteConfirm.value.type === 'multiple') {
      // 批量删除
      const items = deleteConfirm.value.target  // 数组
      let successCount = 0
      let errorCount = 0

      for (const item of items) {
        try {
          if (item.endsWith('/')) {
            // 文件夹
            await window.electron.deleteFolder({
              connectionId: props.currentConnectionId,
              prefix: item
            })
          } else {
            // 文件
            await window.electron.deleteObject({
              connectionId: props.currentConnectionId,
              key: item
            })
          }
          successCount++
        } catch (err) {
          console.error(`删除失败: ${item}`, err)
          errorCount++
        }
      }

      closeDeleteConfirm()

      if (errorCount > 0) {
        alert(`删除完成：成功 ${successCount} 项，失败 ${errorCount} 项`)
      }

      reload()
      selectedItems.value.clear()  // 清空选中项
    } else if (deleteConfirm.value.type === 'folder') {
      // 单个文件夹
      await window.electron.deleteFolder({
        connectionId: props.currentConnectionId,
        prefix: deleteConfirm.value.target
      })
      closeDeleteConfirm()
      reload()
    } else {
      // 单个文件
      await window.electron.deleteObject({
        connectionId: props.currentConnectionId,
        key: deleteConfirm.value.target
      })
      closeDeleteConfirm()
      reload()
    }
  } catch (err) {
    alert('删除失败：' + err.message)
  }
}

// 新建文件夹
function openCreateFolderDialog() {
  createFolderDialog.value = {
    show: true,
    name: ''
  }
  closeContextMenu()
  // 使用 nextTick 确保 DOM 更新后聚焦输入框
  setTimeout(() => {
    folderNameInput.value?.focus()
  }, 100)
}

function closeCreateFolderDialog() {
  createFolderDialog.value.show = false
  createFolderDialog.value.name = ''
}

async function confirmCreateFolder() {
  const folderName = createFolderDialog.value.name.trim()
  if (!folderName) return

  if (!window.electron || !props.currentConnectionId) return

  try {
    // S3 中文件夹通过上传一个空对象实现，键名以 / 结尾
    const folderKey = prefix.value + folderName + '/'

    // 调用上传接口，上传一个空文件代表文件夹
    // 这里需要在主进程增加一个创建文件夹的接口
    await window.electron.createFolder({
      connectionId: props.currentConnectionId,
      folderKey: folderKey
    })

    closeCreateFolderDialog()
    reload()
  } catch (err) {
    alert('创建文件夹失败：' + err.message)
  }
}

// 拖拽下载
function onFileDragStart(e, key) {
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData('DownloadURL', `application/octet-stream:${fileName(key)}:${key}`)
}

onMounted(() => {
  if (window.electron) {
    window.electron.onUploadProgress(handleUploadProgress)
  }
  window.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  if (window.electron) {
    window.electron.removeUploadProgressListener()
  }
  window.removeEventListener('keydown', handleKeyDown)
})

watch(
    () => props.currentConnectionId,
    () => {
      prefix.value = ''
      folders.value = []
      files.value = []
      if (props.currentConnectionId) {
        reload()
      }
    },
    {immediate: true}
)
</script>

<style scoped>
.browser {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.empty-icon {
  font-size: 64px;
  opacity: 0.3;
}

.empty-text {
  font-size: 14px;
  color: #6b7280;
}

.primary {
  padding: 8px 16px;
  border-radius: 999px;
  border: none;
  background: #2563eb;
  color: #ffffff;
  cursor: pointer;
  font-size: 14px;
}

.primary:hover {
  background: #1d4ed8;
}

.browser-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 12px;
  margin: 0;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  transition: all 0.2s ease;
  position: relative;
}

.file-area.drag-over {
  background: #eff6ff;
  box-shadow: 0 0 0 2px #2563eb inset;
}

.toolbar {
  padding: 16px 20px;
  border-bottom: 1px solid #e5e5e7;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f5f5f7;
  flex-shrink: 0;
  height: 56px;
  box-sizing: border-box;
}

.path-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  overflow: hidden;
  min-width: 0;
}

.path-btn {
  border: none;
  background: transparent;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #4b5563;
  white-space: nowrap;
  display: flex;
  align-items: center;
  transition: background 0.15s ease;
}

.path-btn.home-btn {
  padding: 6px;
}

.path-btn.home-btn :deep(.n-icon) {
  font-size: 16px;
}

.path-btn:hover {
  background: #e5e7eb;
}

.path-separator {
  color: #9ca3af;
  font-size: 13px;
  user-select: none;
}

/* 路径编辑模式 */
.path-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  cursor: text;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.path-breadcrumb:hover {
  background: #f3f4f6;
}

.path-text {
  color: #9ca3af;
  font-size: 13px;
  font-style: italic;
}

.path-input-wrapper {
  flex: 1;
  min-width: 0;
}

.path-input {
  width: 100%;
  padding: 6px 12px;
  border: 2px solid #2563eb;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  background: #ffffff;
  color: #1f2933;
  box-sizing: border-box;
}

.path-input::placeholder {
  color: #9ca3af;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.file-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.status-bar {
  position: absolute;
  bottom: 16px;
  right: 20px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 6px;
  font-size: 13px;
  color: #6b7280;
  pointer-events: none;
  user-select: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.status-selected {
  color: #3b82f6;
  font-weight: 500;
}

.status-total {
  color: #9ca3af;
}

.loading, .empty-folder {
  padding: 60px 20px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
}

.empty-folder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.empty-icon {
  font-size: 64px;
  opacity: 0.3;
}

.empty-text {
  font-size: 15px;
  color: #6b7280;
  font-weight: 500;
}

.empty-hint {
  font-size: 13px;
  color: #9ca3af;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-item {
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  position: relative;
}

/* 网格模式样式 */
.file-grid .file-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid transparent;
}

.file-grid .file-item:hover {
  background: #f3f4f6;
  border-color: #e5e7eb;
  transform: translateY(-1px);
}

.file-grid .file-item.selected {
  background: #eff6ff;
  border-color: #3b82f6;
}

.file-grid .file-item.selected::after {
  content: '✓';
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  background: #3b82f6;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
}

.file-grid .file-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.file-grid .file-info {
  width: 100%;
  text-align: center;
}

.file-grid .file-name {
  font-size: 13px;
  color: #1f2933;
  word-break: break-all;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.file-grid .file-size {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
}

/* 列表模式样式 - Finder 风格 */
.file-list {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 6px;
  overflow: hidden;
}

/* 表头 */
.list-header {
  display: grid;
  grid-template-columns: 1fr 200px 120px 200px;
  gap: 16px;
  padding: 8px 16px;
  background: #f5f5f7;
  border-bottom: 1px solid #e5e5e7;
  font-size: 12px;
  font-weight: 500;
  color: #86868b;
  position: sticky;
  top: 0;
  z-index: 1;
  user-select: none;
}

.header-name,
.header-kind,
.header-size,
.header-date {
  display: flex;
  align-items: center;
}

.header-size,
.header-date {
  justify-content: flex-start;
}

/* 文件项（列表模式） */
.file-list .file-item {
  display: grid;
  grid-template-columns: 1fr 200px 120px 200px;
  gap: 16px;
  align-items: center;
  padding: 6px 16px;
  cursor: pointer;
  transition: background 0.1s ease;
  border-bottom: 1px solid #f5f5f7;
  min-height: 32px;
}

.file-list .file-item:hover {
  background: #f5f5f7;
}

.file-list .file-item.selected {
  background: #d1e7fd;
}

.file-list .file-item.selected:hover {
  background: #c7dff7;
}

/* 名称列 */
.item-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.file-list .file-icon {
  font-size: 20px;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-list .file-name {
  font-size: 13px;
  color: #1d1d1f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

/* 类型列 */
.item-kind {
  font-size: 13px;
  color: #86868b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 大小列 */
.item-size {
  font-size: 13px;
  color: #86868b;
  text-align: left;
}

/* 日期列 */
.item-date {
  font-size: 13px;
  color: #86868b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 上传面板 */
.upload-panel {
  position: fixed;
  bottom: 16px;
  right: 16px;
  width: 360px;
  max-height: 400px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 100;
}

.upload-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f9fafb;
  font-size: 13px;
  font-weight: 500;
}

.close-btn {
  border: none;
  background: transparent;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: #6b7280;
}

.close-btn:hover {
  background: #e5e7eb;
}

.upload-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.upload-item {
  padding: 8px;
  border-radius: 6px;
  margin-bottom: 6px;
  background: #f9fafb;
}

.upload-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.upload-name {
  font-size: 13px;
  color: #1f2933;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.upload-status {
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
  margin-left: 8px;
}

.upload-status .success {
  color: #10b981;
}

.upload-status .error {
  color: #ef4444;
}

.upload-progress {
  height: 4px;
  background: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
}

.upload-progress-bar {
  height: 100%;
  background: #2563eb;
  transition: width 0.3s ease;
}

.upload-progress-bar.success {
  background: #10b981;
}

.upload-progress-bar.error {
  background: #ef4444;
}

/* 右键菜单 */
.context-overlay {
  position: fixed;
  inset: 0;
  z-index: 99;
}

.context-menu {
  position: fixed;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
  padding: 4px;
  min-width: 140px;
  z-index: 100;
}

.context-menu-item {
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.15s ease;
}

.context-menu-item:hover {
  background: #f3f4f6;
}

.context-menu-item.danger {
  color: #ef4444;
}

.context-menu-item.danger:hover {
  background: #fee2e2;
}

.context-menu-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 4px 0;
}

/* 删除确认对话框 */
.dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.dialog {
  background: #ffffff;
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.3);
  animation: dialogSlideIn 0.3s ease-out;
}

@keyframes dialogSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.confirm-dialog {
  max-width: 440px;
  text-align: center;
}

.dialog-icon {
  margin: 0 auto 20px;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
}

.icon-warning {
  font-size: 32px;
}

.icon-folder {
  font-size: 32px;
}

.input-dialog {
  max-width: 420px;
  min-width: 360px;
  text-align: center;
}

.input-dialog .dialog-icon {
  background: linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

.input-dialog h3 {
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 600;
  color: #1f2933;
}

.folder-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.folder-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.folder-input::placeholder {
  color: #9ca3af;
}

.confirm-dialog h3 {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 600;
  color: #1f2933;
}

.confirm-message {
  margin: 0 0 12px;
  font-size: 15px;
  color: #52606d;
  line-height: 1.6;
}

.confirm-message strong {
  color: #1f2933;
  font-weight: 600;
  word-break: break-all;
}

.confirm-warning {
  margin: 16px 0 0;
  padding: 12px 16px;
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
  border-radius: 8px;
  font-size: 13px;
  color: #92400e;
  text-align: left;
  line-height: 1.5;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  justify-content: center;
}
</style>
