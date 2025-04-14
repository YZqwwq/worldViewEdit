<script setup lang="ts">
import { inject } from 'vue';

// 尝试从App组件注入settingsDialog引用
const openSettings = inject('openSettings', () => {
  console.warn('openSettings方法未注入，使用替代方案');
  // 如果没有注入，尝试通过菜单API打开
  if (window.electronAPI && window.electronAPI.menu) {
    window.electronAPI.menu.onMenuAction((action: string) => {
      if (action === 'open-settings') {
        console.log('通过菜单API打开设置');
      }
    });
  }
});

// 点击设置时的处理函数
function handleSettingsClick() {
  console.log('点击设置选项');
  openSettings();
}
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
      <div class="settings-content" @click="handleSettingsClick">
        <span>设置</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.sidebar {
  width: var(--sidebar-width);
  background-color: var(--sidebar-bg);
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
  color: var(--text-primary);
}

.divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 0;
}

.settings-section {
  padding: 0 0px;
  
  .settings-content {
    padding: 10px 0;
    cursor: pointer;
    
    span {
      font-size: 16px;
      color: var(--text-primary);
    }
  }
}
</style>