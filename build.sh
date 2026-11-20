#!/bin/sh
# Junta src/ num único index.html (o ficheiro servido pelo GitHub Pages)
cd "$(dirname "$0")" && python3 - <<'PY'
s=open('src/shell.html').read()
js='\n'.join(open('src/'+f).read() for f in ['cards.js','engine.js','abilities.js','abilities_en.js','ai.js','ai2.js','decks.js','abilities_intro.js','ui.js'])
s=s.replace('/*CSS*/',open('src/style.css').read()).replace('/*JS*/',js)
open('index.html','w').write(s)
print('index.html gerado')
PY
