"""Build statements of fact + rules for the other 2026 MSHA coal contest events
(First Aid, Bench BioPak 240-R, Bench BG-4, Bench BG ProAir, Preshift) and merge them with the
coal mine rescue content produced by build.py. Run build.py first, then this script.
Strike-through (deleted) redline text is removed by redline.py (red glyphs crossed by a strike rule)."""
import json, re, os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from redline import clean_pages
ROOT='/workspace/mine-rescue'; SRC=f'{ROOT}/sources'; OUT=f'{ROOT}/content'; WORK=f'{ROOT}/work'
BASE='https://www.msha.gov/sites/default/files/Mine%20Rescue/'
INDEX='https://www.msha.gov/training/mine-rescue-training/mine-rescue-contests/2026-unified-mine-rescue-rules-and'
EVENTS={
 'first-aid':{'pdf':'III-2026_First_Aid_Rules.pdf','url':BASE+'III-2026%20First%20Aid%20Rules.pdf','doc_id':'msha-2026-first-aid-rules',
   'title':'2026 First Aid Rules (Section III of the 2026 Unified Mine Rescue Rules)','edition':'2026, "Approved 1/6/2026"','name':'First Aid',
   'fact_section':'First Aid Statements of Fact','fact_prefix':'first-aid-sof'},
 'bench-biopak':{'pdf':'IV-2026_Bio_240R_Bench_Rules.pdf','url':BASE+'IV-2026%20Bio%20240R%20Bench%20Rules.pdf','doc_id':'msha-2026-bench-biopak-240r-rules',
   'title':'2026 Bench Rules – Bio 240-R (Section IV of the 2026 Unified Mine Rescue Rules)','edition':'2026, "Approved – 1/5/2026"','name':'Bench – BioPak 240-R',
   'fact_section':'BioPak 240-R Bench Statements of Fact','fact_prefix':'bench-biopak-sof'},
 'bench-bg4':{'pdf':'V-2026_BG-4_Bench_Rules.pdf','url':BASE+'V-2026%20BG-4%20Bench%20Rules.pdf','doc_id':'msha-2026-bench-bg4-rules',
   'title':'2026 Bench Rules – BG-4 (Section V of the 2026 Unified Mine Rescue Rules)','edition':'2026, "Approved – 1/5/2026"','name':'Bench – Dräger BG-4',
   'fact_section':'BG-4 Bench Statements of Fact','fact_prefix':'bench-bg4-sof'},
 'bench-proair':{'pdf':'VI-2026_LDV_BG-ProAir_Bench_Rules.pdf','url':BASE+'VI-2026%20LDV%20BG-ProAir%20Bench%20Rules.pdf','doc_id':'msha-2026-bench-bg-proair-rules',
   'title':'2026 Bench Rules – BG ProAir on Demand Oxygen Dosage (Section VI of the 2026 Unified Mine Rescue Rules)','edition':'2026, "Approved – 1/5/2026"','name':'Bench – Dräger BG ProAir',
   'fact_section':'BG-ProAir Bench Statements of Fact','fact_prefix':'bench-proair-sof'},
 'preshift':{'pdf':'VII-2026_Preshift_Rules.pdf','url':BASE+'VII-2026%20Preshift%20Rules.pdf','doc_id':'msha-2026-preshift-rules',
   'title':'2026 Preshift Rules (Section VII of the 2026 Unified Mine Rescue Rules)','edition':'2026, "Approved – 11/10/2025"','name':'Preshift',
   'fact_section':'Statements of Fact Preshift Contest','fact_prefix':'preshift-sof'},
}
def tidy(s,punct=True):
    """Whitespace-only normalisation (deleted redline words leave gaps)."""
    s=re.sub(r'[ \t]{2,}',' ',s)
    if not punct: return s.strip()
    s=re.sub(r' +([.,;:)])',r'\1',s); s=re.sub(r'\( +','(',s)
    return s.strip()

# ---------- load cleaned pages ----------
def load(ev):
    base=os.path.splitext(EVENTS[ev]['pdf'])[0]
    cache=f'{WORK}/{base}.clean.json'
    if os.path.exists(cache) and os.path.getmtime(cache)>os.path.getmtime(f'{ROOT}/redline.py'):
        d=json.load(open(cache))
    else:
        pages,struck=clean_pages(f"{SRC}/{EVENTS[ev]['pdf']}"); d={'pages':pages,'struck':struck}
        json.dump(d,open(cache,'w'),ensure_ascii=False)
    L=[]; printed={}
    for pg in d['pages']:
        ls=pg['lines']
        if ls and re.fullmatch(r'\d{1,3}',ls[-1]['text'].strip()):
            printed[pg['pdf_page']]=int(ls[-1]['text']); ls=ls[:-1]
        for l in ls: L.append({'pg':pg['pdf_page'],'x0':l['x0'],'t':l['text'],'top':l['top']})
    return L,printed,d['struck']

