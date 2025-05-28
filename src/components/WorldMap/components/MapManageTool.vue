<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import { useMapData } from '../composables/useMapData';
import { LAYER_IDS } from '../composables/useMapCanvas';
import FloatingPanel from './FloatingPanel.vue';
import WorldMapCanvas from './WorldMapCanvas.vue';

// 定义世界地图图层管理器的注入键
const WORLD_LAYER_MANAGER_KEY = Symbol('worldLayerManager');

// 接收父组件传递的画布引用
const props = defineProps<{
  mapCanvasRef: null | InstanceType<typeof WorldMapCanvas>
}>();

// 获取地图数据
const mapData = useMapData();

// 定义世界地图图层管理器接口类型，包含特化功能
interface WorldLayerManagerLike {
  layerVisibility: { value: Record<string, boolean> };
  toggleLayer: (id: string, visible?: boolean) => void;
  getLayerVisibility: (id: string) => boolean;
  setLayersVisibility: (config: Record<string, boolean>) => void;
  // 特化功能
  addDynamicDrawingLayer?: (name: string) => string;
  removeDynamicDrawingLayer?: (id: string) => boolean;
}

// 尝试直接从依赖注入获取世界地图图层管理器
const worldLayerManager = inject<WorldLayerManagerLike>(WORLD_LAYER_MANAGER_KEY);

// 获取图层管理器，优先使用世界地图特化管理器
let layerManager: WorldLayerManagerLike;
try {
  console.log('🔍 MapManageTool: 开始获取图层管理器...');
  
  if (worldLayerManager) {
    // 首选：使用注入的世界地图图层管理器
    layerManager = worldLayerManager;
    console.log('✅ MapManageTool: 成功获取注入的世界地图图层管理器');
  } else if (props.mapCanvasRef) {
    // 备选1：检查画布是否有动态图层方法
    const canvasRef = props.mapCanvasRef as any;
    
    console.log('🔍 MapManageTool: 检查画布引用功能...', {
      hasAddMethod: typeof canvasRef.addDynamicDrawingLayer === 'function',
      hasRemoveMethod: typeof canvasRef.removeDynamicDrawingLayer === 'function',
      hasLayerManager: !!canvasRef.layerManager
    });
    
    if (canvasRef && typeof canvasRef.addDynamicDrawingLayer === 'function') {
      // 画布直接提供动态图层功能
      const baseLayerManager = canvasRef.layerManager || {
        layerVisibility: computed(() => mapData.layerVisibility.value),
        toggleLayer: (id: string, visible?: boolean) => {
          if (canvasRef.showLayer && canvasRef.hideLayer) {
            if (visible === undefined) {
              visible = !mapData.getLayerVisibility(id);
            }
            if (visible) {
              canvasRef.showLayer(id);
            } else {
              canvasRef.hideLayer(id);
            }
          } else {
            mapData.toggleLayerVisibility(id);
          }
        },
        getLayerVisibility: (id: string) => {
          if (canvasRef.layerManager && typeof canvasRef.layerManager.getLayerVisibility === 'function') {
            return canvasRef.layerManager.getLayerVisibility(id);
          }
          return mapData.getLayerVisibility(id);
        },
        setLayersVisibility: (config: Record<string, boolean>) => {
          Object.entries(config).forEach(([id, visible]) => {
            if (baseLayerManager.getLayerVisibility(id) !== visible) {
              baseLayerManager.toggleLayer(id, visible);
            }
          });
        }
      };
      
      // 增强图层管理器 - 直接从画布获取动态图层方法
      layerManager = {
        ...baseLayerManager,
        addDynamicDrawingLayer: canvasRef.addDynamicDrawingLayer.bind(canvasRef),
        removeDynamicDrawingLayer: canvasRef.removeDynamicDrawingLayer.bind(canvasRef)
      };
      
      console.log('✅ MapManageTool: 使用画布提供的动态图层功能');
    } else if (canvasRef && canvasRef.layerManager) {
      // 兼容处理：获取基础图层管理器，但需要检查是否有动态图层方法
      const baseLM = canvasRef.layerManager;
      
      // 检查基础图层管理器是否有动态图层方法
      if (typeof baseLM.addDynamicDrawingLayer === 'function') {
        layerManager = baseLM;
        console.log('✅ MapManageTool: 使用图层管理器自带的动态图层功能');
      } else {
        // 如果基础图层管理器没有动态图层方法，但画布有，则包装它
        if (typeof canvasRef.addDynamicDrawingLayer === 'function') {
          layerManager = {
            ...baseLM,
            addDynamicDrawingLayer: canvasRef.addDynamicDrawingLayer.bind(canvasRef),
            removeDynamicDrawingLayer: canvasRef.removeDynamicDrawingLayer.bind(canvasRef)
          };
          console.log('✅ MapManageTool: 使用包装后的图层管理器（增加动态图层功能）');
        } else {
          layerManager = baseLM;
          console.log('⚠️ MapManageTool: 使用基础图层管理器（无动态图层功能）');
        }
      }
    } else {
      throw new Error('mapCanvasRef存在但不包含有效的图层管理器或动态图层方法');
    }
  } else {
    // 兜底：使用mapData中的适配实现
    console.warn('⚠️ MapManageTool: 无法获取世界地图图层管理器，将使用基本适配实现');
    // 创建适配器对象
    layerManager = {
      layerVisibility: computed(() => mapData.layerVisibility.value),
      toggleLayer: (id: string, visible?: boolean) => mapData.toggleLayerVisibility(id),
      getLayerVisibility: (id: string) => mapData.getLayerVisibility(id),
      setLayersVisibility: (config: Record<string, boolean>) => {
        Object.entries(config).forEach(([id, visible]) => {
          if (mapData.getLayerVisibility(id) !== visible) {
            mapData.toggleLayerVisibility(id);
          }
        });
      }
    };
  }
} catch (e) {
  console.error('❌ MapManageTool: 获取图层管理器失败，将使用基本适配实现', e);
  // 出错时创建最基本的适配器对象
  layerManager = {
    layerVisibility: computed(() => mapData.layerVisibility.value),
    toggleLayer: (id: string, visible?: boolean) => mapData.toggleLayerVisibility(id),
    getLayerVisibility: (id: string) => mapData.getLayerVisibility(id),
    setLayersVisibility: (config: Record<string, boolean>) => {
      Object.entries(config).forEach(([id, visible]) => {
        if (mapData.getLayerVisibility(id) !== visible) {
          mapData.toggleLayerVisibility(id);
        }
      });
    }
  };
}

