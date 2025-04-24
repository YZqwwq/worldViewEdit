<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue';
import type { Ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMapStore } from '../stores/mapStore';
import { useWorldStore } from '../stores/worldStore';
import type { WorldData } from '../electron';

// 导入 WorldMap 组件相关功能
import { 
  useMapCanvas, 
  useMapState, 
  useMapTools, 
  useMapInteractions, 
  useMapData,
  LAYER_IDS
} from '../components/WorldMap';

// 组件状态
const isLoading = ref(true);
const error = ref<string | null>(null);
const isMapInitialized = ref(false);

// 路由和状态管理
const router = useRouter();
const mapStore = useMapStore();
const worldStore = useWorldStore();

// 事件
const emit = defineEmits<{
  (e: 'update:worldData', data: WorldData): void;
  (e: 'save'): void;
}>();

// 地图画布容器引用
const canvasContainerRef = ref<HTMLElement | null>(null);

// 地图状态管理
const { 
  isEditing,
  isDarkMode,
  activeTool,
  isDrawingConnection,
  connectionStartId,
  offsetX,
  offsetY,
  scale,
  minScale,
  maxScale,
  mouseX,
  mouseY,
  showCoordinates,
  isDragging,
  dragStartX,
  dragStartY,
  setActiveTool,
  toggleCoordinates,
  toggleDarkMode
} = useMapState(mapStore);

// 地图数据管理
const { 
  mapData, 
  currentLocationId, 
  loadMapData, 
  saveLocationDetails, 
  currentLocation,
  locationNameInput,
  locationDescInput,
  formatLongitude,
  formatLatitude
} = useMapData(mapStore, worldStore.worldData as WorldData | undefined);

// 地图画布管理 - 包含 7 个图层
const {
  canvasWidth,
  canvasHeight,
  drawMap,
  initCanvas,
  handleResize,
  toggleLayer,
  getLayerVisibility,
  layers,
  LAYER_IDS: CANVAS_LAYER_IDS
} = useMapCanvas(
  isDarkMode,
  offsetX,
  offsetY,
  scale,
  mapData,
  currentLocationId,
  canvasContainerRef
);

// 地图工具管理
const { resetView, fitWorldView } = useMapTools(
  canvasContainerRef as unknown as Ref<HTMLCanvasElement | null>, 
  offsetX, 
  offsetY, 
  scale, 
  drawMap, 
  minScale.value, 
  maxScale.value
);

// 计算当前坐标
const currentLocationCoordinates = ref({ longitude: 0, latitude: 0 });
const formattedLongitude = ref('');
const formattedLatitude = ref('');

// 更新当前位置坐标
watch(currentLocation, (newLocation) => {
  if (newLocation) {
    const GRID_SIZE = 30;
    const longitude = Math.floor(newLocation.position.x / GRID_SIZE);
    const latitude = 90 - Math.floor(newLocation.position.y / GRID_SIZE);
    currentLocationCoordinates.value = { longitude, latitude };
    formattedLongitude.value = formatLongitude(longitude);
    formattedLatitude.value = formatLatitude(latitude);
  }
}, { immediate: true });

// 交互处理函数
let handleMouseDown = (e: MouseEvent) => {};
let handleMouseMove = (e: MouseEvent) => {};
let handleMouseUp = (e: MouseEvent) => {};
let handleClick = (e: MouseEvent) => {};
let handleKeyDown = (e: KeyboardEvent) => {};
let handleWheel = (e: WheelEvent) => {};

// 图层可见性控制
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
  if (!isMapInitialized.value) {
    console.warn('地图尚未初始化，无法切换图层');
    return;
  }
  
  try {
    toggleLayer(layerId);
    layerVisibility.value[layerId] = !layerVisibility.value[layerId];
  } catch (e) {
    console.error('切换图层可见性失败:', e);
  }
}

