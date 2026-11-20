const fs=require('fs');
eval(['src/cards.js','src/engine.js','src/abilities.js','src/abilities_en.js','src/ai.js','src/ai2.js','src/decks.js','src/abilities_intro.js','src/abilities_nw.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n')+`
class RandCtrl{ async chooseCards(g,p,o){ if(!o.cands.length) return []; const c=shuffle([...o.cands]); const n=o.min+Math.floor(Math.random()*(Math.min(o.max,c.length)-o.min+1)); return c.slice(0,n);} 
 async chooseOption(g,p,o){ return o.options[Math.floor(Math.random()*o.options.length)].value; }
 async actionWindow(g,p,o){ const r=Math.random(); if(o.buttons&&o.buttons.length&&r<0.5) return {button:o.buttons[Math.floor(Math.random()*o.buttons.length)].value}; if(o.actions.length&&r<0.8) return o.actions[Math.floor(Math.random()*o.actions.length)]; return null; } }
// deck misto com todas as cartas core (para testar habilidades neutras)
const mix={name:'mix',faction:'stark',agenda:'01203',cards:{}}; 
(async()=>{
 const N=+process.argv[2]||200; let rounds=0;
 for(let i=0;i<N;i++){
  const A=STARTER_DECKS[i%2], B=STARTER_DECKS[(i+1)%2];
  const ctr=[i%3===0?new RandCtrl():new AICtrl(), i%3===1?new RandCtrl():new AICtrl()];
  const g=new Game([A,B],ctr,['A','B']);
  try{ await g.run(); rounds+=g.round; }catch(e){ console.log('ERRO',i,e.stack); console.log(g.logs.slice(-30).map(l=>l.msg).join('\\n')); process.exit(1);}
 }
 console.log('ok',N,'rondas média',rounds/N);
})();
`);
