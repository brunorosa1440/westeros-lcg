import json,re,sys,glob,os
# uso: python3 tools/gen_cards.py <pasta packs do throneteki-json-data> > src/cards.js
EXCL={'ToJ','VDS','VHotK','VKm'}
packs=[]
for f in glob.glob(os.path.join(sys.argv[1],'*.json')):
    d=json.load(open(f))
    if d['code'] in EXCL: continue
    packs.append(d)
packs.sort(key=lambda d:(d.get('releaseDate') or '9999', d['cards'][0]['code'] if d['cards'] else ''))
out=[]; PK=[]
for d in packs:
  PK.append({'c':d['code'],'n':d['name'],'cg':d.get('cgdbId'),'p':d['cards'][0]['code'][:2] if d['cards'] else ''})
  for x in d['cards']:
      if x['type']=='title': continue
      t=x.get('text','') or ''
      plain=re.sub(r'<[^>]+>','',t)
      first=plain.split('.')  # keywords appear at start
      kw={}
      for k,rx in [('renown',r'^Renown\.|\bRenown\.'),('stealth',r'\bStealth\.'),('insight',r'\bInsight\.'),('intimidate',r'\bIntimidate\.'),('pillage',r'\bPillage\.'),('limited',r'\bLimited\.'),('noAttach',r'\bNo attachments\.'),('terminal',r'\bTerminal\.')]:
          if re.search(rx,plain): kw[k]=1
      m=re.search(r'Ambush \((\d+)\)',plain)
      if m: kw['ambush']=int(m.group(1))
      mods={}
      for k in ['Income','Initiative','Reserve']:
          m=re.search(r'([+-]\d) '+k+r'\.',plain)
          if m: mods[k.lower()]=int(m.group(1))
      ic=x.get('icons') or {}
      e={'c':x['code'],'n':x['name'],'t':x['type'],'f':x['faction'],'tr':x.get('traits',[]),'lim':x.get('deckLimit',3),'pk':d['code']}
      if x.get('cost') is not None: e['cost']=x['cost'] if x['cost']!='X' else 'X'
      if x.get('strength') is not None: e['s']=x['strength']
      if ic: e['i']=''.join(l for l,k in [('M','military'),('I','intrigue'),('P','power')] if ic.get(k))
      if x.get('unique'): e['u']=1
      if x.get('loyal'): e['l']=1
      if x.get('plotStats'):
          p=x['plotStats']; e['p']=[p['income'],p['initiative'],p['claim'],p['reserve']]
      if kw: e['k']=kw
      if mods: e['m']=mods
      rest=re.sub(r'(Renown|Stealth|Insight|Intimidate|Pillage|Limited|No attachments|Terminal|Ambush \(\d+\)|[+-]\d (Income|Initiative|Reserve))\.','',plain).strip()
      if not rest: e['v']=1
      out.append(e)
print('const PACKS='+json.dumps(PK,ensure_ascii=False,separators=(',',':'))+';')
print('const CARDS='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';')
