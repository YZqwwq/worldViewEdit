<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useMapCanvas } from '../composables/useMapCanvas';
import { useMapInteractions } from '../composables/useMapInteractions';
import { useMapData } from '../composables/useMapData';
import { useLayerTools, DrawToolType } from '../composables/useLayerTools';
import { Layer } from '../composables/useLayerFactory';
import { useWorldMapLayers } from '../composables/useWorldMapLayers';
import { LAYER_IDS } from '../composables/useMapCanvas';

// 获取地图数据
const mapData = useMapData();
console.log("mapData", mapData.getViewState().scale)

// 定义属性
const props = defineProps<{
  // 显示设置
  showCoordinates: boolean;
  showStatusPanel?: boolean;
  mapId?: string;
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'locationSelected', id: string): void;
  (e: 'viewStateChanged', viewState: any): void;
  (e: 'draw-complete'): void;
  (e: 'error', message: string): void;
  (e: 'draw-tool-changed', tool: DrawToolType): void;
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

// 使用增强的图层系统
const worldMapLayers = useWorldMapLayers({ 
  mapId: props.mapId || '1'
});

// 使用地图画布管理器
const {
  canvasWidth,
  canvasHeight,
  drawMap,
  initCanvas,
  handleResize,
  toggleLayer,
  layers,
  layerManager,
  LAYER_IDS: CANVAS_LAYER_IDS
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

// 引用地图图层
const mapLayerRef = computed<Layer | null>(() => {
  // 尝试从图层管理器获取图层
  return layerManager.getLayer(LAYER_IDS.MAP);
});

const {
  drawState,
  setCurrentTool,
  setLineWidth,
  setTerrainType,
  undo,
  redo,
  getTerrainColor,
  drawPen,
  drawEraser,
  updateDrawingCache,
  initDrawingEvents
} = useLayerTools(
  mapLayerRef,
  computed(() => viewState.value.offsetX),
  computed(() => viewState.value.offsetY),
  computed(() => viewState.value.scale),
  canvasContainerRef
);

// 监听绘图工具变化
watch(() => drawState.value.currentTool, (newTool) => {
  emit('draw-tool-changed', newTool);
});

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

// 当前工具模式计算属性
const isDrawingMode = computed(() => {
  return editState.value.currentTool === 'mapdraw';
});

// 处理绘图工具变化
function handleDrawToolChange(tool: DrawToolType) {
  setCurrentTool(tool);
}

// 处理线宽变化
function handleLineWidthChange(width: number) {
  setLineWidth(width);
}

// 处理地形类型变化
function handleTerrainChange(terrain: string) {
  setTerrainType(terrain);
}

// 确保在图层就绪后再初始化工具
watch(layers, (newLayers) => {
  console.log("图层集合变化", newLayers ? newLayers.size : 0);
  if (newLayers && newLayers.size > 0) {
    if (newLayers.has(LAYER_IDS.MAP)) {
      console.log("图层集合中找到地图图层");
    }
  }
}, { immediate: true, deep: true });

// 组件挂载时初始化
onMounted(async () => {
  console.log("WorldMapCanvas 组件挂载");
  window.addEventListener('keydown', handleKeyDown);
  
  // 初始化画布 - 这里会创建所有图层
  console.log("正在初始化画布...");
  initCanvas();
  
  console.log("正在调整大小...");
  handleResize();
  
  // 确保图层已经创建完成
  console.log("正在进行初始渲染...");
  drawMap();
  
  // 给予图层创建时间
  console.log("等待图层初始化完成...");
  setTimeout(() => {
    console.log("延迟检查mapLayer:", mapLayerRef.value);
    console.log("所有图层:", layers.value ? Array.from(layers.value.keys()) : "无图层");
    
    if (mapLayerRef.value) {
      console.log("mapLayer已就绪，可用于绘图");
      // 手动初始化绘图工具
      initDrawingEvents();
    } else {
      console.warn("mapLayer未就绪，可能影响绘图功能");
      
      // 尝试重新初始化
      console.log("尝试重新初始化画布...");
      initCanvas();
      handleResize();
      drawMap();
      
      // 再次检查
      setTimeout(() => {
        console.log("二次检查mapLayer:", mapLayerRef.value);
        if (mapLayerRef.value) {
          console.log("mapLayer在重新初始化后就绪");
          initDrawingEvents();
        } else {
          console.error("无法加载mapLayer，绘图功能将不可用");
        }
      }, 1000);
    }
  }, 500);
});

// 组件卸载时清理
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

// 暴露方法给父组件
defineExpose({
  drawMap,
  initCanvas,
  handleResize,
  handleDrawToolChange,
  handleLineWidthChange,
  handleTerrainChange,
  undo,
  redo,
  initDrawingEvents
});
</script>

<template>
  <div 
    class="world-map-canvas"
    ref="canvasContainerRef"
    @pointerdown="(event) => { handlePointerDown(event); event.stopPropagation(); }"
    @pointermove="(event) => { handlePointerMove(event); event.stopPropagation(); }"
    @pointerup="(event) => { handlePointerUp(event); event.stopPropagation(); }"
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
  cursor: crosshair; /* 使用十字光标指示可绘图 */
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