import { DrawOptions, DrawPoint } from "./DrawingEngine";

// 临时接口，解决无法找到Point的问题
interface Point {
  x: number;
  y: number;
}

// 表示待处理的线段，存储其起点和终点索引
interface LineSegment {
  startIdx: number;  // 起始点索引
  endIdx: number;    // 终止点索引
}

export class PathDatastore {
    private points: DrawPoint[] = [];
    private originalPoints: DrawPoint[] = []; // 存储原始点
    private controlPointsCache: Map<number, {cp1: Point, cp2: Point}> = new Map();
    private options: DrawOptions;
    private lastProcessedIndex: number = -1;
    private minPointsToRender: number = 4; // 贝塞尔曲线绘制所需的最小点数
    
    // 新增属性
    private isActive: boolean = false; // 标记是否处于活动状态
    private pathEventId: number = 0; // 当前绘制事件ID，用于区分不同的绘制事件
    private originalPointCount: number = 0; // 记录原始点数
    
    // 简化参数
    private liveSimplificationEpsilon: number = 0.5;   // 实时简化阈值
    private finalSimplificationEpsilon: number = 0.3;  // 最终简化阈值(更严格)
    private simplificationThreshold: number = 10;      // 触发简化的点数阈值
    private enableSimplification: boolean = true;      // 是否启用简化
    private batchSize: number = 100;                   // 批处理大小
    
    constructor(options?: Partial<DrawOptions>, minPointsToRender: number = 4) {
      this.options = {
        lineWidth: 2,
        color: '#000000',
        tool: 'pen',
        tension: 0.25,
        ...options
      };
      this.minPointsToRender = minPointsToRender;
    }
    
    /**
     * 检查是否处于活动绘制状态
     */
    public isDrawingActive(): boolean {
      return this.isActive;
    }
    
    /**
     * 获取当前绘制事件ID
     */
    public getCurrentEventId(): number {
      return this.pathEventId;
    }

    /**
     * 开始新的绘制事件
     * 当鼠标按下时调用此方法
     */
    public startPathEvent(): void {
      this.isActive = true;
      this.pathEventId++; // 增加事件ID，用于识别新的绘制事件
      this.reset(); // 清空现有点
      this.originalPointCount = 0;
      console.log(`开始新绘制事件 ID: ${this.pathEventId}`);
    }
    
    /**
     * 结束当前绘制事件
     * 当鼠标抬起时调用此方法
     */
    public finalizePathEvent(): void {
      if (!this.isActive) return;
      
      this.isActive = false;
      
      // 应用最终简化，使用更严格的epsilon值
      if (this.enableSimplification && this.points.length > this.minPointsToRender) {
        const originalCount = this.points.length;
        const startTime = performance.now();
        
        // 根据点数量选择简化策略
        if (this.points.length < 100) {
          // 少量点：一次性全局简化，使用较严格的epsilon以获得最佳简化效果
          this.points = this.rdpSimplifyIterative(this.points, this.finalSimplificationEpsilon);
          console.log('少量简化后点数:', this.points.length);
        } else {
          // 大量点：分批处理简化
          this.points = this.processByBatches(this.points, this.finalSimplificationEpsilon);
          console.log('大量简化后点数:', this.points.length);
        }
        
        const endTime = performance.now();
        console.log(`结束绘制事件 ID: ${this.pathEventId}，原始点数: ${originalCount}，简化后点数: ${this.points.length}，简化率: ${((originalCount - this.points.length) / originalCount * 100).toFixed(1)}%，耗时: ${(endTime - startTime).toFixed(2)}ms`);
      } else {
        console.log(`结束绘制事件 ID: ${this.pathEventId}，总点数: ${this.points.length}，未应用简化`);
      }
    }
    
    /**
     * 计算点到线段的垂直距离
     * @param point 待计算点
     * @param lineStart 线段起点
     * @param lineEnd 线段终点
     * @returns 点到线段的垂直距离
     */
    private perpendicularDistance(point: DrawPoint, lineStart: DrawPoint, lineEnd: DrawPoint): number {
      const dx = lineEnd.x - lineStart.x;
      const dy = lineEnd.y - lineStart.y;
      
      // 线段长度的平方
      const lineLengthSquared = dx * dx + dy * dy;
      
      // 处理退化为点的情况
      if (lineLengthSquared === 0) {
        return Math.sqrt(
          Math.pow(point.x - lineStart.x, 2) + 
          Math.pow(point.y - lineStart.y, 2)
        );
      }
      
      // 计算投影比例
      const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / 
                lineLengthSquared;
      
      if (t < 0) {
        // 点在线段起点外
        return Math.sqrt(
          Math.pow(point.x - lineStart.x, 2) + 
          Math.pow(point.y - lineStart.y, 2)
        );
      }
      if (t > 1) {
        // 点在线段终点外
        return Math.sqrt(
          Math.pow(point.x - lineEnd.x, 2) + 
          Math.pow(point.y - lineEnd.y, 2)
        );
      }
      
      // 点在线段投影上，计算垂直距离
      const projectionX = lineStart.x + t * dx;
      const projectionY = lineStart.y + t * dy;
      
      return Math.sqrt(
        Math.pow(point.x - projectionX, 2) + 
        Math.pow(point.y - projectionY, 2)
      );
    }
    
