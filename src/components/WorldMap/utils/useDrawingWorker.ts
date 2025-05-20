import { ref, onMounted, onBeforeUnmount } from 'vue';

// 定义插值点结构
export interface Point {
  x: number;
  y: number;
}

// 定义Worker的输入参数结构
export interface InterpolationInput {
  id: number;
  points: Point[];
  newPoint: Point;
  distance: number;
  speed: number;
  baseMaxDistance: number;
  dynamicMaxDistance: number;
}

// 定义Worker的输出结果结构
export interface InterpolationResult {
  id: number;
  interpolatedPoints: Point[];
}

// 定义回调函数类型
export type InterpolationCallback = (result: InterpolationResult) => void;

/**
 * 绘图Worker Hook
 * 处理与绘图计算Worker的通信
 */
export function useDrawingWorker() {
  // 保存Worker引用
  const worker = ref<Worker | null>(null);
  
  // 保存回调函数映射
  const callbacks = new Map<number, InterpolationCallback>();
  
  // 生成唯一ID
  let nextId = 1;
  
  // 初始化Worker
  onMounted(() => {
    try {
      // 使用Vite的方式创建Worker
      const WorkerConstructor = new Worker(
        new URL('../../../workers/drawingWorker.ts', import.meta.url), 
        { type: 'module' }
      );
      
      worker.value = WorkerConstructor;
      
      // 设置消息处理函数
      worker.value.onmessage = (e: MessageEvent) => {
        const result = e.data as InterpolationResult;
        if (result && typeof result.id === 'number') {
          // 查找对应的回调函数
          const callback = callbacks.get(result.id);
          if (callback) {
            // 执行回调
            callback(result);
            // 删除回调引用
            callbacks.delete(result.id);
          }
        }
      };
      
      console.log('绘图计算Worker已初始化');
    } catch (error) {
      console.error('初始化绘图计算Worker失败:', error);
      console.error(error);
    }
  });
  
  // 清理Worker
  onBeforeUnmount(() => {
    if (worker.value) {
      worker.value.terminate();
      worker.value = null;
      callbacks.clear();
      console.log('绘图计算Worker已终止');
    }
  });
  
  /**
   * 计算插值点
   * @param points 当前点集合
   * @param newPoint 新添加的点
   * @param distance 距离
   * @param speed 速度
   * @param baseMaxDistance 基础最大距离
   * @param dynamicMaxDistance 动态最大距离
   * @param callback 处理结果的回调函数
   */
  function calculateInterpolatedPoints(
    points: Point[],
    newPoint: Point,
    distance: number,
    speed: number,
    baseMaxDistance: number,
    dynamicMaxDistance: number,
    callback: InterpolationCallback
  ) {
    if (!worker.value) {
      console.warn('绘图计算Worker未初始化，无法计算插值点');
      callback({ id: -1, interpolatedPoints: [] });
      return;
    }
    
    // 生成请求ID
    const id = nextId++;
    
    // 注册回调
    callbacks.set(id, callback);
    
    // 构建输入参数
    const input: InterpolationInput = {
      id,
      points,
      newPoint,
      distance,
      speed,
      baseMaxDistance,
      dynamicMaxDistance
    };
    
    // 发送消息到Worker
    worker.value.postMessage(input);
  }
  
  /**
   * 检查Worker是否可用
   */
  function isWorkerAvailable(): boolean {
    return worker.value !== null;
  }
  
  return {
    calculateInterpolatedPoints,
    isWorkerAvailable
  };
} 