// 初始化地图数据
const initMapData = async () => {
  try {
    console.log('开始初始化地图数据');
    isLoading.value = true; // 设置加载状态，但不会影响DOM渲染
    
    // 检查容器是否存在
    if (!canvasContainerRef.value) {
      console.error('地图容器元素未找到，无法初始化');
      error.value = '无法找到地图容器元素';
      isLoading.value = false;
      return;
    }
    
    // 创建初始化进度日志
    console.log('找到容器元素，大小:', canvasContainerRef.value.getBoundingClientRect());
    
    // 防止容器尺寸为0的情况
    const rect = canvasContainerRef.value.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn('容器尺寸为0，等待DOM完全渲染');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 初始化前确保mapData已加载
    if (!mapData.value || !mapData.value.locations) {
      console.log('初始化mapData为空，使用默认数据');
      mapData.value = {
        name: '新地图',
        description: '',
        locations: [],
        connections: []
      };
    }
    
    // 初始化地图交互
    try {
      console.log('初始化地图交互');
      const interactions = useMapInteractions(
        canvasContainerRef,
        mapData,
        isDragging,
        dragStartX,
        dragStartY,
        offsetX,
        offsetY,
        scale,
        isDrawingConnection,
        connectionStartId,
        currentLocationId,
        locationNameInput,
        locationDescInput,
        isEditing,
        activeTool,
        mouseX,
        mouseY,
        drawMap,
        layers,
        toggleLayer
      );
      
      // 设置交互处理函数
      handleMouseDown = interactions.handleMouseDown;
      handleMouseMove = interactions.handleMouseMove;
      handleMouseUp = interactions.handleMouseUp;
      handleClick = interactions.handleClick;
      handleKeyDown = interactions.handleKeyDown;
      handleWheel = interactions.handleWheel;
      
      console.log('交互处理函数设置成功');
    } catch (e) {
      console.error('初始化地图交互失败:', e);
      throw e;
    }
    
    // 初始化画布
    try {
      console.log('初始化画布');
      initCanvas();
      console.log('画布初始化成功');
    } catch (e) {
      console.error('初始化画布失败:', e);
      throw e;
    }
    
    // 调整大小
    try {
      console.log('调整画布大小');
      handleResize();
      console.log('画布大小调整成功');
    } catch (e) {
      console.error('调整画布大小失败:', e);
      throw e;
    }
    
    // 适应视图
    try {
      console.log('适应视图');
      fitWorldView();
      console.log('视图适应成功');
    } catch (e) {
      console.error('适应视图失败:', e);
      throw e;
    }
    
    // 初始化图层可见性状态
    try {
      console.log('初始化图层可见性状态');
      Object.keys(LAYER_IDS).forEach((key) => {
        const layerId = LAYER_IDS[key as keyof typeof LAYER_IDS];
        const isVisible = getLayerVisibility(layerId);
        layerVisibility.value[layerId] = isVisible;
        console.log(`图层 ${layerId} 初始可见性:`, isVisible);
      });
      console.log('图层可见性状态初始化成功');
    } catch (e) {
      console.error('初始化图层可见性状态失败:', e);
      // 不抛出错误，继续初始化
    }
    
    isLoading.value = false;
    isMapInitialized.value = true;
    console.log('地图初始化成功');
  } catch (e: any) {
    console.error('地图初始化失败:', e);
    isLoading.value = false;
    isMapInitialized.value = false;
    error.value = '初始化地图失败：' + (e instanceof Error ? e.message : String(e));
  }
};

// 返回工具页面
function goBack() {
  const currentId = router.currentRoute.value.query.id;
  router.push({
    path: '/tool',
    query: currentId ? { id: currentId } : {}
  });
}

// 保存地图状态
function saveMapState() {
  mapStore.updateViewState({
    offsetX: offsetX.value,
    offsetY: offsetY.value,
    scale: scale.value
  });
  worldStore.saveWorldData();
}

// 监听数据变化自动绘制
watch(() => mapData.value, () => {
  if (canvasContainerRef.value && isMapInitialized.value) {
    drawMap();
  }
}, { deep: true });

// 监听暗模式变化重绘
watch(() => isDarkMode.value, () => {
  if (isMapInitialized.value) {
    drawMap();
  }
});

// 组件挂载
onMounted(async () => {
  try {
    console.log('组件挂载中...');
    error.value = null; // 清除可能的错误状态
    
    // 监听快捷键
    window.addEventListener('keydown', handleKeyDown);
    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);
    
    // 确保DOM渲染完成
    await nextTick();
    console.log('DOM首次渲染完成');
    
    // 检查世界ID是否存在
    if (!worldStore.$state.id) {
      console.error('未找到世界ID');
      error.value = '未找到世界ID';
      return;
    }
    
    console.log('世界ID:', worldStore.$state.id);
    
    // 等待DOM完全渲染并获取容器引用 - 增加延迟时间确保DOM完全渲染
    setTimeout(() => {
      try {
        // 检查容器是否可用
        console.log('检查容器可用性:', canvasContainerRef.value ? '可用' : '不可用');
        
        if (!canvasContainerRef.value) {
          console.warn('无法通过ref获取容器，尝试通过ID获取');
          const container = document.getElementById('map-canvas-container');
          if (container) {
            console.log('通过ID找到容器');
            canvasContainerRef.value = container;
          } else {
            console.error('无法找到地图容器元素');
            error.value = '无法找到地图容器元素';
            return;
          }
        }
        
        // 准备初始化地图
        console.log('开始初始化地图');
        initMapData();
      } catch (e) {
        console.error('初始化过程中出错:', e);
        error.value = '初始化过程中出错: ' + (e instanceof Error ? e.message : String(e));
      }
    }, 300); // 增加延迟时间
  } catch (e) {
    console.error('组件挂载失败:', e);
    error.value = '初始化失败：' + (e instanceof Error ? e.message : String(e));
  }
});

