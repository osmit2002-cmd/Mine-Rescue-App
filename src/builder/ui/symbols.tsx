/**
 * MSHA Mine Map Legend symbols as SVG (rule book pp. 51–55). Drawn in feet on the map: the opening runs up the
 * screen in local coordinates, so "across" symbols are horizontal and get rotated 90° in crosscuts.
 */
import type { ReactNode } from 'react';
import { gasText, placardText } from '../catalog';
import type { El } from '../model';

const INK = '#111';

function Xs({ w, y, n }: { w: number; y: number; n: number }) {
  const step = w / n;
  const s = Math.min(step, 3) * 0.42;
  const d: string[] = [];
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + step * (i + 0.5);
    d.push(`M${cx - s} ${y - s}L${cx + s} ${y + s}M${cx - s} ${y + s}L${cx + s} ${y - s}`);
  }
  return <path d={d.join('')} stroke={INK} strokeWidth={0.45} fill="none" />;
}

function Scallops({ w, y }: { w: number; y: number }) {
  const n = Math.max(2, Math.round(w / 4));
  const step = w / n;
  let d = `M${-w / 2} ${y}`;
  for (let i = 0; i < n; i++) d += `a${step / 2} ${step / 2.2} 0 0 0 ${step} 0`;
  return <path d={d} stroke={INK} strokeWidth={0.45} fill="none" />;
}

