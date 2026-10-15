"""Crop individual figures out of the 2026 MSHA rule-book PDFs and link them to rule items.
Run after build.py and build_events.py (build_events.py calls this at the end).
Writes:
  content/figures/<event>/fig-*.png        cropped figures (200 dpi); full-page images are kept as they were
  rules*.json                              + "figures": [{id,file,caption,page,...}] on rule items (and on
                                             figure-only sections), display order; every other field unchanged
  content/figures.json                     index of every figure image (crops and full pages)
  content/figures-report.md                rules with figures, uncertain links
"""
import json, os, re, glob
import pymupdf
from PIL import Image
ROOT = '/workspace/mine-rescue'; SRC = f'{ROOT}/sources'; OUT = f'{ROOT}/content'
DPI = 200; PAD = 6
PDF = {'mine-rescue': 'I-2026_Coal_MR_Rules.pdf', 'first-aid': 'III-2026_First_Aid_Rules.pdf',
       'bench-biopak': 'IV-2026_Bio_240R_Bench_Rules.pdf', 'bench-bg4': 'V-2026_BG-4_Bench_Rules.pdf',
       'bench-proair': 'VI-2026_LDV_BG-ProAir_Bench_Rules.pdf', 'preshift': 'VII-2026_Preshift_Rules.pdf'}
RULES_FILE = {'mine-rescue': 'rules.json', **{e: f'rules-{e}.json' for e in PDF if e != 'mine-rescue'}}
DOCS = {e: pymupdf.open(f'{SRC}/{f}') for e, f in PDF.items()}
FIGS = []            # figure records, in creation order
LINKS = {}           # rule/section id -> [figure ids] in display order
UNCERTAIN = []       # (rule id, figure id, why)
INFERRED = []        # (rule id, figure id, why) links made on context rather than an explicit reference

# ---------------- geometry helpers ----------------
def spans(page):
    out = []
    for b in page.get_text('dict')['blocks']:
        if b['type'] != 0: continue
        for l in b['lines']:
            for s in l['spans']:
                if s['text'].strip(): out.append((pymupdf.Rect(s['bbox']), s['text']))
    return out
def lines(page):
    """Text lines (non-blank), top to bottom: (rect, text)."""
    out = []
    for b in page.get_text('dict')['blocks']:
        if b['type'] != 0: continue
        for l in b['lines']:
            ss = [s for s in l['spans'] if s['text'].strip()]
            if not ss: continue
            r = pymupdf.Rect()
            for s in ss: r |= pymupdf.Rect(s['bbox'])
            out.append((r, ''.join(s['text'] for s in l['spans']).strip()))
    return sorted(out, key=lambda x: (round(x[0].y0), x[0].x0))
_PN = {}
def pagenum_rect(page):
    """The printed page number: the lowest digits-only span in the bottom margin with nothing printed below it."""
    key = (page.parent.name, page.number)
    if key not in _PN:
        ss = spans(page)
        cand = [(r, t) for r, t in ss if re.fullmatch(r'\d{1,3}', t.strip()) and r.y0 > page.rect.height - 130]
        best = max(cand, key=lambda x: x[0].y0, default=None)
        if best and any(r.y0 > best[0].y1 - 2 for r, t in ss if r != best[0]): best = None
        _PN[key] = best
    return _PN[key]
def is_pagenum(r, t, page):
    pn = pagenum_rect(page)
    return bool(pn) and abs(r.y0 - pn[0].y0) < 1 and abs(r.x0 - pn[0].x0) < 1
def objects(page):
    """All visible things on the page except the printed page number: text spans, images, vector drawings."""
    objs = [r for r, t in spans(page) if not is_pagenum(r, t, page)]
    objs += [pymupdf.Rect(i['bbox']) for i in page.get_image_info()]
    for d in page.get_drawings():
        r = d['rect']
        if r.width >= page.rect.width - 20 and r.height >= page.rect.height - 20: continue  # page frame
        objs.append(r)
    return [r & page.rect for r in objs if not r.is_empty or r.width > 0 or r.height > 0]
