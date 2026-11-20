// ================= INTRO DECK: NIGHT'S WATCH (The Brotherhood of the Watch) =================
const isNW = (g, c) => g.isFaction(c, 'thenightswatch');
const isWildling = (g, c) => g.hasTrait(c, 'Wildling');
const takeFromDiscard = async (g, p, prompt, filter) => {
  const t = p.opp.discard.filter(c => c.d.t === 'character' && filter(c) && !g.uniqueBlockedByDead(p, c));
  if (!t.length) return;
  const [c] = await p.ctrl.chooseCards(g, p, { prompt, cands: t, min: 0, max: 1, ai: x => AI.value(g, x) + 1, modal: true });
  if (c) await g.putIntoPlayUnderControl(p, c);
};

const NW = {
  // ---------- PLOTS ----------
  '08020': { pt: 'Ao revelar: cada jogador escolhe personagens suas com custo impresso total até 10; as outras vão para o fundo do baralho do dono (não podem ser salvas).', en: "When revealed: each player chooses characters they control with a total printed cost of 10 or lower; every other character goes to the bottom of its owner's deck (cannot be saved).",
    reveal: async (g, p) => { for (const q of g.order()) { const all = [...q.chars]; if (all.reduce((s, c) => s + (c.d.cost || 0), 0) <= 10) continue;
      let keep = [], budget = 10;
      if (q.ctrl.isAI) { for (const c of [...all].sort((a, b) => AI.value(g, b) / Math.max(1, b.d.cost || 0) - AI.value(g, a) / Math.max(1, a.d.cost || 0))) if ((c.d.cost || 0) <= budget) { keep.push(c); budget -= c.d.cost || 0; } }
      else { while (true) { const t = all.filter(c => !keep.includes(c) && (c.d.cost || 0) <= budget); if (!t.length) break; const [c] = await q.ctrl.chooseCards(g, q, { prompt: LX(`Valar Dohaeris: escolhe personagens a manter (custo restante: ${budget})`, `Valar Dohaeris: choose characters to keep (cost left: ${budget})`), cands: t, min: 0, max: 1, ai: () => 1, doneLabel: LX('Concluir', 'Done') }); if (!c) break; keep.push(c); budget -= c.d.cost || 0; } }
      for (const c of all) if (!keep.includes(c) && c.zone === 'chars') { await g.beforeLeave(c, 'deck'); g.leavePlay(c, 'deckbottom'); g.log(LX(`${g.cn(c)} vai para o fundo do baralho.`, `${g.cn(c)} goes to the bottom of the deck.`)); } } } },
  '09051': { pt: 'Ao revelar: ganha 1 ouro por cada local teu e por cada local do adversário.', en: 'When revealed: gain 1 gold for each location you control and each location your opponent controls.',
    reveal: (g, p) => { const n = p.locs.length + p.opp.locs.length; p.gold += n; g.log(LX(`Trade Routes: ${p.name} ganha ${n} ouro.`, `Trade Routes: ${p.name} gains ${n} gold.`), 'gold'); } },
  '03052': { pt: 'Interrupção: quando a fase de taxation termina, compra 2 cartas ou ganha 3 ouro.', en: 'Interrupt: when the taxation phase ends, either draw 2 cards or gain 3 gold.',
    onTaxationEnd: async (g, pl) => { const p = pl.owner; const v = await p.ctrl.chooseOption(g, p, { prompt: LX("Ranger's Cache: comprar 2 cartas ou ganhar 3 ouro?", "Ranger's Cache: draw 2 cards or gain 3 gold?"), options: [{ label: LX('Comprar 2', 'Draw 2'), value: 'd' }, { label: LX('Ganhar 3 ouro', 'Gain 3 gold'), value: 'g' }], ai: o => (o.value === 'd') === (p.hand.length < 4) ? 1 : 0 });
      if (v === 'd') { g.log("Ranger's Cache:"); g.draw(p, 2); } else { p.gold += 3; g.log(LX(`Ranger's Cache: ${p.name} ganha 3 ouro.`, `Ranger's Cache: ${p.name} gains 3 gold.`), 'gold'); } } },

  // ---------- PERSONAGENS ----------
  '01133': { pt: "Ação de marshaling: ajoelha para reduzir em 1 o custo da próxima personagem Night's Watch.", en: "Marshaling action: kneel so your next Night's Watch character costs 1 less.",
    actions: (g, c) => reducerAct(g, c, 1, x => x.d.t === 'character' && x.d.f === 'thenightswatch', LX("personagem Night's Watch", "Night's Watch character")) },
  '01130': { pt: 'Sem anexos. Ação de dominance: devolve o Messenger Raven à mão para comprar 1 carta.', en: 'No attachments. Dominance action: return Messenger Raven to your hand to draw 1 card.',
    actions: (g, c) => { const p = c.owner; if (g.phase !== 'dominance' || c.trueOwner) return []; const close = Math.abs(g.domStr(p) - g.domStr(p.opp)) <= (c.kneel ? 0 : g.str(c));
      return [{ label: LX('Messenger Raven: voltar à mão e comprar 1', 'Messenger Raven: return to hand and draw 1'), ai: close ? 0 : 4, run: async () => { await g.returnToHand(c); g.draw(p, 1); } }]; } },
  '07016': { pt: "Ação de marshaling: ajoelha para reduzir em 1 o custo do próximo anexo ou local Night's Watch.", en: "Marshaling action: kneel so your next Night's Watch attachment or location costs 1 less.",
    actions: (g, c) => reducerAct(g, c, 1, x => (x.d.t === 'attachment' || x.d.t === 'location') && x.d.f === 'thenightswatch', LX("anexo/local Night's Watch", "Night's Watch attachment/location")) },
  '05041': { pt: 'Enquanto ataca um adversário com mais ouro do que tu, tem +2 STR.', en: 'While attacking an opponent with more gold than you, gets +2 STR.',
    str: (g, c) => g.ch && g.ch.attackers.includes(c) && c.owner.opp.gold > c.owner.gold ? 2 : 0 },
  '06085': { pt: 'Sem anexos exceto Weapon. Enquanto defende, tem +2 STR.', en: 'No attachments except Weapon. While defending, gets +2 STR.', attachOnly: 'Weapon',
    str: (g, c) => g.ch && g.ch.defenders.includes(c) ? 2 : 0 },
  '03040': { pt: 'Enquanto tiveres menos poder na facção do que o adversário, ganha stealth.', en: 'While you have less faction power than an opponent, gains stealth.',
    kw: (g, c) => c.owner.power < c.owner.opp.power ? { stealth: 1 } : {} },
  '01134': { pt: 'Sem anexos exceto Weapon. Ação: sacrifica o Veteran Builder para escolher e levantar um local.', en: 'No attachments except Weapon. Action: sacrifice Veteran Builder to choose and stand a location.', attachOnly: 'Weapon',
    actions: (g, c, ctx) => { const p = c.owner; if (ctx.reaction) return []; const t = p.locs.filter(l => l.kneel && g.canStand(l)); if (!t.length) return [];
      const wall = t.find(l => l.code === '01137'); const ai = wall && g.phase === 'challenges' && ctx.beforeChallenge && g.activeP === p ? 3 : 0;
      return [{ label: LX('Veteran Builder: sacrificar para levantar um local', 'Veteran Builder: sacrifice to stand a location'), ai, run: async () => { const [l] = await p.ctrl.chooseCards(g, p, { prompt: LX('Escolhe o local a levantar', 'Choose the location to stand'), cands: t, min: 1, max: 1, ai: y => y.code === '01137' ? 10 : (y.d.cost || 0) }); await g.sacrifice(c); l.kneel = false; g.log(LX(`${g.cn(l)} levanta-se.`, `${g.cn(l)} stands.`)); } }]; } },
  '01129': { pt: 'Reação: depois de fazeres marshal do Yoren, põe em jogo sob o teu controlo uma personagem com custo impresso ≤ 3 do descarte do adversário.', en: "Reaction: after you marshal Yoren, put a character with printed cost 3 or lower from an opponent's discard pile into play under your control.",
    onEnter: async (g, c, how) => { if (how !== 'marshal') return; await takeFromDiscard(g, c.owner, LX('Yoren: escolhe uma personagem do descarte do adversário (custo ≤ 3)', "Yoren: choose a character from the opponent's discard (cost ≤ 3)"), x => (x.d.cost || 0) <= 3); } },
  '01125': { pt: "Sem anexos. Interrupção: quando uma personagem Night's Watch seria morta, ajoelha o Maester Aemon para a salvar.", en: "No attachments. Interrupt: when a Night's Watch character would be killed, kneel Maester Aemon to save it.",
    saveOther: async (g, ae, c) => { if (ae.kneel || !isNW(g, c) || c.zone !== 'chars') return false; const p = ae.owner;
      const v = await p.ctrl.chooseOption(g, p, { prompt: LX(`Maester Aemon: ajoelhar para salvar ${g.cn(c)}?`, `Maester Aemon: kneel to save ${g.cn(c)}?`), options: yesNo(), ai: o => o.value === (AI.value(g, c) >= 3) ? 1 : 0, card: ae });
      if (!v) return false; ae.kneel = true; g.log(LX(`Maester Aemon salva ${g.cn(c)}.`, `Maester Aemon saves ${g.cn(c)}.`)); return true; } },
  '08105': { pt: 'Ação de desafios: ajoelha o Septon Cellador; o adversário descarta uma personagem da mão, a não ser que revele uma mão sem personagens.', en: 'Challenges action: kneel Septon Cellador; the opponent must discard a character from their hand unless they reveal a hand with no characters.',
    actions: (g, c, ctx) => { const p = c.owner, q = p.opp; if (c.kneel || g.phase !== 'challenges' || ctx.reaction || !q.hand.length) return [];
      return [{ label: LX('Septon Cellador: o adversário descarta uma personagem', 'Septon Cellador: opponent discards a character'), ai: ctx.beforeChallenge && g.activeP === p && (p.chDone.intrigue || !g.challengeAllowed(p, 'intrigue')) ? 6 : (ctx.beforeChallenge && g.activeP === p && q.hand.length >= 3 ? 3 : 0),
        run: async () => { c.kneel = true; const t = q.hand.filter(x => x.d.t === 'character'); if (!t.length) { g.log(LX(`${q.name} revela uma mão sem personagens.`, `${q.name} reveals a hand with no characters.`)); return; }
          const [x] = await q.ctrl.chooseCards(g, q, { prompt: LX('Septon Cellador: escolhe uma personagem da mão para descartar', 'Septon Cellador: choose a character from your hand to discard'), cands: t, min: 1, max: 1, ai: y => (y.code === '10035' ? 50 : 0) - AI.handValue(g, q, y) }); g.discardFromHand(q, x); g.log(LX(`${q.name} descarta ${g.cn(x)}.`, `${q.name} discards ${g.cn(x)}.`)); await g.flushPending(); } }]; } },
  '06045': { pt: 'Podes não o levantar na fase de standing. Ação de marshaling: ajoelha para tomar o controlo de uma personagem com custo impresso ≤ 2 até ele se levantar ou sair de jogo.', en: 'You may choose not to stand it during the standing phase. Marshaling action: kneel to take control of a character with printed cost 2 or lower until it stands or leaves play.',
    actions: (g, c) => { const p = c.owner; if (c.kneel || g.phase !== 'marshal' || g.activeP !== p) return []; const t = p.opp.chars.filter(x => (x.d.cost || 0) <= 2); if (!t.length) return [];
      return [{ label: LX('Recruiter: tomar o controlo de uma personagem (custo ≤ 2)', 'Recruiter: take control of a character (cost ≤ 2)'), ai: 8 + Math.max(...t.map(x => AI.value(g, x))) * 0.5,
        run: async () => { const [x] = await p.ctrl.chooseCards(g, p, { prompt: LX('Recruiter for the Watch: escolhe a personagem', 'Recruiter for the Watch: choose the character'), cands: t, min: 1, max: 1, ai: y => AI.value(g, y) }); c.kneel = true; g.takeControl(p, x); c.recruited = [...(c.recruited || []), x]; } }]; },
    onLeave: (g, c) => { for (const x of c.recruited || []) g.returnControl(x); c.recruited = []; } },
  '01132': { pt: 'Sem anexos exceto Weapon.', en: 'No attachments except Weapon.', attachOnly: 'Weapon' },
  '06017': { pt: 'Não pode ser ajoelhada por efeitos de cartas. Enquanto controlares outra Wildling, ganha stealth.', en: 'Cannot be knelt by card effects. While you control another Wildling character, gains stealth.',
    kw: (g, c) => c.owner.chars.some(x => x !== c && isWildling(g, x)) ? { stealth: 1 } : {} },
  '07007': { pt: 'Enquanto defende, ganha renown.', en: 'While defending, gains renown.', kw: (g, c) => g.ch && g.ch.defenders.includes(c) ? { renown: 1 } : {} },
  '07040': { pt: 'Reação: depois de uma Wildling entrar em jogo sob o teu controlo, compra 1 carta (1 vez por fase).', en: 'Reaction: after a Wildling character enters play under your control, draw 1 card (once per phase).',
    afterEnterPlay: (g, d, c) => { if (c.owner !== d.owner || !isWildling(g, c) || d.flags.dalla === g.phase) return; d.flags.dalla = g.phase; g.log('Dalla:'); g.draw(d.owner, 1); } },
  '01122': { pt: 'As tuas personagens Ranger não podem ser contornadas por stealth. Interrupção: quando o Benjen morre, ganhas 2 poder e ele é baralhado no baralho em vez de ir para a dead pile.', en: 'Each Ranger character you control cannot be bypassed by stealth. Interrupt: when Benjen is killed, gain 2 power for your faction and shuffle him into your deck instead of your dead pile.', killedToDeck: true },
  '06065': { pt: "Ação: ajoelha um local Night's Watch para uma personagem Night's Watch ganhar um ícone à tua escolha até ao fim da fase.", en: "Action: kneel a Night's Watch location to give a Night's Watch character a challenge icon of your choice until the end of the phase.",
    actions: (g, c, ctx) => { const p = c.owner; if (ctx.reaction) return []; const locs = p.locs.filter(l => !l.kneel && l.d.f === 'thenightswatch' && l.code !== '01137'); const chars = p.chars.filter(x => isNW(g, x)); if (!locs.length || !chars.length) return [];
      const need = ctx.beforeChallenge && g.activeP === p ? CH_TYPES.find(t => AI_NEW.remaining(g, p, t) > 0 && !p.chars.some(x => !x.kneel && g.hasIcon(x, t)) && chars.some(x => !x.kneel)) : null;
      return [{ label: LX('Othell Yarwyck: dar um ícone', 'Othell Yarwyck: grant an icon'), ai: need ? 5 : 0,
        run: async () => { const [l] = await p.ctrl.chooseCards(g, p, { prompt: LX('Escolhe o local a ajoelhar', 'Choose the location to kneel'), cands: locs, min: 1, max: 1, ai: y => -(y.d.cost || 0) }); l.kneel = true;
          const [x] = await p.ctrl.chooseCards(g, p, { prompt: LX('Escolhe a personagem', 'Choose the character'), cands: chars, min: 1, max: 1, ai: y => (y.kneel ? 0 : 10) + g.str(y) });
          const t = await p.ctrl.chooseOption(g, p, { prompt: LX('Que ícone?', 'Which icon?'), options: CH_TYPES.map(t => ({ label: CH_NAMES[t], value: t })), ai: o => o.value === need ? 2 : (g.hasIcon(x, o.value) ? 0 : 1) });
          x.phIcons = (x.phIcons || '') + ICON_OF[t]; g.log(LX(`${g.cn(x)} ganha o ícone ${CH_NAMES[t]}.`, `${g.cn(x)} gains a ${CH_NAMES[t]} icon.`)); } }]; } },
  '07003': { pt: 'Reação: depois de ganhares um desafio em que ele participa, põe em jogo sob o teu controlo uma personagem não-única do descarte do adversário.', en: "Reaction: after you win a challenge he took part in, put a non-unique character from the losing opponent's discard pile into play under your control.",
    afterWin: async (g, c, ch) => { if (ch.winner !== c.owner || !participating(g, c)) return; await takeFromDiscard(g, c.owner, LX('Old Bear Mormont: escolhe uma personagem não-única do descarte do adversário', "Old Bear Mormont: choose a non-unique character from the opponent's discard"), x => !x.d.u); } },
  '07001': { pt: "Stealth. Reação: depois de ganhares um desafio em que ele participa, levanta todas as Wildling atacantes ou todas as personagens Night's Watch defensoras (1 vez por fase).", en: "Stealth. Reaction: after you win a challenge he took part in, either stand each attacking Wildling character or each defending Night's Watch character (once per phase).",
    afterWin: (g, c, ch) => { const p = c.owner; if (ch.winner !== p || !participating(g, c) || c.flags.jon === g.phase) return;
      const list = ch.att === p ? ch.attackers.filter(x => isWildling(g, x)) : ch.defenders.filter(x => isNW(g, x));
      const t = list.filter(x => x.zone === 'chars' && x.kneel && g.canStand(x)); if (!t.length) return;
      c.flags.jon = g.phase; for (const x of t) x.kneel = false; g.log(LX(`Jon Snow: ${t.map(x => g.cn(x)).join(', ')} levantam-se.`, `Jon Snow: ${t.map(x => g.cn(x)).join(', ')} stand.`)); } },

  // ---------- ANEXOS ----------
  '07022': { pt: "A personagem ganha a afiliação Night's Watch. Com ícone Militar ganha o trait Ranger, com Intriga Steward e com Poder Builder.", en: "The attached character gains the Night's Watch affiliation. With a Military icon it gains Ranger, with Intrigue Steward, with Power Builder.",
    attachOk: (g, a, t, p) => t.owner === (p || a.owner) && t.d.f !== 'thenightswatch' },
  '07043': { pt: "Só personagem Night's Watch ou Wildling. Ação: ajoelha o Weirwood Bow para um defensor levar −2 STR até ao fim do desafio.", en: "Night's Watch or Wildling character only. Action: kneel Weirwood Bow to give a defending character −2 STR until the end of the challenge.",
    attachOk: (g, a, t) => isNW(g, t) || isWildling(g, t),
    actions: (g, a, ctx) => { const p = a.owner, ch = g.ch; if (a.kneel || !ch || !ch.defenders.length || ctx.reaction) return []; const ai = ch.att === p ? AI.pumpScore(g, p, ch, 2) : 0;
      return [{ label: LX('Weirwood Bow: −2 STR a um defensor', 'Weirwood Bow: −2 STR to a defender'), ai, run: async () => { const [x] = await p.ctrl.chooseCards(g, p, { prompt: LX('Weirwood Bow: escolhe o defensor', 'Weirwood Bow: choose the defender'), cands: [...ch.defenders], min: 1, max: 1, ai: y => y.owner !== p ? g.str(y) : -10 }); a.kneel = true; x.tmp -= 2; g.log(LX(`${g.cn(x)} leva −2 STR.`, `${g.cn(x)} gets −2 STR.`)); } }]; } },
  '01135': { pt: "Só personagem Night's Watch. +1 STR e renown.", en: "Night's Watch character only. +1 STR and renown.", attachOk: (g, a, t) => isNW(g, t), attStr: () => 1, attKw: () => ({ renown: 1 }) },

  // ---------- EVENTOS ----------
  '10044': { pt: 'Ação de desafios: uma personagem ganha ícones Militar, Intriga e Poder até ao fim da fase. Compra 1 carta.', en: 'Challenges action: a character gains Military, Intrigue and Power icons until the end of the phase. Draw 1 card.',
    ev: { timing: 'action', cond: (g, p, ctx) => g.phase === 'challenges' && !ctx.reaction && p.chars.length > 0, ai: (g, p, ctx) => ctx.beforeChallenge && g.activeP === p && p.chars.some(c => !c.kneel && CH_TYPES.some(t => !g.hasIcon(c, t) && AI_NEW.remaining(g, p, t) > 0) && g.str(c) >= 3) ? 6 : 0,
      run: async (g, p) => { const [c] = await p.ctrl.chooseCards(g, p, { prompt: LX('"Off to Gulltown": escolhe a personagem', '"Off to Gulltown": choose the character'), cands: [...p.chars], min: 1, max: 1, ai: y => (y.kneel ? 0 : 10) + g.str(y) }); c.phIcons = (c.phIcons || '') + 'MIP'; g.log(LX(`${g.cn(c)} ganha os três ícones.`, `${g.cn(c)} gains all three icons.`)); g.draw(p, 1); } } },
  '07023': { pt: 'Reação: depois de uma personagem com custo impresso ≤ 5 ir para o descarte do adversário, põe-na em jogo sob o teu controlo.', en: "Reaction: after a character with printed cost 5 or lower is placed in an opponent's discard pile, put it into play under your control." },
  '01139': { pt: 'Ação de dominance: toma o controlo de uma personagem não-única com custo impresso ≤ 6 (máx. 1 por ronda).', en: 'Dominance action: take control of a non-unique character with printed cost 6 or lower (max 1 per round).',
    ev: { timing: 'action', cond: (g, p, ctx) => g.phase === 'dominance' && !ctx.reaction && !p.flags.ttb && p.opp.chars.some(c => !c.d.u && (c.d.cost || 0) <= 6), ai: (g, p) => Math.max(0, ...p.opp.chars.filter(c => !c.d.u && (c.d.cost || 0) <= 6).map(c => AI.value(g, c))) >= 5 ? 14 : 0,
      run: async (g, p) => { p.flags.ttb = true; const t = p.opp.chars.filter(c => !c.d.u && (c.d.cost || 0) <= 6); const [c] = await p.ctrl.chooseCards(g, p, { prompt: LX('Take the Black: escolhe a personagem', 'Take the Black: choose the character'), cands: t, min: 1, max: 1, ai: y => AI.value(g, y) }); g.takeControl(p, c); } } },

  // ---------- LOCAIS ----------
  '03034': { pt: 'Reação: depois de ganhares um desafio como defensor, ajoelha para escolher uma personagem do adversário que não pode atacar nesta fase.', en: 'Reaction: after you win a challenge as the defending player, kneel to choose a character of the losing opponent; it cannot be declared as an attacker this phase.',
    afterWin: async (g, l, ch) => { const p = l.owner; if (l.kneel || ch.winner !== p || ch.def !== p) return; const t = ch.loser.chars.filter(x => !x.kneel && x.flags.noAttack !== g.phase); if (!t.length) return;
      const [x] = await p.ctrl.chooseCards(g, p, { prompt: LX('The Shadow Tower: escolhe uma personagem que não pode atacar (ou nenhuma)', 'The Shadow Tower: choose a character that cannot attack (or none)'), cands: t, min: 0, max: 1, ai: y => g.str(y) }); if (!x) return; l.kneel = true; x.flags.noAttack = g.phase; g.log(LX(`${g.cn(x)} não pode atacar nesta fase.`, `${g.cn(x)} cannot attack this phase.`)); } },
  '07019': { pt: 'Ação: ajoelha para revelar as 3 cartas do topo do baralho do adversário; podes pôr 1 personagem revelada no descarte dele; as outras vão para o fundo.', en: "Action: kneel to reveal the top 3 cards of an opponent's deck; you may place 1 revealed character in their discard pile; the rest go to the bottom.",
    actions: (g, l, ctx) => { const p = l.owner, q = p.opp; if (l.kneel || ctx.reaction || q.deck.length < 1) return [];
      return [{ label: LX('Queenscrown: revelar 3 cartas do adversário', "Queenscrown: reveal opponent's top 3"), ai: p.hand.some(c => c.code === '07023') && p.gold >= 2 ? 8 : 2,
        run: async () => { l.kneel = true; const top = q.deck.splice(0, 3); g.log(LX(`Queenscrown revela: ${top.map(c => g.cn(c)).join(', ')}.`, `Queenscrown reveals: ${top.map(c => g.cn(c)).join(', ')}.`)); top.forEach(c => c.zone = 'limbo');
          const chars = top.filter(c => c.d.t === 'character'); let pick = null;
          if (chars.length) [pick] = await p.ctrl.chooseCards(g, p, { prompt: LX('Queenscrown: escolhe uma personagem para o descarte do adversário (ou nenhuma)', "Queenscrown: choose a character for the opponent's discard (or none)"), cands: chars, min: 0, max: 1, ai: y => AI.value(g, y), modal: true });
          for (const c of top) { if (c === pick) { g.toZone(c, 'discard'); g.log(LX(`${g.cn(c)} vai para o descarte de ${q.name}.`, `${g.cn(c)} goes to ${q.name}'s discard pile.`)); g.onDiscardedFromHandOrDeck(c); } else { c.zone = 'deck'; q.deck.push(c); } }
          await g.flushPending(); } }]; } },
  '05032': { pt: 'Interrupção: quando a fase de desafios termina, o adversário que não iniciou um desafio Militar contra ti descarta 1 carta ao acaso da mão.', en: 'Interrupt: when the challenges phase ends, an opponent who did not initiate a Military challenge against you discards 1 card at random from their hand.',
    onChallengesEnd: async (g, l) => { const q = l.owner.opp; if ((q.chDone.military || 0) > 0 || !q.hand.length) return; const c = q.hand[Math.floor(Math.random() * q.hand.length)]; g.discardFromHand(q, c); g.log(LX(`Bridge of Skulls: ${q.name} descarta ao acaso ${g.cn(c)}.`, `Bridge of Skulls: ${q.name} discards ${g.cn(c)} at random.`)); await g.flushPending(); } },
  '06046': { pt: 'Limited. Ação de marshaling: ajoelha para ganhar 1 ouro (2 se o plot revelado do adversário tiver 5 ou mais de ouro).', en: "Limited. Marshaling action: kneel to gain 1 gold (2 if an opponent's revealed plot has a gold value of 5 or higher).",
    actions: (g, c) => gainGoldAct(g, c, c.owner.opp.plot && c.owner.opp.plot.d.p[0] >= 5 ? 2 : 1) },
  '06006': { pt: 'Reação: no início da dominance, se o teu reserve for maior do que o do adversário, compra 1 carta. +1 Reserve.', en: 'Reaction: when dominance begins, if your reserve is higher than an opponent\'s, draw 1 card. +1 Reserve.',
    onPhaseBegin: (g, l, ph) => { const p = l.owner; if (ph !== 'dominance' || g.reserve(p) <= g.reserve(p.opp)) return; g.log('Eastwatch-by-the-Sea:'); g.draw(p, 1); } },
  '01136': { pt: "Ação: ajoelha o Castle Black para levantar uma personagem Night's Watch que esteja a defender; ela tem +2 STR até ao fim do desafio.", en: "Action: kneel Castle Black to stand a defending Night's Watch character; it gets +2 STR until the end of the challenge.",
    actions: (g, l, ctx) => { const p = l.owner, ch = g.ch; if (l.kneel || !ch || ch.def !== p || ctx.reaction) return []; const t = ch.defenders.filter(x => isNW(g, x) && x.owner === p && x.zone === 'chars'); if (!t.length) return [];
      return [{ label: LX('Castle Black: levantar um defensor (+2 STR)', 'Castle Black: stand a defender (+2 STR)'), ai: Math.max(AI.pumpScore(g, p, ch, 2), 6),
        run: async () => { const [x] = await p.ctrl.chooseCards(g, p, { prompt: LX('Castle Black: escolhe o defensor', 'Castle Black: choose the defender'), cands: t, min: 1, max: 1, ai: y => g.str(y) }); l.kneel = true; x.kneel = false; x.tmp += 2; g.log(LX(`${g.cn(x)} levanta-se e ganha +2 STR.`, `${g.cn(x)} stands and gets +2 STR.`)); } }]; } },
  '01137': { pt: "As tuas personagens Night's Watch têm +1 STR. Reação forçada: depois de perderes um desafio sem oposição, ajoelha The Wall. Interrupção: quando termina a fase de desafios, ajoelha The Wall para ganhar 2 poder.", en: "Each Night's Watch character you control gets +1 STR. Forced reaction: after you lose an unopposed challenge, kneel The Wall. Interrupt: when the challenges phase ends, kneel The Wall to gain 2 power.",
    strAura: (g, w, c) => c.owner === w.owner && isNW(g, c) ? 1 : 0,
    afterWin: (g, w, ch) => { if (ch.loser === w.owner && ch.unopposed && !w.kneel) { w.kneel = true; g.log(LX('The Wall ajoelha (desafio sem oposição perdido).', 'The Wall kneels (lost an unopposed challenge).')); } },
    onChallengesEnd: (g, w) => { if (w.kneel) return; w.kneel = true; g.log('The Wall:'); g.gainPower(w.owner, 2); } },
};
for (const [code, e] of Object.entries(NW)) { AB[code] = e; if (e.en) AB_EN[code] = e.en; }

