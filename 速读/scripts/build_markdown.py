# -*- coding: utf-8 -*-
"""从「速读」data.json 为每本书生成一份知识库友好的 Markdown 速读笔记。

用法：
    python ".../build_markdown.py" "<data.json路径>" "D:/WorkBuddy/" [--version N]

输出：D:/WorkBuddy/<书名>[国别]作者-速读版.md（规范名，覆盖，根目录）
      D:/WorkBuddy/版本存档/<书名>[国别]作者-速读版_vN.md（版本副本，永久保留）
Markdown 带 YAML frontmatter，可直接存入 IMA「藏书阁」/ Obsidian 等知识库。
--version 不传时取当前日期年份下的 v1，仅写入 frontmatter 不产生版本副本。
"""
import argparse
import datetime
import json
import os
import re

TAGS = ["速读", "核心观点", "知识库备份"]


def clean(text):
    """去掉 HTML 标签，保留纯文本，供 Markdown 使用。"""
    if text is None:
        return ""
    return re.sub(r"<[^>]+>", "", str(text)).replace("\u00a0", " ").strip()


def md_escape(text):
    """避免正文中的竖线破坏表格。"""
    return clean(text).replace("|", "\\|")


def md_bold(text):
    """洞察 text 里的 <b> 反转点转 Markdown 加粗，其余标签剥掉。"""
    if text is None:
        return ""
    return clean(re.sub(r"</?b>", "**", str(text)))