// 检查是否支持动态图层功能
const supportsDynamicLayers = computed(() => {
  const hasAddMethod = typeof layerManager.addDynamicDrawingLayer === 'function';
  const hasRemoveMethod = typeof layerManager.removeDynamicDrawingLayer === 'function';
  const result = hasAddMethod && hasRemoveMethod;
  
  console.log('🔍 MapManageTool: 动态图层支持检查', {
    hasAddMethod,
    hasRemoveMethod,
    supportsDynamicLayers: result
  });
  
  return result;
});

// 图层可见性状态
const layerVisibility = computed(() => layerManager.layerVisibility.value);

// 控制预设图层列表的展开/折叠
const isDefaultExpanded = ref(true);

// 控制动态图层列表的展开/折叠
const isDynamicExpanded = ref(true);

// 控制添加图层对话框显示状态
const showAddLayerDialog = ref(false);
const newLayerName = ref('新图层');

// 预设图层列表配置
const defaultLayers = [
  { id: LAYER_IDS.MAP, name: '地图绘制' },
  { id: LAYER_IDS.TERRITORY, name: '势力范围' },
  { id: LAYER_IDS.GRID, name: '网格' },
  { id: LAYER_IDS.CONNECTION, name: '连接线' },
  { id: LAYER_IDS.LOCATION, name: '重要位置' },
  { id: LAYER_IDS.LABEL, name: '标签' },
  { id: LAYER_IDS.COORDINATE, name: '坐标系' }
];

// 动态图层列表
const dynamicLayers = ref<{ id: string; name: string }[]>([]);

// 当前活动绘制图层ID
const activeDrawingLayerId = ref<string>(LAYER_IDS.MAP);

