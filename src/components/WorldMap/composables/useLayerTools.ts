import { ref, Ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { Layer } from './useLayerFactory';
import { LAYER_IDS } from './useMapCanvas';
import { useLayerManagerContext, useLayerManager } from './useLayerManager';
import { useMapCacheStore } from '../utils/mapCacheStore';
import { useCoordinateTransform, Coordinate } from '../utils/CoordinateTransform';
import { useDrawingWorker, Point } from '../utils/useDrawingWorker';

// 定义地图实际尺寸常量
const GRID_SIZE = 15; // 网格大小，与其他图层保持一致
const MAP_WIDTH = 360 * GRID_SIZE; // 地图宽度（像素）
const MAP_HEIGHT = 180 * GRID_SIZE; // 地图高度（像素）

// 定义绘图工具类型
export type DrawToolType = 'pen' | 'eraser' | 'select';

// 定义绘图状态
interface DrawState {
  isDrawing: boolean;
  lastX: number;
  lastY: number;
  currentTool: DrawToolType;
  lineWidth: number;
  terrainType: string;
  historyIndex: number;
  maxHistorySteps: number;
  cachedScale: number;
  currentPoints: { x: number, y: number, timestamp?: number }[]; // 添加时间戳
  maxPoints: number;
  lastTimestamp?: number;
  animationFrameId?: number;
  workerProcessing?: boolean;
  operationId: number; // 添加操作ID，用于跟踪绘图操作
  lastDrawnPointIndex: number; // 记录最后绘制的点的索引
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
  drawEraser: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  startDrawing: (mapX: number, mapY: number) => void;
  draw: (mapX: number, mapY: number) => void;
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
};

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
    maxHistorySteps: 20, // 最多保存20步历史
    cachedScale: 1,
    currentPoints: [],
    maxPoints: 1500, // 最大点数量
    lastTimestamp: undefined, // 上次绘制的时间戳
    animationFrameId: undefined, // 新增动画帧ID
    workerProcessing: false, // 记录Worker处理状态
    operationId: 0, // 初始化操作ID
    lastDrawnPointIndex: -1 // 初始化最后绘制点索引
  });
  
  // 防抖函数，用于控制绘图频率
  let drawThrottleTimer: number | null = null;
  const throttledDraw = (mapX: number, mapY: number, delay: number = 10) => {
    if (drawThrottleTimer !== null) {
      return; // 如果定时器存在，说明已经有待执行的绘图操作
    }
    
    drawThrottleTimer = window.setTimeout(() => {
      draw(mapX, mapY);
      drawThrottleTimer = null;
    }, delay);
  };
  
  // 创建坐标转换工具
  const coordTransform = useCoordinateTransform(
    offsetX,
    offsetY,
    scale
  );
  
  // 创建绘图Worker
  const drawingWorker = useDrawingWorker();
  
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
  
  // 地形类型到颜色的映射
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
  
  // 撤销操作
  function undo() {
    mapCacheStore.undo(layerId);
    refreshCanvas();
  }
  
  // 重做操作
  function redo() {
    mapCacheStore.redo(layerId);
    refreshCanvas();
  }
  
  // 清空缓存
  function clearCache() {
    mapCacheStore.clear(layerId);
    cacheInitialized.value = false;
    refreshCanvas();
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
   * 开始绘制
   * @param mapX 地图X坐标（而非画布坐标）
   * @param mapY 地图Y坐标（而非画布坐标）
   * @remarks 这个函数接收的是地图坐标，而不是画布坐标。调用前应该确保坐标点在地图区域内。
   */
  function startDrawing(mapX: number, mapY: number) {
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
    
    // 清空点集合，添加第一个点
    drawState.value.currentPoints = [];
    drawState.value.currentPoints.push({ x: mapX, y: mapY, timestamp: now });
    drawState.value.lastDrawnPointIndex = 0; // 重置最后绘制点索引
    
    // 转换到画布坐标用于保存最后位置
    const canvasPoint = coordTransform.mapToCanvas(mapX, mapY);
    drawState.value.lastX = canvasPoint.x;
    drawState.value.lastY = canvasPoint.y;
    
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
   * 根据点之间的距离将点集合分割成多个连续段
   * 如果两点之间距离过大，则认为它们属于不同的线段
   * @param points 原始点集合
   * @returns 分段后的点集合数组
   */
  function splitByDistance(points: {x: number, y: number, timestamp?: number}[]): {x: number, y: number}[][] {
    if (points.length <= 1) return [points];
    
    // 最大距离阈值，超过这个距离就认为是不同的线段
    // 增加阈值，但仍保持适度的检测敏感度
    const MAX_DISTANCE = 80; // 从30增加到80
    
    // 使用更智能的分段逻辑，考虑速度因素
    const segments: {x: number, y: number}[][] = [];
    let currentSegment: {x: number, y: number}[] = [points[0]];
    
    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1];
      const currentPoint = points[i];
      
      // 计算两点之间的距离
      const distance = Math.sqrt(
        Math.pow(currentPoint.x - prevPoint.x, 2) + 
        Math.pow(currentPoint.y - prevPoint.y, 2)
      );
      
      // 如果有时间戳，计算时间差和速度
      let timeDiff = 0;
      let speed = 0;
      if (prevPoint.timestamp && currentPoint.timestamp) {
        timeDiff = currentPoint.timestamp - prevPoint.timestamp;
        // 防止除以零
        if (timeDiff > 0) {
          speed = distance / timeDiff; // 单位: 像素/毫秒
        }
      }
      
      // 根据速度动态调整距离阈值
      // 速度越快，允许的最大距离越大
      let dynamicMaxDistance = MAX_DISTANCE;
      if (speed > 0) {
        // 速度超过0.5像素/毫秒时，开始增加允许的最大距离
        if (speed > 0.5) {
          // 随着速度增加而增大允许的最大距离，但有上限
          dynamicMaxDistance = Math.min(250, MAX_DISTANCE + speed * 100);
        }
      }
      
      // 根据距离或时间差异判断是否为不同线段
      // 对于高速移动，允许更大的距离；对于低速移动，保持严格检测
      if (distance > dynamicMaxDistance || timeDiff > 500) { // 增加时间阈值
        // 如果距离过大或时间差异太大，当前点是新线段的起点
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
        }
        currentSegment = [currentPoint];
      } else {
        // 距离合理，添加到当前线段
        currentSegment.push(currentPoint);
      }
    }
    
    // 添加最后一个线段
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }
    
    return segments;
  }
  
  /**
   * 执行绘制
   * @param mapX 地图X坐标（而非画布坐标）
   * @param mapY 地图Y坐标（而非画布坐标）
   * @remarks 这个函数接收的是地图坐标，而不是画布坐标。调用前应该确保坐标点在地图区域内。
   */
  function draw(mapX: number, mapY: number) {
    if (!drawState.value.isDrawing) return;
    if (!cacheInitialized.value) {
      setTimeout(() => { if (cacheInitialized.value) draw(mapX, mapY); }, 50);
      return;
    }

    // 保存当前操作ID，以便后续检查操作是否仍然有效
    const currentOperationId = drawState.value.operationId;
    
    // 记录时间戳，用于点的标记和速度计算
    const now = Date.now();
    
    const newPoint = { x: mapX, y: mapY, timestamp: now };
    const lastPoint = drawState.value.currentPoints[drawState.value.currentPoints.length - 1];

    // 检查点之间的距离，如果距离太小，跳过本次绘制
    const dx = mapX - lastPoint.x;
    const dy = mapY - lastPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 如果距离小于阈值（例如0.5像素），跳过本次处理
    if (distance < 0.5) {
      return;
    }
    
    const timeDiff = Math.max(5, now - (drawState.value.lastTimestamp || now));
    drawState.value.lastTimestamp = now;
    const speed = distance / timeDiff; // 单位: 像素/毫秒
    
    // 根据速度动态调整距离阈值
    const baseMaxDistance = 60; // 增加基础最大距离
    // 速度越快，允许的最大距离越大
    const dynamicMaxDistance = Math.max(baseMaxDistance, speed * 400);
    
    // 速度相关的最大允许距离，用于点距离检查
    // 随着速度增加允许更大的距离
    const speedBasedMaxDistance = Math.min(200, 40 + speed * 150);

    // 当Worker可用且没有正在处理请求时，使用Worker进行插值计算
    if (drawingWorker.isWorkerAvailable() && !drawState.value.workerProcessing && drawState.value.currentPoints.length >= 2) {
      // 标记Worker正在处理
      drawState.value.workerProcessing = true;
      
      // 将当前点集合拷贝一份发送给Worker
      const pointsToSend = drawState.value.currentPoints.map(p => ({ x: p.x, y: p.y }));
      
      // 使用Worker计算插值点
      drawingWorker.calculateInterpolatedPoints(
        pointsToSend,
        newPoint,
        distance,
        speed,
        baseMaxDistance,
        dynamicMaxDistance,
        (result) => {
          // 确保操作ID仍然有效，防止过时的回调继续执行
          if (currentOperationId !== drawState.value.operationId) {
            drawState.value.workerProcessing = false;
            return;
          }
          
          // 收到Worker计算结果
          if (result.interpolatedPoints.length > 0) {
            // 检查每个计算出的点与前一个点的距离，避免远距离连接
            let lastValidPoint = drawState.value.currentPoints[drawState.value.currentPoints.length - 1];
            
            for (const p of result.interpolatedPoints) {
              const ptDistance = Math.sqrt(
                Math.pow(p.x - lastValidPoint.x, 2) + 
                Math.pow(p.y - lastValidPoint.y, 2)
              );
              
              // 使用基于速度的动态距离阈值
              // 速度快时允许更大的距离
              if (ptDistance <= speedBasedMaxDistance) {
                drawState.value.currentPoints.push({
                  x: p.x, 
                  y: p.y, 
                  timestamp: now
                });
                lastValidPoint = { x: p.x, y: p.y, timestamp: now };
              }
            }
          }
          
          // 添加新点
          const lastAddedPoint = drawState.value.currentPoints[drawState.value.currentPoints.length - 1];
          const finalDistance = Math.sqrt(
            Math.pow(newPoint.x - lastAddedPoint.x, 2) + 
            Math.pow(newPoint.y - lastAddedPoint.y, 2)
          );
          
          // 使用基于速度的动态距离阈值
          if (finalDistance <= speedBasedMaxDistance) {
            drawState.value.currentPoints.push(newPoint);
          }
          
          // 限制最大点数
          while (drawState.value.currentPoints.length > drawState.value.maxPoints) {
            drawState.value.currentPoints.shift();
          }
          
          // 更新canvas坐标
          const canvasPoint = coordTransform.mapToCanvas(mapX, mapY);
          drawState.value.lastX = canvasPoint.x;
          drawState.value.lastY = canvasPoint.y;
          
          // 重置Worker状态
          drawState.value.workerProcessing = false;
          
          // 调用绘图
          requestDrawing();
        }
      );
    } else {
      // Worker不可用或已有任务在处理，使用原本的插值逻辑
      if (drawState.value.currentPoints.length >= 2) {
        // 根据速度动态调整距离阈值
        // 速度快时，直接添加点而不做过多插值，防止计算量过大
        const highSpeedThreshold = 1.0; // 单位: 像素/毫秒
        
        if (speed > highSpeedThreshold && distance > 80) {
          // 高速移动且距离较大时，沿着方向线性插值几个点
          const pointsToAdd = Math.min(6, Math.floor(distance / 40));
          
          if (pointsToAdd > 1) {
            for (let i = 1; i < pointsToAdd; i++) {
              const ratio = i / pointsToAdd;
              // 使用平滑的缓动函数
              const smoothRatio = ratio * ratio * (3 - 2 * ratio);
              drawState.value.currentPoints.push({
                x: lastPoint.x + dx * smoothRatio,
                y: lastPoint.y + dy * smoothRatio,
                timestamp: now - Math.floor((1 - ratio) * timeDiff)
              });
            }
          }
          
          // 添加终点
          drawState.value.currentPoints.push(newPoint);
        } else {
          // 正常速度下的插值逻辑
          // 提高距离阈值，确保在快速移动时也能进入更好的插值算法分支
          if (distance > 2 && distance < dynamicMaxDistance) {
            // 增加基础插值点数量，但随着速度增加而减少点数，防止过度计算
            // 速度越快，插入的点越少
            const pointsFactorBySpeed = Math.max(1, Math.min(8, 12 - Math.floor(speed * 5)));
            const basePointsToAdd = Math.min(pointsFactorBySpeed, Math.max(2, Math.floor(distance / 5))); 
            const speedFactor = Math.min(3, Math.max(1, speed * 10)); // 减小速度因子影响
            const pointsToAdd = Math.floor(basePointsToAdd);
            
            // 优先使用三次贝塞尔曲线，即使点数较少
            if (drawState.value.currentPoints.length >= 3) {
              const p0 = drawState.value.currentPoints[drawState.value.currentPoints.length - 3];
              const p1 = drawState.value.currentPoints[drawState.value.currentPoints.length - 2];
              const p2 = lastPoint;
              const p3 = newPoint;
              
              // 计算控制点
              for (let i = 1; i <= pointsToAdd; i++) {
                const t = i / (pointsToAdd + 1);
                const c1x = p1.x + (p2.x - p0.x) / 6;
                const c1y = p1.y + (p2.y - p0.y) / 6;
                const c2x = p2.x - (p3.x - p1.x) / 6;
                const c2y = p2.y - (p3.y - p1.y) / 6;
                
                // 贝塞尔曲线插值
                const x = Math.pow(1-t, 3) * p1.x 
                        + 3 * Math.pow(1-t, 2) * t * c1x 
                        + 3 * (1-t) * Math.pow(t, 2) * c2x 
                        + Math.pow(t, 3) * p2.x;
                const y = Math.pow(1-t, 3) * p1.y 
                        + 3 * Math.pow(1-t, 2) * t * c1y 
                        + 3 * (1-t) * Math.pow(t, 2) * c2y 
                        + Math.pow(t, 3) * p2.y;
                
                // 动态插值的时间戳
                const pointTimestamp = now - Math.floor((1 - t) * timeDiff);
                
                // 检查插值点与上一个点的距离
                const lastAddedPoint = drawState.value.currentPoints[drawState.value.currentPoints.length - 1];
                const ptDistance = Math.sqrt(
                  Math.pow(x - lastAddedPoint.x, 2) + 
                  Math.pow(y - lastAddedPoint.y, 2)
                );
                
                // 使用基于速度的动态距离阈值
                if (ptDistance <= speedBasedMaxDistance) {
                  drawState.value.currentPoints.push({ 
                    x, 
                    y,
                    timestamp: pointTimestamp
                  });
                }
              }
            } else {
              // 使用二次贝塞尔曲线插值，确保曲线平滑
              const p0 = drawState.value.currentPoints[drawState.value.currentPoints.length - 2];
              const p1 = lastPoint;
              const p2 = newPoint;
              
              for (let i = 1; i <= pointsToAdd; i++) {
                const t = i / (pointsToAdd + 1);
                const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
                const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
                
                // 动态插值的时间戳
                const pointTimestamp = now - Math.floor((1 - t) * timeDiff);
                
                // 检查插值点与上一个点的距离
                const lastAddedPoint = drawState.value.currentPoints[drawState.value.currentPoints.length - 1];
                const ptDistance = Math.sqrt(
                  Math.pow(x - lastAddedPoint.x, 2) + 
                  Math.pow(y - lastAddedPoint.y, 2)
                );
                
                // 使用基于速度的动态距离阈值
                if (ptDistance <= speedBasedMaxDistance) {
                  drawState.value.currentPoints.push({
                    x, 
                    y,
                    timestamp: pointTimestamp
                  });
                }
              }
            }
          }
          
          // 添加新点
          const lastAddedPoint = drawState.value.currentPoints[drawState.value.currentPoints.length - 1];
          const finalDistance = Math.sqrt(
            Math.pow(mapX - lastAddedPoint.x, 2) + 
            Math.pow(mapY - lastAddedPoint.y, 2)
          );
          
          // 使用动态距离阈值
          if (finalDistance <= speedBasedMaxDistance) {
            drawState.value.currentPoints.push({
              x: mapX, 
              y: mapY,
              timestamp: now
            });
          }
        }
      } else {
        // 点数不足时直接添加
        drawState.value.currentPoints.push({
          x: mapX, 
          y: mapY,
          timestamp: now
        });
      }
      
      // 限制最大点数
      while (drawState.value.currentPoints.length > drawState.value.maxPoints) {
        drawState.value.currentPoints.shift();
      }
      
      const canvasPoint = coordTransform.mapToCanvas(mapX, mapY);
      drawState.value.lastX = canvasPoint.x;
      drawState.value.lastY = canvasPoint.y;

      // 请求绘制
      requestDrawing();
    }
  }
  
  /**
   * 使用requestAnimationFrame请求绘制
   * 避免过多的绘制调用导致性能问题
   */
  function requestDrawing() {
    if (!drawState.value.animationFrameId) {
      drawState.value.animationFrameId = requestAnimationFrame(() => {
        drawPen();
        drawState.value.animationFrameId = undefined;
      });
    }
  }
  
  // 画笔工具实现 - 只根据点集合绘制曲线
  function drawPen() {
    try {
      const points = drawState.value.currentPoints;
      if (points.length < 2) return;
      const cacheCtx = mapCacheStore.getContext(layerId);
      if (!cacheCtx) return;
      const lineWidth = drawState.value.lineWidth;
      const color = getTerrainColor(drawState.value.terrainType);
      cacheCtx.save();
      cacheCtx.globalCompositeOperation = 'source-over';
      cacheCtx.strokeStyle = color;
      cacheCtx.lineWidth = lineWidth;
      cacheCtx.lineJoin = 'round';
      cacheCtx.lineCap = 'round';
      
      // 改进绘制算法，优先使用贝塞尔曲线绘制
      if (points.length >= 3) {
        // 检测点之间的距离，防止远距离点自动连接
        const segmentPoints = splitByDistance(points);
        
        // 分段绘制每一组连续的点
        for (const segment of segmentPoints) {
          if (segment.length < 2) continue; // 忽略单点段
          
          if (segment.length >= 3) {
            // 使用贝塞尔曲线绘制多点段
            cacheCtx.beginPath();
            cacheCtx.moveTo(segment[0].x, segment[0].y);
            
            // 使用更高级的曲线算法
            for (let i = 1; i < segment.length - 2; i++) {
              const xc = (segment[i].x + segment[i + 1].x) / 2;
              const yc = (segment[i].y + segment[i + 1].y) / 2;
              cacheCtx.quadraticCurveTo(segment[i].x, segment[i].y, xc, yc);
            }
            
            // 处理最后几个点
            const lastIndex = segment.length - 1;
            const secondLastIndex = segment.length - 2;
            
            // 确保曲线到达最后一个点
            cacheCtx.quadraticCurveTo(
              segment[secondLastIndex].x,
              segment[secondLastIndex].y,
              segment[lastIndex].x,
              segment[lastIndex].y
            );
            
            cacheCtx.stroke();
          } else if (segment.length === 2) {
            // 处理只有两个点的段落
            cacheCtx.beginPath();
            cacheCtx.moveTo(segment[0].x, segment[0].y);
            
            // 在两点之间创建一个控制点，使线条看起来更平滑
            const controlX = (segment[0].x + segment[1].x) / 2;
            const controlY = (segment[0].y + segment[1].y) / 2;
            
            // 使用二次贝塞尔曲线
            cacheCtx.quadraticCurveTo(
              controlX,
              controlY,
              segment[1].x,
              segment[1].y
            );
            
            cacheCtx.stroke();
          }
        }
      } else if (points.length === 2) {
        // 即使只有两个点，也尝试绘制平滑曲线
        cacheCtx.beginPath();
        cacheCtx.moveTo(points[0].x, points[0].y);
        
        // 在两点之间创建一个控制点，使线条看起来更平滑
        const controlX = (points[0].x + points[1].x) / 2;
        const controlY = (points[0].y + points[1].y) / 2;
        
        // 使用二次贝塞尔曲线
        cacheCtx.quadraticCurveTo(
          controlX,
          controlY,
          points[1].x,
          points[1].y
        );
        
        cacheCtx.stroke();
      } else {
        // 简单线段绘制（应该很少执行到这里）
        cacheCtx.beginPath();
        cacheCtx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          cacheCtx.lineTo(points[i].x, points[i].y);
        }
        
        cacheCtx.stroke();
      }
      
      cacheCtx.restore();
      mapCacheStore.getLayer(layerId).saveHistory();

      // 在绘制到缓存后需要将结果显示到画布上
      refreshCanvas();
    } catch (error) {
      console.error('❗ 画笔绘制失败:', error);
    }
  }
  
  // 橡皮擦工具实现 - 直接操作像素缓存
  function drawEraser(ctx: CanvasRenderingContext2D, x: number, y: number) {
    try {
      // 获取当前所有点
      const points = drawState.value.currentPoints;
      
      // 至少需要2个点才能擦除
      if (points.length < 2) {
        return;
      }
      
      // 获取mapCacheStore的绘图上下文
      const cacheCtx = mapCacheStore.getContext(layerId);
      if (!cacheCtx) {
        console.error('无法获取缓存图层上下文');
        return;
      }
      
      // 获取视图状态用于调整线宽
      const view = { offsetX: offsetX.value, offsetY: offsetY.value, scale: scale.value };
      
      // 橡皮擦线宽也需要与缩放比例正相关
      // 橡皮擦通常比画笔宽一些，所以乘以2
      const lineWidth = (drawState.value.lineWidth * 2);
      
      // 保存当前状态
      cacheCtx.save();
      
      // 设置擦除模式
      cacheCtx.globalCompositeOperation = 'destination-out';
      cacheCtx.lineWidth = lineWidth;
      cacheCtx.lineJoin = 'round';
      cacheCtx.lineCap = 'round';
      
      // 检测点之间的距离，防止远距离点自动连接
      const segmentPoints = splitByDistance(points);
      
      // 分段擦除每一组连续的点
      for (const segment of segmentPoints) {
        if (segment.length < 2) continue; // 忽略单点段
        
        if (segment.length >= 3) {
          // 使用二次贝塞尔曲线平滑绘制
          cacheCtx.beginPath();
          cacheCtx.moveTo(segment[0].x, segment[0].y);
          
          for (let i = 1; i < segment.length - 1; i++) {
            const xc = (segment[i].x + segment[i + 1].x) / 2;
            const yc = (segment[i].y + segment[i + 1].y) / 2;
            
            cacheCtx.quadraticCurveTo(
              segment[i].x, 
              segment[i].y,
              xc, yc
            );
          }
          
          const lastIndex = segment.length - 1;
          cacheCtx.lineTo(segment[lastIndex].x, segment[lastIndex].y);
          cacheCtx.stroke();
        } else {
          // 简单线段绘制
          cacheCtx.beginPath();
          cacheCtx.moveTo(segment[0].x, segment[0].y);
          cacheCtx.lineTo(segment[1].x, segment[1].y);
          cacheCtx.stroke();
        }
      }
      
      cacheCtx.restore();
      
      // 保存历史记录
      mapCacheStore.getLayer(layerId).saveHistory();
    } catch (error) {
      console.error('橡皮擦擦除失败:', error);
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
      
      // 确保最后一次绘制完成
      if (drawState.value.currentPoints.length > 0) {
        requestDrawing();
      }
      
      // 清空点集合
      setTimeout(() => {
        drawState.value.currentPoints = [];
        drawState.value.lastDrawnPointIndex = -1;
      }, 100);
    }
  }
  
  // 设置当前工具
  function setCurrentTool(tool: DrawToolType) {
    console.log(`设置当前工具为: ${tool}`);
    drawState.value.currentTool = tool;
  }
  
  // 设置线条宽度
  function setLineWidth(width: number) {
    console.log(`设置线宽为: ${width}`);
    drawState.value.lineWidth = width;
  }
  
  // 设置地形类型
  function setTerrainType(terrain: string) {
    console.log(`设置地形类型为: ${terrain}`);
    drawState.value.terrainType = terrain;
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
  
  // 导出接口
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
    stopDrawing,
    getDrawingContext,
    renderCacheTo,
    clearCache,
    toDataURL,
    refreshCanvas,
    loadBaseMap,
  };
}
