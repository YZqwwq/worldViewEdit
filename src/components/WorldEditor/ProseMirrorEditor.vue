<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { EditorView } from 'prosemirror-view';
import { EditorState, TextSelection } from 'prosemirror-state';
import { 
  createDefaultState, 
  createEditorView, 
  destroyView, 
  serializeToMarkdown 
} from '../ProseMirror';

const props = defineProps<{
  modelValue: string; // Markdown内容
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void; // v-model双向绑定支持
  (e: 'change'): void; // 内容变化事件
  (e: 'save'): void; // 保存事件
}>();

// 创建DOM引用
const editorRef = ref<HTMLDivElement | null>(null);
let editorView: EditorView | null = null;

// 快捷键提示控制
const showShortcutTip = ref(false);
const shortcutTipTimeout = ref<number | null>(null);
const isKeyDown = ref(false);

// 保存提示控制
const showSaveTip = ref(false);
const saveTipTimeout = ref<number | null>(null);

// 初始化编辑器
onMounted(() => {
  if (!editorRef.value) return;

  console.log('ProseMirrorEditor 组件挂载，传入的内容:', props.modelValue);
  
  // 创建编辑器状态
  const state = createDefaultState(props.modelValue || '');
  
  // 创建编辑器视图
  editorView = createEditorView({
    container: editorRef.value,
    state,
    onUpdate: (markdown: string) => {
      emit('update:modelValue', markdown);
      emit('change');
    },
    attributes: {
      class: 'custom-prosemirror-editor',
      spellcheck: 'false'  // 禁用拼写检查，避免产生波浪线边框
    },
    editable: true,
    // 添加键盘事件监听
    handleKeyDown: (view: EditorView, event: KeyboardEvent) => {
      // 检测到Ctrl键按下时显示快捷键提示
      if (event.ctrlKey && !event.altKey && !event.shiftKey) {
        if (!isKeyDown.value) {
          showKeyboardShortcutTip();
          isKeyDown.value = true;
        }
      }
      return false; // 返回false允许继续处理事件
    }
  });

  console.log('编辑器初始化完成');
  
  // 添加placeholder效果
  if (props.placeholder && props.modelValue === '') {
    addPlaceholder();
  }
  
  // 为编辑器容器添加键盘事件监听
  if (editorRef.value) {
    editorRef.value.addEventListener('keydown', handleKeyDown);
    editorRef.value.addEventListener('click', handleEditorClick);
    
    // 监听按键释放事件
    window.addEventListener('keyup', handleKeyUp);
  }
  
  // 监听保存事件
  document.addEventListener('prosemirror-save-requested', handleSaveRequest);
});

// 处理保存请求
function handleSaveRequest() {
  console.log('接收到保存请求');
  
  // 触发保存事件
  emit('save');
  
  // 显示保存提示
  showSaveTip.value = true;
  
  // 清除现有的超时
  if (saveTipTimeout.value !== null) {
    clearTimeout(saveTipTimeout.value);
  }
  
  // 设置2秒后隐藏提示
  saveTipTimeout.value = window.setTimeout(() => {
    showSaveTip.value = false;
    saveTipTimeout.value = null;
  }, 2000);
}

// 监听按键释放
function handleKeyUp(event: KeyboardEvent) {
  if (event.key === 'Control') {
    isKeyDown.value = false;
    
    // 键释放后1秒隐藏提示
    if (shortcutTipTimeout.value !== null) {
      clearTimeout(shortcutTipTimeout.value);
    }
    
    shortcutTipTimeout.value = window.setTimeout(() => {
      showShortcutTip.value = false;
      shortcutTipTimeout.value = null;
    }, 500);
  }
}

// 显示快捷键提示
function showKeyboardShortcutTip() {
  showShortcutTip.value = true;
  
  // 清除现有的超时
  if (shortcutTipTimeout.value !== null) {
    clearTimeout(shortcutTipTimeout.value);
    shortcutTipTimeout.value = null;
  }
}

// 处理编辑器点击事件
function handleEditorClick(event: MouseEvent) {
  if (!editorView) return;
  
  // 获取ProseMirror根DOM节点
  const editorDom = editorView.dom;
  
  // 检查点击是否在内容区域内
  if (editorDom && event.target === editorDom) {
    // 点击的是空白区域，将光标移动到文档末尾
    const { state } = editorView;
    const { tr } = state;
    const endPos = state.doc.content.size;
    
    // 创建一个光标在文档末尾的事务
    // 使用TextSelection创建文本选择
    const endSelection = TextSelection.create(state.doc, endPos);
    const transaction = tr.setSelection(endSelection);
    
    // 应用事务
    editorView.dispatch(transaction);
    
    // 聚焦编辑器
    editorView.focus();
  }
}

