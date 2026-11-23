# -*- coding: utf-8 -*-
"""深读导航版数据构建器：把一份深读 data.json 组织成 核心/分层/基础 三层树，
重排编号为树遍历顺序，注入 tier/parent/children/hn/point/refs 等导航字段。

用法：
  python build_nav_data.py <深读data.json> <输出data.json> [--map 分组.json]

分组文件（可选）格式：
{
  "groups": [
    {"core": 1, "label": "价值与货币", "point": "商品二因素",
     "layers": [
       {"no": 2, "foundations": [32, 81]},
       {"no": 3, "foundations": [33, 77]}
     ]}
  ]
}
编号均为【输入 data.json 里的原始 no】。若不给 --map，则尝试从每条观点的
`tier`/`parent`/`coreLabel` 字段推断分组；都没有则报错要求提供 map。

核心层编号 i.0 / 分层 i.j / 基础 i.j.k（i,j,k 从 1 起）。
"""
import json, re, sys, argparse

def build(data, groups=None):
    docs = data['docs']
    ideas = docs[0]['ideas']
    by_no = {v['no']: v for v in ideas}

    if groups is None:
        # 从已有字段推断：按 core 分组，core 的 children 为 layers，layer 的 children 为 foundations
        groups = []
        for v in ideas:
            if v.get('tier') == 'core':
                layers = []
                for lno in v.get('children', []):
                    l = by_no.get(lno)
                    if l: layers.append({'no': lno, 'foundations': list(l.get('children', []))})
                groups.append({'core': v['no'], 'label': v.get('coreLabel', ''),
                               'point': v.get('point', ''), 'layers': layers})
        if not groups:
            raise SystemExit('未提供 --map 且 data 中无 tier/parent 字段，无法构建层级树。')

    # 类型/父子/编号映射（输入编号）
    tier, parent, children, hn, labels, points = {}, {}, {}, {}, {}, {}
    for ci, g in enumerate(groups, 1):
        core = g['core']
        tier[core] = 'core'; parent[core] = None; children[core] = []
        hn[core] = f'{ci}.0'
        labels[core] = g.get('label', by_no[core].get('title', '')[:12])
        points[core] = g.get('point') or labels[core]
        for lj, lay in enumerate(g.get('layers', []), 1):
            lno = lay['no']
            tier[lno] = 'layer'; parent[lno] = core; children[core].append(lno)
            hn[lno] = f'{ci}.{lj}'
            children[lno] = []
            for fk, fno in enumerate(lay.get('foundations', []), 1):
                tier[fno] = 'foundation'; parent[fno] = lno; children[lno].append(fno)
                children[fno] = []
                hn[fno] = f'{ci}.{lj}.{fk}'

    # 覆盖校验
    allnodes = [g['core'] for g in groups] \
        + [l['no'] for g in groups for l in g.get('layers', [])] \
        + [f for g in groups for l in g.get('layers', []) for f in l.get('foundations', [])]
    assert len(allnodes) == len(set(allnodes)), '分组中有重复编号'
    missing = sorted(set(by_no) - set(allnodes)); extra = sorted(set(allnodes) - set(by_no))
    print('覆盖:', len(allnodes), '/', len(by_no), '缺失:', missing, '多余:', extra)
    assert not missing and not extra, '分组必须覆盖全部观点'

    # 树遍历重排 + 旧→新编号映射
    order = []
    for g in groups:
        order.append(g['core'])
        for lay in g.get('layers', []):
            order.append(lay['no'])
            order.extend(lay.get('foundations', []))
    old2new = {old: i + 1 for i, old in enumerate(order)}

    CUT = re.compile(r'(是|即|把|为|与|在|使|通过|由于|表明|意味|决定|必须|只能|构成|等于|推动|造成|成为)')
    out = []
    for newno, old in enumerate(order, 1):
        v = dict(by_no[old])
        v['origNo'] = old
        v['no'] = newno
        v['tier'] = tier[old]
        po = parent[old]
        v['parent'] = old2new[po] if po else None
        v['children'] = [old2new[c] for c in children[old]]
        core_old = old if tier[old] == 'core' else (po if tier[old] == 'layer' else parent[po])
        v['coreNo'] = old2new[core_old]
        v['coreLabel'] = labels[core_old]
        # links 里的 #N 重映射为新编号
        lk = re.sub(r'#(\d+)', lambda m: '#' + str(old2new.get(int(m.group(1)), int(m.group(1)))), str(v.get('links', '')))
        v['links'] = lk
        # 结构化横向关联（排除父子）
        refs = []
        for n in re.findall(r'#(\d+)', lk):
            n = int(n)
            # v32：只保留真实存在的编号，避免 links 文本里指向被映射掉的旧编号产生无效 ref
            if n in old2new.values() and n != newno and n != v['parent'] and n not in v['children'] and n not in refs:
                refs.append(n)
        v['refs'] = refs[:12]
        # 短论点
        if tier[old] == 'core':
            v['point'] = points[old]
        else:
            head = re.split(r'[，,：:；;]', v['title'])[0]
            m = CUT.search(head)
            if m and m.start() >= 3: head = head[:m.start()]
            v['point'] = head.strip('的了与为在')[:9]
        v['hn'] = hn[old]
        c = re.sub(r'^【[^】]*】', '', str(v.get('chap', '')))
        v['chap'] = ('◆核心｜' if tier[old] == 'core' else ('◇分层｜' if tier[old] == 'layer' else '·根基｜')) + c
        out.append(v)

    docs[0]['ideas'] = out
    ncore = sum(1 for v in out if v['tier'] == 'core')
    nlayer = sum(1 for v in out if v['tier'] == 'layer')
    nfound = sum(1 for v in out if v['tier'] == 'foundation')
    data['meta']['mapTitle'] = f'{ncore} 核 · {nlayer} 分层 · {nfound} 基础'
    data['meta']['lede'] = f'{len(out)} 条按 {ncore} 核 → 分层 → 基础重排。页内下钻、面包屑回跳、横向关联一点即达。'
    data['closing']['kicker'] = f'CLOSING / {ncore} CORES, {nlayer} LAYERS, {nfound} FOUNDATIONS'
    print('written nodes', len(out), 'core/layer/foundation =', ncore, nlayer, nfound)
    return data

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--map', dest='mapfile')
    a = ap.parse_args()
    data = json.load(open(a.src, encoding='utf-8'))
    groups = None
    if a.mapfile:
        groups = json.load(open(a.mapfile, encoding='utf-8'))['groups']
    data = build(data, groups)
    json.dump(data, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

if __name__ == '__main__':
    main()
