// ================= DECKS: iniciais, validação, importação =================
const byName = n => NAME_IDX[n.toLowerCase()];
function mkDeck(name, faction, agenda, list) { const cards = {}; for (const [n, q] of list) { const c = byName(n); if (!c) throw new Error('Carta desconhecida: ' + n); cards[c] = (cards[c] || 0) + q; } return { name, faction, agenda, cards, starter: true }; }
const STARTER_DECKS = [
  mkDeck('Core — Stark (Fealty)', 'stark', '01027', [
    ['A Clash of Kings', 1], ['A Storm of Swords', 1], ['Calling the Banners', 1], ['Counting Coppers', 1], ['Filthy Accusations', 1], ['Marching Orders', 1], ['Summons', 1],
    ['Eddard Stark', 3], ['Robb Stark', 2], ['Catelyn Stark', 2], ['Arya Stark', 2], ['Bran Stark', 2], ['Sansa Stark', 2], ['Grey Wind', 2], ['Summer', 2], ['Direwolf Pup', 3], ['Tumblestone Knight', 3], ['Vanguard of the North', 3], ['Winterfell Steward', 3],
    ['Gates of Winterfell', 2], ['The Wolfswood', 1], ['Heart Tree Grove', 3], ['Ice', 2], ['For the North!', 3], ['Like Warm Rain', 2], ['Winter Is Coming', 3],
    ['Littlefinger', 2], ['The Kingsroad', 3], ['The Roseroad', 3], ['The Iron Throne', 1], ['Bodyguard', 2], ['Noble Lineage', 2], ['Seal of the Hand', 1], ['Put to the Sword', 1],
  ]),
  mkDeck('Core — Lannister (Fealty)', 'lannister', '01027', [
    ['A Clash of Kings', 1], ['A Noble Cause', 1], ['Heads on Spikes', 1], ['Sneak Attack', 1], ['Taxation', 1], ['Building Orders', 1], ['Reinforcements', 1],
    ['Tywin Lannister', 3], ['Ser Jaime Lannister', 3], ['Tyrion Lannister', 3], ['Cersei Lannister', 2], ['Grand Maester Pycelle', 2], ['Joffrey Baratheon', 2], ['The Tickler', 2], ['Burned Men', 3], ['Gold Cloaks', 3], ['Lannisport Moneylender', 3], ['Lannisport Merchant', 3], ["The Queen's Assassin", 2],
    ['Casterly Rock', 2], ['Lannisport', 2], ['Western Fiefdom', 3], ["Widow's Wail", 2], ['Hear Me Roar!', 3], ['The Things I Do For Love', 2],
    ['Littlefinger', 2], ['The Kingsroad', 3], ['The Roseroad', 3], ['The Iron Throne', 1], ['Seal of the Hand', 2], ['Bodyguard', 2], ['Superior Claim', 1], ['Put to the Sword', 1],
  ]),
];
const BANNER_FACTION = { '01198': 'baratheon', '01199': 'greyjoy', '01200': 'lannister', '01201': 'martell', '01202': 'thenightswatch', '01203': 'stark', '01204': 'targaryen', '01205': 'tyrell' };

