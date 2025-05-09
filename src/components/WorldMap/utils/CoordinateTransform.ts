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
   * 从屏幕坐标(clientX/Y)转换为Canvas坐标
   * @param clientX - 鼠标事件的clientX
   * @param clientY - 鼠标事件的clientY
   * @param element - 画布元素
   * @returns Canvas上的坐标
   */
  function screenToCanvas(
    clientX: number,
    clientY: number,
    element: HTMLElement
  ): Coordinate {
    const rect = element.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  /**
   * 从Canvas坐标转换为地图坐标
   * @param canvasX - Canvas（画布容器）上的X坐标
   * @param canvasY - Canvas（画布容器）上的Y坐标
   * @returns 地图上的坐标
   */
  function canvasToMap(canvasX: number, canvasY: number): Coordinate {
    return {
      x: (canvasX - offsetX.value) / scale.value,
      y: (canvasY - offsetY.value) / scale.value
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
    return canvasToMap(canvas.x, canvas.y);
  }

  /**
   * 从地图坐标转换为Canvas坐标
   * @param mapX - 地图上的X坐标
   * @param mapY - 地图上的Y坐标
   * @returns Canvas上的坐标
   */
  function mapToCanvas(mapX: number, mapY: number): Coordinate {
    return {
      x: mapX * scale.value + offsetX.value,
      y: mapY * scale.value + offsetY.value
    };
  }

  /**
   * 检查屏幕坐标是否在画布内
   * @param clientX - 鼠标事件的clientX
   * @param clientY - 鼠标事件的clientY
   * @param element - 画布元素
   * @returns 是否在画布内
   */
  function isPointInCanvas(
    clientX: number,
    clientY: number,
    element: HTMLElement
  ): boolean {
    const rect = element.getBoundingClientRect();
    const canvas = screenToCanvas(clientX, clientY, element);
    return (
      canvas.x >= 0 &&
      canvas.x <= rect.width &&
      canvas.y >= 0 &&
      canvas.y <= rect.height
    );
  }

  /**
   * 使用当前的视图状态创建ViewState对象
   * @returns 当前视图状态
   */
  function getCurrentViewState(): ViewState {
    return {
      offsetX: offsetX.value,
      offsetY: offsetY.value,
      scale: scale.value
    };
  }

  return {
    screenToCanvas,
    canvasToMap,
    screenToMap,
    mapToCanvas,
    isPointInCanvas,
    getCurrentViewState
  };
} 