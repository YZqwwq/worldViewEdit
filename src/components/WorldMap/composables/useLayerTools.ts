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

// 修改点类型定义，添加isPredicted属性
interface DrawPoint {
  x: number;
  y: number;
  timestamp?: number;
  pressure?: number;
  isPredicted?: boolean;
}

/**
 * 将点集合根据距离分割成多个子路径
 * 当两点之间距离超过阈值，则认为是断开的路径
 * @param points 点集合
 * @param maxDistance 最大距离阈值，默认为100
 * @returns 分割后的子路径数组
 */
function splitByDistance(
  points: DrawPoint[], 
  maxDistance: number = 100
): DrawPoint[][] {
  if (points.length < 2) {
    return [points]; // 点数少于2，直接返回原数组
  }
  
  const segments: DrawPoint[][] = [];
  let currentSegment: DrawPoint[] = [points[0]];
  
  // 计算最大速度 - 根据时间戳计算最大速度，用于动态调整分段阈值
  let maxSpeed = 0;
  let avgSpeed = 0;
  let totalPoints = 0;
  let totalDistance = 0;
  
  for (let i = 1; i < points.length; i++) {
    const prevPoint = points[i - 1];
    const currentPoint = points[i];
    
    if (prevPoint.timestamp && currentPoint.timestamp) {
      const timeDiff = Math.max(1, currentPoint.timestamp - prevPoint.timestamp);
      const dx = currentPoint.x - prevPoint.x;
      const dy = currentPoint.y - prevPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const speed = distance / timeDiff;
      
      // 累计平均速度计算
      totalDistance += distance;
      totalPoints++;
      
      // 记录最大速度
      if (speed > maxSpeed) {
        maxSpeed = speed;
      }
    }
  }
  
  // 计算平均速度
  if (totalPoints > 0) {
    avgSpeed = totalDistance / totalPoints;
  }
  
  // 基于最大速度和平均速度动态调整分段距离阈值
  // 最大速度越高，阈值越大，但也考虑平均速度以减少误判
  const speedAdjustedDistance = Math.min(350, maxDistance * (1 + maxSpeed * 8 + avgSpeed * 2));
  
  for (let i = 1; i < points.length; i++) {
    const prevPoint = points[i - 1];
    const currentPoint = points[i];
    
    // 计算两点之间距离
    const dx = currentPoint.x - prevPoint.x;
    const dy = currentPoint.y - prevPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 计算时间差和点的速度
    let pointSpeed = 0;
    let timeDiff = 0;
    
    if (prevPoint.timestamp && currentPoint.timestamp) {
      timeDiff = Math.max(1, currentPoint.timestamp - prevPoint.timestamp);
      pointSpeed = distance / timeDiff;
    
      // 使用动态调整后的阈值
      if (distance > speedAdjustedDistance) {
        // 判断是真正的断开还是快速移动
        const isLikelyFastMovement = timeDiff < 100 && pointSpeed > avgSpeed * 1.5;
        
        if (!isLikelyFastMovement && timeDiff > 150) { // 超过150ms认为是可能的断开
          // 保存当前段
          if (currentSegment.length > 0) {
            segments.push(currentSegment);
            currentSegment = [currentPoint];
          }
        } else {
          // 时间间隔不大但距离大，可能是快速移动，插入预测点
          const pointsToAdd = Math.max(1, Math.min(5, Math.floor(distance / 50)));
          for (let j = 1; j <= pointsToAdd; j++) {
            const ratio = j / (pointsToAdd + 1);
            const interpolatedPoint: DrawPoint = {
              x: prevPoint.x + dx * ratio,
              y: prevPoint.y + dy * ratio,
              timestamp: prevPoint.timestamp + timeDiff * ratio,
              pressure: prevPoint.pressure
            };
            currentSegment.push(interpolatedPoint);
          }
          // 添加当前点到现有段
          currentSegment.push(currentPoint);
        }
      } else {
        // 距离在阈值内，添加到当前段
        currentSegment.push(currentPoint);
      }
    } else {
      // 没有时间戳信息，使用传统分段
      if (distance > speedAdjustedDistance) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [currentPoint];
        }
      } else {
        // 距离在阈值内，添加到当前段
        currentSegment.push(currentPoint);
      }
    }
  }
  
  // 添加最后一段（如果不为空）
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }
  
  return segments;
}

/**
 * 计算两点之间的绘制参数
 * @param p1 第一个点
 * @param p2 第二个点
 * @param timeDiff 时间差(ms)
 * @param baseLineWidth 基础线宽
 * @returns 包含速度、加速度和平滑度参数的对象
 */