# ---------- statements of fact ----------
REF={
 'first-aid':re.compile(r'\s(Ch\.\s?-.*)$'),
 'bench-biopak':re.compile(r'\s?(\((?:User|Users|USER|Benchman|Remote)[^()]*\)|\(\s*\n?User[^()]*\))\s*$'),
 'preshift':re.compile(r'\s(\((?:\d+\s?CFR|30CFR|MSHA|Mine Act|Miner).*)$'),
}
def facts_for(ev,L,printed):
    cfg=EVENTS[ev]
    head={'first-aid':r'^FIRST AID STATEMENTS OF FACT','bench-biopak':r'^BIOPAK 240-R BENCH STATEMENTS OF FACT',
          'bench-bg4':r'^BG-4 BENCH STATEMENTS OF FACT','bench-proair':r'^BG-PROAIR BENCH STATEMENTS OF FACT','preshift':r'^STATEMENTS OF FACT PRESHIFT CONTEST'}[ev]
    i0=next(i for i,l in enumerate(L) if re.search(head,l['t'].strip()) and l['pg']>3)
    parts_pages={l['pg'] for l in L if re.match(r'^Cons\. No\.',l['t'].strip())}
    items=[];cur=None;exp=1
    for l in L[i0+1:]:
        t=l['t'].strip()
        if l['pg'] in parts_pages: break
        if re.match(r'^(NOTE: The References|ATTACHMENT)',t): break
        if cur and l['pg']!=cur['pg_last'] and ev.startswith('bench') and re.match(r'^(1\s+2(\s+1\s+2)?|Cons\. No\.)',t): break
        if cur and l['pg']>cur['pg_last']+1: break
        m=re.match(r'^(\d{1,3})\.\s*(\S.*)?$',t)
        if m and int(m.group(1))==exp:
            if cur: items.append(cur)
            cur={'n':exp,'lines':[m.group(2) or ''],'pg':l['pg'],'pg_last':l['pg']};exp+=1;continue
        if cur and t and t!='.':
            cur['lines'].append(t); cur['pg_last']=l['pg']
    if cur: items.append(cur)
    out=[]
    for it in items:
        # join: after a line ending in ':' keep list lines on their own lines
        txt='';listmode=False
        for k,s in enumerate(it['lines']):
            if not txt: txt=s
            elif listmode: txt+='\n'+s
            elif txt.endswith('-') and not txt.endswith(' -') and not re.search(r'\d-$',txt): txt+=s
            else: txt+=' '+s
            if s.endswith(':') and s.count('(')==s.count(')'): listmode=True
        txt='\n'.join(tidy(x,punct=False) for x in txt.split('\n'))
        f={'id':f"{cfg['fact_prefix']}-{it['n']:03d}",'number':it['n'],'text':txt,'section':cfg['fact_section'],
           'category':None,'page':printed.get(it['pg']),'source':cfg['doc_id'],'event':ev}
        r=REF.get(ev)
        mm=r.search(txt) if r else None
        f['reference']=mm.group(1).strip() if mm else None
        out.append(f)
    return out

# ---------- rules ----------
MARK=re.compile(r'^\s*(\(?[0-9]{1,2}[.)]|[A-Za-z][.)]|NOTE:|•|□)\s')
def reflow(ls):
    """ls: list of (indent_spaces, text). Join wrapped lines into paragraphs (same logic as build.py)."""
    ls=[(i,t) for i,t in ls]
    while ls and not ls[0][1].strip(): ls.pop(0)
    if not ls: return ''
    ind=min(i for i,t in ls if t.strip())
    width=max(len(t) for i,t in ls)
    paras=[];cur='';prev=None
    END=re.compile(r'([.:;)”"!?]|\d)\s*$')
    for i,t in ls:
        s=t.strip()
        if not s: continue
        line=' '*(i-ind)+s
        table=len(re.findall(r'\S\s{3,}\S',s))>=2
        ended= prev is not None and END.search(prev)
        newp=(cur=='' or MARK.match(line) or table or (prev is not None and len(re.findall(r'\S\s{3,}\S',prev))>=2)
              or (ended and len(prev)<0.72*width))
        piece=' | '.join(re.split(r'\s{3,}',s)) if table else re.sub(r'\s{2,}',' ',s)
        if newp and cur: paras.append(cur); cur=''
        if cur and cur.endswith('-') and not cur.endswith(' -'): cur+=piece
        else: cur=(cur+' '+piece) if cur else piece
        prev=s
    if cur: paras.append(cur)
    return '\n'.join(tidy(p) for p in paras)
def pre(ls):
    """Preformatted verbatim block (skill sheets, forms): keep line structure and relative indent."""
    if not ls: return ''
    ind=min(int(l['x0']/6) for l in ls)
    return '\n'.join((' '*(int(l['x0']/6)-ind)+re.sub(r' {5,}','    ',l['t'].strip())).rstrip() for l in ls if l['t'].strip())
