<script setup lang="ts">
import { defineProps, defineEmits, ref, watch, onMounted, onBeforeUnmount } from 'vue';

// 定义接收的属性
const props = defineProps<{
  activeItem: string,
  worldTitles?: Array<{title: string, level: number, position: number}>
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'update:activeItem', value: string): void
  (e: 'back'): void
  (e: 'selectTitle', title: string): void
}>();

// 展开状态
const isWorldExpanded = ref(false);

// 自动展开侧边栏
watch(() => props.activeItem, (newValue) => {

});

// 监听主题变化事件
const componentKey = ref(0);
function refreshComponent() {
  componentKey.value += 1;
}

function handleThemeChange(event: CustomEvent) {
  console.log('侧边栏组件检测到主题变化:', event.detail.theme);
  // 在下一个微任务中执行DOM更新，确保CSS变量已应用
  setTimeout(() => {
    refreshComponent();
  }, 0);
}

// 监听事件
onMounted(() => {
  document.addEventListener('theme-changed', handleThemeChange as EventListener);
});

onBeforeUnmount(() => {
  document.removeEventListener('theme-changed', handleThemeChange as EventListener);
});


// 处理世界观点击
function handleWorldClick() {
  // 如果当前不是世界观项，则先设置为世界观
  if (props.activeItem !== '世界观') {
    setActiveItem('世界观');
  }
  
  // 切换展开/折叠状态（无论是否为活动项）
  isWorldExpanded.value = !isWorldExpanded.value;
}

// 切换选中项
function setActiveItem(item: string) {
  emit('update:activeItem', item);
}

// 选择标题
function selectTitle(title: string) {
  emit('selectTitle', title);
  emit('update:activeItem', '世界观:' + title);
}

// 返回主页面
function goBack() {
  emit('back');
}

// 计算缩进空间
function getTitleIndentStyle(level: number) {
  const paddingLeft = (level - 1) * 12 + 20;
  return { paddingLeft: `${paddingLeft}px` };
}

// 获取标题显示文本（截断过长标题）
function getTitleDisplayText(title: string, level: number) {
  const maxLength = 28 - level * 2; // 随着级别增加减少最大长度
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + '...';
}
</script>

<template>
  <div class="editor-sidebar" :key="componentKey">
    <div class="editor-title">
      Fantya world editor
    </div>
    
    <!-- 导航菜单项 -->
    <div class="nav-menu">
      <!-- 世界观项（可展开） -->
      <div class="nav-item-container">
        <div 
          class="nav-item with-arrow" 
          :class="{ 
            active: activeItem === '世界观',
            expanded: isWorldExpanded
          }"
          @click="handleWorldClick"
        >
          <span>世界观</span>
          <span class="arrow">{{ isWorldExpanded ? '▼' : '▶' }}</span>
        </div>
        
        <!-- 世界观子菜单 - 标题列表 -->
        <div class="sub-menu" v-show="isWorldExpanded">
          <div 
            v-for="(title, index) in worldTitles || []" 
            :key="index"
            class="sub-menu-item"
            :class="{ 
              active: activeItem === '世界观:' + title.title,
              'level-1': title.level === 1,
              'level-2': title.level === 2,
              'level-3': title.level === 3,
              'level-4': title.level === 4,
              'level-5': title.level === 5
            }"
            :style="getTitleIndentStyle(title.level)"
            @click.stop="selectTitle(title.title)"
          >
            <span class="title-text">{{ getTitleDisplayText(title.title, title.level) }}</span>
          </div>
          <div v-if="!worldTitles || worldTitles.length === 0" class="sub-menu-empty">
            暂无标题
          </div>
        </div>
      </div>
      
      <div 
        class="nav-item" 
        :class="{ active: activeItem === '地图' }"
        @click="setActiveItem('地图')"
      >
        地图
      </div>
      <div 
        class="nav-item" 
        :class="{ active: activeItem === '人物' }"
        @click="setActiveItem('人物')"
      >
        人物
      </div>
    </div>
    
    <!-- 返回按钮 -->
    <div class="back-button-container">
      <button class="back-button" @click="goBack">返回</button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.editor-sidebar {
  width: 220px;
  height: 100vh;
  background-color: var(--sidebar-bg);
  color: var(--sidebar-text);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow-y: auto;
  position: sticky;
  left: 0;
  top: 0;
  z-index: 100;
  box-shadow: var(--box-shadow);
  border-right: 1px solid var(--border-color);
  transition: background-color 0.3s, color 0.3s, border-color 0.3s;
}

.editor-title {
  padding: 20px 10px;
  font-size: 16px;
  font-weight: bold;
  border-bottom: 1px solid var(--border-color);
  text-align: center;
  color: var(--text-primary);
}

.nav-menu {
  display: flex;
  flex-direction: column;
  margin-top: 10px;
}

.nav-item-container {
  display: flex;
  flex-direction: column;
}

.nav-item {
  padding: 15px 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color-light);
  text-align: center;
  transition: background-color 0.3s, color 0.3s;
  
  &:hover {
    background-color: var(--sidebar-hover-bg);
  }
  
  &.active {
    background-color: var(--sidebar-active-bg);
    color: var(--sidebar-active-text);
    font-weight: bold;
  }
  
  &.with-arrow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .arrow {
      font-size: 12px;
      transition: transform 0.3s;
      color: var(--accent-primary);
    }
    
    &.expanded .arrow {
      transform: rotate(0deg);
    }
  }
}

.sub-menu {
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  max-height: 60vh;
  overflow-y: auto;
  transition: background-color 0.3s, border-color 0.3s;
}

.sub-menu-item {
  padding: 8px 10px;
  font-size: 13px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color-light);
  display: flex;
  align-items: center;
  transition: background-color 0.3s, color 0.3s;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background-color: var(--sidebar-hover-bg);
  }
  
  &.active {
    background-color: var(--sidebar-active-bg);
    color: var(--sidebar-active-text);
    font-weight: bold;
  }
  
  &.level-1 {
    font-weight: bold;
    font-size: 14px;
  }
  
  &.level-2 {
    font-weight: normal;
    font-size: 13px;
  }
  
  &.level-3, &.level-4, &.level-5 {
    font-weight: normal;
    font-size: 12px;
    color: var(--text-secondary);
  }
  
  .title-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.sub-menu-empty {
  padding: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
  font-style: italic;
}

.back-button-container {
  margin-top: auto;
  padding: 20px 0;
  display: flex;
  justify-content: center;
}

.back-button {
  padding: 8px 20px;
  background-color: var(--error);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
  font-size: 14px;
  
  &:hover {
    background-color: var(--error-dark);
  }
}
</style> 