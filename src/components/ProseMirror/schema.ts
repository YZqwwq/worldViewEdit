/**
 * ProseMirror Schema配置
 * 这个文件定义了编辑器的文档结构模式
 */
import { Schema } from 'prosemirror-model';
import type { NodeSpec, MarkSpec, Node as ProsemirrorNode } from 'prosemirror-model';
import { schema as baseSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';

// 创建一个完整的Markdown编辑器schema
const nodes = addListNodes(baseSchema.spec.nodes, 'paragraph block*', 'block');

// 扩展基础节点定义
const headingNodeSpec: NodeSpec = {
  attrs: { level: { default: 1 } },
  content: 'inline*',
  group: 'block',
  defining: true,
  parseDOM: [
    { tag: 'h1', attrs: { level: 1 } },
    { tag: 'h2', attrs: { level: 2 } },
    { tag: 'h3', attrs: { level: 3 } },
    { tag: 'h4', attrs: { level: 4 } },
    { tag: 'h5', attrs: { level: 5 } },
    { tag: 'h6', attrs: { level: 6 } }
  ],
  toDOM(node: ProsemirrorNode) { return [`h${node.attrs.level}`, 0] }
};

const codeBlockNodeSpec: NodeSpec = {
  content: 'text*',
  marks: '',
  group: 'block',
  code: true,
  defining: true,
  parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
  toDOM() { return ['pre', ['code', 0]] }
};

// 创建带有新节点的节点映射
const extendedNodes = nodes.addToEnd('heading', headingNodeSpec)
                           .addToEnd('code_block', codeBlockNodeSpec);

// 扩展标记定义
const strikethroughMarkSpec: MarkSpec = {
  parseDOM: [
    { tag: 's' },
    { tag: 'strike' },
    { tag: 'del' },
    { style: 'text-decoration=line-through' }
  ],
  toDOM() { return ['del', 0] }
};

const codeMarkSpec: MarkSpec = {
  parseDOM: [{ tag: 'code' }],
  toDOM() { return ['code', 0] }
};

// 创建带有新标记的标记映射
const extendedMarks = baseSchema.spec.marks.addToEnd('strikethrough', strikethroughMarkSpec)
                                            .update('code', codeMarkSpec);

// 扩展基础schema，添加完整的Markdown支持
export const editorSchema = new Schema({
  nodes: extendedNodes,
  marks: extendedMarks
});

// 简化版本，避免类型错误
export const extendSchema = () => {
  return editorSchema;
};

// 请根据实际需求扩展这个模块，这是一个基础实现 