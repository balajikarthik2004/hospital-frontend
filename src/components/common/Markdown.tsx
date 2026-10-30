import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A small Markdown renderer for agent output. The agents emit a known, narrow
 * subset — headings, paragraphs, bullet and numbered lists, bold, italic,
 * inline code and horizontal rules — so a focused renderer beats pulling in a
 * full parser, and nothing is ever rendered as raw HTML.
 */
export function Markdown({ content, className }: { content: string; className?: string }) {
  return <div className={cn('prose-clinical', className)}>{renderBlocks(content)}</div>;
}

function renderBlocks(markdown: string): ReactNode[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={key++}>{inline(paragraph.join(' '))}</p>);
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item, i) => <li key={i}>{inline(item)}</li>);
    blocks.push(list.ordered ? <ol key={key++}>{items}</ol> : <ul key={key++}>{items}</ul>);
    list = null;
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const text = inline(heading[2]);
      blocks.push(
        level === 1 ? (
          <h1 key={key++}>{text}</h1>
        ) : level === 2 ? (
          <h2 key={key++}>{text}</h2>
        ) : (
          <h3 key={key++}>{text}</h3>
        )
      );
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushAll();
      blocks.push(<hr key={key++} />);
      continue;
    }

    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }

    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      flushParagraph();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(numbered[1]);
      continue;
    }

    // A continuation line inside a list item.
    if (list && /^\s{2,}\S/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushAll();
  return blocks;
}

/** Bold, italic and inline code. Everything else stays literal text. */
function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];

    if (token.startsWith('**') || token.startsWith('__')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : [text];
}
