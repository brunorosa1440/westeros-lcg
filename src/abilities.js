// ================= HABILIDADES AUTOMATIZADAS =================
// Para adicionar uma carta: cria AB['código'] = { pt: 'descrição', ...hooks }.
// Hooks: str, icons, kw, grantKw, noKneelAttack, entersKnelt, onEnter, actions, afterWin, afterChallengeInitiated,
//        afterCharLeaves, afterStand, onPhaseEnd, onDominanceEnd, claimMod, domStr, attachOk, attStr, attIcons, ev, reveal
const isLordLady = c => c.d.tr.includes('Lord') || c.d.tr.includes('Lady');
const participating = (g, c) => !!g.ch && (g.ch.attackers.includes(c) || g.ch.defenders.includes(c));
const opps = (g, p) => p.opp;

function reducerAct(g, c, amt, filter, desc, opts = {}) {
  const p = c.owner;
  if (c.kneel || g.phase !== 'marshal' || g.activeP !== p) return [];
  return [{
    label: LX(`${opts.sac ? 'Ajoelhar e sacrificar' : 'Ajoelhar'}: −${amt} no próximo ${desc}`, `${opts.sac ? 'Kneel and sacrifice' : 'Kneel'}: −${amt} to your next ${desc}`),
    ai: AI.reducerScore(g, p, filter, amt, opts.sac),
    run: async () => {
      c.kneel = true; p.reducers.push({ amt, f: filter, modes: opts.modes || ['marshal'] });
      g.log(LX(`${p.name} ajoelha ${g.cn(c)} (−${amt} no próximo ${desc}).`, `${p.name} kneels ${g.cn(c)} (−${amt} to the next ${desc}).`));
      if (opts.sac) await g.sacrifice(c);
    }
  }];
}
async function searchTop(g, p, n, filter, what) {
  const top = p.deck.slice(0, n).filter(filter);
  if (top.length) {
    const [c] = await p.ctrl.chooseCards(g, p, { prompt: LX(`Procura ${what} nas ${n} cartas do topo`, `Search the top ${n} cards for ${what}`), cands: top, min: 0, max: 1, ai: x => AI.handValue(g, p, x) + 1, modal: true });
    if (c) { g.removeFromZone(c); g.toZone(c, 'hand'); g.log(LX(`${p.name} revela ${g.cn(c)} e junta-a à mão.`, `${p.name} reveals ${g.cn(c)} and adds it to their hand.`)); }
  } else g.log(LX(`${p.name} não encontrou ${what}.`, `${p.name} did not find ${what}.`));
  shuffle(p.deck);
}