def smart_title(t):
    small={'and','of','or','the','to','with','on','in','a','for'}
    w=t.title().split(' ')
    w=[x.lower() if k and x.lower() in small else x for k,x in enumerate(w)]
    t=' '.join(w)
    for a,b in [('Cpr','CPR'),('Aed','AED'),('Csm','CSM')]: t=re.sub(r'\b'+a+r'\b',b,t)
    return t
def pr(printed,pgs):
    ps=sorted(p for p in set(pgs) if p in printed)
    return [printed[ps[0]],printed[ps[-1]]] if ps else None
def numbered_section(sid,title,lines,printed,ev,group_pat=None,intro_ok=True):
    """Split lines into top-level numbered items. Base indent = x0 of first '1.' line; only the expected
    next number at (about) that indent starts a new item, so nested 1./A. lists stay inside their parent."""
    first=next((l for l in lines if re.match(r'^1\.\s',l['t'].strip())),None)
    base=first['x0'] if first else 0
    items=[];intro=[];cur=None;exp=1;group=None;gexp=0
    for l in lines:
        t=l['t'].strip()
        if group_pat:
            g=re.match(group_pat,t)
            if g and g.group(1)==chr(ord('A')+gexp) and l['x0']<base-4:
                gexp+=1; group={'letter':g.group(1),'title':tidy(g.group(2))}
                if cur: items.append(cur); cur=None
                exp=1; continue
        m=re.match(r'^(\d{1,2})\.\s*(.*)$',t)
        if m and int(m.group(1))==exp and abs(l['x0']-base)<30:
            if cur: items.append(cur)
            cur={'n':exp,'lines':[(int(l['x0']/6)+4,m.group(2))],'pgs':[l['pg']],'group':group};exp+=1;continue
        if cur: cur['lines'].append((int(l['x0']/6),t)); cur['pgs'].append(l['pg'])
        elif group is not None:
            cur={'n':group['letter'],'lines':[(int(l['x0']/6),t)],'pgs':[l['pg']],'group':group,'grouptext':True}
        else: intro.append((int(l['x0']/6),t))
    if cur: items.append(cur)
    s={'id':sid,'title':title,'event':ev,'pages':pr(printed,[l['pg'] for l in lines])}
    it_intro=reflow(intro)
    if it_intro: s['intro']=it_intro
    s['items']=[]
    gcount={}
    for it in items:
        key=(it['group'] or {}).get('letter','')
        if it.get('grouptext'):
            s['items'].append({'id':f"{ev}-{sid}-{key.lower()}",'number':key,'title':it['group']['title'],'text':reflow(it['lines']),'pages':pr(printed,it['pgs']),'event':ev,'group':it['group']}); continue
        r={'id':f"{ev}-{sid}-{(key.lower()+'-') if key else ''}{it['n']}",'number':it['n'],'text':reflow(it['lines']),'pages':pr(printed,it['pgs']),'event':ev}
        if it['group']: r['group']=it['group']
        s['items'].append(r)
    return s
def find(L,pat,start=0,minpg=3):
    for i in range(start,len(L)):
        if L[i]['pg']>=minpg and re.search(pat,L[i]['t'].strip()): return i
    raise SystemExit(f'not found: {pat}')
def figures(ev,pdf,pages,printed,res=100):
    d=f'{OUT}/figures/{ev}'; os.makedirs(d,exist_ok=True)
    out=[]
    for p in pages:
        f=f'{d}/page-{p:02d}.png'
        if not os.path.exists(f):
            subprocess.run(['pdftoppm','-r',str(res),'-png','-singlefile','-f',str(p),'-l',str(p),f'{SRC}/{pdf}',f[:-4]],check=True)
        out.append({'file':f'figures/{ev}/page-{p:02d}.png','pdf_page':p,'printed_page':printed.get(p)})
    return out

