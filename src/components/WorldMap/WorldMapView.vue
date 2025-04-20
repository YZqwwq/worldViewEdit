<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import type { WorldData } from '../../electron';
import { useMapCanvas } from './composables/useMapCanvas';
import { useMapState } from './composables/useMapState';
import { useMapTools } from './composables/useMapTools';
import { useMapInteractions } from './composables/useMapInteractions';
import { useMapData } from './composables/useMapData';

// 定义Props
const props = defineProps<{
  worldData: WorldData;
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'updateWorldData', worldData: WorldData): void;
  (e: 'save'): void;
}>();

// 地图网格大小常量
const GRID_SIZE = 30;

// 引入地图状态和数据管理
const { 
  mapData, 
  currentLocationId, 
  loadMapData, 
  saveLocationDetails, 
  saveMapData,
  currentLocation,
  locationNameInput,
  locationDescInput,
  formatLongitude,
  formatLatitude
} = useMapData(props, emit);

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
  toggleDarkMode
} = useMapState();

// 引入画布相关
const {
  canvasRef,
  canvasWidth,
  canvasHeight,
  drawMap,
  initCanvas,
  handleResize
} = useMapCanvas(isDarkMode, offsetX, offsetY, scale, mapData, currentLocationId, isDrawingConnection, connectionStartId, dragStartX, dragStartY);

// 引入地图交互功能
const {
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleClick,
  handleKeyDown,
  handleWheel,
  addNewLocation,
  handleConnectionStart,
  deleteLocation,
  findClickedLocation
} = useMapInteractions(
  canvasRef, mapData, isDragging, dragStartX, dragStartY, 
  offsetX, offsetY, scale, isDrawingConnection, connectionStartId,
  currentLocationId, locationNameInput, locationDescInput, isEditing,
  activeTool, mouseX, mouseY, drawMap
);

// 引入地图工具栏功能
const { initMapPosition, resetView, fitWorldView } = useMapTools(
  canvasRef, 
  offsetX, 
  offsetY, 
  scale, 
  drawMap, 
  minScale.value, 
  maxScale.value
);

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

// 初始化
onMounted(() => {
  initCanvas();
  loadMapData();
  
  // 监听快捷键
  window.addEventListener('keydown', handleKeyDown);
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize);
  handleResize();
  
  // 设置定时器初始渲染
  setTimeout(() => {
    drawMap();
  }, 100);
});

// 清理
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('resize', handleResize);
});

// 监听地图数据变化
watch(() => props.worldData, () => {
  loadMapData();
}, { deep: true });
</script>

<template>
  <div class="world-map-container" :class="{ 'dark-mode': isDarkMode }">
    <div class="map-toolbar">
      <div class="tool-group">
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
      </div>
      
      <div class="coordinate-display" v-if="showCoordinates">
        <div class="coordinate-label">{{ mouseX > 0 ? `东经${mouseX}°` : `西经${Math.abs(mouseX)}°` }}</div>
        <div class="coordinate-label">{{ mouseY > 0 ? `北纬${mouseY}°` : `南纬${Math.abs(mouseY)}°` }}</div>
        <div class="coordinate-label">缩放: {{ Math.round(scale * 100) }}%</div>
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
        <button class="tool-btn" @click="saveMapData" title="保存地图">
          <i class="fas fa-save"></i>
        </button>
      </div>
    </div>
    
    <div class="map-content">
      <canvas ref="canvasRef" :width="canvasWidth" :height="canvasHeight" class="map-canvas"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @click="handleClick"
        @wheel="handleWheel"
      ></canvas>
      
      <div v-if="isEditing" class="location-editor">
        <div class="editor-header">
          <h3>位置详情</h3>
          <button class="close-btn" @click="isEditing = false">
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
    
    <div class="map-info">
      <div class="form-group">
        <label>地图名称</label>
        <input type="text" v-model="mapData.name" />
      </div>
      
      <div class="form-group">
        <label>地图描述</label>
        <textarea v-model="mapData.description" rows="2"></textarea>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.world-map-container {
  display: flex;
  flex-direction: column;
  height: 100%;
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
    
    .tool-btn, .coord-toggle {
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
  
  .map-info {
    padding: 10px;
    background-color: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    
    .form-group {
      margin-bottom: 10px;
      
      &:last-child {
        margin-bottom: 0;
      }
      
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
    }
  }
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
</style>