// 处理键盘事件
function handleKeyDown(event: KeyboardEvent) {
  if (!editorView) return;
  
  // 如果是退格键，检查当前光标位置是否在标题开始
  if (event.key === 'Backspace') {
    const { selection, schema } = editorView.state;
    const { $from, empty } = selection;
    
    // 选择为空且位于块的开始位置
    if (empty && $from.parentOffset === 0) {
      const node = $from.node();
      
      // 如果是标题节点，自定义处理已在state.ts中完成
      // 这里只是为了可能需要的其他处理
      if (node.type === schema.nodes.heading) {
        // 特定情况的额外处理可以放在这里
        console.log('检测到退格键在标题开始处');
      }
    }
  }
}

// 监听modelValue变化，更新编辑器内容
watch(() => props.modelValue, (newValue, oldValue) => {
  if (editorView && newValue !== oldValue) {
    // 只有当编辑器没有焦点时才更新内容，避免编辑时被覆盖
    if (!editorView.hasFocus()) {
      updateContent(newValue);
    }
  }
  
  // 处理placeholder
  if (props.placeholder) {
    if (newValue === '') {
      addPlaceholder();
    } else {
      removePlaceholder();
    }
  }
});

// 更新编辑器内容
function updateContent(markdown: string) {
  if (!editorView) return;
  
  console.log('更新编辑器内容');
  
  const state = createDefaultState(markdown);
  editorView.updateState(state);
}

// 添加placeholder
function addPlaceholder() {
  if (!editorRef.value) return;
  
  editorRef.value.setAttribute('data-placeholder', props.placeholder || '');
  editorRef.value.classList.add('has-placeholder');
}

// 移除placeholder
function removePlaceholder() {
  if (!editorRef.value) return;
  
  editorRef.value.classList.remove('has-placeholder');
}

// 组件卸载时销毁编辑器和事件监听
onBeforeUnmount(() => {
  if (editorRef.value) {
    editorRef.value.removeEventListener('keydown', handleKeyDown);
    editorRef.value.removeEventListener('click', handleEditorClick);
  }
  
  // 移除全局事件监听
  window.removeEventListener('keyup', handleKeyUp);
  document.removeEventListener('prosemirror-save-requested', handleSaveRequest);
  
  // 清除快捷键提示定时器
  if (shortcutTipTimeout.value !== null) {
    clearTimeout(shortcutTipTimeout.value);
  }
  
  // 清除保存提示定时器
  if (saveTipTimeout.value !== null) {
    clearTimeout(saveTipTimeout.value);
  }
  
  destroyView(editorView);
  editorView = null;
});

// 暴露方法给父组件
defineExpose({
  focus() {
    editorView?.focus();
  },
  getContent() {
    if (!editorView) return '';
    return serializeToMarkdown(editorView.state.doc);
  }
});
</script>

<template>
  <div class="prosemirror-editor-container">
    <div ref="editorRef" class="prosemirror-editor"></div>
    
    <!-- 快捷键提示 -->
    <transition name="fade">
      <div class="shortcut-tip" v-if="showShortcutTip">
        <div class="tip-header">快捷键:</div>
        <div class="tip-content">
          <div><kbd>Ctrl+数字键</kbd>设置标题级别</div>
          <div><kbd>Ctrl+S</kbd>保存内容</div>
        </div>
      </div>
    </transition>
    
    <!-- 保存提示 -->
    <transition name="fade">
      <div class="save-tip" v-if="showSaveTip">
        <div class="save-icon">✓</div>
        <div class="save-message">已保存</div>
      </div>
    </transition>
  </div>
</template>