// 获取所有可绘制的图层（预设图层中的地图绘制图层 + 动态图层）
const drawableLayers = computed(() => {
  const layers = [
    { id: LAYER_IDS.MAP, name: '地图绘制', type: 'default' }
  ];
  
  // 添加动态图层
  dynamicLayers.value.forEach(layer => {
    layers.push({ 
      id: layer.id, 
      name: layer.name, 
      type: 'dynamic' 
    });
  });
  
  return layers;
});

// 切换图层可见性
function toggleLayerVisibility(layerId: string) {
  // 使用图层管理器切换可见性
  layerManager.toggleLayer(layerId);
  
  // 如果有画布引用，只重新渲染被切换的图层
  if (props.mapCanvasRef) {
    try {
      // 使用renderLayer只渲染变更的图层，而不是重绘整个画布
      props.mapCanvasRef.renderLayer(layerId);
    } catch (e) {
      console.warn('更新画布显示失败', e);
    }
  }
}

// 切换默认列表展开状态
function toggleDefaultExpanded() {
  isDefaultExpanded.value = !isDefaultExpanded.value;
}

// 切换动态列表展开状态
function toggleDynamicExpanded() {
  isDynamicExpanded.value = !isDynamicExpanded.value;
}

// 打开添加图层对话框
function openAddLayerDialog() {
  newLayerName.value = `图层 ${dynamicLayers.value.length + 1}`;
  showAddLayerDialog.value = true;
}

// 关闭添加图层对话框
function closeAddLayerDialog() {
  showAddLayerDialog.value = false;
}

// 添加新图层
function addNewLayer() {
  if (!newLayerName.value.trim()) return;
  
  console.log('🎨 MapManageTool: 开始创建新图层', {
    layerName: newLayerName.value,
    supportsDynamicLayers: supportsDynamicLayers.value,
    hasAddMethod: typeof layerManager.addDynamicDrawingLayer === 'function'
  });
  
  if (supportsDynamicLayers.value && layerManager.addDynamicDrawingLayer) {
    try {
      console.log('🚀 MapManageTool: 调用动态图层创建方法...');
      
      // 使用特化管理器添加动态绘图图层
      const newLayerId = layerManager.addDynamicDrawingLayer(newLayerName.value);
      
      console.log('✅ MapManageTool: 动态图层创建成功', {
        layerId: newLayerId,
        layerName: newLayerName.value
      });
      
      dynamicLayers.value.push({
        id: newLayerId,
        name: newLayerName.value
      });
      
      // 确保新图层可见
      layerManager.toggleLayer(newLayerId, true);
      
      // 自动切换到新创建的图层作为绘制目标
      setActiveDrawingLayer(newLayerId);
      
      // 重绘画布以立即显示新图层
      if (props.mapCanvasRef) {
        props.mapCanvasRef.drawMap();
      }
      
      console.log(`✅ 已创建动态图层: ${newLayerName.value}(${newLayerId})`);
    } catch (e) {
      console.error('❌ 创建动态图层失败:', e);
    }
  } else {
    // 模拟创建（仅UI展示，无实际功能）
    console.warn('⚠️ 当前环境不支持动态图层创建，仅添加UI占位');
    const newLayerId = `normalpxMap_${Date.now()}`;
    dynamicLayers.value.push({
      id: newLayerId,
      name: newLayerName.value
    });
    
    // 模拟情况下也切换到新图层
    setActiveDrawingLayer(newLayerId);
  }
  
  // 关闭对话框
  closeAddLayerDialog();
}

