// IA nova vs IA base, alternando lugares e decks
const fs=require('fs');
eval(['src/cards.js','src/engine.js','src/abilities.js','src/abilities_en.js','src/ai.js','src/ai2.js','src/decks.js','src/abilities_intro.js','src/abilities_nw.js','src/abilities_core2.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n')+`
(async()=>{ if(process.argv[3]) Object.assign(AIK, JSON.parse(process.argv[3]));
 const N=+process.argv[2]||200; let nw=0, rounds=0, t0=Date.now();
 for(let i=0;i<N;i++){
  const newIdx=i%2, deckSwap=Math.floor(i/2)%2;
  const decks=[STARTER_DECKS[deckSwap],STARTER_DECKS[1-deckSwap]];
  const ctr=[new AICtrl(0,newIdx!==0), new AICtrl(0,newIdx!==1)];
  const g=new Game(decks,ctr,['P0','P1']);
  try{ const w=await g.run(); if(g.players.indexOf(w)===newIdx) nw++; rounds+=g.round; }catch(e){ console.log('ERRO',e.stack); console.log(g.logs.slice(-20).map(l=>l.msg).join('\\n')); process.exit(1);}
 }
 console.log('IA nova ganhou', nw,'/',N, '('+(100*nw/N).toFixed(1)+'%)', 'rondas média', (rounds/N).toFixed(2), 'ms/jogo', ((Date.now()-t0)/N).toFixed(0));
})();
`);
