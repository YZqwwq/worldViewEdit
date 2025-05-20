<template>
  <!-- No changes to template section -->
</template>

<script setup>
import { ref } from 'vue';
import { useMapInteractions } from '../../composables/useMapInteractions';

// ... existing code ...

// 使用交互管理器
const {
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleKeyDown,
  handleWheel,
  hoveredLocationId,
  drawActiveConnection
} = useMapInteractions(
  canvasContainerRef,
  isDragging,
  dragStartX,
  dragStartY,
  isDrawingConnection,
  connectionStartId,
  currentLocationId,
  locationNameInput,
  locationDescInput,
  isEditing,
  mouseX,
  mouseY,
  drawMap,
  layers,
  // 传入绘图工具函数引用
  layerTools.startDrawing,
  layerTools.continueDrawing,
  layerTools.stopDrawing,
  // 新增：传入整个layerTools对象，使其能访问undo和redo方法
  layerTools
);

// ... existing code ...
</script>

<style>
  /* No changes to style section */
</style> 