def parts_for(ev,L,printed):
    """Identification of Parts tables: title line, then rows of (Cons. No., Designation) pairs in 1 or 2 columns."""
    parts=[];by_pg={}
    for l in L: by_pg.setdefault(l['pg'],[]).append(l)
    for pg in sorted(by_pg):
        ls=by_pg[pg]
        if not any(re.match(r'^Cons\. No\.',l['t'].strip()) for l in ls): continue
        hi=next(i for i,l in enumerate(ls) if re.match(r'^Cons\. No\.',l['t'].strip()))
        title=' '.join(l['t'].strip() for l in ls[:hi] if not re.fullmatch(r'[12\s]+',l['t'].strip())) or None
        CN=r'\d{1,3}(\.\d)?(-\d{1,3}(\.\d)?)?[a-z]?(, \d{1,3}(-\d{1,3})?)*'
        left=[];right=[]
        for l in ls[hi+1:]:
            segs=[s_.strip() for s_ in re.split(r'\s{4,}',l['t'].strip()) if s_.strip()]
            pairs=[];k=0
            # a deleted word can merge "11" and its designation into one segment ("11 Reaction Ring")
            ex=[]
            for sg in segs:
                m_=re.match(r'^(\d{1,3}) ([A-Za-z].*)$',sg)
                if m_ and (not ex or not re.fullmatch(CN,ex[-1])): ex+= [m_.group(1),m_.group(2)]
                else: ex.append(sg)
            segs=ex
            while k<len(segs):
                if re.fullmatch(CN,segs[k]) and k+1<len(segs) and not re.fullmatch(CN,segs[k+1]):
                    pairs.append({'cons_no':segs[k],'designation':tidy(segs[k+1])}); k+=2
                else:
                    tgt=(pairs or right or left)
                    if tgt: tgt[-1]['designation']=tidy(tgt[-1]['designation']+' '+segs[k])
                    k+=1
            if len(pairs)>=2: left.append(pairs[0]); right.extend(pairs[1:])
            elif len(pairs)==1: (left if l['x0']<200 else right).append(pairs[0])
        rows=left+right
        if not title and ev=='bench-proair' and rows and 'Test Set' in rows[0]['designation']:
            title=None; note='No assembly title is printed on this page; the parts are the BG ProAir test set / tool kit.'
        else: note=None
        parts.append({'id':f'{ev}-parts-p{printed.get(pg,pg)}','event':ev,'assembly':title,'title_note':note,'page':printed.get(pg),
                      'figure':f'figures/{ev}/page-{pg:02d}.png','parts':rows})
    return parts

