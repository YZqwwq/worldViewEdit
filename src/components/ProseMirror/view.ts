/**
 * ProseMirror视图配置
 * 用于创建和管理编辑器视图
 */

import { EditorView } from 'prosemirror-view';
import { EditorState, Transaction } from 'prosemirror-state';
import { serializeToMarkdown } from './markdown';

// 定义自定义视图接口
export interface CustomViewProps {
  container: HTMLElement;
  state: EditorState;
  onUpdate?: (markdown: string, state: EditorState) => void;
  attributes?: { [key: string]: string };
  editable?: boolean;
  handleKeyDown?: (view: EditorView, event: KeyboardEvent) => boolean;
}

// 创建编辑器视图
export function createEditorView(props: CustomViewProps): EditorView {
  const { container, state, onUpdate, attributes = {}, editable = true, handleKeyDown } = props;
  
  // 创建视图
  const view = new EditorView(container, {
    state,
    dispatchTransaction(transaction: Transaction) {
      // 更新编辑器状态
      const newState = view.state.apply(transaction);
      view.updateState(newState);
      
      // 如果文档更改了，调用回调
      if (transaction.docChanged && onUpdate) {
        const markdown = serializeToMarkdown(newState.doc);
        onUpdate(markdown, newState);
      }
    },
    // 添加自定义属性
    attributes,
    // 设置是否可编辑
    editable: () => editable,
    // 处理键盘事件
    handleKeyDown: handleKeyDown
  });
  
  // 应用一些基本样式
  if (view.dom) {
    view.dom.style.whiteSpace = 'pre-wrap';
    view.dom.style.outline = 'none';
  }
  
  return view;
}

// 销毁视图
export function destroyView(view: EditorView | null) {
  if (view) {
    view.destroy();
  }
} 