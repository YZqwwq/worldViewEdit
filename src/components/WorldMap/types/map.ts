import type { LayerId } from '../constants/layerIds';

/**
 * 地图坐标类型
 */
export interface Coordinate {
  x: number;
  y: number;
}

/**
 * 地图区域类型
 */
export interface MapRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 地图数据类型
 */
export interface MapData {
  id: string;
  name: string;
  type: string;
  data: any;
}

/**
 * 图层配置类型
 */
export interface LayerConfig {
  id: LayerId;
  visible: boolean;
  interactive: boolean;
  opacity: number;
  zIndex: number;
  data?: any;
}

/**
 * 图层类型
 */
export interface Layer {
  id: LayerId;
  name: string;
  config: LayerConfig;
  draw: (ctx: CanvasRenderingContext2D) => void;
  clear: () => void;
  update: (data: any) => void;
  isPointInPath?: (x: number, y: number) => boolean;
}

/**
 * 地图状态类型
 */
export interface MapState {
  zoom: number;
  pan: Coordinate;
  rotation: number;
  width: number;
  height: number;
  selectedLayerId: LayerId | null;
  hoveredLayerId: LayerId | null;
}

/**
 * 地图交互事件类型
 */
export interface MapEvent {
  type: 'click' | 'hover' | 'drag' | 'zoom' | 'pan';
  position: Coordinate;
  target?: any;
}

/**
 * 地图工具类型
 */
export type MapTool = 'pan' | 'zoom' | 'select' | 'draw' | 'edit' | 'measure' | 'none'; 