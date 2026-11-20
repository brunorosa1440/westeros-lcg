// Todos os decks iniciais uns contra os outros (IA vs IA e jogadas aleatórias)
const fs=require('fs');
eval(['src/cards.js','src/engine.js','src/abilities.js','src/abilities_en.js','src/ai.js','src/ai2.js','src/decks.js','src/abilities_intro.js','src/abilities_nw.js','src/abilities_core2.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n')+`
class RandCtrl{ async chooseCards(g,p,o){ if(o.aiPick&&Math.random()<.5) return o.aiPick(); if(!o.cands.length) return []; const c=shuffle([...o.cands]); const n=o.min+Math.floor(Math.random()*(Math.min(o.max,c.length)-o.min+1)); return c.slice(0,n);}
 async chooseOption(g,p,o){ return o.options[Math.floor(Math.random()*o.options.length)].value; }
 async actionWindow(g,p,o){ const r=Math.random(); if(o.buttons&&o.buttons.length&&r<0.5) return {button:o.buttons[Math.floor(Math.random()*o.buttons.length)].value}; if(o.actions.length&&r<0.85) return o.actions[Math.floor(Math.random()*o.actions.length)]; return null; } }
(async()=>{
 const N=+process.argv[2]||40; const D=STARTER_DECKS; const wins={}; let rounds=0, games=0; const seen={};
 for(let a=0;a<D.length;a++) for(let b=0;b<D.length;b++){
  for(let i=0;i<N;i++){
   const rnd=i%4===3;
   const g=new Game([D[a],D[b]],[rnd?new RandCtrl():new AICtrl(), i%4===2?new RandCtrl():new AICtrl()],['A','B']);
   try{ const w=await g.run(); if(!rnd && i%4!==2){ const k=w===g.players[0]?D[a].name:D[b].name; wins[k]=(wins[k]||0)+1; } rounds+=g.round; games++; }
   catch(e){ console.log('ERRO',D[a].name,'vs',D[b].name,e.stack); console.log(g.logs.slice(-25).map(l=>l.msg).join('\\n')); process.exit(1);}
   for(const l of g.logs) for(const k of ['Thoros','Mya Stone','Melisandre','Shireen','Davos','Spears','Dracarys','Consuming','STR 0','Missandei','Freedmen','Qotho','Waking','Fire and Blood','Words Are Wind','Stannis:','Dragonstone Castle','Red Keep','Laughing Lord','Edric','Light of the Lord','Jhiqui','Rhaegal','Grey Worm','Illyrio','Jorah','Breaker','Storm','Chamber','Vanguard Lancer','Selyse','Cressen','Late Summer','Retaliation','Plaza','Dragon Sight','To Go Forward','Even Handed','Wrath','Viserys','Handmaiden','Jade Sea','Your King','Nightsong','Cortnay','The Wall:','Valar','Trade Routes',"Ranger's Cache",'Raven','Veteran Builder','Yoren','Aemon','Cellador','Recruiter','controlo','Dalla','Benjen','Othell','Old Bear','Jon Snow','Weirwood','Gulltown','Now My Watch','Take the Black','Shadow Tower','Queenscrown','Bridge of Skulls','Eastwatch','Castle Black','Valar Dohaeris']) if(l.msg.includes(k)) seen[k]=(seen[k]||0)+1;
  }
 }
 console.log('ok', games, 'jogos, rondas média', (rounds/games).toFixed(2)); console.log('vitórias (IA vs IA):', wins); console.log(seen);
})();`);