def rules_for(ev,L,printed,struck):
    cfg=EVENTS[ev]; secs=[]
    def rng(a,b): return L[a:b]
    if ev=='preshift':
        a=find(L,r'^RULES GOVERNING 2026 PRESHIFT CONTEST'); b=find(L,r'^INTERPRETATION OF THE FIELD SCORECARD',a+1)
        c=find(L,r'^INTERPRETATION OF THE PRESHIFT RECORD',b+1); dd=find(L,r'^STATEMENTS OF FACT PRESHIFT',c+1)
        secs.append(numbered_section('rules-governing','Rules Governing 2026 Preshift Contest and Interpretations of Discount Cards',rng(a+2,b),printed,ev))
        secs.append(numbered_section('field-scorecard','Interpretation of the Field Scorecard',rng(b+1,c),printed,ev))
        secs.append(numbered_section('preshift-record','Interpretation of the Preshift Record',rng(c+1,dd),printed,ev))
        secs.append({'id':'record-report','title':'Preshift Record Report (Attachment #1)','event':ev,'pages':[21,21],
                     'note':'Blank standardized Preshift Record Report form (page image). Also published separately: '+BASE+'2026%20PRESHIFT%20RECORD%20REPORT%20-%20BLANK.pdf',
                     'images':figures(ev,cfg['pdf'],[21],printed),'items':[]})
    elif ev.startswith('bench'):
        a=find(L,r'^RULES GOVERNING 2026 BENCH'); w=find(L,r'^A\.\s+Written Examination of Bench',a)
        mi=find(L,r'^B\.\s+Miscellaneous',w); di=find(L,r'^Interpretations? of Discount Sheet',mi)
        rec=find(L,r'Bench Record \(Optional\)',di); sof=find(L,r'BENCH STATEMENTS OF FACT',rec)
        hdr=a+1
        while not re.match(r'^1\.',L[hdr]['t'].strip()): hdr+=1
        secs.append(numbered_section('rules-governing',tidy(' '.join(l['t'] for l in L[a:hdr])).title().replace('Bg','BG').replace('Biopak','BioPak').replace('240-R','240-R'),rng(hdr,w),printed,ev))
        secs.append(numbered_section('written-exam','A. Written Examination of Bench Participant',rng(w+1,mi),printed,ev))
        secs.append(numbered_section('misc','B. Miscellaneous',rng(mi+1,di),printed,ev))
        secs.append(numbered_section('discount-interpretations','Interpretations of Discount Sheet',rng(di+1,rec),printed,ev,group_pat=r'^([A-H])\.\s+(.+)$'))
        recpg=L[rec]['pg']
        secs.append({'id':'bench-record','title':'Bench Record (Optional)','event':ev,'pages':pr(printed,[recpg]),'note':'Optional bench record form (page image).','images':figures(ev,cfg['pdf'],[recpg],printed),'items':[]})
        last=max(l['pg'] for l in L); 
        secs.append({'id':'judges-checklist','title':"Judge’s Checklist",'event':ev,'pages':pr(printed,[last]) or None,'note':'Judge’s checklist form (page image; text below is the extracted form text).',
                     'images':figures(ev,cfg['pdf'],[last],printed),'items':[{'id':f'{ev}-judges-checklist-1','number':1,'title':'Checklist text','text':pre([l for l in L if l['pg']==last]),'format':'pre','pages':pr(printed,[last]),'event':ev}]})
    elif ev=='first-aid':
        gi=find(L,r'^GENERAL RULES$'); mi=find(L,r'^REQUIRED MATERIALS LIST',gi); gp=find(L,r'^GUIDELINES AND PROCEDURES',mi)
        ti=find(L,r'^TIES$',gp); we=find(L,r'^WRITTEN EXAMINATION$',ti); ap=find(L,r'^APPEALS$',we); dc=find(L,r'^DISCOUNTS$',ap)
        tr=next(i for i in range(dc,len(L)) if L[i]['pg']>L[dc]['pg'])  # START triage pages
        sa=find(L,r'^SCORECARD A DISCOUNTS',tr); sb=find(L,r'^INTERPRETATIONS OF SCORECARD B',sa)
        cpr=find(L,r'^Cardiopulmonary Resuscitation$',sb); av=find(L,r'^Artificial Ventilation$',cpr)
        sk=next(i for i in range(av,len(L)) if L[i]['pg']>L[av]['pg'])
        sof=find(L,r'^FIRST AID STATEMENTS OF FACT',sk)
        # General rules 1-3 continue after the materials list (4-5)
        gen=numbered_section('general','General Rules',rng(gi+1,mi)+[l for l in rng(mi+1,gp) if l['pg']>L[mi]['pg']],printed,ev)
        secs.append(gen)
        mat=[l for l in rng(mi+1,gp) if l['pg']==L[mi]['pg']]
        secs.append({'id':'materials','title':'Required Materials List','event':ev,'pages':pr(printed,[l['pg'] for l in mat]),
                     'items':[{'id':f'{ev}-materials-1','number':1,'title':'Required Materials List','text':pre(mat),'format':'pre','pages':pr(printed,[l['pg'] for l in mat]),'event':ev}]})
        secs.append(numbered_section('guidelines','Guidelines and Procedures',rng(gp+1,ti),printed,ev))
        secs.append({'id':'ties','title':'Ties','event':ev,'pages':pr(printed,[L[ti]['pg']]),'intro':reflow([(int(l['x0']/6),l['t']) for l in rng(ti+1,we)]),'items':[]})
        secs.append(numbered_section('written-exam','Written Examination',rng(we+1,ap),printed,ev))
        secs.append(numbered_section('appeals','Appeals',rng(ap+1,dc),printed,ev))
        secs.append(numbered_section('discounts','Discounts',rng(dc+1,tr),printed,ev))
        trl=rng(tr,sa); trp=sorted(set(l['pg'] for l in trl))
        tri={'id':'start-triage','title':'START Triage Algorithm','event':ev,'pages':pr(printed,trp),
             'note':'The 2026 redline deleted the START triage table (text struck through); the page now shows the triage flowchart (image). Category descriptions follow.',
             'images':figures(ev,cfg['pdf'],trp,printed),'items':[]}
        cats=[];cur=None
        for l in trl:
            t=l['t'].strip()
            if re.fullmatch(r'IMMEDIATE|DELAYED|MINOR|DECEASED',t): cur={'title':t,'lines':[]}; cats.append(cur)
            elif cur: cur['lines'].append((int(l['x0']/6),t))
            else: tri.setdefault('intro_lines',[]).append((int(l['x0']/6),t))
        if tri.get('intro_lines'): tri['intro']=reflow(tri.pop('intro_lines'))
        for k,c in enumerate(cats): tri['items'].append({'id':f'{ev}-start-triage-{k+1}','number':k+1,'title':c['title'],'text':reflow(c['lines']),'event':ev,'pages':tri['pages']})
        secs.append(tri)
        secs.append(numbered_section('scorecard-a','Scorecard A Discounts',rng(sa+1,sb),printed,ev))
        secs.append(numbered_section('scorecard-b-general','Interpretations of Scorecard B – Artificial Ventilation/Cardiopulmonary Resuscitation',rng(sb+2,cpr),printed,ev))
        secs.append(numbered_section('scorecard-b-cpr','Interpretations of Scorecard B – Cardiopulmonary Resuscitation',rng(cpr+1,av),printed,ev))
        secs.append(numbered_section('scorecard-b-av','Interpretations of Scorecard B – Artificial Ventilation',rng(av+1,sk),printed,ev))
        # skill sheets: start where a page has a 'PROCEDURES  CRITICAL SKILLS' header; title = lines above it on that page
        skl=rng(sk,sof); sheets=[]; note=[]
        bypg={}
        for l in skl: bypg.setdefault(l['pg'],[]).append(l)
        for pg in sorted(bypg):
            ls=bypg[pg]
            hi=next((i for i,l in enumerate(ls) if re.match(r'^PROCEDURES\s+CRITICAL SKILLS',l['t'].strip())),None)
            if hi is None:
                if sheets and any(l['t'].strip() for l in ls): sheets[-1]['lines']+=ls; sheets[-1]['pgs'].append(pg)
                continue
            # title lines: all-caps lines directly above header (after any NOTE paragraph)
            j=hi
            while j>0 and (ls[j-1]['t'].strip().upper()==ls[j-1]['t'].strip() or re.search(r'\(Backboard\)',ls[j-1]['t'])) and len(ls[j-1]['t'].strip())<70 and ls[j]['top']-ls[j-1]['top']<(45 if j==hi else 22): j-=1
            pre_lines=ls[:j]
            if pre_lines:
                if sheets: sheets[-1]['lines']+=pre_lines
                else: note+=pre_lines
            sheets.append({'title':tidy(' '.join(l['t'].strip() for l in ls[j:hi])),'lines':ls[hi:],'pgs':[pg]})
        ss={'id':'skill-sheets','title':'Skill Sheets (Procedures and Critical Skills)','event':ev,'pages':pr(printed,[l['pg'] for l in skl]),
            'intro':reflow([(int(l['x0']/6),l['t']) for l in note]),
            'note':'Skill sheets are two-column tables (procedure | critical skills, with □ check boxes; * = verbalize when not using moulage, ** = verbalize at all contests). Text is kept line-by-line as printed (format "pre"); each sheet also has page images. The 2026 redline deleted the "Two-Rescuer CPR with AED (With Spinal Injury – Manikin Only)" sheet entirely (PDF pp. 29–31 are struck through), even though the index still lists it.',
            'items':[]}
        for k,s in enumerate(sheets):
            if not s['lines'] or all(re.match(r'^PROCEDURES',l['t'].strip()) for l in s['lines']): continue
            ss['items'].append({'id':f'{ev}-skill-{k+1}','number':len(ss['items'])+1,'title':smart_title(s['title']),
                                'text':pre(s['lines']),'format':'pre','pages':pr(printed,s['pgs']),'event':ev,
                                'images':figures(ev,cfg['pdf'],sorted(set(s['pgs'])),printed)})
        secs.append(ss)
    return secs