/** The symbol for one element, centred on (0, 0). W = opening width (ft), k = symbol scale. */
export function SymbolShape({ el, W, k = 1 }: { el: El; W: number; k?: number }): ReactNode {
  const sw = 0.5 * k;
  const half = W / 2;
  const len = Math.max(2, el.len ?? 10);
  switch (el.kind) {
    case 'perm-stopping':
      return el.intact === false ? (
        <g stroke={INK} strokeWidth={sw} fill="none">
          <path d={`M${-half} -0.9l3 -2.6M${-half} 0.9l3 -2.6M${half} -0.9l-3 -2.6M${half} 0.9l-3 -2.6`} />
        </g>
      ) : (
        <g stroke={INK} strokeWidth={sw}>
          <line x1={-half} y1={-0.9} x2={half} y2={-0.9} />
          <line x1={-half} y1={0.9} x2={half} y2={0.9} />
        </g>
      );
    case 'temp-stopping':
      return el.intact === false ? (
        <path d={`M${-half} 0l3 -3M${half} 0l-3 -3`} stroke={INK} strokeWidth={sw} fill="none" />
      ) : (
        <line x1={-half} y1={0} x2={half} y2={0} stroke={INK} strokeWidth={sw} />
      );
    case 'seal':
      return (
        <g stroke={INK} strokeWidth={sw}>
          {[-1.4, 0, 1.4].map((y) => (
            <line key={y} x1={-half} y1={y} x2={half} y2={y} />
          ))}
        </g>
      );
    case 'door':
      return (
        <g>
          <line x1={-half} y1={0} x2={half} y2={0} stroke={INK} strokeWidth={sw} strokeDasharray={el.open ? `${2 * k} ${1.5 * k}` : undefined} />
          <text x={0} y={-1.2 * k} fontSize={4.2 * k} textAnchor="middle" fill={INK} fontFamily="Arial, sans-serif">
            D
          </text>
        </g>
      );
    case 'barricade':
      return (
        <g>
          <line x1={-half} y1={0} x2={-2.2 * k} y2={0} stroke={INK} strokeWidth={sw} />
          <line x1={2.2 * k} y1={0} x2={half} y2={0} stroke={INK} strokeWidth={sw} />
          <text x={0} y={1.6 * k} fontSize={4.6 * k} textAnchor="middle" fill={INK} fontFamily="Arial, sans-serif">
            B
          </text>
          {el.intact === false && <path d={`M${-half} 0l2 -2M${half} 0l-2 -2`} stroke={INK} strokeWidth={sw} />}
        </g>
      );
    case 'diagonal': {
      const s = el.diag === '\\' ? -1 : 1;
      return <line x1={-half} y1={half * s} x2={half} y2={-half * s} stroke={INK} strokeWidth={sw} strokeDasharray={el.intact === false ? `${3 * k} ${2 * k}` : undefined} />;
    }
    case 'overcast': {
      const s = Math.min(half * 0.85, 7 * k);
      return <path d={`M${-s} ${-s}H${s}L${-s} ${s}H${s}Z`} stroke={INK} strokeWidth={sw * 0.8} fill="none" />;
    }
    case 'line-curtain-installed':
      return (
        <g stroke={INK} strokeWidth={sw} fill="none">
          <line x1={-half / 2} y1={0} x2={-half / 2} y2={-len} />
          <line x1={-half / 2 - 1.5} y1={-len} x2={-half / 2 + 1.5} y2={-len} />
          <line x1={-half / 2} y1={0} x2={-half / 2 + 2.5} y2={2.5} />
        </g>
      );
    case 'caved': {
      const w = el.across === false ? half : W;
      const off = el.across === false ? -half / 2 : 0;
      const n = Math.max(3, Math.round(w / 3));
      return (
        <g transform={`translate(${off} 0)`}>
          <Xs w={w} y={-len / 2} n={n} />
          <Xs w={w} y={len / 2} n={n} />
        </g>
      );
    }
    case 'unsafe-roof':
      return el.across === false ? (
        <rect x={-half + 1} y={-len / 2} width={half} height={len} stroke={INK} strokeWidth={sw * 0.8} strokeDasharray={`${1.6 * k} ${1.1 * k}`} fill="none" />
      ) : (
        <g stroke={INK} strokeWidth={sw * 0.8} strokeDasharray={`${1.6 * k} ${1.1 * k}`} fill="none">
          <line x1={-half} y1={-len / 2} x2={half} y2={-len / 2} />
          <line x1={-half} y1={len / 2} x2={half} y2={len / 2} />
          <line x1={-half * 0.8} y1={0} x2={half * 0.8} y2={0} />
        </g>
      );
    case 'unsafe-rib':
      return (
        <g stroke={INK} strokeWidth={sw * 0.8} fill="none">
          <rect x={-half - 1.5} y={-len / 2} width={4.5} height={len} />
          {[-len / 4, 0, len / 4].map((y) => (
            <line key={y} x1={-half - 2.5} y1={y} x2={-half + 3.8} y2={y} />
          ))}
        </g>
      );
    case 'water': {
      const w = el.across === false ? half : W;
      const off = el.across === false ? -half / 2 : 0;
      return (
        <g transform={`translate(${off} 0)`}>
          <Scallops w={w} y={-len / 2} />
          <Scallops w={w} y={len / 2} />
        </g>
      );
    }
    case 'smoke':
    case 'smoke-end':
      return (
        <g stroke={INK} strokeWidth={0.4 * k} fill="none">
          {[-2.4, 0, 2.4].map((y) => (
            <ellipse key={y} cx={0} cy={y * k} rx={2.6 * k} ry={1 * k} />
          ))}
          <path d={`M${2.4 * k} ${-4 * k}q${1.4 * k} ${4 * k} 0 ${8 * k}`} />
          {el.kind === 'smoke-end' && <line x1={-3.5 * k} y1={4 * k} x2={3.5 * k} y2={-4 * k} strokeWidth={0.6 * k} />}
        </g>
      );
    case 'gas':
      return (
        <g stroke={INK} strokeWidth={0.4 * k} fill="#fff">
          <rect x={-3 * k} y={-3 * k} width={6 * k} height={6 * k} />
          <circle r={2.3 * k} />
        </g>
      );
    case 'air':
      return (
        <g transform={`rotate(${el.dir ?? 0})`} stroke={INK} strokeWidth={0.45 * k} fill="none">
          <line x1={0} y1={6 * k} x2={0} y2={-6 * k} />
          <path d={`M${-2 * k} ${-3.6 * k}L0 ${-6 * k}L${2 * k} ${-3.6 * k}`} />
        </g>
      );
    case 'fire':
      return <path d={`M0 ${-3.2 * k}L${3 * k} ${2.4 * k}H${-3 * k}Z`} stroke={INK} strokeWidth={0.5 * k} fill="#fff" />;
    case 'fan':
      return <path d={`M0 0C${-2 * k} ${-2.6 * k} ${-6 * k} ${-2.6 * k} ${-6 * k} 0S${-2 * k} ${2.6 * k} 0 0S${6 * k} ${-2.6 * k} ${6 * k} 0S${2 * k} ${2.6 * k} 0 0Z`} stroke={INK} strokeWidth={0.4 * k} fill="none" />;
    case 'body':
      return (
        <g transform={`rotate(${el.dir ?? 0})`} stroke={INK} strokeWidth={0.45 * k}>
          <circle cx={0} cy={-4 * k} r={1.2 * k} fill={INK} />
          <path d={`M0 ${-2.8 * k}V${1 * k}L${-2 * k} ${4 * k}M0 ${1 * k}L${2 * k} ${4 * k}`} fill="none" />
        </g>
      );
    case 'person':
      return (
        <g transform={`rotate(${el.dir ?? 0})`} stroke={INK} strokeWidth={0.45 * k} fill="none">
          <circle cx={0} cy={-4.2 * k} r={1.2 * k} fill="#fff" />
          <path d={`M0 ${-3 * k}V${1 * k}L${-2 * k} ${4 * k}M0 ${1 * k}L${2 * k} ${4 * k}M${-2.4 * k} ${-4.4 * k}L0 ${-1.6 * k}L${2.4 * k} ${-4.4 * k}`} />
        </g>
      );
    case 'refuge': {
      const d = el.dir ?? 180;
      const dx = Math.sin((d * Math.PI) / 180) * 4.6 * k;
      const dy = -Math.cos((d * Math.PI) / 180) * 4.6 * k;
      return (
        <g>
          <rect x={-3.6 * k} y={-3.6 * k} width={7.2 * k} height={7.2 * k} stroke={INK} strokeWidth={0.4 * k} fill="#fff" />
          <text x={0} y={1.3 * k} fontSize={3.6 * k} textAnchor="middle" fill={INK} fontFamily="Arial, sans-serif">
            RA
          </text>
          <text x={dx} y={dy + 1.1 * k} fontSize={3 * k} textAnchor="middle" fill={INK} fontFamily="Arial, sans-serif">
            D
          </text>
        </g>
      );
    }
    case 'brattice':
    case 'line-curtain':
      return (
        <g>
          {el.kind === 'brattice' ? <circle r={3.3 * k} stroke={INK} strokeWidth={0.4 * k} fill="#fff" /> : <ellipse rx={4.4 * k} ry={2.8 * k} stroke={INK} strokeWidth={0.4 * k} fill="#fff" />}
          <text x={0} y={1.1 * k} fontSize={3 * k} textAnchor="middle" fill={INK} fontFamily="Arial, sans-serif" fontWeight={el.kind === 'line-curtain' ? 700 : 400}>
            {el.kind === 'brattice' ? 'BC' : 'LC'}
          </text>
        </g>
      );
    case 'x':
      return <path d={`M${-2.2 * k} ${-2.2 * k}L${2.2 * k} ${2.2 * k}M${-2.2 * k} ${2.2 * k}L${2.2 * k} ${-2.2 * k}`} stroke={INK} strokeWidth={0.5 * k} />;
    case 'roof-support':
      return <circle r={1.4 * k} stroke={INK} strokeWidth={0.4 * k} fill="#fff" />;
    case 'fpa':
      return (
        <g>
          <path d={`M${-half} -3V3M${half} -3V3`} stroke={INK} strokeWidth={sw} />
          <text x={0} y={1.3 * k} fontSize={3.6 * k} textAnchor="middle" fill={INK} fontFamily="Arial, sans-serif">
            FPA
          </text>
        </g>
      );
    default:
      return null;
  }
}