function calculateDrawingParams(
  p1: DrawPoint, 
  p2: DrawPoint,
  timeDiff: number,
  baseLineWidth: number
) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // 计算速度 (像素/毫秒)
  const speed = distance / Math.max(1, timeDiff);
  
  // 动态线宽：速度越快，线条越细，但不要太细
  // 使用平滑的曲线函数，避免高速时线宽突变
  const speedFactor = Math.min(0.7, 0.5 * Math.tanh(speed * 0.3));
  const dynamicLineWidth = Math.max(
    baseLineWidth * 0.65,
    baseLineWidth * (1 - speedFactor)
  );
  
  // 动态平滑度：速度越快，平滑度略高，确保高速移动时曲线更平滑
  // 高速移动时需要更高的平滑度避免锯齿
  const smoothness = Math.max(0.2, Math.min(0.4, 0.2 + speed * 0.05));
  
  // 动态最大距离：速度越快，允许的点之间最大距离越大
  // 提高高速移动时的最大距离阈值，减少断线
  const dynamicMaxDistance = Math.min(350, 60 + speed * 250);
  
  // 计算基于速度的插值点数量
  // 速度越快插值点越多，确保曲线平滑
  const baseInterpolationPoints = 5;
  const speedBasedPoints = Math.ceil(speed * 12);
  const interpolationPoints = Math.max(
    baseInterpolationPoints, 
    Math.min(20, baseInterpolationPoints + speedBasedPoints)
  );
  
  // 计算张力系数 - 速度越快张力越小，曲线越平滑
  const tension = Math.max(0.15, 0.35 - Math.min(0.2, speed * 0.05));
  
  return {
    speed,
    distance,
    dynamicLineWidth,
    smoothness,
    dynamicMaxDistance,
    interpolationPoints,
    tension
  };
}

/**
 * 生成更平滑的贝塞尔曲线控制点
 * @param points 点集合或点对
 * @param tension 张力系数 (0-1)
 * @returns 三次贝塞尔曲线的控制点
 */
function getBezierControlPoints(
  points: DrawPoint[],
  tension: number = 0.2
) {
  if (points.length < 2) {
    return null;
  }
  
  // 处理只有两个点的情况 - 创建虚拟辅助点
  if (points.length === 2) {
    const p0 = points[0];
    const p1 = points[1];
    
    // 计算两点之间的向量
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    
    // 使用单位向量方向创建控制点，位于两点之间
    const dist = Math.sqrt(dx * dx + dy * dy);
    const normalizedDx = dx / dist;
    const normalizedDy = dy / dist;
    
    // 控制点沿线段放置，使曲线平滑
    const cp1 = {
      x: p0.x + normalizedDx * dist * 0.33,
      y: p0.y + normalizedDy * dist * 0.33
    };
    
    const cp2 = {
      x: p0.x + normalizedDx * dist * 0.66,
      y: p0.y + normalizedDy * dist * 0.66
    };
    
    return { cp1, cp2 };
  }
  
  // 处理三个或四个点 - 使用改进的控制点计算方法
  if (points.length >= 3) {
    // 获取需要计算控制点的主要点
    const p1 = points.length === 3 ? points[0] : points[1];
    const p2 = points.length === 3 ? points[1] : points[2];
    const p0 = points.length === 3 ? points[0] : points[0]; // 为三点情况复制第一个点作为p0
    const p3 = points.length === 3 ? points[2] : points[3];
    
    // 计算控制点间距
    const d1 = Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2));
    const d2 = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    const d3 = Math.sqrt(Math.pow(p3.x - p2.x, 2) + Math.pow(p3.y - p2.y, 2));
    
    // 根据相邻点的距离比例调整张力
    const scale1 = tension * (d2 / (d1 + d2));
    const scale2 = tension * (d2 / (d2 + d3));
    
    // 避免除以零错误
    const validScale1 = isNaN(scale1) ? tension : scale1;
    const validScale2 = isNaN(scale2) ? tension : scale2;
    
    // 计算控制点1 - 根据p0->p2向量和距离比例
    const cp1 = {
      x: p1.x + validScale1 * (p2.x - p0.x),
      y: p1.y + validScale1 * (p2.y - p0.y)
    };
    
    // 计算控制点2 - 根据p1->p3向量和距离比例
    const cp2 = {
      x: p2.x - validScale2 * (p3.x - p1.x),
      y: p2.y - validScale2 * (p3.y - p1.y)
    };
    
    return { cp1, cp2 };
  }
  
  // 其他情况使用默认控制点
  return null;
}

/**
 * 简化路径点，减少冗余点
 * 使用Ramer-Douglas-Peucker算法
 * @param points 原始点集合
 * @param epsilon 简化阈值
 * @returns 简化后的点集合
 */
