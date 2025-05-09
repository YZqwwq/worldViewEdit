import { ref, Ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { Layer } from './useLayerFactory';
import { LAYER_IDS } from './useMapCanvas';
import { useLayerManagerContext, useLayerManager } from './useLayerManager';
import { useMapCacheStore } from '../utils/mapCacheStore';
import { useCoordinateTransform, Coordinate } from '../utils/CoordinateTransform';

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
  currentPoints: { x: number, y: number }[];
  maxPoints: number;
  lastTimestamp?: number;
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
  drawPen: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
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
    maxPoints: 1000 // 最大点数量，防止性能问题
  });
  
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
          console.log(`初始化地图缓存，尺寸: ${MAP_WIDTH}x${MAP_HEIGHT}`);
          mapCacheStore.initializeLayer(layerId, MAP_WIDTH, MAP_HEIGHT);
        }
        
        console.log(`正在加载底图到缓存，图像尺寸: ${img.width}x${img.height}, 目标尺寸: ${MAP_WIDTH}x${MAP_HEIGHT}`);
        
        // 加载图像到缓存
        mapCacheStore.loadImage(layerId, img);
        cacheInitialized.value = true;
        
        // 刷新画布，显示新加载的底图
        refreshCanvas();
        
        console.log('底图已加载到缓存，尺寸:', MAP_WIDTH, 'x', MAP_HEIGHT);
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
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    
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
      ctx.setTransform(scale.value, 0, 0, scale.value, offsetX.value, offsetY.value);
      
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
    console.log('开始绘制，地图坐标:', { mapX, mapY });
    
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
    drawState.value.currentPoints.push({ x: mapX, y: mapY });
    
    // 转换到画布坐标用于保存最后位置
    const canvasPoint = coordTransform.mapToCanvas(mapX, mapY);
    drawState.value.lastX = canvasPoint.x;
    drawState.value.lastY = canvasPoint.y;
    
    // 确保Canvas可被鼠标点击
    if (activeLayer.canvas) {
      activeLayer.canvas.style.pointerEvents = 'auto';
      console.log("确保canvas可接收事件: pointerEvents = auto");
    }
    
    // 检查缓存是否已初始化
    if (!mapCacheStore.isLayerInitialized(layerId)) {
      console.log("初始化绘图缓存");
      mapCacheStore.initializeLayer(layerId, MAP_WIDTH, MAP_HEIGHT);
    }
    
    // 检查是否需要加载底图
    if (!cacheInitialized.value) {
      // 检查store中是否已有底图
      if (mapCacheStore.hasBaseImage(layerId)) {
        console.log("缓存中已有底图，直接使用");
        cacheInitialized.value = true;
      } else {
        console.log("缓存中没有底图，正在加载...");
        // 保存当前底图内容
        const img = new Image();
        img.src = activeLayer.canvas.toDataURL('image/png');
        
        img.onload = () => {
          // 将底图加载到缓存
          mapCacheStore.loadImage(layerId, img);
          cacheInitialized.value = true;
          console.log("缓存初始化完成，底图已加载 - 尺寸:", MAP_WIDTH, 'x', MAP_HEIGHT);
        };
      }
    }
  }
  
  /**
   * 执行绘制
   * @param mapX 地图X坐标（而非画布坐标）
   * @param mapY 地图Y坐标（而非画布坐标）
   * @remarks 这个函数接收的是地图坐标，而不是画布坐标。调用前应该确保坐标点在地图区域内。
   */
  function draw(mapX: number, mapY: number) {
    if (!drawState.value.isDrawing) {
      console.log("❗ draw方法被调用但isDrawing=false，不执行绘制");
      return;
    }
    
    // 等待缓存初始化完成
    if (!cacheInitialized.value) {
      console.log("等待缓存初始化完成...");
      // 可以考虑添加延迟重试逻辑
      setTimeout(() => {
        if (cacheInitialized.value) {
          draw(mapX, mapY);
        }
      }, 50);
      return;
    }
    
    // 获取当前活动的图层
    const activeLayer = mapLayer.value || (layerManager ? layerManager.getLayer(LAYER_IDS.MAP) : null);
    if (!activeLayer || !activeLayer.canvas) {
      console.error("无法获取画布，绘制失败");
      return;
    }
    
    // 使用传入的地图坐标点
    const newPoint = { x: mapX, y: mapY };
    
    // 获取之前的最后一个点
    const lastPoint = drawState.value.currentPoints.length > 0 
      ? drawState.value.currentPoints[drawState.value.currentPoints.length - 1] 
      : null;
    
    // 如果存在上一个点，计算与当前点的距离
    if (lastPoint) {
      const dx = newPoint.x - lastPoint.x;
      const dy = newPoint.y - lastPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 根据当前缩放动态调整最小和最大插值距离
      const minPointDistance = Math.max(2, 5 / scale.value); // 最小插值距离
      const maxInterpolationDistance = 50 / scale.value; // 允许插值的最大距离
      
      // 计算两点间行程时间（用于检测移动速度）
      const now = Date.now();
      const timeDiff = drawState.value.lastTimestamp ? now - drawState.value.lastTimestamp : 0;
      drawState.value.lastTimestamp = now;
      
      // 计算移动速度（像素/毫秒）
      const speed = timeDiff > 0 ? distance / timeDiff : 0;
      
      if (distance > minPointDistance && distance < maxInterpolationDistance) {
        // 根据距离和速度动态计算所需插值点的数量
        // 移动越快，插值点越多
        const speedFactor = Math.min(Math.max(speed * 50, 1), 3);
        const baseDensity = Math.ceil(distance / minPointDistance);
        const pointsToAdd = Math.min(Math.floor(baseDensity * speedFactor), 20); // 限制最大插值点数
        
        console.log(`检测到移动，距离=${distance.toFixed(2)}，速度=${speed.toFixed(2)}，添加${pointsToAdd}个插值点`);
        
        // 使用贝塞尔曲线插值，而不仅是线性插值
        if (pointsToAdd >= 2) {
          // 控制点：获取前一个方向的延长线
          let controlX, controlY;
          
          if (drawState.value.currentPoints.length >= 2) {
            const prevPoint = drawState.value.currentPoints[drawState.value.currentPoints.length - 2];
            const dirX = lastPoint.x - prevPoint.x;
            const dirY = lastPoint.y - prevPoint.y;
            // 控制点在上一个点的延长线上
            controlX = lastPoint.x + dirX * 0.5;
            controlY = lastPoint.y + dirY * 0.5;
          } else {
            // 如果没有前一个点，控制点就是当前点和目标点的中点
            controlX = (lastPoint.x + newPoint.x) / 2;
            controlY = (lastPoint.y + newPoint.y) / 2;
          }
          
          // 生成贝塞尔曲线上的点
          for (let i = 1; i <= pointsToAdd; i++) {
            const t = i / (pointsToAdd + 1);
            // 二次贝塞尔曲线公式: B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
            const mt = 1 - t;
            const interpolatedPoint = {
              x: mt * mt * lastPoint.x + 2 * mt * t * controlX + t * t * newPoint.x,
              y: mt * mt * lastPoint.y + 2 * mt * t * controlY + t * t * newPoint.y
            };
            drawState.value.currentPoints.push(interpolatedPoint);
          }
        } else {
          // 简单线性插值
          for (let i = 1; i <= pointsToAdd; i++) {
            const ratio = i / (pointsToAdd + 1);
            const interpolatedPoint = {
              x: lastPoint.x + dx * ratio,
              y: lastPoint.y + dy * ratio
            };
            drawState.value.currentPoints.push(interpolatedPoint);
          }
        }
      } else if (distance >= maxInterpolationDistance) {
        // 如果距离太大（可能是跳跃或中断），使用线性插值添加少量点
        console.log(`检测到大距离跳跃: ${distance.toFixed(2)}，使用线性插值`);
        
        const pointsToAdd = Math.min(5, Math.floor(distance / maxInterpolationDistance * 5));
        for (let i = 1; i <= pointsToAdd; i++) {
          const ratio = i / (pointsToAdd + 1);
          const interpolatedPoint = {
            x: lastPoint.x + dx * ratio,
            y: lastPoint.y + dy * ratio
          };
          drawState.value.currentPoints.push(interpolatedPoint);
        }
      }
    }
    
    // 添加新点到集合中
    drawState.value.currentPoints.push(newPoint);
    
    // 如果点数超过最大值，移除最旧的点
    if (drawState.value.currentPoints.length > drawState.value.maxPoints) {
      drawState.value.currentPoints.shift();
    }
    
    // 转换到画布坐标用于保存最后位置
    const canvasPoint = coordTransform.mapToCanvas(mapX, mapY);
    drawState.value.lastX = canvasPoint.x;
    drawState.value.lastY = canvasPoint.y;
    
    // 根据当前工具执行对应的绘制操作
    switch (drawState.value.currentTool) {
      case 'pen':
        drawPen(null as any, mapX, mapY);
        break;
      case 'eraser':
        drawEraser(null as any, mapX, mapY);
        break;
      // 选区工具不在这里处理
      case 'select':
        break;
    }
    
    // 刷新画布显示
    refreshCanvas();
  }
  
  // 画笔工具实现 - 直接操作像素缓存
  function drawPen(ctx: CanvasRenderingContext2D, x: number, y: number) {
    try {
      // 获取当前所有点
      const points = drawState.value.currentPoints;
      
      // 至少需要2个点才能绘制
      if (points.length < 2) {
        return;
      }
      
      // 线宽需要与缩放比例正相关而非反相关
      // 当缩放比例增大时，线宽也应增大，保持视觉一致性
      const LineWidth = drawState.value.lineWidth
      
      console.log(`绘制线条，使用${points.length}个点，线宽: ${LineWidth}`);
      
      // 直接调用全局Pinia缓存，传递所有收集的点
      mapCacheStore.drawPen(
        layerId, 
        points, 
        getTerrainColor(drawState.value.terrainType), 
        LineWidth
      );
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
      
      // 获取视图状态用于调整线宽
      const view = { offsetX: offsetX.value, offsetY: offsetY.value, scale: scale.value };
      
      // 橡皮擦线宽也需要与缩放比例正相关
      // 橡皮擦通常比画笔宽一些，所以乘以2
      const adjustedLineWidth = (drawState.value.lineWidth * 2) * view.scale;
      
      console.log(`擦除线条，使用${points.length}个点，线宽: ${adjustedLineWidth}，缩放比例: ${view.scale}`);
      
      // 直接调用全局Pinia缓存，传递所有收集的点
      mapCacheStore.erase(
        layerId, 
        points, 
        adjustedLineWidth
      );
    } catch (error) {
      console.error('橡皮擦擦除失败:', error);
    }
  }
  
  // 结束绘制
  function stopDrawing() {
    if (drawState.value.isDrawing) {
      console.log('结束绘制');
      drawState.value.isDrawing = false;
      // 清空点集合
      drawState.value.currentPoints = [];
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
