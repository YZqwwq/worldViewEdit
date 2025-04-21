import { defineStore } from 'pinia';
import type { MapData } from '../types/map';

export interface MapState {
  mapData: MapData;
  position: {
    offsetX: number;
    offsetY: number;
  };
  scale: number;
}

export const useMapStore = defineStore('map', {
  state: (): MapState => ({
    mapData: {
      name: '新地图',
      description: '',
      locations: [],
      connections: []
    },
    position: {
      offsetX: 0,
      offsetY: 0
    },
    scale: 1
  }),
  
  actions: {
    saveMapData(data: MapData) {
      this.mapData = data;
    },
    
    setPosition(offsetX: number, offsetY: number) {
      this.position = { offsetX, offsetY };
    },
    
    setScale(scale: number) {
      this.scale = scale;
    }
  }
}); 