// ---------------- PLOTS ----------------
Object.assign(AB, {
  '01001': { pt: 'Reação: depois de ganhares um desafio de Poder, move 1 poder da facção do adversário para a tua.',
    afterWin: (g, c, ch) => { if (ch.winner === c.owner && ch.type === 'power') { g.log('A Clash of Kings:'); g.movePower(ch.loser, c.owner, 1); } } },
  '01002': { pt: 'Reação: depois de ganhares dominance, ganha 2 poder para a tua facção.' },
  '01003': { pt: 'Nenhum jogador pode iniciar desafios Militares ou de Poder sem ter ganho um desafio de Intriga nessa fase.' },
  '01004': { pt: 'Reduz em 2 o custo da primeira personagem Lord ou Lady que fizeres marshal nesta ronda.' },
  '01005': { pt: 'Podes iniciar um desafio Militar adicional.' },
  '01006': { pt: 'Ao revelar: procura nas 10 cartas do topo um anexo ou local e junta-o à mão. Baralha.',
    reveal: (g, p) => searchTop(g, p, 10, c => ['attachment', 'location'].includes(c.d.t), LX('um anexo ou local', 'an attachment or location')) },
  '01007': { pt: 'Ao revelar: ganha 1 ouro por cada personagem que o adversário controla.',
    reveal: (g, p) => { const n = p.opp.chars.length; p.gold += n; g.log(LX(`Calling the Banners: ${p.name} ganha ${n} ouro.`, `Calling the Banners: ${p.name} gains ${n} gold.`), 'gold'); } },
  '01008': { pt: 'Ao revelar: escolhe um tipo de desafio. Nesses desafios em que defendes, o claim do atacante é reduzido em 1.',
    reveal: async (g, p, pl) => { const t = await p.ctrl.chooseOption(g, p, { prompt: LX('Calm Over Westeros: escolhe o tipo de desafio', 'Calm Over Westeros: name a challenge type'), options: CH_TYPES.map(t => ({ label: CH_NAMES[t], value: t })), ai: o => o.value === 'military' ? 2 : o.value === 'power' ? 1 : 0 }); pl.flags.calmType = t; g.log(`Calm Over Westeros: ${CH_NAMES[t]}.`); } },
  '01009': { pt: 'Ao revelar: escolhe um anexo e descarta-o de jogo.',
    reveal: async (g, p) => { const t = [...g.attsOf(p), ...g.attsOf(p.opp)]; if (!t.length) return; const [a] = await p.ctrl.chooseCards(g, p, { prompt: LX('Confiscation: escolhe um anexo para descartar', 'Confiscation: choose an attachment to discard'), cands: t, min: 1, max: 1, ai: x => x.owner === p ? -5 : 5 + (x.d.cost || 0) }); await g.discardFromPlay(a); } },
  '01010': { pt: 'Ao revelar: compra 3 cartas.', reveal: (g, p) => { g.draw(p, 3); } },
  '01011': { pt: 'Ao revelar: escolhe e ajoelha uma personagem.',
    reveal: async (g, p) => { const t = g.allChars().filter(c => !c.kneel); if (!t.length) return; const [c] = await p.ctrl.chooseCards(g, p, { prompt: LX('Filthy Accusations: escolhe uma personagem para ajoelhar', 'Filthy Accusations: choose a character to kneel'), cands: t, min: 1, max: 1, ai: x => x.owner === p ? -10 : g.str(x) + AI.value(g, x) }); c.kneel = true; g.log(LX(`${g.cn(c)} fica ajoelhado(a).`, `${g.cn(c)} is knelt.`)); } },
  '01012': { pt: 'Trata a caixa de texto de todas as personagens como vazia (exceto Traits).' },
  '01013': { pt: 'Ao revelar: descarta 1 carta ao acaso da mão do adversário. Se for personagem, vai para a dead pile e ganhas 2 poder.',
    reveal: (g, p) => { const q = p.opp; if (!q.hand.length) return; const c = q.hand[Math.floor(Math.random() * q.hand.length)]; g.removeFromZone(c); if (c.d.t === 'character') { g.toZone(c, 'dead'); g.log(LX(`Heads on Spikes: ${g.cn(c)} vai para a dead pile de ${q.name}.`, `Heads on Spikes: ${g.cn(c)} goes to ${q.name}'s dead pile.`)); g.gainPower(p, 2); } else { g.toZone(c, 'discard'); g.log(LX(`Heads on Spikes: ${q.name} descarta ${g.cn(c)}.`, `Heads on Spikes: ${q.name} discards ${g.cn(c)}.`)); } } },
  '01014': { pt: 'Cada jogador só pode declarar 1 atacante ou defensor por desafio.' },
  '01015': { pt: 'Ao revelar: cada jogador escolhe uma personagem sua e descarta-a de jogo (não pode ser salva).',
    reveal: async (g, p) => { for (const q of g.order()) { if (!q.chars.length) continue; const [c] = await q.ctrl.chooseCards(g, q, { prompt: LX('Marched to the Wall: escolhe uma personagem tua para descartar', 'Marched to the Wall: choose one of your characters to discard'), cands: [...q.chars], min: 1, max: 1, ai: x => -AI.value(g, x) }); await g.discardFromPlay(c, { save: false }); } } },
  '01016': { pt: 'Não podes fazer marshal de locais ou anexos, nem jogar eventos.' },
  '01017': { pt: 'O ouro base de cada plot Kingdom ou Edict revelado conta como 0.' },
  '01018': { pt: 'Ao revelar: coloca 1 marcador. Ação: descarta o marcador para escolher e levantar uma personagem.',
    reveal: (g, p, pl) => { pl.flags.tokens = 1; },
    actions: (g, pl, ctx) => { const p = pl.owner; if (!pl.flags.tokens) return []; const t = p.chars.filter(c => c.kneel); if (!t.length) return [];
      return [{ label: LX('Power Behind the Throne: levantar uma personagem', 'Power Behind the Throne: stand a character'), ai: AI.standScore(g, p, ctx), run: async () => { const [c] = await p.ctrl.chooseCards(g, p, { prompt: LX('Escolhe uma personagem para levantar', 'Choose a character to stand'), cands: t, min: 1, max: 1, ai: x => g.str(x) }); pl.flags.tokens = 0; c.kneel = false; g.log(LX(`${p.name} levanta ${g.cn(c)} (Power Behind the Throne).`, `${p.name} stands ${g.cn(c)} (Power Behind the Throne).`)); } }]; } },
  '01019': { pt: 'Ao revelar: escolhe até 3 cartas do teu descarte e baralha-as no baralho.',
    reveal: async (g, p) => { if (!p.discard.length) return; const cs = await p.ctrl.chooseCards(g, p, { prompt: LX('Rebuilding: escolhe até 3 cartas do descarte', 'Rebuilding: choose up to 3 cards from your discard pile'), cands: [...p.discard], min: 0, max: 3, ai: x => AI.handValue(g, p, x) + 1, modal: true }); for (const c of cs) { g.removeFromZone(c); c.zone = 'deck'; p.deck.push(c); } shuffle(p.deck); g.log(LX(`${p.name} baralha ${cs.length} carta(s) do descarte no baralho.`, `${p.name} shuffles ${cs.length} card(s) from discard into their deck.`)); } },
  '01020': { pt: 'Ao revelar: põe em jogo uma personagem com custo impresso 5 ou menos da tua mão ou descarte.',
    reveal: async (g, p) => { const t = [...p.hand, ...p.discard].filter(c => c.d.t === 'character' && (c.d.cost || 0) <= 5 && !g.uniqueBlockedByDead(p, c)); if (!t.length) return; const [c] = await p.ctrl.chooseCards(g, p, { prompt: LX('Reinforcements: escolhe uma personagem para pôr em jogo', 'Reinforcements: choose a character to put into play'), cands: t, min: 0, max: 1, ai: x => AI.value(g, x), modal: true }); if (c) await g.putIntoPlay(p, c, 'put'); } },
  '01021': { pt: 'Não podes iniciar mais de 1 desafio na fase de desafios.' },
  '01022': { pt: 'Ao revelar: procura nas 10 cartas do topo uma personagem e junta-a à mão. Baralha.',
    reveal: (g, p) => searchTop(g, p, 10, c => c.d.t === 'character', LX('uma personagem', 'a character')) },
  '01023': { pt: 'Quando começa a fase de desafios, todos os jogadores devolvem o ouro ao tesouro.' },
  '01024': { pt: 'Podes jogar 1 carta limitada adicional nesta ronda.' },
  '01026': { pt: 'Ao revelar: cada jogador escolhe até 3 personagens suas. Todas as outras morrem (não podem ser salvas).',
    reveal: async (g, p) => { for (const q of g.order()) { if (q.chars.length <= 3) continue; const keep = await q.ctrl.chooseCards(g, q, { prompt: LX('Wildfire Assault: escolhe até 3 personagens para sobreviver', 'Wildfire Assault: choose up to 3 characters to survive'), cands: [...q.chars], min: 0, max: 3, ai: x => AI.value(g, x) + 1 }); for (const c of [...q.chars]) if (!keep.includes(c)) await g.kill(c, { save: false }); } } },
});

