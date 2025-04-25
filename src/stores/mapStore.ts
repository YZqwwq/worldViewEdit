import { defineStore } from 'pinia';
import type { WorldMapData, MapState } from '../types/map';

export const useMapStore = defineStore('map', {
  state: (): MapState => ({
    mapData: {
      // 元数据
      metadata: {
        version: '1.0.0',
        name: '',
        description: '',
        createdAt: Date.now(),
        lastModified: Date.now()
      },
      
      // 视图状态
      viewState: {
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        isDarkMode: false
      },
      
      // 编辑状态
      editState: {
        currentTool: 'select',
        selectedId: null,
        isEditing: false
      },
      
      // 核心数据
      // 同类型数据使用Map函数存储
      locations: new Map(),
      connections: new Map(),
      territories: new Map(),
      labels: new Map()
    },
    isLoading: false
  }),
  
  actions: {
    // 更新地图数据
    updateMapData(data: Partial<WorldMapData>) {
      this.mapData = { ...this.mapData, ...data };
    },

    // 更新视图状态
    updateViewState(state: Partial<WorldMapData['viewState']>) {
      this.mapData.viewState = { ...this.mapData.viewState, ...state };
    },

    // 更新编辑状态
    updateEditState(state: Partial<WorldMapData['editState']>) {
      this.mapData.editState = { ...this.mapData.editState, ...state };
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
      this.updateViewState({ isDarkMode: !this.mapData.viewState.isDarkMode });
    },

    // 设置当前工具
    setCurrentTool(tool: WorldMapData['editState']['currentTool']) {
      this.updateEditState({ currentTool: tool });
    },

    // 设置选中项
    setSelectedId(id: string | null) {
      this.updateEditState({ selectedId: id });
    },

    // 设置编辑状态
    setIsEditing(isEditing: boolean) {
      this.updateEditState({ isEditing });
    },

    // 添加位置
    addLocation(location: WorldMapData['locations'] extends Map<string, infer T> ? T : never) {
      this.mapData.locations.set(location.id, location);
    },

    // 添加连接
    addConnection(connection: WorldMapData['connections'] extends Map<string, infer T> ? T : never) {
      this.mapData.connections.set(connection.id, connection);
    },

    // 添加势力
    addTerritory(territory: WorldMapData['territories'] extends Map<string, infer T> ? T : never) {
      this.mapData.territories.set(territory.id, territory);
    },

    // 添加标签
    addLabel(label: WorldMapData['labels'] extends Map<string, infer T> ? T : never) {
      this.mapData.labels.set(label.id, label);
    }
  }
}); 