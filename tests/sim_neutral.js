const fs=require('fs');
eval(['src/cards.js','src/engine.js','src/abilities.js','src/abilities_en.js','src/ai.js','src/ai2.js','src/decks.js','src/abilities_intro.js','src/abilities_nw.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n')+`
class RandCtrl{ async chooseCards(g,p,o){ if(o.aiPick&&Math.random()<.5) return o.aiPick(); if(!o.cands.length) return []; const c=shuffle([...o.cands]); const n=o.min+Math.floor(Math.random()*(Math.min(o.max,c.length)-o.min+1)); return c.slice(0,n);} 
 async chooseOption(g,p,o){ return o.options[Math.floor(Math.random()*o.options.length)].value; }
 async actionWindow(g,p,o){ const r=Math.random(); if(o.buttons&&o.buttons.length&&r<0.5) return {button:o.buttons[Math.floor(Math.random()*o.buttons.length)].value}; if(o.actions.length&&r<0.85) return o.actions[Math.floor(Math.random()*o.actions.length)]; return null; } }
const plots=CARDS.filter(d=>d.t==='plot').map(d=>d.c);
const neut=CARDS.filter(d=>d.f==='neutral'&&!['plot','agenda'].includes(d.t)).map(d=>d.c);
function deck(base,i){ const d=JSON.parse(JSON.stringify(base)); for(const c of Object.keys(d.cards)) if(DB[c].t==='plot') delete d.cards[c];
  shuffle(plots.slice()).slice(0,7).forEach(c=>d.cards[c]=1); neut.forEach(c=>d.cards[c]=(d.cards[c]||0)+1); return d; }
const seen={};
(async()=>{
 const N=+process.argv[2]||300;
 for(let i=0;i<N;i++){
  const A=deck(STARTER_DECKS[0]), B=deck(STARTER_DECKS[1]);
  const ctr=[i%2?new RandCtrl():new AICtrl(), new RandCtrl()];
  const g=new Game(i%2?[A,B]:[B,A],ctr,['A','B']);
  try{ await g.run(); }catch(e){ console.log('ERRO',i,e.stack); console.log(g.logs.slice(-30).map(l=>l.msg).join('\\n')); process.exit(1);}
  for(const l of g.logs){ const m=l.msg.match(/^(Varys|Wildfire|Marched|Confiscation|Rebuilding|Reinforcements|Tears|O veneno|Rattleshirt|Calm|Heads on Spikes|Power Behind|Supporting|Grey Wind|Ice|Like Warm Rain|The Hand's|Efeito)/); }
  g.logs.forEach(l=>{ for(const k of ['remove Varys','veneno','Bodyguard','Hand\\'s Judgment','cancelado','Wildling','Rattleshirt','Supporting the Faith','Calm Over','Confiscation','duplicado','Power Behind','Things','Hear Me','Ice','Like Warm','Grey Wind','Queen','Tickler','Robb Stark:','Joffrey','Summer','Arya','For the North','Winter Is']) if(l.msg.includes(k)) seen[k]=(seen[k]||0)+1; });
 }
 console.log('ok',N, seen);
})();
`);