# ---------- exam formats (as stated in the rules) ----------
EXAM={
 'mine-rescue':{'questions':10,'format':'multiple choice, three choices','source_rule':'Written Examination rules 1–5 (2026 Coal Mine Rescue Rules p. 7)',
   'detail':'Ten statements of fact taken verbatim from the contest rules; multiple choice with three choices (2026 deleted the fill-in-the-blank option).'},
 'first-aid':{'questions':15,'format':'multiple choice, three choices','time_limit_min':20,'source_rule':'First Aid Written Examination rules 2–4 (p. 7)',
   'detail':'15 multiple-choice questions taken from the First Aid Statements of Fact; each question has a blank for a key word (no more than two consecutive blanks); three choices; no "none of the above"; 20 minutes; taken by the three working team members.'},
 'bench-biopak':{'questions':20,'from_statements_of_fact':10,'from_identification_of_parts':10,'format':'multiple choice, three choices (statements of fact); parts questions verbatim from Identification of Parts','time_limit_min':20,'source_rule':'Bench rules A.1 (p. 5)',
   'detail':'20 questions: 10 from the Statements of Fact (multiple choice, three choices, key-word blanks, max two consecutive blanks) and 10 verbatim from Identification of Parts; numbers may be written out or numeric; no "none of the above"; 20 minutes.'},
 'bench-bg4':{'questions':20,'from_statements_of_fact':10,'from_identification_of_parts':10,'format':'multiple choice, three choices (statements of fact); parts questions verbatim from Identification of Parts','time_limit_min':20,'source_rule':'Bench rules A.1 (p. 3)',
   'detail':'Same format as the BioPak bench: 10 SOF questions (multiple choice, three choices) + 10 verbatim from Identification of Parts; 20 minutes.'},
 'bench-proair':{'questions':20,'from_statements_of_fact':10,'from_identification_of_parts':10,'format':'multiple choice, three choices (statements of fact); parts questions verbatim from Identification of Parts','time_limit_min':20,'source_rule':'Bench rules A.1 (p. 3)',
   'detail':'Same format as the BioPak bench: 10 SOF questions (multiple choice, three choices) + 10 verbatim from Identification of Parts; 20 minutes.'},
 'preshift':{'questions':10,'format':'multiple choice, three choices','time_limit_min':15,'source_rule':'Preshift rule 6 (p. 3–4)',
   'detail':'10 multiple-choice questions with three choices taken verbatim from the published statements of fact; each has a key-word blank (max two consecutive blanks; keywords cannot be shall/must/should); no "none of the above"; 15 minutes; one point per incorrect statement.'},
}

