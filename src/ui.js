// ================= INTERFACE (PT / EN) =================
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TYPE_PT = i18nObj({ character: 'Personagem', location: 'Local', attachment: 'Anexo', event: 'Evento', plot: 'Plot', agenda: 'Agenda' },
  { character: 'Character', location: 'Location', attachment: 'Attachment', event: 'Event', plot: 'Plot', agenda: 'Agenda' });
const KW_PT = i18nObj({ renown: 'Renown', stealth: 'Stealth', insight: 'Insight', intimidate: 'Intimidate', pillage: 'Pillage', limited: 'Limited', noAttach: 'Sem anexos', terminal: 'Terminal' },
  { renown: 'Renown', stealth: 'Stealth', insight: 'Insight', intimidate: 'Intimidate', pillage: 'Pillage', limited: 'Limited', noAttach: 'No attachments', terminal: 'Terminal' });
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};

// ---------- imagens das cartas (ThronesDB, com reserva no CDN da FFG) ----------
const PACK_CGDB = { '01': 1 };
const APP_VERSION = 'v0.5';
const IMG = {
  on: store.get('agot_img', true), fails: 0, oks: 0, broken: new Set(), good: new Map(),
  urls(code) {
    // Formato atual do ThronesDB: /images/cards/GT{pack cgdb}_{número}.jpg (ex.: Core 01104 → GT01_104.jpg)
    const u = [];
    const cg = PACK_CGDB[code.slice(0, 2)], num = parseInt(code.slice(2), 10);
    if (cg) u.push(`https://thronesdb.com/images/cards/GT${String(cg).padStart(2, '0')}_${num}.jpg`);
    u.push(`https://thronesdb.com/bundles/cards/${code}.png`);
    u.push(`https://theironthrone.net/img/cards/${code}.png`);
    return u;
  },
  tag(code, cls) {
    if (!this.on || this.broken.has(code)) return '';
    const g = this.good.get(code);
    return `<img class="${cls || 'cimg'}${g != null ? ' ok' : ''}" src="${this.urls(code)[g || 0]}" data-img="${code}" data-try="${g || 0}" alt="" referrerpolicy="no-referrer" onload="imgOk(this)" onerror="imgFail(this)">`;
  },
};
function imgOk(el) { IMG.oks++; IMG.good.set(el.dataset.img, +el.dataset.try); el.classList.add('ok'); el.parentElement && el.parentElement.classList.add('hasimg'); }
function imgFail(el) {
  const code = el.dataset.img, i = +el.dataset.try + 1, u = IMG.urls(code);
  if (i < u.length) { el.dataset.try = i; el.src = u[i]; return; }
  IMG.broken.add(code); IMG.fails++; el.remove();
  if (IMG.fails >= 6 && IMG.oks === 0 && !IMG.warned) { IMG.warned = true; const t = IMG.urls('01090')[0]; UI.toast(LX(`As imagens das cartas não carregaram. Testa abrir este endereço noutro separador: ${t} — se abrir lá mas não aqui, o site está a bloquear imagens embutidas.`, `Card images did not load. Try opening this address in another tab: ${t} — if it opens there but not here, the site is blocking embedded images.`)); }
}

// ---------- desenho das cartas ----------
const ICON_SYM = { M: '⚔', I: '👁', P: '♛' };
function iconsHTML(str) { return [...(str || '')].map(L => `<span class="ic ${L}" title="${CH_NAMES[{ M: 'military', I: 'intrigue', P: 'power' }[L]]}">${ICON_SYM[L]}</span>`).join(''); }
function kwList(d, inst, g) {
  const out = [];
  for (const k of ['renown', 'stealth', 'insight', 'intimidate', 'pillage', 'limited', 'terminal']) if (inst && g ? g.hasKw(inst, k) : d.k?.[k]) out.push(KW_PT[k]);
  if (d.k?.ambush != null) out.push(`Ambush(${d.k.ambush})`);
  if (d.m) for (const [k, v] of Object.entries(d.m)) out.push(`${v > 0 ? '+' : ''}${v} ${LX({ income: 'Ouro', initiative: 'Inic.', reserve: 'Res.' }, { income: 'Gold', initiative: 'Init.', reserve: 'Res.' })[k]}`);
  return out;
}
function cardHTML(d, inst, opts = {}) {
  const g = UI.game;
  const fc = `--fc:var(--f-${d.f})`;
  const cls = ['card', 'fac-' + d.f, ...(opts.cls || [])];
  const uid = inst ? `data-uid="${inst.uid}"` : `data-code="${d.c}"`;
  const img = IMG.tag(d.c);
  if (img && IMG.good.has(d.c)) cls.push('hasimg');
  if (d.t === 'plot') {
    return `<div class="${cls.join(' ')} plotc" style="${fc}" ${uid}><div class="hd" style="padding-left:4px">${esc(d.n)}</div><div class="body"><div class="ty">Plot · ${esc(d.tr.join('. '))}</div>${isAuto(d.c) ? '' : '<div class="warn">⚠</div>'}</div><div class="pst"><span title="Gold">💰${d.p[0]}</span><span title="Initiative">⚡${d.p[1]}</span><span title="Claim">⚔${d.p[2]}</span><span title="Reserve">✋${d.p[3]}</span></div>${img}</div>`;
  }
  let s = '', ic = d.i || '', ov = '';
  if (d.t === 'character') {
    let v = d.s, c2 = '';
    if (inst && g && inst.zone === 'chars') {
      v = g.str(inst); c2 = v > d.s ? 'up' : v < d.s ? 'down' : '';
      ic = CH_TYPES.filter(t => g.hasIcon(inst, t)).map(t => ICON_OF[t]).join('');
      if (g.blank(inst)) cls.push('blank');
      if (c2) ov += `<span class="ovstr ${c2}" title="STR">${v}</span>`;
      const gained = [...ic].filter(L => !(d.i || '').includes(L)).join('');
      if (gained) ov += `<span class="ovic">${iconsHTML(gained)}</span>`;
    }
    s = `<div class="str ${c2}">${v}</div><div class="icons">${iconsHTML(ic)}</div>`;
  }
  const kws = kwList(d, inst && inst.zone === 'chars' ? inst : null, g);
  let badges = '';
  if (inst) { if (inst.power) badges += `<span class="tok pow" title="Power">${inst.power}</span>`; if (inst.dupes.length) badges += `<span class="tok dup" title="Duplicates">+${inst.dupes.length}</span>`; }
  const mid = d.t !== 'character' ? `<div class="mid">${esc(d.tr.join('. '))}</div>` : '';
  return `<div class="${cls.join(' ')}" style="${fc}" ${uid}>
    ${d.cost != null ? `<div class="cost">${d.cost}</div>` : ''}<div class="hd">${d.u ? '◆ ' : ''}${esc(d.n)}</div>
    <div class="body"><div class="ty">${TYPE_PT[d.t]}${d.l ? ' · Loyal' : ''}</div>${d.t === 'character' ? `<div class="tr" style="padding-left:18px">${esc(d.tr.join('. '))}</div>` : ''}</div>
    ${mid}${s}<div class="kw" ${d.t !== 'character' ? 'style="left:3px"' : ''}>${esc(kws.join(' · '))}</div>
    ${img}<div class="ov">${ov}</div>
    ${isAuto(d.c) ? '' : `<div class="warn" title="${LX('Habilidade ainda não automatizada', 'Ability not automated yet')}">⚠</div>`}
    <div class="badges">${badges}</div></div>`;
}
function previewHTML(d, inst) {
  const g = UI.game;
  let h = IMG.tag(d.c, 'pvimg' + (d.t === 'plot' ? ' plot' : ''));
  h += `<div class="pv-name">${d.u ? '◆ ' : ''}${esc(d.n)}</div><div class="pv-meta"><span class="fdot" style="--fc:var(--f-${d.f})"></span>${FACTION_NAMES[d.f]} · ${TYPE_PT[d.t]}${d.l ? ' · Loyal' : ''}</div>`;
  if (d.t === 'plot') h += `<div class="pv-row"><span class="stat g">${LX('Ouro', 'Gold')} ${d.p[0]}</span><span class="stat">${LX('Iniciativa', 'Initiative')} ${d.p[1]}</span><span class="stat">Claim ${d.p[2]}</span><span class="stat">Reserve ${d.p[3]}</span></div>`;
  else {
    const row = [];
    if (d.cost != null) row.push(`<span class="stat g">${LX('Custo', 'Cost')} ${d.cost}</span>`);
    if (d.t === 'character') { const v = inst && g && inst.zone === 'chars' ? g.str(inst) : d.s; row.push(`<span class="stat">STR ${v}${v !== d.s ? ` (base ${d.s})` : ''}</span>`); const ic = inst && g && inst.zone === 'chars' ? CH_TYPES.filter(t => g.hasIcon(inst, t)).map(t => ICON_OF[t]).join('') : d.i; row.push(iconsHTML(ic)); }
    if (inst && inst.power) row.push(`<span class="stat p">${LX('Poder', 'Power')} ${inst.power}</span>`);
    h += `<div class="pv-row">${row.join('')}</div>`;
  }
  if (d.tr.length) h += `<div><i>${esc(d.tr.join('. '))}.</i></div>`;
  const kws = kwList(d, inst && inst.zone === 'chars' ? inst : null, g);
  if (kws.length) h += `<div class="pv-row"><b>${esc(kws.join(' · '))}</b></div>`;
  const a = abText(d.c);
  if (a) h += `<div class="pv-txt">${esc(a)}</div>`;
  else if (d.v) h += `<div class="pv-txt">${kws.length ? LX('Só keywords/modificadores — totalmente automatizada.', 'Keywords/modifiers only — fully automated.') : LX('Sem texto de habilidade.', 'No ability text.')}</div>`;
  else h += `<div class="pv-txt pv-warn">${LX('⚠ Habilidade ainda não automatizada: a carta joga apenas com custo, STR, ícones e keywords.', '⚠ Ability not automated yet: the card plays with cost, STR, icons and keywords only.')}</div>`;
  if (inst) {
    if (inst.att && inst.att.length) h += `<div class="pv-row">${LX('Anexos', 'Attachments')}: ${inst.att.map(x => esc(x.d.n)).join(', ')}</div>`;
    if (inst.kneel) h += `<div class="pv-row" style="color:var(--dim)">${LX('Ajoelhada', 'Knelt')}</div>`;
    if (inst.flags && inst.flags.poison) h += `<div class="pv-row" style="color:#9f9">☠ ${LX('Envenenada', 'Poisoned')}</div>`;
  }
  h += `<div class="pv-row"><a href="https://thronesdb.com/card/${d.c}" target="_blank" rel="noopener" class="note">ThronesDB ↗</a></div>`;
  return h;
}
function showPreview(d, inst) { const h = previewHTML(d, inst); document.querySelectorAll('.pvbox').forEach(e => e.innerHTML = h); }

