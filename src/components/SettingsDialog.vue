<script setup lang="ts">
import { ref, defineEmits, onMounted, onBeforeUnmount, watch } from 'vue';
import themeManager from '../utils/themeManager';
import type { ThemeType } from '../utils/themeManager';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', settings: any): void;
}>();

const isVisible = ref(false);
const settings = ref({
  theme: 'light' as ThemeType,
  autosave: true,
  autosaveInterval: 5, // minutes
  fontSize: 14
});

// 加载设置
async function loadSettings() {
  try {
    if (window.electronAPI) {
      const savedSettings = await window.electronAPI.data.readFile('settings.json');
      if (savedSettings) {
        settings.value = { ...settings.value, ...savedSettings };
      }
    }
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

// 保存设置
async function saveSettings() {
  try {
    if (!window.electronAPI) {
      console.error('electronAPI不可用，无法保存设置');
      throw new Error('应用初始化失败: electronAPI不可用');
    }
    
    // 验证设置数据
    if (!settings.value || typeof settings.value !== 'object') {
      throw new Error('设置数据无效');
    }
    
    // 确保主题设置有效
    if (!['light', 'dark', 'system'].includes(settings.value.theme)) {
      settings.value.theme = 'system';
    }
    
    // 创建一个干净的、简单的设置对象，不包含任何Vue的响应式属性或方法
    const cleanSettings = {
      theme: settings.value.theme,
      autosave: !!settings.value.autosave,
      autosaveInterval: Number(settings.value.autosaveInterval) || 5,
      fontSize: Number(settings.value.fontSize) || 14
    };
    
    console.log('准备保存设置:', cleanSettings);
    
    // 保存到文件
    const filePath = await window.electronAPI.data.saveFile('settings.json', cleanSettings);
    console.log('设置已保存到:', filePath);
    emit('save', cleanSettings);
  } catch (error) {
    console.error('保存设置失败:', error);
    alert(`保存设置失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
  closeDialog();
}

// 关闭对话框
function closeDialog() {
  isVisible.value = false;
  emit('close');
}

// 打开对话框
function openDialog() {
  loadSettings();
  isVisible.value = true;
}

// 当主题设置改变时立即应用
watch(() => settings.value.theme, (newTheme) => {
  themeManager.setTheme(newTheme);
});

// 注册菜单事件监听
onMounted(() => {
  if (window.electronAPI && window.electronAPI.menu) {
    window.electronAPI.menu.onMenuAction((action: string) => {
      if (action === 'open-settings') {
        openDialog();
      }
    });
  }
});

// 清理菜单事件监听
onBeforeUnmount(() => {
  if (window.electronAPI && window.electronAPI.menu) {
    window.electronAPI.menu.removeMenuActionListener();
  }
});

// 暴露方法给父组件
defineExpose({
  openDialog
});
</script>

<template>
  <div class="settings-dialog-overlay" v-if="isVisible" @click.self="closeDialog">
    <div class="settings-dialog">
      <div class="settings-header">
        <h2>设置</h2>
        <button class="close-button" @click="closeDialog">×</button>
      </div>
      
      <div class="settings-content">
        <div class="settings-group">
          <h3>外观</h3>
          
          <div class="setting-item">
            <label>主题</label>
            <select v-model="settings.theme">
              <option value="light">浅色</option>
              <option value="dark">深色</option>
              <option value="system">跟随系统</option>
            </select>
          </div>
          
          <div class="setting-item">
            <label>字体大小</label>
            <input type="range" v-model.number="settings.fontSize" min="12" max="24" step="1">
            <span class="setting-value">{{ settings.fontSize }}px</span>
          </div>
        </div>
        
        <div class="settings-group">
          <h3>编辑器</h3>
          
          <div class="setting-item">
            <label>
              <input type="checkbox" v-model="settings.autosave">
              自动保存
            </label>
          </div>
          
          <div class="setting-item" v-if="settings.autosave">
            <label>自动保存间隔</label>
            <select v-model.number="settings.autosaveInterval">
              <option :value="1">1分钟</option>
              <option :value="5">5分钟</option>
              <option :value="10">10分钟</option>
              <option :value="30">30分钟</option>
            </select>
          </div>
        </div>
      </div>
      
      <div class="settings-footer">
        <button class="cancel-button" @click="closeDialog">取消</button>
        <button class="save-button" @click="saveSettings">保存</button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--dialog-overlay);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.settings-dialog {
  background-color: var(--dialog-bg);
  border-radius: 8px;
  box-shadow: var(--box-shadow);
  width: 500px;
  max-width: 90%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid var(--border-color);
  
  h2 {
    margin: 0;
    font-size: 18px;
    color: var(--text-primary);
  }
  
  .close-button {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0 5px;
    
    &:hover {
      color: var(--text-primary);
    }
  }
}

.settings-content {
  padding: 20px;
  overflow-y: auto;
  flex-grow: 1;
  background-color: var(--bg-primary);
}

.settings-group {
  margin-bottom: 25px;
  
  h3 {
    font-size: 16px;
    color: var(--text-primary);
    margin: 0 0 15px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color-light);
  }
}

.setting-item {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  
  label {
    flex: 1;
    color: var(--text-secondary);
  }
  
  select, input[type="range"] {
    width: 120px;
    padding: 5px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background-color: var(--bg-primary);
    color: var(--text-primary);
  }
  
  .setting-value {
    width: 45px;
    text-align: right;
    color: var(--text-secondary);
    font-size: 14px;
  }
}

.settings-footer {
  padding: 15px 20px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  background-color: var(--bg-secondary);
  
  button {
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    border: none;
    
    &.cancel-button {
      background-color: var(--button-secondary-bg);
      color: var(--button-secondary-text);
      
      &:hover {
        background-color: var(--bg-tertiary);
      }
    }
    
    &.save-button {
      background-color: var(--button-primary-bg);
      color: var(--button-primary-text);
      
      &:hover {
        background-color: var(--accent-secondary);
      }
    }
  }
}
</style> 