#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""速读 · 观点数据校验器（v21 四层判断逻辑）
用法: python validate_data.py data.json [--min 20]
校验: 结构完整、字段非空、logic 步数、support 条数、actions 条数与来源标记与排序、
      premise/counter 字段、三段式、推论句、页码格式、总量下限
      v21 新增: level 枚举、links 存在性、层次分布与连接度(warn)
v43 新增: 大书规模下限(--pages/--words)、覆盖率硬闸(--covered/--chapters)、深读倍数硬闸(--speed-ideas)
v44 新增: 挖掘充分度(WARN引导，非硬闸)——思想书贴着下限=疑似没挖透(WARN)、边界/前提深挖信号占比偏低(WARN)。
          注意: v44 的软件"上限不封顶"，故这些是 WARN 绝不能做成 ERROR，否则下限又变成天花板。
向后兼容: 旧数据无 level/links 时不 fail，只给 WARN 提示补齐
"""
import json, sys, argparse, re

VALID_LEVELS = ('哲学视角', '学科原理', '方法流程', '经验技巧')

PAGE_OK = re.compile(r'P\d+(?:[-–~]\d+)?')
# 只识别「页码标注」语境，避免把正文里的普通括号/英文术语误判
PAGE_LEGACY = re.compile(r'(?:书页\s*[\d\-–~]+|PAGE\s*[\d\-–~]+|[（(]\s*(?:书页|PDF\s*)?P?\d+\s*[）)]\s*$)', re.I)

def has_legacy_page(s):
    return bool(PAGE_LEGACY.search(str(s)))

def validate(D, min_total, pages=0, words=0, covered=None, chapters=None, speed_ideas=0,思想密集=False):
    errs, warns = [], []
    docs = D.get('docs', [])
    if not docs:
        errs.append('docs 为空')
        return errs, warns
    total = 0
    for di, doc in enumerate(docs):
        name = doc.get('name', f'DOC{di}')
        ideas = doc.get('ideas', [])
        total += len(ideas)
        if not ideas:
            errs.append(f'[{name}] ideas 为空')
        nos = [v.get('no') for v in ideas]
        if nos != list(range(1, len(ideas) + 1)):
            errs.append(f'[{name}] no 必须从 1 连续编号，当前 {nos}')
        for v in ideas:
            tag = f"[{name}#{v.get('no')}]"
            # v21 四层逻辑：level 有则必须合法；links 有则非空。旧数据缺失只 WARN，保持兼容
            lv = v.get('level')
            if lv is not None:
                if lv not in VALID_LEVELS:
                    errs.append(f'{tag} level 只能是 {VALID_LEVELS}，当前 {lv}')
            else:
                warns.append(f'{tag} 缺 level（四层逻辑建议补齐：哲学视角/学科原理/方法流程/经验技巧）')
            lk = v.get('links')
            if lk is not None:
                if not str(lk).strip():
                    warns.append(f'{tag} links 为空，建议写明与其他观点的关系')
            else:
                warns.append(f'{tag} 缺 links（四层逻辑建议补齐与其他观点的关系）')
            for f in ('title', 'chap', 'src', 'quote'):
                if not str(v.get(f, '')).strip():
                    errs.append(f'{tag} 缺 {f}')
            logic = v.get('logic', [])
            if not (4 <= len(logic) <= 5):
                errs.append(f'{tag} logic 应 4-5 步，当前 {len(logic)}')
            elif not re.match(r'^推论[：:]', str(logic[-1]).strip()):
                warns.append(f'{tag} 末步未以「推论：」开头')
            sup = v.get('support', [])
            if not (3 <= len(sup) <= 6):
                errs.append(f'{tag} support 应 3-6 条，当前 {len(sup)}')
            else:
                for j, s in enumerate(sup):
                    if has_legacy_page(s):
                        errs.append(f'{tag} support[{j}] 页码格式违规（禁书页/PDF/PAGE/括号），应写 P16')
                    elif not PAGE_OK.search(str(s)):
                        errs.append(f'{tag} support[{j}] 缺 P 页码')
            # src 页码格式
            src_s = str(v.get('src', ''))
            if has_legacy_page(src_s):
                errs.append(f'{tag} src 页码格式违规（禁书页/PDF/PAGE/括号），应写 P16-24')
            elif not PAGE_OK.search(src_s):
                errs.append(f'{tag} src 缺 P 页码')
            # premise / counter（v14 强校验）
            prem = v.get('premise') or {}
            for key in ('premise', 'assumption'):
                arr = prem.get(key) or []
                if len(arr) != 1:
                    errs.append(f'{tag} premise.{key} 应恰好 1 条，当前 {len(arr)}')
                for j, x in enumerate(arr):
                    if not str(x.get('t', '')).strip():
                        errs.append(f'{tag} premise.{key}[{j}] 缺 t')
                    if x.get('origin') not in ('原文', '推测'):
                        errs.append(f'{tag} premise.{key}[{j}] origin 只能是 原文/推测，当前 {x.get("origin")}')
            c = v.get('counter') or {}
            if not str(c.get('t', '')).strip():
                errs.append(f'{tag} counter 缺 t')
            if c.get('kind') not in ('反例', '边界'):
                errs.append(f'{tag} counter.kind 只能是 反例/边界，当前 {c.get("kind")}')
            if c.get('origin') not in ('原文', '推演'):
                errs.append(f'{tag} counter.origin 只能是 原文/推演，当前 {c.get("origin")}')
            acts = v.get('actions', [])
            if not (4 <= len(acts) <= 5):
                errs.append(f'{tag} actions 应 4-5 条，当前 {len(acts)}')
            else:
                n_author = sum(1 for a in acts if a.get('k') == 'author')
                n_theory = sum(1 for a in acts if a.get('k') == 'theory')
                if not n_author:
                    errs.append(f'{tag} actions 缺作者原文项（k=author），必须优先回原文找')
                for j, a in enumerate(acts):
                    if a.get('k') not in ('author', 'theory'):
                        errs.append(f'{tag} actions[{j}] k 只能是 author/theory，当前 {a.get("k")}')
                    if not str(a.get('t', '')).strip():
                        errs.append(f'{tag} actions[{j}] 缺 t')
                    if a.get('k') == 'author' and not str(a.get('p', '')).strip():
                        errs.append(f'{tag} actions[{j}] 作者观点缺页码 p')
                    if a.get('k') == 'theory' and str(a.get('p', '')).strip():
                        warns.append(f'{tag} actions[{j}] 理论推演不应带页码 p')
                if not n_theory:
                    warns.append(f'{tag} actions 无理论推演项，检查是否原文建议确实充足')
                # 排序硬规则：author 全部排在 theory 之前
                kinds = [a.get('k') for a in acts]
                if kinds != sorted(kinds, key=lambda k: 0 if k == 'author' else 1):
                    errs.append(f'{tag} actions 排序违规：author 项必须全部在 theory 之前，当前 {kinds}')
                # 三段式硬规则：t 必须是 何时｜做法｜到位
                for j, a in enumerate(acts):
                    if len(str(a.get('t', '')).split('｜')) < 3:
                        errs.append(f'{tag} actions[{j}] t 缺三段式（用全角｜分隔：何时｜做法｜到位）')
            if len(str(v.get('title', ''))) < 8:
                warns.append(f'{tag} title 过短，可能不是判断句')
    # 洞察：整份数据只校验一次；按 group 分组，每组 3-7 条、组内 n 从 1 连续
    ins = D.get('insights', [])
    if not (3 <= len(ins) <= 7 * max(1, len(docs))):
        errs.append(f'insights 总数应介于 3 与 {7 * max(1, len(docs))} 之间，当前 {len(ins)}')
    for gi in range(len(docs)):
        grp = [it for it in ins if it.get('group') == gi]
        names = docs[gi].get('name', f'DOC{gi}')
        if not (3 <= len(grp) <= 7):
            errs.append(f'[{names}] insights 每组应 3-7 条，当前 {len(grp)}')
        ns = sorted(it.get('n') for it in grp if isinstance(it.get('n'), int))
        if len(ns) != len(grp) or ns != list(range(1, len(grp) + 1)):
            errs.append(f'[{names}] insights.n 组内须为从 1 连续的整数，当前 {[it.get("n") for it in grp]}')
    for it in ins:
        if it.get('group') not in range(len(docs)):
            errs.append(f"insight group 越界: {it.get('group')}")
    # v21 密度指标（warn 级，提示人工复核，不影响 PASS）
    levels = [v.get('level') for d in docs for v in d.get('ideas', [])]
    if any(levels):
        dist = {lv: levels.count(lv) for lv in VALID_LEVELS}
        principle = dist['学科原理'] + dist['哲学视角']
        pct = round(100 * principle / max(1, len(levels)))
        if principle * 2 < len(levels):
            warns.append(f'原理层占比 {pct}%（学科原理+哲学视角 {principle}/{len(levels)}）偏低，检查是否全是经验罗列')
        lone = sum(1 for d in docs for v in d.get('ideas', [])
                   if not v.get('links') or '独立命题' in str(v.get('links')))
        if lone * 2 >= len(levels):
            warns.append(f'孤立观点占比偏高（{lone}/{len(levels)} 无连接或标独立），检查结网是否充分')
    # v43：按规模自动算下限（取显式 --min 与规模下限的高者）
    scale_min = 0
    size = max(pages, words / 40) if (pages or words) else 0   # 40页≈1万字 粗算
    if size > 1500: scale_min = 72
    elif size > 800: scale_min = 60
    elif size > 400: scale_min = 40
    elif size > 200: scale_min = 20
    elif size > 0: scale_min = 12
    if 思想密集 and scale_min: scale_min = int(scale_min * 1.25)   # 思想书再上浮一档
    effective_min = max(min_total, scale_min)
    if total < effective_min:
        errs.append(f'观点总数 {total} < 下限 {effective_min}（--min={min_total} / 规模下限={scale_min}' + (' / 思想书上浮' if 思想密集 else '') + '，见 references/extraction.md 第零章）')

    # v43 覆盖率硬闸
    if covered is not None and chapters:
        cov = covered / max(1, chapters)
        if cov < 0.75:
            errs.append(f'有独立主旨章节覆盖率 {cov:.0%}（{covered}/{chapters}）< 75%，不得交付，回未覆盖章节补挖')
    # v43 深读倍数硬闸（思想/理论书）
    if speed_ideas and 思想密集:
        mult = total / max(1, speed_ideas)
        if mult < 2:
            errs.append(f'深读倍数 {mult:.1f}×（{total}/{speed_ideas}）< 2×，思想书疑似漏观点（理想 3–5×）')

    # v44 挖掘充分度（WARN 引导，绝不做 ERROR：下限是地板不是天花板，硬闸会制造新天花板）
    if 思想密集:
        # ① 贴着下限 = 疑似没挖透
        if effective_min and total < effective_min * 1.5:
            warns.append(
                f'思想密集书仅 {total} 条，接近下限 {effective_min}（< ×1.5）。'
                f'下限是地板不是目标——请按六角掘进(主张/机制/前提/边界/反转/推论)二次扫读，'
                f'确认命题池真的穷尽了，而不是卡线交付'
            )
        # ② 深挖信号占比：边界命题 + 推测前提，是"挖到深层"的可检测标志
        all_ideas = [v for d in docs for v in d.get('ideas', [])]
        deep = 0
        for v in all_ideas:
            c = v.get('counter') or {}
            if c.get('kind') == '边界':
                deep += 1
            else:
                prem = v.get('premise') or {}
                if any(x.get('origin') == '推测' for x in (prem.get('assumption') or [])):
                    deep += 1
        if all_ideas and deep * 2 < len(all_ideas):   # < 50%
            warns.append(
                f'深挖信号偏少：仅 {deep}/{len(all_ideas)} 条含「边界命题」或「推测前提」。'
                f'思想密集书应挖到隐含前提与失效边界层（铁律 5 六角掘进的③④角），'
                f'若多停在上层主张，密度与锐度都会不足'
            )
    return errs, warns

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('data')
    ap.add_argument('--min', type=int, default=0)
    ap.add_argument('--pages', type=int, default=0, help='全书页数，用于自动规模下限')
    ap.add_argument('--words', type=int, default=0, help='全文字数(万)，用于自动规模下限')
    ap.add_argument('--covered', type=int, default=None, help='有独立主旨且已覆盖的章节数')
    ap.add_argument('--chapters', type=int, default=0, help='有独立主旨的章节总数')
    ap.add_argument('--speed-ideas', type=int, default=0, help='速读摘要条数，用于深读倍数校验')
    ap.add_argument('--thought-dense', action='store_true', help='思想密集书(名著/理论/大家)：下限上浮+倍数硬闸')
    a = ap.parse_args()
    with open(a.data, encoding='utf-8') as f:
        D = json.load(f)
    errs, warns = validate(D, a.min, pages=a.pages, words=a.words, covered=a.covered,
                           chapters=a.chapters, speed_ideas=a.speed_ideas, 思想密集=a.thought_dense)
    total = sum(len(d.get('ideas', [])) for d in D.get('docs', []))
    print(f'观点总数: {total} | 文档数: {len(D.get("docs", []))}')
    for w in warns: print('WARN', w)
    for e in errs: print('ERROR', e)
    if errs:
        sys.exit(1)
    print('PASS')

if __name__ == '__main__':
    main()
