/**
 * ProseMirror状态配置
 * 用于创建和管理编辑器状态
 */

import { EditorState, Plugin, Transaction } from 'prosemirror-state';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { editorSchema } from './schema';
import { parseMarkdown } from './markdown';
import { history } from 'prosemirror-history';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { inputRules, InputRule } from 'prosemirror-inputrules';
import { setBlockType } from 'prosemirror-commands';

// 创建自定义事件，用于通知保存操作
const SAVE_EVENT_NAME = 'prosemirror-save-requested';

// 派发保存事件
export function dispatchSaveEvent() {
  const event = new CustomEvent(SAVE_EVENT_NAME);
  document.dispatchEvent(event);
}

// 基本的Markdown输入规则
// 当用户输入特定的字符序列时会自动转换为相应的节点
function buildMdInputRules(schema: any) {
  const rules = [];

  // 标题规则: # 空格 -> h1, ## 空格 -> h2, 等等
  for (let i = 1; i <= 6; i++) {
    rules.push(
      new InputRule(
        new RegExp(`^(#{${i}})\\s$`),
        (state: EditorState, match: RegExpMatchArray, start: number, end: number) => {
          const { tr } = state;
          tr.delete(start, end)
            .setBlockType(start, start, schema.nodes.heading, { level: i });
          return tr;
        }
      )
    );
  }

  return inputRules({ rules });
}

// 创建自定义退格键处理
function createBackspaceKeyMap(schema: any) {
  return keymap({
    'Backspace': (state: EditorState, dispatch?: (tr: Transaction) => void) => {
      const { selection, doc } = state;
      const { $from, empty } = selection;
      
      // 只有当选择为空（光标位置）且在段落最开始位置时才应用
      if (!empty || $from.parentOffset > 0) return false;
      
      // 获取当前节点
      const node = $from.node();
      
      // 如果是标题节点并且内容为空，转换为普通段落
      if (node.type === schema.nodes.heading && node.textContent.trim() === '') {
        if (dispatch) {
          const tr = state.tr.setBlockType($from.pos, $from.pos, schema.nodes.paragraph);
          dispatch(tr);
        }
        return true;
      }
      
      // 其他情况交给默认处理
      return false;
    }
  });
}

// 创建快捷键映射
function createHeadingKeyMap(schema: any) {
  const headingKeyMap: {[key: string]: any} = {};
  
  // 添加Ctrl+1到Ctrl+6的快捷键，用于创建各级标题
  for (let i = 1; i <= 6; i++) {
    headingKeyMap[`Ctrl-${i}`] = setBlockType(schema.nodes.heading, { level: i });
  }
  
  // 添加Ctrl+0的快捷键，用于转换回普通段落
  headingKeyMap['Ctrl-0'] = setBlockType(schema.nodes.paragraph);
  
  return keymap(headingKeyMap);
}

// 创建保存快捷键映射
function createSaveKeyMap() {
  return keymap({
    'Ctrl-s': (state: EditorState) => {
      // 阻止浏览器默认保存行为
      setTimeout(() => {
        dispatchSaveEvent();
      }, 0);
      return true;
    }
  });
}

// 创建基本插件数组
export function createPlugins(extraPlugins: Plugin[] = []) {
  return [
    buildMdInputRules(editorSchema),  // 添加输入规则（如# 空格自动转为标题）
    createHeadingKeyMap(editorSchema), // 添加标题快捷键
    createSaveKeyMap(),                // 添加保存快捷键
    createBackspaceKeyMap(editorSchema), // 添加自定义退格键处理
    keymap(baseKeymap),               // 基本按键映射
    dropCursor(),                     // 拖放时显示光标位置
    gapCursor(),                      // 支持在块元素间的光标
    history(),                        // 历史记录（撤销/重做）
    ...extraPlugins
  ];
}

// 创建初始状态
export function createEditorState(content: string = '', plugins: Plugin[] = []) {
  return EditorState.create({
    doc: parseMarkdown(content),
    plugins: createPlugins(plugins)
  });
}

// 创建包含默认配置的状态
export function createDefaultState(content: string = '') {
  return createEditorState(content);
} 