def content(page, y0=0, y1=None, x0=0, x1=None, clip=False):
    y1 = page.rect.height if y1 is None else y1; x1 = page.rect.width if x1 is None else x1
    u = pymupdf.Rect()
    for r in objects(page):
        cy = (r.y0 + r.y1) / 2; cx = (r.x0 + r.x1) / 2
        if y0 <= cy <= y1 and x0 <= cx <= x1: u |= r
    if clip and not u.is_empty: u = u & pymupdf.Rect(x0, y0, x1, y1)
    return u
def foreign(page, y0, y1):
    """Objects whose centre lies outside the band (used to blank neighbouring legend entries inside a crop)."""
    return [r for r in objects(page) if not (y0 <= (r.y0 + r.y1) / 2 <= y1)]
def render(ev, pdf_page, rect, name, mask=()):
    page = DOCS[ev][pdf_page - 1]
    clip = pymupdf.Rect(rect.x0 - PAD, rect.y0 - PAD, rect.x1 + PAD, rect.y1 + PAD) & page.rect
    pix = page.get_pixmap(dpi=DPI, clip=clip, alpha=False)
    im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    if mask:
        from PIL import ImageDraw
        d = ImageDraw.Draw(im); k = DPI / 72
        for m in mask:
            m = m & clip
            if m.is_empty: continue
            d.rectangle([(m.x0 - clip.x0) * k - 2, (m.y0 - clip.y0) * k - 2, (m.x1 - clip.x0) * k + 2, (m.y1 - clip.y0) * k + 2], fill='white')
    # grayscale when the crop has no colour, otherwise a 256-colour palette (line art and text: no visible loss, much smaller files)
    hsv = im.resize((max(1, im.width // 4), max(1, im.height // 4))).convert('HSV')
    sat = sum(1 for h, s_, v in hsv.get_flattened_data() if s_ > 60 and v > 60) if hasattr(hsv, 'get_flattened_data') else sum(1 for h, s_, v in hsv.getdata() if s_ > 60 and v > 60)
    im = im.convert('L') if sat == 0 else im.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    rel = f'figures/{ev}/{name}.png'
    os.makedirs(os.path.dirname(f'{OUT}/{rel}'), exist_ok=True)
    im.save(f'{OUT}/{rel}', optimize=True)
    return rel, [round(clip.x0, 1), round(clip.y0, 1), round(clip.x1, 1), round(clip.y1, 1)], (im.width, im.height)
PRINTED = {}
def printed_page(ev, pdf_page):
    if (ev, pdf_page) in PRINTED: return PRINTED[(ev, pdf_page)]
    page = DOCS[ev][pdf_page - 1]
    nums = [t.strip() for r, t in spans(page) if is_pagenum(r, t, page)]
    v = int(nums[-1]) if nums else None
    PRINTED[(ev, pdf_page)] = v; return v
def fullpage_file(ev, pdf_page):
    f = f'figures/page-{pdf_page:02d}.png' if ev == 'mine-rescue' else f'figures/{ev}/page-{pdf_page:02d}.png'
    return f if os.path.exists(f'{OUT}/{f}') else None
def add(ev, fid, pdf_page, rect, caption, kind, rules=(), name=None, caption_source='printed', mask=()):
    rel, bbox, size = render(ev, pdf_page, rect, name or fid.split(':', 1)[1], mask)
    f = {'id': fid, 'file': rel, 'caption': caption, 'page': printed_page(ev, pdf_page), 'pdf_page': pdf_page, 'event': ev,
         'kind': kind, 'caption_source': caption_source, 'full_page': fullpage_file(ev, pdf_page), 'bbox_pt': bbox, 'px': list(size)}
    FIGS.append(f)
    for r in rules: link(r, fid)
    return fid
def link(rule_id, fid, inferred=None, uncertain=None):
    l = LINKS.setdefault(rule_id, [])
    if fid not in l: l.append(fid)
    if inferred: INFERRED.append((rule_id, fid, inferred))
    if uncertain: UNCERTAIN.append((rule_id, fid, uncertain))
def find_line(page, pat, after=0):
    for r, t in lines(page):
        if r.y0 >= after and re.search(pat, t): return r
    return None

# ---------------- Coal mine rescue ----------------
def coal():
    ev = 'mine-rescue'; doc = DOCS[ev]
    # Radio frequency table (PDF p8), part of rule "Rules Governing" 6
    p = doc[7]; t = find_line(p, r'National Mine Rescue Contest Radio Frequencies')
    tab = content(p, t.y0 - 1, 445)
    add(ev, 'mine-rescue:radio-frequencies', 8, tab, 'National Mine Rescue Contest Radio Frequencies', 'table', ['rules-governing-6'])
    # Drawings and Figures (PDF pp. 43-52): one figure per page, captions as printed (titles on pp. 43-46 and 50 are
    # part of the drawing image and were transcribed from it).
    figs = [(43, '1a', 'Figure 1(a) – PROPER METHOD OF ROOF TESTING'),
            (44, '1b', 'Figure 1(b) – PROPER METHOD OF ROOF TESTING (cont.)'),
            (45, '2a', 'Figure 2(a) – EXAMPLES OF PROPER METHODS OF SETTING ROOF SUPPORTS'),
            (46, '2b', 'Figure 2(b) – EXAMPLES OF PROPER METHODS OF SETTING ROOF SUPPORT THROUGH UNSAFE ROOF (Continued)'),
            (47, '3', 'Figure 3 – PROPER INSTALLATION OF ROOF SUPPORT TO RECOVER A PATIENT LOCATED UNDER AN AREA OF ELONGATED UNSAFE ROOF'),
            (48, '4', 'Figure 4 – EXTENT OF GASES'),
            (49, '5', 'Figure 5 – EXAMPLE OF INITIAL EXPLORATION AS PER RULE 29'),
            (50, '6', 'Figure 6 – Airlocking Through an Overcast Wall'),
            (51, '7', 'Figure 7 – RULE 44 "SYSTEMATIC EXPLORATION"'),
            (52, '8', 'FIGURE 8 – EXTENT OF GASES AT OVERCASTS')]
    F = {}
    for pg, n, cap in figs:
        F[n] = add(ev, f'mine-rescue:fig-{n}', pg, content(doc[pg - 1]), cap, 'figure', ['figures'], name=f'fig-{n}')
    # explicit references in the rule text
    for r, ns in [('b-card-23', ['1a', '1b']), ('b-card-24', ['4']), ('b-card-29', ['5']), ('b-card-30', ['2a', '2b', '3']),
                  ('b-card-32', ['3']), ('b-card-42', ['6'])]:
        for n in ns: link(r, F[n])
    link('b-card-44', F['7'], inferred='Figure 7 is titled "Rule 44 Systematic Exploration" / "Team stops numbered in accordance with Rule 44 D"; the rule text does not say "see Figure 7".')
    link('b-card-24', F['8'], uncertain='Figure 8 (Extent of Gases at Overcasts, new in 2026) is not cited by any rule. Linked to B-card 24 (gas tests, which cites Figure 4 "Extent of Gases") and B-card 42 (airlocking at overcasts, Figure 6).')
    link('b-card-42', F['8'], uncertain='See B-card 24: Figure 8 is uncited; placed with the overcast airlocking rule as related.')
    # Mine Map Legend (PDF pp. 53-57): one crop per legend page, plus one crop per symbol entry
    legend_pages = []
    sym = {}
    for k, pg in enumerate(range(53, 58)):
        page = doc[pg - 1]
        legend_pages.append(add(ev, f'mine-rescue:map-legend-{k+1}', pg, content(page), f'MINE MAP LEGEND (page {k+1} of 5)', 'map-legend',
                                ['figures'], name=f'map-legend-{k+1}', caption_source='printed title + page count'))
        for title, rect, mask in legend_entries(page):
            slug = ''
            for w in re.sub(r'[^a-z0-9]+', ' ', title.lower()).split():
                if len(slug) + len(w) + 1 > 40: break
                slug = f'{slug}-{w}' if slug else w
            sym[title] = add(ev, f'mine-rescue:symbol-{slug}', pg, rect, title, 'map-symbol', ['figures'], name=f'symbol-{slug}', mask=mask)
    for r in ['a-card-5', 'a-card-6']:
        for f in legend_pages: link(r, f)
    for r in ['b-card-44', 'b-card-48']:
        for f in legend_pages: link(r, f)
    def s(name): return next(v for k, v in sym.items() if k.startswith(name))
    # specific symbols named in the mapping rules
    for r in ['a-card-5', 'a-card-6']:
        link(r, s('LOCATION OF ANY OTHER OBJECTS'), inferred='Rule says objects not covered by the legend are indicated by the symbol "X" (legend: Location of any other objects, conditions, or equipment).')
        link(r, s('FARTHEST POINT OF ADVANCE'), inferred='Rule requires the farthest point of advance (FPA) to be shown on the map.')
    for name in ['SEAL', 'UNSAFE ROOF', 'WATER', 'CAVED']:
        link('b-card-44', s(name), inferred='Rule 44 "Inaccessible" lists seals, unsafe roof, water over knee deep and caved areas and says to use "only the conditions used in the legend".')
    for name in ['LINE CURTAIN', 'LINE CURTAIN INSTALLED', 'BRATTICE CLOTH']:
        link('b-card-48', s(name), inferred='Rule 48 E covers holding up brattice cloth vs. line curtain.')
    link('b-card-36', s('REFUGE ALTERNATIVE'), inferred='Legend entry "Refuge Alternative" states the contest RA rules and what is mapped inside it, matching B-card 36.')
    return sym

def legend_entries(page):
    """Split a legend page into symbol entries. Titles are the all-caps lines; each image is assigned to the
    title whose top is nearest; entries are contiguous vertical bands."""
    L = [(r, t) for r, t in lines(page) if not is_pagenum(r, t, page)]
    titles = []
    for r, t in L:
        if t in ('MINE MAP LEGEND',) or '%' in t or t.startswith('PPM'): continue
        letters = re.sub(r'[^A-Za-z]', '', t)
        if len(letters) >= 3 and letters.isupper() and r.x0 > 180:
            if titles and r.y0 - titles[-1][0].y1 < 8 and not titles[-1][1].endswith(('AIRTIGHT',)) or (titles and titles[-1][1].endswith((',', ' OR')) and r.y0 - titles[-1][0].y1 < 12):
                titles[-1] = (titles[-1][0] | r, titles[-1][1] + ' ' + t); continue
            titles.append((r, t))
    imgs = [pymupdf.Rect(i['bbox']) for i in page.get_image_info()]
    draws = [d['rect'] for d in page.get_drawings()]
    start = {k: r.y0 for k, (r, t) in enumerate(titles)}
    for im in imgs:
        k = min(range(len(titles)), key=lambda k: abs(titles[k][0].y0 - im.y0))
        start[k] = min(start[k], im.y0)
    out = []
    bottom = content(page).y1
    for k, (r, t) in enumerate(titles):
        y0 = start[k] - 2; y1 = (start[k + 1] - 3) if k + 1 < len(titles) else bottom + 1
        out.append((t.rstrip(','), content(page, y0, y1), foreign(page, y0, y1)))
    return out

# ---------------- First Aid ----------------
def first_aid():
    ev = 'first-aid'; doc = DOCS[ev]
    p = doc[12]
    img = max((pymupdf.Rect(i['bbox']) for i in p.get_image_info()), key=lambda r: r.get_area())
    tri = add(ev, 'first-aid:start-triage-algorithm', 13, img, 'START Triage Algorithm', 'flowchart', ['start-triage'],
              name='start-triage-algorithm', caption_source='section title (the chart itself has no printed caption)')
    for k in range(1, 5): link(f'first-aid-start-triage-{k}', tri, inferred='Triage category descriptions printed with the START triage chart.')
    link('first-aid-guidelines-16', tri, inferred='Rule requires teams to triage the accident scene.')
    link('first-aid-scorecard-a-23', tri, inferred='Discount for failing to determine immediate patients during triage.')
    link('first-aid-discounts-1', tri, uncertain='Rule only mentions "prior to starting triage" (call for help); chart linked for context.')
    # skill sheets: one crop per sheet per page
    r = json.load(open(f'{OUT}/rules-first-aid.json'))
    sheets = [it for s in r['sections'] if s['id'] == 'skill-sheets' for it in s['items']]
    def title_top(page):
        """(top y, printed title) of the skill sheet that starts on this page, or None."""
        L = lines(page)
        hi = next((k for k, (rr, t) in enumerate(L) if re.match(r'^PROCEDURES', t) and any('CRITICAL SKILLS' in t2 for r2, t2 in L if abs(r2.y0 - rr.y0) < 4)), None)
        if hi is None: return None
        j = hi; tl = []
        while j > 0:
            rr, t = L[j - 1]
            gap = L[j][0].y0 - rr.y1 if j < hi else L[hi][0].y0 - rr.y1
            if (t.upper() == t or '(Backboard)' in t) and len(t) < 70 and gap < (30 if j == hi else 14) and not t.startswith('NOTE'):
                tl.insert(0, (rr, t)); j -= 1
            else: break
        if not tl: return None
        return tl[0][0].y0, re.sub(r'\s+', ' ', ' '.join(t for _, t in tl)).strip()
    deleted = {29, 30, 31}   # struck-through sheet (Two-Rescuer CPR with AED, spinal injury)
    SK = {}
    for it in sheets:
        pdfs = [im['pdf_page'] for im in it['images']]
        crops = []
        for k, pg in enumerate(pdfs):
            page = doc[pg - 1]; tt = title_top(page)
            if k == 0:
                y0 = tt[0] if tt else 0; title = tt[1] if tt else it['title'].upper()
            else: y0 = 0
            nxt = None
            if k > 0 and tt: nxt = tt[0]          # another sheet starts on a continuation page
            crops.append((pg, y0, nxt))
        # continuation of this sheet at the top of the next sheet's first page (e.g. COLLAR BONE / SHOULDER BLADE notes)
        nx = pdfs[-1] + 1
        if nx <= len(doc) and nx not in deleted:
            tt = title_top(doc[nx - 1])
            if tt and tt[0] > 70 and not content(doc[nx - 1], 0, tt[0] - 2).is_empty and nx not in pdfs:
                crops.append((nx, 0, tt[0]))
        ids = []
        for k, (pg, y0, y1) in enumerate(crops):
            rect = content(doc[pg - 1], y0 - 2, (y1 - 3) if y1 else None)
            if pg == 22:   # sheet 1: the page starts with the general NOTE for all sheets; keep the sheet only
                rect = content(doc[pg - 1], y0 - 2)
            cap = title.title() if False else title
            cap = f'{title} (page {k+1} of {len(crops)})' if len(crops) > 1 else title
            ids.append(add(ev, f"first-aid:skill-{it['number']:02d}-{k+1}", pg, rect, cap, 'skill-sheet', [it['id']],
                           name=f"skill-{it['number']:02d}-{k+1}"))
        SK[it['title']] = ids
    def sk(prefix): return [f for t, v in SK.items() if t.startswith(prefix) for f in v]
    for f in sk('Patient Assessment'):
        for r in ['first-aid-start-triage-2', 'first-aid-start-triage-3']: link(r, f, inferred='Rule says "according to procedures of the patient assessment skill sheet".')
    for f in sk('Patient Assessment'): link('first-aid-start-triage-1', f, inferred='Rule says rapid patient assessment "according to the patient assessment skill sheet".')
    for f in sk('Two-Person Log Roll') + sk('Three-Person Log Roll'):
        for r in ['first-aid-guidelines-28', 'first-aid-scorecard-a-9']: link(r, f)
    for f in sk('Tourniquet'): link('first-aid-guidelines-29', f)
    for f in sk('Airway Obstruction'): link('first-aid-scorecard-b-general-12', f)
    for f in sk('Two-Rescuer CPR'): link('first-aid-scorecard-b-cpr-12', f)
    for f in sk('Initial Assessment'):
        link('first-aid-scorecard-b-general-1', f, uncertain='Rule cites the "Critical Skill Sheet" for determining unresponsiveness without naming a sheet; linked to Initial Assessment (Determine responsiveness/AVPU) and the CPR sheets.')
    for f in sk('One-Person CPR') + sk('Two-Rescuer CPR'):
        link('first-aid-scorecard-b-general-1', f)
    return SK

# ---------------- Bench events ----------------
def bench(ev):
    doc = DOCS[ev]
    r = json.load(open(f'{OUT}/{RULES_FILE[ev]}'))
    parts = json.load(open(f'{OUT}/parts.json'))['parts']
    drawings = []
    for t in [p for p in parts if p['event'] == ev]:
        pg = int(re.search(r'page-(\d+)', t['figure']).group(1)); page = doc[pg - 1]
        hdr = min((rr for rr, tx in lines(page) if 'Cons. No' in tx), key=lambda x: x.y0)
        # the little column numbers "1 2" sit just above the header
        nums = [rr for rr, tx in lines(page) if re.fullmatch(r'[12]', tx) and -4 < hdr.y0 - rr.y1 < 14 and rr.y0 < hdr.y0]
        top_tab = min([hdr.y0] + [n.y0 for n in nums])
        # table frame lines start a little above the header text
        frame = [d['rect'].y0 for d in page.get_drawings() if 0 <= top_tab - d['rect'].y0 < 14]
        top_tab = min([top_tab] + frame)
        draw = content(page, 0, top_tab - 3, clip=True); tab = content(page, top_tab - 1)
        cap = t['assembly'] or 'Test set / tool kit parts (no assembly title printed)'
        src = 'printed' if t['assembly'] else 'plain (no title printed)'
        num = t['id'].rsplit('-p', 1)[1]
        W, H = page.rect.width, page.rect.height
        d = add(ev, f'{ev}:parts-p{num}-drawing', pg, draw, cap, 'parts-drawing', [t['id']], name=f'parts-p{num}-drawing', caption_source=src,
                mask=[pymupdf.Rect(0, top_tab - 1.5, W, H)])
        tb = add(ev, f'{ev}:parts-p{num}-table', pg, tab, f'{cap} – Identification of Parts (Cons. No. / Designation)', 'parts-table', [t['id']],
                 name=f'parts-p{num}-table', caption_source='assembly title + table header', mask=[pymupdf.Rect(0, 0, W, top_tab - 3)])
        drawings.append(d)
    for d in drawings: link(f'{ev}-written-exam-1', d)
    # bench record form and judge's checklist
    for s in r['sections']:
        if s['id'] in ('bench-record', 'judges-checklist'):
            pg = int(re.search(r'page-(\d+)', s['images'][0]['file']).group(1)); page = doc[pg - 1]
            L = [t for rr, t in lines(page) if not is_pagenum(rr, t, page)]
            if s['id'] == 'bench-record':
                cap = next(t for t in L if 'Bench Record' in t)
                f = add(ev, f'{ev}:bench-record-form', pg, content(page), re.sub(r'\s+', ' ', cap).strip(), 'form', ['bench-record', f'{ev}-rules-governing-4'],
                        name='bench-record-form')
            else:
                f = add(ev, f'{ev}:judges-checklist', pg, content(page), "Judge’s Checklist", 'form', ['judges-checklist', f'{ev}-judges-checklist-1'],
                        name='judges-checklist', caption_source='plain (section title; the form has no separate caption)')
    if ev == 'bench-biopak':
        page = doc[9]
        t = find_line(page, r'Cylinder Pressure'); b = find_line(page, r'^2000-3000')
        rect = content(page, t.y0 - 1, b.y1 + 1, 60, 560)
        add(ev, 'bench-biopak:constant-flow-test-table', 10, rect, 'Constant flow test: cylinder pressure (PSI) vs. flow (LPM) at 0-5280 ft. and +5280 ft.',
            'table', ['bench-biopak-discount-interpretations-e-1'], name='constant-flow-test-table', caption_source='plain (table has no printed caption)')

# ---------------- Preshift ----------------
def preshift():
    ev = 'preshift'; doc = DOCS[ev]
    page = doc[4]; t = find_line(page, r'EXAMPLE OF DANGER SIGN')
    nxt = find_line(page, r'^14\.', t.y1)
    ds = add(ev, 'preshift:danger-sign-example', 5, content(page, t.y0 - 1, nxt.y0 - 3), 'EXAMPLE OF DANGER SIGN', 'figure', ['preshift-rules-governing-13'],
             name='danger-sign-example')
    link('preshift-field-scorecard-4', ds, inferred='Date, time and initials are required on danger signs; the example shows them.')
    page = doc[20]
    rr = add(ev, 'preshift:record-report', 21, content(page), 'PRESHIFT RECORD REPORT (Attachment #1)', 'form', ['record-report'], name='record-report',
             caption_source='printed ("ATTACHMENT #1" / "PRESHIFT RECORD REPORT")')
    link('preshift-rules-governing-15', rr)   # "See Attachment #1 on Page 21"
    for rid in ['preshift-rules-governing-1', 'preshift-rules-governing-4', 'preshift-rules-governing-17', 'preshift-rules-governing-19', 'preshift-preshift-record-1']:
        link(rid, rr, inferred='Rule refers to the Preshift Record Report form by name.')

# ---------------- write ----------------
def main():
    for f in glob.glob(f'{OUT}/figures/*/fig-*.png') + glob.glob(f'{OUT}/figures/*/symbol-*.png') + glob.glob(f'{OUT}/figures/*/map-legend-*.png') \
            + glob.glob(f'{OUT}/figures/*/skill-*.png') + glob.glob(f'{OUT}/figures/*/parts-p*.png'):
        os.remove(f)
    FIGS.clear(); LINKS.clear(); UNCERTAIN.clear(); INFERRED.clear()
    coal(); first_aid()
    for ev in ['bench-biopak', 'bench-bg4', 'bench-proair']: bench(ev)
    preshift()
    byid = {f['id']: f for f in FIGS}
    assert len(byid) == len(FIGS), 'duplicate figure ids'
    assert len({f['file'] for f in FIGS}) == len(FIGS), 'duplicate figure files'
    used = {}
    def entry(fid):
        f = byid[fid]
        return {'id': f['id'], 'file': f['file'], 'caption': f['caption'], 'page': f['page'], 'pdf_page': f['pdf_page'], 'kind': f['kind']}
    stats = {}
    for ev, fn in RULES_FILE.items():
        path = f'{OUT}/{fn}'; r = json.load(open(path))
        ids = set()
        for s in r['sections']:
            s.pop('figures', None)
            if s['id'] in LINKS and (not s.get('items') or s.get('images')):
                s['figures'] = [entry(f) for f in LINKS[s['id']] if byid[f]['event'] == ev]
                for f in LINKS[s['id']]: used.setdefault(f, []).append(f'section:{s["id"]}' if ev != 'mine-rescue' else f'section:{s["id"]}')
            for it in s.get('items', []):
                it.pop('figures', None)
                ids.add(it['id'])
                if it['id'] in LINKS:
                    it['figures'] = [entry(f) for f in LINKS[it['id']]]
                    for f in LINKS[it['id']]: used.setdefault(f, []).append(it['id'])
        missing = [k for k in LINKS if byid[LINKS[k][0]]['event'] == ev and k not in ids and k not in {s['id'] for s in r['sections']}]
        assert not missing, (ev, missing)
        json.dump(r, open(path, 'w'), indent=1, ensure_ascii=False)
        stats[ev] = {'rules_with_figures': sum(1 for s in r['sections'] for it in s.get('items', []) if it.get('figures')),
                     'sections_with_figures': sum(1 for s in r['sections'] if s.get('figures'))}
    # index: crops + the existing full-page images
    index = []
    for f in FIGS:
        index.append({k: f[k] for k in ('id', 'file', 'caption', 'page', 'pdf_page', 'event', 'kind', 'caption_source', 'full_page', 'bbox_pt', 'px')}
                     | {'rule_ids': [u for u in used.get(f['id'], []) if not u.startswith('section:')],
                        'section_ids': [u[8:] for u in used.get(f['id'], []) if u.startswith('section:')]})
    crop_of = {}
    for f in FIGS:
        if f['full_page']: crop_of.setdefault(f['full_page'], []).append(f['id'])
    for p in sorted(glob.glob(f'{OUT}/figures/**/page-*.png', recursive=True)):
        rel = os.path.relpath(p, OUT)
        m = re.match(r'figures/(?:([a-z0-9-]+)/)?page-(\d+)\.png', rel); ev = m.group(1) or 'mine-rescue'; pg = int(m.group(2))
        w, h = Image.open(p).size
        index.append({'id': f'{ev}:page-{pg:02d}', 'file': rel, 'caption': f'Rulebook page {printed_page(ev, pg)}', 'page': printed_page(ev, pg), 'pdf_page': pg,
                      'event': ev, 'kind': 'page', 'caption_source': 'plain', 'full_page': None, 'bbox_pt': None, 'px': [w, h],
                      'crops': crop_of.get(rel, []), 'rule_ids': [], 'section_ids': [],
                      'note': 'Full-page image kept for the existing "images" fields; not added to rule "figures" (the crops are).'})
    order = list(RULES_FILE)
    for ev in order:
        stats[ev]['figures'] = sum(1 for f in FIGS if f['event'] == ev)
        stats[ev]['page_images'] = sum(1 for f in index if f['event'] == ev and f['kind'] == 'page')
        stats[ev]['bytes'] = sum(os.path.getsize(f"{OUT}/{f['file']}") for f in index if f['event'] == ev)
    json.dump({'note': 'Every figure image in content/figures. kind: figure, table, flowchart, map-legend, map-symbol, skill-sheet, parts-drawing, parts-table, form '
                       '(cropped at 200 dpi from the 2026 MSHA PDFs) or page (the older full-page images). "page" is the printed rule-book page, "pdf_page" the PDF page. '
                       'rule_ids lists the rule items whose "figures" include it, in no particular order; display order is the order inside each rule\'s "figures". '
                       'caption_source says whether the caption is printed in the PDF or written plainly.',
               'count': len(index), 'count_crops': len(FIGS), 'stats': stats, 'figures': index},
              open(f'{OUT}/figures.json', 'w'), indent=1, ensure_ascii=False)
    report(stats, byid, used)
    print(json.dumps(stats, indent=1)); print('crops', len(FIGS), 'index', len(index))

def report(stats, byid, used):
    names = {'mine-rescue': 'Coal Mine Rescue', 'first-aid': 'First Aid', 'bench-biopak': 'Bench – BioPak 240-R', 'bench-bg4': 'Bench – BG-4',
             'bench-proair': 'Bench – BG ProAir', 'preshift': 'Preshift'}
    md = ['# Figures report (2026 MSHA coal contest rule books)\n',
          'Generated by `build_figures.py`. Figures are cropped at 200 dpi from the official PDFs; the older full-page images are kept. '
          'Crops show the PDF as printed, so struck-through (deleted) redline text inside a cropped area stays visible.\n',
          '| Event | Cropped figures | Full-page images | Rule items with figures | Sections with figures | Image size |', '|---|---|---|---|---|---|']
    for ev, s in stats.items():
        md.append(f"| {names[ev]} | {s['figures']} | {s['page_images']} | {s['rules_with_figures']} | {s['sections_with_figures']} | {s['bytes']/1048576:.1f} MB |")
    md.append('\n## Rules with figures\n')
    for ev, fn in RULES_FILE.items():
        r = json.load(open(f'{OUT}/{fn}'))
        md.append(f'\n### {names[ev]} (`{fn}`)\n')
        for s in r['sections']:
            if s.get('figures'): md.append(f"- **Section `{s['id']}`** ({s['title']}): " + '; '.join(f"{f['caption']} (p. {f['page']})" for f in s['figures']))
            for it in s.get('items', []):
                if it.get('figures'):
                    md.append(f"- `{it['id']}`: " + '; '.join(f"{f['caption']} (p. {f['page']})" for f in it['figures']))
    md.append('\n## Uncertain links (judgment calls, please review)\n')
    for r, f, why in UNCERTAIN: md.append(f"- `{r}` → {byid[f]['caption']}: {why}")
    md.append('\n## Links inferred from context (no explicit "see Figure" in the rule)\n')
    for r, f, why in INFERRED: md.append(f"- `{r}` → {byid[f]['caption']}: {why}")
    md.append('\n## Not captured\n')
    md.append('- Cover-page logos (PDF p. 1 of each rule book) are decorative and were skipped.')
    md.append('- First Aid PDF p. 14 (rulebook p. 11) is text only; its existing page image is kept but has no crop.')
    md.append('- First Aid PDF pp. 29–31: the "Two-Rescuer CPR with AED (With Spinal Injury – Manikin Only)" sheet is struck through in full (deleted for 2026) and was not cropped.')
    md.append('- The struck-through START triage table on First Aid PDF p. 13 (deleted in 2026) is not cropped; only the flowchart is.')
    unl = [f for f in byid if f not in used]
    if unl: md.append('\n## Figures not linked to any rule or section\n\n' + '\n'.join(f'- {byid[f]["caption"]} ({f})' for f in unl))
    open(f'{OUT}/figures-report.md', 'w').write('\n'.join(md) + '\n')

if __name__ == '__main__': main()
