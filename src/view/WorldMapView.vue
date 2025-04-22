<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue';
import type { WorldData } from '../electron';
import { useMapCanvas } from '../components/WorldMap/composables/useMapCanvas';
import { useMapState } from '../components/WorldMap/composables/useMapState';
import { useMapTools } from '../components/WorldMap/composables/useMapTools';
import { useMapInteractions } from '../components/WorldMap/composables/useMapInteractions';
import { useMapData } from '../components/WorldMap/composables/useMapData';
import { useRouter } from 'vue-router';
import { useMapStore } from '../stores/mapStore';
import { useWorldStore } from '../stores/worldStore';

const router = useRouter();
const mapStore = useMapStore();
const worldStore = useWorldStore();

// 定义事件
const emit = defineEmits<{
  (e: 'update:worldData', data: WorldData): void;
  (e: 'save'): void;
}>();

// 地图网格大小常量
const GRID_SIZE = 30;

// 引入地图状态管理
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
  toggleDarkMode,
} = useMapState(mapStore);

// 引入地图状态和数据管理
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
} = useMapData(mapStore);

// 引入画布相关
const {
  canvasRef,
  ctxRef,
  canvasWidth,
  canvasHeight,
  drawMap,
  initCanvas,
  handleResize
} = useMapCanvas(
  isDarkMode,
  offsetX,
  offsetY,
  scale,
  mapData,
  currentLocationId,
  isDrawingConnection,
  connectionStartId,
  dragStartX,
  dragStartY
);

// 引入地图工具栏功能
const { resetView,fitWorldView } = useMapTools(
  canvasRef, 
  offsetX, 
  offsetY, 
  scale, 
  drawMap, 
  minScale.value, 
  maxScale.value
);

// 添加地图绘制相关的数据
const drawingTool = ref('land');
const drawingWidth = ref(2);
const drawingMode = ref('pen');

// 计算编辑器标题
const getEditorTitle = computed(() => {
  switch (activeTool.value) {
    case 'add':
      return '位置详情';
    case 'draw':
      return '地图绘制';
    default:
      return '';
  }
});

// 开始绘制方法
const startDrawing = () => {
  // 这里添加开始绘制的逻辑
  console.log('开始绘制', {
    tool: drawingTool.value,
    width: drawingWidth.value
  });
};

// 获取实际坐标值
const currentLocationCoordinates = computed(() => {
  if (!currentLocation.value) return { longitude: 0, latitude: 0 };
  
  // 将像素坐标转换为经纬度坐标
  const longitude = Math.floor(currentLocation.value.x / GRID_SIZE);
  // 修正纬度计算：顶部是北纬90度，底部是南纬90度
  // y坐标从0到180*GRID_SIZE，对应纬度从北纬90度到南纬90度
  const latitude = 90 - Math.floor(currentLocation.value.y / GRID_SIZE);
  
  return { longitude, latitude };
});

// 格式化当前位置的经度和纬度
const formattedLongitude = computed(() => 
  formatLongitude(currentLocationCoordinates.value.longitude)
);

const formattedLatitude = computed(() => 
  formatLatitude(currentLocationCoordinates.value.latitude)
);

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
  
  // 更新地图数据
  mapStore.$patch({
    position: {
      offsetX: offsetX.value,
      offsetY: offsetY.value
    },
    scale: scale.value
  });
  
  // 保存到世界数据
  worldStore.saveWorldData();
}

// 修改重置视图函数
function handleResetView() {
  resetView();
  saveMapState();
}

// 添加加载状态
const isLoading = ref(true);
const error = ref<string | null>(null);

// 声明交互处理函数的类型
interface MapInteractions {
  handleMouseDown: (e: MouseEvent) => void;
  handleMouseMove: (e: MouseEvent) => void;
  handleMouseUp: (e: MouseEvent) => void;
  handleClick: (e: MouseEvent) => void;
  handleKeyDown: (e: KeyboardEvent) => void;
  handleWheel: (e: WheelEvent) => void;
}