// ---------- controlador humano ----------
class HumanCtrl {
  constructor() { this.isAI = false; }
  chooseCards(g, p, o) {
    if (!o.cands.length) return Promise.resolve([]);
    if (!o.force && o.cands.length <= o.min) return Promise.resolve([...o.cands]);
    return new Promise(res => UI.setPending({ kind: 'select', ...o, sel: [], resolve: res }));
  }
  chooseOption(g, p, o) { return new Promise(res => UI.setPending({ kind: 'option', ...o, resolve: res })); }
  actionWindow(g, p, o) { return new Promise(res => UI.setPending({ kind: 'action', ...o, resolve: res })); }
  inform(g, p, o) {
    if (!UI.pauseInfo) { UI.toast(o.title + ' — ' + o.lines.slice(-3).map(l => l.msg).join(' · '), o.tone); return Promise.resolve(); }
    return new Promise(res => UI.setPending({ kind: 'info', ...o, resolve: res }));
  }
}

const UI = {
  game: null, me: null, pending: null, cardMap: new Map(), rq: false, curTab: 'play', pauseInfo: store.get('agot_pause', true), logOpen: store.get('agot_log', true),
  decks: [], cur: null, curIdx: -1,
  filt: { type: 'character', fac: 'mine', q: '', auto: false },
  init() {
    this.decks = store.get('agot_decks', []);
    document.querySelectorAll('header nav button').forEach(b => b.onclick = () => this.tab(b.dataset.t));
    document.addEventListener('mouseover', e => {
      const u = e.target.closest('[data-uid]'); if (u) { const c = this.cardMap.get(+u.dataset.uid); if (c) showPreview(c.d, c); return; }
      const k = e.target.closest('[data-code]'); if (k && DB[k.dataset.code]) showPreview(DB[k.dataset.code], null);
    });
    document.addEventListener('click', e => { const m = document.querySelector('.menu'); if (m && !m.contains(e.target)) m.remove(); }, true);
    $('#langBtn').onclick = () => this.setLang(LANG === 'pt' ? 'en' : 'pt');
    $('#imgBtn').onclick = () => { IMG.on = !IMG.on; store.set('agot_img', IMG.on); this.refreshAll(); };
    $('#pauseBtn').onclick = () => { this.pauseInfo = !this.pauseInfo; store.set('agot_pause', this.pauseInfo); this.refreshAll(); };
    $('#kwBtn').onclick = () => this.keywordsModal();
    $('#logToggle').onclick = () => { this.logOpen = !this.logOpen; store.set('agot_log', this.logOpen); this.applyLog(); };
    document.addEventListener('keydown', e => { if (this.pending && this.pending.kind === 'info' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.resolve(); } });
    this.applyLog();
    this.selectDeck(0, true);
    this.refreshAll();
    this.tab('play');
  },
  setLang(l) { LANG = l; try { localStorage.setItem('agot_lang', l); } catch (e) { } this.refreshAll(); },
  refreshAll() {
    document.documentElement.lang = LANG;
    $('#langBtn').textContent = LANG === 'pt' ? 'EN' : 'PT';
    $('#langBtn').title = LX('Switch to English', 'Mudar para português');
    $('#pauseBtn').textContent = this.pauseInfo ? LX('⏸ Resumos: ligados', '⏸ Summaries: on') : LX('⏸ Resumos: desligados', '⏸ Summaries: off');
    $('#pauseBtn').title = LX('Parar depois de cada desafio/fase para mostrar o que aconteceu', 'Pause after each challenge/phase to show what happened');
    $('#kwBtn').textContent = 'Keywords';
    this.applyLog();
    $('#imgBtn').textContent = IMG.on ? LX('🖼 Imagens: ligadas', '🖼 Images: on') : LX('🖼 Imagens: desligadas', '🖼 Images: off');
    const nav = { play: LX('Jogar', 'Play'), decks: 'Decks', help: LX('Cartas & Regras', 'Cards & Rules') };
    document.querySelectorAll('header nav button').forEach(b => b.textContent = nav[b.dataset.t]);
    $('#tagline').textContent = LX('Protótipo · Core Set · contra IA', 'Prototype · Core Set · vs AI') + ' · ' + APP_VERSION;
    document.querySelectorAll('.pvbox').forEach(e => e.innerHTML = `<span class="note">${LX('Passa o rato por cima de uma carta para ver os detalhes.', 'Hover over a card to see its details.')}</span>`);
    this.renderLobby(); this.renderDeckList(); if (this.cur) { this.renderPool(); this.renderDeckSide(); } this.renderHelp();
    if (this.game) this.render();
  },
  toast(msg, tone) { let box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); } const t = document.createElement('div'); t.className = 'toast ' + (tone || ''); t.textContent = msg; box.appendChild(t); setTimeout(() => t.remove(), 9000); t.onclick = () => t.remove(); },
  applyLog() { const g = $('#gright'); if (!g) return; g.classList.toggle('nolog', !this.logOpen); $('#logToggle').textContent = this.logOpen ? LX('▾ Esconder log', '▾ Hide log') : LX('▸ Mostrar log', '▸ Show log'); },
  keywordsModal() {
    const K = LX([
      ['Ambush (X)', 'Durante a fase de desafios, podes pagar X ouro para pôr esta carta em jogo diretamente da mão.'],
      ['Insight', 'Depois de ganhares um desafio em que esta personagem participa, compras 1 carta.'],
      ['Intimidate', 'Depois de ganhares um desafio como atacante com uma personagem com intimidate, podes ajoelhar uma personagem do adversário com STR igual ou inferior à diferença com que ganhaste. Só 1 personagem por desafio.'],
      ['Limited', 'Cada jogador só pode jogar 1 carta limited por ronda (e só 1 no setup).'],
      ['No attachments / Sem anexos', 'Esta carta não pode ter anexos.'],
      ['Pillage', 'Depois de ganhares um desafio em que esta personagem participa, o adversário descarta a carta do topo do baralho.'],
      ['Renown', 'Depois de ganhares um desafio em que esta personagem participa, ela ganha 1 poder.'],
      ['Stealth', 'Quando declaras esta personagem como atacante, escolhes uma personagem do adversário sem stealth: essa não pode defender neste desafio.'],
      ['Terminal', 'Se a personagem anexada sair de jogo, este anexo vai para o descarte (não volta à mão).'],
      ['Unopposed', 'Se o atacante ganhar e a força total da defesa for 0, ganha +1 poder.'],
      ['Claim', 'Número no plot do atacante. Militar: o perdedor mata essa quantidade de personagens. Intriga: descarta essa quantidade de cartas ao acaso da mão. Poder: o atacante rouba essa quantidade de poder à facção do perdedor.'],
      ['Reserve', 'No fim da ronda, quem tiver mais cartas na mão do que o reserve do seu plot descarta o excesso.'],
      ['Dominance', 'Soma da STR das personagens em pé + ouro que sobrou. Quem tiver mais ganha 1 poder.'],
      ['Duplicado', 'Uma cópia extra de uma carta única que já tens em jogo pode ser colocada por baixo dela sem custo. Se a carta fosse morta ou descartada, descartas o duplicado para a salvar.'],
    ], [
      ['Ambush (X)', 'During the challenges phase you may pay X gold to put this card into play straight from your hand.'],
      ['Insight', 'After you win a challenge this character took part in, draw 1 card.'],
      ['Intimidate', "After you win a challenge as attacker with an intimidate character, you may kneel an opponent's character whose STR is no higher than your margin of victory. Only 1 character per challenge."],
      ['Limited', 'Each player may play only 1 limited card per round (and only 1 during setup).'],
      ['No attachments', 'This card cannot have attachments.'],
      ['Pillage', 'After you win a challenge this character took part in, your opponent discards the top card of their deck.'],
      ['Renown', 'After you win a challenge this character took part in, it gains 1 power.'],
      ['Stealth', "When you declare this character as an attacker, choose an opponent's character without stealth: it cannot defend this challenge."],
      ['Terminal', 'If the attached character leaves play, this attachment goes to the discard pile instead of returning to hand.'],
      ['Unopposed', "If the attacker wins and the defenders' total STR is 0, the attacker gains 1 power."],
      ['Claim', "The number on the attacker's plot. Military: the loser kills that many characters. Intrigue: the loser discards that many random cards from hand. Power: the attacker takes that much power from the loser's faction."],
      ['Reserve', 'At the end of the round, anyone holding more cards than their plot\'s reserve discards the excess.'],
      ['Dominance', 'Total STR of standing characters + unspent gold. Highest total gains 1 power.'],
      ['Duplicate', 'An extra copy of a unique card you already have in play can be placed under it for free. If the card would be killed or discarded, discard the duplicate to save it.'],
    ]);
    this.modal(`<div class="kwlist">${K.map(([k, v]) => `<div><b>${esc(k)}</b><p>${esc(v)}</p></div>`).join('')}</div>`, [{ label: 'OK' }], LX('Keywords e termos', 'Keywords and terms'));
  },
  tab(t) {
    this.curTab = t;
    document.querySelectorAll('header nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
    if (t === 'play') { (this.game ? $('#game') : $('#lobby')).classList.add('on'); if (!this.game) this.renderLobby(); }
    else $('#' + t).classList.add('on');
    if (t === 'decks') this.renderDeckList();
  },
  allDecks() { return [...STARTER_DECKS, ...this.decks]; },
  // ---------- lobby ----------
  renderLobby() {
    const prevMe = $('#lbMe') ? $('#lbMe').value : null, prevAi = $('#lbAi') ? $('#lbAi').value : null;
    const opts = this.allDecks().map((d, i) => { const v = validateDeck(d).length === 0; return `<option value="${i}">${esc(d.name)}${v ? '' : LX(' (inválido)', ' (invalid)')}</option>`; }).join('');
    $('#lobby').innerHTML = `<div class="wrap"><div class="lobby">
      <div class="panel"><h2>${LX('Nova partida contra a IA', 'New game against the AI')}</h2>
      <label>${LX('O teu deck', 'Your deck')}</label><select id="lbMe">${opts}</select>
      <label>${LX('Deck da IA', "AI's deck")}</label><select id="lbAi">${opts}</select>
      <label>${LX('Velocidade da IA', 'AI speed')}</label><select id="lbSpd"><option value="700">${LX('Lenta', 'Slow')}</option><option value="350" selected>Normal</option><option value="80">${LX('Rápida', 'Fast')}</option></select>
      <div style="margin-top:14px;display:flex;gap:8px"><button class="pri" id="lbGo">${LX('Começar partida', 'Start game')}</button></div>
      <p class="note" id="lbMsg"></p></div>
      <div class="panel"><h2>${LX('Como jogar', 'How to play')}</h2><div class="note">${LX(
      'A barra dourada por cima da tua mão diz sempre o que tens de fazer. Cartas com contorno <b style="color:#46d06a">verde</b> podem ser escolhidas ou ativadas — clica nelas. Passa o rato por cima de qualquer carta para ver os detalhes à direita.<br>Tudo é automático: rendimento, iniciativa, claim, keywords (renown, insight, intimidate, pillage, stealth), dominance, reserve e as habilidades das cartas automatizadas. Cartas marcadas com ⚠ ainda não têm a habilidade programada.',
      'The gold bar above your hand always tells you what to do. Cards outlined in <b style="color:#46d06a">green</b> can be chosen or used — click them. Hover over any card to see its details on the right.<br>Everything is automated: income, initiative, claim, keywords (renown, insight, intimidate, pillage, stealth), dominance, reserve and the abilities of automated cards. Cards marked ⚠ do not have their ability programmed yet.')}</div></div>
    </div></div>`;
    $('#lbMe').value = prevMe ?? '0'; $('#lbAi').value = prevAi ?? String(Math.min(1, this.allDecks().length - 1));
    if (!$('#lbMe').value) $('#lbMe').value = '0'; if (!$('#lbAi').value) $('#lbAi').value = '0';
    $('#lbGo').onclick = () => {
      const a = this.allDecks()[+$('#lbMe').value], b = this.allDecks()[+$('#lbAi').value];
      const ea = validateDeck(a), eb = validateDeck(b);
      if (ea.length || eb.length) { $('#lbMsg').innerHTML = `<span style="color:#ff9c90">${LX('Deck inválido', 'Invalid deck')}: ${esc([...ea, ...eb][0])}</span>`; return; }
      this.startGame(a, b, +$('#lbSpd').value);
    };
  },
  startGame(da, db, delay) {
    this.pending = null;
    const you = LX('tu', 'you'), ai = LX('IA', 'AI');
    const g = new Game([da, db], [new HumanCtrl(), new AICtrl(delay)], [`${FACTION_NAMES[da.faction]} (${you})`, `${FACTION_NAMES[db.faction]} (${ai})`]);
    this.game = g; this.me = g.players[0];
    g.onUpdate = () => this.schedule();
    this.tab('play');
    this.render();
    g.run().then(w => { if (this.game !== g) return; this.render(); this.modal(`<div class="overlay-win">${w === this.me ? LX('🏆 Vitória!', '🏆 Victory!') : LX('Derrota', 'Defeat')}</div><p style="text-align:center">${esc(g.logs.filter(l => l.cls === 'win').pop()?.msg || '')}</p>`, [{ label: LX('Nova partida', 'New game'), pri: true, fn: () => { this.game = null; this.tab('play'); } }, { label: LX('Ver tabuleiro', 'View board') }], LX('Fim da partida', 'Game over')); })
      .catch(e => { console.error(e); this.modal(`<p>${LX('Ocorreu um erro no motor de jogo:', 'The game engine hit an error:')}</p><pre style="white-space:pre-wrap;color:#ff9c90">${esc(e.stack || e)}</pre>`, [{ label: 'OK' }], LX('Erro', 'Error')); });
  },
  schedule() { if (this.rq) return; this.rq = true; requestAnimationFrame(() => { this.rq = false; this.render(); }); },
  setPending(p) { this.pending = p; this.render(); },
  resolve(v) { const p = this.pending; this.pending = null; const m = document.querySelector('.modal.sel-modal'); if (m) m.remove(); p.resolve(v); this.render(); },
  // ---------- render jogo ----------
  render() {
    const g = this.game; if (!g) return;
    const me = this.me, op = me.opp, P = this.pending;
    this.cardMap = new Map();
    const reg = c => { this.cardMap.set(c.uid, c); };
    const candSet = new Set(), selSet = new Set(), actMap = new Map();
    if (P && P.kind === 'select') { P.cands.forEach(c => candSet.add(c.uid)); P.sel.forEach(c => selSet.add(c.uid)); }
    if (P && P.kind === 'action') for (const a of P.actions) if (a.card) { if (!actMap.has(a.card.uid)) actMap.set(a.card.uid, []); actMap.get(a.card.uid).push(a); }
    const ch = g.ch;
    const deco = c => { const cl = []; if (selSet.has(c.uid)) cl.push('sel'); else if (candSet.has(c.uid)) cl.push('cand'); else if (actMap.has(c.uid)) cl.push('act'); if (ch && ch.attackers.includes(c)) cl.push('atk'); if (ch && ch.defenders.includes(c)) cl.push('def'); return cl; };
    const slot = c => {
      reg(c); c.att.forEach(reg); c.dupes.forEach(reg);
      const atts = c.att.map(a => `<div class="attc ${a.kneel ? 'kn' : ''} ${deco(a).join(' ')}" data-uid="${a.uid}">📎 ${esc(a.d.n)}</div>`).join('');
      return `<div class="slot ${c.kneel ? 'kneel' : ''}">${cardHTML(c.d, c, { cls: deco(c) })}<div class="atts">${atts}</div></div>`;
    };
    const visible = new Set();
    [...me.chars, ...me.locs, ...op.chars, ...op.locs, ...me.hand].forEach(c => { visible.add(c.uid); c.att.forEach(a => visible.add(a.uid)); });
    const pp = (p, mine) => {
      const plot = p.plot ? (reg(p.plot), cardHTML(p.plot.d, p.plot)) : `<span class="note">${LX('Sem plot revelado', 'No plot revealed')}</span>`;
      return `<div class="pp ${mine ? 'me' : ''}"><div class="nm"><span>${esc(p.name)}${g.first === p ? ` <small title="${LX('Primeiro jogador', 'First player')}" style="font-size:11px;color:#ffd36a">★1º</small>` : ''}</span><span class="fbadge f-${p.faction} ${p.fknelt ? 'kn' : ''}" style="--fc:var(--f-${p.faction})">${FACTION_NAMES[p.faction]}</span></div>
      <div class="stats"><span class="stat p" title="${LX('Poder total', 'Total power')}">⚑ ${g.totalPower(p)}/15</span><span class="stat g" title="${LX('Ouro', 'Gold')}">💰 ${p.gold}</span><span class="stat" title="${LX('Mão', 'Hand')}">✋ ${p.hand.length}</span>${p.plot ? (() => { const base = p.plot.d.p[2]; const cur = g.ch && g.ch.att === p ? g.claimValue(g.ch) : base; return `<span class="stat ${cur > base ? 'up' : cur < base ? 'down' : ''}" title="Claim${cur !== base ? LX(' (base ', ' (base ') + base + ')' : ''}">⚔ Claim ${cur}</span><span class="stat" title="Reserve">📜 ${LX('Reserve', 'Reserve')} ${g.reserve(p)}</span>`; })() : ''}${p.agenda ? `<span class="stat" data-code="${p.agenda}">${esc(DB[p.agenda].n)}</span>` : ''}</div>
      <div class="piles"><button data-pile="deck" data-p="${p.i}">${LX('Baralho', 'Deck')} ${p.deck.length}</button><button data-pile="discard" data-p="${p.i}">${LX('Descarte', 'Discard')} ${p.discard.length}</button><button data-pile="dead" data-p="${p.i}">${LX('Mortos', 'Dead')} ${p.dead.length}</button><button data-pile="used" data-p="${p.i}">Plots ${p.plots.length} (${LX('usados', 'used')} ${p.used.length})</button></div>
      <div class="mini-plot">${plot}</div></div>`;
    };
    $('#gside').innerHTML = pp(op, false) + `<div class="phasebox"><b>${g.phase === 'end' ? LX('FIM', 'END') : (PHASE_NAMES[g.phase] || '').toUpperCase()}</b><span class="note">${LX('Ronda', 'Round')} ${g.round || '—'}</span></div>` + pp(me, true) + `<button id="btnQuit" class="warn">${LX('Abandonar partida', 'Quit game')}</button>`;
    let chb = '';
    if (ch) chb = `<div class="chb">⚔ ${CH_NAMES[ch.type]} · <span class="a">${esc(ch.att.name)} ${g.sumStr(ch.attackers)}</span> × <span class="d">${esc(ch.def.name)} ${g.sumStr(ch.defenders)}</span> · claim ${g.claimValue(ch)}</div>`;
    $('#board').innerHTML = `
      <div class="row locs"><span class="lbl">${LX('Locais adversário', 'Opponent locations')}</span>${op.locs.map(slot).join('')}</div>
      <div class="row"><span class="lbl">${LX('Personagens adversário', 'Opponent characters')}</span>${op.chars.map(slot).join('')}</div>
      <div class="divider"><div class="ln"></div>${chb}<div class="ln"></div></div>
      <div class="row"><span class="lbl">${LX('As tuas personagens', 'Your characters')}</span>${me.chars.map(slot).join('')}</div>
      <div class="row locs"><span class="lbl">${LX('Os teus locais', 'Your locations')}</span>${me.locs.map(slot).join('')}</div>`;
    $('#hand').innerHTML = me.hand.map(c => { reg(c); return cardHTML(c.d, c, { cls: deco(c) }); }).join('');
    const pr = $('#prompt');
    if (!P) {
      pr.innerHTML = g.phase === 'end' ? `<div class="txt">${LX('Partida terminada', 'Game over')} — ${esc(g.winner?.name || '')} ${LX('venceu', 'won')}.</div><button class="pri" id="btnNew">${LX('Nova partida', 'New game')}</button>` : `<div class="txt wait">${LX('A IA está a jogar…', 'The AI is playing…')}</div>`;
      if ($('#btnNew')) $('#btnNew').onclick = () => { this.game = null; this.tab('play'); };
    } else if (P.kind === 'select') {
      const n = P.sel.length, ok = n >= P.min && n <= P.max;
      const single = P.max === 1;
      pr.innerHTML = `<div class="txt">${esc(P.prompt)}${P.max > 1 ? ` <span class="note">(${n} ${LX('selecionada(s)', 'selected')}; ${P.min === P.max ? P.min : `${P.min}–${P.max}`})</span>` : ''}</div>
        ${!single || P.min === 0 ? `<button class="pri" id="btnOk" ${ok ? '' : 'disabled'}>${esc(P.doneLabel || (single && n === 0 ? LX('Nenhuma', 'None') : LX('Confirmar', 'Confirm')))}</button>` : ''}
        ${P.max > 1 && P.cands.length > 1 ? `<button id="btnAll">${LX('Todas', 'All')}</button>` : ''}`;
      if ($('#btnOk')) $('#btnOk').onclick = () => this.resolve(P.sel);
      if ($('#btnAll')) $('#btnAll').onclick = () => { P.sel = P.cands.slice(0, P.max); this.render(); };
      if (P.modal || P.cands.some(c => !visible.has(c.uid))) this.selModal(P);
    } else if (P.kind === 'info') {
      pr.innerHTML = `<div class="txt">${esc(P.title)}</div><button class="pri" id="btnInfo">OK (Enter)</button>`;
      $('#btnInfo').onclick = () => this.resolve();
    } else if (P.kind === 'option') {
      pr.innerHTML = `<div class="txt">${esc(P.prompt)}</div>` + P.options.map((o, i) => `<button class="${i === 0 ? 'pri' : ''}" data-opt="${i}">${esc(o.label)}</button>`).join('');
      pr.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => this.resolve(P.options[+b.dataset.opt].value));
      if (P.card) showPreview(P.card.d, P.card);
    } else if (P.kind === 'action') {
      const loose = P.actions.filter(a => !a.card || !visible.has(a.card.uid));
      pr.innerHTML = `<div class="txt">${esc(P.prompt)}</div>` + (P.buttons || []).map((b, i) => `<button class="pri" data-btn="${i}">${esc(b.label)}</button>`).join('') + loose.map((a, i) => `<button data-loose="${i}">${esc(a.label)}</button>`).join('') + `<button data-pass="1">${esc(P.passLabel || LX('Passar', 'Pass'))}</button>`;
      pr.querySelectorAll('[data-btn]').forEach(b => b.onclick = () => this.resolve({ button: P.buttons[+b.dataset.btn].value }));
      pr.querySelectorAll('[data-loose]').forEach(b => b.onclick = () => this.resolve(loose[+b.dataset.loose]));
      pr.querySelector('[data-pass]').onclick = () => this.resolve(null);
    }
    let ib = $('#infoBox');
    if (P && P.kind === 'info') {
      if (!ib) { ib = document.createElement('div'); ib.id = 'infoBox'; $('#gcenter').appendChild(ib); }
      ib.className = 'infobox ' + (P.tone || '');
      ib.innerHTML = `<h3>${esc(P.title)}</h3><div class="ilines">${P.lines.map(l => `<div class="${l.cls}">${esc(l.msg)}</div>`).join('')}</div><button class="pri" id="btnInfo2">OK</button>`;
      $('#btnInfo2').onclick = () => this.resolve();
    } else if (ib) ib.remove();
    const lg = $('#log'); const atBottom = lg.scrollHeight - lg.scrollTop - lg.clientHeight < 40;
    lg.innerHTML = g.logs.map(l => `<div class="${l.cls}">${esc(l.msg)}</div>`).join('');
    if (atBottom) lg.scrollTop = lg.scrollHeight;
    $('#gcenter').onclick = e => this.onCardClick(e, actMap);
    $('#gside').onclick = e => {
      const b = e.target.closest('[data-pile]'); if (b) return this.showPile(g.players[+b.dataset.p], b.dataset.pile);
      if (e.target.id === 'btnQuit') return this.modal(`<p>${LX('Abandonar a partida em curso?', 'Quit the current game?')}</p>`, [{ label: LX('Abandonar', 'Quit'), pri: true, fn: () => { this.game = null; this.pending = null; this.tab('play'); } }, { label: LX('Cancelar', 'Cancel') }], LX('Abandonar', 'Quit'));
      this.onCardClick(e, actMap);
    };
  },
  onCardClick(e, actMap) {
    const el = e.target.closest('[data-uid]'); if (!el) return;
    const uid = +el.dataset.uid; const c = this.cardMap.get(uid); const P = this.pending; if (!P || !c) return;
    if (P.kind === 'select') this.toggleSel(P, c);
    else if (P.kind === 'action') {
      const acts = actMap.get(uid); if (!acts) return;
      if (acts.length === 1) return this.resolve(acts[0]);
      const m = document.createElement('div'); m.className = 'menu'; m.style.left = Math.min(e.clientX, innerWidth - 260) + 'px'; m.style.top = Math.min(e.clientY, innerHeight - 40 * acts.length - 20) + 'px';
      acts.forEach(a => { const b = document.createElement('button'); b.textContent = a.label; b.onclick = () => { m.remove(); this.resolve(a); }; m.appendChild(b); });
      document.body.appendChild(m);
    }
  },
  toggleSel(P, c) {
    if (!P.cands.includes(c)) return;
    if (P.max === 1 && P.min <= 1) return this.resolve([c]);
    const i = P.sel.indexOf(c);
    if (i >= 0) P.sel.splice(i, 1); else if (P.sel.length < P.max) P.sel.push(c);
    this.render();
  },
  selModal(P) {
    let m = document.querySelector('.modal.sel-modal');
    if (!m) { m = document.createElement('div'); m.className = 'modal sel-modal'; document.body.appendChild(m); }
    P.cands.forEach(c => this.cardMap.set(c.uid, c));
    const n = P.sel.length, ok = n >= P.min && n <= P.max;
    m.innerHTML = `<div class="box"><h3>${esc(P.prompt)}</h3><div class="cgrid">${P.cands.map(c => cardHTML(c.d, c, { cls: [P.sel.includes(c) ? 'sel' : 'cand'] })).join('')}</div>
      ${P.max > 1 || P.min === 0 ? `<button class="pri" id="mOk" ${ok ? '' : 'disabled'}>${P.min === 0 && n === 0 ? LX('Nenhuma', 'None') : LX('Confirmar', 'Confirm')}</button>` : ''}</div>`;
    m.onclick = e => { const el = e.target.closest('[data-uid]'); if (el) this.toggleSel(P, this.cardMap.get(+el.dataset.uid)); if (e.target.id === 'mOk') this.resolve(P.sel); };
  },
  showPile(p, pile) {
    let list = { deck: [], discard: p.discard, dead: p.dead, used: [...p.plots, ...p.used] }[pile];
    if (pile === 'deck') return this.modal(`<p>${p.deck.length} ${LX('cartas no baralho (escondidas).', 'cards in the deck (hidden).')}</p>`, [{ label: 'OK' }], `${LX('Baralho', 'Deck')} — ${p.name}`);
    if (pile === 'used' && p !== this.me) list = p.used;
    list.forEach(c => this.cardMap.set(c.uid, c));
    const title = { discard: LX('Descarte', 'Discard pile'), dead: LX('Mortos (dead pile)', 'Dead pile'), used: p === this.me ? LX('Plots (disponíveis e usados)', 'Plots (available and used)') : LX('Plots usados', 'Used plots') }[pile];
    this.modal(`<div class="cgrid">${list.length ? list.map(c => cardHTML(c.d, c, { cls: p.used.includes(c) ? ['blank'] : [] })).join('') : `<span class="note">${LX('Vazio', 'Empty')}</span>`}</div>`, [{ label: 'OK' }], `${title} — ${p.name}`);
  },
  modal(html, buttons, title) {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="box">${title ? `<h3>${esc(title)}</h3>` : ''}${html}<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">${buttons.map((b, i) => `<button data-mb="${i}" class="${b.pri ? 'pri' : ''}">${esc(b.label)}</button>`).join('')}</div></div>`;
    m.querySelectorAll('[data-mb]').forEach(b => b.onclick = () => { const f = buttons[+b.dataset.mb].fn; if (f === false) return; m.remove(); if (f) f(); });
    m.onclick = e => { if (e.target === m) m.remove(); };
    document.body.appendChild(m); return m;
  },
  // ---------- construtor de decks ----------
  saveDecks() { store.set('agot_decks', this.decks); },
  renderDeckList() {
    const all = this.allDecks();
    $('#dlist').innerHTML = `<button class="pri" id="dNew">${LX('+ Novo deck', '+ New deck')}</button><button id="dImp">${LX('⇩ Importar do ThronesDB', '⇩ Import from ThronesDB')}</button><div class="note" style="margin:6px 0 2px">Decks</div>` +
      all.map((d, i) => `<div class="di ${i === this.curIdx ? 'on' : ''}" data-di="${i}"><span class="fdot" style="--fc:var(--f-${d.faction})"></span>${esc(d.name)}<small>${d.starter ? LX('inicial · só leitura', 'starter · read-only') : (validateDeck(d).length ? LX('inválido', 'invalid') : LX('válido', 'valid'))}</small></div>`).join('');
    $('#dlist').onclick = e => { const it = e.target.closest('[data-di]'); if (it) this.selectDeck(+it.dataset.di); if (e.target.id === 'dNew') this.newDeck(); if (e.target.id === 'dImp') this.importModal(); };
  },
  selectDeck(i, quiet) { const d = this.allDecks()[i]; if (!d) return; this.curIdx = i; this.cur = JSON.parse(JSON.stringify(d)); if (quiet) return; this.renderDeckList(); this.renderPool(); this.renderDeckSide(); },
  newDeck() { this.decks.push({ name: LX('Novo deck', 'New deck'), faction: 'stark', agenda: '01027', cards: {} }); this.saveDecks(); this.selectDeck(STARTER_DECKS.length + this.decks.length - 1); },
  isStarter() { return this.curIdx < STARTER_DECKS.length; },
  setQty(code, n) {
    if (this.isStarter()) return this.modal(`<p>${LX('Os decks iniciais são só de leitura. Duplica-o para o editar.', 'Starter decks are read-only. Duplicate it to edit.')}</p>`, [{ label: LX('Duplicar', 'Duplicate'), pri: true, fn: () => this.dupDeck() }, { label: LX('Cancelar', 'Cancel') }], LX('Deck inicial', 'Starter deck'));
    if (n) this.cur.cards[code] = n; else delete this.cur.cards[code];
    this.commit();
  },
  commit() { if (this.isStarter()) return; this.decks[this.curIdx - STARTER_DECKS.length] = JSON.parse(JSON.stringify(this.cur)); this.saveDecks(); this.renderPool(); this.renderDeckSide(); this.renderDeckList(); },
  dupDeck() { const d = JSON.parse(JSON.stringify(this.cur)); delete d.starter; d.name = d.name + LX(' (cópia)', ' (copy)'); this.decks.push(d); this.saveDecks(); this.selectDeck(STARTER_DECKS.length + this.decks.length - 1); },
  renderPool() {
    const f = this.filt, dk = this.cur;
    const types = [['agenda', LX('Agendas', 'Agendas')], ['plot', 'Plots'], ['character', LX('Personagens', 'Characters')], ['location', LX('Locais', 'Locations')], ['attachment', LX('Anexos', 'Attachments')], ['event', LX('Eventos', 'Events')]];
    const facs = [['mine', LX('Facção + neutras', 'Faction + neutral')], ['all', LX('Todas', 'All')], ...Object.keys(FACTION_NAMES).map(k => [k, FACTION_NAMES[k]])];
    let list = CARDS.filter(d => d.t === f.type);
    if (f.fac === 'mine') list = list.filter(d => d.f === dk.faction || d.f === 'neutral' || (dk.agenda && BANNER_FACTION[dk.agenda] === d.f && !d.l));
    else if (f.fac !== 'all') list = list.filter(d => d.f === f.fac);
    if (f.q) list = list.filter(d => (d.n + ' ' + d.tr.join(' ')).toLowerCase().includes(f.q.toLowerCase()));
    if (f.auto) list = list.filter(d => isAuto(d.c));
    list.sort((a, b) => (a.f === dk.faction ? 0 : 1) - (b.f === dk.faction ? 0 : 1) || (a.cost || 0) - (b.cost || 0) || a.n.localeCompare(b.n));
    const isAgenda = f.type === 'agenda';
    $('#pool').innerHTML = `<div class="filters">${types.map(([k, l]) => `<button data-ft="${k}" class="${f.type === k ? 'on' : ''}">${l}</button>`).join('')}
      <span style="flex:1"></span><button id="viewBtn" title="${LX('Alternar vista', 'Toggle view')}">${f.grid ? LX('☰ Lista', '☰ List') : LX('▦ Imagens', '▦ Images')}</button></div>
      <div class="filters"><select id="fFac">${facs.map(([k, l]) => `<option value="${k}" ${f.fac === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <input id="fQ" placeholder="${LX('Procurar nome ou trait…', 'Search name or trait…')}" value="${esc(f.q)}" style="flex:1;min-width:140px"><label class="note"><input type="checkbox" id="fAuto" ${f.auto ? 'checked' : ''}> ${LX('só automatizadas', 'automated only')}</label></div>
      <div class="tbl">${f.grid ? this.poolGrid(list, isAgenda) : `<table><thead><tr><th>${LX('Nome', 'Name')}</th><th>${LX('Facção', 'Faction')}</th><th>${LX('Custo', 'Cost')}</th><th>STR</th><th>${LX('Ícones', 'Icons')}</th><th>Auto</th><th>${LX('Qtd', 'Qty')}</th></tr></thead><tbody>
      ${list.map(d => `<tr data-code="${d.c}"><td>${d.u ? '◆ ' : ''}${esc(d.n)}${d.l ? ' <small class="note">loyal</small>' : ''}</td><td><span class="fdot" style="--fc:var(--f-${d.f})"></span>${FACTION_NAMES[d.f]}</td><td>${d.cost ?? (d.p ? '💰' + d.p[0] : '')}</td><td>${d.s ?? (d.p ? '⚡' + d.p[1] : '')}</td><td>${iconsHTML(d.i)}</td><td>${isAuto(d.c) ? '✓' : '⚠'}</td><td>${this.qtyHTML(d, isAgenda)}</td></tr>`).join('')}
      </tbody></table>`}${list.length ? '' : `<p class="note" style="padding:10px">${LX('Nenhuma carta com estes filtros.', 'No cards match these filters.')}</p>`}</div>`;
    $('#pool').querySelectorAll('[data-ft]').forEach(b => b.onclick = () => { f.type = b.dataset.ft; this.renderPool(); });
    $('#viewBtn').onclick = () => { f.grid = !f.grid; this.renderPool(); };
    $('#fFac').onchange = e => { f.fac = e.target.value; this.renderPool(); };
    $('#fQ').oninput = e => { f.q = e.target.value; clearTimeout(this._qt); this._qt = setTimeout(() => { this.renderPool(); const i = $('#fQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
    $('#fAuto').onchange = e => { f.auto = e.target.checked; this.renderPool(); };
    $('#pool').querySelector('.tbl').onclick = e => { const b = e.target.closest('[data-q]'); if (!b) return; const code = b.closest('[data-code]').dataset.code; const n = +b.dataset.q;
      if (isAgenda) { if (this.isStarter()) return this.setQty(code, n); this.cur.agenda = n ? code : null; this.commit(); } else this.setQty(code, n); };
  },
  qtyHTML(d, isAgenda) { const dk = this.cur; const q = isAgenda ? (dk.agenda === d.c ? 1 : 0) : (dk.cards[d.c] || 0); const max = isAgenda ? 1 : d.lim; return `<span class="qty">${Array.from({ length: max + 1 }, (_, n) => `<button data-q="${n}" class="${n === q ? 'on' : ''}">${n}</button>`).join('')}</span>`; },
  poolGrid(list, isAgenda) { return `<div class="pgrid">${list.map(d => `<div class="pcell" data-code="${d.c}">${cardHTML(d, null, { cls: d.t === 'plot' ? [] : ['big'] })}${this.qtyHTML(d, isAgenda)}</div>`).join('')}</div>`; },
  renderDeckSide() {
    const dk = this.cur, st = deckStats(dk), errs = validateDeck(dk), ro = this.isStarter();
    const groups = [['plot', 'Plots'], ['character', LX('Personagens', 'Characters')], ['location', LX('Locais', 'Locations')], ['attachment', LX('Anexos', 'Attachments')], ['event', LX('Eventos', 'Events')]];
    const facOpts = Object.keys(FACTION_NAMES).filter(k => k !== 'neutral').map(k => `<option value="${k}" ${dk.faction === k ? 'selected' : ''}>${FACTION_NAMES[k]}</option>`).join('');
    const agOpts = `<option value="">${LX('(sem agenda)', '(no agenda)')}</option>` + CARDS.filter(d => d.t === 'agenda').map(d => `<option value="${d.c}" ${dk.agenda === d.c ? 'selected' : ''}>${esc(d.n)}</option>`).join('');
    $('#dsideIn').innerHTML = `<input id="dName" value="${esc(dk.name)}" style="width:100%;font-weight:600" ${ro ? 'disabled' : ''}>
      <div style="display:flex;gap:6px;margin-top:6px"><select id="dFac" style="flex:1" ${ro ? 'disabled' : ''}>${facOpts}</select><select id="dAg" style="flex:1" ${ro ? 'disabled' : ''}>${agOpts}</select></div>
      <div class="stats"><span class="stat">Plots ${st.plots}/7</span><span class="stat">${LX('Baralho', 'Deck')} ${st.draw}/60</span><span class="stat">${LX('Neutras', 'Neutral')} ${st.neutral}</span></div>
      <div class="valid ${errs.length ? 'bad' : 'ok'}">${errs.length ? '✖ ' + errs.map(esc).join('<br>✖ ') : LX('✔ Deck válido', '✔ Valid deck')}</div>
      ${st.notAuto.length ? `<div class="note" style="color:#f0a35a">⚠ ${st.notAuto.length} ${LX('carta(s) sem habilidade automatizada', 'card(s) without an automated ability')}: ${esc([...new Set(st.notAuto)].join(', '))}</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">${ro ? `<button class="pri" id="dDup">${LX('Duplicar para editar', 'Duplicate to edit')}</button>` : `<button id="dDup">${LX('Duplicar', 'Duplicate')}</button><button class="warn" id="dDel">${LX('Apagar', 'Delete')}</button>`}<button id="dExp">${LX('Exportar texto', 'Export text')}</button><button id="dPlay">${LX('Jogar com este', 'Play with this')}</button></div>
      ${groups.map(([t, l]) => { const it = Object.entries(dk.cards).filter(([c]) => DB[c] && DB[c].t === t).sort((a, b) => (DB[a[0]].cost || 0) - (DB[b[0]].cost || 0) || DB[a[0]].n.localeCompare(DB[b[0]].n)); if (!it.length) return '';
        return `<div class="grp"><h4>${l} (${it.reduce((s, [, n]) => s + n, 0)})</h4>${it.map(([c, n]) => `<div class="ln" data-code="${c}"><span>${n}× ${DB[c].u ? '◆ ' : ''}${esc(DB[c].n)} ${isAuto(c) ? '' : '⚠'}</span><span class="note">${DB[c].cost ?? ''}</span></div>`).join('')}</div>`; }).join('')}`;
    if (!ro) {
      $('#dName').onchange = e => { dk.name = e.target.value || '—'; this.commit(); };
      $('#dFac').onchange = e => { dk.faction = e.target.value; this.commit(); };
      $('#dAg').onchange = e => { dk.agenda = e.target.value || null; this.commit(); };
      $('#dDel').onclick = () => this.modal(`<p>${LX('Apagar o deck', 'Delete deck')} "${esc(dk.name)}"?</p>`, [{ label: LX('Apagar', 'Delete'), pri: true, fn: () => { this.decks.splice(this.curIdx - STARTER_DECKS.length, 1); this.saveDecks(); this.selectDeck(0); } }, { label: LX('Cancelar', 'Cancel') }], LX('Apagar deck', 'Delete deck'));
    }
    $('#dDup').onclick = () => this.dupDeck();
    $('#dExp').onclick = () => { const t = exportDeckText(dk); this.modal(`<textarea style="width:min(560px,80vw);height:340px">${esc(t)}</textarea><p class="note">${LX('Este texto pode ser importado de volta aqui ou no ThronesDB.', 'This text can be imported back here or into ThronesDB.')}</p>`, [{ label: LX('Copiar', 'Copy'), pri: true, fn: () => { try { navigator.clipboard.writeText(t); } catch (e) { } } }, { label: 'OK' }], LX('Exportar deck', 'Export deck')); };
    $('#dPlay').onclick = () => { const i = this.curIdx; this.tab('play'); if (!this.game && $('#lbMe')) $('#lbMe').value = String(i); };
  },
  // ---------- importação ----------
  thronesdbApiUrls(input) {
    const s = input.trim();
    let m = s.match(/decklist\/view\/(\d+)/); if (m) return [`https://thronesdb.com/api/public/decklist/${m[1]}`];
    m = s.match(/deck\/view\/(\d+)/); if (m) return [`https://thronesdb.com/api/public/deck/${m[1]}`];
    m = s.match(/^(\d+)$/); if (m) return [`https://thronesdb.com/api/public/decklist/${m[1]}`, `https://thronesdb.com/api/public/deck/${m[1]}`];
    return [];
  },
  addImported(txt, m) {
    const { deck, missing } = importDeck(txt);
    this.decks.push(deck); this.saveDecks(); if (m) m.remove();
    this.selectDeck(STARTER_DECKS.length + this.decks.length - 1); this.renderLobby();
    if (missing.length) this.modal(`<p>${LX('Deck importado, mas estas cartas ainda não existem no simulador (só Core Set por agora):', 'Deck imported, but these cards are not in the simulator yet (Core Set only for now):')}</p><div class="note" style="max-height:300px;overflow:auto">${missing.map(esc).join('<br>')}</div>`, [{ label: 'OK' }], LX('Cartas em falta', 'Missing cards'));
  },
  importModal() {
    const m = this.modal(`<div style="max-width:640px">
      <p><b>${LX('1. Por link ou número', '1. By link or number')}</b></p>
      <div style="display:flex;gap:6px"><input id="impUrl" style="flex:1" placeholder="https://thronesdb.com/decklist/view/16711/…  ${LX('ou', 'or')}  16711"><button class="pri" id="impGo">${LX('Buscar', 'Fetch')}</button></div>
      <div id="impUrlMsg" class="note" style="margin-top:4px"></div>
      <p style="margin-top:14px"><b>${LX('2. Copiar e colar', '2. Copy and paste')}</b></p>
      <p class="note">${LX('No ThronesDB abre o deck → <i>Download</i> → <i>Text file</i> (ou <i>Export → Plain text</i>) e cola o conteúdo. Também aceita o JSON de <code>thronesdb.com/api/public/decklist/NÚMERO</code>.', 'On ThronesDB open the deck → <i>Download</i> → <i>Text file</i> (or <i>Export → Plain text</i>) and paste it. The JSON from <code>thronesdb.com/api/public/decklist/NUMBER</code> also works.')}</p>
      <textarea id="impTxt" style="width:100%;height:200px" placeholder="${LX('Cola aqui o texto ou JSON do ThronesDB…', 'Paste ThronesDB text or JSON here…')}"></textarea><div id="impMsg" class="note"></div>
      <p class="note">${LX('Por agora só existem as cartas do Core Set; as outras são listadas como em falta.', 'Only Core Set cards exist for now; others are listed as missing.')}</p></div>`,
      [{ label: LX('Importar texto', 'Import text'), pri: true, fn: false }, { label: LX('Cancelar', 'Cancel') }], LX('Importar do ThronesDB', 'Import from ThronesDB'));
    m.querySelector('[data-mb="0"]').onclick = () => {
      const txt = m.querySelector('#impTxt').value; if (!txt.trim()) return;
      try { this.addImported(txt, m); } catch (e) { m.querySelector('#impMsg').innerHTML = `<span style="color:#ff9c90">${LX('Não consegui ler', 'Could not read it')}: ${esc(e.message)}</span>`; }
    };
    m.querySelector('#impGo').onclick = async () => {
      const urls = this.thronesdbApiUrls(m.querySelector('#impUrl').value); const msg = m.querySelector('#impUrlMsg');
      if (!urls.length) { msg.innerHTML = `<span style="color:#ff9c90">${LX('Link não reconhecido. Usa um link de decklist/deck do ThronesDB ou o número.', 'Link not recognised. Use a ThronesDB decklist/deck link or its number.')}</span>`; return; }
      msg.textContent = LX('A buscar…', 'Fetching…');
      for (const u of urls) {
        try { const r = await fetch(u); if (!r.ok) continue; const j = await r.json(); if (!j || !j.slots) continue; this.addImported(JSON.stringify(j), m); return; } catch (e) { }
      }
      msg.innerHTML = `<span style="color:#ff9c90">${LX('Não consegui contactar o ThronesDB a partir desta página (o browser pode estar a bloquear). Abre o link da API no browser e cola o JSON na opção 2: ', 'Could not reach ThronesDB from this page (the browser may be blocking it). Open the API link in your browser and paste the JSON in option 2: ')}<a href="${urls[0]}" target="_blank" rel="noopener">${urls[0]}</a></span>`;
    };
  },
  // ---------- ajuda ----------
  renderHelp() {
    const auto = CARDS.filter(d => isAuto(d.c) && d.t !== 'agenda'), notAuto = CARDS.filter(d => !isAuto(d.c) && d.t !== 'agenda');
    $('#help').innerHTML = `<div class="wrap"><div class="help">
      <div class="panel"><h2>${LX('O que está automatizado', 'What is automated')}</h2><div class="note" style="color:var(--txt)">${LX(
      '<b>Regras base:</b> setup (8 ouro, 1 limited), as 7 fases, iniciativa (desempate por menos poder), primeiro jogador, income/initiative/reserve com modificadores, marshaling com redutores, duplicados (grátis, salvam a carta), unique e dead pile, limited (1 por ronda), desafios Militar/Intriga/Poder, stealth, unopposed, claim (mortes, descarte aleatório, roubo de poder), keywords (renown, insight, intimidate, pillage), ambush, dominance, standing, taxation e descarte por reserve. Ganha quem chegar a 15 de poder; perde quem ficar sem baralho.<br><br><b>Simplificações:</b> há janelas de ações antes de cada desafio, depois dos defensores e na dominance (não entre todos os passos); Treachery e as habilidades das outras facções ainda não estão programadas.<br><br><b>Imagens:</b> as imagens vêm do ThronesDB (ou do CDN da FFG). A página publicada no Claude bloqueia imagens externas, por isso lá aparecem as cartas desenhadas; no ficheiro HTML descarregado as imagens aparecem.',
      '<b>Core rules:</b> setup (8 gold, 1 limited), all 7 phases, initiative (ties go to lower power), first player, income/initiative/reserve with modifiers, marshaling with cost reducers, duplicates (free, save the card), unique and dead pile, limited (1 per round), Military/Intrigue/Power challenges, stealth, unopposed, claim (kills, random discard, power steal), keywords (renown, insight, intimidate, pillage), ambush, dominance, standing, taxation and reserve discard. First to 15 power wins; running out of deck loses.<br><br><b>Simplifications:</b> action windows happen before each challenge, after defenders are declared and in dominance (not between every step); Treachery and other factions\' abilities are not programmed yet.<br><br><b>Images:</b> images come from ThronesDB (or the FFG CDN). The page published in Claude blocks external images, so drawn cards show there; in the downloaded HTML file the images appear.')}</div></div>
      <div class="panel" style="position:sticky;top:0;z-index:2"><div class="pvbox" style="min-height:60px"><span class="note">${LX('Passa o rato por cima de uma carta para ver os detalhes.', 'Hover over a card to see its details.')}</span></div></div>
      <div class="panel"><h2>${LX('Cartas automatizadas', 'Automated cards')} (${auto.length})</h2><div class="autolist">${auto.map(d => `<div data-code="${d.c}"><span class="fdot" style="--fc:var(--f-${d.f})"></span>${esc(d.n)}</div>`).join('')}</div></div>
      <div class="panel"><h2>${LX('Ainda por automatizar', 'Not automated yet')} (${notAuto.length})</h2><p class="note">${LX('Estas cartas já entram no deck e jogam com custo, STR, ícones e keywords — só falta o texto especial.', 'These cards can already be used and play with cost, STR, icons and keywords — only the special text is missing.')}</p><div class="autolist">${notAuto.map(d => `<div data-code="${d.c}"><span class="fdot" style="--fc:var(--f-${d.f})"></span>${esc(d.n)}</div>`).join('')}</div></div>
    </div></div>`;
  },
};
window.addEventListener('DOMContentLoaded', () => UI.init());