// 组件卸载前清理
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <div class="world-map-container" :class="{ 'dark-mode': isDarkMode }">
    <!-- 错误显示 -->
    <div v-if="error" class="error">
      <span>{{ error }}</span>
    </div>
    
    <!-- 地图内容 -->
    <div v-else class="map-content">
      <!-- 工具栏 -->
      <div class="map-toolbar">
        <div class="tool-group">
          <button class="tool-btn back-btn" @click="goBack" title="返回">
            <i class="fas fa-arrow-left"></i>
          </button>
          <button 
            :class="['tool-btn', { active: activeTool === 'draw' }]" 
            @click="setActiveTool('draw')"
            title="绘制工具"
          >
            <i class="fas fa-mouse-pointer"></i>
          </button>
          <button 
            :class="['tool-btn', { active: activeTool === 'location' }]" 
            @click="setActiveTool('location')"
            title="添加位置"
          >
            <i class="fas fa-plus"></i>
          </button>
          <button 
            :class="['tool-btn', { active: activeTool === 'connection' }]" 
            @click="setActiveTool('connection')"
            title="连接位置"
          >
            <i class="fas fa-project-diagram"></i>
          </button>
          <button 
            :class="['tool-btn', { active: activeTool === 'territory' }]" 
            @click="setActiveTool('territory')"
            title="删除位置"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
        
        <!-- 图层控制 -->
        <div class="layer-controls" :class="{ 'disabled': !isMapInitialized }">
          <div class="layer-control-title">图层</div>
          <div class="layer-buttons">
            <button 
              :class="['layer-btn', { 
                active: layerVisibility[LAYER_IDS.GRID], 
                'disabled': !isMapInitialized 
              }]" 
              @click="isMapInitialized && toggleLayerVisibility(LAYER_IDS.GRID)"
              title="网格图层"
            >
              <i class="fas fa-th"></i>
            </button>
            <button 
              :class="['layer-btn', { 
                active: layerVisibility[LAYER_IDS.TERRITORY], 
                'disabled': !isMapInitialized 
              }]" 
              @click="isMapInitialized && toggleLayerVisibility(LAYER_IDS.TERRITORY)"
              title="地域图层"
            >
              <i class="fas fa-draw-polygon"></i>
            </button>
            <button 
              :class="['layer-btn', { 
                active: layerVisibility[LAYER_IDS.CONNECTION], 
                'disabled': !isMapInitialized 
              }]" 
              @click="isMapInitialized && toggleLayerVisibility(LAYER_IDS.CONNECTION)"
              title="连线图层"
            >
              <i class="fas fa-project-diagram"></i>
            </button>
            <button 
              :class="['layer-btn', { 
                active: layerVisibility[LAYER_IDS.LABEL], 
                'disabled': !isMapInitialized 
              }]" 
              @click="isMapInitialized && toggleLayerVisibility(LAYER_IDS.LABEL)"
              title="标签图层"
            >
              <i class="fas fa-tag"></i>
            </button>
            <button 
              :class="['layer-btn', { 
                active: layerVisibility[LAYER_IDS.COORDINATE], 
                'disabled': !isMapInitialized 
              }]" 
              @click="isMapInitialized && toggleLayerVisibility(LAYER_IDS.COORDINATE)"
              title="坐标图层"
            >
              <i class="fas fa-compass"></i>
            </button>
          </div>
        </div>
        
        <div class="coordinate-display" v-if="showCoordinates">
          <div class="coordinate-label">
            {{ 
              // 计算经度：将屏幕坐标转换为地图坐标
              (() => {
                const gridSize = 30;
                const mapX = Math.floor((mouseX - offsetX) / (scale * gridSize));
                const longitude = mapX - 180;
                // 确保经度在 -180 到 180 度之间
                const clampedLon = Math.max(-180, Math.min(180, longitude));
                return clampedLon >= 0 ? `${clampedLon}°E` : `${Math.abs(clampedLon)}°W`;
              })()
            }}
          </div>
          <div class="coordinate-label">
            {{ 
              // 计算纬度：将屏幕坐标转换为地图坐标
              (() => {
                const gridSize = 30;
                const mapY = Math.floor((mouseY - offsetY) / (scale * gridSize));
                const latitude = 90 - mapY;
                // 确保纬度在 -90 到 90 度之间
                const clampedLat = Math.max(-90, Math.min(90, latitude));
                return clampedLat >= 0 ? `${clampedLat}°N` : `${Math.abs(clampedLat)}°S`;
              })()
            }}
          </div>
          <div class="coordinate-label">缩放: {{ Math.round(scale * 100)}}%</div>
          <button class="coord-toggle" @click="toggleCoordinates" title="隐藏坐标">
            <i class="fas fa-eye-slash"></i>
          </button>
        </div>
        
        <div v-else class="coordinate-toggle-container">
          <button class="coord-toggle" @click="toggleCoordinates" title="显示坐标">
            <i class="fas fa-eye"></i>
          </button>
        </div>
        
        <div class="tool-group">
          <button 
            class="tool-btn theme-toggle" 
            @click="toggleDarkMode" 
            :title="isDarkMode ? '切换到亮色模式' : '切换到暗色模式'"
          >
            <i :class="['fas', isDarkMode ? 'fa-sun' : 'fa-moon']"></i>
          </button>
          <button class="tool-btn" @click="resetView" title="重置视图">
            <i class="fas fa-sync"></i>
          </button>
          <button class="tool-btn" @click="fitWorldView" title="查看完整世界地图">
            <i class="fas fa-globe"></i>
          </button>
          <button class="tool-btn" @click="saveMapState" title="保存地图">
            <i class="fas fa-save"></i>
          </button>
        </div>
      </div>
      
      <!-- 地图容器 - 直接显示，不受isLoading控制 -->
      <div 
        ref="canvasContainerRef" 
        id="map-canvas-container" 
        class="map-canvas"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @click="handleClick"
        @wheel="handleWheel"
      >
        <!-- 加载指示器 - 放在地图容器内部 -->
        <div v-if="isLoading" class="loading-overlay">
          <div class="spinner"></div>
          <span>初始化地图中...</span>
        </div>
      </div>
      
      <!-- 位置编辑器 -->
      <div v-if="currentLocationId && activeTool === 'draw'" class="location-editor">
        <div class="editor-header">
          <h3>位置详情</h3>
          <button class="close-btn" @click="currentLocationId = ''" title="关闭">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="editor-content">
          <div class="form-group">
            <label>名称</label>
            <input type="text" v-model="locationNameInput" />
          </div>
          
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="locationDescInput" rows="4"></textarea>
          </div>
          
          <div class="form-group">
            <label>坐标</label>
            <div class="coord-inputs">
              <div class="coord-input">
                <span>经度:</span>
                <span>{{ formattedLongitude }}</span>
              </div>
              <div class="coord-input">
                <span>纬度:</span>
                <span>{{ formattedLatitude }}</span>
              </div>
            </div>
          </div>
          
          <button class="save-btn" @click="saveLocationDetails">保存</button>
        </div>
      </div>
      
      <!-- 图层说明 -->
      <div class="layer-info">
        <div class="layer-info-content">
          <p>图层结构:</p>
          <ol>
            <li>底部图层 - 灰色背景</li>
            <li>矩形图层 - 大体地图地形</li>
            <li>地域交互层 - 势力范围</li>
            <li>网格图层 - 经纬度网格</li>
            <li>连线层 - 势力间连线</li>
            <li>标签层 - 地点描述</li>
            <li>经纬度注释层 - 坐标显示</li>
          </ol>
        </div>
      </div>
      
      <!-- 缩放信息 -->
      <div class="map-scale-info" :class="{ 'dark-mode': isDarkMode }">
        <div class="scale-label">
          <span>缩放: {{ Math.round(scale * 100) }}%</span>
          <span class="scale-tip" v-if="scale < 0.2">每格 30°</span>
          <span class="scale-tip" v-else-if="scale < 0.4">每格 10°</span>
          <span class="scale-tip" v-else-if="scale < 0.8">每格 5°</span>
          <span class="scale-tip" v-else-if="scale < 1.2">每格 2°</span>
          <span class="scale-tip" v-else>每格 1°</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #e8e8e8;
  --bg-hover: #eeeeee;
  --text-primary: #333333;
  --text-secondary: #666666;
  --border-color: #dddddd;
  --accent-primary: #1976d2;
  --accent-secondary: #1565c0;
  --accent-tertiary: #64b5f6;
  --error: #f44336;
  --error-dark: #d32f2f;
}

