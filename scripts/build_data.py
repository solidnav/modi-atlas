import json, re, datetime
legs=json.load(open('legs.json'))

MONTHS={m:i+1 for i,m in enumerate(
 ['January','February','March','April','May','June','July','August',
  'September','October','November','December'])}

def clean_notes(s):
    s=re.sub(r'\{\|[^\n]*','',s)      # table starts
    s=re.sub(r'\|\}','',s)            # table ends
    s=re.sub(r'^\s*\|-\s*$','',s,flags=re.M)
    s=re.sub(r'!Details','',s)
    s=re.sub(r'\s+',' ',s)
    return s.strip(" '|-!")

def parse_dates(raw, year):
    y=int(year)
    s=raw.replace('–','-').replace('—','-')
    parts=[p.strip() for p in s.split('-')]
    def tok(p):
        d=re.search(r'\b(\d{1,2})\b',p)
        mo=None
        for name,idx in MONTHS.items():
            if name in p: mo=idx; break
        yr=re.search(r'\b(20\d\d)\b',p)
        return (int(d.group(1)) if d else None,
                mo, int(yr.group(1)) if yr else None)
    if len(parts)==1:
        d,mo,yr=tok(parts[0])
        if not d or not mo: return None,None,None
        dt=datetime.date(yr or y, mo, d)
        return dt.isoformat(), dt.isoformat(), 1
    a=tok(parts[0]); b=tok(parts[1])
    ad,amo,ayr=a; bd,bmo,byr=b
    if bmo is None: bmo=amo
    if amo is None: amo=bmo
    if not ad or not bd or not amo or not bmo: return None,None,None
    sy=ayr or y
    ey=byr or y
    if bmo<amo and byr is None: ey=sy+1   # Dec->Jan crossing
    try:
        sd=datetime.date(sy,amo,ad); ed=datetime.date(ey,bmo,bd)
    except ValueError:
        return None,None,None
    days=(ed-sd).days+1
    return sd.isoformat(), ed.isoformat(), days

# Representative city coords [lon,lat]
COORD={
 'Argentina':[-58.38,-34.60],'Australia':[149.13,-35.28],'Austria':[16.37,48.21],
 'Bahrain':[50.58,26.22],'Bangladesh':[90.41,23.81],'Bhutan':[89.64,27.47],
 'Brazil':[-47.93,-15.78],'Brunei':[114.94,4.90],'Canada':[-75.70,45.42],
 'China':[116.40,39.90],'Croatia':[15.98,45.81],'Cyprus':[33.36,35.17],
 'Denmark':[12.57,55.68],'Egypt':[31.24,30.04],'Ethiopia':[38.76,9.03],
 'European Union':[4.35,50.85],'Fiji':[178.44,-18.14],'France':[2.35,48.86],
 'Germany':[13.40,52.52],'Ghana':[-0.19,5.60],'Greece':[23.73,37.98],
 'Guyana':[-58.16,6.80],'Indonesia':[106.85,-6.21],'Iran':[51.39,35.69],
 'Ireland':[-6.26,53.35],'Islamic Republic of Afghanistan':[69.21,34.56],
 'Israel':[34.78,32.08],'Italy':[12.50,41.90],'Japan':[139.69,35.69],
 'Jordan':[35.93,31.95],'Kazakhstan':[71.43,51.13],'Kenya':[36.82,-1.29],
 'Kuwait':[47.98,29.38],'Kyrgyzstan':[74.60,42.87],'Laos':[102.63,17.97],
 'Malaysia':[101.69,3.14],'Maldives':[73.51,4.17],'Mauritius':[57.50,-20.16],
 'Mexico':[-99.13,19.43],'Mongolia':[106.92,47.89],'Mozambique':[32.57,-25.97],
 'Myanmar':[96.13,19.75],'Namibia':[17.08,-22.56],'Nepal':[85.32,27.71],
 'Netherlands':[4.90,52.37],'New Zealand':[174.78,-41.29],'Nigeria':[7.49,9.06],
 'Norway':[10.75,59.91],'Oman':[58.41,23.59],'Pakistan':[74.34,31.55],
 'Palestine':[35.21,31.90],'Papua New Guinea':[147.18,-9.44],'Philippines':[120.98,14.60],
 'Poland':[21.01,52.23],'Portugal':[-9.14,38.72],'Qatar':[51.53,25.29],
 'Republic of Korea':[126.98,37.57],'Russia':[37.62,55.75],'Rwanda':[30.06,-1.94],
 'Saudi Arabia':[46.72,24.69],'Seychelles':[55.45,-4.62],'Singapore':[103.82,1.35],
 'Slovakia':[17.11,48.15],'South Africa':[28.05,-26.20],'South Korea':[126.98,37.57],
 'Spain':[-3.70,40.42],'Sri Lanka':[79.86,6.93],'Sweden':[18.07,59.33],
 'Switzerland':[7.45,46.95],'Tajikistan':[68.78,38.56],'Tanzania':[39.28,-6.79],
 'Thailand':[100.50,13.75],'Trinidad and Tobago':[-61.51,10.66],'Turkey':[32.85,39.93],
 'Turkmenistan':[58.38,37.96],'Uganda':[32.58,0.35],'Ukraine':[30.52,50.45],
 'United Arab Emirates':[54.37,24.45],'United Kingdom':[-0.13,51.51],
 'United Nations':[-73.97,40.75],'United States':[-77.04,38.90],
 'Uzbekistan':[69.24,41.30],'Vatican City':[12.45,41.90],'Vietnam':[105.83,21.03],
}

