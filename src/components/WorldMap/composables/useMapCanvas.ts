import { ref, computed, onBeforeUnmount,inject } from 'vue';
import type { Ref } from 'vue';
import { useLayerManager, LAYER_MANAGER_KEY } from './useLayerManager';
// 引入useWorldMapLayers
import { useWorldMapLayers } from './useWorldMapLayersManage';
// 引入useLayerTools
import { useLayerTools, DrawToolType } from './useLayerTools';
// 引入Layer类型
import { Layer} from './useLayerFactory';

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
  // 注入而不是创建LayerManager，指定类型
  const layerManager = inject<ReturnType<typeof useLayerManager>>(LAYER_MANAGER_KEY);
  
  if (!layerManager) {
    console.error('useMapCanvas: 未找到LayerManager，请确保在父组件中调用了provide');
    throw new Error('未找到LayerManager，无法初始化地图画布');
  }
  
  console.log('useMapCanvas: 成功获取已注入的图层管理器实例');
  
  // 使用增强的图层系统，传入注入的layerManager
  const worldMapLayers = useWorldMapLayers({
    mapId: '1', // 可以根据需要从参数中传入
    autoInit: false, // 我们手动控制初始化
    externalLayerManager: layerManager // 传入外部创建的图层管理器
  });
  
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
    
    // 使用worldMapLayers初始化图层，并传递drawTools实例
    worldMapLayers.initializeLayers(canvasContainerRef.value, {
      isDarkMode,
      offsetX,
      offsetY,
      scale,
      mapData,
      isDrawingConnection: ref(false),
      connectionStartId: ref(''),
      mouseX: ref(0),
      mouseY: ref(0),
      currentLocationId,
      layerTools: drawTools // 传递drawTools实例
    });
      
    // 调试当前图层状态
    worldMapLayers.layerManager.debug();

    // 全局注册图层管理器，便于调试
    window.layerManager = layerManager as any;
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
    
    // 使用worldMapLayers调整所有图层大小
    worldMapLayers.resizeAllLayers(rect.width, rect.height);
    
    // 重新渲染
    renderAll();
  }
  
  // 清除所有图层
  function clearAll() {
    Object.values(LAYER_IDS).forEach(id => {
      const layer = worldMapLayers.getLayer(id);
      if (layer) {
        layer.clear();
      }
    });
  }
  
  // 渲染所有图层
  function renderAll() {
    worldMapLayers.renderAllLayers();
  }
  
  // 渲染单个图层
  function renderLayer(id: string) {
    worldMapLayers.renderLayer(id);
  }
  
  // 主要绘制方法
  function drawMap() {
    renderAll();
  }
  
  // 初始化图层绘图工具
  const mapLayerRef = computed<Layer | null>(() => {
    return layerManager.getLayer(LAYER_IDS.MAP);
  });
  
  // 集成图层绘图工具
  const drawTools = useLayerTools(
    mapLayerRef,
    offsetX,
    offsetY,
    scale,
    canvasContainerRef,
    LAYER_IDS.MAP,
    layerManager
  );
  
  // 封装高级绘图API
  const startDrawing = (event: PointerEvent) => {
    drawTools.startDrawing(event);
  };
  
  const continueDrawing = (event: PointerEvent) => {
    drawTools.draw(event);
  };
  
  const stopDrawing = () => {
    drawTools.stopDrawing();
  };
  
  // 工具设置API
  const setDrawTool = (tool: DrawToolType) => {
    drawTools.setCurrentTool(tool);
  };
  
  const setDrawLineWidth = (width: number) => {
    drawTools.setLineWidth(width);
  };
  
  const setDrawTerrainType = (terrain: string) => {
    drawTools.setTerrainType(terrain);
  };
  
  const undoDraw = () => {
    drawTools.undo();
  };
  
  const redoDraw = () => {
    drawTools.redo();
  };
  
  // 设置活动绘制图层
  const setActiveDrawingLayer = (layerId: string) => {
    drawTools.setActiveDrawingLayer(layerId);
  };
  
  // 获取当前活动绘制图层ID
  const getActiveDrawingLayerId = () => {
    return drawTools.getActiveLayerId();
  };
  
  // 添加特化方法 - 添加动态绘图图层
  function addDynamicDrawingLayer(name: string): string {
    if (worldMapLayers.addDynamicDrawingLayer) {
      return worldMapLayers.addDynamicDrawingLayer(name);
    }
    throw new Error('特化图层系统未提供动态图层创建功能');
  }

  // 添加特化方法 - 移除动态绘图图层
  function removeDynamicDrawingLayer(layerId: string): boolean {
    if (worldMapLayers.removeDynamicDrawingLayer) {
      return worldMapLayers.removeDynamicDrawingLayer(layerId);
    }
    return false;
  }
  
  // 销毁和清理
  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    clearAll();
  });
  
  // 导出接口（保持不变，便于兼容）
  return {
    // 基本信息
    canvasWidth: computed(() => worldMapLayers.layerManager.canvasWidth.value),
    canvasHeight: computed(() => worldMapLayers.layerManager.canvasHeight.value),
    
    // 图层相关
    layers: worldMapLayers.layerManager.layers,
    layerManager: worldMapLayers.layerManager,
    LAYER_IDS,
    
    // 方法
    initCanvas,
    handleResize,
    drawMap,
    renderLayer,
    
    // 工具方法
    getLayer: worldMapLayers.getLayer,
    showLayer: (id: string) => worldMapLayers.setLayerVisibility(id, true),
    hideLayer: (id: string) => worldMapLayers.setLayerVisibility(id, false),
    
    // 新增图层绘图API
    drawState: drawTools.drawState,
    startDrawing,
    continueDrawing,
    stopDrawing,
    setDrawTool,
    setDrawLineWidth,
    setDrawTerrainType,
    undoDraw,
    redoDraw,
    
    // 新增动态图层API
    addDynamicDrawingLayer,
    removeDynamicDrawingLayer,
    
    // 新增活动绘制图层API
    setActiveDrawingLayer,
    getActiveDrawingLayerId
  };
}

// 声明全局接口扩展
declare global {
  interface Window {
    layerManager?: ReturnType<typeof useLayerManager>;
  }
} 