// 删除图层
function deleteLayer(layerId: string) {
  if (supportsDynamicLayers.value && layerManager.removeDynamicDrawingLayer) {
    try {
      // 使用特化管理器删除动态绘图图层
      const success = layerManager.removeDynamicDrawingLayer(layerId);
      if (success) {
        dynamicLayers.value = dynamicLayers.value.filter(layer => layer.id !== layerId);
        
        // 如果删除的是当前活动绘制图层，切换回默认图层
        if (activeDrawingLayerId.value === layerId) {
          setActiveDrawingLayer(LAYER_IDS.MAP);
        }
        
        console.log(`已删除动态图层: ${layerId}`);
        
        // 重绘画布以反映更改
        if (props.mapCanvasRef) {
          props.mapCanvasRef.drawMap();
        }
      } else {
        console.error(`删除动态图层失败: ${layerId}`);
      }
    } catch (e) {
      console.error('删除动态图层失败:', e);
    }
  } else {
    // 模拟删除（仅UI展示）
    console.warn('当前环境不支持动态图层删除，仅移除UI项');
    dynamicLayers.value = dynamicLayers.value.filter(layer => layer.id !== layerId);
    
    // 如果删除的是当前活动绘制图层，切换回默认图层
    if (activeDrawingLayerId.value === layerId) {
      setActiveDrawingLayer(LAYER_IDS.MAP);
    }
  }
}

// 设置所有预设图层可见性
function setAllDefaultLayersVisibility(visible: boolean) {
  // 准备批量更新配置
  const visibilityConfig: Record<string, boolean> = {};
  
  defaultLayers.forEach(layer => {
    // 跳过背景图层，始终保持可见
    if (layer.id !== LAYER_IDS.BACKGROUND) {
      visibilityConfig[layer.id] = visible;
    }
  });
  
  // 使用图层管理器的批量设置方法
  layerManager.setLayersVisibility(visibilityConfig);
  
  // 如果有画布引用，重新渲染画布
  if (props.mapCanvasRef) {
    try {
      props.mapCanvasRef.drawMap();
    } catch (e) {
      console.warn('更新画布显示失败', e);
    }
  }
}

// 设置所有动态图层可见性
function setAllDynamicLayersVisibility(visible: boolean) {
  // 准备批量更新配置
  const visibilityConfig: Record<string, boolean> = {};
  
  dynamicLayers.value.forEach(layer => {
    visibilityConfig[layer.id] = visible;
  });
  
  // 使用图层管理器的批量设置方法
  layerManager.setLayersVisibility(visibilityConfig);
  
  // 如果有画布引用，重新渲染画布
  if (props.mapCanvasRef) {
    try {
      props.mapCanvasRef.drawMap();
    } catch (e) {
      console.warn('更新画布显示失败', e);
    }
  }
}

// 显示所有预设图层
function showAllDefaultLayers() {
  setAllDefaultLayersVisibility(true);
}

// 隐藏所有预设图层
function hideAllDefaultLayers() {
  setAllDefaultLayersVisibility(false);
}

// 显示所有动态图层
function showAllDynamicLayers() {
  setAllDynamicLayersVisibility(true);
}

// 隐藏所有动态图层
function hideAllDynamicLayers() {
  setAllDynamicLayersVisibility(false);
}

// 设置活动绘制图层
function setActiveDrawingLayer(layerId: string) {
  activeDrawingLayerId.value = layerId;
  
  // 如果有画布引用且提供了设置活动图层的方法，调用它
  if (props.mapCanvasRef && props.mapCanvasRef.setActiveDrawingLayer) {
    props.mapCanvasRef.setActiveDrawingLayer(layerId);
    console.log(`已切换绘制目标图层到: ${layerId}`);
  }
}
</script>

