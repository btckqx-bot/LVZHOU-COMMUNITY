# -*- coding: utf-8 -*-
"""多重深读专用校验：字段完整 / 树覆盖 / 全局编号连续 / 4层结构 / 洞察质量。"""
import json, re, sys
from pathlib import Path

p = sys.argv[1] if len(sys.argv)>1 else r'D:/WorkBuddy/北大AI创投课_多重深读_data.json'
d = json.load(open(p, encoding='utf-8'))
errs, warns = [], []
docs = d['docs']
ideas = [v for doc in docs for v in doc['ideas']]
by_no = {v['no']: v for v in ideas}

# 全局编号连续
nos = sorted(v['no'] for v in ideas)
if nos != list(range(1, len(nos)+1)):
    errs.append(f'全局编号不连续: {nos[:10]}...{nos[-5:]}')

# 每 doc 4 层树完整
for doc in docs:
    tier_count = {}
    for v in doc['ideas']:
        tier_count[v['tier']] = tier_count.get(v['tier'],0)+1
        for f in ['no','hn','tier','title','logic','support','actions','premise','counter','quote','src','level','links','chap']:
            if f not in v or v[f] in (None,'',[]):
                errs.append(f"[{doc['name']}#{v['no']}] 缺字段 {f}")
        # logic 末步推论
        if not v.get('logic') or not str(v['logic'][-1]).startswith('推论'):
            errs.append(f"[{doc['name']}#{v['no']}] logic 末步非推论")
        # 三段式
        for j,a in enumerate(v.get('actions',[])):
            if str(a.get('t','')).count('｜') < 2:
                errs.append(f"[{doc['name']}#{v['no']}] actions[{j}] 非三段式")
        # 页码格式
        if not re.search(r'P\d+', str(v.get('src',''))):
            errs.append(f"[{doc['name']}#{v['no']}] src 缺P页码")
        for j,s in enumerate(v.get('support',[])):
            if not re.search(r'P\d+', str(s)):
                errs.append(f"[{doc['name']}#{v['no']}] support[{j}] 缺P页码")
    # 树父子一致性
    for v in doc['ideas']:
        if v['tier']=='core':
            if v.get('parent') is not None: errs.append(f'[{doc["name"]}#{v["no"]}] core 不应有 parent')
        elif v['tier'] in ('layer','foundation'):
            if v.get('parent') not in by_no: errs.append(f'[{doc["name"]}#{v["no"]}] parent 无效')
        for c in v.get('children',[]):
            if c not in by_no: errs.append(f'[{doc["name"]}#{v["no"]}] child {c} 无效')
    print(f"{doc['name']}: {len(doc['ideas'])}条 | " + ' '.join(f'{k}={n}' for k,n in tier_count.items()))

# hn 4 段（核心2段/分层3段/基础4段）
for v in ideas:
    parts = v['hn'].split('.')
    expect = {'core':2,'layer':3,'foundation':4}[v['tier']]
    if len(parts)!=expect: errs.append(f'#{v["no"]} hn={v["hn"]} 段数应为{expect}')

# 洞察
ins = d.get('insights',[])
if len(ins)<7: warns.append(f'洞察仅{len(ins)}条')
for x in ins:
    if '<b>' not in x.get('text','') or '</b>' not in x.get('text',''):
        errs.append(f"洞察#{x['n']} 缺<b>反转点")

# links 连接度
linked = sum(1 for v in ideas if v.get('links') and '独立命题' not in v['links'])
print(f'\n合计 {len(ideas)} 条 | 图书层 {len(docs)} | 连接度 {linked}/{len(ideas)} ({linked*100//len(ideas)}%) | 洞察 {len(ins)}')
print(f'ERROR {len(errs)} | WARN {len(warns)}')
for e in errs[:30]: print('  ERROR',e)
for w in warns[:10]: print('  WARN',w)
if errs: sys.exit(1)
print('PASS')
