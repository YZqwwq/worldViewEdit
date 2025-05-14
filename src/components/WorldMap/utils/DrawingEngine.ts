/**
 * DrawingEngine.ts
 * 绘图引擎核心 - 最基础版本
 * 只负责点的提取和基本绘制
 */

// 绘图点类型
export interface DrawPoint {
  x: number;
  y: number;
  timestamp?: number;
  pressure?: number;
  isPredicted?: boolean;
}

// 绘图选项
export interface DrawOptions {
  lineWidth: number;
  color: string;
  tool: 'pen' | 'eraser' | 'select';
}

// 最简化的绘图引擎类
export class DrawingEngine {
  private options: DrawOptions;
  
  constructor(options?: Partial<DrawOptions>) {
    // 默认选项
    this.options = {
      lineWidth: 2, 
      color: '#000000',
      tool: 'pen',
      ...options
    };
  }

  // 设置选项
  setOptions(options: Partial<DrawOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * 从PointerEvent中提取绘图点
   * 支持处理coalesced events以获取高精度点集
   * @param event 原始指针事件
   * @param mapCoord 当前事件的地图坐标
   * @param coordTransform 坐标转换工具
   * @param canvas 画布元素
   * @returns 提取的绘图点数组
   */
  static extractPointsFromEvent(
    event: PointerEvent, 
    coordTransform: any,
    canvas: HTMLCanvasElement
  ): DrawPoint[] {
    const points: DrawPoint[] = [];
    const now = Date.now();
    
    // 尝试获取合并事件
    if ('getCoalescedEvents' in event && typeof event.getCoalescedEvents === 'function') {
      const events = event.getCoalescedEvents(); // 获取合并事件
      
      // 如果有合并事件，处理所有事件
      if (events.length > 1) {
        console.log(`获取到${events.length}个合并事件点`);
        
        // 添加所有合并事件点
        for (const e of events) {
          // 转换事件坐标到地图坐标
          const pointCoord = coordTransform.screenToMap(e.clientX, e.clientY, canvas);
          
          // 添加点，包含压力信息和时间戳
          points.push({
            x: pointCoord.x,
            y: pointCoord.y,
            timestamp: e.timeStamp || now,
            pressure: e.pressure !== undefined ? e.pressure : 1.0
          });
        }
        return points;
      }
    }
    
    // 没有合并事件或不支持，使用与合并事件相同的坐标转换逻辑
    const pointCoord = coordTransform.screenToMap(event.clientX, event.clientY, canvas);
    points.push({
      x: pointCoord.x,
      y: pointCoord.y,
      timestamp: event.timeStamp || now,
      pressure: event.pressure !== undefined ? event.pressure : 1.0
    });
    
    return points;
  }

  /**
   * 简单绘制点
   * 在每个点位置绘制一个圆点
   * @param ctx Canvas绘图上下文
   * @param points 要绘制的点数组
   * @param options 绘制选项
   */
  drawPoints(ctx: CanvasRenderingContext2D, points: DrawPoint[], options?: Partial<DrawOptions>): void {
    if (!ctx || points.length === 0) return;
    
    // 合并选项
    const drawOptions = {
      ...this.options,
      ...options
    };
    
    // 保存当前绘图状态
    ctx.save();
    
    // 设置绘图样式
    ctx.fillStyle = drawOptions.color;
    const radius = drawOptions.lineWidth / 2;
    
    // 绘制每个点
    for (const point of points) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 恢复绘图状态
    ctx.restore();
  }

  /**
   * 生成笔工具的绘图数据 - 最简化版本，只返回点数组
   * @param points 输入点集合
   * @param options 绘图选项
   * @returns 绘图数据对象
   */
  generatePenPath(points: DrawPoint[], options?: Partial<DrawOptions>): {
    points: DrawPoint[];
    options: DrawOptions;
  } {
    // 合并选项
    const mergedOptions: DrawOptions = {
      ...this.options,
      ...options
    };

    // 过滤掉预测点
    const filteredPoints = points.filter(point => !point.isPredicted);

    return {
      points: filteredPoints,
      options: mergedOptions
    };
  }
}