<template>
  <!-- 使用FloatingPanel作为容器 -->
  <FloatingPanel
    title="图层管理器"
    :initialX="960"
    :initialY="70"
    :width="250"
  >
    <!-- 图层管理器内容 -->
    <div class="layer-manager-content">
      <!-- 绘制目标图层选择器 -->
      <div class="drawing-target-section">
        <div class="section-header">
          <span class="section-title">绘制目标图层</span>
        </div>
        <div class="drawing-target-selector">
          <select 
            v-model="activeDrawingLayerId" 
            @change="setActiveDrawingLayer(activeDrawingLayerId)"
            class="layer-select"
          >
            <option 
              v-for="layer in drawableLayers" 
              :key="layer.id" 
              :value="layer.id"
            >
              {{ layer.name }} 
              <span v-if="layer.type === 'dynamic'">(动态)</span>
            </option>
          </select>
        </div>
      </div>
      
      <!-- 预设图层部分 -->
      <div class="layer-section">
        <!-- 预设图层列表标题栏 -->
        <div class="layer-list-header" @click="toggleDefaultExpanded">
          <span class="expand-icon">{{ isDefaultExpanded ? '▼' : '►' }}</span>
          <span class="layer-list-title">预设图层</span>
        </div>
        
        <div v-if="isDefaultExpanded">
          <!-- 批量操作按钮 -->
          <div class="action-buttons">
            <button @click="showAllDefaultLayers" class="action-btn show-all">全部显示</button>
            <button @click="hideAllDefaultLayers" class="action-btn hide-all">全部隐藏</button>
          </div>
          
          <!-- 图层列表 -->
          <div class="layer-list">
            <div 
              v-for="layer in defaultLayers" 
              :key="layer.id" 
              class="layer-item"
              :class="{'layer-visible': layerManager.getLayerVisibility(layer.id)}"
            >
              <label class="layer-label">
                <input 
                  type="checkbox" 
                  :checked="layerManager.getLayerVisibility(layer.id)" 
                  @change="toggleLayerVisibility(layer.id)" 
                />
                <span class="layer-name">{{ layer.name }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 动态图层部分 -->
      <div class="layer-section">
        <!-- 动态图层列表标题栏 -->
        <div class="layer-list-header" @click="toggleDynamicExpanded">
          <span class="expand-icon">{{ isDynamicExpanded ? '▼' : '►' }}</span>
          <span class="layer-list-title">动态绘图图层</span>
        </div>
        
        <div v-if="isDynamicExpanded">
          <!-- 添加新图层按钮 -->
          <div class="add-layer-row">
            <button @click="openAddLayerDialog" class="add-layer-btn">
              <i class="fas fa-plus"></i> 添加新绘图图层
            </button>
          </div>
          
          <!-- 批量操作按钮 -->
          <div class="action-buttons" v-if="dynamicLayers.length > 0">
            <button @click="showAllDynamicLayers" class="action-btn show-all">全部显示</button>
            <button @click="hideAllDynamicLayers" class="action-btn hide-all">全部隐藏</button>
          </div>
          
          <!-- 动态图层列表 -->
          <div class="layer-list" v-if="dynamicLayers.length > 0">
            <div 
              v-for="layer in dynamicLayers" 
              :key="layer.id" 
              class="layer-item"
              :class="{'layer-visible': layerManager.getLayerVisibility(layer.id)}"
            >
              <div class="layer-item-wrapper">
                <label class="layer-label">
                  <input 
                    type="checkbox" 
                    :checked="layerManager.getLayerVisibility(layer.id)" 
                    @change="toggleLayerVisibility(layer.id)" 
                  />
                  <span class="layer-name">{{ layer.name }}</span>
                </label>
                <div class="layer-actions">
                  <button @click="deleteLayer(layer.id)" class="action-icon delete-layer">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 无动态图层时的提示 -->
          <div class="no-layers-message" v-else>
            <p>暂无动态图层</p>
            <p>点击上方按钮添加</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 添加图层对话框 -->
    <div class="add-layer-dialog" v-if="showAddLayerDialog">
      <div class="dialog-overlay" @click="closeAddLayerDialog"></div>
      <div class="dialog-content">
        <h3>添加新绘图图层</h3>
        <div class="form-group">
          <label for="layer-name">图层名称:</label>
          <input 
            type="text" 
            id="layer-name" 
            v-model="newLayerName" 
            @keyup.enter="addNewLayer"
            ref="layerNameInput"
          />
        </div>
        <div class="dialog-actions">
          <button @click="closeAddLayerDialog" class="btn-cancel">取消</button>
          <button @click="addNewLayer" class="btn-confirm">添加</button>
        </div>
      </div>
    </div>
  </FloatingPanel>
</template> 

<style lang="scss" scoped>
// 基础样式
.layer-manager-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

// 绘制目标图层选择器
.drawing-target-section {
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
}

.section-header {
  background: #f0f7ff;
  padding: 10px;
  border-bottom: 1px solid #ddd;
}

.section-title {
  font-weight: 500;
  font-size: 13px;
  color: #333;
}

.drawing-target-selector {
  padding: 8px;
}

.layer-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  background: white;
  cursor: pointer;
}