def build_doc(doc, insights, date_str, version=1, doc_index=0):
    name = clean(doc.get("name") or "未命名")
    lines = []

    # YAML frontmatter
    lines.append("---\n")
    lines.append(f'title: "{name} · 核心观点速读"\n')
    lines.append(f'version: {version}\n')
    lines.append(f'author: "{md_escape(doc.get("author") or "")}"\n')
    lines.append(f'book: "{md_escape(doc.get("name") or "")}"\n')
    lines.append(f'source: "{md_escape(doc.get("en") or "")}"\n')
    lines.append("tags:\n")
    for t in TAGS:
        lines.append(f"  - {t}\n")
    lines.append(f"date: {date_str}\n")
    lines.append("---\n\n")

    # 标题与核心主张
    lines.append(f"# 《{name}》核心观点速读\n\n")
    claim = clean(doc.get("claim"))
    if claim:
        lines.append(f"> **一句话主张**：{claim}\n\n")

    ideas = doc.get("ideas") or []
    lines.append("## 阅读地图\n\n")
    lines.append(
        f"- 共 **{len(ideas)} 条**核心观点"
        + (f"，覆盖 {doc.get('chapters')} 章 / {doc.get('pages')} 页" if doc.get("chapters") else "")
        + "\n"
    )
    lines.append("- 每条含「推演逻辑（含前提/假设）+ 支撑依据（含反例/边界）+ 行动建议 + 原文出处」，先给结论，再给结论怎么被推出来\n")
    lines.append("- 适合背诵、写读书笔记、做分享；出处可回原文核对\n\n")

    # 观点索引表（v21：新增层次列）
    has_level = any(v.get("level") for v in ideas)
    lines.append("## 观点索引\n\n")
    if has_level:
        lines.append("| 序号 | 层次 | 章节 | 核心观点 | 出处 |\n| ---: | --- | --- | --- | --- |\n")
        for v in ideas:
            lines.append(
                f"| {v.get('no', '')} | {md_escape(v.get('level'))} | {md_escape(v.get('chap'))} | "
                f"{md_escape(v.get('title'))} | {md_escape(v.get('src'))} |\n"
            )
    else:
        lines.append("| 序号 | 章节 | 核心观点 | 出处 |\n| ---: | --- | --- | --- |\n")
        for v in ideas:
            lines.append(
                f"| {v.get('no', '')} | {md_escape(v.get('chap'))} | "
                f"{md_escape(v.get('title'))} | {md_escape(v.get('src'))} |\n"
            )
    lines.append("\n")

    # 逐条观点
    lines.append("## 核心观点详解\n\n")
    for v in ideas:
        lines.append(f"### {v.get('no', '')}. {clean(v.get('title'))}\n\n")
        chap = clean(v.get("chap"))
        if chap:
            meta_bits = []
            if v.get("level"):
                meta_bits.append(f"**层次**：{clean(v.get('level'))}")
            if meta_bits:
                lines.append(f"**章节**：{chap}　　{'　　'.join(meta_bits)}\n\n")
            else:
                lines.append(f"**章节**：{chap}\n\n")
        links = clean(v.get("links"))
        if links:
            lines.append(f"**结网**：{links}\n\n")
        logic = v.get("logic") or []
        if logic:
            lines.append("**推演逻辑**\n\n")
            prem = v.get("premise") or {}
            for key, label in (("premise", "前提"), ("assumption", "假设")):
                for x in (prem.get(key) or []):
                    tag = "作者观点" if x.get("origin") == "原文" else "推演"
                    lines.append(f"- **{label}**：{clean(x.get('t'))} [{tag}]\n")
            for i, item in enumerate(logic, 1):
                lines.append(f"{i}. {clean(item)}\n")
            lines.append("\n")
        support = v.get("support") or []
        if support:
            lines.append("**支撑依据**\n\n")
            for item in support:
                lines.append(f"- {clean(item)}\n")
            c = v.get("counter") or {}
            if c:
                lines.append(
                    f"- **{clean(c.get('kind') or '边界')}**：{clean(c.get('t'))} "
                    f"[{'作者观点' if c.get('origin') == '原文' else '推演'}]\n"
                )
            lines.append("\n")
        actions = v.get("actions") or []
        if actions:
            lines.append("**行动建议**\n\n")
            ordered = sorted(actions, key=lambda a: 0 if a.get("k") == "author" else 1)
            for a in ordered:
                tag = "作者观点" if a.get("k") == "author" else "推演"
                pg = f"（{clean(a.get('p'))}）" if a.get("p") else ""
                t = clean(a.get("t")).replace("｜", "，")
                lines.append(f"- [{tag}] {t}{pg}\n")
            lines.append("\n")
        quote = clean(v.get("quote"))
        if quote:
            lines.append(f"> 金句：{quote}\n\n")
        src = clean(v.get("src"))
        if src:
            lines.append(f"**出处**：`{src}`\n\n")
        lines.append("---\n\n")

    # 反常识洞察：只取归属本文档（group == doc_index）的条目
    if insights:
        mine = sorted([i for i in insights if i.get("group") == doc_index],
                      key=lambda x: x.get("n", 0))
        if mine:
            lines.append("## 反常识洞察\n\n")
            for i in mine:
                lines.append(f"- **{clean(i.get('label'))}**：{md_bold(i.get('text'))}\n")
            lines.append("\n")

    lines.append("> 本笔记由「速读」Skill 自动生成，配合同名 HTML 演示稿使用。\n")
    return "".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data_json", help="data.json 路径")
    ap.add_argument("out_dir", help="输出目录")
    ap.add_argument("--version", type=int, default=1, help="版本号，写入 frontmatter 并生成版本副本")
    args = ap.parse_args()

    with open(args.data_json, "r", encoding="utf-8") as f:
        data = json.load(f)

    os.makedirs(args.out_dir, exist_ok=True)
    archive_dir = os.path.join(args.out_dir, "版本存档")
    if args.version > 1:
        os.makedirs(archive_dir, exist_ok=True)
    date_str = datetime.date.today().isoformat()
    insights = data.get("insights") or []

    written = []
    for idx, doc in enumerate(data.get("docs") or []):
        name = re.sub(r'[\\/:*?"<>|]', "", clean(doc.get("name") or f"book{idx+1}"))
        name = re.sub(r'[（(](深读版|速读版)[）)]', '', name).strip()  # 避免与后缀重复
        author = re.sub(r'[\\/:*?"<>|]', "", clean(doc.get("authorDisplay") or doc.get("author") or ""))
        base = f"{name}{author}-速读版" if author else f"{name}-速读版"
        content = build_doc(doc, insights, date_str, args.version, idx)
        out_path = os.path.join(args.out_dir, f"{base}.md")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(content)
        written.append((out_path, os.path.getsize(out_path)))
        if args.version > 1:
            vp = os.path.join(archive_dir, f"{base}_v{args.version}.md")
            with open(vp, "w", encoding="utf-8") as f:
                f.write(content)
            written.append((vp, os.path.getsize(vp)))

    for p, size in written:
        print(f"OK {p} bytes={size}")


if __name__ == "__main__":
    main()
