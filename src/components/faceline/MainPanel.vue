<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ShowDialog from '../common/ShowDialog.vue';

// 跟踪拖拽状态
const isDragging = ref(false);
const newFileAreaHeight = ref(500); // 初始高度
const dragStartY = ref(0);
const dragStartHeight = ref(0);
let rafId: number | null = null; // 用于requestAnimationFrame

// 获取 DOM 元素的引用
const newFileAreaRef = ref(null);
const dragHandleRef = ref(null);

// 在组件挂载后初始化
onMounted(() => {
  if (newFileAreaRef.value) {
    (newFileAreaRef.value as HTMLElement).style.height = `${newFileAreaHeight.value}px`;
  }
});

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
const dialogTitle = ref('新建文件');
const dialogContent = ref('是否创建新的世界观文件？');

// 点击添加按钮
function handleAddClick() {
  dialogVisible.value = true;
}

// 确认创建新文件
function handleConfirmCreate() {
  console.log('确认创建新文件');
  // 这里可以添加创建新文件的逻辑
}

// 取消创建
function handleCancelCreate() {
  console.log('取消创建新文件');
}
</script>

<template>
  <div class="main-panel" :class="{ 'dragging': isDragging }">
    <!-- 搜索框部分 -->
    <div class="search-section">
      <input type="text" placeholder="Insearch" class="search-input">
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
            <h2>世界观一（若无则显示新建文件）</h2>
          </div>

          <div class="add-section">
            <button class="add-button" @click="handleAddClick">
              <span>+</span>
            </button>
          </div>
        </div>
        
        <!-- 这里可以添加新文件区域的其他内容 -->
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
    
    <!-- 对话框组件 -->
    <ShowDialog
      :visible="dialogVisible"
      @update:visible="dialogVisible = $event"
      :title="dialogTitle"
      :content="dialogContent"
      @confirm="handleConfirmCreate"
      @cancel="handleCancelCreate"
    />
  </div>
</template>

<style lang="scss" scoped>
.main-panel {
  flex-grow: 1;
  background-color: #fff;
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
  border-bottom: 1px solid #e0e0e0;

  .search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #000;
    font-size: 14px;
    box-sizing: border-box;
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
  }
}

.add-section {
  margin-left: 20px;
}

.add-button {
  width: 40px;
  height: 40px;
  background-color: #e0e0e0;
  border: none;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  font-size: 24px;
  
  &:hover {
    background-color: #d0d0d0;
  }
}

/* 分隔线 */
.separator {
  position: relative;
  height: 1px;
  background-color: #e0e0e0;
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
</style>