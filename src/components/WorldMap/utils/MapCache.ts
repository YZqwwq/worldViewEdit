/**
 * 地图底图与绘制缓存系统
 * 支持底图加载、画笔/橡皮擦直接操作、撤销重做、导出
 */
import { Ref, ref, watch } from 'vue';

// 绘图操作类型定义
export interface DrawOperation {
  type: 'pen' | 'eraser';
  points: { x: number, y: number }[];
  color: string;
  lineWidth: number;
  terrainType?: string;
}

// 视图状态接口
export interface ViewState {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export class MapCache {
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D | null;
  private history: ImageData[] = [];
  private redoStack: ImageData[] = [];
  private maxHistory: number = 20;
  private initialized: boolean = false;

  constructor() {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
  }

  /** 初始化缓存尺寸 */
  initialize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;
    this.initialized = true;
    this.clear();
  }

  /** 加载底图（png）到缓存 */
  async loadImage(img: HTMLImageElement) {
    if (!this.initialized) {
      this.initialize(img.width, img.height);
    }
    this.offscreenCtx?.clearRect(0, 0, img.width, img.height);
    this.offscreenCtx?.drawImage(img, 0, 0);
    this.saveHistory();
  }

  /** 画笔操作（直接在缓存canvas上画线） */
  drawPen(points: {x: number, y: number}[], color: string, lineWidth: number) {
    if (!this.offscreenCtx) return;
    this.offscreenCtx.save();
    this.offscreenCtx.globalCompositeOperation = 'source-over';
    this.offscreenCtx.strokeStyle = color;
    this.offscreenCtx.lineWidth = lineWidth;
    this.offscreenCtx.lineJoin = 'round';
    this.offscreenCtx.lineCap = 'round';
    if (points.length >= 2) {
      this.offscreenCtx.beginPath();
      this.offscreenCtx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.offscreenCtx.lineTo(points[i].x, points[i].y);
      }
      this.offscreenCtx.stroke();
    }
    this.offscreenCtx.restore();
    this.saveHistory();
  }

  /** 橡皮擦操作（直接擦除缓存canvas内容） */
  erase(points: {x: number, y: number}[], lineWidth: number) {
    if (!this.offscreenCtx) return;
    this.offscreenCtx.save();
    this.offscreenCtx.globalCompositeOperation = 'destination-out';
    this.offscreenCtx.lineWidth = lineWidth;
    this.offscreenCtx.lineJoin = 'round';
    this.offscreenCtx.lineCap = 'round';
    if (points.length >= 2) {
      this.offscreenCtx.beginPath();
      this.offscreenCtx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.offscreenCtx.lineTo(points[i].x, points[i].y);
      }
      this.offscreenCtx.stroke();
    }
    this.offscreenCtx.restore();
    this.saveHistory();
  }

  /** 保存历史快照 */
  private saveHistory() {
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
    this.offscreenCtx?.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
    this.history = [];
    this.redoStack = [];
  }

  /** 渲染到目标context（主canvas） */
  renderTo(ctx: CanvasRenderingContext2D) {
    if (!this.initialized) return;
    ctx.drawImage(this.offscreenCanvas, 0, 0);
  }

  /** 导出为图片 */
  toDataURL(type: string = 'image/png') {
    return this.offscreenCanvas.toDataURL(type);
  }
} 