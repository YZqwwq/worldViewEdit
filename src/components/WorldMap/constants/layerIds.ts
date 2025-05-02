// 定义地图图层ID常量
export const LAYER_IDS = {
  BASE: 'base',
  GRID: 'grid',
  MAP: 'map',
  LOCATION: 'location',
  TERRITORY: 'territory',
  CONNECTION: 'connection',
  COUNTRY: 'country',
  PROVINCE: 'province',
  CITY: 'city',
  DISTRICT: 'district',
  CUSTOM: 'custom',
  MARKER: 'marker',
  LABEL: 'label',
  COORDINATE: 'coordinate',
  HEATMAP: 'heatmap',
  ROUTE: 'route',
  POLYGON: 'polygon',
  TEXT: 'text'
} as const;

// 图层类型
export type LayerId = typeof LAYER_IDS[keyof typeof LAYER_IDS];

// 图层分组
export const LAYER_GROUPS = {
  ADMINISTRATIVE: [LAYER_IDS.COUNTRY, LAYER_IDS.PROVINCE, LAYER_IDS.CITY, LAYER_IDS.DISTRICT],
  VISUALIZATION: [LAYER_IDS.MARKER, LAYER_IDS.TERRITORY, LAYER_IDS.CONNECTION, LAYER_IDS.LABEL, LAYER_IDS.HEATMAP, LAYER_IDS.ROUTE, LAYER_IDS.POLYGON],
  OVERLAY: [LAYER_IDS.TEXT, LAYER_IDS.GRID, LAYER_IDS.COORDINATE, LAYER_IDS.CUSTOM]
} as const; 