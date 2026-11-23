# -*- coding: utf-8 -*-
"""多重深读 · 通用数据构建器（第3模式）。
把 N 位讲者/多本书的观点池，组织成 4 层树：图书层(doc) → 核心 → 分层 → 基础。

用法：
  python build_multi_data.py <config.json> <out_data.json>
config.json 结构：
{
  "meta": {"title":..., "subtitle":..., "kicker":..., "mapTitle":..., "mapTag":..., "lede":..., "stats":[...], "closing":{...}},
  "books": [
    {"name":"张涛","en":"...","author":"...","claim":"...",
     "ideas_file":"D:/.../ideas_zhangtao.json",          // 观点池 JSON 数组
     "insights_file":"D:/.../insights_zhangtao.json",    // 可选
     "cores":[ {"label":"...","point":"...","nos":[1,2,3,...]}, ... ]}  // nos 为该书观点池里的原始 no
  ],
  "insights_per_book": 1,  // 每位讲者选几条洞察进总洞察页（建议 1，上限保证<=7）
  "cross_file": "D:/.../cross_refs.json"  // 可选：跨讲者横向关联 [{"a":旧no,"b":旧no,"type":"呼应","reason":"..."}]
}
每条观点需含速读标准字段 + chap/level/links/title/logic/support/actions/premise/counter/quote/src。
输出：多 doc data（meta.mode='multi'，全局连续编号，每 doc 内部 3 层树，hn 段数=层级）。
"""
import json, re, sys
from pathlib import Path

def load(p): return json.loads(Path(p).read_text(encoding='utf-8'))

