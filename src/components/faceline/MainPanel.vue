<script setup lang="ts">
import { ref, onMounted } from 'vue';

// 跟踪拖拽状态
const isDragging = ref(false);
const recentFilesMarginTop = ref(40); // 初始边距
const dragStartY = ref(0);
const dragStartMargin = ref(0);

// 获取 DOM 元素的引用
const recentFilesRef = ref(null);
const dragHandleRef = ref(null);

// 拖拽开始
function handleDragStart(event: MouseEvent) {
  isDragging.value = true;
  dragStartY.value = event.clientY;
  dragStartMargin.value = recentFilesMarginTop.value;
  
  // 添加全局事件监听
  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('mouseup', handleDragEnd);
}

// 拖拽移动
function handleDragMove(event: MouseEvent) {
  if (!isDragging.value) return;
  
  const deltaY = event.clientY - dragStartY.value;
  const newMargin = dragStartMargin.value + deltaY;
  
  // 限制范围，防止拖到屏幕外或太靠上
  if (newMargin >= 0) {
    recentFilesMarginTop.value = newMargin;
  }
}

// 拖拽结束
function handleDragEnd() {
  isDragging.value = false;
  
  // 移除全局事件监听
  document.removeEventListener('mousemove', handleDragMove);
  document.removeEventListener('mouseup', handleDragEnd);
}
</script>

<template>
  <div class="main-panel">
    <!-- 搜索框部分 -->
    <div class="search-section">
      <input type="text" placeholder="Insearch" class="search-input">
    </div>

    <!-- 内容部分 -->
    <div class="content-section">
      <div class="new-file-and-title">
        <div class="title-section">
          <h2>世界观一（若无则显示新建文件）</h2>
        </div>

        <div class="add-section">
          <button class="add-button">
            <span>+</span>
          </button>
        </div>
      </div>   
      <!-- 最近使用文件 -->
      <div 
        ref="recentFilesRef" 
        class="recent-files"
        :style="{ marginTop: `${recentFilesMarginTop}px` }"
      >
        <!-- 拖拽手柄 -->
        <div 
          ref="dragHandleRef" 
          class="drag-handle" 
          @mousedown="handleDragStart"
          :class="{ 'dragging': isDragging }"
        ></div>
        <h3>最近使用文件</h3>
      </div>
    </div>
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
  position: relative; /* 相对定位，使recent-files可以自由调整位置 */
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

/* 最近文件区域 */
.recent-files {
  position: relative;
  border-top: 1px solid #e0e0e0;
  padding-top: 10px;
  transition: margin-top 0.1s ease;
  
  h3 {
    margin: 0;
    font-weight: normal;
    font-size: 16px;
  }
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
    cursor: grabbing;
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