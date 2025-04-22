/**
 * WorldMap 组件入口
 * 导出地图相关的所有模块
 */

// 导出图层管理模块
export { useLayerManager } from './composables/useLayerManager';
export { 
  createBackgroundLayer, 
  createMapLayer, 
  getMapRect 
} from './composables/useLayerFactory';
export {
  createGridLayer,
  createConnectionLayer,
  createLocationLayer,
  createTerritoryLayer,
  createLabelLayer,
  createCoordinateLayer
} from './composables/useLayers';

// 导出地图画布管理模块
export { 
  useMapCanvas,
  LAYER_IDS
} from './composables/useMapCanvas';

// 导出地图状态管理模块
export { useMapState } from './composables/useMapState';

// 导出地图数据管理模块
export { useMapData } from './composables/useMapData';

// 导出地图工具模块
export { useMapTools } from './composables/useMapTools';

// 导出地图交互模块
export { useMapInteractions } from './composables/useMapInteractions';

// 导出类型定义
export type * from './types/map';

// 导出常量
export * from './constants/colors'; 