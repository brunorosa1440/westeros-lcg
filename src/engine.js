// ================= MOTOR DE JOGO — AGoT 2ª edição (protótipo) =================
const DB = {}; CARDS.forEach(d => DB[d.c] = d);
const NAME_IDX = {}; CARDS.forEach(d => { NAME_IDX[d.n.toLowerCase()] = d.c; });
// ---------- idioma (PT / EN) ----------
let LANG = (() => { try { return localStorage.getItem('agot_lang') || 'pt'; } catch (e) { return 'pt'; } })();
function LX(pt, en) { return LANG === 'en' ? en : pt; }
function i18nObj(pt, en) { const src = () => LANG === 'en' ? en : pt; return new Proxy({}, { get: (_, k) => src()[k], ownKeys: () => Reflect.ownKeys(pt), getOwnPropertyDescriptor: (_, k) => ({ enumerable: true, configurable: true, value: src()[k] }), has: (_, k) => k in pt }); }
const FACTION_NAMES = i18nObj({ baratheon: 'Baratheon', greyjoy: 'Greyjoy', lannister: 'Lannister', martell: 'Martell', thenightswatch: "Night's Watch", stark: 'Stark', targaryen: 'Targaryen', tyrell: 'Tyrell', neutral: 'Neutra' },
  { baratheon: 'Baratheon', greyjoy: 'Greyjoy', lannister: 'Lannister', martell: 'Martell', thenightswatch: "Night's Watch", stark: 'Stark', targaryen: 'Targaryen', tyrell: 'Tyrell', neutral: 'Neutral' });
const CH_SYM = { military: '⚔', intrigue: '👁', power: '♛' };
const CH_NAMES = i18nObj({ military: '⚔ Militar', intrigue: '👁 Intriga', power: '♛ Poder' }, { military: '⚔ Military', intrigue: '👁 Intrigue', power: '♛ Power' });
const ICON_OF = { military: 'M', intrigue: 'I', power: 'P' };
const CH_TYPES = ['military', 'intrigue', 'power'];
const PHASE_NAMES = { setup: 'Setup', plot: 'Plot', draw: 'Draw', marshal: 'Marshaling', challenges: 'Challenges', dominance: 'Dominance', standing: 'Standing', taxation: 'Taxation' };
const WIN_POWER = 15;

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
class GameOver extends Error { constructor(w, why) { super('fim'); this.winner = w; this.why = why; } }

let UID = 1;
function mkCard(code, owner) {
  return { uid: UID++, code, d: DB[code], owner, kneel: false, power: 0, att: [], dupes: [], tmp: 0, ph: 0, zone: 'deck', parent: null, flags: {}, tmpIcons: '', tmpKw: {} };
}
const AB = {}; // habilidades por código (abilities.js)
function ab(c) { return AB[c.code] || {}; }
function isAuto(code) { const d = DB[code]; return !!(d && (d.v || AB[code])); }

