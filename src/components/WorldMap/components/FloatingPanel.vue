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
const viewState = ref(mapData.getViewState());
const editState = ref(mapData.getEditState());
const stats = ref({
  locations: mapData.getLocations().length,
  connections: mapData.getConnections().length,
  territories: mapData.getTerritories().length,
  labels: mapData.getLabels().length
});

// 鼠标位置的经纬度
const mousePosition = ref({ longitude: 0, latitude: 0 });

// 是否折叠面板
const isCollapsed = ref(false);

// 更新面板信息
function updateInfo() {
  viewState.value = mapData.getViewState();
  editState.value = mapData.getEditState();
  stats.value = {
    locations: mapData.getLocations().length,
    connections: mapData.getConnections().length,
    territories: mapData.getTerritories().length,
    labels: mapData.getLabels().length
  };
}

// 更新鼠标位置
function updateMousePosition(event: MouseEvent) {
  try {
    // 获取画布元素
    const canvas = document.querySelector('.world-map-canvas');
    if (!canvas) return;
    
    // 获取画布相对于视口的位置
    const rect = canvas.getBoundingClientRect();
    
    // 计算鼠标在画布上的相对位置
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    
    // 获取当前地图视图状态
    const viewState = mapData.getViewState();
    
    // 参考经纬度标注图层的计算方法
    const gridSize = 30; // 每格30像素
    const scaledGridSize = gridSize * viewState.scale;
    
    // 计算经纬度
    // 根据useLayers.ts中的逻辑，地图原点(0,0)对应的是地理坐标上的(经度0,纬度0)
    // 地图左上角对应经度-180，纬度-90
    
    // 计算鼠标位置对应的经纬度值
    // 原点经度坐标对应画布上的位置
    const originX = viewState.offsetX + 180 * scaledGridSize; // 经度0度
    const originY = viewState.offsetY + 90 * scaledGridSize;  // 纬度0度
    
    // 计算相对于原点的偏移量，转换为经纬度
    const longitude = (canvasX - originX) / scaledGridSize;
    const latitude = -(canvasY - originY) / scaledGridSize; // 注意纬度方向是反的
    
    // 格式化经纬度值
    mousePosition.value = {
      longitude: parseFloat(longitude.toFixed(2)),
      latitude: parseFloat(latitude.toFixed(2))
    };
    
  } catch (error) {
    console.error('计算经纬度时出错:', error);
  }
}

// 格式化经度
function formatLongitude(longitude: number): string {
  const abs = Math.abs(longitude);
  if (longitude >= 0) {
    return `${abs}°E`;
  } else {
    return `${abs}°W`;
  }
}

// 格式化纬度
function formatLatitude(latitude: number): string {
  const abs = Math.abs(latitude);
  if (latitude >= 0) {
    return `${abs}°N`;
  } else {
    return `${abs}°S`;
  }
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
  updateInfo();
  updateInterval = window.setInterval(updateInfo, 500);
  
  // 监听鼠标移动事件
  document.addEventListener('mousemove', updateMousePosition);
});

onBeforeUnmount(() => {
  clearInterval(updateInterval);
  
  // 移除鼠标移动事件监听
  document.removeEventListener('mousemove', updateMousePosition);
});
</script>

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
      <div class="status-info">
        <div class="status-item">
          <span class="label">经度:</span>
          <span>{{ formatLongitude(mousePosition.longitude) }}</span>
        </div>
        <div class="status-item">
          <span class="label">纬度:</span>
          <span>{{ formatLatitude(mousePosition.latitude) }}</span>
        </div>
        <div class="status-item">
          <span class="label">缩放:</span>
          <span>{{ viewState.scale.toFixed(2) }}</span>
        </div>
        <div class="status-item">
          <span class="label">模式:</span>
          <span>{{ editState.isEditing ? '编辑' : '查看' }}</span>
        </div>
      </div>
      
      <div class="data-stats">
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
    </div>
  </div>
</template>

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

.status-info {
  margin-bottom: 16px;
}

.status-item, .stats-item {
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