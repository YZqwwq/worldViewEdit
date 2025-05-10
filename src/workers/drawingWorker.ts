/**
 * 绘图计算Worker
 * 用于离线计算绘图点插值，以提高UI线程性能
 */

// 点结构接口
interface Point {
  x: number;
  y: number;
}

// 插值输入参数接口
interface InterpolationInput {
  id: number;
  points: Point[];
  newPoint: Point;
  distance: number;
  speed: number;
  baseMaxDistance: number;
  dynamicMaxDistance: number;
}

// 插值结果接口
interface InterpolationResult {
  id: number;
  interpolatedPoints: Point[];
}

// 获取发送消息的类型保护
function isInterpolationInput(data: any): data is InterpolationInput {
  return data && 
    typeof data === 'object' && 
    Array.isArray(data.points) &&
    typeof data.newPoint === 'object' &&
    typeof data.distance === 'number' &&
    typeof data.speed === 'number';
}

/**
 * 计算贝塞尔曲线点
 * 使用三次贝塞尔曲线算法
 */
function computeCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const c1x = p1.x + (p2.x - p0.x) / 6;
  const c1y = p1.y + (p2.y - p0.y) / 6;
  const c2x = p2.x - (p3.x - p1.x) / 6;
  const c2y = p2.y - (p3.y - p1.y) / 6;
  
  const x = Math.pow(1-t, 3) * p1.x 
          + 3 * Math.pow(1-t, 2) * t * c1x 
          + 3 * (1-t) * Math.pow(t, 2) * c2x 
          + Math.pow(t, 3) * p2.x;
  const y = Math.pow(1-t, 3) * p1.y 
          + 3 * Math.pow(1-t, 2) * t * c1y 
          + 3 * (1-t) * Math.pow(t, 2) * c2y 
          + Math.pow(t, 3) * p2.y;
          
  return { x, y };
}

/**
 * 计算二次贝塞尔曲线点
 * 使用二次贝塞尔曲线算法
 */
function computeQuadraticBezier(p0: Point, p1: Point, p2: Point, t: number): Point {
  const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
  const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
  return { x, y };
}

/**
 * 生成插值点
 * @param input 插值输入参数
 * @returns 插值结果
 */
function generateInterpolatedPoints(input: InterpolationInput): InterpolationResult {
  const { id, points, newPoint, distance, speed, baseMaxDistance, dynamicMaxDistance } = input;
  const lastPoint = points[points.length - 1];
  const result: Point[] = [];
  
  // 复制逻辑，与useLayerTools.ts中的保持一致但有优化
  if (points.length >= 2) {
    if (distance > 2 && distance < dynamicMaxDistance) {
      // 计算基础插值点数
      const basePointsToAdd = Math.min(12, Math.max(4, Math.floor(distance / 3)));
      const speedFactor = Math.min(4, Math.max(1, speed * 30));
      const pointsToAdd = Math.floor(basePointsToAdd * speedFactor);
      
      // 根据现有点数选择不同的插值算法
      if (points.length >= 3) {
        // 使用三次贝塞尔曲线插值
        const p0 = points[points.length - 3];
        const p1 = points[points.length - 2];
        const p2 = lastPoint;
        const p3 = newPoint;
        
        for (let i = 1; i <= pointsToAdd; i++) {
          const t = i / (pointsToAdd + 1);
          result.push(computeCubicBezier(p0, p1, p2, p3, t));
        }
      } else {
        // 使用二次贝塞尔曲线插值
        const p0 = points[points.length - 2];
        const p1 = lastPoint;
        const p2 = newPoint;
        
        for (let i = 1; i <= pointsToAdd; i++) {
          const t = i / (pointsToAdd + 1);
          result.push(computeQuadraticBezier(p0, p1, p2, t));
        }
      }
    } else if (distance >= dynamicMaxDistance) {
      // 对于距离过大的情况进行更多插值
      const pointsToAdd = Math.min(30, Math.floor(distance / 10));
      const dx = newPoint.x - lastPoint.x;
      const dy = newPoint.y - lastPoint.y;
      
      for (let i = 1; i <= pointsToAdd; i++) {
        const ratio = i / (pointsToAdd + 1);
        // 使用更平滑的插值函数
        const smoothRatio = 3 * ratio * ratio - 2 * ratio * ratio * ratio;
        result.push({
          x: lastPoint.x + dx * smoothRatio,
          y: lastPoint.y + dy * smoothRatio
        });
      }
    }
  }
  
  return {
    id,
    interpolatedPoints: result
  };
}

// 监听主线程消息
self.addEventListener('message', (e: MessageEvent) => {
  if (isInterpolationInput(e.data)) {
    // 计算插值点
    const result = generateInterpolatedPoints(e.data);
    // 返回结果给主线程
    self.postMessage(result);
  }
}); 