// ---------------- AGENDAS ----------------
Object.assign(AB, {
  '01027': { pt: 'Máx. 15 cartas neutras no deck. Ação: ajoelha a carta de facção para reduzir em 1 o custo da próxima carta loyal que jogares nesta fase.',
    factionActions: (g, p, ctx) => { if (p.fknelt || ctx.reaction) return []; if (!((g.phase === 'marshal' && g.activeP === p) || p.hand.some(c => c.d.t === 'event' && c.d.l))) return []; const f = c => !!c.d.l; return [{ label: LX('Fealty: ajoelhar facção (−1 na próxima carta loyal)', 'Fealty: kneel faction (−1 to next loyal card)'), ai: g.phase === 'marshal' && g.activeP === p ? AI.reducerScore(g, p, f, 1) : 0, run: async () => { p.fknelt = true; p.reducers.push({ amt: 1, f, modes: ['marshal', 'play'] }); g.log(LX(`${p.name} ajoelha a facção (Fealty).`, `${p.name} kneels their faction card (Fealty).`)); } }]; } },
});
['01198', '01199', '01200', '01201', '01202', '01203', '01204', '01205'].forEach(c => AB[c] = { pt: 'Podes incluir cartas não-loyal da facção do estandarte; tens de incluir pelo menos 12 dessa facção.' });