def build(cfg):
    books = cfg['books']
    per = cfg.get('insights_per_book', 1)
    # 收集所有观点，按配置顺序 + 原始 no
    all_ideas = []
    for b in books:
        arr = load(b['ideas_file'])
        arr = sorted(arr, key=lambda x: x.get('no', 0))
        b['_arr'] = arr
        b['_byorig'] = {v['no']: v for v in arr}
        all_ideas += arr
    # 全局重编号
    for new, v in enumerate(all_ideas, 1):
        v['_orig'] = v.get('no'); v['no'] = new
    orig2new = {v['_orig']: v['no'] for v in all_ideas}

    docs, book_meta, ins_sel = [], [], []
    for bi, b in enumerate(books, 1):
        my = b['_arr']; byorig = {v['_orig']: v for v in my}
        used, out = set(), []
        for ci, c in enumerate(b.get('cores', []), 1):
            nums = c['nos']
            if not nums: continue
            core = byorig.get(nums[0])
            if not core: continue
            core.update(tier='core', hn=f'{bi}.{ci}', parent=None, children=[],
                        coreLabel=c.get('label',''), point=c.get('point',''),
                        book=b['name'], coreNo=core['no'])
            out.append(core); used.add(nums[0])
            rest = [n for n in nums[1:] if n in byorig and n not in used]
            for li in range(0, len(rest), 2):
                pair = rest[li:li+2]
                lay = byorig[pair[0]]
                lay.update(tier='layer', hn=f'{bi}.{ci}.{li//2+1}', parent=core['no'], children=[],
                           book=b['name'], coreNo=core['no'], coreLabel=c.get('label',''),
                           point=re.split(r'[，,：:；;]', lay['title'])[0][:9])
                core['children'].append(lay['no']); out.append(lay); used.add(pair[0])
                for fi, fno in enumerate(pair[1:], 1):
                    f = byorig[fno]
                    f.update(tier='foundation', hn=f'{bi}.{ci}.{li//2+1}.{fi}', parent=lay['no'], children=[],
                             book=b['name'], coreNo=core['no'], coreLabel=c.get('label',''),
                             point=re.split(r'[，,：:；;]', f['title'])[0][:9])
                    lay['children'].append(f['no']); out.append(f); used.add(fno)
        # 未分组观点挂到最后分层
        leftovers = [v for v in my if v['_orig'] not in used]
        if leftovers:
            last_core = next((x for x in reversed(out) if x['tier']=='core'), out[0] if out else None)
            host = next((x for x in reversed(out) if x['tier']=='layer' and x['coreNo']==last_core['no']), last_core)
            for f in leftovers:
                f.update(tier='foundation', hn=f"{host['hn']}.{len(host['children'])+1}",
                         parent=host['no'], children=[], book=b['name'],
                         coreNo=last_core['no'], coreLabel=last_core.get('coreLabel',''),
                         point=re.split(r'[，,：:；;]', f['title'])[0][:9])
                host['children'].append(f['no']); out.append(f)
        for v in out:
            v['chap'] = re.sub(r'^[◆◇·][^｜|]*[｜|]', '', str(v.get('chap','')))
            v['no'] = v['no']  # keep
            v.pop('_orig', None)
        docs.append(dict(name=b['name'], en=b.get('en',''), author=b.get('author',''),
                         authorDisplay=b.get('author',''), claim=b.get('claim',''),
                         chapters=len(b.get('cores',[])), pages=len(b.get('cores',[])), ideas=out))
        book_meta.append(dict(no=bi, name=b['name'], claim=b.get('claim',''), count=len(out)))
        # 洞察
        if b.get('insights_file') and Path(b['insights_file']).exists():
            gi = sorted(load(b['insights_file']), key=lambda x: x.get('n', 0))
            ins_sel += gi[:per]
        print(f"{b['name']}: {len(out)}条 core={sum(1 for x in out if x['tier']=='core')} layer={sum(1 for x in out if x['tier']=='layer')} found={sum(1 for x in out if x['tier']=='foundation')}")

    # 跨讲者横向关联（打破次元壁）：修 links 编号映射 + 注入 refs/crossRefs
    by_no = {v['no']: v for v in all_ideas}
    cross_file = cfg.get('cross_file')
    cross_map = {}
    if cross_file and Path(cross_file).exists():
        for c in load(cross_file):
            a, b = orig2new.get(c['a']), orig2new.get(c['b'])
            if not a or not b or a not in by_no or b not in by_no: continue
            t, r = c.get('type','关联'), c.get('reason','')
            cross_map.setdefault(a, []).append({'no':b,'type':t,'reason':r})
            cross_map.setdefault(b, []).append({'no':a,'type':t,'reason':r})
    for v in all_ideas:
        v['links'] = re.sub(r'#(\d+)', lambda m: '#'+str(orig2new.get(int(m.group(1)), int(m.group(1)))), str(v.get('links','')))
        refs = []
        for n in re.findall(r'#(\d+)', v['links']):
            n = int(n)
            if n in by_no and n != v['no'] and n not in refs: refs.append(n)
        xrefs = cross_map.get(v['no'], [])
        for x in xrefs:
            if x['no'] not in refs: refs.append(x['no'])
        v['refs'] = refs[:16]
        v['crossRefs'] = xrefs
    print(f'跨讲者关联: {len(cross_map)} 个观点参与，{sum(len(v["crossRefs"]) for v in all_ideas)} 条有向关联')

    for i, x in enumerate(ins_sel, 1):
        x['n'] = i; x['label'] = (cfg['meta'].get('insightLabel') or '多重深读 · 反常识洞察')

    meta = dict(cfg['meta'])
    meta['mode'] = 'multi'
    meta['books'] = book_meta
    return dict(meta=meta, docs=docs, insights=ins_sel, closing=cfg['meta'].get('closing', {}))

def main():
    if len(sys.argv) < 3:
        print('用法: python build_multi_data.py <config.json> <out_data.json>'); sys.exit(1)
    cfg = load(sys.argv[1]); data = build(cfg)
    Path(sys.argv[2]).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print('TOTAL', sum(len(d['ideas']) for d in data['docs']), '->', sys.argv[2])

if __name__ == '__main__':
    main()
