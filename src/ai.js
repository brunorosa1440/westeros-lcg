// ================= IA HEURÍSTICA =================
const AI = {
  value(g, c) { return (c.d.cost || 0) + (c.d.t === 'character' ? g.str(c) : 0) + 2 * c.power + (c.d.u ? 2 : 0) + c.att.length * 1.5 + c.dupes.length * 2; },
  iconsCount(g, c) { return CH_TYPES.filter(t => g.hasIcon(c, t)).length; },
  handValue(g, p, c) { if (c.d.t === 'event') return 3 + (c.d.cost === 'X' ? 2 : 0); return (c.d.cost || 0) + (c.d.s || 0) + (c.d.u && g.findDupeTarget(p, c) ? 4 : 0); },
  defPotential(g, p, type, exclude = []) { // força máxima que p pode defender
    return p.chars.filter(c => !c.kneel && g.hasIcon(c, type) && !exclude.includes(c)).reduce((s, c) => s + g.str(c), 0);
  },
  attPotential(g, p, type) { return p.chars.filter(c => g.canAttackWith(p, c, type)).reduce((s, c) => s + g.str(c), 0); },
  setupScore(g, p, c, budget) {
    if (g.findDupeTarget(p, c)) return 6;
    if (c.d.t === 'character') return 10 + g.str(c) + (c.d.cost || 0) + AI.iconsCount(g, c) - (c.d.k?.ambush ? 3 : 0);
    if (c.d.t === 'location') return (c.d.m?.income ? 12 : 4) + (c.d.cost || 0);
    if (c.d.t === 'attachment') return c.code === '01035' ? (p.opp.chars.length ? 3 : -1) : (p.chars.some(t => AI.attachScore(g, p, c, t) > 0) ? 3 : -1);
    return -1;
  },
  attachScore(g, p, a, t) {
    if (a.code === '01035') return t.owner !== p ? AI.value(g, t) + (DB[t.code].v ? -5 : 3) : -50;
    if (t.owner !== p) return -50;
    let s = AI.value(g, t);
    const gives = { '01034': 'intrigue', '01036': 'power', '01037': 'military' }[a.code];
    if (gives) s += g.hasIcon(t, gives) ? -6 : 6;
    if (a.code === '01032' || a.code === '01096' || a.code === '01153') s += g.str(t);
    return s;
  },
  marshalScore(g, p, c) {
    if (g.findDupeTarget(p, c)) return 9;
    if (c.d.t === 'character') {
      if (c.code === '01095') return 2; // melhor por ambush
      return 10 + g.str(c) + AI.iconsCount(g, c) * 2 + (c.d.cost || 0) + (c.d.m?.income ? 6 : 0);
    }
    if (c.d.t === 'location') { if (c.d.m?.income) return 40; if (c.code === '01038') return 12; if (c.code === '01039') return 25; return 8 + (c.d.cost || 0); }
    if (c.d.t === 'attachment') { const best = Math.max(-50, ...g.attachTargets(p, c).map(t => AI.attachScore(g, p, c, t))); return best > 0 ? 6 + Math.min(best, 8) * 0.3 : -1; }
    return -1;
  },
  reducerScore(g, p, filter, amt, sac) {
    if (g.phase !== 'marshal' || g.activeP !== p) return 0;
    const already = p.reducers.filter(r => r.modes.includes('marshal'));
    const want = p.hand.filter(c => filter(c) && ['character', 'location', 'attachment'].includes(c.d.t) && !g.findDupeTarget(p, c) && AI.marshalScore(g, p, c) > 0 && !g.uniqueBlockedByDead(p, c));
    for (const c of want) {
      const cur = g.costOf(p, c, 'marshal');
      if (cur <= 0) continue;
      if (cur - amt > p.gold) continue;
      if (sac && cur < 4) continue;
      if (already.length && already.some(r => r.f(c))) { if (cur > 0) return 60; continue; }
      return 60;
    }
    return 0;
  },
  plotScore(g, p, pl) {
    const [inc, ini, claim] = pl.d.p; let s = inc * 1.3 + ini * 0.15 + claim * 2 + Math.random() * 2.5;
    const q = p.opp;
    switch (pl.code) {
      case '01010': s += p.hand.length < 4 ? 4 : -1; break;
      case '01026': s += (q.chars.length - p.chars.length >= 2) ? 8 : -12; break;
      case '01015': s += q.chars.length ? 1 : -3; break;
      case '01020': s += [...p.hand, ...p.discard].some(c => c.d.t === 'character' && (c.d.cost || 0) >= 4 && (c.d.cost || 0) <= 5) ? 5 : -6; break;
      case '01022': case '01006': s += 2; break;
      case '01011': s += 2; break;
      case '01013': s += q.hand.length > 2 ? 2 : -1; break;
      case '01007': s += q.chars.length * 0.9; break;
      case '01012': s -= 4; break;
      case '01003': case '01014': s -= 1; break;
      case '01005': s += p.chars.filter(c => g.hasIcon(c, 'military')).length * 0.5; break;
      case '01016': s -= p.hand.filter(c => c.d.t !== 'character').length * 0.8; break;
    }
    if (g.round === 1) s += inc * 0.6;
    return s;
  },
  challengeScore(g, p, t) {
    const q = p.opp;
    const myA = AI.attPotential(g, p, t);
    const stealthers = p.chars.filter(c => g.canAttackWith(p, c, t) && g.hasKw(c, 'stealth')).length;
    const defs = q.chars.filter(c => !c.kneel && g.hasIcon(c, t)).sort((a, b) => g.str(b) - g.str(a));
    const D = defs.slice(stealthers).reduce((s, c) => s + g.str(c), 0);
    if (myA <= 0) return 0;
    const pri = { military: 3, power: 2, intrigue: 2.5 }[t];
    if (t === 'intrigue' && !q.hand.length && !p.locs.some(l => l.code === '01098')) return D === 0 ? 4 : 0.5;
    if (t === 'military' && !q.chars.length) return D === 0 ? 3 : 0;
    if (D === 0) return 20 + pri;
    if (myA > D) return 10 + pri;
    if (myA === D) return 6 + pri;
    return 0;
  },
  pickAttackers(g, p, type, cands, jousting) {
    const q = p.opp;
    const sorted = [...cands].sort((a, b) => g.str(b) - g.str(a));
    if (jousting) return [sorted[0]];
    const stealth = sorted.filter(c => g.hasKw(c, 'stealth')).length;
    const defs = q.chars.filter(c => !c.kneel && g.hasIcon(c, type)).sort((a, b) => g.str(b) - g.str(a));
    const D = defs.slice(stealth).reduce((s, c) => s + g.str(c), 0);
    if (D === 0) { // um atacante basta; prefere quem não ajoelha / renown
      const best = [...sorted].sort((a, b) => ((ab(b).noKneelAttack && ab(b).noKneelAttack(g, b, type)) ? 5 : 0) + (g.hasKw(b, 'renown') ? 3 : 0) - ((ab(a).noKneelAttack && ab(a).noKneelAttack(g, a, type)) ? 5 : 0) - (g.hasKw(a, 'renown') ? 3 : 0));
      const r = [best[0]];
      for (const c of sorted) if (!r.includes(c) && (g.hasKw(c, 'renown') || (ab(c).noKneelAttack && ab(c).noKneelAttack(g, c, type)))) r.push(c);
      return r;
    }
    const r = []; let s = 0;
    for (const c of sorted) { r.push(c); s += g.str(c); if (s > D) break; }
    // incluir quem não ajoelha (grátis)
    for (const c of sorted) if (!r.includes(c) && ab(c).noKneelAttack && ab(c).noKneelAttack(g, c, type)) r.push(c);
    return r;
  },
  stealthScore(g, p, x, type) { return (!x.kneel && g.hasIcon(x, type)) ? g.str(x) + 5 : 0.1; },
  pickDefenders(g, p, ch, dc, jousting) {
    const A = g.sumStr(ch.attackers);
    const sorted = [...dc].sort((a, b) => g.str(b) - g.str(a));
    if (jousting) return g.str(sorted[0]) > A ? [sorted[0]] : [];
    let r = [], s = 0;
    for (const c of sorted) { r.push(c); s += g.str(c); if (s > A) break; }
    if (s > A) {
      // remover desnecessários (menores primeiro)
      for (const c of [...r].reverse()) if (s - g.str(c) > A) { r = r.filter(x => x !== c); s -= g.str(c); }
      const claimHurts = ch.type === 'military' || ch.type === 'power' || p.hand.length > 1;
      if (claimHurts || Math.random() < 0.6) return r;
      return [];
    }
    // não ganha: evitar unopposed com uma personagem barata
    const cheap = sorted.filter(c => g.str(c) >= 1).sort((a, b) => AI.value(g, a) - AI.value(g, b))[0];
    if (cheap && AI.value(g, cheap) < 7 && Math.random() < 0.5) return [cheap];
    return [];
  },
  ambushScore(g, p, c, ctx) {
    if (!ctx.beforeChallenge) return 0;
    if (c.code === '01095') return (p.hand.length - 1 > p.opp.hand.length && p.opp.chars.length) ? 25 : 0;
    if (c.d.t === 'character') return (CH_TYPES.some(t => g.challengeAllowed(p, t) || !(p.chDone[t])) && g.hasIcon(c, 'military')) ? 7 + g.str(c) : 2;
    if (c.d.t === 'attachment') return 3;
    return 0;
  },
  standScore(g, p, ctx) {
    // levantar personagens: depois de atacar, para defender/dominance
    if (g.phase === 'challenges' && ctx.beforeChallenge && g.activeP === p) return 4;
    if (g.phase === 'dominance') return 6;
    return 0;
  },
  pumpScore(g, p, ch, n) {
    if (!ch) return 0;
    const A = g.sumStr(ch.attackers), D = g.sumStr(ch.defenders);
    if (ch.att === p) { if (A < D && A + n >= D) return 30; return A >= D && A - D < 5 && A - D + n >= 5 ? 8 : 0; }
    if (D <= A && D + n > A) return 30;
    return 0;
  },
  wicScore(g, p) { const ch = g.ch; if (!ch) return 0; const A = g.sumStr(ch.attackers), D = g.sumStr(ch.defenders); return A >= D && A > 0 ? 15 : 0; },
  hmrScore(g, p, ctx) {
    if (g.phase === 'challenges' && ctx.beforeChallenge) { const best = p.hand.filter(c => c.d.t === 'character' && c.d.f === 'lannister').map(c => g.str(c)).sort((a, b) => b - a)[0] || 0; return best >= 4 && CH_TYPES.some(t => g.challengeAllowed(p, t)) ? 9 : 0; }
    return 0;
  },
  tidflScore(g, p) {
    const t = p.opp.chars.filter(c => (c.d.cost || 0) <= p.gold && (c.d.cost || 0) >= 4);
    return t.length ? 12 : 0;
  },
  greyWindScore(g, p, gw, targets, ctx) {
    const enemy = targets.filter(x => x.owner !== p);
    if (!enemy.length) return 0;
    const best = Math.max(...enemy.map(x => AI.value(g, x)));
    if (ctx.ch) return enemy.some(x => participating(g, x) && x.owner === ctx.ch.att) ? 20 : 0;
    if (ctx.beforeChallenge && g.activeP === p) return (p.chDone.military || !g.challengeAllowed(p, 'military')) ? 10 + best : (best >= 6 ? 8 : 0);
    return 0;
  },
  cancelScore(g, q, ev) { return ev.owner !== q ? 5 + (ev.d.cost || 0) : 0; },
  varysScore(g, p) {
    const mine = p.chars.filter(c => c.code !== '01029').reduce((s, c) => s + AI.value(g, c), 0);
    const theirs = p.opp.chars.reduce((s, c) => s + AI.value(g, c), 0);
    return theirs > mine + 10 ? 1 : 0;
  },
};