// ---------------- NEUTRAS ----------------
Object.assign(AB, {
  '01028': { pt: 'Reação: depois de fazeres marshal do Littlefinger, compra 2 cartas. +1 Income.', onEnter: (g, c, how) => { if (how === 'marshal') g.draw(c.owner, 2); } },
  '01029': { pt: 'Stealth. Interrupção: quando termina a fase de dominance, remove o Varys do jogo para descartar todas as personagens.',
    onDominanceEnd: async (g, c) => { const p = c.owner; const v = await p.ctrl.chooseOption(g, p, { prompt: LX('Varys: remover do jogo para descartar TODAS as personagens?', 'Varys: remove him from the game to discard ALL characters?'), options: [{ label: LX('Sim', 'Yes'), value: true }, { label: LX('Não', 'No'), value: false }], ai: o => o.value ? AI.varysScore(g, p) : 0, card: c });
      if (!v) return; g.leavePlay(c, 'removed'); g.log(LX(`${p.name} remove Varys do jogo!`, `${p.name} removes Varys from the game!`), 'kill'); for (const x of g.allChars()) await g.discardFromPlay(x); } },
  '01030': { pt: 'Sem anexos. Reação: depois de ganhares um desafio em que ataca, descarta um anexo controlado pelo adversário.',
    afterWin: async (g, c, ch) => { const p = c.owner; if (ch.winner !== p || !ch.attackers.includes(c)) return; const t = g.attsOf(ch.loser); if (!t.length) return; const [a] = await p.ctrl.chooseCards(g, p, { prompt: LX("Rattleshirt's Raiders: descarta um anexo", "Rattleshirt's Raiders: discard an attachment"), cands: t, min: 0, max: 1, ai: x => 1 + (x.d.cost || 0) }); if (a) await g.discardFromPlay(a); } },
  '01031': { pt: 'Sem anexos. Pillage. Ação (desafios): ajoelha a facção para dar +2 STR a uma Wildling tua que participe.',
    actions: (g, c, ctx) => { const p = c.owner; if (!ctx.ch || p.fknelt) return []; const t = p.chars.filter(x => x.d.tr.includes('Wildling') && participating(g, x)); if (!t.length || c !== p.chars.find(x => x.code === '01031')) return [];
      return [{ label: LX('Wildling Horde: ajoelhar facção, +2 STR', 'Wildling Horde: kneel faction, +2 STR'), ai: AI.pumpScore(g, p, ctx.ch, 2), run: async () => { p.fknelt = true; const [x] = await p.ctrl.chooseCards(g, p, { prompt: LX('Escolhe a Wildling', 'Choose the Wildling'), cands: t, min: 1, max: 1, ai: () => 1 }); x.tmp += 2; g.log(LX(`${g.cn(x)} ganha +2 STR.`, `${g.cn(x)} gets +2 STR.`)); } }]; } },
  '01032': { pt: 'Só Lord ou Lady. Ação: ajoelha o Seal of the Hand para levantar a personagem anexada.', attachOk: (g, a, t) => isLordLady(t),
    actions: (g, a, ctx) => { if (a.kneel || !a.parent || !a.parent.kneel || a.parent.owner !== a.owner) return []; return [{ label: LX('Seal of the Hand: levantar ', 'Seal of the Hand: stand ') + g.cn(a.parent), ai: AI.standScore(g, a.owner, ctx), run: async () => { a.kneel = true; a.parent.kneel = false; g.log(LX(`${g.cn(a.parent)} é levantado (Seal of the Hand).`, `${g.cn(a.parent)} stands (Seal of the Hand).`)); } }]; } },
  '01033': { pt: 'Só Lord ou Lady. Interrupção: quando a personagem seria morta ou descartada, sacrifica o Bodyguard para a salvar.', attachOk: (g, a, t) => isLordLady(t) },
  '01034': { pt: 'A personagem ganha um ícone de Intriga.', attIcons: () => 'I' },
  '01035': { pt: 'Terminal. A caixa de texto da personagem anexada conta como vazia.' },
  '01036': { pt: 'A personagem ganha um ícone de Poder.', attIcons: () => 'P' },
  '01037': { pt: 'A personagem ganha um ícone Militar.', attIcons: () => 'M' },
  '01038': { pt: 'Contribui com 8 STR para a tua dominance. +1 Reserve.', domStr: () => 8 },
  '01039': { pt: 'Limited. Ação de marshaling: ajoelha e sacrifica para reduzir em 3 o custo da próxima personagem. +1 Initiative.',
    actions: (g, c) => reducerAct(g, c, 3, x => x.d.t === 'character', LX('personagem', 'character'), { sac: true }) },
  '01040': { pt: 'Limited. +1 Income.' },
  '01041': { pt: 'Reação: depois de ganhares um desafio Militar como atacante por 5+ STR, mata uma personagem do adversário.',
    ev: { timing: 'afterWin', cond: (g, p, ch) => ch.type === 'military' && ch.att === p && ch.diff >= 5 && ch.loser.chars.length, ai: () => 20,
      run: async (g, p, e, ch) => { const t = ch.loser.chars; if (!t.length) return; const [c] = await p.ctrl.chooseCards(g, p, { prompt: LX('Put to the Sword: escolhe uma personagem para matar', 'Put to the Sword: choose a character to kill'), cands: [...t], min: 1, max: 1, ai: x => AI.value(g, x) }); await g.kill(c); } } },
  '01042': { pt: 'Reação: depois de ganhares um desafio Militar como atacante por 5+ STR, descarta um local do adversário.',
    ev: { timing: 'afterWin', cond: (g, p, ch) => ch.type === 'military' && ch.att === p && ch.diff >= 5 && ch.loser.locs.length, ai: () => 15,
      run: async (g, p, e, ch) => { const t = ch.loser.locs; if (!t.length) return; const [c] = await p.ctrl.chooseCards(g, p, { prompt: LX('Put to the Torch: escolhe um local para descartar', 'Put to the Torch: choose a location to discard'), cands: [...t], min: 1, max: 1, ai: x => (x.d.cost || 0) + 3 }); await g.discardFromPlay(c); } } },
  '01043': { pt: 'Reação: depois de ganhares um desafio de Poder por 5+ STR, ganha 2 poder.',
    ev: { timing: 'afterWin', cond: (g, p, ch) => ch.type === 'power' && ch.diff >= 5, ai: () => 30, run: async (g, p) => { g.gainPower(p, 2); } } },
  '01044': { pt: 'Reação: depois de ganhares um desafio de Intriga como atacante, coloca veneno numa personagem sem ícone de Intriga do adversário; no fim da fase, se ainda o tiver, morre.',
    ev: { timing: 'afterWin', cond: (g, p, ch) => ch.type === 'intrigue' && ch.att === p && ch.loser.chars.some(c => !g.hasIcon(c, 'intrigue')), ai: () => 18,
      run: async (g, p, e, ch) => { const t = ch.loser.chars.filter(c => !g.hasIcon(c, 'intrigue')); const [c] = await p.ctrl.chooseCards(g, p, { prompt: LX('Tears of Lys: escolhe a personagem a envenenar', 'Tears of Lys: choose the character to poison'), cands: t, min: 1, max: 1, ai: x => AI.value(g, x) }); c.flags.poison = true; g.log(LX(`${g.cn(c)} foi envenenado.`, `${g.cn(c)} is poisoned.`));
        g.endOfPhase.push(async () => { if (c.zone === 'chars' && c.flags.poison) { c.flags.poison = false; g.log(LX(`O veneno faz efeito em ${g.cn(c)}.`, `The poison takes effect on ${g.cn(c)}.`)); await g.kill(c); } }); } } },
  '01045': { pt: 'Interrupção: quando um evento do adversário seria iniciado, cancela-o. X é o custo impresso desse evento.' },
});