// 声明交互处理函数
let handleMouseDown = (e: MouseEvent) => {};
let handleMouseMove = (e: MouseEvent) => {};
let handleMouseUp = (e: MouseEvent) => {};
let handleClick = (e: MouseEvent) => {};
let handleKeyDown = (e: KeyboardEvent) => {};
let handleWheel = (e: WheelEvent) => {};

// 初始化地图数据
const initMapData = async () => {
  try {
    await nextTick();  // 等待 DOM 更新
    
    if (!canvasRef.value) {
      console.error('Canvas element not found');
      return;
    }

    // 获取画布上下文
    const ctx = canvasRef.value.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas context');
      return;
    }
    ctxRef.value = ctx;

    // 初始化地图工具
    const mapTools = useMapTools(
      canvasRef,
      offsetX,
      offsetY,
      scale,
      drawMap,
      minScale.value,
      maxScale.value
    );

    // 初始化地图交互
    const interactions = useMapInteractions(
      canvasRef,
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
      drawMap
    );

    // 分配交互处理函数
    handleMouseDown = interactions.handleMouseDown;
    handleMouseMove = interactions.handleMouseMove;
    handleMouseUp = interactions.handleMouseUp;
    handleClick = interactions.handleClick;
    handleKeyDown = interactions.handleKeyDown;
    handleWheel = interactions.handleWheel;

    // 初始化画布
    initCanvas();
    handleResize();

    console.log('Map interactions initialized successfully');
  } catch (error) {
    console.error('Failed to initialize map:', error);
  }
};

// 监听store中的worldId变化非必须
watch(() => worldStore.$state.id, (newId) => {
  if (newId) {
    isLoading.value = true;
    error.value = null;
    isLoading.value = false;
    nextTick(() => {
      initMapData();
    });
  } else {
    error.value = '未找到世界ID';
    isLoading.value = false;
  }
}, { immediate: true });

// 监听数据变化
watch(() => mapStore.mapData, (newData) => {
  if (newData && canvasRef.value && ctxRef.value) {
    drawMap();
  }
}, { deep: true });

// 初始化
onMounted(async () => {
  try {
    console.log('组件挂载，开始初始化');
    
    // 等待 DOM 更新完成
    await nextTick();
    
    // 监听快捷键
    window.addEventListener('keydown', handleKeyDown);
    
    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);
    
    // 初始化地图数据
    await initMapData();
    
    // 处理窗口大小变化
    handleResize();
    
    console.log('组件初始化完成');
  } catch (e) {
    console.error('挂载时初始化失败:', e);
    error.value = '初始化失败：' + (e instanceof Error ? e.message : String(e));
  }
});

