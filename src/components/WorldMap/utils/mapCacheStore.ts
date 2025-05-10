import { defineStore } from 'pinia';
import { MapCache, ViewState } from './MapCache';

export const useMapCacheStore = defineStore('mapCache', {
  state: () => ({
    layers: {} as Record<string, MapCache>,
  }),
  actions: {
    getLayer(layerId: string) {
      if (!this.layers[layerId]) {
        this.layers[layerId] = new MapCache();
      }
      return this.layers[layerId];
    },
    initializeLayer(layerId: string, width: number, height: number) {
      this.getLayer(layerId).initialize(width, height);
    },
    isLayerInitialized(layerId: string): boolean {
      return this.getLayer(layerId).isInitialized();
    },
    hasBaseImage(layerId: string): boolean {
      return this.getLayer(layerId).hasBaseImageLoaded();
    },
    getLayerDimensions(layerId: string): {width: number, height: number} {
      const layer = this.getLayer(layerId);
      return {
        width: layer.getWidth(),
        height: layer.getHeight()
      };
    },
    loadImage(layerId: string, img: HTMLImageElement) {
      return this.getLayer(layerId).loadImage(img);
    },
    toDataURL(layerId: string, type?: string) {
      return this.getLayer(layerId).toDataURL(type);
    },
    getContext(layerId: string): CanvasRenderingContext2D | null {
      return this.getLayer(layerId).getContext();
    },
    getBaseImageContext(layerId: string): CanvasRenderingContext2D | null {
      return this.getLayer(layerId).getBaseImageContext();
    },
    undo(layerId: string) {
      this.getLayer(layerId).undo();
    },
    redo(layerId: string) {
      this.getLayer(layerId).redo();
    },
    clear(layerId: string) {
      this.getLayer(layerId).clear();
    },
    resetToBaseImage(layerId: string) {
      this.getLayer(layerId).resetToBaseImage();
    },
  },
}); 