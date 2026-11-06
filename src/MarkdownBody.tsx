import { createElement, useState } from 'react';
import type { MarkdownNode } from './content-types';
import { ZoomableImage } from './ImageViewer';

function CodeBlock({ block, searchTarget, variant }: { block: Extract<MarkdownNode, { type: 'code' }>; searchTarget?: string; variant?: 'apex' }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(block.text); setCopied(true); setFallback(false); }
    catch { setFallback(true); }
  }
  return <figure className="code-block" id={block.id} data-search-match={!!searchTarget && block.id === searchTarget || undefined}>
    <figcaption className={variant === 'apex' ? 'code-toolbar' : undefined}><span>{block.language}</span><button className={variant === 'apex' ? 'code-copy' : undefined} type="button" onClick={copy} aria-label={copied ? '코드 복사 완료' : '코드 복사'}>{copied ? '복사됨' : '복사'}</button></figcaption>
    <pre tabIndex={0} aria-label={`${block.language} 코드`}><code>{renderNodes(block.children)}</code></pre>
    {fallback && <label className="code-copy-fallback">코드를 선택해 직접 복사해주세요.<textarea aria-label="복사할 코드" readOnly value={block.text} onFocus={event => event.target.select()}/></label>}
  </figure>;
}

function renderNodes(nodes: MarkdownNode[], linked = false, searchTarget?: string, variant?: 'apex'): React.ReactNode[] {
  return nodes.map((node, index) => {
    if (node.type === 'text') return node.value;
    if (node.type === 'code') return <CodeBlock key={index} block={node} searchTarget={searchTarget} variant={variant}/>;
    const attributes = { ...node.attributes, key: index, 'data-search-match': !!searchTarget && node.attributes.id === searchTarget || undefined };
    if (node.tag === 'img' && !linked) return <ZoomableImage key={index} {...node.attributes}/>;
    // React void elements must not receive an empty children array.
    if (['img', 'br', 'hr', 'input', 'wbr'].includes(node.tag)) return createElement(node.tag, attributes);
    // Table structure cannot contain the formatting whitespace emitted by Markdown.
    const children = ['table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup'].includes(node.tag)
      ? node.children.filter(child => child.type !== 'text' || child.value.trim())
      : node.children;
    const element = createElement(node.tag, attributes, renderNodes(children, linked || node.tag === 'a', searchTarget, variant));
    return node.tag === 'table' ? <div className="article-table" key={index} tabIndex={0} role="region" aria-label="표">{element}</div> : element;
  });
}

export function MarkdownBody({ body, searchTarget, variant }: { body: MarkdownNode[]; searchTarget?: string; variant?: 'apex' }) {
  return <div className="article-body markdown-body">{renderNodes(body, false, searchTarget, variant)}</div>;
}
