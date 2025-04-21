import { defineStore } from 'pinia';
import type { MapData } from '../types/map';

export interface MapState {
  mapData: MapData;
  position: {
    x: number;
    y: number;
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
      x: 0,
      y: 0
    },
    scale: 1
  }),
  
  actions: {
    saveMapData(data: MapData) {
      this.mapData = data;
    },
    
    setPosition(x: number, y: number) {
      this.position = { x, y };
    },
    
    setScale(scale: number) {
      this.scale = scale;
    }
  }
}); 