class AICtrl {
  constructor(delay) { this.delay = delay || 0; this.isAI = true; }
  async wait() { if (this.delay) await sleep(this.delay); }
  async chooseCards(g, p, o) {
    await this.wait();
    if (o.aiPick) return o.aiPick();
    const sc = o.cands.map(c => ({ c, s: o.ai ? o.ai(c) : 1 })).sort((a, b) => b.s - a.s);
    const r = [];
    for (const x of sc) { if (r.length >= o.max) break; if (r.length < o.min || x.s > 0) r.push(x.c); }
    return r;
  }
  async chooseOption(g, p, o) {
    await this.wait();
    let best = o.options[0], bs = -Infinity;
    for (const op of o.options) { const s = o.ai ? o.ai(op) : 0; if (s > bs) { bs = s; best = op; } }
    return best.value;
  }
  async actionWindow(g, p, o) {
    const items = [];
    for (const a of o.actions || []) items.push({ a, s: typeof a.ai === 'number' ? a.ai : 0 });
    for (const b of o.buttons || []) items.push({ b, s: b.ai || 0 });
    items.sort((x, y) => y.s - x.s);
    const top = items[0];
    if (!top || top.s <= 0) return null;
    await this.wait();
    if (top.a) return top.a;
    return { button: top.b.value };
  }
}
