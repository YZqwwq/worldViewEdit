<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { EditorView } from 'prosemirror-view';
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
}>();

// 创建DOM引用
const editorRef = ref<HTMLDivElement | null>(null);
let editorView: EditorView | null = null;

// 初始化编辑器
onMounted(() => {
  if (!editorRef.value) return;

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
    editable: true
  });

  // 添加placeholder效果
  if (props.placeholder && props.modelValue === '') {
    addPlaceholder();
  }
});

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

// 组件卸载时销毁编辑器
onBeforeUnmount(() => {
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
  </div>
</template>

<style lang="scss">
.prosemirror-editor-container {
  width: 100%;
  
  .prosemirror-editor {
    width: 100%;
    min-height: 500px;
    padding: 15px;
    border: 1px solid var(--border-color);
    border-radius: 0 0 4px 4px;
    font-size: 16px;
    line-height: 1.6;
    font-family: 'Courier New', Courier, monospace;
    background-color: var(--editor-bg);
    color: var(--editor-text);
    outline: none;
    white-space: pre-wrap; /* 解决ProseMirror的CSS white-space警告 */
    
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
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.3em;
    }
    h2 { 
      font-size: 1.5em; 
      border-bottom: 1px solid var(--border-color);
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
}

// 添加自定义样式，确保移除所有边框
.custom-prosemirror-editor {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
}
</style> 