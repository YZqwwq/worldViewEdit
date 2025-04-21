import { ref, computed } from 'vue';
import type { WorldData } from '../../../electron';

interface MapLocation {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
  connections: string[];
}

interface MapConnection {
  id: string;
  from: string;
  to: string;
  description?: string;
}

interface MapData {
  name: string;
  description: string;
  locations: MapLocation[];
  connections: MapConnection[];
}

/**
 * 地图数据管理
 * 负责加载、保存和管理地图数据
 */
export function useMapData(props: { worldData?: WorldData }, emit: any) {
  // 当前地图数据
  const mapData = ref<MapData>({
    name: '新地图',
    description: '',
    locations: [],
    connections: []
  });
  
  // 编辑状态
  const currentLocationId = ref<string>('');
  const locationNameInput = ref('');
  const locationDescInput = ref('');
  
  // 当前选中的位置
  const currentLocation = computed(() => {
    if (!props.worldData?.content?.world_map?.locations) return null;
    return props.worldData.content.world_map.locations.find((loc: MapLocation) => loc.id === currentLocationId.value);
  });
  
  // 从世界数据加载地图
  function loadMapData() {
    if (!props.worldData?.content?.world_map) {
      console.warn('worldData or its content is undefined');
      return;
    }
    
    mapData.value = {
      name: props.worldData.content.world_map.name || '新地图',
      description: props.worldData.content.world_map.description || '',
      locations: props.worldData.content.world_map.locations || [],
      connections: props.worldData.content.world_map.connections || []
    };
  }
  
  // 保存位置信息
  function saveLocationDetails() {
    if (!currentLocationId.value) return;
    
    const location = mapData.value.locations.find(
      (loc: MapLocation) => loc.id === currentLocationId.value
    );
    
    if (location) {
      location.name = locationNameInput.value;
      location.description = locationDescInput.value;
    }
  }
  
  // 保存地图数据
  function saveMapData() {
    if (!props.worldData) {
      console.warn('worldData is undefined');
      return;
    }
    
    const now = new Date().toISOString();
    const mapId = 'map_' + Date.now();
    const mapContent = {
      id: mapId,
      name: mapData.value.name,
      description: mapData.value.description,
      locations: mapData.value.locations,
      updatedAt: now
    };
    
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