# Joga no viewport de telemóvel (toques reais) e tira capturas
import asyncio, os, sys
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + os.path.abspath('index.html')); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/m_lobby.png')
        await pg.screenshot(path=f'{OUT}/m_home.png'); await pg.tap('#hmPlay'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/m_setup.png', full_page=True); await pg.select_option('#lbSpd', '80'); await pg.tap('#lbGo'); await pg.wait_for_timeout(400)
        # mulligan / setup com toques reais
        shots = 0
        for step in range(300):
            st = await pg.evaluate("() => { const P=UI.pending; const g=UI.game; if(g.phase==='end') return 'end'; if(!P) return 'wait'; return P.kind + '|' + (P.modal||P.cands&&P.cands.some(c=>!document.querySelector('#board [data-uid=\"'+c.uid+'\"],#hand [data-uid=\"'+c.uid+'\"]'))?'m':''); }")
            if st == 'end': break
            if st == 'wait': await pg.wait_for_timeout(60); continue
            k, m = st.split('|')
            if step in (3, 40, 90) or (k == 'info' and shots < 1):
                if k == 'info': shots += 1
                await pg.screenshot(path=f'{OUT}/m_play{step}_{k}.png')
            # usar toques reais quando possível
            if k == 'option': await pg.locator('#prompt [data-opt]').first.tap(); continue
            if k == 'info': await pg.locator('#btnInfo').tap(); continue
            if k == 'select' and m == 'm': await pg.locator('.sel-modal .card.cand').first.tap(); await pg.wait_for_timeout(50); 
            elif k == 'select':
                loc = pg.locator('#board .cand, #hand .cand').first
                if await loc.count(): await loc.tap(force=True)
            ok = pg.locator('#btnOk:not([disabled]), #mOk:not([disabled])')
            if k == 'select' and await ok.count(): await ok.first.tap(); continue
            if k == 'action':
                btn = pg.locator('#prompt [data-btn]')
                if await btn.count() and step % 3: await btn.first.tap(); continue
                await pg.locator('#prompt [data-pass]').tap(); continue
            await pg.wait_for_timeout(30)
        await pg.evaluate("() => document.querySelectorAll('.modal').forEach(m=>m.remove())")
        # folha da carta (toque longo simulado chamando sheet) e log
        await pg.evaluate("() => { const c=[...UI.cardMap.values()][0]; if(c) UI.sheet(c.d,c); }"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f'{OUT}/m_sheet.png')
        await pg.evaluate("() => document.getElementById('sheet').classList.remove('open')")
        await pg.evaluate("() => document.querySelectorAll('.modal').forEach(m=>m.remove())"); await pg.tap('#mLog'); await pg.wait_for_timeout(200); await pg.screenshot(path=f'{OUT}/m_log.png'); await pg.mouse.click(20, 400)
        await pg.tap('#menuBtn'); await pg.wait_for_timeout(150); await pg.screenshot(path=f'{OUT}/m_menu.png'); await pg.tap('#menuBtn')
        await pg.evaluate("UI.tab('decks')"); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/m_decks.png')
        print('erros:', errs[:5])
        await b.close()
asyncio.run(main())