function simplifyPath(
  points: DrawPoint[], 
  epsilon: number = 1.0
): DrawPoint[] {
  // 少于3个点不需要简化
  if (points.length < 3) return points;
  
  // 计算点到线段的距离
  function perpendicularDistance(
    p: DrawPoint, 
    lineStart: DrawPoint, 
    lineEnd: DrawPoint
  ): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    
    // 线段长度的平方
    const lineLengthSq = dx * dx + dy * dy;
    
    // 如果线段长度为零，直接返回点到起点的距离
    if (lineLengthSq === 0) return Math.sqrt((p.x - lineStart.x) ** 2 + (p.y - lineStart.y) ** 2);
    
    // 计算投影比例
    const t = ((p.x - lineStart.x) * dx + (p.y - lineStart.y) * dy) / lineLengthSq;
    
    // 投影点在线段外
    if (t < 0) return Math.sqrt((p.x - lineStart.x) ** 2 + (p.y - lineStart.y) ** 2);
    if (t > 1) return Math.sqrt((p.x - lineEnd.x) ** 2 + (p.y - lineEnd.y) ** 2);
    
    // 投影点在线段上
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    
    return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
  }
  
  // 递归简化
  function rdpRecursive(
    points: DrawPoint[], 
    startIndex: number, 
    endIndex: number, 
    epsilon: number, 
    result: boolean[]
  ): void {
    if (endIndex - startIndex <= 1) return;
    
    const start = points[startIndex];
    const end = points[endIndex];
    
    let maxDistance = 0;
    let maxIndex = 0;
    
    // 查找距离最大的点
    for (let i = startIndex + 1; i < endIndex; i++) {
      const distance = perpendicularDistance(points[i], start, end);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    
    // 如果最大距离大于阈值，保留该点并递归处理子段
    if (maxDistance > epsilon) {
      result[maxIndex] = true;
      rdpRecursive(points, startIndex, maxIndex, epsilon, result);
      rdpRecursive(points, maxIndex, endIndex, epsilon, result);
    }
  }
  
  // 初始化结果数组，首尾点必须保留
  const result = Array(points.length).fill(false);
  result[0] = true;
  result[points.length - 1] = true;
  
  // 执行简化
  rdpRecursive(points, 0, points.length - 1, epsilon, result);
  
  // 根据结果数组筛选点
  return points.filter((_, i) => result[i]);
}

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
  currentPoints: DrawPoint[]; // 使用DrawPoint类型
  maxPoints: number;
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
  drawEraser: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  startDrawing: (mapX: number, mapY: number, event?: PointerEvent) => void;
  draw: (mapX: number, mapY: number, event?: PointerEvent) => void;
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
   * 开始绘制，支持高频率手写笔和触摸设备事件
   * @param mapX 地图X坐标（而非画布坐标）
   * @param mapY 地图Y坐标（而非画布坐标）
   * @param event 原始指针事件，用于获取getCoalescedEvents
   * @remarks 这个函数接收的是地图坐标，而不是画布坐标。调用前应该确保坐标点在地图区域内。
   */
  function startDrawing(mapX: number, mapY: number, event?: PointerEvent) {
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
    
    // 清空点集合
    drawState.value.currentPoints = [];
    
    // 如果提供了原始事件且支持getCoalescedEvents，则处理合并事件
    if (event && 'getCoalescedEvents' in event && typeof event.getCoalescedEvents === 'function') {
      const events = event.getCoalescedEvents();
      
      // 如果有合并事件，处理所有事件
      if (events.length > 1) {
        console.log(`获取到 ${events.length} 个合并事件点`);
        
        // 添加所有合并事件点
        for (const e of events) {
          // 转换事件坐标到地图坐标
          const rect = activeLayer.canvas.getBoundingClientRect();
          const canvasX = e.clientX - rect.left;
          const canvasY = e.clientY - rect.top;
          const pointCoord = coordTransform.canvasToMap(canvasX, canvasY);
          
          // 添加点，包含压力信息（如果可用）和时间戳
          drawState.value.currentPoints.push({
            x: pointCoord.x,
            y: pointCoord.y,
            timestamp: e.timeStamp || now,
            pressure: e.pressure !== undefined ? e.pressure : 1.0
          } as DrawPoint);
        }
        
        // 记录最后一个点的位置
        const lastEvent = events[events.length - 1];
        const rect = activeLayer.canvas.getBoundingClientRect();
        const lastCanvasX = lastEvent.clientX - rect.left;
        const lastCanvasY = lastEvent.clientY - rect.top;
        drawState.value.lastX = lastCanvasX;
        drawState.value.lastY = lastCanvasY;
      } else {
        // 没有合并事件或不支持，只添加当前点
        drawState.value.currentPoints.push({
          x: mapX,
          y: mapY,
          timestamp: now,
          pressure: event.pressure !== undefined ? event.pressure : 1.0
        } as DrawPoint);
        
        // 转换到画布坐标用于保存最后位置
        const canvasPoint = coordTransform.mapToCanvas(mapX, mapY);
        drawState.value.lastX = canvasPoint.x;
        drawState.value.lastY = canvasPoint.y;
      }
    } else {
      // 没有提供原始事件，只添加当前点
      drawState.value.currentPoints.push({
        x: mapX,
        y: mapY,
        timestamp: now,
        pressure: 1.0 // 默认压力
      } as DrawPoint);
      
      // 转换到画布坐标用于保存最后位置
      const canvasPoint = coordTransform.mapToCanvas(mapX, mapY);
      drawState.value.lastX = canvasPoint.x;
      drawState.value.lastY = canvasPoint.y;
    }
    
    // 处理点集合，简化路径（如果点数足够）
    if (drawState.value.currentPoints.length > 10) {
      drawState.value.currentPoints = simplifyPath(drawState.value.currentPoints, 1.0);
    }
    
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
   * 绘制处理函数
   * @param mapX X坐标
   * @param mapY Y坐标
   * @param event 原始指针事件（如果有）
   */
  function draw(mapX: number, mapY: number, event?: PointerEvent) {
    if (!drawState.value.isDrawing) return;
    
    // 移除对drawPreviewLine的调用
    
    if (!cacheInitialized.value) {
      setTimeout(() => { if (cacheInitialized.value) draw(mapX, mapY, event); }, 50);
      return;
    }

    // 保存当前操作ID，以便后续检查操作是否仍然有效
    const currentOperationId = drawState.value.operationId;
    
    // 记录时间戳
    const now = Date.now();
    const timeDiff = Math.max(5, now - (drawState.value.lastTimestamp || now));
    drawState.value.lastTimestamp = now;
    
    // 计算速度 - 用于判断是否是快速移动
    const canvasPoint = coordTransform.mapToCanvas(mapX, mapY);
    const moveDistance = Math.sqrt(
      Math.pow(canvasPoint.x - drawState.value.lastX, 2) + 
      Math.pow(canvasPoint.y - drawState.value.lastY, 2)
    );
    const moveSpeed = moveDistance / Math.max(1, timeDiff);
    const isHighSpeed = moveSpeed > 1.5; // 提高高速阈值，更准确地检测快速移动
    
    // 准备要处理的点列表
    const pointsToProcess: DrawPoint[] = [];
    
    // 如果提供了原始事件且支持getCoalescedEvents，处理所有合并事件
    if (event && 'getCoalescedEvents' in event && typeof event.getCoalescedEvents === 'function') {
      const events = event.getCoalescedEvents();
      
      // 如果有合并事件，处理所有事件
      if (events.length > 1) {
        // 获取当前活动的图层以获取Canvas位置
        const activeLayer = mapLayer.value || (layerManager ? layerManager.getLayer(LAYER_IDS.MAP) : null);
        if (!activeLayer || !activeLayer.canvas) return;
        
        const rect = activeLayer.canvas.getBoundingClientRect();
        
        // 处理所有合并事件
        for (const e of events) {
          // 转换事件坐标到地图坐标
          const canvasX = e.clientX - rect.left;
          const canvasY = e.clientY - rect.top;
          const pointCoord = coordTransform.canvasToMap(canvasX, canvasY);
          
          // 添加到处理队列
          pointsToProcess.push({
            x: pointCoord.x,
            y: pointCoord.y,
            timestamp: e.timeStamp || now,
            pressure: e.pressure !== undefined ? e.pressure : 1.0
          } as DrawPoint);
        }
        
        // 记录最后一个事件的Canvas坐标
        const lastEvent = events[events.length - 1];
        drawState.value.lastX = lastEvent.clientX - rect.left;
        drawState.value.lastY = lastEvent.clientY - rect.top;
      } else {
        // 没有合并事件，只处理当前点
        pointsToProcess.push({
          x: mapX,
          y: mapY,
          timestamp: now,
          pressure: event.pressure !== undefined ? event.pressure : 1.0
        } as DrawPoint);
        
        // 更新Canvas坐标
        drawState.value.lastX = canvasPoint.x;
        drawState.value.lastY = canvasPoint.y;
      }
    } else {
      // 没有提供原始事件，只处理当前点
      pointsToProcess.push({
        x: mapX,
        y: mapY,
        timestamp: now,
        pressure: 1.0 // 默认压力
      } as DrawPoint);
      
      // 更新Canvas坐标
      drawState.value.lastX = canvasPoint.x;
      drawState.value.lastY = canvasPoint.y;
    }
    
    // 现在处理所有收集到的点（来自合并事件或单个点）
    let lastValidPoint = drawState.value.currentPoints.length > 0 ? 
        drawState.value.currentPoints[drawState.value.currentPoints.length - 1] : null;
    
    // 在快速移动的情况下，如果当前点与最后一个点间隔较大，
    // 且点数量较少，则可能是因为采样率不足导致的，此时增加插值点
    if (isHighSpeed && lastValidPoint && pointsToProcess.length === 1) {
      const firstProcessPoint = pointsToProcess[0];
      const dx = firstProcessPoint.x - lastValidPoint.x;
      const dy = firstProcessPoint.y - lastValidPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 快速移动且距离较大时，增加插值点
      if (distance > 40) { // 降低距离阈值，更积极地进行插值
        // 根据速度和距离动态调整插值点数量
        const pointsToAdd = Math.max(3, Math.min(15, Math.floor(distance / 20)));
        
        // 创建并插入中间插值点
        const extraPoints: DrawPoint[] = [];
        for (let i = 1; i <= pointsToAdd; i++) {
          const ratio = i / (pointsToAdd + 1);
          // 使用三次贝塞尔函数的近似值来创建更自然的点分布
          const easeRatio = 3 * ratio * ratio - 2 * ratio * ratio * ratio;
          extraPoints.push({
            x: lastValidPoint.x + dx * easeRatio,
            y: lastValidPoint.y + dy * easeRatio,
            timestamp: lastValidPoint.timestamp ? 
                lastValidPoint.timestamp + (firstProcessPoint.timestamp! - lastValidPoint.timestamp) * easeRatio : undefined,
            pressure: lastValidPoint.pressure
          });
        }
        
        // 将额外点添加到处理队列前面
        pointsToProcess.unshift(...extraPoints);
      }
    }
    
    // 处理收集到的所有点
    for (const point of pointsToProcess) {
      // 如果没有上一个点，直接添加当前点
      if (!lastValidPoint) {
        drawState.value.currentPoints.push(point);
        lastValidPoint = point;
        continue;
      }
      
      // 计算与上一个点的距离和时间差
      const dx = point.x - lastValidPoint.x;
      const dy = point.y - lastValidPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const pointTimeDiff = Math.max(1, (point.timestamp || now) - (lastValidPoint.timestamp || now - timeDiff));
      
      // 如果距离太小，跳过（减少过于密集的点）
      if (distance < 0.5) {
        continue;
      }
      
      // 计算绘制参数 - 获取更多参数
      const drawParams = calculateDrawingParams(
        lastValidPoint, 
        point, 
        pointTimeDiff,
        drawState.value.lineWidth
      );
      
      // 根据速度动态生成插值点
      if (distance > 2 && distance < drawParams.dynamicMaxDistance) {
        // 使用计算得到的最佳插值点数量
        const pointsToAdd = drawParams.interpolationPoints;
        
        // 根据现有点数选择不同的插值算法
        if (drawState.value.currentPoints.length >= 3) {
          // 获取前几个点用于计算贝塞尔曲线
          const p0 = drawState.value.currentPoints[drawState.value.currentPoints.length - 3];
          const p1 = drawState.value.currentPoints[drawState.value.currentPoints.length - 2];
          const p2 = lastValidPoint;
          const p3 = point;
          
          // 使用优化的控制点计算方法，传入张力参数
          const controlPoints = getBezierControlPoints([p0, p1, p2, p3], drawParams.tension);
          
          if (controlPoints) {
            const cp1 = controlPoints.cp1;
            const cp2 = controlPoints.cp2;
          
            // 使用三次贝塞尔曲线插值
            for (let i = 1; i <= pointsToAdd; i++) {
              const t = i / (pointsToAdd + 1);
              
              // 计算贝塞尔曲线点
              const x = Math.pow(1-t, 3) * p1.x 
                      + 3 * Math.pow(1-t, 2) * t * cp1.x 
                      + 3 * (1-t) * Math.pow(t, 2) * cp2.x 
                      + Math.pow(t, 3) * p2.x;
              const y = Math.pow(1-t, 3) * p1.y 
                      + 3 * Math.pow(1-t, 2) * t * cp1.y 
                      + 3 * (1-t) * Math.pow(t, 2) * cp2.y 
                      + Math.pow(t, 3) * p2.y;
              
              // 动态插值的时间戳和压力
              const pointTimestamp: number = lastValidPoint.timestamp ? 
                  lastValidPoint.timestamp + t * pointTimeDiff : now;
              
              const pointPressure: number = (lastValidPoint.pressure !== undefined && point.pressure !== undefined) ?
                  lastValidPoint.pressure + t * (point.pressure - lastValidPoint.pressure) : 1.0;
              
              // 创建插值点
              const interpolatedPoint: DrawPoint = {
                x, 
                y,
                timestamp: pointTimestamp,
                pressure: pointPressure
              };
              
              // 检查与上一个点的距离，避免过近的点
              const lastAddedPoint = drawState.value.currentPoints[drawState.value.currentPoints.length - 1];
              const ptDistance = Math.sqrt(
                Math.pow(x - lastAddedPoint.x, 2) + 
                Math.pow(y - lastAddedPoint.y, 2)
              );
              
              // 使用基于速度的动态距离阈值
              if (ptDistance > 0.5 && ptDistance <= drawParams.dynamicMaxDistance) {
                drawState.value.currentPoints.push(interpolatedPoint);
                lastValidPoint = interpolatedPoint;
              }
            }
          } else {
            // 如果无法获取控制点，使用直线
            drawState.value.currentPoints.push(point);
            lastValidPoint = point;
          }
        } else if (drawState.value.currentPoints.length === 2) {
          // 使用三次贝塞尔曲线
          const p0 = drawState.value.currentPoints[0];
          const p1 = lastValidPoint;
          const p2 = point;
          
          // 为两点情况创建适当的控制点
          const controlPoints = getBezierControlPoints([p0, p1, p2], drawParams.tension);
          
          if (controlPoints) {
            const cp1 = controlPoints.cp1;
            const cp2 = controlPoints.cp2;
            
            for (let i = 1; i <= pointsToAdd; i++) {
              const t = i / (pointsToAdd + 1);
              
              // 三次贝塞尔曲线计算
              const x = Math.pow(1-t, 3) * p0.x 
                    + 3 * Math.pow(1-t, 2) * t * cp1.x 
                    + 3 * (1-t) * Math.pow(t, 2) * cp2.x 
                    + Math.pow(t, 3) * p2.x;
              const y = Math.pow(1-t, 3) * p0.y 
                    + 3 * Math.pow(1-t, 2) * t * cp1.y 
                    + 3 * (1-t) * Math.pow(t, 2) * cp2.y 
                    + Math.pow(t, 3) * p2.y;
              
              // 插值时间戳和压力
              const pointTimestamp: number = lastValidPoint.timestamp ? 
                  lastValidPoint.timestamp + t * pointTimeDiff : now;
              
              const pointPressure: number = (lastValidPoint.pressure !== undefined && point.pressure !== undefined) ?
                  lastValidPoint.pressure + t * (point.pressure - lastValidPoint.pressure) : 1.0;
              
              // 创建插值点
              const interpolatedPoint: DrawPoint = {
                x, 
                y,
                timestamp: pointTimestamp,
                pressure: pointPressure
              };
              
              // 检查距离
              const lastAddedPoint = drawState.value.currentPoints[drawState.value.currentPoints.length - 1];
              const ptDistance = Math.sqrt(
                Math.pow(x - lastAddedPoint.x, 2) + 
                Math.pow(y - lastAddedPoint.y, 2)
              );
              
              if (ptDistance > 0.5 && ptDistance <= drawParams.dynamicMaxDistance) {
                drawState.value.currentPoints.push(interpolatedPoint);
                lastValidPoint = interpolatedPoint;
              }
            }
          } else {
            // 后备方案，直接连线
            drawState.value.currentPoints.push(point);
            lastValidPoint = point;
          }
        }
      } else if (distance >= drawParams.dynamicMaxDistance && lastValidPoint) {
        // 对于距离过大的情况进行增强的插值
        // 高速移动时使用更多的插值点，提高曲线平滑度
        const pointsToAdd = Math.min(40, Math.floor(distance / 6));
        
        // 使用多重插值策略
        // 1. 前半段使用加速插值
        // 2. 后半段使用减速插值
        for (let i = 1; i <= pointsToAdd; i++) {
          const t = i / (pointsToAdd + 1);
          
          // 使用更平滑的非线性插值函数
          let smoothRatio;
          if (t < 0.5) {
            // 前半段: 缓入函数
            smoothRatio = 2 * t * t;
          } else {
            // 后半段: 缓出函数
            smoothRatio = -2 * Math.pow(t - 1, 2) + 1;
          }
          
          const interpolatedPoint: DrawPoint = {
            x: lastValidPoint.x + dx * smoothRatio,
            y: lastValidPoint.y + dy * smoothRatio,
            timestamp: lastValidPoint.timestamp ? 
                lastValidPoint.timestamp + smoothRatio * pointTimeDiff : now,
            pressure: (lastValidPoint.pressure !== undefined && point.pressure !== undefined) ?
                lastValidPoint.pressure + smoothRatio * (point.pressure - lastValidPoint.pressure) : 1.0
          };
          
          drawState.value.currentPoints.push(interpolatedPoint);
          lastValidPoint = interpolatedPoint;
        }
      }
      
      // 添加当前点（已经不是插值点）
      if (lastValidPoint) {
        const finalDistance = Math.sqrt(
          Math.pow(point.x - lastValidPoint.x, 2) + 
          Math.pow(point.y - lastValidPoint.y, 2)
        );
        
        if (finalDistance <= drawParams.dynamicMaxDistance) {
          drawState.value.currentPoints.push(point);
          lastValidPoint = point;
        }
      }
    }
    
    // 每100个点执行一次路径简化，减少不必要的点
    if (drawState.value.currentPoints.length > 100) {
      // 根据移动速度调整简化阈值
      const simplifyThreshold = Math.max(0.5, Math.min(2.0, 0.5 + moveSpeed / 2));
      drawState.value.currentPoints = simplifyPath(drawState.value.currentPoints, simplifyThreshold);
    }
    
    // 限制最大点数
    while (drawState.value.currentPoints.length > drawState.value.maxPoints) {
      drawState.value.currentPoints.shift();
    }
    
    // 请求绘制
    requestDrawing();
  }
  
  /**
   * 使用requestAnimationFrame请求绘制
   * 避免过多的绘制调用导致性能问题
   */
  function requestDrawing() {
    // 添加一个标记，表示有未处理的更新
    drawState.value.hasUnprocessedUpdate = true;
    
    if (!drawState.value.animationFrameId) {
      drawState.value.animationFrameId = requestAnimationFrame(() => {
        drawPen();
        refreshCanvas(); // 添加这一行，确保绘制后立即刷新可见画布
        drawState.value.animationFrameId = undefined;
        
        // 如果绘制完成后还有未处理的更新，再次请求绘制
        if (drawState.value.hasUnprocessedUpdate) {
          drawState.value.hasUnprocessedUpdate = false;
          requestDrawing();
        }
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
      
      // 获取当前时间，用于检测绘制是否花费太长时间
      const startTime = performance.now();
      const maxDrawTime = 16; // 最多使用16ms绘制，确保帧率
      
      const lineWidth = drawState.value.lineWidth;
      const color = getTerrainColor(drawState.value.terrainType);
      cacheCtx.save();
      cacheCtx.globalCompositeOperation = 'source-over';
      cacheCtx.strokeStyle = color;
      cacheCtx.lineJoin = 'round';
      cacheCtx.lineCap = 'round';
      
      // 计算整体速度信息，用于动态调整绘制参数
      let totalDistance = 0;
      let totalTime = 0;
      let hasTimeInfo = false;
      let maxSegmentDistance = 0;
      
      const lastPoint = points[points.length - 1];
      const firstPoint = points[0];
      
      // 如果有时间戳，计算平均速度并调整分段距离
      if (lastPoint.timestamp && firstPoint.timestamp && 
          lastPoint.timestamp > firstPoint.timestamp) {
        hasTimeInfo = true;
        totalTime = lastPoint.timestamp - firstPoint.timestamp;
        
        // 计算所有点之间的总距离和最大单段距离
        for (let i = 1; i < points.length; i++) {
          const dx = points[i].x - points[i-1].x;
          const dy = points[i].y - points[i-1].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          totalDistance += distance;
          maxSegmentDistance = Math.max(maxSegmentDistance, distance);
        }
      }
      
      // 根据平均速度和最大分段距离动态调整分段阈值
      let maxSplitDistance = 100; // 默认分段距离
      let avgSpeed = 0;
      
      if (hasTimeInfo && totalTime > 0) {
        // 计算平均速度 (像素/毫秒)
        avgSpeed = totalDistance / Math.max(1, totalTime);
        
        // 根据速度和最大单段距离动态调整分段阈值
        const speedFactor = Math.min(4, Math.max(1, avgSpeed * 15));
        maxSplitDistance = Math.min(350, Math.max(100, 
          maxSegmentDistance * 1.5, // 至少比最大段距离大50%
          50 + speedFactor * 50 // 基于速度的动态阈值
        ));
      }
      
      // 分割点集合，防止远距离点自动连接
      const segmentPoints = splitByDistance(points, maxSplitDistance);
      
      // 分段绘制每一组连续的点
      for (const segment of segmentPoints) {
        if (segment.length < 2) continue; // 忽略单点段
        
        // 检查是否已经超过最大绘制时间
        if (performance.now() - startTime > maxDrawTime) {
          console.log('绘制时间过长，中断当前绘制并请求新帧');
          // 中断当前绘制，请求下一帧继续
          requestDrawing();
          cacheCtx.restore();
          return;
        }
        
        // 判断此段是否为高速移动段
        let isHighSpeedSegment = false;
        let segmentAvgDistance = 0;
        
        if (segment.length >= 3) {
          // 计算段内平均点距
          let segmentTotalDistance = 0;
          for (let i = 1; i < segment.length; i++) {
            const dx = segment[i].x - segment[i-1].x;
            const dy = segment[i].y - segment[i-1].y;
            segmentTotalDistance += Math.sqrt(dx * dx + dy * dy);
          }
          segmentAvgDistance = segmentTotalDistance / (segment.length - 1);
          
          // 判断是否高速
          isHighSpeedSegment = segmentAvgDistance > 15 || 
                              (hasTimeInfo && avgSpeed > 0.8);
        }
        
        // 支持压力敏感绘制 - 根据每个点的压力调整线宽
        if (segment[0].pressure !== undefined) {
          // 启用路径绘制
          cacheCtx.beginPath();
          cacheCtx.moveTo(segment[0].x, segment[0].y);
          
          // 对于支持压力的设备，使用压力值调整线宽
          for (let i = 1; i < segment.length; i++) {
            const currentPoint = segment[i];
            const prevPoint = segment[i - 1];
            
            // 根据压力值和速度信息动态调整线宽
            const basePressure = currentPoint.pressure !== undefined ? currentPoint.pressure : 1.0;
            // 高速移动时减小线宽变化幅度，保持连续性
            const speedAdjustment = isHighSpeedSegment ? 0.5 : 1.0;
            const adjustedLineWidth = lineWidth * Math.max(0.3, 
              Math.min(1.4, basePressure * speedAdjustment + (1 - speedAdjustment)));
            
            cacheCtx.lineWidth = adjustedLineWidth;
            
            // 如果是两个点，使用三次贝塞尔曲线替代直线，提高平滑度
            if (i === 1 && segment.length === 2) {
              const controlPoints = getBezierControlPoints([prevPoint, currentPoint], 0.25);
              if (controlPoints) {
                cacheCtx.bezierCurveTo(
                  controlPoints.cp1.x, controlPoints.cp1.y,
                  controlPoints.cp2.x, controlPoints.cp2.y,
                  currentPoint.x, currentPoint.y
                );
              } else {
                cacheCtx.lineTo(currentPoint.x, currentPoint.y);
              }
            } else {
              cacheCtx.lineTo(currentPoint.x, currentPoint.y);
            }
            
            cacheCtx.stroke();
            
            // 为下一段重新开始路径，保持连续性但允许线宽变化
            if (i < segment.length - 1) {
              cacheCtx.beginPath();
              cacheCtx.moveTo(currentPoint.x, currentPoint.y);
            }
          }
        } 
        else if (segment.length >= 3) {
          // 优化：根据点的分布密度动态调整线宽
          let dynamicLineWidth = lineWidth;
          
          // 点距离越大，说明速度越快，线条相应调整
          if (isHighSpeedSegment) {
            // 高速模式线宽调整
            dynamicLineWidth = Math.max(
              lineWidth * 0.75,
              lineWidth * (1 - Math.min(0.4, segmentAvgDistance / 60))
            );
          }
          
          cacheCtx.lineWidth = dynamicLineWidth;
          cacheCtx.beginPath();
          cacheCtx.moveTo(segment[0].x, segment[0].y);
          
          // 高速模式检测 - 如果点距离较大，说明是快速绘制
          if (isHighSpeedSegment) {
            // 快速绘制模式 - 使用整体曲线拟合，减少锯齿
            // 创建一个经过所有点的平滑曲线
            const curvePoints = [];
            
            // 添加一个额外的起始控制点，确保曲线从第一个点开始
            curvePoints.push(segment[0]);
            
            // 添加所有的实际点
            for (let i = 0; i < segment.length; i++) {
              curvePoints.push(segment[i]);
            }
            
            // 添加一个额外的结束控制点
            curvePoints.push(segment[segment.length - 1]);
            
            // 使用Cardinal样条曲线绘制平滑曲线
            let tension = 0.3; // 曲线张力，控制曲线平滑度
            
            // 根据速度调整张力 - 速度越快张力越小，曲线越平滑
            if (hasTimeInfo && totalTime > 0) {
              const speed = totalDistance / totalTime;
              tension = Math.max(0.2, Math.min(0.4, 0.4 - speed * 0.3));
            }
            
            // 绘制平滑曲线
            for (let i = 1; i < curvePoints.length - 2; i++) {
              const p0 = curvePoints[Math.max(0, i-1)];
              const p1 = curvePoints[i];
              const p2 = curvePoints[i+1];
              const p3 = curvePoints[Math.min(curvePoints.length-1, i+2)];
              
              // 计算控制点
              const cp1x = p1.x + (p2.x - p0.x) * tension;
              const cp1y = p1.y + (p2.y - p0.y) * tension;
              const cp2x = p2.x - (p3.x - p1.x) * tension;
              const cp2y = p2.y - (p3.y - p1.y) * tension;
              
              // 绘制贝塞尔曲线段
              cacheCtx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            }
          } else {
            // 常规绘制模式 - 使用优化的贝塞尔曲线计算
            for (let i = 0; i < segment.length - 1; i++) {
              // 确定当前段的点
              const p0 = i > 0 ? segment[i - 1] : segment[0];
              const p1 = segment[i];
              const p2 = segment[i + 1];
              const p3 = i + 2 < segment.length ? segment[i + 2] : p2;
              
              // 使用改进的控制点计算方法
              const controlPoints = getBezierControlPoints([p0, p1, p2, p3], 0.25);
              
              if (controlPoints) {
                if (i === 0) {
                  // 第一段使用贝塞尔曲线
                  cacheCtx.bezierCurveTo(
                    controlPoints.cp1.x, controlPoints.cp1.y,
                    controlPoints.cp2.x, controlPoints.cp2.y,
                    p2.x, p2.y
                  );
                } else if (i === segment.length - 2) {
                  // 最后一段需要特殊处理确保到达终点
                  const lastControlPoints = getBezierControlPoints([p0, p1, p2, p2], 0.25);
                  if (lastControlPoints) {
                    cacheCtx.bezierCurveTo(
                      lastControlPoints.cp1.x, lastControlPoints.cp1.y,
                      lastControlPoints.cp2.x, lastControlPoints.cp2.y,
                      p2.x, p2.y
                    );
                  } else {
                    cacheCtx.lineTo(p2.x, p2.y);
                  }
                  break;
                } else {
                  // 中间段使用贝塞尔曲线
                  cacheCtx.bezierCurveTo(
                    controlPoints.cp1.x, controlPoints.cp1.y,
                    controlPoints.cp2.x, controlPoints.cp2.y,
                    p2.x, p2.y
                  );
                }
              } else {
                // 无法计算控制点时使用直线
                cacheCtx.lineTo(p2.x, p2.y);
              }
            }
          }
          cacheCtx.stroke();
        } else {
          // 只有两个点的段
          cacheCtx.lineWidth = lineWidth;
          cacheCtx.beginPath();
          cacheCtx.moveTo(segment[0].x, segment[0].y);
          
          // 使用贝塞尔曲线使单段线条更平滑
          const controlPoints = getBezierControlPoints(segment, 0.3);
          if (controlPoints) {
            cacheCtx.bezierCurveTo(
              controlPoints.cp1.x, controlPoints.cp1.y,
              controlPoints.cp2.x, controlPoints.cp2.y,
              segment[1].x, segment[1].y
            );
          } else {
            cacheCtx.lineTo(segment[1].x, segment[1].y);
          }
          
          cacheCtx.stroke();
        }
      }
      
      cacheCtx.restore();
    } catch (error) {
      console.error('绘制笔画时出错:', error);
    }
  }
  
  // 橡皮擦工具实现 - 直接操作像素缓存
  function drawEraser(ctx: CanvasRenderingContext2D, x: number, y: number) {
    try {
      if (!ctx) return;
      
      const lastX = drawState.value.lastX;
      const lastY = drawState.value.lastY;
      const eraserWidth = drawState.value.lineWidth * 2; // 橡皮擦稍大一些
      
      // 计算与上一个点的距离和移动速度
      const now = Date.now();
      const timeDiff = Math.max(5, now - (drawState.value.lastTimestamp || now - 16));
      const dx = x - lastX;
      const dy = y - lastY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const moveSpeed = distance / Math.max(1, timeDiff);
      const isHighSpeed = moveSpeed > 1.5;

      // 设置擦除模式
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
      
      // 使用更复杂的擦除策略，确保高速移动时连续擦除
      if (isHighSpeed && distance > eraserWidth * 0.5) {
        // 高速模式：创建连接前后点的擦除路径
        const pointsToAdd = Math.max(2, Math.min(20, Math.floor(distance / (eraserWidth * 0.3))));
        
        // 在起点绘制一个圆形擦除区域
        ctx.beginPath();
        ctx.arc(lastX, lastY, eraserWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制连接路径的擦除区域
        for (let i = 1; i <= pointsToAdd; i++) {
          const ratio = i / (pointsToAdd + 1);
          // 使用平滑插值
          const smoothRatio = 0.5 - 0.5 * Math.cos(ratio * Math.PI);
          const ix = lastX + dx * smoothRatio;
          const iy = lastY + dy * smoothRatio;
          
          // 在插值点绘制圆形
          ctx.beginPath();
          ctx.arc(ix, iy, eraserWidth / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // 最后在终点也绘制一个圆形擦除区域
        ctx.beginPath();
        ctx.arc(x, y, eraserWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制连接所有点的矩形擦除区域，确保路径连续
        if (distance > eraserWidth) {
          // 计算矩形的角度
          const angle = Math.atan2(dy, dx);
          
          // 绘制旋转的矩形，连接起点和终点
          ctx.save();
          ctx.translate(lastX, lastY);
          ctx.rotate(angle);
          ctx.fillRect(0, -eraserWidth / 2, distance, eraserWidth);
          ctx.restore();
        }
      } else {
        // 低速模式：简单的圆形擦除
        ctx.beginPath();
        ctx.arc(x, y, eraserWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 如果有上一个点且与当前点之间有一定距离，则连接两点
        if (distance > 0 && distance < eraserWidth * 2) {
          // 绘制两个圆之间的连接路径
          ctx.beginPath();
          ctx.moveTo(lastX, lastY);
          ctx.lineTo(x, y);
          ctx.lineWidth = eraserWidth;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }
      
      // 恢复上下文状态
      ctx.restore();
      
      // 更新上一个擦除点
      drawState.value.lastX = x;
      drawState.value.lastY = y;
      drawState.value.lastTimestamp = now;
      
    } catch (error) {
      console.error('橡皮擦工具出错:', error);
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
