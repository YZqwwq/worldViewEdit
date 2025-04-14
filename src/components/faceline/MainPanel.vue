<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ShowDialog from '../common/ShowDialog.vue';
import FolderIcon from '../common/FolderIcon.vue';
import { useRouter } from 'vue-router';
import type { WorldInfo, WorldData } from '../../electron';

// 获取路由实例
const router = useRouter();

// 跟踪拖拽状态
const isDragging = ref(false);
const newFileAreaHeight = ref(500); // 初始高度
const dragStartY = ref(0);
const dragStartHeight = ref(0);
let rafId: number | null = null; // 用于requestAnimationFrame

// 获取 DOM 元素的引用
const newFileAreaRef = ref(null);
const dragHandleRef = ref(null);

// 世界观文件列表
const worldFiles = ref<WorldInfo[]>([]);
const isLoading = ref(false);
const errorMsg = ref('');
const isDeleting = ref(false);
const deleteConfirmVisible = ref(false);
const worldToDelete = ref<WorldInfo | null>(null);

// 在组件挂载后初始化
onMounted(() => {
  if (newFileAreaRef.value) {
    (newFileAreaRef.value as HTMLElement).style.height = `${newFileAreaHeight.value}px`;
  }
  // 加载已有的世界观文件列表
  loadWorldFiles();
});

// 加载世界观文件列表
async function loadWorldFiles() {
  isLoading.value = true;
  errorMsg.value = '';
  try {
    // 检查 electronAPI 是否可用
    if (typeof window.electronAPI === 'undefined') {
      console.error('electronAPI 未定义，无法加载世界观列表');
      errorMsg.value = 'electronAPI 不可用，无法加载世界观列表';
      return;
    }

    // 测试 API 连接
    try {
      const testResult = await window.electronAPI.data.test();
      console.log('API 连接测试:', testResult);
    } catch (e) {
      console.warn('API 连接测试失败:', e);
    }

    // 尝试获取文件列表
    const files = await window.electronAPI.data.listFiles();
    console.log('获取到文件列表:', files);
    
    // 读取世界观列表
    let worldsList = [];
    try {
      worldsList = await window.electronAPI.data.readFile('worlds.json') || [];
    } catch (e) {
      console.log('无世界观列表，创建新列表');
      // 如果文件不存在，保存一个空列表
      await window.electronAPI.data.saveFile('worlds.json', []);
    }
    
    worldFiles.value = worldsList;
  } catch (error) {
    console.error('加载世界观文件列表失败:', error);
    errorMsg.value = '加载世界观文件列表失败: ' + (error instanceof Error ? error.message : String(error));
  } finally {
    isLoading.value = false;
  }
}

// 拖拽开始
function handleDragStart(event: MouseEvent) {
  // 阻止默认行为和事件冒泡
  event.preventDefault();
  event.stopPropagation();
  
  isDragging.value = true;
  dragStartY.value = event.clientY;
  dragStartHeight.value = newFileAreaHeight.value;
  
  // 添加全局事件监听
  document.addEventListener('mousemove', handleDragMove, { passive: false });
  document.addEventListener('mouseup', handleDragEnd);
  
  // 添加光标样式到body
  document.body.style.cursor = 'ns-resize';
}

// 拖拽移动的实际计算和DOM更新
function updateHeight(clientY: number) {
  const deltaY = clientY - dragStartY.value;
  const newHeight = dragStartHeight.value + deltaY;
  
  // 限制范围
  if (newHeight >= 100 && newHeight <= 500) {
    // 直接操作DOM以获得最快的响应
    if (newFileAreaRef.value) {
      (newFileAreaRef.value as HTMLElement).style.height = `${newHeight}px`;
    }
    
    // 在拖拽结束后更新响应式数据
    newFileAreaHeight.value = newHeight;
  }
}

// 拖拽移动
function handleDragMove(event: MouseEvent) {
  if (!isDragging.value) return;
  
  // 阻止事件默认行为和冒泡
  event.preventDefault();
  event.stopPropagation();
  
  // 取消之前的动画帧请求
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
  }
  
  // 在下一个动画帧更新DOM
  rafId = requestAnimationFrame(() => {
    updateHeight(event.clientY);
    rafId = null;
  });
}

