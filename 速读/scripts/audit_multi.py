# -*- coding: utf-8 -*-
"""多重深读版全量 bug 审计：页面类型/目录4层/星云节点/垂直+横向关联/交互/溢出/JS错误。
用法: python audit_multi.py <HTML绝对路径> [chrome路径]
"""
import asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright
HTML = sys.argv[1] if len(sys.argv) > 1 else r'D:/WorkBuddy/北大AI创投课-多重深读版.html'
CHROME = sys.argv[2] if len(sys.argv) > 2 else r'C:\Program Files\Google\Chrome\Application\chrome.exe'
URL = Path(HTML).resolve().as_uri()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True, executable_path=CHROME)
        pg=await b.new_page(viewport={'width':1440,'height':810})
        pg.set_default_timeout(90000)
        errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.on('console',lambda m:errs.append('CONSOLE '+m.text) if m.type=='error' else None)
        await pg.goto(URL,wait_until='domcontentloaded',timeout=90000); await pg.wait_for_timeout(1500)
        issues=[]
        # ---- 页面清单 ----
        info=await pg.evaluate('''() => {
          const c={}; document.querySelectorAll('.slide').forEach(s=>{const k=s.className.replace('slide ','').trim();c[k]=(c[k]||0)+1});
          return c;
        }''')
        print('页面类型:',info)
        # ---- 1. 封面统计 ----
        cover=await pg.locator('.slide.cover').inner_text()
        print('封面含179:', '179' in cover, '| 含7位:', '7' in cover)
        # ---- 2. 纵览页7卡 ----
        await pg.keyboard.press('d'); await pg.wait_for_timeout(300)
        cards=await pg.locator('.slide.contrast.active .mo-card').count()
        print('纵览卡片:',cards,'(应7)')
        if cards!=7: issues.append(f'纵览卡片{cards}!=7')
        # ---- 3. 目录4层 + 逐层跳转 ----
        await pg.keyboard.press('q'); await pg.wait_for_timeout(400)
        for tier,exp in [('book',7),('core',27),('layer',81),('foundation',71)]:
            n=await pg.locator(f'.slide.toc-tree.active .tr-row.tier-{tier}').count()
            print(f'目录 {tier}:',n,'(应',exp,')')
            if n!=exp: issues.append(f'目录{tier}={n}!={exp}')
        # 点一个基础观点行跳转
        leaf=pg.locator('.slide.toc-tree.active .tr-row.tier-foundation').first
        await leaf.click(); await pg.wait_for_timeout(300)
        onidea=await pg.locator('.slide.slide-idea.active').count()
        print('目录叶子跳转观点页:',onidea==1)
        if onidea!=1: issues.append('目录叶子跳转失败')
        # ---- 4. 观点页字段完整性（quote 用 quote-row class 判断，不用"金句"字样）----
        sr=await pg.evaluate('''() => {const s=document.querySelector('.slide.slide-idea.active');if(!s)return {};
          return {reason:!!s.querySelector('.reasoning'),support:!!s.querySelector('.evidence'),action:!!s.querySelector('.action'),quote:!!s.querySelector('.quote-row')}}''')
        for k,v in sr.items():
            if not v: issues.append(f'观点页缺{k}')
        # ---- 5. 星云全部交互 ----
        await pg.keyboard.press('w'); await pg.wait_for_timeout(1800)
        counts=await pg.evaluate('''() => {const o={};document.querySelectorAll('.slide.navmap.active .sky-node').forEach(n=>{const t=n.getAttribute('data-tier');o[t]=(o[t]||0)+1});return o}''')
        print('星云节点:',counts)
        for t,exp in [('course',1),('book',7),('core',27),('layer',81),('foundation',71)]:
            if counts.get(t,0)!=exp: issues.append(f'星云{t}={counts.get(t,0)}!={exp}')
        # 课程中心 hover
        center=pg.locator('.slide.navmap.active .sky-node[data-tier=course]')
        box=await center.bounding_box(); await pg.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2); await pg.wait_for_timeout(300)
        vt=await pg.locator('.slide.navmap.active [data-mi-vert]').inner_text()
        print('课程中心向下关联数:', '向下垂直关联（7）' in vt)
        if '向下垂直关联（7）' not in vt: issues.append('课程中心向下非7')
        # 图书 hover 向下核心
        bn=pg.locator('.slide.navmap.active .sky-node[data-tier=book]').first
        box=await bn.bounding_box(); await pg.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2); await pg.wait_for_timeout(300)
        vt=await pg.locator('.slide.navmap.active [data-mi-vert]').inner_text()
        print('图书向下核心:', '向下垂直关联（5）' in vt or '向下垂直关联（4）' in vt or '向下垂直关联（3）' in vt)
        if '向下垂直关联' not in vt: issues.append('图书无向下关联')
        # 跨讲者双向检查：找一条 cross，正反都验证 reason 出现
        pair=await pg.evaluate('''() => {
          const ns=[...document.querySelectorAll('.slide.navmap.active .sky-node')];
          for(const n of ns){try{const x=JSON.parse(n.getAttribute('data-cross')||'[]');if(x.length)return {a:n.getAttribute('data-idea'),b:String(x[0].no),reason:x[0].reason}}catch(e){}}
          return null;
        }''')
        if pair:
            print('跨讲者样本:',pair['a'],'->',pair['b'],'|',pair['reason'][:30])
            # hover b，看是否也显示 a（反向关联）
            res=await pg.evaluate('''(args) => {
              const nb=document.querySelector('.slide.navmap.active .sky-node[data-idea="'+args.b+'"]');
              if(!nb) return false;
              try{const x=JSON.parse(nb.getAttribute('data-cross')||'[]');return x.some(y=>String(y.no)===String(args.a))}catch(e){return false}
            }''', {'a':pair['a'],'b':pair['b']})
            print('反向关联存在:',res)
            if not res: issues.append(f'跨讲者非双向 {pair["a"]}<->{pair["b"]}')
        # E 巡游（含虚拟节点不应报错）
        await pg.keyboard.press('e'); await pg.wait_for_timeout(900)
        ship=await pg.locator('.slide.navmap.active .cruise-ship').evaluate('(e)=>getComputedStyle(e).display')
        print('巡游飞船:',ship)
        await pg.keyboard.press('e')
        # R 速度
        await pg.keyboard.press('r'); await pg.wait_for_timeout(150)
        sp=await pg.locator('.slide.navmap.active [data-speed-val]').inner_text()
        print('宇宙速度:',sp)
        # N 导航面板
        await pg.keyboard.press('d'); await pg.wait_for_timeout(300)  # 回观点页
        await pg.keyboard.press('n'); await pg.wait_for_timeout(250)
        panel=await pg.locator('.slide.slide-idea.active .nav-overlay').count()
        vis=await pg.locator('.slide.slide-idea.active .nav-overlay').evaluate('(e)=>getComputedStyle(e).display') if panel else 'N/A'
        print('N导航面板:',panel,'display=',vis)
        await pg.keyboard.press('Escape')
        # Z 撤销
        await pg.keyboard.press('z'); await pg.wait_for_timeout(200)
        print('Z撤销后当前页:',await pg.evaluate('''() => [...document.querySelectorAll('.slide.active')].map(s=>s.className).join(',')'''))
        # H 灯光
        await pg.keyboard.press('h'); await pg.wait_for_timeout(150)
        print('H灯光:',await pg.evaluate('document.body.classList.contains("lights-off")'))
        await pg.keyboard.press('h')
        # ---- 6. 溢出（激活全部）----
        await pg.evaluate('document.querySelectorAll(".slide").forEach(s=>s.classList.add("visible","active"))')
        await pg.wait_for_timeout(600)
        ov=await pg.evaluate('''() => {let b=[];document.querySelectorAll('.slide').forEach((s,i)=>{if(s.scrollHeight>1090||s.scrollWidth>1930)b.push(i+':'+s.scrollWidth+'x'+s.scrollHeight)});return b}''')
        print('溢出页(>舞台):',ov if ov else '无')
        if ov: issues.append(f'溢出:{ov[:5]}')
        print('\nJS错误:',errs[:5] if errs else '无')
        if errs: issues.append(f'JS错误:{errs[:3]}')
        print('\n==== 问题汇总 ====')
        print('\n'.join(issues) if issues else '无 bug')
        await b.close()
asyncio.run(main())
