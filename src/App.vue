<template>
  <div class="app">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1 class="logo">Open S3</h1>
        <button class="add-btn" @click="openConnectionForm()" title="新增连接">
          +
        </button>
      </div>
      <div class="connection-list">
        <div
          v-for="item in connections"
          :key="item.id"
          class="connection-item"
          :class="{ active: currentConnectionId === item.id }"
          @click="selectConnection(item.id)"
        >
          <div class="connection-info">
            <div class="connection-name">{{ item.name || '未命名连接' }}</div>
            <div class="connection-bucket">{{ item.bucket || '-' }}</div>
          </div>
          <div class="connection-actions" @click.stop>
            <button class="icon-btn" @click="editConnection(item)" title="编辑">✏️</button>
            <button class="icon-btn danger" @click="deleteConnection(item.id)" title="删除">🗑️</button>
          </div>
        </div>
        <div v-if="connections.length === 0" class="empty-tip">
          暂无连接，请点击上方 + 按钮添加
        </div>
      </div>
    </aside>

    <main class="content">
      <Browser :currentConnectionId="currentConnectionId" @openConnectionForm="openConnectionForm" />
    </main>

    <!-- 连接表单弹窗 -->
    <div v-if="showForm" class="dialog-mask" @click.self="closeForm">
      <div class="dialog">
        <h3>{{ editing?.id ? '编辑连接' : '新增连接' }}</h3>
        <div class="form">
          <label>
            <span>名称</span>
            <input v-model="form.name" placeholder="例如：测试环境 / 生产环境" />
          </label>
          <label>
            <span>主机地址（host / endpoint）</span>
            <input v-model="form.host" placeholder="例如：http://127.0.0.1:9000" />
          </label>
          <label>
            <span>Access Key ID</span>
            <input v-model="form.accessKeyId" />
          </label>
          <label>
            <span>Access Key Secret</span>
            <input v-model="form.accessKeySecret" type="password" />
          </label>
          <label>
            <span>默认 Bucket</span>
            <input v-model="form.bucket" placeholder="例如：my-bucket" />
          </label>
          <label>
            <span>Region（可选）</span>
            <input v-model="form.region" placeholder="例如：us-east-1" />
          </label>
          <label>
            <span>寻址模式</span>
            <select v-model="form.forcePathStyle">
              <option :value="false">虚拟主机模式 (Virtual-hosted-style)，默认推荐</option>
              <option :value="true">路径模式 (Path-style)，适用于 MinIO 等</option>
            </select>
          </label>
        </div>
        <div class="dialog-actions">
          <button @click="closeForm">取消</button>
          <button class="primary" @click="save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import Browser from './views/Browser.vue'

const connections = ref([])
const currentConnectionId = ref('')
const showForm = ref(false)
const editing = ref(null)
const form = reactive({
  id: '',
  name: '',
  host: '',
  accessKeyId: '',
  accessKeySecret: '',
  bucket: '',
  region: '',
  forcePathStyle: false
})

async function loadConnections () {
  if (!window.electron) return
  connections.value = await window.electron.listConnections()
}

function selectConnection (id) {
  currentConnectionId.value = id
}

function openConnectionForm () {
  editing.value = null
  form.id = ''
  form.name = ''
  form.host = ''
  form.accessKeyId = ''
  form.accessKeySecret = ''
  form.bucket = ''
  form.region = ''
  form.forcePathStyle = false
  showForm.value = true
}

function editConnection (item) {
  editing.value = item
  form.id = item.id || ''
  form.name = item.name || ''
  form.host = item.host || ''
  form.accessKeyId = item.accessKeyId || ''
  form.accessKeySecret = item.accessKeySecret || ''
  form.bucket = item.bucket || ''
  form.region = item.region || ''
  form.forcePathStyle = item.forcePathStyle !== undefined ? item.forcePathStyle : false
  showForm.value = true
}

function closeForm () {
  showForm.value = false
}

async function save () {
  if (!window.electron) return
  const next = await window.electron.saveConnection({ ...form })
  connections.value = next
  showForm.value = false
}

async function deleteConnection (id) {
  if (!window.electron) return
  const ok = confirm('确定要删除该连接吗？')
  if (!ok) return
  const next = await window.electron.deleteConnection(id)
  connections.value = next
  if (currentConnectionId.value === id) {
    currentConnectionId.value = ''
  }
}

onMounted(() => {
  loadConnections()
})
</script>

<style scoped>
.app {
  display: flex;
  height: 100vh;
  background: #f5f7fb;
  color: #1f2933;
}

.sidebar {
  width: 260px;
  background: #ffffff;
  box-shadow: 2px 0 8px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e5e5e7;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f5f5f7;
  height: 56px;
  box-sizing: border-box;
}

.logo {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #2563eb;
}

.add-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: #2563eb;
  color: #ffffff;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.add-btn:hover {
  background: #1d4ed8;
}

.connection-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.connection-item {
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background 0.15s ease;
}

.connection-item:hover {
  background: #f9fafb;
}

.connection-item.active {
  background: #eff6ff;
  border-left: 3px solid #2563eb;
}

.connection-info {
  flex: 1;
  min-width: 0;
}

.connection-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2933;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.connection-bucket {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.connection-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.connection-item:hover .connection-actions {
  opacity: 1;
}

.icon-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  border-radius: 4px;
}

.icon-btn:hover {
  background: #f3f4f6;
}

.icon-btn.danger:hover {
  background: #fee2e2;
}

.empty-tip {
  padding: 24px 12px;
  text-align: center;
  font-size: 13px;
  color: #9ca3af;
}

.content {
  flex: 1;
  overflow: hidden;
}

.dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  width: 480px;
  background: #ffffff;
  border-radius: 16px;
  padding: 20px 24px 16px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.25);
}

.dialog h3 {
  margin: 0 0 16px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

label span {
  font-size: 13px;
  color: #4b5563;
}

input, select {
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  padding: 6px 10px;
  font-size: 13px;
}

input:focus, select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.2);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.dialog-actions button {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  cursor: pointer;
  font-size: 13px;
}

.dialog-actions .primary {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.dialog-actions .primary:hover {
  background: #1d4ed8;
}
</style>
