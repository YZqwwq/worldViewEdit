/**
 * ProseMirror模块索引
 * 导出所有相关模块，提供统一的访问点
 */

// 导入所需模块
import { createDefaultState } from './state';
import { createEditorView } from './view';
import { EditorView } from 'prosemirror-view';

// 导出schema相关
export * from './schema';

// 导出markdown处理相关
export * from './markdown';

// 导出状态相关
export * from './state';

// 导出视图相关
export * from './view';

// 方便使用的快捷方法
export function createEditor(
  container: HTMLElement, 
  content: string = '', 
  onChange?: (markdown: string) => void
) {
  // 创建编辑器状态
  const state = createDefaultState(content);
  
  // 创建并返回编辑器视图
  return createEditorView({
    container,
    state,
    onUpdate: onChange ? (markdown: string) => onChange(markdown) : undefined,
    attributes: {
      class: 'custom-prosemirror-editor',
      spellcheck: 'false'
    }
  });
}

// 销毁编辑器视图
export function destroyView(view: EditorView | null) {
  if (view) {
    view.destroy();
  }
} 