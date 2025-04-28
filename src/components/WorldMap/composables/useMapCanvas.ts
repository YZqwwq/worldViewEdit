import { ref, computed, onMounted, onBeforeUnmount, watchEffect } from 'vue';
import type { Ref } from 'vue';
import { useLayerManager } from './useLayerManager';
import {
  createGridLayer,
  createConnectionLayer,
  createLocationLayer,
  createTerritoryLayer,
  createLabelLayer,
  createCoordinateLayer,
  createBackgroundLayer,
  createMapLayer
} from './useLayers';

// 图层ID常量
export const LAYER_IDS = {
  BACKGROUND: 'background',  // 底部灰色图层
  MAP: 'map',                // 矩形图层 - 绘制地图地形
  TERRITORY: 'territory',    // 地域交互图层 - 绘制势力范围
  GRID: 'grid',              // 网格图层 - 在矩形图层约束内绘制
  CONNECTION: 'connection',  // 连线图层 - 连接相关势力
  LOCATION: 'location',      // 位置标记图层
  LABEL: 'label',            // 标签图层 - 打标签做描述
  COORDINATE: 'coordinate'   // 经纬度注释图层
};

/**
 * 地图画布管理
 * 负责画布初始化、尺寸调整和多图层绘制控制
 */
export function useMapCanvas(
  isDarkMode: Ref<boolean>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>,
  mapData: Ref<any>,
  currentLocationId: Ref<string>,
  canvasContainerRef: Ref<HTMLElement | null>
) {
  // 使用图层管理器
  const layerManager = useLayerManager();
  
  // 计算画布宽高
  const containerWidth = ref(0);
  const containerHeight = ref(0);
  
  // 初始化图层系统
  function initLayers() {
    if (!canvasContainerRef.value) {
      console.error('Canvas容器引用不存在');
      return;
    }
    
    console.log('初始化多图层地图画布系统', canvasContainerRef.value);
    
    // 初始化图层管理器
    layerManager.initLayerManager(canvasContainerRef.value);
    
    console.log('开始创建各图层');
    
    try {
      // 批量创建所有图层
      const layers = [
        // 背景图层 (z-index: 1)
        createBackgroundLayer(
          { id: LAYER_IDS.BACKGROUND, name: '背景', zIndex: 1, isBaseLayer: true },
          isDarkMode
        ),
        
        // 地图绘制图层 (z-index: 10)
        createMapLayer(
          { id: LAYER_IDS.MAP, name: '地图绘制', zIndex: 10 },
          isDarkMode,
          offsetX,
          offsetY,
          scale,
          '1' // 先写死
        ),
        
        // 地域势力图层 (z-index: 20)
        createTerritoryLayer(
          { id: LAYER_IDS.TERRITORY, name: '地域势力', zIndex: 20 },
          mapData,
          offsetX,
          offsetY,
          scale
        ),
        
        // 网格图层 (z-index: 30)
        createGridLayer(
          { id: LAYER_IDS.GRID, name: '网格', zIndex: 30 },
          isDarkMode,
          offsetX,
          offsetY,
          scale
        ),
        
        // 连线图层 (z-index: 40)
        createConnectionLayer(
          { id: LAYER_IDS.CONNECTION, name: '连线', zIndex: 40 },
          mapData,
          offsetX,
          offsetY,
          scale,
          ref(false),
          ref(''),
          ref(0),
          ref(0),
          currentLocationId
        ),
        
        // 位置标记图层 (z-index: 50)
        createLocationLayer(
          { id: LAYER_IDS.LOCATION, name: '重要位置', zIndex: 50 },
          mapData,
          offsetX,
          offsetY,
          scale,
          currentLocationId
        ),
        
        // 标签图层 (z-index: 60)
        createLabelLayer(
          { id: LAYER_IDS.LABEL, name: '标签', zIndex: 60 },
          mapData,
          offsetX,
          offsetY,
          scale,
          isDarkMode
        ),
        
        // 坐标图层 (z-index: 70)
        createCoordinateLayer(
          { id: LAYER_IDS.COORDINATE, name: '坐标', zIndex: 70 },
          isDarkMode,
          offsetX,
          offsetY,
          scale
        )
      ];
      
      // 批量添加所有图层
      layerManager.addLayers(layers);
      console.log(`已批量添加 ${layers.length} 个图层`);
      
      // 调试当前图层状态
      layerManager.debug();
      
    } catch (error) {
      console.error('创建图层时出错:', error);
    }

    // 全局注册图层管理器，便于调试
    window.layerManager = layerManager;
  }
  
  // 初始化画布
  function initCanvas() {
    if (!canvasContainerRef.value) {
      console.error('Canvas容器引用不存在，无法初始化');
      return;
    }
    
    console.log('initCanvas() 正在初始化画布系统');
    
    // 初始化图层
    initLayers();
    
    // 设置容器大小
    const rect = canvasContainerRef.value.getBoundingClientRect();
    containerWidth.value = rect.width;
    containerHeight.value = rect.height;
    
    // 添加窗口尺寸变化监听
    window.addEventListener('resize', handleResize);
    
    // 首次渲染所有图层
    renderAll();
    
    console.log('画布系统初始化完成');
  }
  
  // 处理窗口尺寸变化
  function handleResize() {
    if (!canvasContainerRef.value) {
      console.warn('Canvas容器引用不存在，无法调整大小');
      return;
    }
    
    const rect = canvasContainerRef.value.getBoundingClientRect();
    containerWidth.value = rect.width;
    containerHeight.value = rect.height;
    
    console.log(`调整画布大小: ${rect.width}x${rect.height}`);
    
    // 使用图层管理器调整所有图层大小
    layerManager.resizeAll(rect.width, rect.height);
    
    // 重新渲染
    renderAll();
  }
  
  // 清除所有图层
  function clearAll() {
    Object.values(LAYER_IDS).forEach(id => {
      const layer = layerManager.getLayer(id);
      if (layer) {
        layer.clear();
      }
    });
  }
  
  // 渲染所有图层
  function renderAll() {
    layerManager.renderAll();
  }
  
  // 主要绘制方法
  function drawMap() {
    renderAll();
  }
  
  // 切换图层可见性
  function toggleLayer(layerId: string, visible?: boolean) {
    layerManager.toggleLayer(layerId, visible);
    
    // 获取图层实例并重新渲染
    const layer = layerManager.getLayer(layerId);
    if (layer) {
      if (layer.visible.value) {
        layer.render();
      } else {
        layer.clear();
      }
      console.log(`图层 ${layerId} 可见性已切换为 ${layer.visible.value}`);
    }
  }
  
  // 获取图层可见性
  function getLayerVisibility(layerId: string): boolean {
    const layer = layerManager.getLayer(layerId);
    return layer ? layer.visible.value : false;
  }
  
  // 销毁和清理
  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    clearAll();
  });
  
  // 导出接口
  return {
    // 基本信息
    canvasWidth: computed(() => layerManager.canvasWidth.value),
    canvasHeight: computed(() => layerManager.canvasHeight.value),
    
    // 图层相关
    layers: layerManager.layers,
    layerManager,
    LAYER_IDS,
    
    // 方法
    initCanvas,
    handleResize,
    drawMap,
    toggleLayer,
    getLayerVisibility,
    
    // 工具方法
    getLayer: layerManager.getLayer,
    showLayer: layerManager.showLayer,
    hideLayer: layerManager.hideLayer
  };
}

// 声明全局接口扩展
declare global {
  interface Window {
    layerManager?: ReturnType<typeof useLayerManager>;
  }
} 