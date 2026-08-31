import json, re
d=json.load(open('trips_raw.json'))
wt=d['parse']['wikitext']
YEARS=[str(y) for y in range(2014,2027)]

def year_section(y, nextys):
    s=wt.find('=='+y+'==')
    e=len(wt)
    for ny in nextys:
        p=wt.find('=='+ny+'==')
        if p>s: e=min(e,p)
    return wt[s:e]

def clean(s):
    s=re.sub(r'<ref[^>]*>.*?</ref>','',s,flags=re.S)
    s=re.sub(r'<ref[^>]*/>','',s)
    s=re.sub(r'\{\{See also\|[^}]*\}\}','',s,flags=re.I)
    s=re.sub(r'\{\{ref\|[^}]*\}\}','',s,flags=re.I)
    s=re.sub(r'\[\[File:[^\]]*\]\]','',s)
    s=re.sub(r'\[\[[^\]|]*\|([^\]]*)\]\]',r'\1',s)
    s=re.sub(r'\[\[([^\]]*)\]\]',r'\1',s)
    s=re.sub(r'\{\{font color\|[^|]*\|([^}]*)\}\}',r'\1',s,flags=re.I)
    s=re.sub(r"'''?",'',s)
    s=re.sub(r'<br\s*/?>',' ',s)
    s=re.sub(r'\{\{[^}]*\}\}','',s)  # leftover templates
    s=re.sub(r'\s+',' ',s)
    return s.strip()

def country_of(cell):
    m=re.search(r'\{\{\s*flag\s*(?:country|icon)?\s*\|\s*([^}|]+)',cell,re.I)
    if m: return m.group(1).strip()
    c=clean(cell)
    return c.strip()

all_legs=[]
for i,y in enumerate(YEARS):
    sec=year_section(y, YEARS[i+1:]+['Expected future trips','Multilateral meetings'])
    lines=sec.split('\n')
    depth=0
    in_main=False
    cur=None  # current row: list of cells; each cell is [firstchar, text]
    rows=[]
    def flush():
        global cur
        if cur: rows.append(cur); cur=None
    for ln in lines:
        st=ln.strip()
        # table open/close tracking
        opens=st.count('{|')
        # detect main table start
        if st.startswith('{|') and not in_main:
            in_main=True; depth=1; continue
        if not in_main: continue
        if st.startswith('{|'):
            depth+=1
            if cur is not None and cur: cur[-1][1]+='\n'+ln
            continue
        if st.startswith('|}'):
            depth-=1
            if depth==0:
                flush(); in_main=False
            else:
                if cur is not None and cur: cur[-1][1]+='\n'+ln
            continue
        if depth>1:
            if cur is not None and cur: cur[-1][1]+='\n'+ln
            continue
        # depth==1
        if st.startswith('|-'):
            flush(); cur=[]; continue
        if cur is None: 
            continue
        if st.startswith('|') or st.startswith('!'):
            # split possible inline cells separated by ' || ' or ' !! '
            fc='!' if st.startswith('!') else '|'
            body=st[1:]
            cur.append([fc, body])
        else:
            if cur: cur[-1][1]+='\n'+ln
    flush()
    # process rows into legs
    cur_num=None
    for r in rows:
        if not r: continue
        # skip header row (all '!' and contains 'Country')
        celltxt=' '.join(c[1] for c in r)
        if 'Country' in celltxt and 'Purpose' in celltxt: continue
        if 'colspan' in (r[0][1] if r else '') and len(r)==1: continue
        # determine if first cell is a number header
        cells=r
        num=None
        idx=0
        if cells[0][0]=='!':
            m=re.search(r'(\d+)', cells[0][1])
            if m:
                num=m.group(1); cur_num=num; idx=1
            else:
                # separator like colspan blank
                if len(cells)==1: 
                    continue
                idx=1
        else:
            num=cur_num
        rest=cells[idx:]
        if len(rest)<3: 
            continue
        country=country_of(rest[0][1])
        if not country or country.lower() in ('','united nations'): 
            # still keep UN? skip pure UN visits (NYC) -> treat as United States? We'll map UN->United States
            pass
        areas=clean(rest[1][1]) if len(rest)>1 else ''
        dates=clean(rest[2][1]) if len(rest)>2 else ''
        purpose=clean(rest[3][1]) if len(rest)>3 else ''
        notes=clean(rest[4][1]) if len(rest)>4 else ''
        all_legs.append(dict(year=y,num=num,country=country,areas=areas,dates=dates,purpose=purpose,notes=notes[:600]))

print("TOTAL LEGS:", len(all_legs))
from collections import Counter
c=Counter(x['country'] for x in all_legs)
print("UNIQUE COUNTRIES:",len(c))
for k,v in c.most_common(80):
    print(f"  {v:2d}  {k!r}")
json.dump(all_legs, open('legs.json','w'), indent=1, ensure_ascii=False)
