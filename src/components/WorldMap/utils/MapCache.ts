/**
 * 地图底图与绘制缓存系统
 * 专注于缓存管理，提供标准化的接口用于存储和获取图像数据
 */
import { Ref, ref, watch } from 'vue';

// 视图状态接口
export interface ViewState {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export class MapCache {
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D | null;
  private baseImageCanvas: HTMLCanvasElement; // 专用于保存底图的Canvas
  private baseImageCtx: CanvasRenderingContext2D | null;
  private history: ImageData[] = [];
  private redoStack: ImageData[] = [];
  private maxHistory: number = 20;
  private initialized: boolean = false;
  private hasBaseImage: boolean = false; // 跟踪底图是否已加载

  constructor() {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    this.baseImageCanvas = document.createElement('canvas');
    this.baseImageCtx = this.baseImageCanvas.getContext('2d');
  }

  /** 初始化缓存尺寸 */
  initialize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    console.log(`MapCache: 初始化离屏Canvas，尺寸=${width}x${height}`);
    
    // 设置主缓存Canvas尺寸
    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;
    
    // 同时设置底图Canvas尺寸
    this.baseImageCanvas.width = width;
    this.baseImageCanvas.height = height;
    
    this.initialized = true;
    this.clear();
  }

  /** 获取缓存是否已初始化 */
  isInitialized(): boolean {
    return this.initialized;
  }

  /** 获取缓存是否有底图 */
  hasBaseImageLoaded(): boolean {
    return this.hasBaseImage;
  }

  /** 获取缓存画布宽度 */
  getWidth(): number {
    return this.offscreenCanvas.width;
  }

  /** 获取缓存画布高度 */
  getHeight(): number {
    return this.offscreenCanvas.height;
  }

  /** 获取绘图上下文 */
  getContext(): CanvasRenderingContext2D | null {
    return this.offscreenCtx;
  }

  /** 获取底图上下文 */
  getBaseImageContext(): CanvasRenderingContext2D | null {
    return this.baseImageCtx;
  }

  /** 获取离屏Canvas */
  getOffscreenCanvas(): HTMLCanvasElement {
    return this.offscreenCanvas;
  }

  /** 获取底图Canvas */
  getBaseImageCanvas(): HTMLCanvasElement {
    return this.baseImageCanvas;
  }

  /** 加载底图（png）到缓存 */
  async loadImage(img: HTMLImageElement) {
    // 不再基于图像尺寸初始化，由外部控制
    if (!this.initialized) {
      console.warn('MapCache: 在加载图像前应先初始化缓存，将使用图像尺寸作为备选');
      this.initialize(img.width, img.height);
    }
    
    // 在底图Canvas上绘制图像
    if (this.baseImageCtx) {
      // 清空底图Canvas
      this.baseImageCtx.clearRect(0, 0, this.baseImageCanvas.width, this.baseImageCanvas.height);
      
      // 获取当前Canvas尺寸
      const canvasWidth = this.baseImageCanvas.width;
      const canvasHeight = this.baseImageCanvas.height;
      
      console.log(`MapCache: 正在加载底图 - 图像尺寸: ${img.width}x${img.height}, Canvas尺寸: ${canvasWidth}x${canvasHeight}`);
      
      // 强制将整个源图像拉伸/缩放到整个Canvas尺寸
      this.baseImageCtx.drawImage(
        img,
        0, 0, img.width, img.height,  // 源图像区域（整个图像）
        0, 0, canvasWidth, canvasHeight  // 目标区域（整个Canvas）
      );
      
      // 图像比例信息，用于调试
      const scaleX = canvasWidth / img.width;
      const scaleY = canvasHeight / img.height;
      
      console.log(`底图缩放系数: 宽=${scaleX.toFixed(2)}x, 高=${scaleY.toFixed(2)}x`);
      
      // 标记底图已加载
      this.hasBaseImage = true;
      
      // 将底图复制到主缓存Canvas
      this.resetToBaseImage();
    }
  }
  
  /** 重置绘图层为底图 */
  resetToBaseImage() {
    if (!this.hasBaseImage || !this.offscreenCtx || !this.initialized) return;
    
    // 清空主Canvas
    this.offscreenCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
    
    // 将底图复制到主Canvas
    this.offscreenCtx.drawImage(this.baseImageCanvas, 0, 0);
    
    // 保存当前状态到历史记录
    this.saveHistory();
    
    console.log("已重置绘图层为底图");
  }

  /** 获取当前绘图层的ImageData */
  getImageData(): ImageData | null {
    if (!this.offscreenCtx || !this.initialized) return null;
    return this.offscreenCtx.getImageData(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
  }

  /** 设置绘图层的ImageData */
  putImageData(imageData: ImageData) {
    if (!this.offscreenCtx || !this.initialized) return;
    this.offscreenCtx.putImageData(imageData, 0, 0);
  }

  /** 保存历史快照 */
  saveHistory() {
    if (!this.offscreenCtx) return;
    const imageData = this.offscreenCtx.getImageData(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
    this.history.push(imageData);
    if (this.history.length > this.maxHistory) this.history.shift();
    this.redoStack = [];
  }

  /** 撤销 */
  undo() {
    if (this.history.length <= 1) return;
    const last = this.history.pop();
    if (last) this.redoStack.push(last);
    const prev = this.history[this.history.length - 1];
    if (prev && this.offscreenCtx) {
      this.offscreenCtx.putImageData(prev, 0, 0);
    }
  }

  /** 重做 */
  redo() {
    if (this.redoStack.length === 0) return;
    const redoData = this.redoStack.pop();
    if (redoData && this.offscreenCtx) {
      this.offscreenCtx.putImageData(redoData, 0, 0);
      this.history.push(redoData);
    }
  }

  /** 清空缓存 */
  clear() {
    // 如果已有底图，则恢复到底图状态
    if (this.hasBaseImage) {
      this.resetToBaseImage();
    } else {
      // 否则完全清空
      this.offscreenCtx?.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
      this.history = [];
      this.redoStack = [];
    }
  }

  /** 
   * 渲染到目标context（主canvas）
   * 如果提供viewState，则应用坐标变换
   * 否则直接渲染，假设外部已经处理了变换
   */
  renderTo(ctx: CanvasRenderingContext2D, viewState?: ViewState) {
    if (!this.initialized) return;
    
    if (viewState) {
      // 如果提供了视图状态，应用坐标变换
      // 注意：这种情况只应在外部没有应用变换时使用
      ctx.save();
      ctx.translate(viewState.offsetX, viewState.offsetY);
      ctx.scale(viewState.scale, viewState.scale);
      ctx.drawImage(this.offscreenCanvas, 0, 0);
      ctx.restore();
    } else {
      // 兼容模式，直接渲染
      // 假设外部已经应用了必要的变换
      ctx.drawImage(this.offscreenCanvas, 0, 0);
    }
  }

  /** 导出为图片 */
  toDataURL(type: string = 'image/png') {
    return this.offscreenCanvas.toDataURL(type);
  }
} 