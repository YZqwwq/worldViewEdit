<script setup lang="ts">

</script>

<template>
  <div class="sidebar">
    <div class="content">
      <div class="headline">
        welcome to
      </div>
    </div>
    
    <!-- 设置部分 -->
    <div class="settings-section">
      <div class="divider"></div>
      <div class="settings-content">
        <span>设置</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.sidebar {
  width: var(--sidebar-width);
  background-color: #ebebeb;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.content {
  flex-grow: 1;
  text-align: center;
}

.headline {
  font-size: 18px;
  position: relative;
  top: 25px;
}

.divider {
  height: 1px;
  background-color: #000;
  margin: 0;
}

.settings-section {
  padding: 0 0px;
  
  .settings-content {
    padding: 10px 0;
    cursor: pointer;
    
    span {
      font-size: 16px;
    }
  }
}
</style>