    /**
     * 迭代版RDP算法
     * @param points 原始点集
     * @param epsilon 简化阈值
     * @returns 简化后的点集
     */
    private rdpSimplifyIterative(points: DrawPoint[], epsilon: number): DrawPoint[] {
      if (points.length <= 2) return points;
      
      // 初始化结果集 - 使用布尔数组标记保留的点
      const keepPoints: boolean[] = new Array(points.length).fill(false);
      
      // 首尾点必须保留
      keepPoints[0] = true;
      keepPoints[points.length - 1] = true;
      
      // 初始化栈，处理整个线段
      const stack: LineSegment[] = [];
      stack.push({ startIdx: 0, endIdx: points.length - 1 });
      
      // 迭代处理
      while (stack.length > 0) {
        // 取出当前待处理线段
        const segment = stack.pop()!;
        const { startIdx, endIdx } = segment;
        
        // 寻找最远点
        let maxDistance = 0;
        let maxIdx = startIdx;
        
        for (let i = startIdx + 1; i < endIdx; i++) {
          const distance = this.perpendicularDistance(
            points[i],
            points[startIdx],
            points[endIdx]
          );
          
          if (distance > maxDistance) {
            maxDistance = distance;
            maxIdx = i;
          }
        }
        
        // 如果最大距离超过阈值，则保留该点，并继续处理两个子线段
        if (maxDistance > epsilon) {
          keepPoints[maxIdx] = true;
          
          // 避免重复处理已有的单点线段
          if (maxIdx - startIdx > 1) {
            stack.push({ startIdx, endIdx: maxIdx });
          }
          
          if (endIdx - maxIdx > 1) {
            stack.push({ startIdx: maxIdx, endIdx });
          }
        }
      }
      
      // 根据标记结果生成简化后的点集
      return points.filter((_, index) => keepPoints[index]);
    }
    
    /**
     * 分批处理大型点集进行简化
     * @param points 原始点集
     * @param epsilon 简化阈值
     * @returns 简化后的点集
     */
    private processByBatches(points: DrawPoint[], epsilon: number): DrawPoint[] {
      // 点数少于批处理大小时，直接使用一次性简化
      if (points.length <= this.batchSize) {
        return this.rdpSimplifyIterative(points, epsilon);
      }
      
      // 分批处理，确保批次间有重叠，保证连续性
      const overlap = Math.min(10, Math.floor(this.batchSize * 0.1)); // 批次间重叠点数，最少10点或批大小的10%
      const result: DrawPoint[] = [];
      
      // 处理每个批次
      for (let i = 0; i < points.length; i += this.batchSize - overlap) {
        const batchEnd = Math.min(i + this.batchSize, points.length);
        const batch = points.slice(i, batchEnd);
        
        // 简化当前批次
        const simplifiedBatch = this.rdpSimplifyIterative(batch, epsilon);
        
        // 添加到结果中，但跳过与上一批次重叠的部分
        if (i === 0) {
          result.push(...simplifiedBatch);
        } else {
          // 跳过重叠的前部分点
          const skipCount = Math.min(overlap, simplifiedBatch.length / 2); // 确保不会跳过太多点
          result.push(...simplifiedBatch.slice(skipCount));
        }
        
        if (batchEnd === points.length) break;
      }
      
      return result;
    }
    
    /**
     * 计算自适应简化阈值
     * @param points 点集
     * @returns 动态计算的简化阈值
     */
    private calculateAdaptiveEpsilon(points: DrawPoint[]): number {
      // 计算平均点间距
      let totalDistance = 0;
      for (let i = 1; i < Math.min(points.length, 50); i++) {
        totalDistance += Math.sqrt(
          Math.pow(points[i].x - points[i-1].x, 2) + 
          Math.pow(points[i].y - points[i-1].y, 2)
        );
      }
      
      const sampleSize = Math.min(points.length - 1, 49);
      if (sampleSize <= 0) return this.liveSimplificationEpsilon;
      
      const averageDistance = totalDistance / sampleSize;
      
      // 实时简化使用较宽松的epsilon，保留更多细节
      // 最终简化时会使用更严格的值
      return Math.max(0.2, averageDistance * 0.7);
    }
    
    /**
     * 应用最终简化 - 使用更严格的epsilon值
     */
    private applyFinalSimplification(): void {
      if (this.points.length <= 2) return;
      
      // 使用更精确的最终简化阈值
      const epsilon = this.finalSimplificationEpsilon;
      
      // 使用分批处理简化整个路径
      this.points = this.processByBatches(this.points, epsilon);
    }
    
    /**
     * 应用实时部分简化
     * @param newPoints 新添加的点
     * @returns 简化后的点集
     */
    private applyRealtimeSimplification(newPoints: DrawPoint[]): DrawPoint[] {
      if (newPoints.length <= 2) return newPoints;
      
      // 使用自适应阈值
      const epsilon = this.calculateAdaptiveEpsilon(newPoints);
      
      // 对新点应用RDP简化
      return this.rdpSimplifyIterative(newPoints, epsilon);
    }
    
