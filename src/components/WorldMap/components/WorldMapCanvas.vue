<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useMapCanvas, LAYER_IDS } from '../composables/useMapCanvas';
import { useMapInteractions } from '../composables/useMapInteractions';
import type { WorldMapData } from '../../../types/map';

// 定义属性
const props = defineProps<{
  // 地图状态
  offsetX: number;
  offsetY: number;
  scale: number;
  // 主题
  isDarkMode: boolean;
  // 地图数据
  mapData: WorldMapData;
  // 交互状态
  currentLocationId: string;
  isDrawingConnection: boolean;
  connectionStartId: string;
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  // 编辑状态
  isEditing: boolean;
  activeTool: string;
  // 位置详情
  locationNameInput: string;
  locationDescInput: string;
  // 坐标显示
  showCoordinates: boolean;
  mouseX: number;
  mouseY: number;
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'update:offsetX', value: number): void;
  (e: 'update:offsetY', value: number): void;
  (e: 'update:scale', value: number): void;
  (e: 'update:currentLocationId', value: string): void;
  (e: 'update:isDrawingConnection', value: boolean): void;
  (e: 'update:connectionStartId', value: string): void;
  (e: 'update:isDragging', value: boolean): void;
  (e: 'update:dragStartX', value: number): void;
  (e: 'update:dragStartY', value: number): void;
  (e: 'update:locationNameInput', value: string): void;
  (e: 'update:locationDescInput', value: string): void;
  (e: 'update:mouseX', value: number): void;
  (e: 'update:mouseY', value: number): void;
  (e: 'update:activeTool', value: string): void;
}>();

// 创建响应式引用，用于双向绑定
const offsetXRef = computed({
  get: () => props.offsetX,
  set: (value) => emit('update:offsetX', value)
});

const offsetYRef = computed({
  get: () => props.offsetY,
  set: (value) => emit('update:offsetY', value)
});

const scaleRef = computed({
  get: () => props.scale,
  set: (value) => emit('update:scale', value)
});

const currentLocationIdRef = computed({
  get: () => props.currentLocationId,
  set: (value) => emit('update:currentLocationId', value)
});

const isDrawingConnectionRef = computed({
  get: () => props.isDrawingConnection,
  set: (value) => emit('update:isDrawingConnection', value)
});

const connectionStartIdRef = computed({
  get: () => props.connectionStartId,
  set: (value) => emit('update:connectionStartId', value)
});

const isDraggingRef = computed({
  get: () => props.isDragging,
  set: (value) => emit('update:isDragging', value)
});

const dragStartXRef = computed({
  get: () => props.dragStartX,
  set: (value) => emit('update:dragStartX', value)
});

const dragStartYRef = computed({
  get: () => props.dragStartY,
  set: (value) => emit('update:dragStartY', value)
});

const locationNameInputRef = computed({
  get: () => props.locationNameInput,
  set: (value) => emit('update:locationNameInput', value)
});

const locationDescInputRef = computed({
  get: () => props.locationDescInput,
  set: (value) => emit('update:locationDescInput', value)
});

const mouseXRef = computed({
  get: () => props.mouseX,
  set: (value) => emit('update:mouseX', value)
});

const mouseYRef = computed({
  get: () => props.mouseY,
  set: (value) => emit('update:mouseY', value)
});

const activeToolRef = computed({
  get: () => props.activeTool,
  set: (value) => emit('update:activeTool', value)
});

// 地图数据处理
const mapDataRef = ref(props.mapData);

// 监听props变化更新数据
watch(() => props.mapData, (newValue) => {
  mapDataRef.value = newValue;
}, { deep: true });

// 创建 canvasContainerRef
const canvasContainerRef = ref<HTMLElement | null>(null);

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
  computed(() => props.isDarkMode),
  offsetXRef,
  offsetYRef,
  scaleRef,
  mapDataRef,
  currentLocationIdRef,
  canvasContainerRef
);

// 使用地图交互
const {
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleClick,
  handleKeyDown,
  handleWheel,
  handleToggleLayer,
  hoveredLocationId
} = useMapInteractions(
  canvasContainerRef,
  mapDataRef,
  isDraggingRef,
  dragStartXRef,
  dragStartYRef,
  offsetXRef,
  offsetYRef,
  scaleRef,
  isDrawingConnectionRef,
  connectionStartIdRef,
  currentLocationIdRef,
  locationNameInputRef,
  locationDescInputRef,
  computed(() => props.isEditing),
  activeToolRef,
  mouseXRef,
  mouseYRef,
  drawMap,
  layers,
  toggleLayer
);

// 图层控制
const layerVisibility = ref({
  [LAYER_IDS.BACKGROUND]: true,
  [LAYER_IDS.MAP]: true,
  [LAYER_IDS.TERRITORY]: true,
  [LAYER_IDS.GRID]: true,
  [LAYER_IDS.CONNECTION]: true,
  [LAYER_IDS.LOCATION]: true,
  [LAYER_IDS.LABEL]: true,
  [LAYER_IDS.COORDINATE]: true
});

// 切换图层可见性
function toggleLayerVisibility(layerId: string) {
  layerVisibility.value[layerId] = !layerVisibility.value[layerId];
  toggleLayer(layerId, layerVisibility.value[layerId]);
}

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
</script>

<template>
  <div 
    ref="canvasContainerRef" 
    class="map-canvas-container"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @click="handleClick"
    @wheel="handleWheel"
  >
    <!-- 图层控制面板 -->
    <div class="layer-control" v-if="showCoordinates">
      <div class="layer-control-title">图层控制</div>
      <div class="layer-control-items">
        <div 
          v-for="[id, layer] in Array.from(layers.entries())" 
          :key="id" 
          class="layer-control-item"
          :class="{ 'active': layerVisibility[id] }"
          @click="toggleLayerVisibility(id)"
        >
          <div class="layer-checkbox">
            <i class="fas" :class="layerVisibility[id] ? 'fa-check-square' : 'fa-square'"></i>
          </div>
          <div class="layer-name">{{ layer.name }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.map-canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  
  .layer-control {
    position: absolute;
    top: 10px;
    left: 10px;
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 4px;
    padding: 8px;
    z-index: 1000;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    
    &.dark-mode {
      background-color: rgba(50, 50, 50, 0.8);
      color: white;
    }
    
    .layer-control-title {
      font-weight: bold;
      margin-bottom: 6px;
      font-size: 14px;
    }
    
    .layer-control-items {
      display: flex;
      flex-direction: column;
      gap: 4px;
      
      .layer-control-item {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        padding: 4px;
        border-radius: 3px;
        
        &:hover {
          background-color: rgba(0, 0, 0, 0.1);
        }
        
        &.active {
          color: var(--accent-primary);
        }
        
        .layer-checkbox {
          width: 16px;
          text-align: center;
        }
        
        .layer-name {
          font-size: 12px;
        }
      }
    }
  }
}

:root {
  --accent-primary: #1976d2;
}

.dark-mode {
  .layer-control {
    background-color: rgba(50, 50, 50, 0.8);
    color: white;
    
    .layer-control-item {
      &:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
    }
  }
}
</style> 