<template>
  <div 
    class="floating-panel"
    :style="{ 
      left: x + 'px', 
      top: y + 'px',
      width: (typeof width === 'number') ? width + 'px' : width,
      height: (typeof height === 'number') ? height + 'px' : height
    }"
  >
    <div class="panel-header" @mousedown="startDrag">
      <h3>{{ title }}</h3>
      <button class="collapse-btn" @click.stop="toggleCollapse">
        {{ isCollapsed ? '+' : '-' }}
      </button>
    </div>
    
    <div v-if="!isCollapsed" class="panel-content">
      <!-- 自定义内容插槽 -->
      <slot>
        <!-- 默认情况下显示数据统计 -->
        <div v-if="showStats" class="data-stats">
          <h4>数据统计</h4>
          <div class="stats-item">
            <span class="label">位置:</span>
            <span>{{ stats.locations }}</span>
          </div>
          <div class="stats-item">
            <span class="label">连接:</span>
            <span>{{ stats.connections }}</span>
          </div>
          <div class="stats-item">
            <span class="label">区域:</span>
            <span>{{ stats.territories }}</span>
          </div>
          <div class="stats-item">
            <span class="label">标签:</span>
            <span>{{ stats.labels }}</span>
          </div>
        </div>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useMapData } from '../composables/useMapData';

// 定义属性
const props = defineProps<{
  title: string;
  initialX?: number;
  initialY?: number;
  width?: number;
  height?: number;
  showStats?: boolean; // 控制是否显示统计信息
}>();

// 初始位置和尺寸
const x = ref(props.initialX || 20);
const y = ref(props.initialY || 20);
const width = ref(props.width || 220);
const height = ref(props.height || 'auto');

// 拖拽状态
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

// 地图数据
const mapData = useMapData();
const stats = ref({
  locations: mapData.getLocations().length,
  connections: mapData.getConnections().length,
  territories: mapData.getTerritories().length,
  labels: mapData.getLabels().length
});

// 是否折叠面板
const isCollapsed = ref(false);

// 更新面板信息
function updateInfo() {
  stats.value = {
    locations: mapData.getLocations().length,
    connections: mapData.getConnections().length,
    territories: mapData.getTerritories().length,
    labels: mapData.getLabels().length
  };
}

// 开始拖拽
function startDrag(event: MouseEvent) {
  isDragging.value = true;
  dragOffset.value = {
    x: event.clientX - x.value,
    y: event.clientY - y.value
  };
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);
  event.preventDefault();
}

// 处理拖拽
function handleDrag(event: MouseEvent) {
  if (!isDragging.value) return;
  
  x.value = event.clientX - dragOffset.value.x;
  y.value = event.clientY - dragOffset.value.y;
}

// 停止拖拽
function stopDrag() {
  isDragging.value = false;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
}

// 切换面板折叠状态
function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}

// 定时更新信息
let updateInterval: number;

onMounted(() => {
  // 只有在显示统计信息时才需要更新
  if (props.showStats) {
    updateInfo();
    updateInterval = window.setInterval(updateInfo, 500);
  }
});

onBeforeUnmount(() => {
  if (props.showStats && updateInterval) {
    clearInterval(updateInterval);
  }
});
</script>

<style lang="scss" scoped>
.floating-panel {
  position: absolute;
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 6px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  z-index: 100;
  overflow: hidden;
  min-width: 180px;
  user-select: none;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #f0f0f0;
  border-bottom: 1px solid #ddd;
  cursor: move;
  
  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }
}

.collapse-btn {
  background: none;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 16px;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }
}

.panel-content {
  padding: 12px;
}

.stats-item {
  display: flex;
  margin-bottom: 6px;
  font-size: 13px;
}

.label {
  width: 50px;
  color: #666;
}

.data-stats h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #666;
}

:deep(.dark-mode) .floating-panel {
  background-color: rgba(30, 30, 30, 0.95);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

:deep(.dark-mode) .panel-header {
  background-color: #333;
  border-color: #444;
  
  h3 {
    color: #eee;
  }
}

:deep(.dark-mode) .collapse-btn {
  color: #eee;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
}

:deep(.dark-mode) .label {
  color: #aaa;
}

:deep(.dark-mode) .data-stats h4 {
  color: #ccc;
}
</style>