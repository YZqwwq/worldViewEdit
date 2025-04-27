import { ref } from 'vue';
import type { Ref } from 'vue';
import { 
  BACKGROUND_DARK, 
  BACKGROUND_LIGHT,
  MAP_BACKGROUND_DARK,
  MAP_BACKGROUND_LIGHT,
  MAP_BORDER_DARK,
  MAP_BORDER_LIGHT
} from '../constants/colors';

// 基础图层配置
export interface LayerConfig {
  id: string;
  name: string;
  zIndex?: number;
  visible?: boolean;
  isBaseLayer?: boolean;
}

// 基础图层接口
export interface BaseLayer {
  id: string;
  name: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  zIndex: number;
  visible: Ref<boolean>;
  container: HTMLElement | null;
  width: number;
  height: number;
  isBaseLayer: boolean;
  init: (parentElement: HTMLElement, width: number, height: number) => void;
  resize: (width: number, height: number) => void;
  render: () => void;//在子类中重写实现
  clear: () => void;
  destroy: () => void;
}

// 像素图层接口
export interface PixelLayer extends BaseLayer {
  type: 'pixel';
  tileSize: number;
  offscreenCanvas: OffscreenCanvas;
  offscreenCtx: OffscreenCanvasRenderingContext2D | null;
  loadImageRegion: (
    sourceImage: HTMLImageElement | ImageBitmap,
    sx: number, sy: number,
    sw: number, sh: number,
    dx: number, dy: number,
    dw: number, dh: number
  ) => Promise<ImageBitmap>;
  drawBitmap: (bitmap: ImageBitmap, x: number, y: number) => void;
}

// 矢量图层接口
export interface VectorLayer extends BaseLayer {
  type: 'vector';
  drawPath: (
    path: Path2D | (() => void),
    strokeStyle?: string,
    fillStyle?: string
  ) => void;
}

// 导出统一的图层类型
export type Layer = BaseLayer | PixelLayer | VectorLayer;

// 扩展图层配置接口
export interface PixelLayerConfig extends LayerConfig {
  type: 'pixel';
  imageUrl?: string;
  tileSize?: number;
}

export interface VectorLayerConfig extends LayerConfig {
  type: 'vector';
}