/** Text written beside a symbol on the map. */
export function mapLabel(el: El): string[] {
  if (el.kind === 'gas') return (el.text?.trim() ? [el.text.trim()] : gasText(el).split(/(?<=CH4|CO) /)).filter(Boolean);
  if (el.kind === 'roof-support' || el.kind === 'fpa' || el.kind === 'smoke-end') return [];
  const t = placardText(el);
  // Words the symbol already says need not be written again.
  const skip: Partial<Record<El['kind'], RegExp>> = {
    'perm-stopping': /^PERMANENT STOPPING$/i,
    'temp-stopping': /^TEMPORARY STOPPING$/i,
    seal: /^SEAL$/i,
    barricade: /^BARRICADE$/i,
    caved: /^CAVED$/i,
    'unsafe-roof': /^UNSAFE ROOF$/i,
    smoke: /^SMOKE$/i,
    body: /^BODY$/i,
    fire: /^FIRE$/i,
    brattice: /^BRATTICE CLOTH$/i,
    'line-curtain': /^LINE CURTAIN$/i,
    refuge: /^REFUGE ALTERNATIVE$/i,
    overcast: /^OVERCAST$/i,
    diagonal: /^TEMPORARY STOPPING$/i
  };
  if (!t || skip[el.kind]?.test(t)) return [];
  // Wrap long text into lines of ~22 characters.
  const words = t.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > 22 && line) {
      lines.push(line);
      line = w;
    } else line = (line + ' ' + w).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

/** Small palette/legend icon for an element kind. */
export function SymbolIcon({ el, size = 28 }: { el: El; size?: number }) {
  const W = 12;
  const big = ['perm-stopping', 'temp-stopping', 'seal', 'door', 'barricade', 'caved', 'unsafe-roof', 'water', 'fpa', 'diagonal'].includes(el.kind);
  const view = big ? 16 : 14;
  const iconEl: El = { ...el, len: el.kind === 'line-curtain-installed' ? 8 : 6 };
  return (
    <svg width={size} height={size} viewBox={`${-view / 2} ${-view / 2} ${view} ${view}`} aria-hidden="true" focusable="false" className="sym-icon">
      <rect x={-view / 2} y={-view / 2} width={view} height={view} fill="#fff" rx={1.5} />
      {big && el.kind !== 'diagonal' && <path d={`M${-W / 2} ${-view / 2}V${view / 2}M${W / 2} ${-view / 2}V${view / 2}`} stroke="#999" strokeWidth={0.4} />}
      <g transform="scale(0.95)">
        <SymbolShape el={iconEl} W={W} k={el.kind === 'fan' || el.kind === 'air' ? 1 : 1.25} />
      </g>
    </svg>
  );
}