class Game {
  constructor(decks, ctrls, names) {
    this.players = [0, 1].map(i => {
      const dk = decks[i];
      const p = { i, name: names[i], ctrl: ctrls[i], faction: dk.faction, agenda: dk.agenda || null, deck: [], hand: [], plots: [], used: [], plot: null,
        chars: [], locs: [], discard: [], dead: [], removed: [], power: 0, gold: 0, fknelt: false, reducers: [], limitedUsed: 0, flags: {}, won: {}, chDone: {} };
      for (const [code, n] of Object.entries(dk.cards)) {
        const d = DB[code]; if (!d || d.t === 'agenda' || d.t === 'title') continue;
        for (let k = 0; k < n; k++) {
          const c = mkCard(code, p);
          if (d.t === 'plot') { c.zone = 'plots'; p.plots.push(c); } else p.deck.push(c);
        }
      }
      shuffle(p.deck); p.deck.forEach(c => c.zone = 'deck');
      return p;
    });
    this.players.forEach((p, i) => p.opp = this.players[1 - i]);
    this.logs = []; this.phase = 'setup'; this.round = 0; this.first = this.players[0]; this.ch = null; this.winner = null; this.onUpdate = null; this.aiDelay = 0;
    this.endOfPhase = []; // callbacks
  }
  // ---------- util ----------
  log(msg, cls) { this.logSeq = (this.logSeq || 0) + 1; this.logs.push({ msg, cls: cls || '', id: this.logSeq }); if (this.logs.length > 400) this.logs.shift(); this.emit(); }
  mark() { return (this.logSeq || 0) + 1; }
  async inform(title, from, tone) {
    const lines = this.logs.filter(l => l.id >= from && l.cls !== 'phase' && l.cls !== 'dim');
    if (!lines.length) return;
    for (const p of this.players) if (p.ctrl.inform) await p.ctrl.inform(this, p, { title, lines, tone: tone || '' });
  }
  emit() { if (this.onUpdate) this.onUpdate(); }
  order() { return [this.first, this.first.opp]; }
  pname(p) { return p.name; }
  cn(c) { return c.d.n; }
  // ---------- consultas ----------
  attsOf(p) { const r = []; for (const q of this.players) for (const c of q.chars) for (const a of c.att) if (a.owner === p) r.push(a); return r; }
  inPlay(p) { return [...p.chars, ...p.locs, ...this.attsOf(p)]; }
  allChars() { return [...this.players[0].chars, ...this.players[1].chars]; }
  allInPlay() { return [...this.inPlay(this.players[0]), ...this.inPlay(this.players[1])]; }
  controller(c) { return c.owner; }
  anyPlot(code) { return this.players.some(p => p.plot && p.plot.code === code); }
  myPlot(p, code) { return p.plot && p.plot.code === code; }
  anyPlotTrait(t) { return this.players.some(p => p.plot && p.plot.d.tr.includes(t)); }
  blank(c) {
    if (c.d.t === 'character') {
      if (this.anyPlot('01012')) return true;
      if (c.att.some(a => a.code === '01035')) return true;
    }
    return false;
  }
  hasTrait(c, t) { return c.d.tr.includes(t); }
  str(c) {
    if (c.d.t !== 'character') return 0;
    let s = (c.d.s || 0) + c.tmp + c.ph;
    if (!this.blank(c) && ab(c).str) s += ab(c).str(this, c);
    for (const a of c.att) if (ab(a).attStr) s += ab(a).attStr(this, a, c);
    return Math.max(0, s);
  }
  hasIcon(c, type) {
    const L = ICON_OF[type];
    if ((c.d.i || '').includes(L) || c.tmpIcons.includes(L)) return true;
    if (!this.blank(c) && ab(c).icons && ab(c).icons(this, c).includes(L)) return true;
    for (const a of c.att) if (ab(a).attIcons && ab(a).attIcons(this, a, c).includes(L)) return true;
    return false;
  }
  hasKw(c, k) {
    if (c.tmpKw[k]) return true;
    if (!this.blank(c) && c.d.k && c.d.k[k]) return true;
    if (!this.blank(c) && ab(c).kw && ab(c).kw(this, c)[k]) return true;
    for (const a of c.att) if (ab(a).attKw && ab(a).attKw(this, a, c)[k]) return true;
    if (c.d.t === 'character' && c.zone === 'chars') for (const o of this.inPlay(c.owner)) if (o !== c && !this.blank(o) && ab(o).grantKw) { const g = ab(o).grantKw(this, o, c); if (g && g[k]) return true; }
    return false;
  }
  mod(p, key) { // income / initiative / reserve
    let v = 0;
    for (const c of this.inPlay(p)) { if (this.blank(c)) continue; if (c.d.m && c.d.m[key]) v += c.d.m[key]; }
    return v;
  }
  income(p) {
    if (!p.plot) return 0;
    let base = p.plot.d.p[0];
    if (this.anyPlot('01017') && (p.plot.d.tr.includes('Kingdom') || p.plot.d.tr.includes('Edict'))) base = 0;
    return Math.max(0, base + this.mod(p, 'income'));
  }
  initiative(p) { return (p.plot ? p.plot.d.p[1] : 0) + this.mod(p, 'initiative'); }
  reserve(p) { return (p.plot ? p.plot.d.p[3] : 7) + this.mod(p, 'reserve'); }
  totalPower(p) { let t = p.power; for (const c of [...p.chars, ...p.locs]) t += c.power; return t; }
  canTrigger(p) { // Catelyn Stark
    const ch = this.ch; if (!ch) return true;
    const opp = p.opp;
    const parts = [...ch.attackers, ...ch.defenders];
    return !parts.some(c => c.owner === opp && c.code === '01143' && !this.blank(c) && c.zone === 'chars');
  }
  limitMax(p) { return 1 + (this.myPlot(p, '01024') ? 1 : 0); }
  // ---------- verificações ----------
  checkWin() {
    for (const p of this.order()) if (this.totalPower(p) >= WIN_POWER) { this.winner = p; throw new GameOver(p, LX(`${p.name} chegou a ${WIN_POWER} de poder!`, `${p.name} reached ${WIN_POWER} power!`)); }
  }
  checkDecks() {
    for (const p of this.players) if (p.deck.length === 0) { this.winner = p.opp; throw new GameOver(p.opp, LX(`${p.name} ficou sem cartas no baralho e foi eliminado.`, `${p.name} ran out of cards in their deck and is eliminated.`)); }
  }
  // ---------- movimento ----------
  removeFromZone(c) {
    const p = c.owner; const z = c.zone;
    const rm = arr => { const i = arr.indexOf(c); if (i >= 0) arr.splice(i, 1); };
    if (z === 'hand') rm(p.hand); else if (z === 'deck') rm(p.deck); else if (z === 'discard') rm(p.discard); else if (z === 'dead') rm(p.dead);
    else if (z === 'chars') rm(p.chars); else if (z === 'locs') rm(p.locs); else if (z === 'plots') rm(p.plots); else if (z === 'used') rm(p.used);
    else if (z === 'att' && c.parent) { rm(c.parent.att); c.parent = null; } else if (z === 'dupe' && c.parent) { rm(c.parent.dupes); c.parent = null; }
    if (this.ch) { rm(this.ch.attackers); rm(this.ch.defenders); }
    c.zone = null;
  }
  toZone(c, z) {
    const p = c.owner; c.zone = z;
    if (z === 'hand') p.hand.push(c); else if (z === 'deck') p.deck.unshift(c); else if (z === 'discard') p.discard.push(c); else if (z === 'dead') p.dead.push(c); else if (z === 'removed') p.removed.push(c);
  }
  resetCard(c) { c.kneel = false; c.power = 0; c.tmp = 0; c.ph = 0; c.flags = {}; c.tmpIcons = ''; c.tmpKw = {}; }
  // carta sai de jogo: anexos e duplicados vão para o descarte do dono
  leavePlay(c, dest) {
    // regra: anexos voltam à mão do dono (Terminal → descarte); duplicados vão para o descarte
    for (const a of [...c.att]) { this.removeFromZone(a); this.resetCard(a); const term = a.d.k?.terminal; this.toZone(a, term ? 'discard' : 'hand'); this.log(term ? LX(`${this.cn(a)} (Terminal) vai para o descarte.`, `${this.cn(a)} (Terminal) is discarded.`) : LX(`${this.cn(a)} volta para a mão de ${a.owner.name}.`, `${this.cn(a)} returns to ${a.owner.name}'s hand.`), 'dim'); }
    for (const d of [...c.dupes]) { this.removeFromZone(d); this.resetCard(d); this.toZone(d, 'discard'); }
    this.removeFromZone(c); this.resetCard(c); this.toZone(c, dest);
  }
  async trySave(c) {
    if (c.dupes.length) { const d = c.dupes[0]; this.removeFromZone(d); this.toZone(d, 'discard'); this.log(LX(`${this.cn(c)} é salvo ao descartar um duplicado.`, `${this.cn(c)} is saved by discarding a duplicate.`)); return true; }
    const bg = c.att.find(a => a.code === '01033');
    if (bg && this.canTrigger(bg.owner)) { this.removeFromZone(bg); this.resetCard(bg); this.toZone(bg, 'discard'); this.log(LX(`${bg.owner.name} sacrifica Bodyguard para salvar ${this.cn(c)}.`, `${bg.owner.name} sacrifices Bodyguard to save ${this.cn(c)}.`)); return true; }
    return false;
  }
  async kill(c, opts = {}) {
    if (c.zone !== 'chars') return false;
    if (opts.save !== false && await this.trySave(c)) return false;
    const p = c.owner;
    this.leavePlay(c, 'dead');
    this.log(LX(`☠ ${this.cn(c)} (${p.name}) foi morto.`, `☠ ${this.cn(c)} (${p.name}) is killed.`), 'kill');
    await this.afterLeave(c, 'killed');
    return true;
  }
  async discardFromPlay(c, opts = {}) {
    if (!['chars', 'locs', 'att'].includes(c.zone)) return false;
    if (c.zone === 'chars' && opts.save !== false && await this.trySave(c)) return false;
    this.leavePlay(c, 'discard');
    this.log(LX(`${this.cn(c)} (${c.owner.name}) foi descartado de jogo.`, `${this.cn(c)} (${c.owner.name}) is discarded from play.`));
    return true;
  }
  async sacrifice(c) {
    const wasChar = c.zone === 'chars';
    this.leavePlay(c, 'discard');
    this.log(LX(`${c.owner.name} sacrifica ${this.cn(c)}.`, `${c.owner.name} sacrifices ${this.cn(c)}.`));
    if (wasChar) await this.afterLeave(c, 'sacrificed');
  }
  async afterLeave(c, how) {
    for (const o of this.allInPlay()) if (!this.blank(o) && ab(o).afterCharLeaves && this.canTrigger(o.owner)) await ab(o).afterCharLeaves(this, o, c, how);
  }
  returnToHand(c) { this.leavePlay(c, 'hand'); this.log(LX(`${this.cn(c)} volta para a mão de ${c.owner.name}.`, `${this.cn(c)} returns to ${c.owner.name}'s hand.`)); }
  draw(p, n, quiet) {
    let k = 0;
    for (let i = 0; i < n && p.deck.length; i++) { const c = p.deck.shift(); c.zone = 'hand'; p.hand.push(c); k++; }
    if (!quiet && k) this.log(LX(`${p.name} compra ${k} carta${k > 1 ? 's' : ''}.`, `${p.name} draws ${k} card${k > 1 ? 's' : ''}.`));
    if (this.phase !== 'setup') this.checkDecks();
    return k;
  }
  discardTop(p) { const c = p.deck.shift(); if (c) { c.zone = 'discard'; p.discard.push(c); this.log(LX(`${p.name} descarta do topo do baralho: ${this.cn(c)}.`, `${p.name} discards from the top of their deck: ${this.cn(c)}.`)); } this.checkDecks(); return c; }
  discardFromHand(p, c) { this.removeFromZone(c); this.toZone(c, 'discard'); }
  gainPower(p, n, card) {
    if (n <= 0) return;
    if (card) { card.power += n; this.log(LX(`${this.cn(card)} ganha ${n} de poder.`, `${this.cn(card)} gains ${n} power.`), 'pow'); }
    else { p.power += n; this.log(LX(`${p.name} ganha ${n} de poder para a facção.`, `${p.name} gains ${n} power for their faction.`), 'pow'); }
    this.checkWin();
  }
  movePower(from, to, n) {
    const k = Math.min(n, from.power); if (k <= 0) return 0;
    from.power -= k; to.power += k; this.log(LX(`${k} de poder passa de ${from.name} para ${to.name}.`, `${k} power moves from ${from.name} to ${to.name}.`), 'pow'); this.checkWin(); return k;
  }
  // ---------- entrada em jogo ----------
  findDupeTarget(p, c) { if (!c.d.u) return null; return [...p.chars, ...p.locs, ...this.attsOf(p)].find(o => o.d.n === c.d.n) || null; }
  uniqueBlockedByDead(p, c) { return c.d.u && p.dead.some(o => o.d.n === c.d.n); }
  attachTargets(p, a) {
    const f = ab(a).attachOk;
    return this.allChars().filter(t => !t.d.k?.noAttach && (!f || f(this, a, t, p)));
  }
  async putIntoPlay(p, c, how, opts = {}) {
    // how: 'setup' | 'marshal' | 'put' | 'ambush'
    const dupT = this.findDupeTarget(p, c);
    this.removeFromZone(c);
    if (dupT) { c.zone = 'dupe'; c.parent = dupT; dupT.dupes.push(c); this.log(LX(`${p.name} coloca ${this.cn(c)} como duplicado.`, `${p.name} places ${this.cn(c)} as a duplicate.`)); this.emit(); return c; }
    this.resetCard(c);
    if (c.d.t === 'character') {
      c.zone = 'chars'; p.chars.push(c);
      if (ab(c).entersKnelt && !this.blank(c)) c.kneel = true;
    } else if (c.d.t === 'location') { c.zone = 'locs'; p.locs.push(c); }
    else if (c.d.t === 'attachment') {
      let target = opts.target;
      if (!target) {
        const t = this.attachTargets(p, c).filter(x => how !== 'setup' || x.owner === p);
        if (!t.length) { this.toZone(c, 'discard'); this.log(LX(`${this.cn(c)} não tem alvo válido e é descartado.`, `${this.cn(c)} has no valid target and is discarded.`)); return null; }
        [target] = await p.ctrl.chooseCards(this, p, { force: true, prompt: LX(`Escolhe a personagem onde anexar ${this.cn(c)}`, `Choose a character to attach ${this.cn(c)} to`), cands: t, min: 1, max: 1, ai: x => AI.attachScore(this, p, c, x) });
      }
      c.zone = 'att'; c.parent = target; target.att.push(c);
    }
    if (opts.kneel) c.kneel = true;
    const verb = { setup: LX('coloca em setup', 'sets up'), marshal: LX('faz marshal de', 'marshals'), put: LX('põe em jogo', 'puts into play'), ambush: LX('faz ambush de', 'ambushes') }[how];
    this.log(LX(`${p.name} ${verb} ${this.cn(c)}${c.parent ? ' em ' + this.cn(c.parent) : ''}.`, `${p.name} ${verb} ${this.cn(c)}${c.parent ? ' on ' + this.cn(c.parent) : ''}.`));
    if (how !== 'setup') {
      if (!this.blank(c) && ab(c).onEnter && this.canTrigger(p)) await ab(c).onEnter(this, c, how);
    }
    this.emit();
    return c;
  }
  // ---------- custos ----------
  reducerTotal(p, c, mode) {
    let red = 0;
    for (const r of p.reducers) if (r.modes.includes(mode) && r.f(c)) red += r.amt;
    if (mode === 'marshal' && this.myPlot(p, '01004') && !p.flags.nobleUsed && c.d.t === 'character' && (this.hasTrait(c, 'Lord') || this.hasTrait(c, 'Lady'))) red += 2;
    return red;
  }
  costOf(p, c, mode) {
    if (mode === 'marshal' && this.findDupeTarget(p, c)) return 0;
    const base = c.d.cost === 'X' ? 0 : (c.d.cost || 0);
    return Math.max(0, base - this.reducerTotal(p, c, mode));
  }
  consumeReducers(p, c, mode) {
    p.reducers = p.reducers.filter(r => !(r.modes.includes(mode) && r.f(c)));
    if (mode === 'marshal' && this.myPlot(p, '01004') && c.d.t === 'character' && (this.hasTrait(c, 'Lord') || this.hasTrait(c, 'Lady'))) p.flags.nobleUsed = true;
  }
  canMarshal(p, c) {
    if (c.zone !== 'hand' || !['character', 'location', 'attachment'].includes(c.d.t)) return false;
    if (this.myPlot(p, '01016') && c.d.t !== 'character') return false;
    if (this.uniqueBlockedByDead(p, c)) return false;
    const dup = this.findDupeTarget(p, c);
    if (c.d.k?.limited && p.limitedUsed >= this.limitMax(p)) return false;
    if (!dup && c.d.t === 'attachment' && !this.attachTargets(p, c).length) return false;
    return this.costOf(p, c, 'marshal') <= p.gold;
  }
  async marshal(p, c) {
    const cost = this.costOf(p, c, 'marshal');
    this.consumeReducers(p, c, 'marshal');
    p.gold -= cost;
    if (c.d.k?.limited) p.limitedUsed++;
    if (cost) this.log(LX(`(${p.name} paga ${cost} ouro)`, `(${p.name} pays ${cost} gold)`), 'dim');
    await this.putIntoPlay(p, c, 'marshal');
  }
  ambushCost(p, c) {
    if (c.zone !== 'hand') return null;
    let x = c.d.k?.ambush;
    if (x == null && c.d.t === 'character' && this.hasTrait(c, 'Direwolf') && p.locs.some(l => l.code === '01155')) x = c.d.cost;
    return x == null ? null : x;
  }
  canAmbush(p, c) {
    const x = this.ambushCost(p, c); if (x == null) return false;
    if (this.uniqueBlockedByDead(p, c)) return false;
    if (c.d.k?.limited && p.limitedUsed >= this.limitMax(p)) return false;
    if (c.d.t === 'attachment' && !this.findDupeTarget(p, c) && !this.attachTargets(p, c).length) return false;
    return x <= p.gold;
  }
  async ambush(p, c) {
    const x = this.ambushCost(p, c); p.gold -= x; if (c.d.k?.limited) p.limitedUsed++;
    const r = await this.putIntoPlay(p, c, 'ambush');
    if (r && r.zone === 'chars') r.flags.ambushed = this.phase;
  }
  // ---------- eventos ----------
  canPlayEvent(p, c, timing, ctx) {
    if (c.zone !== 'hand' || c.d.t !== 'event') return false;
    const e = ab(c).ev; if (!e || e.timing !== timing) return false;
    if (this.myPlot(p, '01016')) return false;
    if (!this.canTrigger(p)) return false;
    if (c.d.k?.limited && p.limitedUsed >= this.limitMax(p)) return false;
    const cost = e.cost ? e.cost(this, p, ctx) : this.costOf(p, c, 'play');
    if (cost > p.gold) return false;
    return !e.cond || e.cond(this, p, ctx);
  }
  async playEvent(p, c, ctx) {
    const e = ab(c).ev;
    const cost = e.cost ? e.cost(this, p, ctx) : this.costOf(p, c, 'play');
    this.consumeReducers(p, c, 'play');
    p.gold -= cost; if (c.d.k?.limited) p.limitedUsed++;
    this.removeFromZone(c); c.zone = 'limbo';
    this.log(LX(`${p.name} joga o evento ${this.cn(c)}.`, `${p.name} plays the event ${this.cn(c)}.`), 'ev');
    const cancelled = await this.offerCancel(p.opp, c, cost);
    if (!cancelled) await e.run(this, p, c, ctx);
    this.toZone(c, 'discard'); this.emit();
  }
  async offerCancel(q, evCard, evCost) {
    if (!this.canTrigger(q)) return false;
    const opts = [];
    const bran = q.chars.find(x => x.code === '01142' && !this.blank(x));
    if (bran) opts.push({ label: LX('Sacrificar Bran Stark para cancelar', 'Sacrifice Bran Stark to cancel'), value: 'bran' });
    const hj = q.hand.find(x => x.code === '01045');
    if (hj && q.gold >= (evCard.d.cost === 'X' ? evCost : evCard.d.cost || 0) && !this.myPlot(q, '01016')) opts.push({ label: LX(`Jogar The Hand's Judgment (${evCard.d.cost === 'X' ? evCost : evCard.d.cost || 0} ouro)`, `Play The Hand's Judgment (${evCard.d.cost === 'X' ? evCost : evCard.d.cost || 0} gold)`), value: 'hj' });
    if (!opts.length) return false;
    opts.push({ label: LX('Não cancelar', "Don't cancel"), value: null });
    const v = await q.ctrl.chooseOption(this, q, { prompt: LX(`${evCard.owner.name} jogou ${this.cn(evCard)}. Cancelar?`, `${evCard.owner.name} played ${this.cn(evCard)}. Cancel it?`), options: opts, ai: o => o.value ? AI.cancelScore(this, q, evCard) : 0, card: evCard });
    if (v === 'bran') { await this.sacrifice(bran); this.log(LX(`Efeito de ${this.cn(evCard)} cancelado.`, `${this.cn(evCard)}'s effects are cancelled.`)); return true; }
    if (v === 'hj') { const x = evCard.d.cost === 'X' ? evCost : evCard.d.cost || 0; q.gold -= x; this.removeFromZone(hj); this.toZone(hj, 'discard'); this.log(LX(`${q.name} joga The Hand's Judgment: ${this.cn(evCard)} é cancelado.`, `${q.name} plays The Hand's Judgment: ${this.cn(evCard)} is cancelled.`), 'ev'); return true; }
    return false;
  }
  // ---------- ações disponíveis ----------
  availableActions(p, ctx) {
    // ctx: {phase, ch}
    const acts = [];
    if (!this.canTrigger(p)) return acts;
    for (const c of this.inPlay(p)) {
      if (this.blank(c) || !ab(c).actions) continue;
      for (const a of ab(c).actions(this, c, ctx) || []) acts.push({ card: c, ...a });
    }
    if (p.plot && ab(p.plot).actions) for (const a of ab(p.plot).actions(this, p.plot, ctx) || []) acts.push({ card: p.plot, ...a });
    if (p.agenda && AB[p.agenda] && AB[p.agenda].factionActions) for (const a of AB[p.agenda].factionActions(this, p, ctx) || []) acts.push({ card: null, faction: true, ...a });
    for (const c of p.hand) if (this.canPlayEvent(p, c, 'action', ctx)) acts.push({ card: c, label: LX(`Jogar ${this.cn(c)}`, `Play ${this.cn(c)}`), ai: ab(c).ev.ai ? ab(c).ev.ai(this, p, ctx) : 1, run: () => this.playEvent(p, c, ctx) });
    if (ctx.phase === 'challenges') for (const c of p.hand) if (this.canAmbush(p, c)) acts.push({ card: c, label: LX(`Ambush (${this.ambushCost(p, c)} ouro)`, `Ambush (${this.ambushCost(p, c)} gold)`), ai: AI.ambushScore(this, p, c, ctx), run: () => this.ambush(p, c) });
    return acts;
  }
  async actionRound(ctx, starter, prompt) {
    // janela de ações: alterna entre jogadores até ambos passarem
    let passes = 0, cur = starter || this.first;
    let guard = 0;
    while (passes < 2 && guard++ < 40) {
      const acts = this.availableActions(cur, ctx);
      let chosen = null;
      if (acts.length) chosen = await cur.ctrl.actionWindow(this, cur, { prompt: prompt || LX('Janela de ações', 'Action window'), actions: acts, passLabel: LX('Passar', 'Pass'), ctx });
      if (chosen && chosen.run) { await chosen.run(); passes = 0; this.emit(); }
      else passes++;
      cur = cur.opp;
    }
  }
  // ---------- reações genéricas ----------
  async fire(hook, ...args) {
    for (const p of this.order()) {
      for (const c of [...this.inPlay(p), ...(p.plot ? [p.plot] : [])]) {
        if (c.zone && !['chars', 'locs', 'att', 'plot'].includes(c.zone)) continue;
        if (c.d.t !== 'plot' && this.blank(c)) continue;
        const h = ab(c)[hook];
        if (h && this.canTrigger(p)) await h(this, c, ...args);
      }
    }
  }
  // ================= FLUXO =================
  async run() {
    try {
      await this.setup();
      while (true) { await this.playRound(); }
    } catch (e) {
      if (e instanceof GameOver) { this.winner = e.winner; this.log(LX(`🏆 ${e.why} ${e.winner.name} vence!`, `🏆 ${e.why} ${e.winner.name} wins!`), 'win'); this.phase = 'end'; this.emit(); return e.winner; }
      throw e;
    }
  }
  async setup() {
    this.phase = 'setup'; this.log('— Setup —', 'phase');
    const m0 = this.mark();
    for (const p of this.players) this.draw(p, 7, true);
    for (const p of this.players) {
      const mul = await p.ctrl.chooseOption(this, p, { prompt: LX('Mão inicial: queres fazer mulligan (baralhar a mão de volta e comprar 7 novas)? Só podes fazer uma vez.', 'Opening hand: mulligan (shuffle your hand back and draw 7 new cards)? You can only do this once.'),
        options: [{ label: LX('Manter mão', 'Keep hand'), value: false }, { label: 'Mulligan', value: true }], ai: o => o.value === AI.wantsMulligan(this, p) ? 1 : 0 });
      if (mul) { for (const c of [...p.hand]) { this.removeFromZone(c); c.zone = 'deck'; p.deck.push(c); } shuffle(p.deck); this.draw(p, 7, true); this.log(LX(`${p.name} faz mulligan.`, `${p.name} takes a mulligan.`)); }
      else this.log(LX(`${p.name} mantém a mão.`, `${p.name} keeps their hand.`));
    }
    for (const p of this.players) {
      // escolher cartas de setup (até 8 ouro, 1 limitada, sem eventos)
      let budget = 8; let limited = 0;
      while (true) {
        const cands = p.hand.filter(c => {
          if (!['character', 'location', 'attachment'].includes(c.d.t)) return false;
          const dup = this.findDupeTarget(p, c);
          const cost = dup ? 0 : (c.d.cost || 0);
          if (cost > budget) return false;
          if (c.d.k?.limited && limited >= 1) return false;
          if (!dup && c.d.t === 'attachment' && !this.attachTargets(p, c).some(x => x.owner === p)) return false;
          return true;
        });
        if (!cands.length) break;
        const [c] = await p.ctrl.chooseCards(this, p, { prompt: LX(`Setup: escolhe cartas para colocar (ouro restante: ${budget}). Concluir quando terminares.`, `Setup: choose cards to place (gold left: ${budget}). Click Done when finished.`), cands, min: 0, max: 1, ai: x => AI.setupScore(this, p, x, budget), doneLabel: LX('Concluir setup', 'Done with setup') });
        if (!c) break;
        const dup = this.findDupeTarget(p, c);
        budget -= dup ? 0 : (c.d.cost || 0); if (c.d.k?.limited) limited++;
        await this.putIntoPlay(p, c, 'setup');
      }
    }
    for (const p of this.players) { const n = 7 - p.hand.length; if (n > 0) this.draw(p, n); }
    this.checkDecks();
    await this.inform('Setup', m0);
  }
  async playRound() {
    this.round++;
    for (const p of this.players) { p.limitedUsed = 0; p.flags = {}; for (const c of this.inPlay(p)) c.flags = Object.assign({}, c.flags.ambushed ? { ambushed: c.flags.ambushed } : {}); }
    await this.plotPhase();
    await this.drawPhase();
    await this.marshalPhase();
    await this.challengesPhase();
    await this.dominancePhase();
    await this.standingPhase();
    await this.taxationPhase();
  }
  async endPhase() {
    const cbs = this.endOfPhase; this.endOfPhase = [];
    for (const f of cbs) await f();
    await this.fire('onPhaseEnd', this.phase);
    for (const p of this.players) { p.reducers = []; for (const c of p.chars) { c.ph = 0; } }
    this.emit();
  }
  async plotPhase() {
    const m0 = this.mark();
    this.phase = 'plot'; this.log(LX(`— Ronda ${this.round}: Plot —`, `— Round ${this.round}: Plot —`), 'phase');
    const chosen = [];
    for (const p of this.players) {
      if (!p.plots.length) { p.plots.push(...p.used); p.used.forEach(c => c.zone = 'plots'); p.used = []; }
      const [pl] = await p.ctrl.chooseCards(this, p, { prompt: LX('Escolhe o plot desta ronda', 'Choose your plot for this round'), cands: p.plots, min: 1, max: 1, ai: x => AI.plotScore(this, p, x), modal: true });
      chosen.push(pl);
    }
    this.players.forEach((p, i) => {
      if (p.plot) { p.plot.zone = 'used'; p.used.push(p.plot); }
      const pl = chosen[i]; this.removeFromZone(pl); pl.zone = 'plot'; pl.flags = {}; p.plot = pl;
      this.log(LX(`${p.name} revela ${this.cn(pl)}.`, `${p.name} reveals ${this.cn(pl)}.`));
    });
    // iniciativa
    const [a, b] = this.players; const ia = this.initiative(a), ib = this.initiative(b);
    let w;
    if (ia !== ib) w = ia > ib ? a : b;
    else { const pa = this.totalPower(a), pb = this.totalPower(b); w = pa !== pb ? (pa < pb ? a : b) : this.players[Math.floor(Math.random() * 2)]; }
    this.log(LX(`Iniciativa: ${a.name} ${ia} × ${b.name} ${ib}. ${w.name} ganha a iniciativa.`, `Initiative: ${a.name} ${ia} × ${b.name} ${ib}. ${w.name} wins initiative.`));
    const firstChoice = await w.ctrl.chooseOption(this, w, { prompt: LX('Ganhaste a iniciativa. Quem é o primeiro jogador?', 'You won initiative. Who will be first player?'), options: [{ label: LX('Eu', 'Me'), value: w }, { label: w.opp.name, value: w.opp }], ai: o => AI.firstPlayerScore(this, w, o.value) });
    this.first = firstChoice; this.log(LX(`${this.first.name} é o primeiro jogador.`, `${this.first.name} is first player.`));
    this.emit();
    // when revealed
    for (const p of this.order()) {
      const h = ab(p.plot).reveal;
      if (h) await h(this, p, p.plot);
    }
    await this.inform(LX('Plots revelados', 'Plots revealed'), m0);
    await this.endPhase();
  }
  async drawPhase() {
    this.phase = 'draw'; this.log('— Draw —', 'phase');
    for (const p of this.order()) this.draw(p, 2);
    this.checkDecks();
    await this.endPhase();
  }
  async marshalPhase() {
    this.phase = 'marshal'; this.log('— Marshaling —', 'phase');
    for (const p of this.order()) {
      const mm = this.mark();
      const inc = this.income(p); p.gold += inc; this.log(LX(`${p.name} recolhe ${inc} ouro (total ${p.gold}).`, `${p.name} collects ${inc} gold (total ${p.gold}).`), 'gold');
      this.activeP = p;
      let guard = 0;
      while (guard++ < 60) {
        const ctx = { phase: 'marshal', active: p };
        const acts = this.availableActions(p, ctx);
        for (const c of p.hand) if (this.canMarshal(p, c)) {
          const dup = this.findDupeTarget(p, c);
          acts.push({ card: c, label: dup ? LX('Marshal como duplicado (0)', 'Marshal as duplicate (0)') : LX(`Marshal (${this.costOf(p, c, 'marshal')} ouro)`, `Marshal (${this.costOf(p, c, 'marshal')} gold)`), marshal: true, ai: AI.marshalScore(this, p, c), run: () => this.marshal(p, c) });
        }
        const ch = await p.ctrl.actionWindow(this, p, { prompt: LX(`Marshaling — ouro: ${p.gold}. Escolhe cartas para jogar (anexos, personagens, locais) ou termina.`, `Marshaling — gold: ${p.gold}. Choose cards to play (attachments, characters, locations), or finish.`), actions: acts, passLabel: LX('Terminar marshaling', 'Done marshaling'), ctx });
        if (!ch) break;
        await ch.run(); this.emit();
      }
      if (p.ctrl.isAI) await this.inform(LX(`${p.name} — marshaling`, `${p.name} — marshaling`), mm);
    }
    this.activeP = null;
    await this.endPhase();
  }
  // ---------- desafios ----------
  maxOfType(p, t) {
    let n = 1;
    if (t === 'military' && this.myPlot(p, '01005')) n++;
    if (t === 'intrigue' && p.locs.some(l => l.code === '01097' && !this.blank(l))) n++;
    return n;
  }
  canAttackWith(p, c, t) { return c.zone === 'chars' && !c.kneel && this.hasIcon(c, t); }
  challengeAllowed(p, t) {
    if ((p.chDone[t] || 0) >= this.maxOfType(p, t)) return false;
    const total = CH_TYPES.reduce((s, x) => s + (p.chDone[x] || 0), 0);
    if (this.myPlot(p, '01021') && total >= 1) return false;
    if (this.anyPlot('01003') && t !== 'intrigue' && !p.won.intrigue) return false;
    return p.chars.some(c => this.canAttackWith(p, c, t));
  }
  async challengesPhase() {
    this.phase = 'challenges'; this.log('— Challenges —', 'phase');
    if (this.anyPlot('01023')) { for (const p of this.players) p.gold = 0; this.log(LX('Supporting the Faith: todo o ouro volta ao tesouro.', 'Supporting the Faith: all gold returns to the treasury.')); }
    for (const p of this.players) { p.chDone = {}; p.won = {}; }
    for (const p of this.order()) {
      this.activeP = p;
      let guard = 0;
      while (guard++ < 10) {
        const ctx = { phase: 'challenges', active: p, beforeChallenge: true };
        const acts = this.availableActions(p, ctx);
        const buttons = CH_TYPES.filter(t => this.challengeAllowed(p, t)).map(t => ({ label: LX(`Desafio ${CH_NAMES[t]}`, `${CH_NAMES[t]} challenge`), value: t, ai: AI.challengeScore(this, p, t) }));
        const ch = await p.ctrl.actionWindow(this, p, { prompt: LX('Challenges: inicia um desafio, usa uma ação ou passa.', 'Challenges: initiate a challenge, use an action, or pass.'), actions: acts, buttons, passLabel: LX('Terminar desafios', 'Done with challenges'), ctx });
        if (!ch) break;
        if (ch.run) { await ch.run(); this.emit(); continue; }
        if (ch.button) { await this.doChallenge(p, ch.button); this.checkWin(); }
      }
    }
    this.activeP = null;
    await this.endPhase();
  }
  async doChallenge(att, type) {
    const def = att.opp;
    const jousting = this.anyPlot('01014');
    const cands = att.chars.filter(c => this.canAttackWith(att, c, type));
    const attackers = await att.ctrl.chooseCards(this, att, { prompt: LX(`Desafio ${CH_NAMES[type]}: escolhe os atacantes`, `${CH_NAMES[type]} challenge: choose attackers`), cands, min: 1, max: jousting ? 1 : cands.length, ai: null, aiPick: () => AI.pickAttackers(this, att, type, cands, jousting) });
    if (!attackers.length) return;
    att.chDone[type] = (att.chDone[type] || 0) + 1;
    const mc = this.mark();
    const ch = this.ch = { type, att, def, attackers: [...attackers], defenders: [], claimMod: 0, stealthed: [], winner: null, loser: null, diff: 0, afterWinCbs: [] };
    for (const c of attackers) if (!(ab(c).noKneelAttack && !this.blank(c) && ab(c).noKneelAttack(this, c, type))) c.kneel = true;
    this.log(LX(`${att.name} inicia um desafio ${CH_NAMES[type]} com ${attackers.map(c => this.cn(c)).join(', ')}.`, `${att.name} initiates a challenge (${CH_NAMES[type]}) with ${attackers.map(c => this.cn(c)).join(', ')}.`), 'ch');
    this.emit();
    await this.fire('afterChallengeInitiated', ch);
    // stealth
    for (const c of ch.attackers) if (this.hasKw(c, 'stealth')) {
      const t = def.chars.filter(x => !this.hasKw(x, 'stealth') && !ch.stealthed.includes(x));
      if (!t.length) continue;
      const [s] = await att.ctrl.chooseCards(this, att, { prompt: LX(`Stealth de ${this.cn(c)}: escolhe uma personagem que não pode defender`, `${this.cn(c)}'s stealth: choose a character that cannot defend`), cands: t, min: 0, max: 1, ai: x => AI.stealthScore(this, att, x, type) });
      if (s) { ch.stealthed.push(s); this.log(LX(`${this.cn(c)} usa stealth em ${this.cn(s)}.`, `${this.cn(c)} uses stealth on ${this.cn(s)}.`)); }
    }
    // janela de ações depois de iniciar o desafio (regras: antes dos defensores)
    await this.actionRound({ phase: 'challenges', ch, active: att, preDefense: true }, this.first, LX(`Desafio ${CH_NAMES[type]} iniciado (ataque ${this.sumStr(ch.attackers)}). Ações antes dos defensores?`, `${CH_NAMES[type]} challenge initiated (attack ${this.sumStr(ch.attackers)}). Actions before defenders?`));
    // defensores
    const dc = def.chars.filter(c => !c.kneel && this.hasIcon(c, type) && !ch.stealthed.includes(c));
    if (dc.length) {
      const defenders = await def.ctrl.chooseCards(this, def, { prompt: LX(`${att.name} ataca (${CH_NAMES[type]}, STR ${this.sumStr(ch.attackers)}). Escolhe os defensores (ou nenhum).`, `${att.name} attacks (${CH_NAMES[type]}, STR ${this.sumStr(ch.attackers)}). Choose defenders (or none).`), cands: dc, min: 0, max: jousting ? 1 : dc.length, aiPick: () => AI.pickDefenders(this, def, ch, dc, jousting), doneLabel: LX('Confirmar defesa', 'Confirm defense') });
      ch.defenders = [...defenders];
      for (const c of defenders) c.kneel = true;
      if (defenders.length) this.log(LX(`${def.name} defende com ${defenders.map(c => this.cn(c)).join(', ')}.`, `${def.name} defends with ${defenders.map(c => this.cn(c)).join(', ')}.`), 'ch'); else this.log(LX(`${def.name} não defende.`, `${def.name} does not defend.`), 'ch');
    } else this.log(LX(`${def.name} não tem defensores disponíveis.`, `${def.name} has no available defenders.`), 'ch');
    this.emit();
    // janela de ações
    await this.actionRound({ phase: 'challenges', ch, active: att }, this.first, LX(`Desafio ${CH_NAMES[type]} — Ataque ${this.sumStr(ch.attackers)} × Defesa ${this.sumStr(ch.defenders)}. Ações?`, `${CH_NAMES[type]} challenge — Attack ${this.sumStr(ch.attackers)} × Defense ${this.sumStr(ch.defenders)}. Actions?`));
    // resultado
    const A = this.sumStr(ch.attackers), D = this.sumStr(ch.defenders);
    if (A >= D && A > 0 && ch.attackers.length) { ch.winner = att; ch.loser = def; }
    else if (D > A) { ch.winner = def; ch.loser = att; }
    ch.diff = Math.abs(A - D);
    if (!ch.winner) { this.log(LX(`Desafio ${CH_NAMES[type]}: sem vencedor (${A} × ${D}).`, `${CH_NAMES[type]} challenge: no winner (${A} × ${D}).`), 'ch'); this.cleanupChallenge(); await this.informChallenge(ch, mc, A, D); return; }
    this.log(LX(`Desafio ${CH_NAMES[type]}: ${ch.winner.name} vence (${A} × ${D}).`, `${CH_NAMES[type]} challenge: ${ch.winner.name} wins (${A} × ${D}).`), 'chw');
    ch.winner.won[type] = (ch.winner.won[type] || 0) + 1;
    if (ch.winner === att) {
      if (D === 0) { this.log(LX('Desafio sem oposição (unopposed): +1 poder.', 'Unopposed challenge: +1 power.')); this.gainPower(att, 1); }
      await this.applyClaim(ch);
    }
    await this.keywords(ch);
    // reações de vitória
    await this.fire('afterWin', ch);
    for (const f of ch.afterWinCbs) await f();
    await this.offerEvents(ch.winner, 'afterWin', ch);
    await this.offerEvents(ch.loser, 'afterLose', ch);
    this.cleanupChallenge();
    this.checkWin();
    await this.informChallenge(ch, mc, A, D);
  }
  async informChallenge(ch, mc, A, D) {
    for (const p of this.players) {
      if (!p.ctrl.inform) continue;
      const nm = CH_NAMES[ch.type];
      let title, tone;
      if (!ch.winner) { title = LX(`Desafio ${nm}: sem vencedor (${A} × ${D})`, `${nm} challenge: no winner (${A} × ${D})`); tone = ''; }
      else if (ch.winner === p) { title = LX(`Ganhaste o desafio ${nm} (${A} × ${D})`, `You won the ${nm} challenge (${A} × ${D})`); tone = 'good'; }
      else { title = LX(`Perdeste o desafio ${nm} (${A} × ${D})`, `You lost the ${nm} challenge (${A} × ${D})`); tone = 'bad'; }
      const lines = this.logs.filter(l => l.id >= mc && l.cls !== 'phase' && l.cls !== 'dim');
      await p.ctrl.inform(this, p, { title, lines, tone });
    }
  }
  sumStr(list) { return list.filter(c => c.zone === 'chars').reduce((s, c) => s + this.str(c), 0); }
  claimValue(ch) {
    let v = ch.att.plot ? ch.att.plot.d.p[2] : 1;
    v += ch.claimMod;
    for (const c of ch.attackers) if (!this.blank(c) && ab(c).claimMod) v += ab(c).claimMod(this, c, ch);
    if (this.myPlot(ch.def, '01008') && ch.def.plot.flags.calmType === ch.type) v -= 1;
    return Math.max(0, v);
  }
  async applyClaim(ch) {
    const n = this.claimValue(ch), L = ch.loser, W = ch.winner;
    if (n <= 0) return;
    this.log(`Claim ${n} (${CH_NAMES[ch.type]}).`);
    if (ch.type === 'military') {
      for (let i = 0; i < n; i++) {
        const cands = L.chars.filter(c => !(ch.killedByClaim || []).includes(c));
        if (!cands.length) break;
        const [v] = await L.ctrl.chooseCards(this, L, { prompt: LX(`Claim militar: escolhe uma personagem tua para morrer (${i + 1}/${n})`, `Military claim: choose one of your characters to kill (${i + 1}/${n})`), cands, min: 1, max: 1, ai: x => -AI.value(this, x) + (x.dupes.length ? 20 : 0) });
        (ch.killedByClaim = ch.killedByClaim || []).push(v);
        await this.kill(v);
      }
    } else if (ch.type === 'intrigue') {
      for (let i = 0; i < n && L.hand.length; i++) { const c = L.hand[Math.floor(Math.random() * L.hand.length)]; this.discardFromHand(L, c); this.log(LX(`${L.name} descarta ao acaso: ${this.cn(c)}.`, `${L.name} discards at random: ${this.cn(c)}.`)); }
    } else {
      this.movePower(L, W, n);
    }
    this.emit();
  }
  async keywords(ch) {
    const W = ch.winner, L = ch.loser;
    const parts = (W === ch.att ? ch.attackers : ch.defenders).filter(c => c.zone === 'chars');
    let intimDone = false;
    for (const c of parts) {
      if (this.hasKw(c, 'insight')) { this.log(`Insight (${this.cn(c)}):`); this.draw(W, 1); }
      if (this.hasKw(c, 'intimidate') && !intimDone && W === ch.att) {
        const t = L.chars.filter(x => !x.kneel && this.str(x) <= ch.diff);
        if (t.length) {
          const [k] = await W.ctrl.chooseCards(this, W, { prompt: LX(`Intimidate (${this.cn(c)}): ajoelha uma personagem com STR ≤ ${ch.diff}`, `Intimidate (${this.cn(c)}): kneel a character with STR ≤ ${ch.diff}`), cands: t, min: 0, max: 1, ai: x => AI.value(this, x) });
          if (k) { k.kneel = true; intimDone = true; this.log(LX(`${this.cn(c)} intimida ${this.cn(k)} (ajoelhada).`, `${this.cn(c)} intimidates ${this.cn(k)} (knelt).`)); }
        }
      }
      if (this.hasKw(c, 'pillage')) { this.log(`Pillage (${this.cn(c)}):`); this.discardTop(L); }
      if (this.hasKw(c, 'renown')) this.gainPower(W, 1, c);
    }
  }
  async offerEvents(p, timing, ch) {
    if (!p) return;
    let guard = 0;
    while (guard++ < 5) {
      const evs = p.hand.filter(c => this.canPlayEvent(p, c, timing, ch) && !(ch.usedEvents || []).includes(c.code));
      if (!evs.length) return;
      const acts = evs.map(c => ({ card: c, label: LX(`Jogar ${this.cn(c)}`, `Play ${this.cn(c)}`), ai: ab(c).ev.ai ? ab(c).ev.ai(this, p, ch) : 1, run: async () => { (ch.usedEvents = ch.usedEvents || []).push(c.code); await this.playEvent(p, c, ch); } }));
      const a = await p.ctrl.actionWindow(this, p, { prompt: timing === 'afterWin' ? LX('Ganhaste o desafio — reação?', 'You won the challenge — reaction?') : LX('Perdeste o desafio — reação?', 'You lost the challenge — reaction?'), actions: acts, passLabel: LX('Não', 'No'), ctx: { phase: 'challenges', ch, reaction: true } });
      if (!a) return;
      await a.run();
    }
  }
  cleanupChallenge() {
    const ch = this.ch; if (!ch) return;
    for (const c of this.allChars()) { c.tmp = 0; c.tmpIcons = ''; c.tmpKw = {}; }
    this.ch = null; this.emit();
  }
  // ---------- dominance ----------
  domStr(p) {
    let s = p.gold;
    for (const c of p.chars) if (!c.kneel) s += this.str(c);
    for (const c of this.inPlay(p)) if (!this.blank(c) && ab(c).domStr) s += ab(c).domStr(this, c);
    return s;
  }
  async dominancePhase() {
    const m0 = this.mark();
    this.phase = 'dominance'; this.log('— Dominance —', 'phase');
    await this.actionRound({ phase: 'dominance' }, this.first, LX('Dominance: ações antes de calcular?', 'Dominance: actions before it is determined?'));
    const [a, b] = this.players; const da = this.domStr(a), db = this.domStr(b);
    this.log(`Dominance: ${a.name} ${da} × ${b.name} ${db}.`);
    if (da !== db) {
      const w = da > db ? a : b; this.log(LX(`${w.name} ganha dominance.`, `${w.name} wins dominance.`), 'chw'); this.gainPower(w, 1);
      if (this.myPlot(w, '01002')) { this.log('A Feast for Crows:'); this.gainPower(w, 2); }
    } else this.log(LX('Empate: ninguém ganha dominance.', 'Tie: nobody wins dominance.'));
    await this.fire('onDominanceEnd');
    await this.inform(da === db ? LX('Dominance: empate', 'Dominance: tie') : LX(`Dominance: ${(da > db ? a : b).name} ganha`, `Dominance: ${(da > db ? a : b).name} wins`), m0, da === db ? '' : ((da > db ? a : b).ctrl.inform ? 'good' : 'bad'));
    await this.endPhase();
  }
  async standingPhase() {
    this.mEnd = this.mark();
    this.phase = 'standing'; this.log('— Standing —', 'phase');
    const stood = [];
    for (const p of this.players) { p.fknelt = false; for (const c of this.inPlay(p)) if (c.kneel) { c.kneel = false; stood.push(c); } }
    for (const c of stood) if (c.zone === 'chars' && !this.blank(c) && ab(c).afterStand && this.canTrigger(c.owner)) await ab(c).afterStand(this, c);
    await this.endPhase();
  }
  async taxationPhase() {
    this.phase = 'taxation'; this.log('— Taxation —', 'phase');
    for (const p of this.players) p.gold = 0;
    for (const p of this.order()) {
      const r = this.reserve(p); const over = p.hand.length - r;
      if (over > 0) {
        const cs = await p.ctrl.chooseCards(this, p, { prompt: LX(`Reserve ${r}: descarta ${over} carta${over > 1 ? 's' : ''} da mão`, `Reserve ${r}: discard ${over} card${over > 1 ? 's' : ''} from your hand`), cands: [...p.hand], min: over, max: over, ai: x => -AI.handValue(this, p, x) });
        for (const c of cs) this.discardFromHand(p, c);
        this.log(LX(`${p.name} descarta ${over} carta(s) por reserve: ${cs.map(c => this.cn(c)).join(', ')}.`, `${p.name} discards ${over} card(s) to reserve: ${cs.map(c => this.cn(c)).join(', ')}.`));
      }
    }
    await this.inform(LX('Fim da ronda', 'End of round'), this.mEnd);
    await this.endPhase();
  }
}