def main():
    os.makedirs(WORK,exist_ok=True)
    coal=json.load(open(f'{OUT}/facts.json'))
    # Prefer the coal-only facts (source id) so a re-run of this script alone does not
    # re-tag the already-merged multi-event facts.json as mine-rescue.
    coal_facts=[f for f in coal['facts'] if f.get('source')=='msha-2026-coal-mr-rules' or f.get('event') in (None,'mine-rescue') and f.get('id','').startswith('coal-mr-sof-')]
    if not coal_facts or len(coal_facts)!=200:
        raise SystemExit(f'expected 200 coal mine rescue facts from build.py, got {len(coal_facts)}; run build.py first')
    for f in coal_facts: f['event']='mine-rescue'; f.setdefault('reference',None)
    all_facts=list(coal_facts); docs={coal['document']['id']:{**coal['document'],'event':'mine-rescue'}}
    allparts=[]; report={}
    for ev,cfg in EVENTS.items():
        L,printed,struck=load(ev)
        F=facts_for(ev,L,printed)
        # Orphaned punctuation left by a deletion at the very start of a statement (FA SOF 1: "~~Pertussis~~, Covid-19, ...")
        for f in F:
            if f['text'].startswith(', '): f['text']=f['text'][2:]; f['edit_note']='Leading word deleted in the 2026 redline; the orphaned comma before it was dropped.'
        NOTES={('first-aid',71):'As printed, the statement ends with a stray "providing" after "2 breaths." (an apparent leftover from the redline edit "proving" → "providing").',
               ('first-aid',91):'As printed, the statement ends with "intention not intervention." (an apparent editor\'s note left from the redline edit "intervention" → "intention").',
               ('first-aid',90):'Double comma ("only, ,") is as printed.'}
        for f in F:
            if (ev,f['number']) in NOTES: f['edit_note']=NOTES[(ev,f['number'])]
        all_facts+=F
        docs[cfg['doc_id']]={'id':cfg['doc_id'],'title':cfg['title'],'edition':cfg['edition'],'publisher':'MSHA (2026 Unified Mine Rescue Rules and Resources; rules developed by the Holmes Mine Rescue Association rules sub-committees)','url':cfg['url'],'index_url':INDEX,'event':ev}
        secs=rules_for(ev,L,printed,struck)
        parts=parts_for(ev,L,printed) if ev.startswith('bench') else []
        if parts:
            pg_list=[]
            for p in parts:
                pdfpg=int(re.search(r'page-(\d+)',p['figure']).group(1)); pg_list.append(pdfpg)
            figures(ev,cfg['pdf'],pg_list,printed)
            allparts+=parts
            secs.insert(len(secs)-1,{'id':'identification-of-parts','title':'Identification of Parts','event':ev,'pages':[min(p['page'] for p in parts),max(p['page'] for p in parts)],
               'note':f'Parts diagrams (page images) with their Cons. No./Designation tables. Structured tables are in parts.json. Ten of the 20 bench written-exam questions are taken verbatim from these.',
               'items':[{'id':p['id'],'number':k+1,'title':p['assembly'] or f"(no title printed, p. {p['page']}: test set parts)",'text':'\n'.join(f"{r['cons_no']}  {r['designation']}" for r in p['parts']),'format':'pre','pages':[p['page'],p['page']],'event':ev,
                         'images':[{'file':p['figure'],'printed_page':p['page']}]} for k,p in enumerate(parts)]})
        rules={'document':docs[cfg['doc_id']],'event':ev,'generated':'2026-10-15',
               'redline_note':'The official PDF is a redline: red text is new for 2026 and red struck-through text is deleted. Deleted text was removed automatically (red glyphs crossed by a strike rule); additions are kept. Deletions removed: '+'; '.join(f"PDF p{s['pdf_page']}: “{' '.join(s['deleted'])[:160]}{'…' if len(' '.join(s['deleted']))>160 else ''}”" for s in struck),
               'written_exam':EXAM[ev],'sections':secs}
        json.dump(rules,open(f'{OUT}/rules-{ev}.json','w'),indent=1,ensure_ascii=False)
        write_rules_md(rules,f'{OUT}/rules-{ev}.md')
        report[ev]={'facts':len(F),'last':F[-1]['number'],'sections':[(s['id'],len(s.get('items',[]))) for s in secs],'parts_tables':len(parts),'parts_rows':sum(len(p['parts']) for p in parts)}
    # rules.json (coal): tag with event
    r=json.load(open(f'{OUT}/rules.json'))
    r['event']='mine-rescue'; r['written_exam']=EXAM['mine-rescue']
    for s in r['sections']:
        s['event']='mine-rescue'
        for it in s.get('items',[]): it['event']='mine-rescue'
    json.dump(r,open(f'{OUT}/rules.json','w'),indent=1,ensure_ascii=False)
    # facts.json (all events). NOTE: 'facts' must be the first array-valued key (the app's copy-content counts the first array).
    order=['mine-rescue']+list(EVENTS)
    names={'mine-rescue':'Coal Mine Rescue',**{k:v['name'] for k,v in EVENTS.items()}}
    counts={e:sum(1 for f in all_facts if f['event']==e) for e in order}
    out={'document':{'id':'msha-2026-unified-mine-rescue-rules-coal','title':'2026 Unified Mine Rescue Rules – coal contest events (MSHA)','edition':'2026','publisher':'MSHA','url':INDEX},
         'facts':all_facts,'count':len(all_facts),'counts_by_event':counts,
         'events':{e:{'name':names[e],'document':next(d['id'] for d in docs.values() if d['event']==e),'statements':counts[e],'written_exam':EXAM[e],
                      'rules_file':'rules.json' if e=='mine-rescue' else f'rules-{e}.json'} for e in order},
         'documents':docs,
         'note':'Statements of fact, verbatim, for every 2026 MSHA coal contest event. "event" says which contest a statement belongs to; "source" is the document id; "page" is the printed rulebook page; "reference" is the citation printed at the end of the statement (First Aid, BioPak and Preshift only) and is part of "text" as printed; "category" is null (the source does not categorize).'}
    # The rule book gives the coal written exam a 15-minute maximum (added to facts.json for app 0.1.0; kept out of rules.json as before).
    we=out['events']['mine-rescue']['written_exam']
    out['events']['mine-rescue']['written_exam']={**{k:we[k] for k in ('questions','format')},'time_limit_min':15,**{k:v for k,v in we.items() if k not in ('questions','format')}}
    json.dump(out,open(f'{OUT}/facts.json','w'),indent=1,ensure_ascii=False)
    json.dump({'parts':allparts,'count_tables':len(allparts),'count_rows':sum(len(p['parts']) for p in allparts),
               'note':'Bench "Identification of Parts" tables (Cons. No. → Designation) per assembly diagram, verbatim. 10 of the 20 bench written-exam questions are taken verbatim from these. Figures are the diagram pages.'},
              open(f'{OUT}/parts.json','w'),indent=1,ensure_ascii=False)
    write_facts_md(out,f'{OUT}/facts.md')
    print(json.dumps(report,indent=1)); print('total facts',len(all_facts),counts)
    # per-rule figure crops + links (adds "figures" to rule items; writes figures.json / figures-report.md)
    import build_figures; build_figures.main()

