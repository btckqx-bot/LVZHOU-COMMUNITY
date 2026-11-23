# -*- coding: utf-8 -*-
"""把「速读」skill 的全部文本文件打包成 IMA 知识库存档 Markdown。

用法：
    python ".../scripts/pack_archive.py" --note "本次修改说明" [--bump]

输出三份：
    D:/WorkBuddy/速读Skill_完整存档.md                     ← 规范名（最新版，覆盖）
    D:/WorkBuddy/版本存档/速读Skill_完整存档_v{N}.md       ← 版本副本（永久保留）
    D:/WorkBuddy/速读_v{M}.{m}.{p}.md                      ← IMA 入库用语义化命名（M=1,m=N//10,p=N%10）

版本号取自 skill 根目录的 VERSION 文件；--bump 会在生成前把版本号 +1。
语义化文件名与版本副本内容一致，供 IMA「SKILL/速读skill/默认版本」入库直接取用。
"""
import argparse
import datetime
import os
import re

BASE = r"C:/Users/btckq/.workbuddy/skills/速读"
OUT = r"D:/WorkBuddy/速读Skill_完整存档.md"
VERSION_FILE = os.path.join(BASE, "VERSION")
ARCHIVE_DIR = r"D:/WorkBuddy/版本存档"

FILES = [
    "SKILL.md",
    "VERSION",
    "references/extraction.md",
    "references/pitfalls.md",
    "references/ima-adapter.md",
    "references/navigation.md",
    "templates/data.template.json",
    "scripts/build_deck.js",
    "scripts/build_deck_nav.js",
    "scripts/build_nav_data.py",
    "scripts/extract_text.py",
    "scripts/validate_data.py",
    "scripts/pack_archive.py",
    "scripts/build_markdown.py",
    "assets/theme.css",
]

LANG = {
    ".md": "markdown",
    ".json": "json",
    ".js": "javascript",
    ".py": "python",
    "": "text",
}


def read_version():
    try:
        with open(VERSION_FILE, "r", encoding="utf-8") as f:
            return int(f.read().strip())
    except Exception:
        return 1


def bump_version():
    v = read_version() + 1
    with open(VERSION_FILE, "w", encoding="utf-8") as f:
        f.write(str(v))
    return v


def fence_for(text):
    """选一个比文本内最长反引号串更长的围栏，避免内嵌代码块提前闭合。"""
    runs = re.findall(r"`+", text)
    longest = max((len(x) for x in runs), default=0)
    return "`" * max(4, longest + 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--note", default="", help="本次修改说明，写入存档头部")
    ap.add_argument("--bump", action="store_true", help="生成前把版本号 +1")
    args = ap.parse_args()

    version = bump_version() if args.bump else read_version()
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    vname = f"速读Skill_完整存档_v{version}.md"

    parts = [
        "# 速读 Skill — 完整存档（本地化版本）\n\n",
        f"> 版本：v{version}　生成时间：{now}\n\n",
        f"> Skill 根目录（固化绝对路径）：`{BASE}`\n\n",
        "> 新建任务直接 `@skill:速读 <PDF路径>` 即可，不依赖任何专家或外部 skill。\n\n",
        "> 背景音乐（`default-music.mp3` 约3.8MB）与星云页音乐（`nebula-music.mp3` 约6.2MB）及飞船图（`assets/ship.png`）为二进制，不纳入本文本存档：两首音乐已同步至 IMA 知识库「SKILL/速读skill」文件夹，飞船图随 skill 目录分发；恢复/迁移时须保留这三个二进制文件，否则音乐切换/巡游飞船不可用。\n\n",
        f"> 本次更新说明：{args.note or '例行同步'}\n\n",
        "## 文件索引\n\n",
        "| 文件 | 字节数 |\n| --- | ---: |\n",
    ]

    contents = []
    for rel in FILES:
        path = os.path.join(BASE, rel.replace("/", os.sep))
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
        contents.append((rel, text))
        parts.append(f"| `{rel}` | {len(text.encode('utf-8'))} |\n")

    for rel, text in contents:
        fence = fence_for(text)
        lang = LANG.get(os.path.splitext(rel)[1], "")
        parts.append(f"\n\n---\n\n## 文件：{rel}\n\n{fence}{lang}\n{text}\n{fence}\n")

    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    versioned = os.path.join(ARCHIVE_DIR, vname)
    sem_name = f"速读_v1.{version // 10}.{version % 10}.md"
    semantic = os.path.join(r"D:/WorkBuddy", sem_name)
    payload = "".join(parts)
    for path in (OUT, versioned, semantic):
        with open(path, "w", encoding="utf-8") as f:
            f.write(payload)

    print(f"OK latest={OUT} bytes={os.path.getsize(OUT)}")
    print(f"OK versioned={versioned} bytes={os.path.getsize(versioned)} version=v{version}")
    print(f"OK semantic={semantic} bytes={os.path.getsize(semantic)}")


if __name__ == "__main__":
    main()