STARTER_DECKS.push(
  mkDeckP("Intro — Night's Watch: The Brotherhood of the Watch", 'thenightswatch', '01027', [
    ['Valar Dohaeris', "The Archmaester's Key", 1], ['Trade Routes', 'House of Thorns', 1], ['Sneak Attack', 'Core Set', 1], ["Ranger's Cache", 'Wolves of the North', 1], ['Marched to the Wall', 'Core Set', 1], ['Late Summer Feast', 'All Men Are Fools', 1], ['Building Orders', 'Core Set', 1],
    ['Steward at the Wall', 'Core Set', 3], ['Messenger Raven', 'Core Set', 3], ['Builder at the Wall', 'Watchers on the Wall', 2], ['Wildling Bandit', 'Lions of Casterly Rock', 2], ['Defender of the Wall', "Oberyn's Revenge", 2], ['Samwell Tarly', 'Core Set', 2], ['Young Spearwife', 'Wolves of the North', 1], ['Veteran Builder', 'Core Set', 2], ['Yoren', 'Core Set', 1], ['Maester Aemon', 'Core Set', 1], ['Septon Cellador', 'Someone Always Tells', 1], ['Recruiter for the Watch', 'The Fall of Astapor', 2], ['Ranging Party', 'Core Set', 2], ['Ygritte', 'All Men Are Fools', 2], ['Ser Denys Mallister', 'Watchers on the Wall', 1], ['Dalla', 'Watchers on the Wall', 1], ['Benjen Stark', 'Core Set', 1], ['Othell Yarwyck', 'The Red Wedding', 1], ['Old Bear Mormont', 'Watchers on the Wall', 2], ['Jon Snow', 'Watchers on the Wall', 3],
    ['Sworn to the Watch', 'Watchers on the Wall', 2], ['Weirwood Bow', 'Watchers on the Wall', 1], ['Longclaw', 'Core Set', 1],
    ['"Off To Gulltown"', 'Sands of Dorne', 2], ['Now My Watch Begins', 'Watchers on the Wall', 2], ['Take the Black', 'Core Set', 1],
    ['The Roseroad', 'Core Set', 3], ['The Kingsroad', 'Core Set', 3], ['The Shadow Tower', 'Wolves of the North', 1], ['Queenscrown', 'Watchers on the Wall', 1], ['Bridge of Skulls', 'Lions of Casterly Rock', 1], ['Underground Vault', 'The Fall of Astapor', 2], ['Eastwatch-by-the-Sea', 'All Men Are Fools', 1], ['Castle Black', 'Core Set', 1], ['The Wall', 'Core Set', 3],
  ]),
);
