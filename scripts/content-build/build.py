import subprocess, re, json, os
SRC='/workspace/mine-rescue/sources/I-2026_Coal_MR_Rules.pdf'
OUT='/workspace/mine-rescue/content'
URL='https://www.msha.gov/sites/default/files/Mine%20Rescue/I-2026%20Coal%20MR%20Rules.pdf'
DOC={'id':'msha-2026-coal-mr-rules','title':'2026 Coal Mine Rescue Rules (Section I of the 2026 Unified Mine Rescue Rules)',
     'edition':'2026, "Approved – 1/15/2026"','publisher':'MSHA (rules developed by the Holmes Mine Rescue Association Coal Mine Rescue Rules Sub-Committee)','url':URL}
npages=int(re.search(r'Pages:\s+(\d+)',subprocess.run(['pdfinfo',SRC],capture_output=True,text=True).stdout).group(1))
L=[]  # (pdfpage, line)
for pg in range(1,npages+1):
    t=subprocess.run(['pdftotext','-layout','-f',str(pg),'-l',str(pg),SRC,'-'],capture_output=True,text=True).stdout
    lines=[l.rstrip() for l in t.replace('\f','').split('\n')]
    while lines and not lines[-1].strip(): lines.pop()
    if lines and re.fullmatch(r'\s*\d{1,3}',lines[-1]): lines.pop()   # printed page number
    while lines and not lines[-1].strip(): lines.pop()
    while lines and not lines[0].strip(): lines.pop(0)
    for l in lines: L.append((pg,l))
# --- redline cleanup: remove struck-through (deleted) text, verified visually on PDF pages 9 and 23
txt='\n'.join(l for _,l in L)
fixes=[]
def fix(old,new):
    global L
    joined=[l for _,l in L]
    for i in range(len(joined)):
        for span in (1,2,3):
            chunk='\n'.join(joined[i:i+span])
            if old in chunk:
                newchunk=chunk.replace(old,new)
                nl=newchunk.split('\n')
                pg=L[i][0]
                L=L[:i]+[(pg,x) for x in nl]+L[i+span:]
                fixes.append((old,new)); return
    raise SystemExit('fix not found: '+old)
# PDF p9 Written Examination rule 2
fix('statements may either will be multiple choice with three choices. fill in the\n','statements will be multiple choice with three choices. ')
fix('blank with no more than two blanks, or a combination of both. If the test\n','')
fix('contains multiple choice questions, Only one choice','Only one choice')
# PDF p23 B card rule 19
fix('the command center briefing officer will be','the briefing officer will be')

lines=[l for _,l in L]; pages=[p for p,_ in L]
def find(pat,start=0):
    for i in range(start,len(lines)):
        if re.search(pat,lines[i]): return i
    raise SystemExit('nf '+pat)
iGen=find(r'^\s*GENERAL INFORMATION FOR CONDUCTING')
iRules=find(r'^\s*RULES GOVERNING 2026 MINE RESCUE CONTESTS',iGen)
iWritten=find(r'^\s*WRITTEN EXAMINATION\s*$',iRules)
iFab=find(r'^\s*FRESH AIR BASE PROCEDURES',iWritten)
iMisc=find(r'^\s*MISCELLANEOUS\s*$',iFab)
iA=find(r'^\s*INTERPRETATIONS OF A CARDS',iMisc)
iB=find(r'^\s*INTERPRETATIONS OF B CARD',iA)
iFig=find(r'^Figure 1\(a\)',iB)
iSCBA=find(r'^\s*SELF-CONTAINED BREATHING APPARATUS',iFig)
iDet=find(r'^\s*DETECTING INSTRUMENTS',iSCBA)
iSOF=find(r'^\s*STATEMENTS OF FACT',iDet)

def dedent(ls):
    ls=list(ls)
    while ls and not ls[0].strip(): ls.pop(0)
    while ls and not ls[-1].strip(): ls.pop()
    ind=min((len(l)-len(l.lstrip()) for l in ls if l.strip()),default=0)
    return [l[ind:] for l in ls]
MARK=re.compile(r'^\s*(\(?[0-9]{1,2}[.)]|[A-Za-z][.)]|NOTE:|•)\s')
def reflow(ls):
    """Join wrapped lines into paragraphs. New paragraph at list markers, table rows, or after a line that ends a sentence
    (short line or blank line). Blank lines that fall mid-sentence (page breaks) do not split."""
    ls=dedent(ls)
    if not ls: return ''
    width=max(len(l.strip()) for l in ls)
    paras=[];cur='';prev=None;blank=False
    END=re.compile(r'([.:;)”"!?]|\d)\s*$')
    for l in ls:
        s=l.strip()
        if not s:
            blank=True; continue
        table=len(re.findall(r'\S\s{3,}\S',l))>=2
        ended = prev is not None and END.search(prev.rstrip())
        newp = (cur=='' or MARK.match(l) or table or (prev is not None and len(re.findall(r'\S\s{3,}\S',prev))>=2)
                or (ended and (blank or len(prev.strip())<0.72*width or re.search(r'\S\s{2,}\d{1,2}\s*$',prev.rstrip()))))
        piece = ' | '.join(re.split(r'\s{3,}',s)) if table else re.sub(r'\s{2,}',' ',s)
        if newp and cur: paras.append(cur); cur=''
        if cur and cur.endswith('-') and not cur.endswith(' -'): cur+=piece
        else: cur=(cur+' '+piece) if cur else piece
        prev=l; blank=False
    if cur: paras.append(cur)
    return '\n'.join(paras)
