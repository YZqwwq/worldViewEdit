/**
 * 简化版坐标转换系统
 * 只关注鼠标在地图上的精确定位，不做额外的限制
 */
import { Ref } from 'vue';

// 坐标类型
export interface Coordinate {
  x: number;
  y: number;
}

// 视图状态接口
export interface ViewState {
  offsetX: number;
  offsetY: number;
  scale: number;
  dpr: number;
}

/**
 * 坐标转换工具
 * @param offsetX - 地图X轴偏移量引用
 * @param offsetY - 地图Y轴偏移量引用
 * @param scale - 地图缩放比例引用
 */
export function useCoordinateTransform(
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>
) {
  /**
   * 获取当前设备像素比
   * @returns 设备像素比
   */
  function getDpr(): number {
    return window.devicePixelRatio || 1;
  }

  /**
   * 从屏幕坐标(clientX/Y)转换为Canvas坐标
   * @param clientX - 鼠标事件的clientX
   * @param clientY - 鼠标事件的clientY
   * @param element - 画布元素
   * @param applyDpr - 是否应用设备像素比（默认为true）
   * @returns Canvas上的坐标
   */
  function screenToCanvas(
    clientX: number,
    clientY: number,
    element: HTMLElement,
  ): Coordinate {
    const rect = element.getBoundingClientRect();
    const dpr = getDpr();
    const canvasX = (clientX - rect.left) * dpr;
    const canvasY = (clientY - rect.top) * dpr;
    
    return {
      x: canvasX,
      y: canvasY
    };
  }

  /**
   * 从Canvas坐标转换为地图坐标
   * @param canvasX - Canvas（画布容器）上的X坐标
   * @param canvasY - Canvas（画布容器）上的Y坐标
   * @param applyDpr - 是否已应用设备像素比（默认为true）
   * @returns 地图上的坐标
   */
  function canvasToMap(canvasX: number, canvasY: number): Coordinate {
    const dpr = getDpr();
    const scaledOffsetX = offsetX.value * dpr;
    const scaledOffsetY = offsetY.value * dpr;
    const scaledScale = scale.value * dpr;
    
    const mapX = (canvasX - scaledOffsetX) / scaledScale;
    const mapY = (canvasY - scaledOffsetY) / scaledScale;
    
    return {
      x: mapX,
      y: mapY
    };
  }

  /**
   * 从屏幕坐标直接转换为地图坐标
   * @param clientX - 鼠标事件的clientX
   * @param clientY - 鼠标事件的clientY
   * @param element - 画布元素
   * @returns 地图上的坐标
   */
  function screenToMap(
    clientX: number,
    clientY: number,
    element: HTMLElement
  ): Coordinate {
    const canvas = screenToCanvas(clientX, clientY, element);
    const mapCoord = canvasToMap(canvas.x, canvas.y);
    
    return mapCoord;
  }

  /**
   * 从地图坐标转换为Canvas坐标
   * @param mapX - 地图上的X坐标
   * @param mapY - 地图上的Y坐标
   * @param applyDpr - 是否应用设备像素比（默认为true）
   * @returns Canvas上的坐标
   */
  function mapToCanvas(mapX: number, mapY: number, applyDpr: boolean = true): Coordinate {
    const dpr = applyDpr ? getDpr() : 1;
    const scaledScale = scale.value * dpr;
    const scaledOffsetX = offsetX.value * dpr;
    const scaledOffsetY = offsetY.value * dpr;
    
    const canvasX = mapX * scaledScale + scaledOffsetX;
    const canvasY = mapY * scaledScale + scaledOffsetY;
    
    return {
      x: canvasX,
      y: canvasY
    };
  }

  /**
   * 获取适用于Canvas变换矩阵的参数
   * 用于setTransform方法
   * @returns 变换矩阵参数 [scaleX, skewY, skewX, scaleY, translateX, translateY]
   */
  function getTransformParams(): [number, number, number, number, number, number] {
    const dpr = getDpr();
    const scaledScale = scale.value * dpr;
    const scaledOffsetX = offsetX.value * dpr;
    const scaledOffsetY = offsetY.value * dpr;
    
    return [scaledScale, 0, 0, scaledScale, scaledOffsetX, scaledOffsetY];
  }

  /**
   * 使用当前的视图状态创建ViewState对象
   * @returns 当前视图状态（包含DPR信息）
   */
  function getCurrentViewState(): ViewState {
    return {
      offsetX: offsetX.value,
      offsetY: offsetY.value,
      scale: scale.value,
      dpr: getDpr()
    };
  }

  /**
   * 调试工具：检查坐标系统是否正确运作
   * 在控制台输出关键信息以帮助诊断问题
   */
  function debugCoordinateSystem(clientX: number, clientY: number, element: HTMLElement): void {
    const dpr = getDpr();
    const canvas = screenToCanvas(clientX, clientY, element);
    const map = canvasToMap(canvas.x, canvas.y);
    
    console.log(`===== 坐标系统诊断 =====`);
    console.log(`设备像素比(DPR): ${dpr}`);
    console.log(`鼠标屏幕坐标: (${clientX}, ${clientY})`);
    console.log(`元素位置: left=${element.getBoundingClientRect().left}, top=${element.getBoundingClientRect().top}`);
    console.log(`画布坐标(含DPR): (${canvas.x.toFixed(2)}, ${canvas.y.toFixed(2)})`);
    console.log(`地图坐标: (${map.x.toFixed(2)}, ${map.y.toFixed(2)})`);
    console.log(`视图状态: scale=${scale.value.toFixed(2)}, offset=(${offsetX.value.toFixed(2)}, ${offsetY.value.toFixed(2)})`);
    console.log(`变换矩阵参数:`, getTransformParams());
    console.log(`========================`);
  }

  return {
    getDpr,
    screenToCanvas,
    canvasToMap,
    screenToMap,
    mapToCanvas,
    getTransformParams,
    getCurrentViewState,
    debugCoordinateSystem
  };
} 