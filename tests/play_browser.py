# Joga uma partida completa no browser (humano automático) e tira capturas
import asyncio, os, sys
from playwright.async_api import async_playwright
SHOTS = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1500,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + os.path.abspath('index.html')); await pg.wait_for_timeout(300)
        await pg.evaluate(f"UI.selMe={os.environ.get('ME','0')};UI.selAi={os.environ.get('OPP','1')};UI.tab('play')"); await pg.select_option('#lbSpd','80'); await pg.click('#lbGo')
        kinds={}; shots=set()
        for step in range(4000):
            st = await pg.evaluate('''() => { const P=UI.pending; const g=UI.game; if(!g) return 'nogame'; if(g.phase==='end') return 'end'; if(!P) return 'wait'; return P.kind + '|' + (P.modal?'m':'') + '|' + (P.title||P.prompt||'').slice(0,30); }''')
            if st=='end': break
            if st=='wait': await pg.wait_for_timeout(50); continue
            k=st.split('|')[0]; kinds[k]=kinds.get(k,0)+1
            if k=='info' and 'info' not in shots: shots.add('info'); await pg.screenshot(path=f'{SHOTS}/v5_info.png')
            if k=='select' and st.split('|')[1]=='m' and 'plot' not in shots: shots.add('plot'); await pg.hover('.sel-modal .card'); await pg.wait_for_timeout(100); await pg.screenshot(path=f'{SHOTS}/v5_plot.png')
            if k=='option' and 'opt' not in shots: shots.add('opt'); await pg.screenshot(path=f'{SHOTS}/v5_mull.png')
            await pg.evaluate('''() => { const P=UI.pending; if(!P) return;
              if(P.kind==='info'){ UI.resolve(); return; }
              if(P.kind==='select'){ const n=Math.min(P.max, Math.max(P.min, P.max>1?Math.ceil(P.cands.length/2):1)); UI.resolve(P.cands.slice(0,n)); return; }
              if(P.kind==='option'){ UI.resolve(P.options[0].value); return; }
              if(P.kind==='action'){ const r=Math.random(); if(P.buttons && P.buttons.length && r<0.7){ UI.resolve({button:P.buttons[0].value}); return;} if(P.actions.length && r<0.85){ UI.resolve(P.actions[Math.floor(Math.random()*P.actions.length)]); return;} UI.resolve(null); } }''')
        print('fim:', await pg.evaluate('UI.game && UI.game.phase'), kinds, 'erros:', errs[:5])
        await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
        await pg.click('#kwBtn'); await pg.wait_for_timeout(200); await pg.screenshot(path=f'{SHOTS}/v5_kw.png')
        await b.close()
asyncio.run(main())