DISPLAY={'Islamic Republic of Afghanistan':'Afghanistan','Republic of Korea':'South Korea',
         'United Nations':'United States (UN, New York)','United States':'United States',
         'European Union':'European Union (Brussels)'}

# Curated foreign honours received during a visit (name : citable)
HONOURS={
 ('2016','Saudi Arabia'):'King Abdulaziz Sash (Order of Abdulaziz al-Saud)',
 ('2016','Islamic Republic of Afghanistan'):'Amir Amanullah Khan Award',
 ('2018','Palestine'):'Grand Collar of the State of Palestine',
 ('2019','United Arab Emirates'):'Order of Zayed',
 ('2019','Bahrain'):'King Hamad Order of the Renaissance (First Class)',
 ('2019','Maldives'):'Order of the Distinguished Rule of Nishan Izzuddin',
 ('2023','Papua New Guinea'):'Companion of the Order of Logohu',
 ('2023','Fiji'):'Companion of the Order of Fiji',
 ('2023','Egypt'):'Order of the Nile',
 ('2023','France'):'Grand Cross of the Legion of Honour',
 ('2023','Greece'):'Grand Cross of the Order of Honour',
 ('2024','Bhutan'):'Order of the Druk Gyalpo',
 ('2024','Russia'):'Order of St Andrew the Apostle',
 ('2024','Nigeria'):'Grand Commander of the Order of the Niger',
 ('2024','Guyana'):'The Order of Excellence',
 ('2024','Kuwait'):"The Order of Mubarak Al Kabeer",
 ('2025','Cyprus'):'Grand Cross of the Order of Makarios III',
 ('2025','Trinidad and Tobago'):'Order of the Republic of Trinidad and Tobago',
 ('2025','Ghana'):'Officer of the Order of the Star and Eagles of Ghana',
 ('2025','Namibia'):'Order of the Most Ancient Welwitschia Mirabilis',
}

visits=[]
skipped=[]
for l in legs:
    c=l['country']
    if c not in COORD:
        skipped.append((l['year'],l['num'],c)); continue
    s,e,days=parse_dates(l['dates'], l['year'])
    if not s:
        skipped.append((l['year'],l['num'],c,'DATE:'+l['dates'])); continue
    lon,lat=COORD[c]
    award=HONOURS.get((l['year'],c))
    visits.append(dict(
        year=l['year'], tripNum=l['num'],
        country=DISPLAY.get(c,c), rawCountry=c,
        city=l['areas'], lon=lon, lat=lat,
        start=s, end=e, days=days,
        purpose=l['purpose'], award=award,
        cost=None,  # per-trip cost not officially disclosed
        note=clean_notes(l['notes'])[:400] if l['notes'] else ''
    ))

visits.sort(key=lambda v:(v['start'], v['tripNum'] or ''))
for i,v in enumerate(visits): v['seq']=i

print("FINAL VISITS:",len(visits))
print("WITH MEDAL:",sum(1 for v in visits if v['award']))
print("SKIPPED:",len(skipped))
for s in skipped: print("  skip:",s)
print("DATE RANGE:",visits[0]['start'],"→",visits[-1]['end'])
json.dump(visits, open('visits.json','w'), ensure_ascii=True, indent=0)
# sanity: print a few
for v in visits[:4]+visits[-3:]:
    med = 'Y' if v['award'] else '-'
    print('  %3d %s->%s (%sd) %-30s medal=%s' % (v['seq'],v['start'],v['end'],v['days'],v['country'],med))
