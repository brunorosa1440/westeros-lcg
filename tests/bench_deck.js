// Taxa de vitória de um deck inicial (índice) contra os outros, IA nova dos dois lados
const fs=require('fs');
eval(['src/cards.js','src/engine.js','src/abilities.js','src/abilities_en.js','src/ai.js','src/ai2.js','src/decks.js','src/abilities_intro.js','src/abilities_nw.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n')+`
(async()=>{ const X=+process.argv[2], N=+process.argv[3]||40; const D=STARTER_DECKS; const res={};
 for(let o=0;o<D.length;o++){ if(o===X) continue; let w=0;
  for(let i=0;i<N;i++){ const seat=i%2; const decks=seat?[D[o],D[X]]:[D[X],D[o]]; const g=new Game(decks,[new AICtrl(),new AICtrl()],['P0','P1']); const win=await g.run(); if(g.players.indexOf(win)===seat) w++; }
  res[D[o].name]=(100*w/N).toFixed(0)+'%'; }
 console.log(D[X].name, res); })();`);
