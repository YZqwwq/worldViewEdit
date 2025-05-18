/**
 * DrawingEngine.ts
 * 绘图引擎核心 - 基础版本
 * 负责贝塞尔曲线绘制
 */

// 绘图点类型
export interface DrawPoint {
  x: number;
  y: number;
  timestamp?: number;
  pressure?: number;
  isPredicted?: boolean;
}

// 坐标转换工具接口
export interface CoordinateTransform {
  screenToMap(clientX: number, clientY: number, canvas: HTMLCanvasElement): {x: number, y: number};
  getTransformParams(): [number, number, number, number, number, number];
  getDpr(): number;
}

// 绘图选项
export interface DrawOptions {
  lineWidth: number;
  color: string;
  tool: 'pen' | 'eraser' | 'select';
  tension?: number; // 添加张力参数控制曲线形状
  minPointsToRender?: number; // 最小绘制点数阈值
}

// 控制点类型
interface ControlPoints {
  cp1: {x: number, y: number};
  cp2: {x: number, y: number};
}

// 绘图引擎类
export class DrawingEngine {
  private options: DrawOptions;
  
  constructor(options?: Partial<DrawOptions>) {
    // 默认选项
    this.options = {
      lineWidth: 2, 
      color: '#000000',
      tool: 'pen',
      tension: 0.25, // 默认张力值
      minPointsToRender: 4, // 默认最小绘制点数阈值
      ...options
    };
  }

