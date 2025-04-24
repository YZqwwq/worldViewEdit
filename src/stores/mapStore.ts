import { defineStore } from 'pinia';
import type { 
  WorldMapData, 
  TerritoryMapData, 
  LocationMapData, 
  LabelMapData,
  ViewState,
  EditState,
  MapState
} from '../types/map';

export const useMapStore = defineStore('map', {
  state: (): MapState => ({
    // 地图数据 
    mapData: {
      metadata: {
        version: '1.0.0',
        name: '新地图',
        description: '',
        createdAt: Date.now(),
        lastModified: Date.now()
      },
      gridBlocks: new Map(),
      statistics: {
        highestPoint: 0,
        lowestPoint: 0,
        averageElevation: 0,
        terrainDistribution: {}
      }
    },
    // 势力数据
    territoryData: {
      metadata: {
        version: '1.0.0',
        name: '势力数据',
        description: '',
        createdAt: Date.now(),
        lastModified: Date.now()
      },
      territories: new Map(),
      hexGrid: {
        cells: new Map(),
        spatialIndex: {
          byTypeAndLevel: {},
          conflictZones: []
        }
      }
    },
    // 位置数据
    locationData: {
      metadata: {
        version: '1.0.0',
        name: '位置数据',
        description: '',
        createdAt: Date.now(),
        lastModified: Date.now()
      },
      locations: new Map(),
      connections: new Map(),
      spatialIndex: {
        byType: {},
        byImportance: {},
        connectionsByLocation: new Map()
      }
    },
    // 标签数据
    labelData: {
      metadata: {
        version: '1.0.0',
        name: '标签数据',
        description: '',
        createdAt: Date.now(),
        lastModified: Date.now()
      },
      labels: new Map(),
      spatialIndex: {
        byType: {},
        byPosition: new Map()
      }
    },

    viewState: {
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      isDarkMode: false
    },

    // 编辑状态
    editState: {
      currentTool: 'draw',
      selectedId: null,
      isEditing: false
    },

    cache: null,
    isLoading: false
  }),
  
  actions: {
    // 更新地图数据
    updateMapData(data: Partial<WorldMapData>) {
      this.mapData = { ...this.mapData, ...data };
    },

    // 更新势力数据
    updateTerritoryData(data: Partial<TerritoryMapData>) {
      this.territoryData = { ...this.territoryData, ...data };
    },

    // 更新位置数据
    updateLocationData(data: Partial<LocationMapData>) {
      this.locationData = { ...this.locationData, ...data };
    },

    // 更新标签数据
    updateLabelData(data: Partial<LabelMapData>) {
      this.labelData = { ...this.labelData, ...data };
    },

    // 更新视图状态
    updateViewState(state: Partial<ViewState>) {
      this.viewState = { ...this.viewState, ...state };
    },

    // 更新编辑状态
    updateEditState(state: Partial<EditState>) {
      this.editState = { ...this.editState, ...state };
    },

    // 设置位置
    setPosition(offsetX: number, offsetY: number) {
      this.updateViewState({ offsetX, offsetY });
    },

    // 设置缩放
    setScale(scale: number) {
      this.updateViewState({ scale });
    },

    // 切换暗色模式
    toggleDarkMode() {
      this.updateViewState({ isDarkMode: !this.viewState.isDarkMode });
    },

    // 设置当前工具
    setCurrentTool(tool: EditState['currentTool']) {
      this.updateEditState({ currentTool: tool });
    },

    // 设置选中项
    setSelectedId(id: string | null) {
      this.updateEditState({ selectedId: id });
    },

    // 设置编辑状态
    setIsEditing(isEditing: boolean) {
      this.updateEditState({ isEditing });
    }
  }
}); 