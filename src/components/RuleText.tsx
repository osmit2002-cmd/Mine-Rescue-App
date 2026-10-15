import { Highlight } from './Highlight';

/** Indent level for a sub-item line: "A." = 1, "1." or "(a)" = 2, "a." or "(1)" = 3, other = 0. Display only. */
export function paragraphLevel(line: string): number {
  const t = line.trimStart();
  if (/^[A-Z]\.\s/.test(t)) return 1;
  if (/^(?:\d+\.\s|\([a-z]\)\s)/.test(t)) return 2;
  if (/^(?:[a-z]\.\s|\(\d+\)\s)/.test(t)) return 3;
  return 0;
}

/**
 * Verbatim rule text, one paragraph per source line. Sub-items (A., 1., a.) are indented.
 * The wording is never modified; it is only split at existing line breaks.
 */
export function RuleText({ text, terms = [], format }: { text: string; terms?: string[]; format?: 'pre' }) {
  if (format === 'pre')
    // Skill sheets and forms: whitespace and line breaks exactly as printed.
    return (
      <pre className="rule-text rule-pre">
        <Highlight text={text} terms={terms} />
      </pre>
    );
  const lines = text.split('\n');
  return (
    <div className="rule-text">
      {lines.map((line, i) =>
        line.trim() ? (
          <p key={i} className={`lvl-${paragraphLevel(line)}`}>
            <Highlight text={line} terms={terms} />
          </p>
        ) : null
      )}
    </div>
  );
}
