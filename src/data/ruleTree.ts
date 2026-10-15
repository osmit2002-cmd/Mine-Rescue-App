/** Builds the collapsible section tree for the Rules page. Pure. */
import type { Rule } from './types';

export interface RuleNode {
  rule: Rule;
  children: RuleNode[];
}

export interface SectionNode {
  key: string;
  name: string;
  depth: number;
  sections: SectionNode[];
  rules: RuleNode[];
  /** Total rules below this node, including nested sections and sub-rules. */
  count: number;
}

export function buildRuleTree(rules: Rule[]): SectionNode {
  const root: SectionNode = { key: '', name: '', depth: 0, sections: [], rules: [], count: 0 };
  const sectionByKey = new Map<string, SectionNode>([['', root]]);
  const sorted = rules.slice().sort((a, b) => a.order - b.order);
  const byId = new Map(sorted.map((r) => [r.id, r]));
  const nodeById = new Map<string, RuleNode>(sorted.map((r) => [r.id, { rule: r, children: [] }]));

  const sectionFor = (path: string[]): SectionNode => {
    let node = root;
    let key = '';
    path.forEach((name, i) => {
      key = key ? `${key}\u001f${name}` : name;
      let next = sectionByKey.get(key);
      if (!next) {
        next = { key, name, depth: i + 1, sections: [], rules: [], count: 0 };
        sectionByKey.set(key, next);
        node.sections.push(next);
      }
      node = next;
    });
    return node;
  };

  /** True if following parent links from `id` loops back. */
  const inCycle = (id: string): boolean => {
    const seen = new Set<string>();
    let cur: string | undefined = id;
    while (cur) {
      if (seen.has(cur)) return true;
      seen.add(cur);
      cur = byId.get(cur)?.parent;
    }
    return false;
  };

  for (const r of sorted) {
    const node = nodeById.get(r.id)!;
    const parentNode = r.parent && !inCycle(r.id) ? nodeById.get(r.parent) : undefined;
    if (parentNode) parentNode.children.push(node);
    else sectionFor(r.sectionPath).rules.push(node);
  }

  const countRules = (n: RuleNode): number => 1 + n.children.reduce((s, c) => s + countRules(c), 0);
  const countSection = (s: SectionNode): number =>
    (s.count = s.rules.reduce((t, r) => t + countRules(r), 0) + s.sections.reduce((t, c) => t + countSection(c), 0));
  countSection(root);
  return root;
}

/** Ancestor rule chain (outermost first) for breadcrumbs; cycle-safe. */
export function ruleAncestors(rule: Rule, byId: Map<string, Rule>): Rule[] {
  const out: Rule[] = [];
  const seen = new Set([rule.id]);
  let cur = rule.parent ? byId.get(rule.parent) : undefined;
  while (cur && !seen.has(cur.id)) {
    out.unshift(cur);
    seen.add(cur.id);
    cur = cur.parent ? byId.get(cur.parent) : undefined;
  }
  return out;
}
