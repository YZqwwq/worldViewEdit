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
    private untransformedOriginalPoints: Point[] = []; // 存储未坐标转换的原始点
    private coalescedPoints: Point[] = []; // 存储合并事件的点
    private controlPointsCache: Map<number, {cp1: Point, cp2: Point}> = new Map();
    private options: DrawOptions;
    private lastProcessedIndex: number = -1;
    private minPointsToRender: number = 4; // 贝塞尔曲线绘制所需的最小点数
    
    // 核心状态属性
    private isActive: boolean = false; // 标记是否处于活动状态
    private pathEventId: number = 0; // 当前绘制事件ID，用于区分不同的绘制事件
    private originalPointCount: number = 0; // 记录原始点数
    private processedBatchCount: number = 0; // 已处理批次计数
    
    // 简化参数，减少重复参数
    private liveSimplificationEpsilon: number = 0.5;   // 实时简化阈值
    private finalSimplificationEpsilon: number = 0.3;  // 最终简化阈值(更严格)
    private enableSimplification: boolean = false;     // 默认禁用简化
    private batchSize: number = 50;                    // 统一批处理大小
    private batchOverlap: number = 10;                 // 批次间重叠点数
    
    // 用于验证事件点的辅助属性
    private lastValidTimestamp: number = 0;
    private lastValidPoint: Point | null = null;
    
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
      this.processedBatchCount = 0; // 重置批次计数
      
      // 重置点验证状态
      this.lastValidTimestamp = 0;
      this.lastValidPoint = null;
    }
    
    /**
     * 结束当前绘制事件
     * 当鼠标抬起时调用此方法
     */
    public finalizePathEvent(): void {
      if (!this.isActive) return;
      
      this.isActive = false;
      
      // 已禁用路径简化，只记录点数
      console.log(`绘制完成，总点数: ${this.points.length}`);
      
      // 重置批次处理计数
      this.processedBatchCount = 0;
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
     * 验证事件点是否有效
     * 过滤掉可能的异常点：时间倒退、距离过远的点
     */
    private isValidEventPoint(newPoint: Point, timestamp: number): boolean {
      // 时间戳检查 - 如果时间戳小于上一个有效点，可能是事件乱序
      if (timestamp < this.lastValidTimestamp && this.lastValidTimestamp - timestamp > 50) {
        console.log('过滤时间倒退的点', timestamp, this.lastValidTimestamp);
        return false;
      }
      
      // 距离检查 - 如果与上一个点距离过远，可能是异常点
      if (this.lastValidPoint) {
        const dx = newPoint.x - this.lastValidPoint.x;
        const dy = newPoint.y - this.lastValidPoint.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        // 过滤掉距离过远的点（阈值可调整）
        if (distance > 100) {
          console.log('过滤距离异常点', distance);
          return false;
        }
      }
      
      // 更新最后有效点和时间戳
      this.lastValidPoint = newPoint;
      this.lastValidTimestamp = timestamp;
      return true;
    }

    /**
     * 从PointerEvent中提取绘图点
     * 支持处理coalesced events以获取高精度点集，并增加验证逻辑
     * @param event 原始指针事件
     * @param coordTransform 坐标转换工具
     * @param canvas 画布元素
     * @returns 提取的绘图点数组
     */
    public extractPointsFromEvent(
      event: PointerEvent, 
      coordTransform: any,
      canvas: HTMLCanvasElement
    ): DrawPoint[] {
      const points: DrawPoint[] = [];
      const now = Date.now();
      
      // 重新启用合并事件，但增加验证机制
      if ('getCoalescedEvents' in event && typeof event.getCoalescedEvents === 'function') {
        const events = event.getCoalescedEvents(); // 获取合并事件
        
        // 如果有合并事件，处理所有事件
        if (events.length > 1) {
          // 添加所有合并事件点，但先验证
          for (const e of events) {
            const clientPoint = {x: e.clientX, y: e.clientY};
            
            // 验证点是否有效
            if (this.isValidEventPoint(clientPoint, e.timeStamp)) {
              // 记录原始点坐标
              this.coalescedPoints.push(clientPoint);
              
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
          }
          
          if (points.length > 0) {
            return points;
          }
        }
      }
      
      // 如果没有合并事件或验证后没有有效点，使用原始事件点
      const clientPoint = {x: event.clientX, y: event.clientY};
      if (this.isValidEventPoint(clientPoint, event.timeStamp)) {
        this.coalescedPoints.push(clientPoint);
        const pointCoord = coordTransform.screenToMap(event.clientX, event.clientY, canvas);
        points.push({
          x: pointCoord.x,
          y: pointCoord.y,
          timestamp: event.timeStamp || now,
          pressure: event.pressure !== undefined ? event.pressure : 1.0
        });
      }
      
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
      if (!this.isActive) return;
      
      this.untransformedOriginalPoints.push({x: event.clientX, y: event.clientY});
      const newPoints = this.extractPointsFromEvent(event, coordTransform, canvas);
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
     * 添加从事件中提取的点，并执行渐进式简化
     * @param newPoints 新提取的点数组
     */
    public addPoints(newPoints: DrawPoint[]): void {
      if (!newPoints.length) return;
      
      // 存储原始点用于统计和分析
      this.originalPoints.push(...newPoints);
      this.originalPointCount += newPoints.length;
      
      // 添加新点 - 不再进行简化处理
      this.points.push(...newPoints);
      
      // 更新最后处理位置，虽然不再简化，但保持这个值用于其他功能
      this.lastProcessedIndex = this.points.length - 1;
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
      batchSize?: number;
      batchOverlap?: number;
    }): void {
      if (params.liveEpsilon !== undefined) this.liveSimplificationEpsilon = params.liveEpsilon;
      if (params.finalEpsilon !== undefined) this.finalSimplificationEpsilon = params.finalEpsilon;
      if (params.batchSize !== undefined) this.batchSize = params.batchSize;
      if (params.batchOverlap !== undefined) this.batchOverlap = params.batchOverlap;
    }
    
    /**
     * 获取增量绘制数据
     */
    public getIncrementalDrawData(): {
      points: DrawPoint[],
      newSegmentStartIndex: number,
      options: DrawOptions,
      canDraw: boolean,
      eventId?: number
    } {
      const canDraw = this.points.length >= this.minPointsToRender;
      
      // 当禁用简化时，始终从头绘制整条路径，确保线条连续
      // 这样在移动过程中不会出现线条中断
      const newSegmentStartIndex = this.enableSimplification 
        ? Math.max(0, this.lastProcessedIndex - 2)  // 启用简化时使用增量绘制
        : 0;                                        // 禁用简化时从头绘制
      
      return {
        points: this.points,
        newSegmentStartIndex,
        options: this.options,
        canDraw,
        eventId: this.pathEventId
      };
    }
    
    /**
     * 重置点集
     */
    public reset(): void {
      this.points = [];
      this.originalPoints = [];
      this.untransformedOriginalPoints = [];
      this.coalescedPoints = []; // 确保重置合并事件点数组
      this.controlPointsCache.clear();
      this.lastProcessedIndex = -1;
      this.originalPointCount = 0;
    }
    
    /**
     * 完成绘制，返回最终路径数据
     */
    public finalizePath(): {
      points: DrawPoint[],
      originalPoints: DrawPoint[],
      untransformedOriginalPoints: Point[],
      coalescedPoints: Point[],
      options: DrawOptions,
      eventId?: number,
      originalPointCount?: number
    } {
      return {
        points: [...this.points],
        originalPoints: [...this.originalPoints],
        untransformedOriginalPoints: [...this.untransformedOriginalPoints],
        coalescedPoints: [...this.coalescedPoints],
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