def pg_range(a,b):
    ps=sorted(set(pages[a:b])); return [ps[0]-2, ps[-1]-2]   # printed page = PDF page - 2
def items(a,b,num_pat=r'^\s{0,8}(\d{1,2})\.\s+(\S.*)$',start=1,group_pat=None):
    """Split a line range into sequentially numbered items. Only the expected next number starts a new item,
    so nested sub-lists (1., 2., ...) stay inside their parent rule's text."""
    out=[];intro=[];cur=None;exp=start;group=None;gexp=0
    for i in range(a,b):
        l=lines[i]
        if group_pat:
            g=re.match(group_pat,l)
            if g and g.group(1)==chr(ord('A')+gexp) and (group is None or True) and len(g.group(2).strip())<50 and not g.group(2).strip().endswith(('.',',')) and not re.search(r'\b(an|the|a|of)$',g.group(2).strip()):
                gexp+=1
                group={'letter':g.group(1),'title':g.group(2).strip()}
                if cur: out.append(cur); cur=None
                continue
        m=re.match(num_pat,l)
        if m and int(m.group(1))==exp:
            if cur: out.append(cur)
            cur={'number':exp,'lines':[' '*(len(l)-len(l.lstrip()))+' '*(len(m.group(1))+1)+' '+l[l.index(m.group(1)+'.')+len(m.group(1))+1:].lstrip()],'first':i,'group':group}
            exp+=1; continue
        (cur['lines'] if cur else intro).append(l)
        if cur: cur['last']=i
    if cur: out.append(cur)
    res=[]
    for it in out:
        last=it.get('last',it['first'])
        r={'number':it['number'],'text':reflow(it['lines']),'pages':pg_range(it['first'],last+1)}
        if it['group']: r['group']=it['group']
        res.append(r)
    return reflow(intro),res

def section(sid,title,a,b,**kw):
    intro,its=items(a+1,b,**kw)
    s={'id':sid,'title':title,'pages':pg_range(a,b)}
    if intro: s['intro']=intro
    for it in its: it['id']=f"{sid}-{it['number']}"
    s['items']=its
    return s

secs=[]
# General information: intro paragraphs then numbered 1-7
secs.append(section('general','General Information for Conducting 2026 Mine Rescue Contests',iGen+1,iRules))
s=section('rules-governing','Rules Governing the 2026 Mine Rescue Contests',iRules,iWritten); secs.append(s)
secs.append(section('written-exam','Written Examination',iWritten,iFab))
secs.append(section('fab','Fresh Air Base Procedures',iFab,iMisc))
secs.append(section('misc','Miscellaneous',iMisc,iA))
secs.append(section('a-card','Interpretations of A Cards',iA,iB))
secs.append(section('b-card','Interpretations of B Card',iB,iFig,group_pat=r'^\s{0,2}([A-E])\.\s{2,}(.+)$'))
# Figures & legend: graphics; keep extracted labels + page images
fig_pages=sorted(set(pages[iFig:iSCBA]))
subprocess.run(['pdftoppm','-r','110','-png','-f',str(fig_pages[0]),'-l',str(fig_pages[-1]),SRC,f'{OUT}/figures/page'],check=True)
figfiles=sorted(f for f in os.listdir(f'{OUT}/figures') if f.endswith('.png'))
secs.append({'id':'figures','title':'Drawings and Figures; Mine Map Legend','pages':pg_range(iFig,iSCBA),
  'note':'These pages are diagrams and map-legend symbols. Their text cannot be meaningfully extracted, so each page is provided as an image (figures/). Index: Proper Method of Roof Testing p41; Proper Methods of Setting Roof Supports p43; Extent of Gases p46; Initial Exploration as per Rule 29 p47; Airlocking Through an Overcast Wall p48; Systematic Exploration as per Rule 44 p49; Extent of Gases at Overcasts p50; Mine Map Legend p51.',
  'images':[{'file':'figures/'+f,'pdf_page':int(re.search(r'(\d+)\.png',f).group(1)),'printed_page':int(re.search(r'(\d+)\.png',f).group(1))-2,
     'extracted_labels':'\n'.join(re.sub(r'\s{3,}',' | ',l.strip()) for p,l in L if p==int(re.search(r'(\d+)\.png',f).group(1)) and l.strip())} for f in figfiles]})
