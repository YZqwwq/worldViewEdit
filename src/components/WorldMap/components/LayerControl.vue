<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMapData } from '../composables/useMapData';
import { LAYER_IDS, LAYER_GROUPS } from '../constants/layerIds';

// 获取地图数据
const mapData = useMapData();

// 图层分组
const baseLayers = [
  LAYER_IDS.BASE,
  LAYER_IDS.GRID,
  LAYER_IDS.COORDINATE
];

const dataLayers = [
  LAYER_IDS.TERRITORY,
  LAYER_IDS.CONNECTION,
  LAYER_IDS.MARKER,
  LAYER_IDS.LABEL,
  LAYER_IDS.ROUTE,
  LAYER_IDS.POLYGON
];

const helperLayers = [
  LAYER_IDS.HEATMAP,
  LAYER_IDS.TEXT,
  LAYER_IDS.CUSTOM
];

// 图层名称映射
const layerNames: Record<string, string> = {
  [LAYER_IDS.BASE]: '基础地图',
  [LAYER_IDS.GRID]: '网格',
  [LAYER_IDS.COORDINATE]: '坐标',
  [LAYER_IDS.TERRITORY]: '区域',
  [LAYER_IDS.CONNECTION]: '连接',
  [LAYER_IDS.MARKER]: '标记点',
  [LAYER_IDS.LABEL]: '标签',
  [LAYER_IDS.ROUTE]: '路线',
  [LAYER_IDS.POLYGON]: '多边形',
  [LAYER_IDS.HEATMAP]: '热力图',
  [LAYER_IDS.TEXT]: '文本',
  [LAYER_IDS.CUSTOM]: '自定义'
};

// 获取图层名称
function getLayerName(layerId: string): string {
  return layerNames[layerId] || layerId;
}

// 全部显示/隐藏
function toggleAll(visible: boolean) {
  const allLayers = [...baseLayers, ...dataLayers, ...helperLayers];
  
  // 如果当前状态和目标状态不一致，则切换
  allLayers.forEach(layerId => {
    const currentVisibility = mapData.getLayerVisibility(layerId);
    if (currentVisibility !== visible) {
      mapData.toggleLayerVisibility(layerId);
    }
  });
}
</script>
<!-- 图层控制面板 -->

<template>
  <div class="layer-control-panel">
    <div class="panel-header">
      <h3>图层控制</h3>
      <button @click="toggleAll(true)" title="显示所有图层">全部显示</button>
      <button @click="toggleAll(false)" title="隐藏所有图层">全部隐藏</button>
    </div>
    
    <div class="panel-content">
      <!-- 基础图层 -->
      <div class="layer-group">
        <h4>基础图层</h4>
        <div class="layer-item" v-for="layerId in baseLayers" :key="layerId">
          <label>
            <input 
              type="checkbox" 
              :checked="mapData.getLayerVisibility(layerId)"
              @change="mapData.toggleLayerVisibility(layerId)"
            />
            <span>{{ getLayerName(layerId) }}</span>
          </label>
        </div>
      </div>
      
      <!-- 数据图层 -->
      <div class="layer-group">
        <h4>数据图层</h4>
        <div class="layer-item" v-for="layerId in dataLayers" :key="layerId">
          <label>
            <input 
              type="checkbox" 
              :checked="mapData.getLayerVisibility(layerId)"
              @change="mapData.toggleLayerVisibility(layerId)"
            />
            <span>{{ getLayerName(layerId) }}</span>
          </label>
        </div>
      </div>
      
      <!-- 辅助图层 -->
      <div class="layer-group">
        <h4>辅助图层</h4>
        <div class="layer-item" v-for="layerId in helperLayers" :key="layerId">
          <label>
            <input 
              type="checkbox" 
              :checked="mapData.getLayerVisibility(layerId)"
              @change="mapData.toggleLayerVisibility(layerId)"
            />
            <span>{{ getLayerName(layerId) }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layer-control-panel {
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 12px;
  width: 240px;
  max-height: 500px;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
}

.panel-header h3 {
  flex: 1;
  margin: 0;
  font-size: 16px;
}

.panel-header button {
  padding: 3px 6px;
  font-size: 12px;
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.panel-header button:hover {
  background-color: #e0e0e0;
}

.layer-group {
  margin-bottom: 16px;
}

.layer-group h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #666;
  border-bottom: 1px solid #eee;
  padding-bottom: 4px;
}

.layer-item {
  margin-bottom: 6px;
}

.layer-item label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.layer-item input {
  margin-right: 8px;
}

.layer-item span {
  font-size: 14px;
}

/* 暗色模式 */
:deep(.dark-mode) .layer-control-panel {
  background-color: rgba(30, 30, 30, 0.9);
  color: #f0f0f0;
}

:deep(.dark-mode) .panel-header button {
  background-color: #333;
  border-color: #444;
  color: #eee;
}

:deep(.dark-mode) .panel-header button:hover {
  background-color: #444;
}

:deep(.dark-mode) .layer-group h4 {
  color: #aaa;
  border-bottom-color: #444;
}
</style> 