function deckStats(dk) {
  let plots = 0, draw = 0, neutral = 0, banner = 0; const notAuto = [];
  for (const [c, n] of Object.entries(dk.cards)) {
    const d = DB[c]; if (!d) continue;
    if (d.t === 'plot') plots += n; else if (d.t !== 'agenda') { draw += n; if (d.f === 'neutral') neutral += n; if (dk.agenda && BANNER_FACTION[dk.agenda] === d.f) banner += n; }
    if (!isAuto(c) && d.t !== 'agenda') notAuto.push(d.n);
  }
  return { plots, draw, neutral, banner, notAuto };
}
function validateDeck(dk) {
  const errs = []; const s = deckStats(dk);
  if (s.plots !== 7) errs.push(LX(`Precisa de exatamente 7 plots (tem ${s.plots}).`, `Needs exactly 7 plots (has ${s.plots}).`));
  if (s.draw < 60) errs.push(LX(`Precisa de pelo menos 60 cartas de baralho (tem ${s.draw}).`, `Needs at least 60 draw cards (has ${s.draw}).`));
  for (const [c, n] of Object.entries(dk.cards)) {
    const d = DB[c]; if (!d) continue;
    if (n > d.lim) errs.push(LX(`${d.n}: máximo ${d.lim} cópias.`, `${d.n}: at most ${d.lim} copies.`));
    if (d.t === 'agenda') continue;
    const bannerOk = dk.agenda && BANNER_FACTION[dk.agenda] === d.f && !d.l;
    if (d.f !== 'neutral' && d.f !== dk.faction && !bannerOk) errs.push(LX(`${d.n} não pertence à facção ${FACTION_NAMES[dk.faction]}.`, `${d.n} is not in the ${FACTION_NAMES[dk.faction]} faction.`));
  }
  if (dk.agenda === '01027' && s.neutral > 15) errs.push(LX(`Fealty: máximo 15 cartas neutras (tem ${s.neutral}).`, `Fealty: at most 15 neutral cards (has ${s.neutral}).`));
  if (dk.agenda && BANNER_FACTION[dk.agenda]) { if (BANNER_FACTION[dk.agenda] === dk.faction) errs.push(LX('O estandarte não pode ser da tua própria facção.', 'The banner cannot be your own faction.')); if (s.banner < 12) errs.push(LX(`Estandarte: pelo menos 12 cartas de ${FACTION_NAMES[BANNER_FACTION[dk.agenda]]} (tem ${s.banner}).`, `Banner: at least 12 ${FACTION_NAMES[BANNER_FACTION[dk.agenda]]} cards (has ${s.banner}).`)); }
  return errs;
}
// Importação: texto do ThronesDB (Download → Text) ou JSON da API pública
const FACTION_ALIASES = { 'house baratheon': 'baratheon', 'baratheon': 'baratheon', 'house greyjoy': 'greyjoy', 'greyjoy': 'greyjoy', 'house lannister': 'lannister', 'lannister': 'lannister', 'house martell': 'martell', 'martell': 'martell', "the night's watch": 'thenightswatch', "night's watch": 'thenightswatch', 'house stark': 'stark', 'stark': 'stark', 'house targaryen': 'targaryen', 'targaryen': 'targaryen', 'house tyrell': 'tyrell', 'tyrell': 'tyrell' };
function importDeck(text) {
  text = text.trim(); const missing = []; let dk;
  if (text.startsWith('{')) {
    const j = JSON.parse(text);
    dk = { name: j.name || LX('Deck importado', 'Imported deck'), faction: j.faction_code, agenda: null, cards: {} };
    const slots = j.slots || {};
    const ag = j.agendas ? (Array.isArray(j.agendas) ? j.agendas : Object.keys(j.agendas)) : (j.agenda_code ? [j.agenda_code] : []);
    for (const a of ag) { const code = typeof a === 'string' ? a : a.code; if (DB[code]) dk.agenda = code; else missing.push(`agenda ${code}`); }
    for (const [code, n] of Object.entries(slots)) { if (DB[code] && DB[code].t === 'agenda') { dk.agenda = code; continue; } if (DB[code]) dk.cards[code] = n; else missing.push(`${n}x ${code}`); }
  } else {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    dk = { name: lines[0] || LX('Deck importado', 'Imported deck'), faction: null, agenda: null, cards: {} };
    for (const l of lines) {
      const low = l.toLowerCase();
      if (!dk.faction && FACTION_ALIASES[low]) { dk.faction = FACTION_ALIASES[low]; continue; }
      const m = l.match(/^(\d+)\s*x?\s+(.+?)(\s+\([^)]*\))?$/i);
      if (m) { const n = +m[1]; const nm = m[2].trim(); const c = byName(nm); if (c) { if (DB[c].t === 'agenda') dk.agenda = c; else dk.cards[c] = (dk.cards[c] || 0) + n; } else missing.push(`${n}x ${nm}`); continue; }
      const c = byName(l.replace(/\s+\([^)]*\)$/, '')); if (c && DB[c].t === 'agenda') dk.agenda = c;
    }
    if (!dk.faction) { const cnt = {}; for (const [c, n] of Object.entries(dk.cards)) if (DB[c].f !== 'neutral') cnt[DB[c].f] = (cnt[DB[c].f] || 0) + n; dk.faction = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || 'stark'; }
  }
  if (!FACTION_NAMES[dk.faction] || dk.faction === 'neutral') dk.faction = 'stark';
  return { deck: dk, missing };
}
function exportDeckText(dk) {
  const groups = { plot: 'Plots', character: 'Characters', location: 'Locations', attachment: 'Attachments', event: 'Events' };
  let s = `${dk.name}\n\nHouse ${FACTION_NAMES[dk.faction]}\n${dk.agenda ? DB[dk.agenda].n + '\n' : ''}`;
  for (const [t, label] of Object.entries(groups)) {
    const items = Object.entries(dk.cards).filter(([c]) => DB[c] && DB[c].t === t).sort((a, b) => DB[a[0]].n.localeCompare(DB[b[0]].n));
    if (!items.length) continue;
    s += `\n${label} (${items.reduce((x, [, n]) => x + n, 0)}):\n` + items.map(([c, n]) => `${n}x ${DB[c].n} (Core Set)`).join('\n') + '\n';
  }
  return s;
}
