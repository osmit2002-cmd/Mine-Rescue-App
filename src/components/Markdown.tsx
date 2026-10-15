import { Fragment, type ReactNode } from 'react';

/**
 * Minimal, safe Markdown renderer for sources.md (headings, paragraphs, lists, tables, blockquotes,
 * **bold**, *italic*, `code`, [links](url) and bare URLs). Builds React elements; never injects HTML.
 */
export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = Math.min(h[1].length + 1, 6);
      const Tag = `h${level}` as 'h2';
      blocks.push(<Tag key={key++}>{inline(h[2])}</Tag>);
      i++;
      continue;
    }
    if (/^\s*\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div className="table-wrap" key={key++}>
          <table>
            <thead>
              <tr>{head?.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }
    const listRe = /^\s*(?:[-*]|\d+\.)\s+/;
    if (listRe.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && (listRe.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        if (listRe.test(lines[i])) items.push(lines[i].replace(listRe, ''));
        else items[items.length - 1] += ` ${lines[i].trim()}`;
        i++;
      }
      const L = ordered ? 'ol' : 'ul';
      blocks.push(<L key={key++}>{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</L>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={key++}>{inline(q.join(' '))}</blockquote>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*\||>|\s*(?:[-*]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={key++}>{inline(para.join(' '))}</p>);
  }
  return <div className="markdown">{blocks}</div>;
}

const SAFE_URL = /^(https?:|mailto:)/i;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))|(https?:\/\/[^\s)<>|]+)|(\*([^*]+)\*)/g;
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push(<Fragment key={k++}>{text.slice(last, i)}</Fragment>);
    if (m[1]) out.push(<strong key={k++}>{m[2]}</strong>);
    else if (m[3]) out.push(<code key={k++}>{m[4]}</code>);
    else if (m[5]) out.push(SAFE_URL.test(m[7]) ? <a key={k++} href={m[7]} target="_blank" rel="noreferrer noopener">{m[6]}</a> : <Fragment key={k++}>{m[6]}</Fragment>);
    else if (m[8]) out.push(<a key={k++} href={m[8]} target="_blank" rel="noreferrer noopener" className="url">{m[8]}</a>);
    else if (m[9]) out.push(<em key={k++}>{m[10]}</em>);
    last = i + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={k++}>{text.slice(last)}</Fragment>);
  return out;
}