def write_rules_md(rules,path):
    d=rules['document']
    md=[f"# {d['title']}\n",f"Edition: {d['edition']}  \nSource: {d['url']}\n",
        f"**Written exam:** {rules['written_exam']['detail']} ({rules['written_exam']['source_rule']})\n",f"> {rules['redline_note']}\n"]
    for s in rules['sections']:
        pg=f"*Rulebook pages {s['pages'][0]}–{s['pages'][1]}*" if s.get('pages') else ''
        md.append(f"\n## {s['title']}  \n{pg}\n")
        if s.get('intro'): md.append(s['intro'].replace('\n','\n\n')+'\n')
        if s.get('note'): md.append('> '+s['note']+'\n')
        for im in s.get('images',[]): md.append(f"![Rulebook page {im.get('printed_page')}]({im['file']})\n")
        lastg=None
        for it in s.get('items',[]):
            g=it.get('group')
            if g and g!=lastg: md.append(f"\n### {g['letter']}. {g['title']}\n"); lastg=g
            if it.get('format')=='pre':
                md.append(f"\n**{it['number']}. {it.get('title','')}**\n\n```\n{it['text']}\n```\n")
                for im in it.get('images',[]): md.append(f"![page {im.get('printed_page')}]({im['file']})\n")
            else:
                head=f"**{it['number']}. {it['title']}**\n\n" if it.get('title') else f"**{it['number']}.** "
                md.append(head+it['text'].replace('\n','\n\n')+'\n')
    open(path,'w').write('\n'.join(md))
def write_facts_md(out,path):
    fm=['# Statements of Fact – 2026 MSHA coal contest events\n','Verbatim. Counts: '+', '.join(f"{out['events'][e]['name']} {n}" for e,n in out['counts_by_event'].items())+f" (total {out['count']}).\n"]
    for e,info in out['events'].items():
        d=out['documents'][info['document']]
        fm.append(f"\n## {info['name']} ({info['statements']} statements)\n")
        fm.append(f"Source: [{d['title']}]({d['url']}), {d['edition']}.  \nWritten exam: {info['written_exam']['detail']}\n")
        for f in out['facts']:
            if f['event']==e: fm.append(f"{f['number']}) "+f['text'].replace('\n','  \n    ')+f"  *(p. {f['page']})*  ")
    open(path,'w').write('\n'.join(fm)+'\n')
if __name__=='__main__': main()