// ---------------- LANNISTER ----------------
Object.assign(AB, {
  '01084': { pt: 'Enquanto ataca num desafio de Intriga, o claim do teu plot sobe 1.', claimMod: (g, c, ch) => ch.type === 'intrigue' ? 1 : 0 },
  '01086': { pt: 'Reação: depois de uma personagem Lord ou Lady morrer, o Joffrey ganha 1 poder (máx. 3 por ronda).',
    afterCharLeaves: (g, c, v, how) => { if (how === 'killed' && isLordLady(v) && (c.flags.joff || 0) < 3) { c.flags.joff = (c.flags.joff || 0) + 1; g.gainPower(c.owner, 1, c); } } },
  '01087': { pt: 'Não ajoelha ao atacar num desafio Militar e ganha renown enquanto participa num desafio Militar.',
    noKneelAttack: (g, c, t) => t === 'military', kw: (g, c) => (g.ch && g.ch.type === 'military' && participating(g, c)) ? { renown: 1 } : {} },
  '01088': { pt: 'Ação de dominance: ajoelha o Tickler para descartar a carta do topo do baralho do adversário. Depois podes descartar de jogo uma cópia dessa carta.',
    actions: (g, c, ctx) => { if (c.kneel || g.phase !== 'dominance') return []; const p = c.owner;
      return [{ label: LX('The Tickler: descartar topo do adversário', "The Tickler: discard top of opponent's deck"), ai: 6, run: async () => { c.kneel = true; const d = g.discardTop(p.opp); if (!d) return; const t = g.allInPlay().filter(x => x.d.n === d.d.n); if (!t.length) return; const [x] = await p.ctrl.chooseCards(g, p, { prompt: LX(`Descartar uma cópia de ${d.d.n} em jogo?`, `Discard a copy of ${d.d.n} from play?`), cands: t, min: 0, max: 1, ai: y => y.owner === p ? -10 : 10 }); if (x) await g.discardFromPlay(x); } }]; } },
  '01089': { pt: 'Stealth. Reação: depois de um desafio de Intriga ser iniciado, ganha 2 ouro (máx. 2 vezes por ronda).',
    afterChallengeInitiated: (g, c, ch) => { if (ch.type === 'intrigue' && (c.flags.ty || 0) < 2) { c.flags.ty = (c.flags.ty || 0) + 1; c.owner.gold += 2; g.log(LX(`Tyrion: ${c.owner.name} ganha 2 ouro.`, `Tyrion: ${c.owner.name} gains 2 gold.`), 'gold'); } } },
  '01090': { pt: 'Renown. +1 STR por cada ouro no teu gold pool. +2 Income.', str: (g, c) => c.owner.gold },
  '01092': { pt: 'Ambush (2). Interrupção forçada: no fim da fase em que entrou por ambush, é descartado (não pode ser salvo).',
    onPhaseEnd: async (g, c, ph) => { if (c.flags.ambushed === ph) { await g.discardFromPlay(c, { save: false }); } } },
  '01094': { pt: 'Ação de marshaling: ajoelha para reduzir em 1 o custo da próxima personagem Lannister.', actions: (g, c) => reducerAct(g, c, 1, x => x.d.t === 'character' && x.d.f === 'lannister', LX('personagem Lannister', 'Lannister character')) },
  '01095': { pt: 'Ambush (4). Reação: depois de entrar por ambush, se tens mais cartas na mão que o adversário, ele escolhe e mata uma personagem sua.',
    onEnter: async (g, c, how) => { if (how !== 'ambush') return; const p = c.owner, q = p.opp; if (p.hand.length > q.hand.length && q.chars.length) { const [v] = await q.ctrl.chooseCards(g, q, { prompt: LX("The Queen's Assassin: escolhe uma personagem tua para morrer", "The Queen's Assassin: choose one of your characters to kill"), cands: [...q.chars], min: 1, max: 1, ai: x => -AI.value(g, x) + (x.dupes.length ? 20 : 0) }); await g.kill(v); } } },
  '01096': { pt: 'Ambush (1). +2 STR. Se estiver no Joffrey Baratheon, ele ganha um ícone Militar.', attStr: () => 2, attIcons: (g, a, t) => t.code === '01086' ? 'M' : '' },
  '01097': { pt: 'Podes iniciar um desafio de Intriga adicional.' },
  '01098': { pt: 'Reação: depois de ganhares um desafio de Intriga, compra 1 carta.', afterWin: (g, c, ch) => { if (ch.winner === c.owner && ch.type === 'intrigue') { g.log('Lannisport:'); g.draw(c.owner, 1); } } },
  '01099': { pt: 'Limited. Ação de marshaling: ajoelha para reduzir em 1 o custo da próxima carta Lannister.', actions: (g, c) => reducerAct(g, c, 1, x => x.d.f === 'lannister', LX('carta Lannister', 'Lannister card')) },
  '01100': { pt: 'Ação: põe em jogo uma personagem Lannister da tua mão. No fim da fase, se ainda estiver em jogo, é descartada.',
    ev: { timing: 'action', cond: (g, p, ctx) => !ctx.reaction && p.hand.some(c => c.d.t === 'character' && c.d.f === 'lannister' && !g.uniqueBlockedByDead(p, c)), ai: (g, p, ctx) => AI.hmrScore(g, p, ctx),
      run: async (g, p) => { const t = p.hand.filter(c => c.d.t === 'character' && c.d.f === 'lannister' && !g.uniqueBlockedByDead(p, c)); const [c] = await p.ctrl.chooseCards(g, p, { prompt: LX('Hear Me Roar!: escolhe a personagem', 'Hear Me Roar!: choose the character'), cands: t, min: 1, max: 1, ai: x => g.str(x) + (x.d.cost || 0) }); const r = await g.putIntoPlay(p, c, 'put'); if (r && r.zone === 'chars') { const tok = Math.random(); r.flags.hmr = tok; g.endOfPhase.push(async () => { if (r.zone === 'chars' && r.flags.hmr === tok) await g.discardFromPlay(r, { save: false }); }); } } } },
  '01101': { pt: 'Só se controlares um Lord/Lady Lannister. Ação de desafios: ajoelha a facção para devolver à mão uma personagem do adversário com custo impresso ≤ X.',
    ev: { timing: 'action', cost: () => 0,
      cond: (g, p, ctx) => g.phase === 'challenges' && !ctx.reaction && !p.fknelt && p.chars.some(c => c.d.f === 'lannister' && isLordLady(c)) && p.opp.chars.some(c => (c.d.cost || 0) <= p.gold),
      ai: (g, p) => AI.tidflScore(g, p),
      run: async (g, p) => { const t = p.opp.chars.filter(c => (c.d.cost || 0) <= p.gold); if (!t.length) return; p.fknelt = true; const [c] = await p.ctrl.chooseCards(g, p, { prompt: LX('The Things I Do For Love: escolhe a personagem a devolver', 'The Things I Do For Love: choose the character to return'), cands: t, min: 1, max: 1, ai: x => AI.value(g, x) }); p.gold -= (c.d.cost || 0); g.log(LX(`(${p.name} paga X=${c.d.cost || 0})`, `(${p.name} pays X=${c.d.cost || 0})`), 'dim'); await g.returnToHand(c); } } },
});