// 清理
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <div class="world-map-container" :class="{ 'dark-mode': isDarkMode }">
    <div v-if="isLoading" class="loading">
      <span>加载中...</span>
    </div>
    <div v-else-if="error" class="error">
      <span>{{ error }}</span>
    </div>
    <div v-else class="map-content">
      <div class="map-toolbar">
        <div class="tool-group">
          <button 
            class="tool-btn back-btn"
            @click="goBack"
            title="返回"
          >
            <i class="fas fa-arrow-left"></i>
          </button>
          <button 
            :class="['tool-btn', { active: activeTool === 'select' }]" 
            @click="setActiveTool('select')"
            title="选择工具"
          >
            <i class="fas fa-mouse-pointer"></i>
          </button>
          <button 
            :class="['tool-btn', { active: activeTool === 'add' }]" 
            @click="setActiveTool('add')"
            title="添加位置"
          >
            <i class="fas fa-plus"></i>
          </button>
          <button 
            :class="['tool-btn', { active: activeTool === 'connect' }]" 
            @click="setActiveTool('connect')"
            title="连接位置"
          >
            <i class="fas fa-project-diagram"></i>
          </button>
          <button 
            :class="['tool-btn', { active: activeTool === 'delete' }]" 
            @click="setActiveTool('delete')"
            title="删除位置"
          >
            <i class="fas fa-trash"></i>
          </button>
          <button 
            :class="['tool-btn', { active: activeTool === 'draw' }]" 
            @click="setActiveTool('draw')"
            title="地图绘制"
          >
            <i class="fas fa-paint-brush"></i>
          </button>
        </div>
        
        <div class="coordinate-display" v-if="showCoordinates">
          <div class="coordinate-label">{{ mouseX > 0 ? `${180 - mouseX}°W` : `${Math.abs(180 + mouseX)}°E` }}</div>
          <div class="coordinate-label">{{ mouseY > 0 ? `${mouseY}°N` : `${Math.abs(mouseY)}°S` }}</div>
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
          <button class="tool-btn" @click="handleResetView" title="重置视图">
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
      
      <canvas ref="canvasRef" :width="canvasWidth" :height="canvasHeight" class="map-canvas"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @click="handleClick"
        @wheel="handleWheel"
      ></canvas>
      
      <div v-if="activeTool && ['add', 'draw'].includes(activeTool)" class="location-editor">
        <div class="editor-header">
          <h3>{{ getEditorTitle }}</h3>
          <button class="close-btn" @click="setActiveTool('select')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="editor-content">
          <template v-if="activeTool === 'add'">
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
          </template>
          
          <template v-else-if="activeTool === 'draw'">
            <div class="form-group">
              <label>地形类型</label>
              <select v-model="drawingTool" class="terrain-select">
                <option value="land">陆地</option>
                <option value="ocean">海洋</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>绘图工具</label>
              <div class="drawing-tools">
                <button 
                  :class="['tool-option', { active: drawingMode === 'pen' }]"
                  @click="drawingMode = 'pen'"
                  title="画笔"
                >
                  <i class="fas fa-pen"></i>
                </button>
                <button 
                  :class="['tool-option', { active: drawingMode === 'eraser' }]"
                  @click="drawingMode = 'eraser'"
                  title="橡皮擦"
                >
                  <i class="fas fa-eraser"></i>
                </button>
                <button 
                  :class="['tool-option', { active: drawingMode === 'fill' }]"
                  @click="drawingMode = 'fill'"
                  title="填充"
                >
                  <i class="fas fa-fill-drip"></i>
                </button>
                <button 
                  :class="['tool-option', { active: drawingMode === 'select' }]"
                  @click="drawingMode = 'select'"
                  title="选区"
                >
                  <i class="fas fa-vector-square"></i>
                </button>
              </div>
            </div>

            <div class="form-group">
              <label>线条宽度</label>
              <div class="width-control">
                <input 
                  type="range" 
                  v-model="drawingWidth" 
                  min="1" 
                  max="10" 
                  class="width-slider"
                />
                <span class="width-value">{{ drawingWidth }}px</span>
              </div>
            </div>
          </template>
        </div>
      </div>
      
      <div class="map-scale-info" :class="{ 'dark-mode': isDarkMode }">
        <div class="scale-label">
          <span>缩放: {{ Math.round(scale * 100) }}%</span>
          <span class="scale-tip" v-if="scale < 0.4">每格 30°</span>
          <span class="scale-tip" v-else-if="scale < 0.8">每格 10°</span>
          <span class="scale-tip" v-else-if="scale < 1.2">每格 5°</span>
          <span class="scale-tip" v-else-if="scale < 2">每格 2°</span>
          <span class="scale-tip" v-else>每格 1°</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.world-map-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #ffffff;
  overflow: hidden;
  
  &.dark-mode {
    background-color: #000000;
    
    .map-canvas {
      background-color: #000000;
    }
    
    .map-toolbar {
      background-color: #222222;
      border-color: #333333;
    }
    
    .map-info {
      background-color: #222222;
      border-color: #333333;
    }
    
    .map-scale-info {
      background-color: rgba(34, 34, 34, 0.7);
      color: #ffffff;
    }
    
    .tool-btn {
      background-color: #333333;
      border-color: #444444;
      color: #ffffff;
      
      &:hover {
        background-color: #444444;
      }
      
      &.active {
        background-color: #0066cc;
      }
    }
    
    .coordinate-display {
      background-color: #333333;
      border-color: #444444;
      color: #ffffff;
    }
    
    .location-editor {
      background-color: #222222;
      border-color: #333333;
      
      .editor-header {
        background-color: #333333;
        border-color: #444444;
        
        h3 {
          color: #ffffff;
        }
        
        .close-btn {
          color: #aaaaaa;
          
          &:hover {
            color: #ffffff;
          }
        }
      }
      
      .editor-content {
        label {
          color: #aaaaaa;
        }
        
        input, textarea {
          background-color: #333333;
          border-color: #444444;
          color: #ffffff;
        }
        
        .coord-input {
          span:first-child {
            color: #aaaaaa;
          }
          
          span:last-child {
            background-color: #333333;
            color: #ffffff;
          }
        }
      }
    }
  }
  
  .map-toolbar {
    display: flex;
    justify-content: space-between;
    padding: 10px;
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    
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
      
      &:hover {
        background-color: var(--bg-hover);
      }
      
      &.active {
        background-color: var(--accent-primary);
        color: white;
        border-color: var(--accent-primary);
      }
      
      &.theme-toggle {
        &:hover {
          background-color: var(--bg-hover);
        }
      }

      &.back-btn {
        background-color: var(--error);
        color: white;
        border-color: var(--error);
        
        &:hover {
          background-color: var(--error-dark);
        }
      }
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
      
      .coordinate-label {
        font-family: monospace;
        font-weight: bold;
      }
      
      .coord-toggle {
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        
        &:hover {
          color: var(--accent-primary);
          background: transparent;
        }
      }
    }
    
    .coordinate-toggle-container {
      .coord-toggle {
        color: var(--text-secondary);
        background-color: transparent;
        border: none;
        
        &:hover {
          color: var(--accent-primary);
          background: transparent;
        }
      }
    }
  }
  
  .map-content {
    position: relative;
    flex: 1;
    overflow: hidden;
    
    .map-canvas {
      width: 100%;
      height: 100%;
      display: block;
      background-color: #ffffff;
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
      
      .scale-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: monospace;
        
        .scale-tip {
          font-style: italic;
          opacity: 0.8;
        }
      }
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
      
      .editor-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        border-bottom: 1px solid var(--border-color);
        background-color: var(--bg-secondary);
        
        h3 {
          margin: 0;
          font-size: 1rem;
          color: var(--text-primary);
        }
        
        .close-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          
          &:hover {
            color: var(--text-primary);
          }
        }
      }
      
      .editor-content {
        padding: 15px;
        
        .form-group {
          margin-bottom: 15px;
          
          label {
            display: block;
            margin-bottom: 5px;
            color: var(--text-secondary);
            font-size: 0.9rem;
          }
          
          input, textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            background-color: var(--bg-tertiary);
            color: var(--text-primary);
            
            &:focus {
              border-color: var(--accent-primary);
              outline: none;
            }
          }
          
          .coord-inputs {
            display: flex;
            gap: 15px;
            
            .coord-input {
              display: flex;
              align-items: center;
              gap: 5px;
              
              span:first-child {
                font-weight: bold;
                color: var(--text-secondary);
              }
              
              span:last-child {
                font-family: monospace;
                background-color: var(--bg-tertiary);
                padding: 4px 8px;
                border-radius: 4px;
                min-width: 30px;
                text-align: center;
              }
            }
          }
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
          
          &:hover {
            background-color: var(--accent-secondary);
          }
        }
      }
    }
  }
}

.loading, .error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.2em;
  color: var(--text-color);
}

.error {
  color: var(--error-color);
}

// 添加CSS变量定义
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

// 为暗黑模式添加CSS变量
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

.drawing-tools {
  display: flex;
  gap: 8px;
  margin-top: 8px;

  .tool-option {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background-color: var(--bg-hover);
    }

    &.active {
      background-color: var(--accent-primary);
      color: white;
      border-color: var(--accent-primary);
    }

    i {
      font-size: 1.2em;
    }
  }
}

.terrain-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  
  &:focus {
    border-color: var(--accent-primary);
    outline: none;
  }
}

.width-control {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;

  .width-slider {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background-color: var(--border-color);
    
    &::-webkit-slider-thumb {
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: var(--accent-primary);
      cursor: pointer;
    }
  }

  .width-value {
    min-width: 40px;
    text-align: right;
    font-family: monospace;
    color: var(--text-secondary);
  }
}
</style> 