<style lang="scss">
.prosemirror-editor-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  
  .prosemirror-editor {
    width: 100%;
    min-height: 500px;
    height: 100%;
    flex: 1;
    padding: 30px 50px; /* 增加内边距，左右更宽松 */
    border: 1px solid var(--border-color);
    border-radius: 0 0 4px 4px;
    font-size: 16px;
    line-height: 1.6;
    font-family: 'Courier New', Courier, monospace;
    background-color: var(--editor-bg);
    color: var(--editor-text);
    outline: none;
    white-space: pre-wrap; /* 解决ProseMirror的CSS white-space警告 */
    overflow-y: auto; /* 添加垂直滚动条 */
    position: relative; /* 确保相对定位，使绝对定位的子元素能够正确定位 */
    
    /* 确保编辑器填充整个容器空间 */
    .ProseMirror {
      height: 100%;
      min-height: 100%;
      max-width: 920px; /* 限制内容宽度，提高可读性 */
      margin: 0 auto; /* 居中显示内容 */
    }
    
    &:focus {
      border-color: var(--accent-primary);
    }
    
    &.has-placeholder {
      position: relative;
      
      &:empty:before {
        content: attr(data-placeholder);
        position: absolute;
        color: var(--text-tertiary);
        opacity: 0.6;
        pointer-events: none;
      }
    }
    
    // 移除ProseMirror节点选择时的边框
    .ProseMirror-selectednode {
      outline: none;
    }
    
    // 移除编辑器获取焦点时的默认边框
    &:focus-visible {
      outline: none;
    }
    
    // 移除内部元素选中时的边框
    *::selection {
      background-color: var(--selection-bg, rgba(0, 122, 255, 0.2));
      color: inherit;
    }
    
    // 移除ProseMirror光标周围的边框
    .ProseMirror-gapcursor {
      display: none;
      pointer-events: none;
    }
    
    // 移除其他可能出现的边框
    *:focus, *:focus-visible {
      outline: none;
    }
    
    // ProseMirror内容样式
    h1, h2, h3, h4, h5, h6 {
      font-weight: bold;
      margin: 1em 0 0.5em;
      color: var(--heading-color, var(--text-primary));
      line-height: 1.3;
      font-family: 'Arial', sans-serif;
    }
    
    h1 { 
      font-size: 1.8em; 
      /* 移除边框和下划线 */
      /* border-bottom: 1px solid var(--border-color); */
      padding-bottom: 0.3em;
    }
    h2 { 
      font-size: 1.5em; 
      /* 移除边框和下划线 */
      /* border-bottom: 1px solid var(--border-color); */
      padding-bottom: 0.2em;
    }
    h3 { font-size: 1.3em; }
    h4 { font-size: 1.2em; }
    h5 { font-size: 1.1em; }
    h6 { font-size: 1em; }
    
    p { 
      margin: 0.5em 0; 
    }
    
    ul, ol {
      margin: 0.5em 0;
      padding-left: 2em;
    }
    
    li {
      margin: 0.3em 0;
    }
    
    a {
      color: var(--accent-primary);
      text-decoration: underline;
    }
    
    blockquote {
      border-left: 3px solid var(--accent-secondary);
      margin: 1em 0;
      padding: 0.5em 1em;
      color: var(--text-secondary);
      background-color: var(--bg-secondary, rgba(0,0,0,0.03));
    }
    
    code {
      font-family: 'Courier New', Courier, monospace;
      background: var(--bg-tertiary);
      padding: 0.1em 0.3em;
      border-radius: 3px;
      font-size: 0.9em;
    }
    
    pre {
      background: var(--bg-tertiary);
      padding: 1em;
      border-radius: 4px;
      overflow-x: auto;
      margin: 1em 0;
      
      code {
        background: none;
        padding: 0;
        border-radius: 0;
        display: block;
      }
    }
    
    strong {
      font-weight: bold;
      color: var(--text-bold, var(--text-primary));
    }
    
    em {
      font-style: italic;
    }
    
    del, s, strike {
      text-decoration: line-through;
      color: var(--text-secondary);
    }
    
    hr {
      border: none;
      border-top: 1px solid var(--border-color);
      margin: 1.5em 0;
    }
    
    // 确保嵌套列表正确显示
    ul ul, ol ol, ul ol, ol ul {
      margin: 0.2em 0;
    }
  }
  
  // 快捷键提示样式
  .shortcut-tip {
    position: absolute;
    bottom: 20px;
    right: 20px;
    background-color: var(--bg-secondary, rgba(245, 245, 245, 0.95));
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 10;
    font-size: 0.9rem;
    max-width: 300px;
    transition: opacity 0.3s ease, transform 0.3s ease;
    
    .tip-header {
      font-weight: bold;
      margin-bottom: 5px;
      color: var(--text-primary);
    }
    
    .tip-content {
      color: var(--text-secondary);
      
      div {
        margin: 5px 0;
      }
      
      kbd {
        display: inline-block;
        padding: 2px 4px;
        font-size: 0.8rem;
        font-family: monospace;
        color: var(--text-primary);
        background-color: var(--bg-tertiary, #f7f7f7);
        border: 1px solid #ccc;
        border-radius: 3px;
        box-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
        margin: 0 2px;
      }
    }
  }
  
  // 保存提示样式
  .save-tip {
    position: absolute;
    top: 20px;
    right: 20px;
    background-color: rgba(46, 204, 113, 0.9);
    color: white;
    border-radius: 6px;
    padding: 10px 15px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 10;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    
    .save-icon {
      font-size: 1.2rem;
      margin-right: 8px;
    }
    
    .save-message {
      font-weight: bold;
    }
  }
  
  // 淡入淡出动画
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s, transform 0.3s;
  }
  
  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
    transform: translateY(10px);
  }
}

// 添加自定义样式，确保移除所有边框
.custom-prosemirror-editor {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
}
</style> 