// ---------------- STARK ----------------
Object.assign(AB, {
  '01141': { pt: 'Stealth. Com duplicado, ganha ícone Militar. Reação: ao entrar em jogo, coloca a carta do topo do baralho por baixo como duplicado.',
    icons: (g, c) => c.dupes.length ? 'M' : '',
    onEnter: (g, c) => { const p = c.owner; const d = p.deck.shift(); if (d) { d.zone = 'dupe'; d.parent = c; c.dupes.push(d); g.log(LX('Arya Stark recebe um duplicado do topo do baralho.', 'Arya Stark gets a duplicate from the top of the deck.')); } } },
  '01142': { pt: 'Interrupção: quando um evento do adversário seria iniciado, sacrifica o Bran para o cancelar.' },
  '01143': { pt: 'Enquanto participa num desafio, os adversários não podem ativar habilidades de cartas.' },
  '01144': { pt: 'Renown. Reação: depois de um desafio ser iniciado contra ti, levanta o Eddard Stark.',
    afterChallengeInitiated: (g, c, ch) => { if (ch.def === c.owner && c.kneel) { c.kneel = false; g.log(LX('Eddard Stark levanta-se.', 'Eddard Stark stands.')); } } },
  '01145': { pt: 'Intimidate. Sem anexos. Ação de desafios: ajoelha o Grey Wind para matar uma personagem com STR 1 ou menos (2 ou menos se controlares o Robb Stark).',
    actions: (g, c, ctx) => { if (c.kneel || g.phase !== 'challenges') return []; const p = c.owner; const lim = p.chars.some(x => x.code === '01146') ? 2 : 1; const t = g.allChars().filter(x => g.str(x) <= lim); if (!t.length) return [];
      return [{ label: LX(`Grey Wind: matar personagem com STR ≤ ${lim}`, `Grey Wind: kill a character with STR ≤ ${lim}`), ai: AI.greyWindScore(g, p, c, t, ctx), run: async () => { c.kneel = true; const [x] = await p.ctrl.chooseCards(g, p, { prompt: LX('Grey Wind: escolhe a personagem a matar', 'Grey Wind: choose the character to kill'), cands: g.allChars().filter(x => g.str(x) <= lim), min: 1, max: 1, ai: y => y.owner === p ? -50 : AI.value(g, y) }); if (x) await g.kill(x); } }]; } },
  '01146': { pt: 'Renown. Reação: depois de uma personagem Stark tua ser sacrificada ou morta, levanta todas as tuas personagens (1 vez por ronda).',
    afterCharLeaves: (g, c, v, how) => { if (v.owner === c.owner && v.d.f === 'stark' && !c.flags.robb) { c.flags.robb = true; c.owner.chars.forEach(x => x.kneel = false); g.log(LX('Robb Stark: todas as personagens Stark levantam-se!', 'Robb Stark: all your characters stand!')); } } },
  '01147': { pt: 'Entra em jogo ajoelhada. Reação: depois de se levantar, ganha 1 poder para a tua facção (1 vez por ronda).', entersKnelt: true,
    afterStand: (g, c) => { if (!c.flags.sansa) { c.flags.sansa = true; g.log('Sansa Stark:'); g.gainPower(c.owner, 1); } } },
  '01148': { pt: 'Sem anexos. O Bran Stark ganha insight. Reação: ao entrar, devolve à mão uma personagem Stark com STR impressa ≤ 2 do descarte ou dead pile.',
    grantKw: (g, c, t) => t.code === '01142' ? { insight: 1 } : null,
    onEnter: async (g, c) => { const p = c.owner; const t = [...p.discard, ...p.dead].filter(x => x.d.t === 'character' && x.d.f === 'stark' && (x.d.s || 0) <= 2); if (!t.length) return; const [x] = await p.ctrl.chooseCards(g, p, { prompt: LX('Summer: escolhe uma personagem para voltar à mão', 'Summer: choose a character to return to your hand'), cands: t, min: 0, max: 1, ai: y => 1 + (y.d.cost || 0), modal: true }); if (x) { g.removeFromZone(x); g.toZone(x, 'hand'); g.log(LX(`${g.cn(x)} volta à mão de ${p.name}.`, `${g.cn(x)} returns to ${p.name}'s hand.`)); } } },
  '01149': { pt: 'Sem anexos. +1 STR por cada outra carta Direwolf que controlas.', str: (g, c) => c.owner.chars.filter(x => x !== c && x.d.tr.includes('Direwolf')).length },
  '01151': { pt: 'Sem anexos. Enquanto houver um plot War revelado, não ajoelha ao atacar num desafio Militar.', noKneelAttack: (g, c, t) => t === 'military' && g.anyPlotTrait('War') },
  '01152': { pt: 'Ação de marshaling: ajoelha para reduzir em 1 o custo da próxima personagem Stark.', actions: (g, c) => reducerAct(g, c, 1, x => x.d.t === 'character' && x.d.f === 'stark', LX('personagem Stark', 'Stark character')) },
  '01153': { pt: 'Só personagem Stark. +2 STR. Reação: depois de ganhares um desafio Militar em que a personagem participa, sacrifica a Ice para matar uma personagem do adversário.',
    attachOk: (g, a, t) => t.d.f === 'stark', attStr: () => 2,
    afterWin: async (g, a, ch) => { const p = a.owner; if (ch.winner !== p || ch.type !== 'military' || !a.parent || !participating(g, a.parent) || !ch.loser.chars.length) return;
      const v = await p.ctrl.chooseOption(g, p, { prompt: LX('Ice: sacrificar para matar uma personagem do adversário?', "Ice: sacrifice it to kill an opponent's character?"), options: [{ label: LX('Sim', 'Yes'), value: true }, { label: LX('Não', 'No'), value: false }], ai: o => o.value ? (Math.max(...ch.loser.chars.map(x => AI.value(g, x))) >= 8 ? 1 : 0) : 0.5, card: a });
      if (!v) return; await g.sacrifice(a); const [c] = await p.ctrl.chooseCards(g, p, { prompt: LX('Ice: escolhe a personagem a matar', 'Ice: choose the character to kill'), cands: [...ch.loser.chars], min: 1, max: 1, ai: x => AI.value(g, x) }); if (c) await g.kill(c); } },
  '01154': { pt: 'Ação de desafios: ajoelha para revelar a carta do topo do baralho. Se for Stark, compra-a.',
    actions: (g, c) => { if (c.kneel || g.phase !== 'challenges') return []; const p = c.owner; return [{ label: LX('Gates of Winterfell: revelar topo', 'Gates of Winterfell: reveal top card'), ai: 5, run: async () => { c.kneel = true; const t = p.deck[0]; if (!t) return; g.log(LX(`Gates of Winterfell revela ${g.cn(t)}.`, `Gates of Winterfell reveals ${g.cn(t)}.`)); if (t.d.f === 'stark') g.draw(p, 1); } }]; } },
  '01155': { pt: 'Cada carta Direwolf na tua mão ganha ambush (X), em que X é o seu custo impresso.' },
  '01156': { pt: 'Limited. Ação de marshaling: ajoelha para reduzir em 1 o custo da próxima carta Stark.', actions: (g, c) => reducerAct(g, c, 1, x => x.d.f === 'stark', LX('carta Stark', 'Stark card')) },
  '01157': { pt: 'Só durante um desafio Militar. Ação: uma personagem Stark participante ganha +2 STR. Se ganhares o desafio, compra 1 carta.',
    ev: { timing: 'action', cond: (g, p, ctx) => !!g.ch && g.ch.type === 'military' && !ctx.reaction && p.chars.some(c => c.d.f === 'stark' && participating(g, c)), ai: (g, p) => AI.pumpScore(g, p, g.ch, 2),
      run: async (g, p) => { const ch = g.ch; const t = p.chars.filter(c => c.d.f === 'stark' && participating(g, c)); const [c] = await p.ctrl.chooseCards(g, p, { prompt: LX('For the North!: escolhe a personagem', 'For the North!: choose the character'), cands: t, min: 1, max: 1, ai: () => 1 }); c.tmp += 2; g.log(LX(`${g.cn(c)} ganha +2 STR.`, `${g.cn(c)} gets +2 STR.`)); ch.afterWinCbs.push(async () => { if (ch.winner === p) { g.log('For the North!:'); g.draw(p, 1); } }); } } },
  '01158': { pt: 'Reação: depois de perderes um desafio de Intriga como defensor, ajoelha uma Direwolf para matar uma personagem atacante.',
    ev: { timing: 'afterLose', cond: (g, p, ch) => ch.type === 'intrigue' && ch.def === p && p.chars.some(c => c.d.tr.includes('Direwolf') && !c.kneel) && ch.attackers.some(c => c.zone === 'chars'), ai: () => 25,
      run: async (g, p, e, ch) => { const w = p.chars.filter(c => c.d.tr.includes('Direwolf') && !c.kneel); const [d] = await p.ctrl.chooseCards(g, p, { prompt: LX('Like Warm Rain: escolhe a Direwolf a ajoelhar', 'Like Warm Rain: choose a Direwolf to kneel'), cands: w, min: 1, max: 1, ai: x => -g.str(x) }); d.kneel = true; const t = ch.attackers.filter(c => c.zone === 'chars'); const [k] = await p.ctrl.chooseCards(g, p, { prompt: LX('Like Warm Rain: escolhe o atacante a matar', 'Like Warm Rain: choose the attacker to kill'), cands: t, min: 1, max: 1, ai: x => AI.value(g, x) }); await g.kill(k); } } },
  '01159': { pt: 'Só durante um desafio. Ação: o claim do teu plot sobe 1 até ao fim do desafio.',
    ev: { timing: 'action', cond: (g, p, ctx) => !!g.ch && g.ch.att === p && !ctx.reaction && !g.ch.wic, ai: (g, p) => AI.wicScore(g, p),
      run: async (g, p) => { g.ch.claimMod += 1; g.ch.wic = true; g.log('Winter Is Coming: claim +1.'); } } },
});
