import { DrawOptions, DrawPoint } from "./DrawingEngine";

// 临时接口，解决无法找到Point的问题
interface Point {
  x: number;
  y: number;
}

export class PathDatastore {
    private points: DrawPoint[] = [];
    private controlPointsCache: Map<number, {cp1: Point, cp2: Point}> = new Map();
    private options: DrawOptions;
    private lastProcessedIndex: number = -1;
    private minPointsToRender: number = 4; // 贝塞尔曲线绘制所需的最小点数
    
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
    
    // 添加从事件中提取的点
    public addPoints(newPoints: DrawPoint[]): void {
      this.points.push(...newPoints);
      // 可以在这里实现点的简化或过滤
    }
    
    // 获取增量绘制数据
    public getIncrementalDrawData(): {
      points: DrawPoint[],
      newSegmentStartIndex: number,
      options: DrawOptions,
      canDraw: boolean // 添加标志位表示是否可以绘制
    } {
      const canDraw = this.points.length >= this.minPointsToRender;
      const newSegmentStartIndex = Math.max(0, this.lastProcessedIndex - 2);
      this.lastProcessedIndex = this.points.length - 1;
      
      return {
        points: this.points,
        newSegmentStartIndex,
        options: this.options,
        canDraw // 返回是否可以绘制的标志位
      };
    }
    
    // 重置点集
    public reset(): void {
      this.points = [];
      this.controlPointsCache.clear();
      this.lastProcessedIndex = -1;
    }
    
    // 完成绘制，返回最终路径数据
    public finalizePath(): {
      points: DrawPoint[],
      options: DrawOptions
    } {
      return {
        points: [...this.points],
        options: {...this.options}
      };
    }
  }