/**
 * The problem as the solver sees it: every element located on an edge (with its extent) or in an intersection,
 * and a graph whose intersections can be split by diagonals (travel and air) and overcasts (air only).
 */
import { buildTopo, locate, makeGeo, type Loc, type Port, type TEdge, type TNode, type Topo } from './geometry';
import type { El, Problem } from './model';
import { airEffect, halfLength, isAirtight, travelBlock } from './rules';

export interface Placed {
  el: El;
  loc: Loc;
  /** Position and extent along the edge (feet from end a). Zero for elements in intersections. */
  s: number;
  s0: number;
  s1: number;
}

export interface Board {
  problem: Problem;
  elements: El[];
  topo: Topo;
  placed: Map<string, Placed>;
  /** Elements on each edge, sorted by position. */
  onEdge: Map<string, Placed[]>;
  /** Elements in each intersection (base node id). */
  onNode: Map<string, Placed[]>;
  /** Elements that are not inside any opening. */
  outside: El[];
}

export function makeBoard(problem: Problem, elements: El[] = problem.elements): Board {
  const topo = buildTopo(makeGeo(problem.layout));
  const placed = new Map<string, Placed>();
  const onEdge = new Map<string, Placed[]>();
  const onNode = new Map<string, Placed[]>();
  const outside: El[] = [];
  for (const el of elements) {
    const loc = locate(topo, el.x, el.y);
    if (loc.type === 'none') {
      outside.push(el);
      continue;
    }
    if (loc.type === 'node') {
      const p: Placed = { el, loc, s: 0, s0: 0, s1: 0 };
      placed.set(el.id, p);
      onNode.set(loc.node, [...(onNode.get(loc.node) ?? []), p]);
    } else {
      const e = topo.edges.get(loc.edge)!;
      const h = halfLength(el);
      const p: Placed = { el, loc, s: loc.s, s0: Math.max(0, loc.s - h), s1: Math.min(e.len, loc.s + h) };
      placed.set(el.id, p);
      onEdge.set(loc.edge, [...(onEdge.get(loc.edge) ?? []), p]);
    }
  }
  for (const list of onEdge.values()) list.sort((a, b) => a.s0 - b.s0 || a.s - b.s);
  return { problem, elements, topo, placed, onEdge, onNode, outside };
}

export type GraphMode = 'travel' | 'air';

export interface SubNode {
  id: string;
  base: string;
  node: TNode;
  ports: Port[];
}

export interface Graph {
  board: Board;
  mode: GraphMode;
  subs: Map<string, SubNode>;
  /** Base node id → its sub-node ids. */
  subsOf: Map<string, string[]>;
  /** Edge id → [sub at a, sub at b]. */
  ends: Map<string, [string, string]>;
  /** Sub-node → edges touching it. */
  adj: Map<string, string[]>;
}

/** Port groups at an intersection: a diagonal splits it in two (both modes); an intact overcast splits the air (entry vs crosscut). */
export function portGroups(board: Board, base: string, mode: GraphMode, active: (el: El) => boolean = () => true): Port[][] {
  const here = (board.onNode.get(base) ?? []).filter((p) => active(p.el));
  const diag = here.find((p) => p.el.kind === 'diagonal' && (mode === 'air' ? airEffect(p.el) === 'block' : !!travelBlock(p.el)));
  if (diag) return diag.el.diag === '\\' ? [['N', 'E'], ['S', 'W']] : [['N', 'W'], ['S', 'E']];
  if (mode === 'air' && here.some((p) => p.el.kind === 'overcast' && isAirtight(p.el))) return [['N', 'S'], ['E', 'W']];
  return [['N', 'S', 'E', 'W']];
}

export function buildGraph(board: Board, mode: GraphMode, active: (el: El) => boolean = () => true): Graph {
  const { topo } = board;
  const subs = new Map<string, SubNode>();
  const subsOf = new Map<string, string[]>();
  const portSub = new Map<string, string>(); // `${base}|${port}` → sub id
  for (const n of topo.nodes.values()) {
    const groups = n.end ? [['N', 'S', 'E', 'W'] as Port[]] : portGroups(board, n.id, mode, active);
    const ids: string[] = [];
    groups.forEach((ports, k) => {
      const id = groups.length === 1 ? n.id : `${n.id}#${k}`;
      subs.set(id, { id, base: n.id, node: n, ports });
      ids.push(id);
      for (const p of ports) portSub.set(`${n.id}|${p}`, id);
    });
    subsOf.set(n.id, ids);
  }
  const ends = new Map<string, [string, string]>();
  const adj = new Map<string, string[]>();
  for (const s of subs.keys()) adj.set(s, []);
  for (const e of topo.edges.values()) {
    const a = portSub.get(`${e.a}|${e.pa}`);
    const b = portSub.get(`${e.b}|${e.pb}`);
    if (!a || !b) continue;
    ends.set(e.id, [a, b]);
    adj.get(a)!.push(e.id);
    adj.get(b)!.push(e.id);
  }
  return { board, mode, subs, subsOf, ends, adj };
}

export function otherEnd(g: Graph, edge: string, sub: string): string {
  const [a, b] = g.ends.get(edge)!;
  return a === sub ? b : a;
}

/** Which end of the edge this sub-node is: 'a' or 'b'. */
export function endOf(g: Graph, edge: string, sub: string): 'a' | 'b' {
  return g.ends.get(edge)![0] === sub ? 'a' : 'b';
}

/** The sub-node of an intersection that contains point (x, y) (matters only when a diagonal splits it). */
export function subAt(g: Graph, base: string, x: number, y: number): string {
  const ids = g.subsOf.get(base) ?? [base];
  if (ids.length === 1) return ids[0];
  const n = g.board.topo.nodes.get(base)!;
  const dx = x - n.x;
  const dy = y - n.y;
  const first = g.subs.get(ids[0])!;
  // Group 0 holds N with W ('/') or N with E ('\'): the triangle above the diagonal.
  const above = first.ports.includes('W') ? dy >= dx : first.ports.includes('E') && first.ports.includes('N') ? dy >= -dx : dy >= 0;
  return above ? ids[0] : ids[1];
}

/** The sub-node an element in an intersection belongs to. */
export function subOfPlaced(g: Graph, p: Placed): string | null {
  if (p.loc.type !== 'node') return null;
  return subAt(g, p.loc.node, p.el.x, p.el.y);
}

export const edgeOf = (b: Board, id: string): TEdge => b.topo.edges.get(id)!;