.layer-select:focus {
  outline: none;
  border-color: #4a6daf;
}

// 图层部分
.layer-section {
  display: flex;
  flex-direction: column;
  border: 1px solid #eee;
  border-radius: 6px;
  overflow: hidden;
}

// 操作按钮
.action-buttons {
  display: flex;
  gap: 8px;
  margin: 8px;
}

.action-btn {
  flex: 1;
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: #e0e0e0;
  color: #333;
}

.action-btn:hover {
  opacity: 0.9;
}

.show-all {
  background: #4caf50;
  color: white;
}

.hide-all {
  background: #f44336;
  color: white;
}

// 列表标题栏
.layer-list-header {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 10px;
  background: #f5f5f5;
  border-bottom: 1px solid #eee;
  user-select: none;
}

.expand-icon {
  margin-right: 8px;
  font-size: 12px;
}

.layer-list-title {
  font-weight: 500;
  font-size: 13px;
}

// 图层列表
.layer-list {
  display: flex;
  flex-direction: column;
  margin: 8px;
}

.layer-item {
  padding: 6px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  margin-bottom: 4px;
}

.layer-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

.layer-visible {
  background: rgba(74, 107, 175, 0.1);
}

.layer-item-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.layer-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 13px;
  flex: 1;
}

.layer-name {
  margin-left: 8px;
}

// 图层操作按钮
.layer-actions {
  display: flex;
  gap: 4px;
}

.action-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
  color: #666;
  font-size: 12px;
  transition: all 0.2s;
}

.action-icon:hover {
  background: rgba(0, 0, 0, 0.1);
}

.delete-layer:hover {
  color: #f44336;
}

// 添加图层按钮
.add-layer-row {
  padding: 8px;
}

.add-layer-btn {
  width: 100%;
  padding: 8px;
  background: #4a6daf;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.add-layer-btn:hover {
  background: #3a5d9f;
}

// 无图层提示
.no-layers-message {
  text-align: center;
  padding: 15px 10px;
  color: #888;
  font-size: 12px;
  
  p {
    margin: 4px 0;
  }
}

// 添加图层对话框
.add-layer-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.dialog-content {
  background: white;
  border-radius: 8px;
  padding: 20px;
  width: 300px;
  z-index: 1;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
  
  h3 {
    margin-top: 0;
    margin-bottom: 15px;
    font-size: 16px;
  }
}

.form-group {
  margin-bottom: 15px;
  
  label {
    display: block;
    margin-bottom: 5px;
    font-size: 13px;
  }
  
  input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  
  button {
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    border: none;
    transition: all 0.2s;
  }
  
  .btn-cancel {
    background: #eee;
    color: #333;
  }
  
  .btn-confirm {
    background: #4a6daf;
    color: white;
  }
  
  button:hover {
    opacity: 0.9;
  }
}

/* 暗色模式样式 */
:deep(.dark-mode) {
  .drawing-target-section {
    border-color: #333;
  }

  .section-header {
    background: #2a2a2a;
    border-bottom-color: #333;
  }

  .section-title {
    color: #eee;
  }

  .layer-select {
    background: #333;
    border-color: #444;
    color: #eee;
  }

  .layer-select:focus {
    border-color: #3a5d9f;
  }

  .layer-section {
    border-color: #333;
  }

  .layer-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .layer-visible {
    background: rgba(74, 107, 175, 0.2);
  }

  .action-btn {
    background: #444;
    color: #ddd;
  }

  .show-all {
    background: #2e7d32;
  }

  .hide-all {
    background: #c62828;
  }
  
  .action-icon {
    color: #aaa;
  }
  
  .action-icon:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  
  .no-layers-message {
    color: #aaa;
  }
  
  .add-layer-btn {
    background: #3a5d9f;
  }
  
  .add-layer-btn:hover {
    background: #2a4d8f;
  }
  
  .dialog-content {
    background: #222;
    color: #eee;
  }
  
  .form-group input {
    background: #333;
    border-color: #444;
    color: #eee;
  }
  
  .btn-cancel {
    background: #444;
    color: #eee;
  }
}
</style>
