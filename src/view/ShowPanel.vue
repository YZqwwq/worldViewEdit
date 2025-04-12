<script setup lang="ts">
import Sidebar from '@/components/faceline/LeftSidebar.vue';
import MainPanel from "@/components/faceline/MainPanel.vue";
</script>

<template>
  <div class="container">
    <div class="sidebar">
      <Sidebar />
    </div>
    <div class="main-content">
      <MainPanel />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.container {
  display: flex;
  height: 100vh;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.sidebar {
  width: var(--sidebar-width);
  height: 100vh;
  flex-shrink: 0;
}

.main-content {
  flex-grow: 1;
  flex-basis: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: calc(100% - var(--sidebar-width));
}
</style>