    /**
     * 从PointerEvent中提取绘图点
     * 支持处理coalesced events以获取高精度点集
     * @param event 原始指针事件
     * @param coordTransform 坐标转换工具
     * @param canvas 画布元素
     * @param mapCoord 可选的地图坐标(已废弃，保留以兼容旧代码)
     * @returns 提取的绘图点数组
     */
    public static extractPointsFromEvent(
      event: PointerEvent, 
      coordTransform: any,
      canvas: HTMLCanvasElement,
      mapCoord?: {x: number, y: number}
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
     * 从事件中提取点并直接添加到存储
     * 一步完成提取和存储操作
     * @param event 原始指针事件 
     * @param coordTransform 坐标转换工具
     * @param canvas 画布元素
     */
    public extractAndAddPoints(
      event: PointerEvent, 
      coordTransform: any,
      canvas: HTMLCanvasElement
    ): void {
      // 只有在活动状态才添加点
      if (!this.isActive) {
        console.warn('尝试在非活动状态添加点');
      }
      
      const newPoints = PathDatastore.extractPointsFromEvent(event, coordTransform, canvas);
      this.addPoints(newPoints);
    }
    
    /**
     * 检查是否有足够的点进行绘制
     * @returns 是否有足够点进行绘制的布尔值
     */
    public isReadyForDrawing(): boolean {
      return this.points.length >= this.minPointsToRender;
    }
    
    /**
     * 添加从事件中提取的点，并进行实时简化
     * @param newPoints 新提取的点数组
     */
    public addPoints(newPoints: DrawPoint[]): void {
      // 存储原始点用于可能的分析
      this.originalPoints.push(...newPoints);
      this.originalPointCount += newPoints.length;
      
      // 应用实时简化 - 只对较大的新点批次进行简化，减少频繁简化
      if (this.enableSimplification && newPoints.length > 5) {
        // 简化新点
        const simplifiedNewPoints = this.applyRealtimeSimplification(newPoints);
        
        // 添加简化后的点
        this.points.push(...simplifiedNewPoints);
        
        if (newPoints.length !== simplifiedNewPoints.length && newPoints.length > 10) {
          console.log(`实时简化: ${newPoints.length} -> ${simplifiedNewPoints.length} 点`);
        }
      } else {
        // 不简化直接添加
        this.points.push(...newPoints);
      }
    }
    
    /**
     * 启用或禁用点简化
     * @param enable 是否启用简化
     */
    public setSimplificationEnabled(enable: boolean): void {
      this.enableSimplification = enable;
    }
    
    /**
     * 设置简化参数
     * @param params 简化参数对象
     */
    public setSimplificationParams(params: {
      liveEpsilon?: number;
      finalEpsilon?: number;
      threshold?: number;
    }): void {
      if (params.liveEpsilon !== undefined) this.liveSimplificationEpsilon = params.liveEpsilon;
      if (params.finalEpsilon !== undefined) this.finalSimplificationEpsilon = params.finalEpsilon;
      if (params.threshold !== undefined) this.simplificationThreshold = params.threshold;
    }
    
    // 获取增量绘制数据
    public getIncrementalDrawData(): {
      points: DrawPoint[],
      newSegmentStartIndex: number,
      options: DrawOptions,
      canDraw: boolean, // 添加标志位表示是否可以绘制
      eventId?: number // 新增：绘制事件ID
    } {
      const canDraw = this.points.length >= this.minPointsToRender;
      const newSegmentStartIndex = Math.max(0, this.lastProcessedIndex - 2);
      this.lastProcessedIndex = this.points.length - 1;
      
      return {
        points: this.points,
        newSegmentStartIndex,
        options: this.options,
        canDraw, // 返回是否可以绘制的标志位
        eventId: this.pathEventId // 返回当前事件ID
      };
    }
    
    // 重置点集
    public reset(): void {
      this.points = [];
      this.originalPoints = [];
      this.controlPointsCache.clear();
      this.lastProcessedIndex = -1;
      this.originalPointCount = 0;
    }
    
    // 完成绘制，返回最终路径数据
    public finalizePath(): {
      points: DrawPoint[],
      options: DrawOptions,
      eventId?: number, // 绘制事件ID
      originalPointCount?: number // 原始点数
    } {
      return {
        points: [...this.points],
        options: {...this.options},
        eventId: this.pathEventId,
        originalPointCount: this.originalPointCount
      };
    }
    
    /**
     * 获取当前点数
     */
    public getPointCount(): number {
      return this.points.length;
    }
    
    /**
     * 获取原始点数（未简化）
     */
    public getOriginalPointCount(): number {
      return this.originalPointCount;
    }
    
    /**
     * 获取简化率
     */
    public getSimplificationRate(): number {
      if (this.originalPointCount === 0) return 0;
      return (this.originalPointCount - this.points.length) / this.originalPointCount;
    }

  }