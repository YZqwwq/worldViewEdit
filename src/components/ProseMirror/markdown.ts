/**
 * ProseMirror Markdown处理配置
 * 负责Markdown的解析和序列化
 */

import { editorSchema } from './schema';
import { defaultMarkdownParser, defaultMarkdownSerializer, MarkdownParser, MarkdownSerializer } from 'prosemirror-markdown';
import { Node } from 'prosemirror-model';

// 预处理Markdown内容，支持没有空格的标题格式
export function preprocessMarkdown(content: string): string {
  if (!content) return '';
  
  // 1. ##标题 转换为 ## 标题，确保#与文本之间有空格
  let processedContent = content.replace(/(^|\n)(#{1,6})([^\s#])/g, '$1$2 $3');
  
  // 2. 支持加粗处理：确保**文本**没有被意外分割
  processedContent = processedContent.replace(/\*\*([^*]+)\*\*/g, (match) => match);
  
  // 3. 支持斜体处理：确保*文本*没有被意外分割
  processedContent = processedContent.replace(/\*([^*]+)\*/g, (match) => match);
  
  return processedContent;
}

// 创建增强的Markdown解析器
export const markdownParser = new MarkdownParser(
  editorSchema, 
  defaultMarkdownParser.tokenizer, 
  {
    ...defaultMarkdownParser.tokens,
    // 可以在这里添加自定义token处理
  }
);

// 创建增强的Markdown序列化器
export const markdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    // 自定义节点序列化
    heading: (state, node) => {
      // 如果标题为空，不生成标题标记
      if (node.content.size === 0) {
        state.renderContent(node);
        return;
      }
      
      state.write('#'.repeat(node.attrs.level) + ' ');
      state.renderInline(node);
      state.closeBlock(node);
    },
    // 确保段落序列化不包含多余的空行
    paragraph: (state, node) => {
      state.renderInline(node);
      state.closeBlock(node);
    }
  },
  {
    ...defaultMarkdownSerializer.marks,
    // 自定义标记序列化
    strikethrough: {
      open: '~~',
      close: '~~',
      mixable: true,
      expelEnclosingWhitespace: true
    },
    // 加粗
    strong: {
      open: '**',
      close: '**',
      mixable: true,
      expelEnclosingWhitespace: true
    },
    // 斜体
    em: {
      open: '*',
      close: '*',
      mixable: true,
      expelEnclosingWhitespace: true
    },
    // 行内代码
    code: {
      open: '`',
      close: '`',
      mixable: false,
      expelEnclosingWhitespace: true
    }
  }
);

// 解析Markdown为ProseMirror文档
export function parseMarkdown(markdown: string) {
  // 先进行预处理，再由解析器解析
  const processedMarkdown = preprocessMarkdown(markdown || '');
  return markdownParser.parse(processedMarkdown);
}

// 将ProseMirror文档序列化为Markdown
export function serializeToMarkdown(doc: Node) {
  return markdownSerializer.serialize(doc);
}

// 根据自定义schema创建解析器
export function createParserWithSchema(schema = editorSchema) {
  return new MarkdownParser(
    schema, 
    defaultMarkdownParser.tokenizer, 
    defaultMarkdownParser.tokens
  );
} 