# SCBA and detecting instruments: one item per device heading
def device_section(sid,title,a,b,heads):
    idx=[]
    for h in heads:
        for i in range(a,b):
            if re.search(h,lines[i]): idx.append((i,h)); break
        else: raise SystemExit('no head '+h)
    its=[]
    for k,(i,h) in enumerate(idx):
        end=idx[k+1][0] if k+1<len(idx) else b
        # heading may span 2 lines (CAREvent)
        name=lines[i].strip(); j=i+1
        while j<end and (not lines[j].strip() or (re.match(r'^\s{10,}\S',lines[j]) and not MARK.match(lines[j]))):
            if lines[j].strip(): name+=' '+lines[j].strip()
            j+=1
        its.append({'id':f'{sid}-{k+1}','number':k+1,'title':name,'text':reflow(lines[j:end]),'pages':pg_range(i,end)})
    return {'id':sid,'title':title,'pages':pg_range(a,b),'items':its}
secs.append(device_section('scba','Self-Contained Breathing Apparatus',iSCBA+1,iDet,
  [r'BioPak 240-S Donning',r'BioPak 240 Revolution Donning',r'Draeger BG-4 / BG-ProAir',r'CAREvent']))
secs.append(device_section('gas-instruments','Gas Detecting Instruments',iDet+1,iSOF,
  [r'CMX 270 Continuous',r'MSA Passport Personal',r'LTX 310 Multi',r'TMX 410 Multi',r'TMX 412 and ATX 620',r'CSE Explorer 4|Explorer 4 Multi',r'^\s*ITX Multi',r'^\s*MSA Solaris\s*$',r'ALTAIR 4X',r'M40M Multi',r'MX4 and MX6',r'X-am 2000']))
# Statements of fact
a=iSOF+2  # skip "STATEMENTS OF FACT" / "MINE RESCUE"
facts=[];cur=None;exp=1
for i in range(a,len(lines)):
    m=re.match(r'^\s*(\d{1,3})\)\s*(\S.*)$',lines[i])
    if m and int(m.group(1))==exp:
        if cur: facts.append(cur)
        cur={'n':exp,'lines':[m.group(2)],'i':i}; exp+=1
    elif cur and lines[i].strip(): cur['lines'].append(lines[i].strip())
facts.append(cur)
FACTS=[{'id':f"coal-mr-sof-{f['n']:03d}",'number':f['n'],'text':re.sub(r'\s{2,}',' ',' '.join(f['lines'])),
        'section':'Statements of Fact – Mine Rescue','category':None,'page':pages[f['i']]-2,'source':DOC['id']} for f in facts]
# fix soft hyphen artifacts like "re- establish" / "non-\napparatus"
for f in FACTS:
    f['text']=f['text'].replace('re- establish','re-establish').replace('non- apparatus','non-apparatus')

rules={'document':DOC,'generated':'2026-10-15','redline_note':'The official PDF is a redline: red text is new for 2026 and red struck-through text is deleted. Deleted text has been removed here (Written Examination rule 2; B Card rule 19). Additions are kept.','sections':secs}
json.dump(rules,open(f'{OUT}/rules.json','w'),indent=1,ensure_ascii=False)
json.dump({'document':DOC,'section':'Statements of Fact – Mine Rescue (rulebook pp. 71–80)','count':len(FACTS),
  'note':'Verbatim from the rulebook. "category" is left null: the source does not categorize the statements. The written exam is 10 of these statements with a key word blanked (Written Examination rules 1–5).',
  'facts':FACTS},open(f'{OUT}/facts.json','w'),indent=1,ensure_ascii=False)
# markdown
md=[f"# {DOC['title']}\n",f"Edition: {DOC['edition']}  \nSource: {URL}\n",f"> {rules['redline_note']}\n"]
for s in secs:
    md.append(f"\n## {s['title']}  \n*Rulebook pages {s['pages'][0]}–{s['pages'][1]}*\n")
    if s.get('intro'): md.append(s['intro'].replace('\n','\n\n')+'\n')
    if s.get('note'): md.append('> '+s['note']+'\n')
    for im in s.get('images',[]): md.append(f"![Rulebook page {im['printed_page']}]({im['file']})\n")
    lastg=None
    for it in s.get('items',[]):
        g=it.get('group')
        if g and g!=lastg: md.append(f"\n### {g['letter']}. {g['title']}\n"); lastg=g
        head=f"**{it['number']}. {it['title']}**\n\n" if it.get('title') else f"**{it['number']}.** "
        md.append(head+it['text'].replace('\n','\n\n')+'\n')
open(f'{OUT}/rules.md','w').write('\n'.join(md))
fm=[f"# Statements of Fact – Mine Rescue (2026 Coal Mine Rescue Rules)\n",f"Source: {URL} (rulebook pp. 71–80). {len(FACTS)} statements, verbatim.\n"]
for f in FACTS: fm.append(f"{f['number']}) {f['text']}  ")
open(f'{OUT}/facts.md','w').write('\n'.join(fm)+'\n')
print('fixes',len(fixes))
for s in secs: print(s['id'],s['pages'],len(s.get('items',[])),[i['number'] for i in s.get('items',[])][-1:] , len(s.get('images',[])))
print('facts',len(FACTS),FACTS[-1]['number'])