.dark-mode {
  --bg-primary: #000000;
  --bg-secondary: #222222;
  --bg-tertiary: #333333;
  --bg-hover: #444444;
  --text-primary: #ffffff;
  --text-secondary: #aaaaaa;
  --border-color: #444444;
  --accent-primary: #0066cc;
  --accent-secondary: #0055aa;
  --accent-tertiary: #3388cc;
}
</style>

<style scoped>
.world-map-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-primary);
  overflow: hidden;
}

.map-toolbar {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  height: 56px;
  box-sizing: border-box;
}

.tool-group {
  display: flex;
  gap: 5px;
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-color);
  background-color: var(--bg-tertiary);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-primary);
  transition: all 0.2s;
}

.tool-btn:hover {
  background-color: var(--bg-hover);
}

.tool-btn.active {
  background-color: var(--accent-primary);
  color: white;
  border-color: var(--accent-primary);
}

.tool-btn.back-btn {
  background-color: var(--error);
  color: white;
  border-color: var(--error);
}

.tool-btn.back-btn:hover {
  background-color: var(--error-dark);
}

/* 图层控制样式 */
.layer-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--bg-tertiary);
  padding: 0 12px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.layer-controls.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.layer-control-title {
  font-size: 12px;
  font-weight: bold;
  color: var(--text-secondary);
}

