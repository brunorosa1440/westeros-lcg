// ================= IA v2 — planeamento de desafios e defesa por custo/benefício =================
// Cada função recebe (g, p, ...). Jogadores com ctrl.legacy usam a IA base (para comparação).
const AIK = { first: 'calc', ratio: 2, defK: 0.8, oppK: 0.7, baseMarshal: false };
const AI_NEW = {
  powW(g, p) { const t = g.totalPower(p); return 3 + (t >= 10 ? 1.5 : 0) + (t >= 13 ? 2 : 0); },
  noKneel(g, c, t) { return !!(ab(c).noKneelAttack && !g.blank(c) && ab(c).noKneelAttack(g, c, t)); },
  remaining(g, p, t) { return Math.max(0, g.maxOfType(p, t) - (p.chDone[t] || 0)); },
  // o adversário ainda vai atacar nesta fase?
  oppStillAttacks(g, p) { return g.phase === 'challenges' && g.first === p; },
  // eu ainda vou atacar nesta fase (estou a defender antes do meu turno)?
  iStillAttack(g, p) { return g.phase === 'challenges' && g.first !== p && g.activeP !== p; },
  charValue(g, c) { return c.dupes.length ? 2 : AI_BASE.value(g, c); },
  // custo de ajoelhar c para atacar no tipo t
  attackUseCost(g, p, c, t) {
    if (AI_NEW.noKneel(g, c, t)) return 0;
    let cost = g.str(c) * 0.12;
    for (const t2 of CH_TYPES) if (t2 !== t && AI_NEW.remaining(g, p, t2) > 0 && g.hasIcon(c, t2)) cost += 1.1;
    if (AI_NEW.oppStillAttacks(g, p)) for (const t2 of CH_TYPES) if (g.hasIcon(c, t2) && p.opp.chars.some(o => !o.kneel && g.hasIcon(o, t2))) cost += (0.9 + g.str(c) * 0.2) * AIK.oppK;
    return cost;
  },
  // custo de ajoelhar c para defender
  defendUseCost(g, p, c, ch) {
    let cost = g.str(c) * 0.12;
    if (AI_NEW.iStillAttack(g, p)) for (const t2 of CH_TYPES) if (AI_NEW.remaining(g, p, t2) > 0 && g.hasIcon(c, t2)) cost += (1.4 + g.str(c) * 0.15) * AIK.defK;
    const q = ch.att;
    for (const t2 of CH_TYPES) if (t2 !== ch.type && (q.chDone[t2] || 0) < g.maxOfType(q, t2) && g.hasIcon(c, t2)) cost += 0.8;
    return cost;
  },
  claimFor(g, p, t, set) {
    let v = p.plot ? p.plot.d.p[2] : 1;
    for (const c of set) if (!g.blank(c) && ab(c).claimMod) v += ab(c).claimMod(g, c, { type: t });
    if (g.myPlot(p.opp, '01008') && p.opp.plot.flags.calmType === t) v -= 1;
    return Math.max(0, v);
  },
  // valor do claim para o atacante p contra q
  claimGain(g, p, q, t, claim) {
    const W = AI_NEW.powW(g, p);
    if (t === 'military') { const v = q.chars.map(c => AI_NEW.charValue(g, c)).sort((a, b) => a - b).slice(0, claim); return v.reduce((s, x) => s + x, 0) * 0.85; }
    if (t === 'intrigue') return Math.min(claim, q.hand.length) * 2.2 + (p.locs.some(l => l.code === '01098') ? 1.5 : 0);
    return Math.min(claim, q.power) * (W + 2);
  },
  // força defensiva provável do adversário contra este conjunto (stealth retira os melhores defensores)
  defenseAgainst(g, p, t, set) {
    const q = p.opp;
    // Eddard Stark levanta-se quando é atacado
    let defs = q.chars.filter(c => (!c.kneel || (c.code === '01144' && !g.blank(c))) && g.hasIcon(c, t)).sort((a, b) => g.str(b) - g.str(a));
    let k = set.filter(c => g.hasKw(c, 'stealth')).length;
    defs = defs.filter(d => { if (k > 0 && !g.hasKw(d, 'stealth')) { k--; return false; } return true; });
    return defs.reduce((s, c) => s + g.str(c), 0);
  },
  evalAttack(g, p, t, set) {
    const q = p.opp, W = AI_NEW.powW(g, p);
    const S = set.reduce((s, c) => s + g.str(c), 0), D = AI_NEW.defenseAgainst(g, p, t, set);
    const margin = S - D;
    const tricks = q.hand.length ? (q.gold >= 1 ? 1.5 : 0.8) : 0;
    let prob = margin > tricks + 1 ? 0.95 : margin >= 1 ? 0.8 : margin === 0 ? 0.55 : (-margin <= 2 ? 0.25 : 0.08);
    if (D === 0) prob = 0.98;
    const claim = AI_NEW.claimFor(g, p, t, set);
    let gain = AI_NEW.claimGain(g, p, q, t, claim);
    if (D === 0) gain += W;
    for (const c of set) {
      if (g.hasKw(c, 'renown') || (c.code === '01087' && t === 'military')) gain += W;
      if (g.hasKw(c, 'insight')) gain += 1.5;
      if (g.hasKw(c, 'pillage')) gain += 0.4;
      if (g.hasKw(c, 'intimidate')) gain += 1.2;
    }
    if (t === 'power' && g.myPlot(p, '01001') && q.power > 0) gain += W + 1;
    if (t === 'military' && p.hand.some(c => c.code === '01041') && p.gold >= 2 && margin >= 5) gain += 4;
    let cost = 0; for (const c of set) cost += AI_NEW.attackUseCost(g, p, c, t);
    // se perdermos, os defensores com renown ganham poder
    const defRenown = q.chars.filter(c => !c.kneel && g.hasIcon(c, t) && g.hasKw(c, 'renown')).length;
    return prob * gain - cost - (1 - prob) * defRenown * W * 0.5;
  },
  bestAttack(g, p, t) {
    let cands = p.chars.filter(c => g.canAttackWith(p, c, t)).sort((a, b) => g.str(b) - g.str(a)).slice(0, 11);
    if (!cands.length) return null;
    if (g.anyPlot('01014')) return cands.map(c => ({ set: [c], v: AI_NEW.evalAttack(g, p, t, [c]) })).sort((a, b) => b.v - a.v)[0];
    let best = null; const n = cands.length;
    for (let m = 1; m < (1 << n); m++) {
      const set = []; for (let i = 0; i < n; i++) if (m & (1 << i)) set.push(cands[i]);
      const v = AI_NEW.evalAttack(g, p, t, set);
      if (!best || v > best.v + 1e-9 || (Math.abs(v - best.v) < 1e-9 && set.length < best.set.length)) best = { set, v };
    }
    // personagens que não ajoelham entram sempre
    for (const c of cands) if (!best.set.includes(c) && AI_NEW.noKneel(g, c, t)) best.set.push(c);
    return best;
  },
  challengeScore(g, p, t) {
    const b = AI_NEW.bestAttack(g, p, t);
    if (!b || b.v <= 0.5) return 0;
    return 5 + b.v;
  },
  pickAttackers(g, p, t, cands, jousting) {
    const b = AI_NEW.bestAttack(g, p, t);
    if (b && b.set.length) return b.set.filter(c => cands.includes(c));
    return AI_BASE.pickAttackers(g, p, t, cands, jousting);
  },
  stealthScore(g, p, x, t) { return (!x.kneel && g.hasIcon(x, t)) ? g.str(x) * 2 + 5 + (g.hasKw(x, 'renown') ? 3 : 0) : 0.1; },
  lossIfLose(g, p, ch, defended) {
    const q = ch.att, W = AI_NEW.powW(g, p), claim = g.claimValue(ch);
    let L;
    if (ch.type === 'military') L = p.chars.map(c => AI_NEW.charValue(g, c)).sort((a, b) => a - b).slice(0, claim).reduce((s, x) => s + x, 0);
    else if (ch.type === 'intrigue') L = Math.min(claim, p.hand.length) * 2.2;
    else L = Math.min(claim, p.power) * (W + 2);
    if (!defended) L += W; // unopposed
    for (const c of ch.attackers) if (g.hasKw(c, 'renown')) L += W;
    if (ch.type === 'power' && g.myPlot(q, '01001') && p.power > 0) L += W + 1;
    return L;
  },
  pickDefenders(g, p, ch, dc, jousting) {
    const A = g.sumStr(ch.attackers), W = AI_NEW.powW(g, p);
    const tricks = ch.att.hand.length ? (ch.att.gold >= 1 ? 1.5 : 0.8) : 0;
    let best = { set: [], cost: AI_NEW.lossIfLose(g, p, ch, false) };
    const cands = [...dc].sort((a, b) => g.str(b) - g.str(a)).slice(0, 11), n = cands.length;
    const lim = jousting ? 1 : n;
    for (let m = 1; m < (1 << n); m++) {
      const set = []; for (let i = 0; i < n; i++) if (m & (1 << i)) set.push(cands[i]);
      if (set.length > lim) continue;
      const S = set.reduce((s, c) => s + g.str(c), 0);
      let use = 0; for (const c of set) use += AI_NEW.defendUseCost(g, p, c, ch);
      let cost;
      if (S > A) {
        const margin = S - A;
        const prob = margin > tricks + 1 ? 0.93 : margin >= 2 ? 0.85 : 0.72;
        const renownGain = set.filter(c => g.hasKw(c, 'renown')).length * W;
        cost = (1 - prob) * AI_NEW.lossIfLose(g, p, ch, true) + use - prob * renownGain;
      } else cost = AI_NEW.lossIfLose(g, p, ch, S > 0) + use;
      if (cost < best.cost - 1e-9 || (Math.abs(cost - best.cost) < 1e-9 && set.length < best.set.length)) best = { set, cost };
    }
    return best.set;
  },
  firstPlayerScore(g, w, choice) {
    const strOf = p => p.chars.reduce((s, c) => s + g.str(c), 0);
    const me = strOf(w), them = strOf(w.opp);
    const wantFirst = AIK.first === 'self' ? true : AIK.first === 'opp' ? false : me >= them * (AIK.ratio || 1.5);
    return (choice === w) === wantFirst ? 1 : 0;
  },
  marshalScore(g, p, c) {
    if (AIK.baseMarshal) return AI_BASE.marshalScore(g, p, c);
    if (g.findDupeTarget(p, c)) { const t = g.findDupeTarget(p, c); return 9 + (t.d.t === 'character' ? Math.min(6, AI_BASE.value(g, t) * 0.5) : 0); }
    if (c.d.t === 'character') {
      if (c.code === '01095') return 2;
      let s = 10 + g.str(c) + AI_BASE.iconsCount(g, c) * 2 + (c.d.cost || 0) * 0.5;
      for (const t of CH_TYPES) if (g.hasIcon(c, t) && p.chars.filter(x => g.hasIcon(x, t)).length < 2) s += 2.5;
      if (c.d.k?.renown) s += 2.5; if (c.d.k?.stealth) s += 1.5; if (c.d.k?.insight) s += 1.5;
      if (c.d.m?.income) s += g.round <= 3 ? 7 : 3;
      return s;
    }
    if (c.d.t === 'location') {
      if (c.d.m?.income) return g.round <= 4 ? 40 : 18;
      if (c.code === '01039') return p.hand.some(x => x.d.t === 'character' && (x.d.cost || 0) >= 5) ? 25 : 4;
      if (c.code === '01038') return 12;
      return 8 + (c.d.cost || 0);
    }
    return AI_BASE.marshalScore(g, p, c);
  },
};
// Proxy: escolhe a implementação conforme o jogador (IA nova por omissão; ctrl.legacy → base)
const AI = new Proxy({}, {
  get(_, k) {
    return (...args) => {
      const p = args[1];
      const legacy = p && p.ctrl && p.ctrl.legacy;
      const impl = (!legacy && AI_NEW[k]) ? AI_NEW[k] : (AI_BASE[k] || AI_NEW[k]);
      return impl(...args);
    };
  }
});
