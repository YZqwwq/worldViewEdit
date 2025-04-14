<script setup lang="ts">
import { ref, onMounted, provide } from 'vue';
import SettingsDialog from './components/SettingsDialog.vue';
import themeManager from './utils/themeManager';
import './styles/themes.scss';

// 明确定义SettingsDialog的类型，包含openDialog方法
type SettingsDialogInstance = { openDialog: () => void };
const settingsDialog = ref<SettingsDialogInstance | null>(null);

// 初始化应用
onMounted(async () => {
  // 初始化主题
  await themeManager.initialize();
});

// 打开设置对话框函数
function openSettings() {
  console.log('App: 请求打开设置对话框');
  if (settingsDialog.value) {
    settingsDialog.value.openDialog();
  } else {
    console.error('设置对话框引用不可用');
  }
}

// 提供打开设置函数给子组件
provide('openSettings', openSettings);

// 处理设置保存事件
function handleSettingsSave(settings: any) {
  console.log('应用设置:', settings);
  
  // 应用主题设置
  if (settings.theme) {
    themeManager.setTheme(settings.theme);
  }
  
  // 应用其他设置...
}
</script>

<template>
  <div class="app-container">
    <router-view></router-view>
    
    <!-- 全局设置对话框 -->
    <SettingsDialog 
      ref="settingsDialog"
      @save="handleSettingsSave"
    />
  </div>
</template>

<style lang="scss">
/* 全局样式 */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  background-color: var(--bg-primary);
}

.app-container {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
</style>
