<template>
  <div class="page">
    <header class="header">
      <div>
        <h2>连接管理</h2>
        <p class="subtitle">配置并保存多个 S3 连接，方便快速切换环境。</p>
      </div>
      <button class="primary" @click="openForm()">新增连接</button>
    </header>

    <div class="grid">
      <div
        v-for="item in connections"
        :key="item.id"
        class="card"
        @click="$emit('selectConnection', item.id)"
      >
        <div class="card-header">
          <h3>{{ item.name || '未命名连接' }}</h3>
          <span class="tag">
            {{ item.bucket || '未配置 bucket' }}
          </span>
        </div>
        <p class="host">{{ item.host }}</p>
        <div class="card-actions" @click.stop>
          <button class="link" @click="openForm(item)">编辑</button>
          <button class="link danger" @click="remove(item.id)">删除</button>
        </div>
      </div>

      <div class="card placeholder" @click="openForm()">
        <div class="plus">＋</div>
        <div>新增连接</div>
      </div>
    </div>

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

const connections = ref([])
const showForm = ref(false)
const editing = ref(null)
const form = reactive({
  id: '',
  name: '',
  host: '',
  accessKeyId: '',
  accessKeySecret: '',
  bucket: '',
  region: ''
})

async function load () {
  if (!window.electron) return
  connections.value = await window.electron.listConnections()
}

function openForm (item) {
  editing.value = item || null
  form.id = item?.id || ''
  form.name = item?.name || ''
  form.host = item?.host || ''
  form.accessKeyId = item?.accessKeyId || ''
  form.accessKeySecret = item?.accessKeySecret || ''
  form.bucket = item?.bucket || ''
  form.region = item?.region || ''
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

async function remove (id) {
  if (!window.electron) return
  const ok = confirm('确定要删除该连接吗？')
  if (!ok) return
  const next = await window.electron.deleteConnection(id)
  connections.value = next
}

onMounted(() => {
  load()
})
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.subtitle {
  margin: 4px 0 0;
  font-size: 13px;
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

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.card {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card:hover {
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  font-size: 16px;
}

.tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
}

.host {
  margin: 0;
  font-size: 13px;
  color: #4b5563;
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.link {
  border: none;
  background: transparent;
  padding: 0;
  font-size: 13px;
  color: #2563eb;
  cursor: pointer;
}

.link.danger {
  color: #dc2626;
}

.placeholder {
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.plus {
  font-size: 24px;
}

.dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog {
  width: 420px;
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

input {
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  padding: 6px 10px;
  font-size: 13px;
}

input:focus {
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
</style>
