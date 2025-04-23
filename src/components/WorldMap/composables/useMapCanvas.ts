import { ref, computed, onMounted, onBeforeUnmount, watchEffect } from 'vue';
import type { Ref } from 'vue';
import { useLayerManager } from './useLayerManager';
import { 
  createBackgroundLayer, 
  createMapLayer, 
  getMapRect 
} from './useLayerFactory';
import {
  createGridLayer,
  createConnectionLayer,
  createLocationLayer,
  createTerritoryLayer,
  createLabelLayer,
  createCoordinateLayer
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
  isDrawingConnection: Ref<boolean>,
  connectionStartId: Ref<string>,
  dragStartX: Ref<number>,
  dragStartY: Ref<number>,
  canvasContainerRef: Ref<HTMLElement | null>,
  mouseX: Ref<number> = ref(0),
  mouseY: Ref<number> = ref(0)
) {
  // 使用图层管理器
  const {
    layers,
    parentElement,
    canvasWidth,
    canvasHeight,
    addLayer,
    getLayer,
    removeLayer,
    showLayer,
    hideLayer,
    initLayerManager,
    resizeAll,
    renderAll,
    clearAll
  } = useLayerManager();
  
  // 计算画布宽高
  const containerWidth = ref(0);
  const containerHeight = ref(0);
  
  // 初始化图层系统
  // 绘制各个图层
  function initLayers() {
    if (!canvasContainerRef.value) {
      console.error('Canvas容器引用不存在');
      return;
    }
    
    console.log('初始化多图层地图画布系统');
    
    // 初始化图层管理器
    // 传入Dom元素数值，用于初始化图层管理器
    initLayerManager(canvasContainerRef.value);
    
    // 创建并添加各图层 - 按照z-index从低到高的顺序
    
    // 1. 底部灰色背景图层 - 最底层
    const backgroundLayer = createBackgroundLayer(
      { id: LAYER_IDS.BACKGROUND, name: '背景', zIndex: 0, isBaseLayer: true },
      isDarkMode
    );
    addLayer(backgroundLayer);
    
    // 2. 地图矩形图层 - 绘制大体的地图地形
    const mapLayer = createMapLayer(
      { id: LAYER_IDS.MAP, name: '地图', zIndex: 10 },
      isDarkMode,
      offsetX,
      offsetY,
      scale
    );
    addLayer(mapLayer);
    
    // 3. 地域交互图层 - 绘制势力范围
    const territoryLayer = createTerritoryLayer(
      { id: LAYER_IDS.TERRITORY, name: '地域', zIndex: 20 },
      mapData,
      offsetX,
      offsetY,
      scale
    );
    addLayer(territoryLayer);
    
    // 4. 网格图层 - 以矩形图层作为约束区
    const gridLayer = createGridLayer(
      { id: LAYER_IDS.GRID, name: '网格', zIndex: 30 },
      isDarkMode,
      offsetX,
      offsetY,
      scale
    );
    addLayer(gridLayer);
    
    // 5. 连线图层 - 用于在地图上相关势力间连线
    const connectionLayer = createConnectionLayer(
      { id: LAYER_IDS.CONNECTION, name: '连线', zIndex: 40 },
      mapData,
      offsetX,
      offsetY,
      scale,
      isDrawingConnection,
      connectionStartId,
      mouseX,
      mouseY,
      currentLocationId
    );
    addLayer(connectionLayer);
    
    // 6. 位置节点图层
    const locationLayer = createLocationLayer(
      { id: LAYER_IDS.LOCATION, name: '位置', zIndex: 50 },
      mapData,
      offsetX,
      offsetY,
      scale,
      currentLocationId
    );
    addLayer(locationLayer);
    
    // 7. 标签图层 - 用于在地图上打标签做描述
    const labelLayer = createLabelLayer(
      { id: LAYER_IDS.LABEL, name: '标签', zIndex: 60 },
      mapData,
      offsetX,
      offsetY,
      scale,
      isDarkMode
    );
    addLayer(labelLayer);
    
    // 8. 经纬度注释图层 - 用于显示经纬度
    const coordinateLayer = createCoordinateLayer(
      { id: LAYER_IDS.COORDINATE, name: '坐标', zIndex: 70 },
      isDarkMode,
      offsetX,
      offsetY,
      scale
    );
    addLayer(coordinateLayer);
    
    // 首次渲染所有图层
    renderAll();
  }
  
  // 初始化画布
  function initCanvas() {
    if (!canvasContainerRef.value) {
      console.error('Canvas容器引用不存在');
      return;
    }
    
    console.log('初始化多图层地图画布');
    
    // 设置容器样式
    canvasContainerRef.value.style.position = 'relative';
    canvasContainerRef.value.style.overflow = 'hidden';
    canvasContainerRef.value.style.width = '100%';
    canvasContainerRef.value.style.height = '100%';
    
    // 初始化图层
    initLayers();
  }
  
  // 处理窗口调整大小
  function handleResize() {
    if (!canvasContainerRef.value) {
      console.warn('调整大小时Canvas容器引用不存在');
      return;
    }
    
    // 获取容器尺寸
    const rect = canvasContainerRef.value.getBoundingClientRect();
    containerWidth.value = rect.width;
    containerHeight.value = rect.height;
    
    // 调整所有图层大小
    resizeAll(containerWidth.value, containerHeight.value);
    
    // 渲染所有图层
    renderAll();
  }
  
  // 统一的绘制函数
  function drawMap() {
    // 清除所有图层
    clearAll();
    
    // 渲染所有图层
    renderAll();
  }
  
  // 显示/隐藏指定图层
  function toggleLayer(layerId: string, visible?: boolean) {
    const layer = getLayer(layerId);
    if (layer) {
      if (visible !== undefined) {
        if (visible) {
          showLayer(layerId);
        } else {
          hideLayer(layerId);
        }
      } else {
        // 切换可见性
        if (layer.visible.value) {
          hideLayer(layerId);
        } else {
          showLayer(layerId);
        }
      }
      // 重新渲染
      renderAll();
    }
  }
  
  // 获取图层可见性状态
  function getLayerVisibility(layerId: string): boolean {
    const layer = getLayer(layerId);
    return layer ? layer.visible.value : false;
  }
  
  // 监听状态变化，自动重绘
  watchEffect(() => {
    // 依赖监听
    const deps = [
      scale.value,
      offsetX.value,
      offsetY.value,
      isDarkMode.value,
      mapData.value,
      currentLocationId.value,
      isDrawingConnection.value,
      connectionStartId.value
    ];
    
    // 重绘
    drawMap();
  });
  
  // 监听窗口大小变化
  onMounted(() => {
    window.addEventListener('resize', handleResize);
  });
  
  // 移除事件监听器
  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
  });
  
  return {
    canvasContainerRef,
    canvasWidth: containerWidth,
    canvasHeight: containerHeight,
    drawMap,
    initCanvas,
    handleResize,
    toggleLayer,
    getLayerVisibility,
    // 导出所有可用图层
    layers,
    // 导出图层常量
    LAYER_IDS
  };
} 