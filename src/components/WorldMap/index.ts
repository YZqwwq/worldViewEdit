/**
 * WorldMap 组件入口
 * 导出地图相关的所有模块
 */

// 直接导入所有组合式API
import { useMapCanvas } from './composables/useMapCanvas';
import { useMapInteractions } from './composables/useMapInteractions';
import { useMapData } from './composables/useMapData';

// 导入图层工厂函数
import { 
  createBackgroundLayer, 
  createMapLayer, 
  getMapRect 
} from './composables/useLayerFactory';

// 导入图层创建函数
import {
  createGridLayer,
  createConnectionLayer,
  createLocationLayer,
  createTerritoryLayer,
  createLabelLayer,
  createCoordinateLayer
} from './composables/useLayers';

// 导入常量
import { LAYER_IDS, LAYER_GROUPS, type LayerId } from './constants/layerIds';
import * as colors from './constants/colors';

// 导出所有组合式API
export {
  // 核心API
  useMapCanvas,
  useMapInteractions,
  useMapData,
  
  // 图层工厂函数
  createBackgroundLayer,
  createMapLayer,
  getMapRect,
  
  // 图层创建函数
  createGridLayer,
  createConnectionLayer,
  createLocationLayer,
  createTerritoryLayer,
  createLabelLayer,
  createCoordinateLayer,
  
  // 常量
  LAYER_IDS,
  LAYER_GROUPS,
  type LayerId,
  colors
};

// 导出类型定义
export type * from '../../types/map'; 