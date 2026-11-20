// Decks gerados com as cartas de um pack (por omissão Core) para cada facção; IA e jogadas aleatórias
const fs=require('fs');
eval(['src/cards.js','src/engine.js','src/abilities.js','src/abilities_en.js','src/ai.js','src/ai2.js','src/decks.js','src/abilities_intro.js','src/abilities_nw.js','src/abilities_core2.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n')+`
class RandCtrl{ async chooseCards(g,p,o){ if(o.aiPick&&Math.random()<.5) return o.aiPick(); if(!o.cands.length) return []; const c=shuffle([...o.cands]); const n=o.min+Math.floor(Math.random()*(Math.min(o.max,c.length)-o.min+1)); return c.slice(0,n);}
 async chooseOption(g,p,o){ return o.options[Math.floor(Math.random()*o.options.length)].value; }
 async actionWindow(g,p,o){ const r=Math.random(); if(o.buttons&&o.buttons.length&&r<0.5) return {button:o.buttons[Math.floor(Math.random()*o.buttons.length)].value}; if(o.actions.length&&r<0.85) return o.actions[Math.floor(Math.random()*o.actions.length)]; return null; } }
const packs=(process.argv[3]||'Core').split(',');
const FAC=['baratheon','greyjoy','lannister','martell','thenightswatch','stark','targaryen','tyrell'];
function mk(f){ const pool=CARDS.filter(d=>packs.includes(d.pk)||d.pk==='Core'); const cards={};
 const fc=shuffle(pool.filter(d=>d.f===f&&!['plot','agenda','title'].includes(d.t))); for(const d of fc) cards[d.c]=Math.min(3,d.lim);
 const ne=shuffle(pool.filter(d=>d.f==='neutral'&&!['plot','agenda','title'].includes(d.t)));
 let n=Object.values(cards).reduce((a,b)=>a+b,0); for(const d of ne){ if(n>=60) break; cards[d.c]=Math.min(2,d.lim); n+=cards[d.c]; }
 for(const d of shuffle(pool.filter(d=>d.t==='plot')).slice(0,7)) cards[d.c]=1; return {name:f,faction:f,agenda:null,cards}; }
const LOGS=[];
(async()=>{ const N=+process.argv[2]||40; const used={}; let games=0;
 for(let i=0;i<N;i++){ const a=FAC[i%8], b=FAC[(i*3+1)%8]; const rnd=i%3;
  const g=new Game([mk(a),mk(b)],[rnd===1?new RandCtrl():new AICtrl(), rnd===2?new RandCtrl():new AICtrl()],[a,b]);
  try{ await g.run(); games++; }catch(e){ console.log('ERRO',a,b,e.stack); console.log(g.logs.slice(-25).map(l=>l.msg).join('\\n')); process.exit(1); }
  for(const l of g.logs) LOGS.push(l.msg); }
 console.log('ok',games,'jogos'); const keys=(process.argv[4]||'').split('|').filter(Boolean); for(const k of keys){ const n=LOGS.filter(m=>m.includes(k)).length; console.log((n?'  ':'NUNCA ')+k+': '+n); } })();`);
