import { ref, Ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { Layer } from './useLayerFactory';
import { LAYER_IDS } from './useMapCanvas';
import { useLayerManagerContext, useLayerManager } from './useLayerManager';

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
  drawHistory: ImageData[];
  historyIndex: number;
  maxHistorySteps: number;
  drawingCache: ImageData | null;
  cachedScale: number;
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
  updateDrawingCache: () => void;
  startDrawing: (x: number, y: number) => void;
  draw: (x: number, y: number) => void;
  stopDrawing: () => void;
  getDrawingContext: () => CanvasRenderingContext2D | null;
};

/**
 * 地图绘图工具，处理地图图层的绘制功能
 * 
 * @param mapLayer 地图图层引用，可以通过layerManager.getLayer(LAYER_IDS.MAP)获取
 * @param offsetX 视图X偏移量
 * @param offsetY 视图Y偏移量
 * @param scale 视图缩放比例
 * @param canvasContainerRef Canvas容器元素引用
 * @param externalLayerManager 外部传入的图层管理器实例，优先使用此实例
 */
export function useLayerTools(
  mapLayer: Ref<Layer | null>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>,
  canvasContainerRef: Ref<HTMLElement | null>,
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
    drawHistory: [],
    historyIndex: -1,
    maxHistorySteps: 20, // 最多保存20步历史
    drawingCache: null,
    cachedScale: 1
  });
  
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
  
  // 更新绘图缓存
  function updateDrawingCache() {
    const ctx = getDrawingContext();
    if (!ctx) return;
    
    try {
      // 保存当前状态到缓存
      drawState.value.drawingCache = ctx.getImageData(
        0, 0, 
        ctx.canvas.width, 
        ctx.canvas.height
      );
      drawState.value.cachedScale = scale.value;
      console.log('已更新绘图缓存', {
        width: ctx.canvas.width,
        height: ctx.canvas.height,
        scale: scale.value
      });
    } catch (error) {
      console.error('更新绘图缓存失败:', error);
    }
  }
  
  // 保存当前绘图状态到历史记录
  function saveStateToHistory() {
    const ctx = getDrawingContext();
    if (!ctx) return;
    
    try {
      // 裁剪历史记录，丢弃当前位置之后的记录
      if (drawState.value.historyIndex < drawState.value.drawHistory.length - 1) {
        drawState.value.drawHistory = drawState.value.drawHistory.slice(0, drawState.value.historyIndex + 1);
      }
      
      // 保存当前状态
      const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      drawState.value.drawHistory.push(imageData);
      
      // 如果历史记录超过最大值，移除最旧的
      if (drawState.value.drawHistory.length > drawState.value.maxHistorySteps) {
        drawState.value.drawHistory.shift();
      } else {
        drawState.value.historyIndex++;
      }
      
      // 同时更新缓存
      drawState.value.drawingCache = imageData;
      
      console.log(`已保存历史状态 #${drawState.value.historyIndex}`);
    } catch (error) {
      console.error('保存历史状态失败:', error);
    }
  }
  
  // 撤销操作
  function undo() {
    if (drawState.value.historyIndex <= 0) {
      console.log('没有历史记录可撤销');
      return;
    }
    
    const ctx = getDrawingContext();
    if (!ctx) return;
    
    try {
      drawState.value.historyIndex--;
      console.log(`撤销至历史状态 #${drawState.value.historyIndex}`);
      
      // 恢复到上一个状态
      const imageData = drawState.value.drawHistory[drawState.value.historyIndex];
      ctx.putImageData(imageData, 0, 0);
      
      // 更新缓存
      drawState.value.drawingCache = imageData;
    } catch (error) {
      console.error('撤销操作失败:', error);
    }
  }
  
  // 重做操作
  function redo() {
    if (drawState.value.historyIndex >= drawState.value.drawHistory.length - 1) {
      console.log('没有操作可重做');
      return;
    }
    
    const ctx = getDrawingContext();
    if (!ctx) return;
    
    try {
      drawState.value.historyIndex++;
      console.log(`重做至历史状态 #${drawState.value.historyIndex}`);
      
      // 恢复到下一个状态
      const imageData = drawState.value.drawHistory[drawState.value.historyIndex];
      ctx.putImageData(imageData, 0, 0);
      
      // 更新缓存
      drawState.value.drawingCache = imageData;
    } catch (error) {
      console.error('重做操作失败:', error);
    }
  }
  
  // 开始绘制
  function startDrawing(x: number, y: number) {
    console.log('开始绘制:', { x, y });
    drawState.value.isDrawing = true;
    drawState.value.lastX = x;
    drawState.value.lastY = y;
    
    // 检查是否需要更新缓存
    if (!drawState.value.drawingCache || drawState.value.cachedScale !== scale.value) {
      updateDrawingCache();
    }
    
    // 获取当前活动的图层
    const activeLayer = mapLayer.value || (layerManager ? layerManager.getLayer(LAYER_IDS.MAP) : null);
    
    // 只处理地图绘制工具的事件，并且只在地图图层上绘制
    if (!activeLayer || !activeLayer.visible.value) {
      console.log("❗ 绘制无效: 地图图层不存在或不可见");
      console.log("图层状态:", activeLayer ? `存在，可见性=${activeLayer.visible.value}` : "不存在");
      return;
    }
    
    // 确保Canvas可被鼠标点击
    if (activeLayer.canvas) {
      activeLayer.canvas.style.pointerEvents = 'auto';
      console.log("确保canvas可接收鼠标事件: pointerEvents = auto");
    }
    
    // 保存初始状态
    saveStateToHistory();
  }
  
  // 执行绘制
  function draw(x: number, y: number) {
    if (!drawState.value.isDrawing) {
      console.log("❗ draw方法被调用但isDrawing=false，不执行绘制");
      return;
    }
    
    const ctx = getDrawingContext();
    if (!ctx) {
      console.error("❗ 无法获取绘图上下文，绘制失败");
      return;
    }
    
    console.log("❗ 准备执行绘制，当前工具:", drawState.value.currentTool);
    
    // 根据当前工具执行对应的绘制操作
    switch (drawState.value.currentTool) {
      case 'pen':
        drawPen(ctx, x, y);
        break;
      case 'eraser':
        drawEraser(ctx, x, y);
        break;
      // 选区工具不在这里处理
      case 'select':
        break;
    }
    
    // 更新上一个位置
    drawState.value.lastX = x;
    drawState.value.lastY = y;
  }
  
  // 画笔工具实现
  function drawPen(ctx: CanvasRenderingContext2D, x: number, y: number) {
    try {
      console.log("❗ drawPen 绘制线段", { 
        from: { x: drawState.value.lastX, y: drawState.value.lastY }, 
        to: { x, y },
        color: getTerrainColor(drawState.value.terrainType)
      });
      
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = getTerrainColor(drawState.value.terrainType);
      ctx.lineWidth = drawState.value.lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      // 开始绘制
      ctx.beginPath();
      ctx.moveTo(drawState.value.lastX, drawState.value.lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      
      console.log("❗ 线段绘制完成");
    } catch (error) {
      console.error('❗ 画笔绘制失败:', error);
    }
  }
  
  // 橡皮擦工具实现
  function drawEraser(ctx: CanvasRenderingContext2D, x: number, y: number) {
    try {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = drawState.value.lineWidth * 2; // 橡皮擦略宽一些
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      // 开始擦除
      ctx.beginPath();
      ctx.moveTo(drawState.value.lastX, drawState.value.lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      
      // 恢复绘制模式
      ctx.globalCompositeOperation = 'source-over';
    } catch (error) {
      console.error('橡皮擦擦除失败:', error);
    }
  }
  
  // 结束绘制
  function stopDrawing() {
    if (drawState.value.isDrawing) {
      console.log('结束绘制');
      drawState.value.isDrawing = false;
      
      // 保存最终状态
      if (drawState.value.currentTool !== 'select') {
        saveStateToHistory();
      }
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
    updateDrawingCache,
    
    // 暴露用于外部调用的绘图方法
    startDrawing,
    draw,
    stopDrawing,
    getDrawingContext
  };
}
