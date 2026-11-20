# Westeros LCG — Simulador AGoT 2.0

Protótipo pessoal para jogar *A Game of Thrones: The Card Game (2ª edição)* contra uma IA, no browser.

**Jogar:** https://brunorosa1440.github.io/westeros-lcg/

- Construtor de decks com todas as cartas (todos os packs); decks iniciais: Core Stark, Core Lannister, Intro Baratheon, Intro Targaryen
- Importação do ThronesDB (link/número, texto ou JSON)
- Regras base e habilidades das cartas automatizadas; IA heurística
- Português / English; imagens das cartas carregadas do ThronesDB

## Estrutura
- `src/` — código (motor, habilidades, IA, decks, interface)
- `build.sh` — junta tudo em `index.html`
- `tests/` — partidas simuladas em Node (`node tests/sim.js 200`)
- `tools/gen_cards.py` — gera `src/cards.js` (todos os packs) a partir do throneteki-json-data
- `src/abilities_intro.js` — cartas dos intro decks Baratheon e Targaryen
- `tests/sim_all.js` — todos os decks iniciais uns contra os outros; `tests/bench.js` — IA nova vs IA base

Para automatizar uma carta nova, acrescenta uma entrada em `AB` (`src/abilities.js`) e a descrição em inglês em `src/abilities_en.js`.

As cartas, textos e imagens de A Game of Thrones: The Card Game são © Fantasy Flight Games. Projeto de fã, sem fins comerciais.
