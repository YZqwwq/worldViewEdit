<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useMapCanvas, LAYER_IDS } from '../composables/useMapCanvas';
import { useMapInteractions } from '../composables/useMapInteractions';
import { useMapData } from '../composables/useMapData';

// 获取地图数据
const mapData = useMapData();

// 定义属性
const props = defineProps<{
  // 显示设置
  showCoordinates: boolean;
  showStatusPanel?: boolean;
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'locationSelected', id: string): void;
  (e: 'viewStateChanged', viewState: any): void;
  (e: 'draw-complete'): void;
  (e: 'error', message: string): void;
}>();

// 创建响应式状态
const currentLocationId = ref<string>('');
const isDrawingConnection = ref<boolean>(false);
const connectionStartId = ref<string>('');
const isDragging = ref<boolean>(false);
const dragStartX = ref<number>(0);
const dragStartY = ref<number>(0);
const mouseX = ref<number>(0);
const mouseY = ref<number>(0);
const locationNameInput = ref<string>('');
const locationDescInput = ref<string>('');

// 同步位置详情到 mapData
watch([currentLocationId, locationNameInput, locationDescInput], () => {
  mapData.currentLocationId.value = currentLocationId.value;
  mapData.locationNameInput.value = locationNameInput.value;
  mapData.locationDescInput.value = locationDescInput.value;
});

// 监听位置选择变化，通知父组件
watch(currentLocationId, (newId) => {
  emit('locationSelected', newId);
  
  // 如果选择了新位置，获取其详情
  if (newId) {
    const location = mapData.getLocation(newId);
    if (location) {
      locationNameInput.value = location.name || '';
      locationDescInput.value = location.description || '';
    }
  }
});

// 获取视图状态
const viewState = computed(() => mapData.getViewState());
const editState = computed(() => mapData.getEditState());

// 监听视图状态变化，通知父组件
watch(viewState, (newState) => {
  emit('viewStateChanged', newState);
}, { deep: true });

// 创建 canvasContainerRef
const canvasContainerRef = ref<HTMLElement | null>(null);

// 地图数据对象
const mapDataObject = computed(() => {
  // 确保所有获取的数据都经过空值检查
  const locations = mapData.getLocations() || [];
  const connections = mapData.getConnections() || [];
  const territories = mapData.getTerritories() || [];
  const labels = mapData.getLabels() || [];
  
  return {
    metadata: mapData.getMetadata() || {},
    // 使用filter确保只有有效的项目才会被添加到Map中
    locations: new Map(locations.filter(loc => loc && loc.id).map(loc => [loc.id, loc])),
    connections: new Map(connections.filter(conn => conn && conn.id).map(conn => [conn.id, conn])),
    territories: new Map(territories.filter(terr => terr && terr.id).map(terr => [terr.id, terr])),
    labels: new Map(labels.filter(label => label && label.id).map(label => [label.id, label])),
    viewState: viewState.value || {},
    editState: editState.value || {}
  };
});

// 使用地图画布管理器
const {
  canvasWidth,
  canvasHeight,
  drawMap,
  initCanvas,
  handleResize,
  toggleLayer,
  layers
} = useMapCanvas(
  computed(() => viewState.value.isDarkMode),
  computed(() => viewState.value.offsetX),
  computed(() => viewState.value.offsetY),
  computed(() => viewState.value.scale),
  mapDataObject,
  currentLocationId,
  canvasContainerRef
);

// 使用地图交互
const {
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleKeyDown,
  handleWheel,
  handleToggleLayer,
  hoveredLocationId,
  drawActiveConnection
} = useMapInteractions(
  canvasContainerRef,
  isDragging,
  dragStartX,
  dragStartY,
  isDrawingConnection,
  connectionStartId,
  currentLocationId,
  locationNameInput,
  locationDescInput,
  computed(() => editState.value.isEditing),
  mouseX,
  mouseY,
  drawMap,
  layers,
  toggleLayer
);

// 保存位置详情方法
function saveLocationDetails() {
  if (!currentLocationId.value) return;
  
  // 使用 mapData 的方法保存位置详情
  mapData.saveLocationDetails();
}

// 图层控制
const layerVisibility = computed(() => mapData.layerVisibility);

// 切换图层可见性
function toggleLayerVisibility(layerId: string) {
  mapData.toggleLayerVisibility(layerId);
  toggleLayer(layerId, mapData.getLayerVisibility(layerId));
}

// 鼠标坐标
const coordinates = ref({ x: 0, y: 0 });

// 组件挂载时初始化
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  initCanvas();
  handleResize();
  
  // 初始渲染
  drawMap();
});

// 组件卸载时清理
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

// 暴露方法给父组件
defineExpose({
  drawMap,
  initCanvas,
  handleResize
});
</script>

<template>
  <div 
    class="world-map-canvas"
    ref="canvasContainerRef"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @wheel="handleWheel"
  >
    <canvas class="main-canvas"></canvas>
    
    <!-- 坐标显示 -->
    <div v-if="showCoordinates" class="coordinates-display">
      {{ coordinates.x }}, {{ coordinates.y }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.world-map-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #f5f5f5;
}

.main-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.coordinates-display {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background-color: rgba(255, 255, 255, 0.7);
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
  pointer-events: none;
}

:deep(.dark-mode) .world-map-canvas {
  background-color: #1a1a1a;
}

:deep(.dark-mode) .coordinates-display {
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
}
</style> 