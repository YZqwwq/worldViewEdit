import { defineStore } from 'pinia';
import { MapCache } from './MapCache';

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
    loadImage(layerId: string, img: HTMLImageElement) {
      return this.getLayer(layerId).loadImage(img);
    },
    drawPen(layerId: string, points: { x: number; y: number }[], color: string, lineWidth: number) {
      this.getLayer(layerId).drawPen(points, color, lineWidth);
    },
    erase(layerId: string, points: { x: number; y: number }[], lineWidth: number) {
      this.getLayer(layerId).erase(points, lineWidth);
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
    renderTo(layerId: string, ctx: CanvasRenderingContext2D) {
      this.getLayer(layerId).renderTo(ctx);
    },
    toDataURL(layerId: string, type?: string) {
      return this.getLayer(layerId).toDataURL(type);
    },
  },
}); 