// 拖拽结束
function handleDragEnd(event?: MouseEvent) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  isDragging.value = false;
  
  // 取消任何待处理的动画帧请求
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  
  // 更新响应式数据以确保状态一致
  if (newFileAreaRef.value) {
    const currentHeight = parseInt((newFileAreaRef.value as HTMLElement).style.height);
    if (!isNaN(currentHeight)) {
      newFileAreaHeight.value = currentHeight;
    }
  }
  
  // 移除全局事件监听
  document.removeEventListener('mousemove', handleDragMove);
  document.removeEventListener('mouseup', handleDragEnd);
  
  // 恢复默认光标
  document.body.style.cursor = '';
}

// 对话框相关状态
const dialogVisible = ref(false);
const dialogTitle = ref('新建世界观');
const dialogContent = ref('请输入世界观名称：');
const newWorldName = ref(''); // 新世界观名称

// 点击添加按钮
function handleAddClick() {
  dialogTitle.value = '新建世界观';
  dialogContent.value = '请输入世界观名称：';
  newWorldName.value = '';
  dialogVisible.value = true;
}

// 确认创建新文件
async function handleConfirmCreate() {
  if (!newWorldName.value.trim()) {
    alert('请输入世界观名称');
    return;
  }
  
  try {
    console.log('开始创建世界观:', newWorldName.value);
    
    // 检查 electronAPI 是否可用
    if (typeof window.electronAPI === 'undefined') {
      console.error('electronAPI 未定义，无法创建世界观');
      alert('应用初始化失败: electronAPI 不可用。请重启应用或联系开发者。');
      return;
    }
    
    // 创建一个新的世界观数据结构
    const now = new Date().toISOString();
    const id = Date.now().toString();
    const newWorld = {
      id: id,
      name: newWorldName.value.trim(),
      createdAt: now,
      updatedAt: now,
      description: '',
      content: {}
    };
    
    console.log('新建的世界观数据:', JSON.stringify(newWorld));
    
    // 保存世界观数据到单独文件
    const filePath = await window.electronAPI.data.saveFile(`world_${id}.json`, newWorld);
    console.log('世界观文件已保存到:', filePath);
    
    // 读取世界观列表
    let worldsList = await window.electronAPI.data.readFile('worlds.json') || [];
    
    // 添加到列表
    worldsList.push({
      id: id,
      name: newWorld.name,
      createdAt: now,
      updatedAt: now
    });
    
    // 保存更新后的列表
    await window.electronAPI.data.saveFile('worlds.json', worldsList);
    console.log('世界观列表已更新');
    
    // 清空输入框
    newWorldName.value = '';
    // 关闭对话框
    dialogVisible.value = false;
    
    // 重新加载世界观列表
    await loadWorldFiles();
    
    // 使用 Vue Router 导航到世界观编辑页面
    console.log('准备导航到编辑页面，路径:', `/editor?id=${id}`);
    router.push({
      path: '/editor',
      query: { id }
    });
  } catch (error) {
    console.error('创建世界观失败:', error);
    alert('创建世界观失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}

// 打开世界观
function openWorld(worldInfo: WorldInfo) {
  router.push({
    path: '/editor',
    query: { id: worldInfo.id }
  });
}

// 取消创建
function handleCancelCreate() {
  newWorldName.value = '';
}

// 删除世界观文件
async function deleteWorld(world: WorldInfo) {
  // 显示确认对话框
  worldToDelete.value = world;
  dialogTitle.value = '确认删除';
  dialogContent.value = `是否确定删除世界观 "${world.name}"？此操作不可恢复。`;
  deleteConfirmVisible.value = true;
}

// 确认删除
async function handleConfirmDelete() {
  if (!worldToDelete.value) return;
  
  const world = worldToDelete.value;
  isDeleting.value = true;
  
  try {
    console.log('开始删除世界观:', world.name);
    
    // 检查 electronAPI 是否可用
    if (typeof window.electronAPI === 'undefined') {
      console.error('electronAPI 未定义，无法删除世界观');
      alert('应用初始化失败: electronAPI 不可用。请重启应用或联系开发者。');
      return;
    }
    
    // 删除世界观文件
    const success = await window.electronAPI.data.deleteFile(`world_${world.id}.json`);
    console.log('世界观文件删除结果:', success);
    
    if (success) {
      // 更新世界观列表
      let worldsList = await window.electronAPI.data.readFile('worlds.json') || [];
      worldsList = worldsList.filter((item: WorldInfo) => item.id !== world.id);
      
      // 保存更新后的列表
      await window.electronAPI.data.saveFile('worlds.json', worldsList);
      console.log('世界观列表已更新');
      
      // 重新加载世界观列表
      await loadWorldFiles();
    } else {
      alert('删除文件失败，该文件可能不存在或无法访问');
    }
  } catch (error) {
    console.error('删除世界观失败:', error);
    alert('删除世界观失败: ' + (error instanceof Error ? error.message : String(error)));
  } finally {
    isDeleting.value = false;
    deleteConfirmVisible.value = false;
    worldToDelete.value = null;
  }
}

// 取消删除
function handleCancelDelete() {
  deleteConfirmVisible.value = false;
  worldToDelete.value = null;
}
</script>

<template>
  <div class="main-panel" :class="{ 'dragging': isDragging }">
    <!-- 搜索框部分 -->
    <div class="search-section">
      <input type="text" placeholder="搜索世界观文件" class="search-input">
    </div>

    <!-- 内容部分 -->
    <div class="content-section">
      <!-- 新文件区域 -->
      <div 
        ref="newFileAreaRef"
        class="new-file-area"
        :style="{ height: `${newFileAreaHeight}px` }"
      >
        <div class="new-file-and-title">
          <div class="title-section">
            <h2>世界观文件</h2>
          </div>

          <div class="add-section">
            <button class="add-button" @click="handleAddClick">
              <span>+</span>
            </button>
          </div>
        </div>
        
        <!-- 世界观文件列表 -->
        <div class="world-files-list">
          <div v-if="isLoading" class="loading-state">
            正在加载世界观文件...
          </div>
          
          <div v-else-if="errorMsg" class="error-state">
            {{ errorMsg }}
          </div>
          
          <div v-else-if="worldFiles.length === 0" class="empty-state">
            还没有世界观文件，点击右上角的 + 创建一个新的世界观
          </div>
          
          <div 
            v-for="file in worldFiles" 
            :key="file.id" 
            class="world-file-item"
          >
            <div class="world-file-icon" @click="openWorld(file)">
              <FolderIcon :size="24" />
            </div>
            <div class="world-file-info" @click="openWorld(file)">
              <div class="world-file-name">{{ file.name }}</div>
              <div class="world-file-date">更新于: {{ new Date(file.updatedAt).toLocaleDateString() }}</div>
            </div>
            <div class="world-file-actions">
              <button class="delete-button" @click="deleteWorld(file)" title="删除">
                <span>×</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 分隔线和拖拽手柄 -->
      <div class="separator">
        <div 
          ref="dragHandleRef" 
          class="drag-handle" 
          @mousedown="handleDragStart"
          :class="{ 'dragging': isDragging }"
        ></div>
      </div>
      
      <!-- 最近使用文件 -->
      <div class="recent-files">
        <h3>最近使用文件</h3>
        <!-- 这里可以添加最近文件列表 -->
      </div>
    </div>
    
    <!-- 新建对话框 -->
    <ShowDialog
      :visible="dialogVisible"
      @update:visible="dialogVisible = $event"
      :title="dialogTitle"
      :content="dialogContent"
      @confirm="handleConfirmCreate"
      @cancel="handleCancelCreate"
    >
      <!-- 添加输入框插槽 -->
      <template #content>
        <div class="dialog-input-container">
          <label for="worldName">世界观名称：</label>
          <input 
            id="worldName" 
            type="text" 
            v-model="newWorldName" 
            placeholder="请输入世界观名称" 
            class="world-name-input"
          >
        </div>
      </template>
    </ShowDialog>
    
    <!-- 删除确认对话框 -->
    <ShowDialog
      :visible="deleteConfirmVisible"
      @update:visible="deleteConfirmVisible = $event"
      :title="dialogTitle"
      :content="dialogContent"
      @confirm="handleConfirmDelete"
      @cancel="handleCancelDelete"
      :confirmText="'删除'"
      :cancelText="'取消'"
    />
  </div>
</template>

<style lang="scss" scoped>
.main-panel {
  flex-grow: 1;
  background-color: var(--bg-primary);
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  
  &.dragging {
    user-select: none;
    -webkit-user-select: none;
    cursor: ns-resize;
  }
}

.search-section {
  padding: 20px;
  border-bottom: 1px solid var(--border-color);

  .search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 14px;
    box-sizing: border-box;
    
    &::placeholder {
      color: var(--text-tertiary);
    }
  }
}

.content-section {
  padding: 20px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 新文件区域 */
.new-file-area {
  min-height: 100px;
  max-height: 500px;
  overflow-y: auto;
  /* 移除transition效果以提高响应速度 */
  will-change: height; /* 提示浏览器这个属性会变化 */
}

/* 新建文件和标题区域 */
.new-file-and-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.title-section {
  h2 {
    margin: 0;
    font-weight: normal;
    font-size: 16px;
    color: var(--text-primary);
  }
}

.add-section {
  margin-left: 20px;
}

.add-button {
  width: 40px;
  height: 40px;
  background-color: var(--bg-tertiary);
  border: none;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  font-size: 24px;
  color: var(--text-primary);
  
  &:hover {
    background-color: var(--accent-tertiary);
  }
}

/* 分隔线 */
.separator {
  position: relative;
  height: 1px;
  background-color: var(--border-color);
  margin: 10px 0;
  user-select: none;
}

/* 拖拽手柄 */
.drag-handle {
  position: absolute;
  top: -10px;
  left: 0;
  width: 100%;
  height: 20px;
  cursor: ns-resize;
  background: transparent;
  user-select: none;
  -webkit-user-select: none;
  
  &:hover::before,
  &.dragging::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 4px;
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 2px;
    transform: translateY(-50%);
  }
  
  &.dragging {
    cursor: ns-resize;
  }
}

/* 最近文件区域 */
.recent-files {
  flex-grow: 1;
  padding-top: 10px;
  overflow-y: auto;
  
  h3 {
    margin: 0;
    font-weight: normal;
    font-size: 16px;
    color: var(--text-primary);
  }
}

.settings-section {
  padding: 0 20px 20px;
  margin-top: auto;
  
  .settings-content {
    padding: 10px 0;
    cursor: pointer;
    
    span {
      font-size: 16px;
    }
  }
}

/* 世界观文件列表 */
.world-files-list {
  margin-top: 20px;
}

.loading-state,
.empty-state,
.error-state {
  color: var(--text-tertiary);
  text-align: center;
  padding: 20px;
  font-style: italic;
}

.error-state {
  color: var(--error);
}

.world-file-item {
  padding: 12px 15px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  
  &:hover {
    background-color: var(--bg-tertiary);
  }
}

.world-file-icon {
  margin-right: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.world-file-info {
  flex: 1;
}

.world-file-name {
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.world-file-date {
  font-size: 12px;
  color: var(--text-tertiary);
}

.world-file-actions {
  display: flex;
  align-items: center;
}

.delete-button {
  width: 24px;
  height: 24px;
  background-color: var(--error);
  color: white;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.7;
  transition: opacity 0.2s;
  padding: 0;
  margin-left: 10px;
  
  &:hover {
    opacity: 1;
  }
  
  span {
    line-height: 1;
  }
}

/* 对话框自定义样式 */
.dialog-input-container {
  margin: 15px 0;
  
  label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
    color: var(--text-primary);
  }
}

.world-name-input {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 14px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  
  &:focus {
    border-color: var(--accent-primary);
    outline: none;
  }
}
</style>