import { ref, computed, watch } from 'vue';
import type { WorldMapData } from '../../../types/map';
import { useMapStore } from '../../../stores/mapStore';
import { LAYER_IDS } from '../constants/layerIds';

/**
 * 地图数据管理
 * 负责处理地图数据的加载、保存和更新，以及图层状态管理
 */
export function useMapData() {
  const mapStore = useMapStore();
  
  // 1. 数据存储
  const data = {
    metadata: ref(mapStore.mapData.metadata),
    locations: ref(mapStore.mapData.locations),
    connections: ref(mapStore.mapData.connections),
    territories: ref(mapStore.mapData.territories),
    labels: ref(mapStore.mapData.labels),
    viewState: ref(mapStore.mapData.viewState),
    editState: ref(mapStore.mapData.editState)
  };
  
  // 监听 store 变化
  watch(() => mapStore.mapData, (newData) => {
    data.metadata.value = newData.metadata;
    data.locations.value = newData.locations;
    data.connections.value = newData.connections;
    data.territories.value = newData.territories;
    data.labels.value = newData.labels;
    data.viewState.value = newData.viewState;
    data.editState.value = newData.editState;
  }, { deep: true });
  
  // 2. 数据访问方法
  const dataAccess = {
    // 获取元数据
    getMetadata() {
      return data.metadata.value;
    },
    
    // 更新元数据
    updateMetadata(updates: Partial<WorldMapData['metadata']>) {
      const newMetadata = { ...data.metadata.value, ...updates };
      data.metadata.value = newMetadata;
      mapStore.updateMapData({ metadata: newMetadata });
    },
    
    // 获取地图名称
    getMapName() {
      return data.metadata.value.name;
    },
    
    // 更新地图名称
    updateMapName(name: string) {
      this.updateMetadata({ name });
    },
    
    // 获取地图描述
    getMapDescription() {
      return data.metadata.value.description;
    },
    
    // 更新地图描述
    updateMapDescription(description: string) {
      this.updateMetadata({ description });
    },
    
    // 获取版本号
    getVersion() {
      return data.metadata.value.version;
    },
    
    // 更新版本号
    updateVersion(version: string) {
      this.updateMetadata({ version });
    },
    
    // 获取创建时间
    getCreatedAt() {
      return data.metadata.value.createdAt;
    },
    
    // 获取最后修改时间
    getLastModified() {
      return data.metadata.value.lastModified;
    },
    
    // 更新最后修改时间
    updateLastModified() {
      this.updateMetadata({ lastModified: Date.now() });
    },
    
    // 获取所有位置
    getLocations() {
      if (!data.locations.value) return [];
      return Array.from(data.locations.value.values());
    },
    
    // 获取指定位置
    getLocation(id: string) {
      if (!data.locations.value) return undefined;
      return data.locations.value.get(id);
    },
    
    // 获取所有连接
    getConnections() {
      if (!data.connections.value) return [];
      return Array.from(data.connections.value.values());
    },
    
    // 获取指定连接
    getConnection(id: string) {
      if (!data.connections.value) return undefined;
      return data.connections.value.get(id);
    },
    
    // 获取与位置相关的连接
    getLocationConnections(locationId: string) {
      if (!data.connections.value) return [];
      return Array.from(data.connections.value.values())
        .filter(conn => conn.start === locationId || conn.end === locationId);
    },
    
    // 获取所有势力
    getTerritories() {
      if (!data.territories.value) return [];
      return Array.from(data.territories.value.values());
    },
    
    // 获取指定势力
    getTerritory(id: string) {
      if (!data.territories.value) return undefined;
      return data.territories.value.get(id);
    },
    
    // 获取所有标签
    getLabels() {
      if (!data.labels.value) return [];
      return Array.from(data.labels.value.values());
    },
    
    // 获取指定标签
    getLabel(id: string) {
      if (!data.labels.value) return undefined;
      return data.labels.value.get(id);
    },
    
    // 获取视图状态
    getViewState() {
      return data.viewState.value;
    },
    
    // 获取编辑状态
    getEditState() {
      return data.editState.value;
    }
  };
  
  // 3. 数据操作方法
  const dataOperations = {
    // 保存地图数据
    saveMapData() {
      return {
        metadata: data.metadata.value,
        locations: data.locations.value,
        connections: data.connections.value,
        territories: data.territories.value,
        labels: data.labels.value,
        viewState: data.viewState.value,
        editState: data.editState.value
      };
    },
    
    // 加载地图数据
    loadMapData(newData: Partial<WorldMapData>) {
      mapStore.updateMapData(newData);
    },
    
    // 更新地图数据
    updateMapData(updates: Partial<WorldMapData>) {
      mapStore.updateMapData(updates);
    },
    
    // 将地图数据导出为 JSON 格式
    exportToJSON() {
      // 将 Map 转换为数组
      const locationsArray = Array.from(data.locations.value.values());
      const connectionsArray = Array.from(data.connections.value.values());
      const territoriesArray = Array.from(data.territories.value.values());
      const labelsArray = Array.from(data.labels.value.values());
      
      return {
        version: data.metadata.value.version,
        name: data.metadata.value.name,
        description: data.metadata.value.description,
        createdAt: data.metadata.value.createdAt,
        lastModified: data.metadata.value.lastModified,
        
        viewState: {
          offsetX: data.viewState.value.offsetX,
          offsetY: data.viewState.value.offsetY,
          scale: data.viewState.value.scale,
          isDarkMode: data.viewState.value.isDarkMode
        },
        
        editState: {
          currentTool: data.editState.value.currentTool,
          selectedId: data.editState.value.selectedId,
          isEditing: data.editState.value.isEditing
        },
        
        locations: locationsArray,
        connections: connectionsArray,
        territories: territoriesArray,
        labels: labelsArray
      };
    },
    
    // 从 JSON 数据导入地图
    importFromJSON(jsonData: any) {
      try {
        // 创建新的地图数据对象
        const newMapData: Partial<WorldMapData> = {
          metadata: {
            version: jsonData.version || '1.0.0',
            name: jsonData.name || '',
            description: jsonData.description || '',
            createdAt: jsonData.createdAt || Date.now(),
            lastModified: jsonData.lastModified || Date.now()
          },
          
          viewState: jsonData.viewState || {
            offsetX: 0,
            offsetY: 0,
            scale: 1,
            isDarkMode: false
          },
          
          editState: jsonData.editState || {
            currentTool: 'draw',
            selectedId: null,
            isEditing: false
          }
        };
        
        // 转换数组到 Map
        if (jsonData.locations && Array.isArray(jsonData.locations)) {
          const locationsMap = new Map();
          jsonData.locations.forEach((location: any) => {
            if (location.id) {
              locationsMap.set(location.id, location);
            }
          });
          newMapData.locations = locationsMap;
        }
        
        if (jsonData.connections && Array.isArray(jsonData.connections)) {
          const connectionsMap = new Map();
          jsonData.connections.forEach((connection: any) => {
            if (connection.id) {
              connectionsMap.set(connection.id, connection);
            }
          });
          newMapData.connections = connectionsMap;
        }
        
        if (jsonData.territories && Array.isArray(jsonData.territories)) {
          const territoriesMap = new Map();
          jsonData.territories.forEach((territory: any) => {
            if (territory.id) {
              territoriesMap.set(territory.id, territory);
            }
          });
          newMapData.territories = territoriesMap;
        }
        
        if (jsonData.labels && Array.isArray(jsonData.labels)) {
          const labelsMap = new Map();
          jsonData.labels.forEach((label: any) => {
            if (label.id) {
              labelsMap.set(label.id, label);
            }
          });
          newMapData.labels = labelsMap;
        }
        
        // 加载新数据
        this.loadMapData(newMapData);
        return true;
      } catch (error) {
        console.error('导入 JSON 数据失败:', error);
        return false;
      }
    }
  };
  
  // 4. 编辑状态
  const currentLocationId = ref<string>('');
  const locationNameInput = ref('');
  const locationDescInput = ref('');
  
  // 当前选中的位置
  const currentLocation = computed(() => {
    if (!currentLocationId.value) return null;
    return data.locations.value.get(currentLocationId.value);
  });
  
  // 保存位置信息
  function saveLocationDetails() {
    if (!currentLocationId.value) return;
    
    const location = data.locations.value.get(currentLocationId.value);
    if (location) {
      location.name = locationNameInput.value;
      location.description = locationDescInput.value;
      data.locations.value.set(currentLocationId.value, location);
      mapStore.updateMapData({ locations: data.locations.value });
      // 更新最后修改时间
      dataAccess.updateLastModified();
    }
  }
  
  // 5. 从 useMapState 合并的功能 - 图层可见性
  const layerVisibility = ref<Record<string, boolean>>({
    [LAYER_IDS.BASE]: true,
    [LAYER_IDS.GRID]: true,
    [LAYER_IDS.TERRITORY]: true,
    [LAYER_IDS.CONNECTION]: true,
    [LAYER_IDS.MARKER]: true,
    [LAYER_IDS.LABEL]: true,
    [LAYER_IDS.COORDINATE]: true,
    [LAYER_IDS.HEATMAP]: false,
    [LAYER_IDS.ROUTE]: true,
    [LAYER_IDS.TEXT]: true,
    [LAYER_IDS.POLYGON]: true,
  });
  
  // 切换图层可见性
  function toggleLayerVisibility(layerId: string) {
    layerVisibility.value[layerId] = !layerVisibility.value[layerId];
  }
  
  // 获取图层可见性
  function getLayerVisibility(layerId: string): boolean {
    return layerVisibility.value[layerId] ?? false;
  }
  
  // 6. 从 useMapState 合并的功能 - 状态更新方法
  const stateUpdateMethods = {
    // 批量更新视图状态
    batchUpdateViewState(updates: Partial<WorldMapData['viewState']>) {
      mapStore.updateMapData({
        viewState: {
          ...data.viewState.value,
          ...updates
        }
      });
    },
    
    // 更新编辑状态
    updateEditState(updates: Partial<WorldMapData['editState']>) {
      mapStore.updateMapData({
        editState: {
          ...data.editState.value,
          ...updates
        }
      });
    },
    
    // 更新工具选择
    setCurrentTool(tool: WorldMapData['editState']['currentTool']) {
      this.updateEditState({ currentTool: tool });
    },
    
    // 切换编辑模式
    toggleEditMode() {
      this.updateEditState({ isEditing: !data.editState.value.isEditing });
    },
    
    // 设置选中ID
    setSelectedId(id: string | null) {
      this.updateEditState({ selectedId: id });
    }
  };
  
  // 7. 从 useMapState 合并的功能 - 派生状态
  const derivedState = {
    // 视口相关
    viewportTiles: computed(() => {
      return {
        x: Math.floor(data.viewState.value.offsetX / 30),
        y: Math.floor(data.viewState.value.offsetY / 30)
      };
    }),
    
    // 图层相关
    layerBlendResult: computed(() => {
      return Object.entries(layerVisibility.value)
        .filter(([_, visible]) => visible)
        .map(([id]) => id);
    }),
    
    // 数据统计
    dataSummary: computed(() => {
      const locations = dataAccess.getLocations();
      const connections = dataAccess.getConnections();
      const territories = dataAccess.getTerritories();
      const labels = dataAccess.getLabels();
      
      return {
        locationsCount: locations.length,
        connectionsCount: connections.length,
        territoriesCount: territories.length,
        labelsCount: labels.length,
        totalCount: locations.length + 
                   connections.length + 
                   territories.length + 
                   labels.length
      };
    })
  };
  
  return {
    // 数据访问方法
    ...dataAccess,
    
    // 数据操作方法
    ...dataOperations,
    
    // 编辑状态
    currentLocationId,
    locationNameInput,
    locationDescInput,
    currentLocation,
    saveLocationDetails,
    
    // 从 useMapState 合并的功能
    layerVisibility,
    toggleLayerVisibility,
    getLayerVisibility,
    
    // 派生状态访问方法
    getViewportTiles: () => derivedState.viewportTiles.value,
    getLayerBlendResult: () => derivedState.layerBlendResult.value,
    getDataSummary: () => derivedState.dataSummary.value,
    
    // 状态更新方法
    ...stateUpdateMethods
  };
} 