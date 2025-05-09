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
    drawPen(layerId: string, points: { x: number; y: number }[], color: string, lineWidth: number) {
      const ctx = this.getContext(layerId);
      if (!ctx || points.length < 2) return;
      
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      if (points.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          
          ctx.quadraticCurveTo(
            points[i].x, 
            points[i].y,
            xc, yc
          );
        }
        
        const lastIndex = points.length - 1;
        ctx.lineTo(points[lastIndex].x, points[lastIndex].y);
      } else {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
      }
      
      ctx.stroke();
      ctx.restore();
      this.getLayer(layerId).saveHistory();
    },
    erase(layerId: string, points: { x: number; y: number }[], lineWidth: number) {
      const ctx = this.getContext(layerId);
      if (!ctx || points.length < 2) return;
      
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      
      ctx.restore();
      this.getLayer(layerId).saveHistory();
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
    renderTo(layerId: string, ctx: CanvasRenderingContext2D, viewState?: ViewState) {
      this.getLayer(layerId).renderTo(ctx, viewState);
    },
  },
}); 