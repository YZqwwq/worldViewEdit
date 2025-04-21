import { ref, computed, watch } from 'vue';
import type { Store } from 'pinia';
import type { MapState } from '../../../stores/mapStore';
import type { WorldData } from '../../../electron';
import type { MapData, MapLocation } from '../../../types/map';

/**
 * 地图数据管理
 * 负责处理地图数据的加载、保存和更新
 */
export function useMapData(mapStore: Store<'map', MapState>, worldData?: WorldData) {
  // 地图数据
  const mapData = ref<MapData>(mapStore.mapData);
  
  // 监听mapStore中的数据变化
  watch(() => mapStore.mapData, (newData) => {
    mapData.value = newData;
  }, { deep: true });
  
  // 保存地图数据
  function saveMapData() {
    mapStore.$patch({ mapData: mapData.value });
  }
  
  // 加载地图数据
  function loadMapData(data: MapData) {
    mapData.value = data;
    mapStore.$patch({ mapData: data });
  }
  
  // 更新地图数据
  function updateMapData(newData: MapData) {
    mapData.value = newData;
    mapStore.$patch({ mapData: newData });
  }
  
  // 编辑状态
  const currentLocationId = ref<string>('');
  const locationNameInput = ref('');
  const locationDescInput = ref('');
  
  // 当前选中的位置
  const currentLocation = computed(() => {
    if (!worldData?.content?.world_map?.locations) return null;
    return worldData.content.world_map.locations.find((loc: MapLocation) => loc.id === currentLocationId.value);
  });
  
  // 保存位置信息
  function saveLocationDetails() {
    if (!currentLocationId.value) return;
    
    const location = mapData.value.locations.find(
      (loc) => loc.id === currentLocationId.value
    );
    
    if (location) {
      location.name = locationNameInput.value;
      location.description = locationDescInput.value;
    }
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
    saveMapData,
    loadMapData,
    updateMapData,
    saveLocationDetails,
    formatLongitude,
    formatLatitude
  };
} 