/**
 * ProseMirror状态配置
 * 用于创建和管理编辑器状态
 */

import { EditorState, Plugin } from 'prosemirror-state';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { editorSchema } from './schema';
import { parseMarkdown } from './markdown';
import { history } from 'prosemirror-history';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { inputRules, InputRule } from 'prosemirror-inputrules';

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

// 创建基本插件数组
export function createPlugins(extraPlugins: Plugin[] = []) {
  return [
    buildMdInputRules(editorSchema),  // 添加输入规则（如# 空格自动转为标题）
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