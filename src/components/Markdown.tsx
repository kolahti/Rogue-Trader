import type { JSX, ReactNode } from "react";

// Minimal, dependency-free markdown renderer for short authored text
// (descriptions, link popups). Builds React nodes directly — never injects raw
// HTML — so it is XSS-safe. Supports: headings, bold, italic, inline code,
// links, and unordered/ordered lists.

const SAFE_HREF = /^(https?:|mailto:)/i;

// Inline formatting: **bold**, *italic* / _italic_, `code`, [label](url).
function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let buffer = "";
  let rest = text;
  let key = 0;
  const push = (node: ReactNode) => {
    if (buffer) {
      nodes.push(buffer);
      buffer = "";
    }
    nodes.push(node);
  };

  while (rest) {
    let m: RegExpMatchArray | null = null;
    if ((m = rest.match(/^\*\*([^*]+)\*\*/))) {
      push(<strong key={key++}>{parseInline(m[1])}</strong>);
    } else if ((m = rest.match(/^\*([^*]+)\*/)) || (m = rest.match(/^_([^_]+)_/))) {
      push(<em key={key++}>{parseInline(m[1])}</em>);
    } else if ((m = rest.match(/^`([^`]+)`/))) {
      push(<code key={key++}>{m[1]}</code>);
    } else if ((m = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/))) {
      const href = SAFE_HREF.test(m[2]) ? m[2] : "#";
      push(
        <a key={key++} href={href} target="_blank" rel="noopener noreferrer">
          {parseInline(m[1])}
        </a>
      );
    } else {
      buffer += rest[0];
      rest = rest.slice(1);
      continue;
    }
    rest = rest.slice(m[0].length);
  }

  if (buffer) nodes.push(buffer);
  return nodes;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushPara = () => {
    if (!para.length) return;
    const rows = para;
    para = [];
    blocks.push(
      <p key={key++}>
        {rows.map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {parseInline(line)}
          </span>
        ))}
      </p>
    );
  };

  const flushList = () => {
    if (!list) return;
    const { ordered, items } = list;
    list = null;
    const lis = items.map((it, i) => <li key={i}>{parseInline(it)}</li>);
    blocks.push(ordered ? <ol key={key++}>{lis}</ol> : <ul key={key++}>{lis}</ul>);
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (line.trim() === "") {
      flushPara();
      flushList();
    } else if (heading) {
      flushPara();
      flushList();
      // Markdown headings sit one level below the container title: # → h2,
      // ## → h3, etc.
      const level = Math.min(4, heading[1].length + 1);
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      blocks.push(<Tag key={key++}>{parseInline(heading[2])}</Tag>);
    } else if (bullet || ordered) {
      flushPara();
      const isOrdered = Boolean(ordered);
      const content = (bullet ?? ordered)![1];
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push(content);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return <div className={className}>{blocks}</div>;
}