// 创建基础图层
export function createBaseLayer(config: LayerConfig): Layer {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const visible = ref(config.visible ?? true);
  const container = ref<HTMLElement | null>(null);
  const width = ref(0);
  const height = ref(0);
  
  // 初始化图层
  function init(parentElement: HTMLElement, w: number, h: number): void {
    // 设置样式
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none'; // 默认不接收鼠标事件
    
    // 设置尺寸
    resize(w, h);
    
    // 添加到父元素
    parentElement.appendChild(canvas);
    container.value = parentElement;
    
    // 触发第一次渲染
    render();
  }
  
  // 调整画布大小
  function resize(w: number, h: number): void {
    width.value = w;
    height.value = h;
    canvas.width = w;
    canvas.height = h;
    
    // 修复高DPI屏幕
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    
    render();
  }
  
  // 清空画布
  function clear(): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  // 渲染图层
  function render(): void {
    if (!visible.value) return;
    
    clear();
    // 具体渲染逻辑由子类实现
  }
  
  // 销毁图层
  function destroy(): void {
    if (canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
    container.value = null;
    clear();
  }
  
  return {
    id: config.id,
    name: config.name,
    canvas,
    ctx,
    zIndex: config.zIndex ?? 0,
    visible,
    container: container.value,
    width: width.value,
    height: height.value,
    isBaseLayer: config.isBaseLayer ?? false,
    init,
    resize,
    render,
    clear,
    destroy
  };
}

// 创建像素图层
export function createPixelLayer(config: PixelLayerConfig): PixelLayer {
  const baseLayer = createBaseLayer(config);
  const tileSize = config.tileSize || 512;
  
  // 创建离屏缓存画布
  const offscreenCanvas = new OffscreenCanvas(tileSize, tileSize);
  const offscreenCtx = offscreenCanvas.getContext('2d');
  
  // 扩展基础图层
  return {
    ...baseLayer,
    type: 'pixel',
    tileSize,
    offscreenCanvas,
    offscreenCtx,
    
    // 加载图片区域
    async loadImageRegion(
      sourceImage: HTMLImageElement | ImageBitmap,
      sx: number, sy: number,
      sw: number, sh: number,
      dx: number, dy: number,
      dw: number, dh: number
    ): Promise<ImageBitmap> {
      if (!offscreenCtx) throw new Error('离屏上下文创建失败');
      
      // 清除离屏画布
      offscreenCtx.clearRect(0, 0, tileSize, tileSize);
      
      // 绘制图片区域
      offscreenCtx.drawImage(sourceImage, sx, sy, sw, sh, dx, dy, dw, dh);
      
      // 创建位图
      return createImageBitmap(offscreenCanvas);
    },
    
    // 绘制位图
    drawBitmap(bitmap: ImageBitmap, x: number, y: number): void {
      baseLayer.ctx.drawImage(bitmap, x, y);
    }
  };
}

// 创建矢量图层
export function createVectorLayer(config: VectorLayerConfig): VectorLayer {
  const baseLayer = createBaseLayer(config);
  
  return {
    ...baseLayer,
    type: 'vector',
    
    // 绘制矢量图形
    drawPath(
      path: Path2D | (() => void),
      strokeStyle?: string,
      fillStyle?: string
    ): void {
      const ctx = baseLayer.ctx;
      ctx.save();
      
      if (typeof path === 'function') {
        path(); // 执行自定义绘制函数
      } else {
        if (fillStyle) {
          ctx.fillStyle = fillStyle;
          ctx.fill(path);
        }
        if (strokeStyle) {
          ctx.strokeStyle = strokeStyle;
          ctx.stroke(path);
        }
      }
      
      ctx.restore();
    }
  };
}

// 创建底部灰色图层
export function createBackgroundLayer(config: LayerConfig, isDarkMode: Ref<boolean>): VectorLayer {
  const baseLayer = createVectorLayer({
    ...config,
    type: 'vector',
    isBaseLayer: true
  });
  
  // 重写渲染方法
  baseLayer.render = function(): void {
    if (!baseLayer.visible.value) return;
    
    baseLayer.clear();
    
    // 绘制全屏背景
    baseLayer.drawPath(() => {
      baseLayer.ctx.fillStyle = isDarkMode.value ? BACKGROUND_DARK : BACKGROUND_LIGHT;
      baseLayer.ctx.fillRect(0, 0, baseLayer.canvas.width, baseLayer.canvas.height);
    });
  };
  
  return baseLayer;
}

// 修改地图图层创建函数
export function createMapLayer(
  config: LayerConfig, 
  isDarkMode: Ref<boolean>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>
): PixelLayer {
  const baseLayer = createPixelLayer({
    ...config,
    type: 'pixel',
    tileSize: 512 // 设置标准瓦片大小
  });

  // 创建一个用于缓存的Map
  const tileCache = new Map<string, ImageBitmap>();
  
  // 计算可见瓦片范围
  function calculateVisibleTiles() {
    const tileSize = baseLayer.tileSize;
    const gridSize =15; // 每个格子的大小
    
    // 计算当前视口下的地图范围
    const mapRect = getMapRect(offsetX.value, offsetY.value, scale.value);
    
    // 计算需要加载的瓦片范围
    const startX = Math.floor(mapRect.x / (tileSize * scale.value));
    const startY = Math.floor(mapRect.y / (tileSize * scale.value));
    const endX = Math.ceil((mapRect.x + mapRect.width) / (tileSize * scale.value));
    const endY = Math.ceil((mapRect.y + mapRect.height) / (tileSize * scale.value));
    
    return {
      startX, startY,
      endX, endY,
      tileSize
    };
  }

  // 生成瓦片内容
  async function generateTile(x: number, y: number): Promise<ImageBitmap> {
    const key = `${x},${y}`;
    let tile = tileCache.get(key);
    
    if (!tile) {
      const tileSize = baseLayer.tileSize;
      const gridSize = 15;
      
      // 使用离屏画布生成瓦片
      if (!baseLayer.offscreenCtx) throw new Error('离屏上下文创建失败');
      
      // 清除离屏画布
      baseLayer.offscreenCtx.clearRect(0, 0, tileSize, tileSize);
      
      // 设置背景色
      baseLayer.offscreenCtx.fillStyle = isDarkMode.value ? MAP_BACKGROUND_DARK : MAP_BACKGROUND_LIGHT;
      baseLayer.offscreenCtx.fillRect(0, 0, tileSize, tileSize);
      
      // 绘制边框
      baseLayer.offscreenCtx.strokeStyle = isDarkMode.value ? MAP_BORDER_DARK : MAP_BORDER_LIGHT;
      baseLayer.offscreenCtx.lineWidth = 1;
      baseLayer.offscreenCtx.strokeRect(0, 0, tileSize, tileSize);
      
      // 创建瓦片位图
      tile = await createImageBitmap(baseLayer.offscreenCanvas);
      tileCache.set(key, tile);
    }
    
    return tile;
  }

  // 重写渲染方法
  baseLayer.render = async function(): Promise<void> {
    if (!baseLayer.visible.value) return;
    
    baseLayer.clear();
    
    // 获取当前需要显示的瓦片范围
    const { startX, startY, endX, endY, tileSize } = calculateVisibleTiles();
    
    // 保存当前状态
    baseLayer.ctx.save();
    
    try {
      // 应用变换
      baseLayer.ctx.translate(offsetX.value, offsetY.value);
      baseLayer.ctx.scale(scale.value, scale.value);
      
      // 绘制可见范围内的所有瓦片
      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          const tile = await generateTile(x, y);
          const drawX = x * tileSize;
          const drawY = y * tileSize;
          
          baseLayer.drawBitmap(tile, drawX, drawY);
        }
      }
    } catch (error) {
      console.error('渲染地图瓦片时出错:', error);
    }
    
    // 恢复状态
    baseLayer.ctx.restore();
  };
  
  return baseLayer;
}

// 导出辅助函数，用于获取当前地图矩形的位置和大小
export function getMapRect(offsetX: number, offsetY: number, scale: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const gridSize = 15;
  const mapWidthInPixels = 360 * gridSize * scale;
  const mapHeightInPixels = 180 * gridSize * scale;
  
  return {
    x: offsetX,
    y: offsetY,
    width: mapWidthInPixels,
    height: mapHeightInPixels
  };
} 