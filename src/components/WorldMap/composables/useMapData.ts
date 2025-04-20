import { ref, computed } from 'vue';
import type { WorldData } from '../../../electron';

/**
 * 地图数据管理
 * 负责加载、保存和管理地图数据
 */
export function useMapData(props: { worldData: WorldData }, emit: any) {
  // 当前地图数据
  const mapData = ref({
    name: '',
    description: '',
    locations: [] as Array<{
      id: string;
      name: string;
      description: string;
      x: number;
      y: number;
      connections: string[];
    }>
  });
  
  // 编辑状态
  const currentLocationId = ref('');
  const locationNameInput = ref('');
  const locationDescInput = ref('');
  
  // 当前选中的位置
  const currentLocation = computed(() => {
    if (!currentLocationId.value) return null;
    return mapData.value.locations.find(loc => loc.id === currentLocationId.value) || null;
  });
  
  // 从世界数据加载地图
  function loadMapData() {
    if (props.worldData?.content?.worldmaps) {
      // 默认加载第一个地图
      const maps = Object.values(props.worldData.content.worldmaps);
      if (maps.length > 0) {
        const firstMap = maps[0] as { 
          name?: string, 
          description?: string, 
          locations?: Array<{
            id: string;
            name: string;
            description: string;
            x: number;
            y: number;
            connections: string[];
          }>
        };
        
        mapData.value = {
          name: firstMap.name || '新地图',
          description: firstMap.description || '',
          locations: firstMap.locations || []
        };
      } else {
        // 创建新地图
        mapData.value = {
          name: '新地图',
          description: '描述你的世界地图',
          locations: []
        };
      }
    }
  }
  
  // 保存位置信息
  function saveLocationDetails() {
    if (!currentLocationId.value) return;
    
    const location = mapData.value.locations.find(
      loc => loc.id === currentLocationId.value
    );
    
    if (location) {
      location.name = locationNameInput.value;
      location.description = locationDescInput.value;
    }
  }
  
  // 保存地图数据
  function saveMapData() {
    // 创建当前时间戳
    const now = new Date().toISOString();
    
    // 准备地图数据
    const mapId = 'map_' + Date.now();
    const mapContent = {
      id: mapId,
      name: mapData.value.name,
      description: mapData.value.description,
      locations: mapData.value.locations,
      updatedAt: now
    };
    
    // 准备要更新的完整世界观数据
    const worldmaps = props.worldData.content?.worldmaps || {};
    worldmaps[mapId] = mapContent;
    
    const updatedWorldData = {
      ...props.worldData,
      updatedAt: now,
      content: {
        ...props.worldData.content,
        worldmaps
      }
    };
    
    // 发送更新整个世界观数据的事件
    emit('updateWorldData', updatedWorldData);
    emit('save');
  }
  
  // 格式化经度显示（添加东经/西经）
  function formatLongitude(longitude: number): string {
    if (longitude === 0) return '0°';
    return longitude > 0 ? `${longitude}°E` : `${Math.abs(longitude)}°W`;
  }
  
  // 格式化纬度显示（添加北纬/南纬）
  function formatLatitude(latitude: number): string {
    if (latitude === 0) return '0°';
    return latitude > 0 ? `${latitude}°N` : `${Math.abs(latitude)}°S`;
  }
  
  return {
    mapData,
    currentLocationId,
    locationNameInput,
    locationDescInput,
    currentLocation,
    loadMapData,
    saveLocationDetails,
    saveMapData,
    formatLongitude,
    formatLatitude
  };
} 