<script setup lang="ts">
defineProps({
  size: {
    type: Number,
    default: 24
  },
  color: {
    type: String,
    default: '#FFC107' // 黄色文件夹
  }
});
</script>

<template>
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    :width="size" 
    :height="size" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    stroke-width="2" 
    stroke-linecap="round" 
    stroke-linejoin="round" 
    class="folder-icon"
    :style="{ color }"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
</template>

<style lang="scss" scoped>
.folder-icon {
  display: inline-block;
  fill: currentColor;
  stroke: #333;
}
</style> 