import { ref, Ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { Layer } from './useLayerFactory';
import { LAYER_IDS } from './useMapCanvas';
import { useLayerManagerContext, useLayerManager } from './useLayerManager';
import { useMapCacheStore } from '../utils/mapCacheStore';
import { useCoordinateTransform, Coordinate } from '../utils/CoordinateTransform';
import { useDrawingWorker } from '../utils/useDrawingWorker';
// 导入DrawingEngine和相关接口
import { DrawingEngine, DrawPoint, DrawOptions } from '../utils/DrawingEngine';
// 导入PathDataManager
import { PathDatastore } from '../utils/PointsDatastore';
// 导入历史记录管理器
import { useLayerToolsHistory, createHistoryItem } from './useLayerToolsHistory';

// 定义地图实际尺寸常量
const GRID_SIZE = 15; // 网格大小，与其他图层保持一致
const MAP_WIDTH = 360 * GRID_SIZE; // 地图宽度（像素）
const MAP_HEIGHT = 180 * GRID_SIZE; // 地图高度（像素）eraser

// 定义绘图工具类型
export type DrawToolType = 'pen' | 'eraser' | 'select' ;

// 定义绘图状态
interface DrawState {
  isDrawing: boolean;
  lastX: number;
  lastY: number;
  currentTool: DrawToolType;
  lineWidth: number;
  terrainType: string;
  historyIndex: number;
  cachedScale: number;
  // 移除 currentPoints 字段，由 PathDatastore管理
  lastTimestamp?: number;
  animationFrameId?: number;
  workerProcessing?: boolean;
  operationId: number; // 添加操作ID，用于跟踪绘图操作
  lastDrawnPointIndex: number; // 记录最后绘制的点的索引
  hasUnprocessedUpdate?: boolean; // 标记是否有未处理的绘制更新
}

// 定义返回值类型，供外部引用
export type LayerToolsReturnType = {
  drawState: Ref<DrawState>;
  setCurrentTool: (tool: DrawToolType) => void;
  setLineWidth: (width: number) => void;
  setTerrainType: (terrain: string) => void;
  undo: () => void;
  redo: () => void;
  getTerrainColor: (terrain: string) => string;
  drawPen: () => void;
  drawEraser: (ctx: CanvasRenderingContext2D, event: PointerEvent) => void;
  startDrawing: (event: PointerEvent) => void;
  draw: (event: PointerEvent) => void;
  continueDrawing: (event: PointerEvent) => void; // 别名，与draw完全相同
  stopDrawing: () => void;
  getDrawingContext: () => CanvasRenderingContext2D | null;
  // 缓存操作API
  renderCacheTo: (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, scale: number) => void;
  clearCache: () => void;
  toDataURL: (type?: string) => string;
  // 新增刷新函数
  refreshCanvas: () => void;
  // 新增底图加载函数
  loadBaseMap: () => void;
  // 新增历史记录相关状态
  canUndo: Ref<boolean>;
  canRedo: Ref<boolean>;
  historyCount: Ref<number>;
};

// 定义Point类型，用于PathDataManager中的控制点
interface Point {
  x: number;
  y: number;
}

/**
 * 地图绘图工具，处理地图图层的绘制功能
 * 
 * @param mapLayer 地图图层引用，可以通过layerManager.getLayer(LAYER_IDS.MAP)获取
 * @param offsetX 视图X偏移量
 * @param offsetY 视图Y偏移量
 * @param scale 视图缩放比例
 * @param canvasContainerRef Canvas容器元素引用
 * @param layerId 缓存层ID
 * @param externalLayerManager 外部传入的图层管理器实例，优先使用此实例
 */
export function useLayerTools(
  mapLayer: Ref<Layer | null>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>,
  canvasContainerRef: Ref<HTMLElement | null>,
  layerId: string = 'map',
  externalLayerManager?: ReturnType<typeof useLayerManager>
): LayerToolsReturnType {
  // 创建绘图状态对象
  const drawState = ref<DrawState>({
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    currentTool: 'pen',
    lineWidth: 2,
    terrainType: '陆地',
    historyIndex: -1,
    cachedScale: 1,
    // 移除 currentPoints 初始化，由 PathDataManager 管理
    lastTimestamp: undefined, // 上次绘制的时间戳
    animationFrameId: undefined, // 新增动画帧ID
    workerProcessing: false, // 记录Worker处理状态
    operationId: 0, // 初始化操作ID
    lastDrawnPointIndex: -1 // 初始化最后绘制点索引
  });
  
  // 地形类型到颜色的映射 - 移到这里，确保在DrawingEngine实例化前定义
  const terrainColors = {
    '陆地': '#9cb265',  // 浅绿色
    '海洋': '#3c78d8',  // 蓝色
    '山地': '#8b4513',  // 棕色
    '沙漠': '#e6c86e',  // 黄色
    '草原': '#7cb342',  // 绿色
    '森林': '#2e7d32'   // 深绿色
  };
  
  // 获取地形颜色
  function getTerrainColor(terrain: string): string {
    return terrainColors[terrain as keyof typeof terrainColors] || terrainColors['陆地'];
  }
  
  // 创建DrawingEngine实例，用于处理点和曲线
  const drawingEngine = new DrawingEngine({
    lineWidth: drawState.value.lineWidth,
    color: getTerrainColor(drawState.value.terrainType),
    tool: drawState.value.currentTool,
  });
  
  // 创建PathDataManager实例，用于管理点集
  const pathDatastore = new PathDatastore({
    lineWidth: drawState.value.lineWidth,
    color: getTerrainColor(drawState.value.terrainType),
    tool: drawState.value.currentTool,
  });
  
  // 创建历史记录管理器实例，默认保留30步历史
  const historyManager = useLayerToolsHistory(30, layerId);
  
  // 同步设置到DrawingEngine和PathDataManager
  function syncEngineOptions() {
    const options = {
      lineWidth: drawState.value.lineWidth,
      color: getTerrainColor(drawState.value.terrainType),
      tool: drawState.value.currentTool
    };
    
    drawingEngine.setOptions(options);
    // 同样更新PathDataManager选项
  }
  
  // 防抖函数，用于控制绘图频率
  let drawThrottleTimer: number | null = null;
  
  // 创建坐标转换工具
  const coordTransform = useCoordinateTransform(
    offsetX,
    offsetY,
    scale
  );
  
  // 跟踪缓存初始化状态
  const cacheInitialized = ref<boolean>(false);
  
  // 创建绘图缓存
  const mapCacheStore = useMapCacheStore();
  
  // 优先使用外部传入的图层管理器实例，否则尝试通过inject获取
  let layerManager: ReturnType<typeof useLayerManager> | null = externalLayerManager || null;
  
  // 如果没有外部传入的图层管理器，尝试通过inject获取
  if (!layerManager) {
    try {
      layerManager = useLayerManagerContext();
      console.log('通过inject获取到图层管理器');
    } catch (error) {
      console.log('未找到图层管理器上下文，将仅使用传入的mapLayer参数');
    }
  } else {
    console.log('使用外部传入的图层管理器实例');
  }
  
  // 获取当前绘图上下文，增强错误处理
  function getDrawingContext(): CanvasRenderingContext2D | null {
    // 首先尝试通过传入的mapLayer获取
    if (mapLayer.value && mapLayer.value.ctx) {
      return mapLayer.value.ctx;
    }
    
    // 如果有图层管理器，尝试通过它获取
    if (layerManager) {
      const layer = layerManager.getLayer(LAYER_IDS.MAP);
      if (layer && layer.ctx) {
        console.log('通过图层管理器获取到地图图层上下文');
        return layer.ctx;
      }
    }
    
    console.warn('无法获取绘图上下文，绘图操作将被忽略');
    return null;
  }
  
  // 加载当前画布内容到缓存
  function loadBaseMap() {
    const ctx = getDrawingContext();
    if (!ctx) return;
    
    try {
      // 检查缓存是否已经初始化，如果已初始化则不重复创建
      if (mapCacheStore.isLayerInitialized(layerId) && mapCacheStore.hasBaseImage(layerId)) {
        console.log('底图已存在于缓存中，无需重新加载');
        cacheInitialized.value = true;
        refreshCanvas();
        return;
      }
      
      // 获取画布内容
      const canvas = ctx.canvas;
      // 创建临时图像对象
      const img = new Image();
      // 从当前画布获取图像
      img.src = canvas.toDataURL('image/png');
      
      img.onload = () => {
        // 确保使用正确的地图尺寸
        if (!mapCacheStore.isLayerInitialized(layerId)) {
          mapCacheStore.initializeLayer(layerId, MAP_WIDTH, MAP_HEIGHT);
        }
        
        // 加载图像到缓存
        mapCacheStore.loadImage(layerId, img);
        cacheInitialized.value = true;
        
        // 刷新画布，显示新加载的底图
        refreshCanvas();
      };
    } catch (error) {
      console.error('加载底图失败:', error);
    }
  }
  
  // 渲染缓存到指定context
  function renderCacheTo(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, scale: number) {
    // 使用一致的坐标变换方式
    ctx.save();
    
    // 使用坐标转换工具提供的变换参数
    const dpr = coordTransform.getDpr();
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);
    
    // 与refreshCanvas保持一致的渲染逻辑
    if (mapCacheStore.isLayerInitialized(layerId)) {
      try {
        // 从mapCacheStore获取对应图层的MapCache实例
        const cacheLayer = mapCacheStore.getLayer(layerId);
        
        if (cacheLayer && cacheLayer.isInitialized()) {
          // 直接绘制离屏缓存到当前上下文
          const offscreenCanvas = cacheLayer.getOffscreenCanvas();
          if (offscreenCanvas) {
            ctx.drawImage(offscreenCanvas, 0, 0);
          } else {
            console.error('获取离屏Canvas失败');
          }
        } else {
          console.error('缓存图层未初始化或无效');
        }
      } catch (error) {
        console.error('渲染缓存到画布时出错:', error);
      }
    } else {
      console.error('地图缓存尚未初始化，无法渲染');
    }
    
    ctx.restore();
  }
  
  // 刷新画布 - 从缓存渲染到当前画布
  function refreshCanvas() {
    const ctx = getDrawingContext();
    if (ctx) {
      // 清空当前画布
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // 使用与useLayers一致的坐标变换
      ctx.save();
      
      // 使用坐标转换工具提供的变换参数，确保DPI处理一致性
      const transformParams = coordTransform.getTransformParams();
      ctx.setTransform(...transformParams);
      
      // 自行实现渲染逻辑，与useLayers保持一致
      if (mapCacheStore.isLayerInitialized(layerId)) {
        try {
          // 从mapCacheStore获取对应图层的MapCache实例
          const cacheLayer = mapCacheStore.getLayer(layerId);
          
          if (cacheLayer && cacheLayer.isInitialized()) {
            // 直接绘制离屏缓存到当前上下文
            const offscreenCanvas = cacheLayer.getOffscreenCanvas();
            if (offscreenCanvas) {
              ctx.drawImage(offscreenCanvas, 0, 0);
            } else {
              console.error('获取离屏Canvas失败');
            }
          } else {
            console.error('缓存图层未初始化或无效');
          }
        } catch (error) {
          console.error('渲染缓存到画布时出错:', error);
        }
      } else {
        console.error('地图缓存尚未初始化，无法渲染');
      }
      
      ctx.restore();
    }
  }
  
  // 导出图片
  function toDataURL(type?: string) {
    return mapCacheStore.toDataURL(layerId, type);
  }
  
  /**
   * 开始绘制，支持高频率手写笔和触摸设备事件
   * @param event 原始指针事件，用于获取getCoalescedEvents和准确的坐标
   */
  function startDrawing(event: PointerEvent) {
    // 取消所有待处理的绘图操作
    if (drawThrottleTimer !== null) {
      clearTimeout(drawThrottleTimer);
      drawThrottleTimer = null;
    }
    
    // 取消任何进行中的动画帧
    if (drawState.value.animationFrameId) {
      cancelAnimationFrame(drawState.value.animationFrameId);
      drawState.value.animationFrameId = undefined;
    }
    
    // 增加操作ID
    drawState.value.operationId++;
    
    // 记录开始绘制的时间戳
    const now = Date.now();
    drawState.value.lastTimestamp = now;
    
    // 获取当前活动的图层
    const activeLayer = mapLayer.value || (layerManager ? layerManager.getLayer(LAYER_IDS.MAP) : null);
    
    // 只处理地图绘制工具的事件，并且只在地图图层上绘制
    if (!activeLayer || !activeLayer.visible.value) {
      console.log("❗ 绘制无效: 地图图层不存在或不可见");
      return;
    }
    
    // 获取鼠标在Canvas上的实际坐标（考虑Canvas可能的相对位置）
    if (!activeLayer.canvas) {
      console.error("画布不存在，无法获取准确坐标");
      return;
    }
    
    // 设置绘图状态
    drawState.value.isDrawing = true;
    
    // 启动新的绘制事件生命周期
    pathDatastore.startPathEvent();
    
    drawState.value.lastDrawnPointIndex = 0; // 重置最后绘制点索引
    
    // 确保Canvas可被鼠标点击
    if (activeLayer.canvas) {
      activeLayer.canvas.style.pointerEvents = 'auto';
    }
    
    // 检查缓存是否已初始化
    if (!mapCacheStore.isLayerInitialized(layerId)) {
      mapCacheStore.initializeLayer(layerId, MAP_WIDTH, MAP_HEIGHT);
    }
    
    // 检查是否需要加载底图
    if (!cacheInitialized.value) {
      // 检查store中是否已有底图
      if (mapCacheStore.hasBaseImage(layerId)) {
        cacheInitialized.value = true;
      } else {
        // 保存当前底图内容
        const img = new Image();
        img.src = activeLayer.canvas.toDataURL('image/png');
        
        img.onload = () => {
          // 将底图加载到缓存
          mapCacheStore.loadImage(layerId, img);
          cacheInitialized.value = true;
        };
      }
    }
  }
  
  /**
   * 使用requestAnimationFrame请求绘制
   * 避免过多的绘制调用导致性能问题
   */
  function requestDrawing() {
    // 添加一个标记，表示有未处理的更新
    drawState.value.hasUnprocessedUpdate = true;
    
    // 取消任何之前的绘制请求
    if (drawState.value.animationFrameId) {
      cancelAnimationFrame(drawState.value.animationFrameId);
      drawState.value.animationFrameId = undefined;
    }
    
    // 创建新的绘制请求
    drawState.value.animationFrameId = requestAnimationFrame(() => {
      // 标记为无动画帧，但保持hasUnprocessedUpdate状态，直到绘制完成
      drawState.value.animationFrameId = undefined;
      
      // 执行绘制
      if (drawState.value.isDrawing) {
        drawPen();
        refreshCanvas(); // 确保绘制后立即刷新可见画布
      
        // 如果绘制完成后还有未处理的更新，在一个短暂延迟后再次请求绘制
        // 防止连续的高频绘制请求
        if (drawState.value.hasUnprocessedUpdate) {
          drawState.value.hasUnprocessedUpdate = false;
          
          // 使用setTimeout增加一点延迟，避免同一帧内多次请求
          setTimeout(() => {
            if (drawState.value.isDrawing) {
              requestDrawing();
            }
          }, 0);
        }
      } else {
        // 如果已不在绘制状态，清除未处理更新标记
        drawState.value.hasUnprocessedUpdate = false;
      }
    });
  }
  
  /**
   * 绘制处理函数
   * @param event 原始指针事件，用于获取坐标和压力等信息
   */
  function draw(event: PointerEvent) {
    if (!drawState.value.isDrawing) return;
    
    if (!cacheInitialized.value) {
      setTimeout(() => { if (cacheInitialized.value) draw(event); }, 50);
      return;
    }

    // 获取当前活动的图层
    const activeLayer = mapLayer.value || (layerManager ? layerManager.getLayer(LAYER_IDS.MAP) : null);
    
    // 只在Canvas存在时继续
    if (!activeLayer || !activeLayer.canvas) return;
    
    // 检查PathDatastore是否处于活动状态
    if (!pathDatastore.isDrawingActive()) {
      pathDatastore.startPathEvent();
    }
    
    // 使用PathDatastore直接提取和添加点
    pathDatastore.extractAndAddPoints(
      event, 
      coordTransform, 
      activeLayer.canvas
    );
    
    // 请求绘制
    requestDrawing();
  }
  
  /**
   * 获取当前绘制选项
   */
  function getDrawOptions(): Partial<DrawOptions> {
    return {
      lineWidth: drawState.value.lineWidth,
      color: getTerrainColor(drawState.value.terrainType),
      tool: 'pen' as const,
      tension: 0.25
    };
  }
  
  /**
   * 根据点数量选择合适的绘制方法
   */
  function drawPathData(ctx: CanvasRenderingContext2D, data: { points: DrawPoint[], newSegmentStartIndex: number }) {
    const drawOptions = getDrawOptions();
    
    if (data.points.length > 100) {
      // 大型路径：使用增量绘制方法
      drawingEngine.drawIncrementalPoints(
        ctx,
        data.points,
        data.newSegmentStartIndex,
        data.points.length - 1,
        drawOptions
      );
    } else {
      // 小型路径：整体绘制一次（更快、更平滑）
      drawingEngine.drawPoints(
        ctx,
        data.points,
        drawOptions
      );
    }
  }
  
  // 结束绘制
  function stopDrawing() {
    // 取消所有待处理的绘图操作
    if (drawThrottleTimer !== null) {
      clearTimeout(drawThrottleTimer);
      drawThrottleTimer = null;
    }
    
    // 取消任何进行中的动画帧
    if (drawState.value.animationFrameId) {
      cancelAnimationFrame(drawState.value.animationFrameId);
      drawState.value.animationFrameId = undefined;
    }
    
    if (drawState.value.isDrawing) {
      drawState.value.isDrawing = false;
      
      // 结束PathDatastore的当前绘制事件
      pathDatastore.finalizePathEvent();
      
      // 确保最后一次绘制完成 - 使用简化后的点
      const drawData = pathDatastore.getIncrementalDrawData();
      if (drawData.canDraw) {
        const cacheCtx = mapCacheStore.getContext(layerId);
        if (cacheCtx) {
          // 使用提取的绘制函数，从头重绘整个路径
          drawData.newSegmentStartIndex = 0; // 从头开始绘制整个路径
          drawPathData(cacheCtx, drawData);
        }
      }
      
      // 获取最终路径数据，可用于历史记录
      const finalPath = pathDatastore.finalizePath();
      
      // 如果有足够的点，添加到历史记录
      if (finalPath.points.length > 2) {
        const historyItem = createHistoryItem(
          drawState.value.currentTool,
          finalPath.points,
          {
            lineWidth: drawState.value.lineWidth,
            color: getTerrainColor(drawState.value.terrainType),
            tool: drawState.value.currentTool,
            tension: 0.25
          },
          finalPath.eventId
        );
        
        historyManager.addHistory(historyItem);
        console.log(`已添加历史记录: ${historyItem.id}, 点数: ${finalPath.points.length}`);
      }
      
      console.log("原始路径数据", finalPath.originalPoints)
      console.log("未转换原始路径数据", finalPath.untransformedOriginalPoints)
      console.log("合并事件点", finalPath.coalescedPoints)
      console.log(`绘制事件完成，点数: ${finalPath.points.length}`);
      
      // 刷新显示的画布
      refreshCanvas();
    }
  }

  // 画笔工具实现
  function drawPen() {
    try {
      // 获取PathDataManager中的增量绘制数据
      const drawData = pathDatastore.getIncrementalDrawData();
      
      // 检查是否有足够的点进行绘制
      if (!drawData.canDraw) return;
      
      const cacheCtx = mapCacheStore.getContext(layerId);
      if (!cacheCtx) return;
      
      // 使用提取的绘制函数
      drawPathData(cacheCtx, drawData);
      
    } catch (error) {
      console.error('绘制笔画时出错:', error);
    }
  }
  
  // // 橡皮擦工具实现
  function drawEraser(ctx: CanvasRenderingContext2D, event: PointerEvent) {
    // 暂时不处理
  }
  
  // 设置当前工具
  function setCurrentTool(tool: DrawToolType) {
    console.log(`设置当前工具为: ${tool}`);
    drawState.value.currentTool = tool;
    // 同步到DrawingEngine和PathDataManager
    const options = { tool };
    drawingEngine.setOptions(options);
  }
  
  // 设置线条宽度
  function setLineWidth(width: number) {
    console.log(`设置线宽为: ${width}`);
    drawState.value.lineWidth = width;
    // 同步到DrawingEngine和PathDataManager
    const options = { lineWidth: width };
    drawingEngine.setOptions(options);
  }
  
  // 设置地形类型
  function setTerrainType(terrain: string) {
    console.log(`设置地形类型为: ${terrain}`);
    drawState.value.terrainType = terrain;
    // 同步到DrawingEngine和PathDataManager，设置颜色
    const color = getTerrainColor(terrain);
    const options = { color };
    drawingEngine.setOptions(options);
  }
  
  // 确保初始化时MAP图层设置为可接收鼠标事件
  function initMapLayer() {
    console.log("初始化MAP图层设置");
    const activeLayer = mapLayer.value || (layerManager ? layerManager.getLayer(LAYER_IDS.MAP) : null);
    
    if (!activeLayer) {
      console.error("无法初始化: 地图图层不存在");
      return;
    }
    
    const canvas = activeLayer.canvas;
    if (!canvas) {
      console.error("无法初始化: canvas不存在");
      return;
    }
    
    // 确保Canvas可被鼠标点击
    canvas.style.pointerEvents = 'auto';
    console.log("已设置canvas可接收事件: pointerEvents = auto");
  }
  
  // 监听mapLayer的变化并初始化
  const stopWatch = watch(mapLayer, (newLayer) => {
    if (newLayer) {
      console.log("mapLayer变化，初始化图层设置");
      setTimeout(initMapLayer, 100);
    }
  }, { immediate: true });
  
  // 初始化
  onMounted(() => {
    console.log("useLayerTools onMounted");
    initMapLayer();
  });
  
  onBeforeUnmount(() => {
    console.log("useLayerTools onBeforeUnmount");
    stopWatch();
  });
  
  // 添加draw的别名，确保兼容性
  function continueDrawing(event: PointerEvent) {
    return draw(event);
  }
  
  // 撤销操作
  function undo() {
    // 调用历史记录管理器的undo方法
    const prevState = historyManager.undo();
    // 刷新画布显示
    refreshCanvas();
    console.log("执行撤销操作");
  }
  
  // 重做操作
  function redo() {
    // 调用历史记录管理器的redo方法
    const nextState = historyManager.redo();
    // 刷新画布显示
    refreshCanvas();
    console.log("执行重做操作");
  }
  
  // 清空缓存
  function clearCache() {
    mapCacheStore.clear(layerId);
    cacheInitialized.value = false;
    refreshCanvas();
  }
  
  // 导出接口 - 添加历史记录相关状态
  return {
    drawState,
    setCurrentTool,
    setLineWidth,
    setTerrainType,
    undo,
    redo,
    getTerrainColor,
    drawPen,
    drawEraser,
    startDrawing,
    draw,
    continueDrawing,
    stopDrawing,
    getDrawingContext,
    renderCacheTo,
    clearCache,
    toDataURL,
    refreshCanvas,
    loadBaseMap,
    // 暴露历史记录状态
    canUndo: historyManager.canUndo,
    canRedo: historyManager.canRedo,
    historyCount: historyManager.historyCount
  };
}