  // 设置选项
  setOptions(options: Partial<DrawOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * 计算两点之间的距离
   * @param p1 第一个点
   * @param p2 第二个点
   * @returns 两点之间的距离
   */
  private calculateDistance(p1: DrawPoint, p2: DrawPoint): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  /**
   * 检查两点是否有足够距离（不重合）
   * @param p1 第一个点
   * @param p2 第二个点
   * @param minDistance 最小距离阈值
   * @returns 两点是否有效分开
   */
  private pointsAreDistinct(p1: DrawPoint, p2: DrawPoint, minDistance: number = 0.1): boolean {
    return Math.abs(p2.x - p1.x) > minDistance || Math.abs(p2.y - p1.y) > minDistance;
  }

  /**
   * 微调重合点，创造微小偏移
   * @param point 需要调整的点
   * @param referencePoint 参考点
   * @returns 调整后的点
   */
  private adjustPoint(point: DrawPoint, referencePoint: DrawPoint): DrawPoint {
    // 如果点重合，创建一个微小偏移
    const offset = 0.1; // 微小偏移量
    const dx = referencePoint.x - point.x;
    const dy = referencePoint.y - point.y;
    
    // 计算偏移方向
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    
    return {
      x: point.x - nx * offset,
      y: point.y - ny * offset,
      pressure: point.pressure,
      timestamp: point.timestamp
    };
  }

  /**
   * 计算三次贝塞尔曲线的控制点
   * 使用Catmull-Rom样条法计算控制点，提供平滑的曲线效果
   * 
   * @param p0 前一个点
   * @param p1 当前起始点
   * @param p2 当前终点
   * @param p3 下一个点
   * @param tension 张力系数，控制曲线的松紧程度
   * @returns 两个控制点的坐标
   */
  private calculateControlPoints(
    p0: DrawPoint, 
    p1: DrawPoint, 
    p2: DrawPoint, 
    p3: DrawPoint, 
    tension: number = 0.25
  ): ControlPoints {
    // 计算各段距离
    const d01 = this.calculateDistance(p0, p1);
    const d12 = this.calculateDistance(p1, p2);
    const d23 = this.calculateDistance(p2, p3);
    
    // 避免被零除，使用安全值
    const safeD01 = Math.max(d01, 0.0001);
    const safeD12 = Math.max(d12, 0.0001);
    const safeD23 = Math.max(d23, 0.0001);
    
    // 计算向量
    const v01x = (p1.x - p0.x) / safeD01;
    const v01y = (p1.y - p0.y) / safeD01;
    
    const v12x = (p2.x - p1.x) / safeD12;
    const v12y = (p2.y - p1.y) / safeD12;
    
    const v23x = (p3.x - p2.x) / safeD23;
    const v23y = (p3.y - p2.y) / safeD23;
    
    // 计算向量夹角的余弦值
    const cos_angle1 = v01x * v12x + v01y * v12y; // p0-p1和p1-p2之间的夹角余弦
    const cos_angle2 = v12x * v23x + v12y * v23y; // p1-p2和p2-p3之间的夹角余弦
    
    // 根据点间距离和夹角调整张力，使曲线更自然
    let adjustedTension1 = this.calculateAdjustedTension(tension, safeD12, safeD01, safeD23, cos_angle1);
    let adjustedTension2 = this.calculateAdjustedTension(tension, safeD12, safeD01, safeD23, cos_angle2);
    
    // 计算控制点
    return {
      cp1: this.calculateFirstControlPoint(p0, p1, p2, safeD01, safeD12, cos_angle1, adjustedTension1, v12x, v12y),
      cp2: this.calculateSecondControlPoint(p1, p2, p3, safeD12, safeD23, cos_angle2, adjustedTension2, v12x, v12y)
    };
  }

  /**
   * 计算调整后的张力值
   * @param tension 原始张力
   * @param safeD12 安全距离值(点1到点2)
   * @param safeD01 安全距离值(点0到点1)
   * @param safeD23 安全距离值(点2到点3)
   * @param cosAngle 向量夹角余弦值
   * @returns 调整后的张力值
   */
  private calculateAdjustedTension(
    tension: number, 
    safeD12: number, 
    safeD01: number, 
    safeD23: number, 
    cosAngle: number
  ): number {
    // 根据点间距离进行初步调整
    let adjustedTension = tension * Math.min(1, (safeD12 / (Math.max(safeD01, safeD23) + 0.0001)));
    
    // 如果夹角接近直角或更大(余弦值接近或小于0)，减小张力以处理拐角
    if (cosAngle < 0.2) { // 约80度或更大的角
      adjustedTension *= Math.max(0.1, (cosAngle + 0.8) / 1.0);
    }
    
    return adjustedTension;
  }

  /**
   * 计算第一个控制点
   */
  private calculateFirstControlPoint(
    p0: DrawPoint, 
    p1: DrawPoint, 
    p2: DrawPoint, 
    safeD01: number, 
    safeD12: number, 
    cosAngle: number, 
    adjustedTension: number,
    v12x: number,
    v12y: number
  ): {x: number, y: number} {
    if (cosAngle < 0) { // 夹角大于90度
      // 使用p1-p2方向的向量作为切线方向
      return {
        x: p1.x + v12x * safeD12 * adjustedTension,
        y: p1.y + v12y * safeD12 * adjustedTension
      };
    } else {
      // 使用常规Catmull-Rom方法
      return {
        x: p1.x + (p2.x - p0.x) / safeD01 * safeD12 * adjustedTension,
        y: p1.y + (p2.y - p0.y) / safeD01 * safeD12 * adjustedTension
      };
    }
  }

  /**
   * 计算第二个控制点
   */
  private calculateSecondControlPoint(
    p1: DrawPoint, 
    p2: DrawPoint, 
    p3: DrawPoint, 
    safeD12: number, 
    safeD23: number, 
    cosAngle: number, 
    adjustedTension: number,
    v12x: number,
    v12y: number
  ): {x: number, y: number} {
    if (cosAngle < 0) { // 夹角大于90度
      // 使用p1-p2方向的向量作为切线方向
      return {
        x: p2.x - v12x * safeD12 * adjustedTension,
        y: p2.y - v12y * safeD12 * adjustedTension
      };
    } else {
      // 使用常规Catmull-Rom方法
      return {
        x: p2.x - (p3.x - p1.x) / safeD23 * safeD12 * adjustedTension,
        y: p2.y - (p3.y - p1.y) / safeD23 * safeD12 * adjustedTension
      };
    }
  }

  /**
   * 创建镜像点(用于曲线首尾处理)
   * @param basePoint 基准点
   * @param referencePoint 参考点
   * @returns 镜像点
   */
  private createMirrorPoint(basePoint: DrawPoint, referencePoint: DrawPoint): DrawPoint {
    const mirror = {
      x: 2 * basePoint.x - referencePoint.x,
      y: 2 * basePoint.y - referencePoint.y,
      pressure: basePoint.pressure
    };
    
    // 确保镜像点不会与基准点完全重合
    if (!this.pointsAreDistinct(mirror, basePoint)) {
      // 如果重合，添加微小偏移
      const offsetX = (Math.random() - 0.5) * 0.2;
      const offsetY = (Math.random() - 0.5) * 0.2;
      mirror.x += offsetX;
      mirror.y += offsetY;
    }
    
    return mirror;
  }

  /**
   * 设置绘图上下文的样式
   * @param ctx Canvas绘图上下文
   * @param options 绘制选项
   */
  private setDrawingStyle(ctx: CanvasRenderingContext2D, options: DrawOptions): void {
    ctx.strokeStyle = options.color;
    ctx.fillStyle = options.color;
    ctx.lineWidth = options.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  /**
   * 绘制贝塞尔曲线段
   * @param ctx Canvas绘图上下文
   * @param p0 前一个点
   * @param p1 当前起始点
   * @param p2 当前终点
   * @param p3 下一个点
   * @param tension 张力系数
   */
  private drawBezierSegment(
    ctx: CanvasRenderingContext2D,
    p0: DrawPoint,
    p1: DrawPoint,
    p2: DrawPoint,
    p3: DrawPoint,
    tension: number
  ): void {
    // 检查点是否重合，重合时进行微调
    const adjustedP0 = this.pointsAreDistinct(p0, p1) ? p0 : this.adjustPoint(p0, p1);
    const adjustedP3 = this.pointsAreDistinct(p2, p3) ? p3 : this.adjustPoint(p3, p2);
    
    const controls = this.calculateControlPoints(adjustedP0, p1, p2, adjustedP3, tension);
    
    ctx.bezierCurveTo(
      controls.cp1.x, controls.cp1.y,
      controls.cp2.x, controls.cp2.y,
      p2.x, p2.y
    );
  }

  /**
   * 检查段是否有效（点不重合）
   */
  private segmentIsValid(points: DrawPoint[], startIdx: number): boolean {
    if (startIdx < 0 || startIdx + 3 >= points.length) return false;
    
    // 检查关键点是否充分分离
    const validStart = this.pointsAreDistinct(points[startIdx], points[startIdx+1]);
    const validEnd = this.pointsAreDistinct(points[startIdx+2], points[startIdx+3]);
    
    return validStart && validEnd;
  }

  /**
   * 绘制点 - 使用贝塞尔曲线连接
   * 统一处理不同数量的点，尽可能使用三次贝塞尔曲线
   * 
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
    
    // 确保最小绘制点数
    const minPoints = drawOptions.minPointsToRender || 4;
    if (points.length < minPoints) return;
    
    // 保存当前绘图状态
    ctx.save();
    
    // 设置绘图样式
    this.setDrawingStyle(ctx, drawOptions);
    
    // 开始绘制贝塞尔曲线
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    // 获取张力参数
    const tension = drawOptions.tension || 0.25;
    
    // 处理第一个曲线段 (使用第一个点的镜像作为前一个点)
    const firstMirror = this.createMirrorPoint(points[0], points[1]);
    
    // 绘制第一段曲线
    this.drawBezierSegment(ctx, firstMirror, points[0], points[1], points[2], tension);
    
    // 处理中间的曲线段
    for (let i = 1; i < points.length - 2; i++) {
      if (this.segmentIsValid(points, i-1)) {
        this.drawBezierSegment(ctx, points[i-1], points[i], points[i+1], points[i+2], tension);
      }
    }
    
    // 处理最后一个曲线段 (使用最后一个点的镜像作为后一个点)
    const lastIdx = points.length - 1;
    const lastMirror = this.createMirrorPoint(points[lastIdx], points[lastIdx-1]);
    
    this.drawBezierSegment(ctx, points[lastIdx-2], points[lastIdx-1], points[lastIdx], lastMirror, tension);
    
    // 执行绘制
    ctx.stroke();
    
    // 恢复绘图状态
    ctx.restore();
  }

  /**
   * 增量绘制点 - 只处理从指定索引开始的点
   * 避免重复处理已绘制过的点，提高性能
   * 
   * @param ctx Canvas绘图上下文
   * @param points 完整的点数组
   * @param startIndex 开始处理的点索引
   * @param endIndex 结束处理的点索引（默认为数组末尾）
   * @param options 绘制选项
   */
  drawIncrementalPoints(
    ctx: CanvasRenderingContext2D, 
    points: DrawPoint[], 
    startIndex: number,
    endIndex: number = points.length - 1,
    options?: Partial<DrawOptions>
  ): void {
    // 参数验证
    if (!ctx || points.length === 0 || startIndex < 0 || startIndex >= points.length) {
      return;
    }
    
    // 确保endIndex有效
    endIndex = Math.min(endIndex, points.length - 1);
    
    // 需要至少4个点才能绘制贝塞尔曲线
    if (points.length < 4) return;
    
    // 合并选项
    const drawOptions = { ...this.options, ...options };
    const tension = drawOptions.tension || 0.25;
    
    // 保存绘图状态并设置样式
    ctx.save();
    this.setDrawingStyle(ctx, drawOptions);
    
    // 开始新路径
    ctx.beginPath();
    
    // 根据起点位置选择不同的绘制策略
    if (startIndex <= 2) {
      // 从头或近头部开始绘制
      this.drawFromStartToEnd(ctx, points, 0, endIndex, tension);
    } else {
      // 从中间部分开始绘制
      this.drawFromMiddle(ctx, points, startIndex, endIndex, tension);
    }
    
    // 执行绘制并恢复状态
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 从起点到终点绘制完整路径
   */
  private drawFromStartToEnd(
    ctx: CanvasRenderingContext2D,
    points: DrawPoint[],
    startIdx: number,
    endIdx: number,
    tension: number
  ): void {
    // 移动到第一个点
    ctx.moveTo(points[startIdx].x, points[startIdx].y);
    
    // 如果点数足够，绘制第一段曲线（使用镜像点）
    if (points.length >= 3) {
      const firstMirror = this.createMirrorPoint(points[0], points[1]);
      this.drawBezierSegment(ctx, firstMirror, points[0], points[1], points[2], tension);
    }
    
    // 绘制中间段
    for (let i = 1; i <= Math.min(endIdx - 2, points.length - 3); i++) {
      if (this.segmentIsValid(points, i-1)) {
        this.drawBezierSegment(ctx, points[i-1], points[i], points[i+1], points[i+2], tension);
      }
    }
    
    // 处理最后一段（如果需要）
    if (endIdx >= points.length - 2 && points.length >= 3) {
      const lastIdx = points.length - 1;
      const lastMirror = this.createMirrorPoint(points[lastIdx], points[lastIdx-1]);
      this.drawBezierSegment(ctx, points[lastIdx-2], points[lastIdx-1], points[lastIdx], lastMirror, tension);
    }
  }

  /**
   * 从中间点开始绘制曲线
   */
  private drawFromMiddle(
    ctx: CanvasRenderingContext2D,
    points: DrawPoint[],
    startIndex: number,
    endIndex: number,
    tension: number
  ): void {
    // 确保有足够的上下文点用于曲线连续性
    const contextStartIdx = Math.max(0, startIndex - 3);
    
    // 移动到上下文起始点
    ctx.moveTo(points[contextStartIdx].x, points[contextStartIdx].y);
    
    // 首先绘制上下文点段，确保曲线连续
    for (let i = contextStartIdx; i < startIndex - 1; i++) {
      if (i + 3 < points.length && this.segmentIsValid(points, i)) {
        this.drawBezierSegment(ctx, points[i], points[i+1], points[i+2], points[i+3], tension);
      }
    }
    
    // 绘制从startIndex到endIndex的主要部分
    for (let i = startIndex - 1; i <= Math.min(endIndex - 2, points.length - 3); i++) {
      if (i >= 0 && i + 3 < points.length && this.segmentIsValid(points, i)) {
        this.drawBezierSegment(ctx, points[i], points[i+1], points[i+2], points[i+3], tension);
      }
    }
    
    // 处理最后一段（如果绘制到数组末尾）
    if (endIndex >= points.length - 2 && points.length >= 3) {
      const lastIdx = points.length - 1;
      const lastMirror = this.createMirrorPoint(points[lastIdx], points[lastIdx-1]);
      this.drawBezierSegment(ctx, points[lastIdx-2], points[lastIdx-1], points[lastIdx], lastMirror, tension);
    }
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