.layer-buttons {
  display: flex;
  gap: 5px;
}

.layer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background-color: transparent;
  border-radius: 3px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.layer-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.layer-btn.active {
  color: var(--accent-primary);
  background-color: var(--bg-hover);
}

.layer-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.coordinate-display {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: var(--text-secondary);
  background-color: var(--bg-tertiary);
  padding: 0 10px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.coordinate-label {
  font-family: monospace;
  font-weight: bold;
}

.coord-toggle {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.coord-toggle:hover {
  color: var(--accent-primary);
}

.map-content {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.map-canvas {
  flex: 1;
  min-height: 300px;
  background-color: var(--bg-primary);
  position: relative;
  width: 100%;
  height: calc(100% - 56px);
  overflow: hidden;
  border: 1px solid var(--border-color);
  margin-top: 5px;
  display: flex;
}

.dark-mode .map-canvas {
  background-color: #000000;
}

.map-scale-info {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background-color: rgba(255, 255, 255, 0.7);
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 0.8rem;
  color: var(--text-primary);
}

.dark-mode .map-scale-info {
  background-color: rgba(34, 34, 34, 0.7);
  color: #ffffff;
}

.scale-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: monospace;
}

.scale-tip {
  font-style: italic;
  opacity: 0.8;
}

/* 图层信息显示 */
.layer-info {
  position: absolute;
  bottom: 10px;
  left: 10px;
  opacity: 0.3;
  transition: opacity 0.3s;
}

.layer-info:hover {
  opacity: 1;
}

.layer-info-content {
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 0.8rem;
  color: var(--text-primary);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.dark-mode .layer-info-content {
  background-color: rgba(50, 50, 50, 0.8);
  color: var(--text-primary);
}

.layer-info-content p {
  margin: 0 0 5px 0;
  font-weight: bold;
}

.layer-info-content ol {
  margin: 0;
  padding-left: 20px;
}

.location-editor {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 250px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
}

.editor-header h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-primary);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
}

.close-btn:hover {
  color: var(--text-primary);
}

.editor-content {
  padding: 15px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.form-group input, .form-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.form-group input:focus, .form-group textarea:focus {
  border-color: var(--accent-primary);
  outline: none;
}

.coord-inputs {
  display: flex;
  gap: 15px;
}

.coord-input {
  display: flex;
  align-items: center;
  gap: 5px;
}

.coord-input span:first-child {
  font-weight: bold;
  color: var(--text-secondary);
}

.coord-input span:last-child {
  font-family: monospace;
  background-color: var(--bg-tertiary);
  padding: 4px 8px;
  border-radius: 4px;
  min-width: 30px;
  text-align: center;
}

.save-btn {
  display: block;
  width: 100%;
  padding: 8px;
  background-color: var(--accent-primary);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn:hover {
  background-color: var(--accent-secondary);
}

.loading, .error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.2em;
  color: var(--text-primary);
}

.error {
  color: var(--error);
}

/* 加载动画样式 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  z-index: 1000;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
