---
name: 速读
description: 把电子书或文档（PDF/DOCX/EPUB/TXT）先做 OCR 文本提取与结构化数据清洗，提炼足量核心观点及可追溯支撑，再一键生成单文件 HTML 观点演示稿（1920×1080 固定舞台、钴蓝坐标纸风格、右上角音乐开关；观点页固定为顶栏「书名+加粗作者+章节」、左推演逻辑（前提/假设置顶）、右上支撑依据（末条反例/边界）+右下行动建议（作者观点置顶）、V12 金句；正文 24→19px 按密度自适应+间距自适应消金句前空白、全稿页码统一 13px、chip 统一「作者观点/推演」、仅洞察页可加下划线；尾页固定四格 credits，第四格为创作者标识 CREATOR），并同步产出可入库的 Markdown 速读笔记。v24 起支持「深读导航版」可选分支：三层树（核心/分层/基础）重排+层级编号（i.0/i.j/i.j.k）、可折叠树目录、全稿唯一黑夜模式「知识星云」页（悬停显论点与紫色垂直/横向关联、中心书节点、像素飞船按宇宙速度巡游）、统一快捷键 A/D·Q·W·N·E(巡游)·R(宇宙速度)·Z·F·G·H(灯光)、H 灯光开关（正文暗色）、音乐默认关闭、点开关或按 G 才播放（v58；深读默认单音乐 nebula-music 通篇共用，用户说"双音乐模式"才加 --dual-music 用两套），规范见 references/navigation.md。观点提炼须穷尽挖掘（v44：下限是地板不是天花板、六角掘进、不重复≠少列、二次扫读到边际产出为零，详见 references/extraction.md 铁律4-6）。当用户要求「速读某本书/文档」「提炼核心观点做演示稿」「把文档做成 HTML 演示」，或要求「深读版/分层导航/知识星云/可折叠目录/星际巡游」时使用。
agent_created: true
---

# 速读 · 文档观点提炼与演示稿生成

把一份电子文档变成一份观点密度足够、每条都有据可查的 HTML 演示稿。
两阶段流水线：**① 数据清洗（文本提取 → 观点提炼 → 结构化 JSON）→ ② 演示稿生成（JSON → 单文件 HTML）**。

## 核心原则（不可妥协）

1. **观点按 v21 四层逻辑判断，不按数量堆砌。** 判断逻辑见 [提炼规范](references/extraction.md)：①入口分流（按图书类型换拆法）②逻辑单元（按主旨切不按章节切，准入四问：独立性/非同义/可检验/有边界）③分层结网（每条打 `level` + 写 `links`）④密度校验（论点覆盖率/原理层占比/连接度）。**20 条全是有连接的真命题，优于 50 条同义拆分——但前提是命题池已穷举、覆盖率达标。** 数量下限降级为最后安全网，叙事类不强拆。v43 起以 [提炼规范第零章](references/extraction.md) 的防漏三铁律为最高优先级：先穷举命题池再聚类成树、思想书不得套叙事豁免、覆盖率/倍数为硬闸。每条必须有 `level`（哲学视角/学科原理/方法流程/经验技巧）与 `links`（与其他观点的关系）。
2. **每条观点必须有支撑，且必须有行动建议。** `logic`（4–5 步因果推演，最后一步以「推论：」开头）+ `support`（3–6 条实证/原文依据）+ `actions`（4–5 条行动建议，作者原文优先，不足则推演）+ `src`（页码/章节，可追溯）。缺一不可。行动建议来源规则见 [观点页版式规范](#观点页版式规范定稿-v14--2026-11-19)。
3. **数据清洗与生成分离。** 先把观点写成 `data.json`，再用生成器产出 HTML。禁止在 HTML 里直接手写内容——这样返工只改 JSON，不碰版式。
4. **固定舞台。** 1920×1080 整体等比缩放，手机上也保持 16:9，不重排。显隐用 `.active/.visible`（visibility+opacity），禁止 `display:none` 切换。
5. **零外部依赖。** 单文件 HTML，CSS/JS/音乐全内联；字体可留 Google Fonts CDN 作为唯一例外。
6. **封面是必备页（不可省略，单文档也要有）。** 无论 `docs.length` 为 1 还是 N，都必须先出封面页，版式参考双书封面：kicker + 大标题（按字数分档 c1/c2/c3/c4 防溢出）+ 英文副标题 + **作者及国别行（v20 起，原 lede 位固定显示 `docs[].authorDisplay`，回退 `author`，多文档用 ` · ` 连接）** + 巨型描边数字水印 + 右侧故障列 + 二维码 + 底部 index-bar 四格统计。单文档不得把目录当作首页。
7. **目录超容量必须分页（不可单页硬塞）。** 定稿 v7 规格：每页最多 **30 行、两栏各 15 行、先左后右**（先填满左栏 15 条，再填右栏 15 条）；超过容量自动拆页，页标题标注「第 p/P 页」，点击跳转映射按全量顺序保持准确。禁止把几十行塞进一页导致下半截被裁切。
8. **禁止生成「观点速查 / INDEX」页（功能重复）。** 目录（CONTENTS）每行本身可点击跳转到对应观点页，且观点页含完整推演、支撑与出处；另设一张只列标题/章节/页码的速查表属于重叠信息，没有增量价值。**演示稿不得出现任何 `bkidx` / INDEX 页**，`build_deck.js` 中不得恢复该页生成逻辑。观点导航只保留目录一处入口。
9. **改 skill 必同步知识库。** 只要本 skill 被修改，就必须按 [知识库同步规则](#知识库同步规则修改本-skill-时强制执行) 同步更新 IMA 知识库存档；只改本地不同步，视为任务未完成。
10. **双交付 + 知识库备份。** 每次速读交付 = **HTML 演示稿 + 每本书一份 Markdown 笔记**（文件名 `[书名][国别]作者-速读版.md`）。Markdown 必须存入 IMA 知识库「藏书阁」，作为长期知识备份；缺任一都算交付未完成。
11. **中间产物 data.json 常驻保留。** 提炼出的 `data.json` 不是临时文件，必须按规范名 `[主题]_data.json` 存到 `D:/WorkBuddy/` 长期保留。这是省 token 的关键：同一本书以后重做/改版时直接复用它，跳过「读 PDF → 重新提炼」这两步（它们最耗 token 和时间）。
12. **尾页必须有创作者标识。** 结语页 credits 固定四格，第四格为 `CREATOR` / `Skill制作者：况达FDE`；生成器对缺少该格的 data 自动补齐，不得删除或让旧数据把它带丢。
19. **书名字段一律用原书书名（v39，用户强制）**：`docs[].name` 与全文所有书名显示（topbar 书名、章节扉页、星云中心、对照页等）**只写原书书名**，不带 `（深读版）`/`（速读版）` 等任何括号后缀。生成器用 `pureBookName()` 统一剥离括号；data.json 源头也应写纯书名。封面大标题 `meta.title` 的"· 深读版"是版本标识不在此列。

13. **文件名统一为「书名[国别]作者-深读版/速读版」（v28 定稿，用户强制约定）。** 例：HTML `资本论[德]马克思-深读版.html`、Markdown 笔记 `资本论[德]马克思-速读版.md`。国别+作者取 `docs[0].authorDisplay`（如 `[德]马克思`），缺失回退 `author`，多文档取第一本；**国别作者紧跟书名、版本后缀放最后**，不用 `书名-[国别]作者` 旧式。深读导航版用 `-深读版`，普通版用 `-速读版`，变体可再加后缀（如 `-导航.html`）。IMA 知识库 Markdown 同步遵循此规则。data.json 命名不受此条影响。
14. **正文密度自适应强约束（不得回退固定字号/固定间距）。** `fitBody()` 必须两阶段运行：①字号在 **24/23/22/21/20/19px** 中按内容密度取最大可用档——内容稀疏的页取更大字号、内容多的页自动降档，**禁止锁死在单一档**；②字号选定后用 `--body-gap`（4px 起按 2px 递增到 22px）吃掉正文底到金句之间的空白，**禁止留下 >120px 的大留白、禁止正文压金句**。碰撞检测必须用「正文真实底」（各列表末项最靠下者），不得用 `.cols` 容器底（flex 撑满会误判）。四条正文块（推演逻辑/支撑依据/前提假设/行动建议）字号与间距始终一致，禁止用 `display:none` 隐藏任何行动条目。此条为 v18 定稿，任何回退到「固定 21px + 固定 padding」的改动都是违规。
15. **全稿页码字号统一强约束（不得出现行内大字号页码）。** 支撑依据、反例/边界、行动建议三处的页码必须是同款 `.pg` span、**字号一律 13px**；**禁止任何页码留在正文行内按正文字号渲染**。生成器 `splitPage()` 必须用句末 `P\d` token 正则 `^([\s\S]*?)\s+(P\d+(?:[-\u2013\u2014~]\d+)?)\s*$` 拆分（中文整句无空格，禁用 `\S+\s+P\d` 锚前一个词——会漏拆或错拆）；`counter.t` 也必须走 `splitPage()` 拆出 `.pg`。交付前用 `getComputedStyle` 遍历三处 `.pg` 确认全为 13px。此条为 v18 定稿。
16. **IMA 入库前必须判定接口形态（跨 AI 平台强约束）。** 本 skill 要在多个 AI 平台跑，各平台接 IMA 的形态不同：**按 `add_knowledge` 的 schema 特征判定，不按平台名猜**。形态 A（宿主封装/MCP 预签名）与形态 B（原生 OpenAPI/COS 签名）字段互不兼容——A 传 B 字段报 `additional properties`，B 缺字段报 `参数错误 110001`。所有入库操作（Step 3.6 笔记备份、知识库同步规则）必须先读 [IMA 接口适配器](references/ima-adapter.md) 并按对应模板执行；未知形态停止并报告，不得猜传。此条为 v23 定稿。
17. **深读导航版走独立生成器、不污染普通版；v50 起为默认模式（v24 定稿 / v50 改默认）。** 用户未指定模式时默认走深读导航版；也可用「深读版/分层导航/知识星云/可折叠目录/星际巡游」显式触发。用 `scripts/build_nav_data.py` 构建三层树 data + `scripts/build_deck_nav.js` 生成；标准速读版仅在用户明确说「速读」时用 `build_deck.js`（完全不动）。导航版的层级编号、星云页、快捷键、颜色、飞船资源、校验清单全部见 [深读导航版规范](references/navigation.md)。核心数量因书而异，不强求固定。导航版除星云页外必须保持浅色原状。
18. **三模式路由：默认深读（v50 改定，用户 2026-11-20 强制）。** 用户**没说模式**或只说「做演示稿/提炼观点/速读某书」 → **默认走深读导航版**（本文件第17条 + Step 3-N，`build_nav_data.py` + `build_deck_nav.js`）；只有用户**明确说「速读模式/标准速读/不要深读」**时才走标准速读版（`build_deck.js`）；明确说「多重深读/多书融合/多演讲融合」时走第三模式（Step 3-M）。判定只看原话关键词，**不靠主题复杂度猜测**。注意：v25–v49 曾规定默认速读、出现「深读」才走导航版，v50 起**反转**——默认即深读，速读需显式声明。这是用户的强制约定，无需每次重新解释。

20. **【标准冻结 · 跨模型跨平台零漂移】v41 终版为唯一标准（用户 2026-11-20 确认满意，强制）。** 本 skill 的全部版式/交互标准以 **v41 终版** 为准，已全部固化进生成器源码（`scripts/build_deck_nav.js` 与 `scripts/build_deck.js`）与 [深读导航版规范](references/navigation.md)。**无论运行在 WorkBuddy、豆包工作、千问办公或任何其他 AI 平台，无论调用哪个模型，都必须直接复用本 skill 的生成器脚本产出，禁止凭描述/记忆重新手写 HTML/CSS/JS，禁止按平台习惯"改良"任何已定稿细节。** 唯一真相源 = 本地 skill 目录的生成器源码 + references；任何平台/模型不得自行覆盖。v41 冻结清单（速读版/深读版共用项以源码为准）：
   - **深读导航版星云页**：标题「知识星云」中文在上、Knowledge Nebula 英文在下（英文位置 y≈133 固定）、无 STRUCTURE MAP；星点自由舒展（分轴柔性边界 BX18/BY14、倾角 tilt2/3 限 ±0.25、hover 冻结+移开 420ms 弹性回弹）；信息栏 z25 不透明覆盖控件；星点按质量差速+三维深度+分层闪烁（书 9s 强闪>核心>分层>基础不闪）；巡游长条（E 巡游开关 + R 宇宙速度点击循环，去掉圆点、单行显示、边框 rgba(198,206,232,.28)）位于标题英文后侧；装饰行「核心/分层/基础」右下页码上方右对齐无横线。
   - **快捷键（统一，写死）**：`A/D` 翻页（竖版 `W/S`）、`Q` 目录、`W`(横版)星云、`N` 导航、`E` 巡游（非 P）、`R` 宇宙速度、`Z` 撤销、`F` 全屏、`G` 音乐、`H` 灯光；底部提示行必须含全部这些键，hover 时加粗+放大2号+提亮（星云页变亮色）。
   - **灯光 H**：关灯态正文/首页变星空黑 `#121316`、字体 `#c9cfe0` 柔和浅色，星空图保持宇宙色不变；默认开灯。
   - **音乐默认 OFF（v58）**：打开即 `MUSIC OFF`，**不自动播放、不做首次交互恢复**；只有点右上角音乐开关或按 `G` 才播放。音乐按钮固定右上、灯光按钮紧邻其左。
   - **跨设备/跨平台资源恢复（v42 强制）**：本 skill 的 3 个二进制资源 `nebula-music.mp3`/`default-music.mp3`/`ship.png` 已全部入 IMA「SKILL/速读skill」文件夹；在任何平台/设备恢复 skill 时，必须先确认 `assets/` 下这 3 个文件齐全（从 IMA 取回），再运行生成器。禁止因文件缺失就省略飞船或音乐、禁止改用其他图片/音乐替代——这会导致输出效果漂移，违反标准冻结。
   - **单音乐默认 / 双音乐可选（v42）**：深读版**默认单音乐**——全篇（星云页+所有正文页）共用 `assets/nebula-music.mp3` 一个音源，`NEBULA_AUDIO_SRC=null`、`setScene()` 不切曲；生成器不加 flag 即此模式，HTML 约省 5MB。仅当用户明确说「**双音乐模式**」时，才加 `--dual-music` flag 走原方案（default-music.mp3 + nebula-music.mp3 两曲，星云页切专用曲）。这是可调试选项，不得反过来默认双音乐。
   - **封面统计三块同比例**：`SCOPE / 覆盖`（数据如"25章 90条观点，字数约190万"）、`LOGIC / 推演`、`EVIDENCE / 支撑`，标签13px/数据19px、上标签下数据居中、无竖线。
   - **正文页**：书名纯原名无括号；编号框固定 96×34px；章节栏剥离 ◆核心/◇分层/·根基 前缀；层级徽标与方法论 chip 统一 118×28px 去符号去 N；N 面板双区（分层观点层级 + 理论链接构成，观点完整不截断、编号用 hn）；反例/边界条标签与 chip 各只出现一次；引用页码统一 13px；`fitBody()` 两阶段密度自适应。
   - **目录页**：内容整体上移 1.5 格（51px）消除顶部空白，滚轮在树内滚动不翻页。
   **验收方式**：改动后必须重新生成并与 v41 终版逐项对比（功能+样式数值），一致才算合格。任何平台/模型若无法复用本地生成器而只能"照着重做"，必须先报告差异、不得自行输出。

21. **【防漏三铁律 · v43 强制】大书/名著不得只提几十条（用户 2026-11-20 强制）。** 大书只出 40 条、覆盖率 54% 属**结构性漏观点**，不是"精炼"。规则见 [提炼规范第零章](references/extraction.md)，三步缺一不可：①**先逐章穷举命题池，再归成三层树**——禁止先定"N 个核心、每核几条"的配额（这正是漏观点根因）；②**思想密度判定**：名著/理论经典/有影响力作者一律视为思想密集，禁止用"叙事类/观点密度低"豁免，下限上浮一档；③**硬闸**：有独立主旨章节覆盖率 ≥0.75、思想书深读倍数 ≥2（理想 3–5），不达标不得交付。数量下限随规模上调（800页≥60、>1500页≥72、思想书再上浮）。`validate_data.py` 用 `--pages/--words/--covered/--chapters/--speed-ideas/--thought-dense` 执行硬校验，error 级直接 fail。**用户口径写死：观点多且鲜明就多呈现；洋洋洒洒但思想空空才少罗列。**

22. **【穷尽挖掘 · v44 强制】下限是地板不是天花板，禁止卡线交付（用户 2026-11-20 强制）。** v43 的下限/覆盖率/倍数只防"完全没挖"，"达标"只证明没漏得离谱，**绝不证明挖到位**。思想密集书（《资本论》、稻盛和夫等大家/理论经典）观点多、刁钻、突出，必须穷尽挖掘，规则见 [提炼规范第零章铁律 4–6](references/extraction.md)：①**上限不封顶**，条数 = 命题池真实密度且 ≥ 下限 ×1.5，禁止"达标即停"；②**六角掘进**——高价值单元逐角扫主张/机制/前提/边界/反转/推论，每角站得住就单列一条，禁止把多个独立命题压成一个 title（这是密度损失主因）；③**不重复 ≠ 少列**——用消去测试（删掉这条是否丢失别处覆盖不了的信息）判定，禁止拿"避免重复/宁缺毋滥"压缩密度；④**停止看边际产出**——逐章二次扫读到"再找不到不重复的新真命题"才停，不是数字达标就停。`validate_data.py --thought-dense` 对贴下限/深挖信号偏少给 **WARN 引导（非 ERROR，因上限不封顶，硬闸会制造新天花板）**。交付前自问："二次扫读又补出了哪几条？"答不出即密度大概率不够。

23. **【第三模式 · 多重深读 · v45 新增】多书/多演讲融合走独立模块，零污染其它模式（用户 2026-11-20 强制）。** 用户原话出现「多重深读」「多本图书融合」「多个演讲稿融合」时，走第三模式（Step 3-M）：**4 层结构 = 图书层(每本书/每位讲者一个 doc) → 核心 → 分层 → 基础**，中心为总主题、7（或 N）个图书节点围绕中心公转、各自核心/分层/基础逐层嵌套。用独立生成器 `scripts/build_deck_multi.js`（从导航版复制+纯增量改造，不改动 `build_deck.js`/`build_deck_nav.js`）、独立数据构建器 `scripts/build_multi_data.py`、独立校验器 `scripts/validate_multi.py`（**不要**用 `validate_data.py` 校验多重 data——它假设单 doc 编号从 1、洞察 3-7 条/组，与多 doc 全局编号冲突，会误报）。目录页为 4 层树（图书层可折叠），星云页中心=课程/主题、第二层=图书（tier=book）、外三层同深读版；纵览页用紧凑 `.multi-overview` 网格（7 卡 4 列 2 行，避免原 `.compare` 页 N 份超长溢出）。洞察页总数 ≤7（每位讲者 1 条最锐利）。**跨讲者横向关联是多重模式的灵魂**：必须专门生成 `cross_refs.json`（不同讲者观点间的呼应/对照/支撑/应用，50-80 条），由 `build_multi_data.py` 的 `cross_file` 注入 refs/crossRefs；星云 hlink 按类型着色、信息栏显理由，打破作者之间的次元壁。三模式路由（v50）：有「多重深读/融合」→多重深读版；无多重且用户明确说「速读」→速读版；其余（含未指定模式、含「深读」）→深读导航版（默认）。详见 [多重深读规范](references/multi.md)。

24. **【三模式灯光统一 · v48】速读版也支持 H 灯光开关（用户 2026-11-20 强制）。** 此前仅深读导航版/多重深读版有灯光 H，速读版缺失；v48 起 `build_deck.js` 加入：NAV_HINT 加 `H 灯光`；独立 `lightsCss`/`lightsHtml`（按钮紧邻音乐左侧，right 定位随音乐存在与否自适应）；键盘 switch 加 `h/H` 分支；脚本末尾 IIFE 暴露 `window.lights.toggle()` 并绑定按钮点击。关灯效果与深读版一致（`body.lights-off` 把 `--paper/--ink/--grid` 改星空黑 `#121316` + 浅字 `#c9cfe0`），默认开灯。**三模式灯光行为必须一致，不得再出现某模式缺失。**

25. **【宇宙速度时间翻转 · v52，用户强制】** 三档宇宙速度飞行时间：第一=**31.7s（最慢，默认）**、第二=22.4s、第三=**15s（最快）**（v24–v51 曾为第一 15s / 第三 31.7s，v52 对调第一与第三）。深读版 `build_deck_nav.js` 与多重版 `build_deck_multi.js` 的 `SPEEDS` 数组必须同步；navigation.md 滑块说明同步。此为对 v41 冻结清单的明确变更，不算违规。速读版无巡游/速度功能，不涉及。
26. **【星云性能补丁 · v53，用户强制】** 解决观点数>150 时 HTML 卡顿。实测根因不是 O(N²) 计算，而是**每帧 8000+ 次 SVG `setAttribute` 写入**（477 节点样本：原版 rAF 回调 18.6ms/帧、星云 6.9fps、观点页被后台循环拖到 25.5fps）。两版生成器 `build_deck_nav.js` / `build_deck_multi.js` 必须含以下 5 处 `v53 PERF` 补丁：①`tick` 开头 `window.__navActive=active` + 非活跃页 `return`（禁后台空转）；②节点>200 时每 50ms 才刷一次 DOM（20fps 够慢速公转）；③排斥 ROUNDS：>150 节点直接 **0（全关，仅保留椭圆轨道旋转）**、140–150 降 1 轮、小图保持 3 轮（v54 从"大图单轮"再收紧；实测关闭排斥比单轮再降约 50% CPU：5.8ms vs 11.9ms，477 节点下轨道本就分散、关闭后不重叠成一团，hover/巡游不受影响）；④`hoverLoop` 用 `window.__navActive` 停算（**勿用局部 `slide` 变量，作用域未定义会报错**）；⑤去 `twinkleBook/Core` 的 `drop-shadow`，仅留 `brightness`。实测：观点页 25.5→60fps、rAF 回调 18.6→10.4ms（降 44%）、零 JS 错误、悬停/巡游/灯光/翻页全正常。速读版无星云，不涉及。
27. **【字体非阻塞加载 · v55，用户强制】** 三版生成器注入 Google Fonts 时必须用 `media="print" onload` 切换 + noscript 回退，**不可用裸 stylesheet link**。本地 file:// 打开时裸 link 卡 DNS/网络超时，实测 DCL 中位数 12.5s→9.9s（-21%）。CSS 已在 head、脚本已在 body 末尾，清单里的"挪脚本/拆同步脚本"对本 skill 收益为零；音乐 base64 仅占 DCL 约 0.5s（去掉只再省 5%），不是主因。剩余 9 秒是 66537 个 DOM 元素的解析渲染，属内容量决定，脚本加载技巧无法消除。
28. **【精简 DOM 写入 + 连线降频 · v56，用户强制】** 星云帧率优化的最终方案（用户认可"比之前好很多"）。实测定位：位置计算仅 0.54ms，DOM 属性写入占 4ms（87%）——**优化方向是少写 DOM，不是少算轨道**。两版生成器必须含 3 处 `v56` 补丁：①节点每帧只写 `star` 的 cx/cy，**去掉 hit 坐标**（命中靠 `pickNearest` 数学坐标，不依赖 hit DOM）与 **pt 标签坐标**（标签仅 `.hot` 时显示）；②连线写入加 10fps 节流 `const updLinks = !tick._lk || (now - tick._lk >= 100)`（细虚线人眼无感）；③`showNodeInfo` 里在节点点亮瞬间从 `star` 当前 cx/cy 一次性定位 `.pt` 标签（**用 star 属性取值，勿用局部变量 `pos`——作用域访问不到**）。实测 477 节点样本：每帧 CPU 5.61ms→2.12ms（-62%），零视觉损失、hover 标签定位正确、全功能正常。已尝试但**否决**：Canvas 批量绘制（headless 无 GPU 反而 4.46ms 无收益、工作量大）、懒显基础层（-23% 边际递减、用户要求取消）、Web Worker（DOM 操作必在主线程）。速读版无星云，不涉及。
29. **【目录树交互 + 多重深读 UX · v57，用户强制】** 用户 2026-11-22 认可的最终交互，分两部分：
   - **①【深读 + 多重共用】目录树单击跳观点、双击折叠**：`build_deck_nav.js`（深读 v57 新增）与 `build_deck_multi.js`（多重）的 `.tr-row` 单击用 `setTimeout(doJump,220)` 延迟跳转，双击 `clearTimeout` 取消跳转再折叠（`_dbl` 标志法失败——dblclick 之前两次 click 已触发跳转，必须用清除 timer；`doFold` 仅作用带 `data-toggle` 的行，末级行双击不报错）。深读版 v27–v56 的"点有子节点行折叠、点末级行跳转"已废弃，navigation.md 同步。速读版无树目录，不涉及。
   - **②【仅多重深读】其余图书相关项**：图书入口直达首观点（纵览卡 `.mo-card[data-book]`、目录图书行点击跳 `BOOK_PAGE[i]` = 该书首个观点页；星云中心的 course 节点是全书枢纽，只做 hover 总览、不参与跳转）；取消图书扉页（不生成每书 chapter 封面页）；**`data-book` 只挂图书行**——必须 `v.tier==='book'` 才加，**不可**用 `v.book!=null`（观点对象自带 book 字段，会让所有行误挂、点击乱跳）；纵览标题「7 位讲者纵览」→「图书纵览」，星云中心副文「7 位讲者」→「7 本图书」。
   - **性能归因（用户追问卡顿来源）**：以上 UX 对加载/帧率**无影响**——干净 A/B（精简版 + 仅 UX 4 项）与精简极速版 Layout 6.945 vs 6.975、Task 8.825 vs 8.83，基本一致；"十几秒卡顿"来自生成器重生成时夹带的其它版本差异，非 UX 功能本身（删扉页后仍卡顿亦印证）。headless DCL 测量极不稳定（同文件 9.4s~17.3s 波动），**禁止用单次 DCL 归因**，改用独立进程 CDP A/B。详见 [多重深读规范](references/multi.md)、[深读导航规范](references/navigation.md)。
30. **【音乐默认关闭 · v58，用户强制】** 三版生成器生成的 HTML **打开即为 `MUSIC OFF`，不自动播放、不做"首次交互恢复"那段 IIFE**；只有用户点右上音乐开关或按 `G` 才调用 `play()`。速读版 `build_deck.js` 本就默认关闭（`MUSIC OFF` 文案 + 无自动播放 IIFE，保持不动）；深读 `build_deck_nav.js` 与多重 `build_deck_multi.js` 需删掉 `window.music = new MusicPlayer()` 之后那段把 `playing=true`、`btn.classList.add('playing')`、`txt='MUSIC ON'`、`current.play()` 并监听 pointerdown/keydown 恢复的 IIFE，同时把按钮初始 HTML 文案从 `>MUSIC ON<` 改为 `>MUSIC OFF<`（避免显示与状态不符）。`MusicPlayer` 类本身、`toggle()`、`setScene()`、快捷键 G、灯光按钮全部保留不动。文档同步：SKILL.md 顶部 description 的"音乐默认开启"改为默认关闭、navigation.md 音乐条目、pitfalls.md 校验口径（本就是 OFF）保持一致。
31. **【多重深读性能版 · v59，用户强制】** 用户 2026-11-22 真机确认后要求固化。仅作用于多重深读 `build_deck_multi.js`（深读/速读两版零改动），5 项：**①非当前页 DOM 延后构建**——460 个 `.slide-idea` 的正文存进 `LAZY_SLIDES`（idx→完整 section HTML），正文占位空 frame，翻到时才 `hydrate(i)` 注入；保留全部 466 个 slide 壳与数字索引，目录跳转/页码映射不变。**版式保真是硬要求**：字号/间距由 `meta.fitValues`（data.json 内可选字段，形如 `{"4":["23px","4px"],...}`）固化进页面 HTML，运行时不重算；该字段由 `scripts/bake_fit_values.py <参考非懒加载HTML> <输出JSON>` 从浏览器采集（多页抽样 computed-style 逐项 diff 做门禁）。**无 `meta.fitValues` 时自动降级**（v60 修正）：生成器输出 `FIT_PAGES`（有固化值的页索引数组）供前端判断；`show()` 在页面 active/visible 之后对无固化值页跑 `fitBody(this.slides[target])`——**必须在可见后跑**，hydrate 内 rect=0 会误判最小字号；不得引用 Node 端变量 `FIT_VALUES`（前端不可见会 ReferenceError）。②去 twinkle brightness 动画（改静态亮度，hover 单独点亮）。③**连线分级更新（PERF⑤b）**：hover 中每 33ms 只刷新 `.hl` 高亮线（子节点公转时必须跟随，否则端点脱节——用户截图报过此 bug），非 hover 时细线冻结（opacity .10 无感）；`updHi` 必须写成 `!tick._lkh || (now-tick._lkh>=33)`，漏 `!tick._lkh` 会因 NaN 死锁导致高亮线一次都不刷新。④支撑依据块防裁切：`navCss` 注入 `.block.evidence{flex:0 0 auto!important;overflow:visible!important}`，`fitBody.fits()` 增加"支撑末行不得压到行动标题"判定——用户机器字体更宽会让边界行换行被 `overflow:hidden` 静默裁掉（原版潜在缺陷，非懒加载引入）。⑤字体版本一致：实验/生成环境必须用 Skill 自带 `assets/theme.css`（27KB），勿用旧 `D:/WorkBuddy/assets/theme.css`（23KB，会导致 hairline/topbar 全乱）。实测 466 页样本：开机 DOM 66,538→9,344（-86%）、加载 5.8s→2.0s、字号逐项一致、水合跳转/星云/零 JS 错误全部通过。详见 [多重深读规范](references/multi.md)。
32. **【连线跟随全覆盖 + fitBody 回调修复 · v60，用户强制】** 用户 2026-11-22 要求「凡有星云的版本都要修连线脱节」。①**深读版 `build_deck_nav.js` 加入连线分级更新**（与多重 v59 同类）：hover 中 `updHi = hi && (!tick._lkh || (now-tick._lkh>=33))` 每 33ms 只刷 `.hl` 高亮线、跟随公转子节点；非 hover 保留 v56 的 10fps 全量刷细线（`updAll = !tick._lk || (now-tick._lk>=100)`）。深读版本身有 `.hl` 机制（CSS `.vlink.hl`/`.hlink.hl`、showNodeInfo 里 `classList.toggle('hl')`），可直接用。**注意两版 `updAll` 策略不同是有意设计**（深读 10fps 全量、多重非 hover 冻结），非 bug。②**修 v59 引入的两个严重 bug**：(a) `fitBody(oneSlide)` 参数化后，`document.fonts.ready.then(fitBody)` / `load` / `resize` 会把 FontFaceSet/Event 当 oneSlide 传入 → `slide.querySelector is not a function`，全局回调必须包成 `() => fitBody()`；(b) hydrate 降级缺 `fitBody` 调用且误引用前端不可见的 Node 变量 `FIT_VALUES` → 改输出 `FIT_PAGES` 数组，在 `show()` 可见后调 `fitBody`。实测：resize 零错误、无 fitValues 数据字号自适应到 24px、深读 hover 子节点移动 10~17px 时连线偏差 0.1px。速读版无星云，不涉及。

## 固化路径（跨任务、跨专家、零依赖）

**Skill 根目录（绝对路径，已固化）：`C:/Users/btckq/.workbuddy/skills/速读`**

该目录完全自包含，不依赖当前专家、当前工作区、任何外部 skill 或 `D:/CloudMusic`：
- 所有脚本用 `path.resolve(__dirname, '..')` / 自身所在目录定位资源，换目录整体搬迁仍可用。
- 样式 `assets/theme.css` 随 skill 分发；**3 个二进制资源都已同步备份至 IMA 知识库「SKILL/速读skill」文件夹**：`default-music.mp3`（3.8MB）、`nebula-music.mp3`（6.2MB）、`ship.png`（飞船图，20KB）。换平台/换设备/本地丢失时，必须从该 IMA 文件夹取回这 3 个文件放回 `assets/`，否则音乐缺失、巡游飞船失效（生成器 `readFileSync` 会降级或报错）。**不要引用 D 盘音乐目录**。生成的 HTML 本身完全自包含（音乐/飞船均 base64 内联、0 外部引用），但"生成能力"依赖这 3 个资源。
- 新建任务时直接 `@skill:速读 <PDF路径>` 即可；下列命令中的绝对路径保证任何会话都能执行。

> 下方命令中的 `SKILL` 指代 `C:/Users/btckq/.workbuddy/skills/速读`。所有脚本均已用绝对路径写死，可直接复制运行。

## 观点页版式规范（定稿 v14 · 2026-11-19）

> 这套版式由《这样读书就够了》演示稿经五轮样张打磨定稿，已固化进 `assets/theme.css` 与 `scripts/build_deck.js` 的观点页模板。**以后任何书籍的观点页一律按此生成，不得回退旧版式，不得凭印象改字号/间距/标注——输出必须与本规范逐项一致。**

**版心结构（自上而下）**

| 区块 | 内容 | 规格 |
|---|---|---|
| 顶栏 | `NO.编号` + `《书名》` + `[国别]作者` + 章节名 | 单条下横线；编号牌 19px、书名/章节 27px、**作者 17px 加粗（`font-weight:700`）、作者后两个全角空格再接章节**；右侧留 150px 空槽给音乐开关 |
| 核心论点 | `title` 作大标题 | 按字数分档 s1–s4 = 56/50/44/39px，**下方无横线** |
| 左栏 44% | 推演逻辑 REASONING | 块内自上而下两部分：① **前提/假设两行置顶**（标签+正文，原文标「作者观点」、非原文标「推演」）；② `logic` 4–5 步因果推演，末步「推论：」加粗带左竖线 |
| 右栏 56% 上 | 支撑依据 EVIDENCE | 每条实心方块 + 正文；末尾「反例/边界」条用与前提/假设同款行样式，标签写「反例」或「边界」（**不写「原文」**），句末标「作者观点」/「推演」 |
| 右栏 56% 下 | 行动建议 ACTION | **作者观点优先置顶、推演建议按权重后置**（生成器强制排序）；三段式语义连成一句自然话，**不得出现「何时/做法/到位」字样**；实心=作者观点、空心=推演；与上方支撑依据之间**不画线，只用 22px 留白分组** |
| 核心论点分层 chip（v21） | `level` + `links` | 内联在标题末尾（右上角）；16px、四层样式区分：哲学实心蓝底、方法虚线框、原理与技巧描边；**悬停显示 `links` 结网关系**。旧数据无 `level` 时不渲染 |
| 金句条 | `quote` 一句 + 右下 `src` | **V12 规则**：金句 33px、左对齐垂直居中、出处 20px，**单条上横线、无下横线、无独立功能键行**；成对引号行内 `<span class="qm">` 贴句首句尾 |

**正文字号与间距自适应（硬性约束 · v18 密度驱动）**

- 推演逻辑、支撑依据、前提/假设、行动建议四块正文**字号必须一致**，由 `fitBody()` 在运行时按每页内容密度两阶段自适应，**核心是「稀疏页排松弛、密集页排紧凑」**：
  1. **字号档**：从 **24 / 23 / 22 / 21 / 20 / 19px** 中取最大可用档。内容少、行不密的页面取更大字号（如 24px），内容多的页面自动降档到 21/20/19px。禁止固定锁死在某一档。
  2. **间距档（--body-gap）**：字号选定后，把四块列表条目的纵向 padding 从 **4px 起按 2px 递增，最高 22px**，吃掉正文底部到金句条之间的空白——**消除金句前的大留白**，让内容自然铺满。一旦命中金句或溢出即回退上一档。密集页停在 4px（紧凑），稀疏页自动放宽（松弛）。
- 实现要点：`logic-list / support-list / action-list` 的 `li` padding 统一用 `var(--body-gap)`；`fitBody()` 用「正文真实底」（各列表末项最靠下者）而非 `.cols` 容器底做金句碰撞检测（容器 `flex:1` 会撑满，直接测容器底永远误判有空白）。
- **绝不允许正文压到金句条、绝不允许超线**。生成器检测 `.cols` 溢出与金句重叠后选档；`fitActions()` 已废除，**禁止用 `display:none` 隐藏行动条目**——所有行动必须全部可见。

**标注与 chip 规范（全板块统一）**

- chip 统一 `.src-chip`：12px、`padding:1px 6px`、`line-height:1.2`、垂直偏移 2px；作者观点为实心蓝底白字，推演为虚线描边。**标签文案只有「作者观点」与「推演」两种，禁用「理论推演」四字。**
- 页码统一 `.pg`：**13px 淡墨，字号全稿一致**——支撑依据、反例/边界、行动建议三处的页码必须是同款独立 span，**禁止任何一处页码留在正文行内按正文字号（24/23/22/21/20/19px）渲染**（否则同一稿里页码忽大忽小）。生成器 `splitPage()` 用「句末 `P\d` token」正则从中文整句尾拆分（中文无空格，禁用 `\S+\s+P\d` 锚前一个词——会拆错或漏拆）；反例/边界行的 `counter.t` 也必须走 `splitPage()` 拆出 `.pg`。
- **正文一律无下划线**。唯一例外是洞察页 `.insight-item .t b`，重点词加粗并加下划线——全稿仅此板块可出现下划线。

**反常识洞察页**

- 一页承载 **3–7 条**（按书中真正反常识的条目数量定，少则 3 条、多则 7 条），**按反常识权重降序排列**：最反常识的编号 01 置顶，依次往后。
- 标题字号 37px（较常规 29px 放大两档），观点正文 32px（较常规 24px 放大两档），序号 56px；重点词用 `<b>` 加粗+下划线。

**封面规则（不可漂移）**

- **封面副行（原 lede 位）固定显示作者及国别（v20 强约束）**：取 `docs[].authorDisplay`（如 `[美]莫琳·希凯`），缺失回退 `author`，多文档用 ` · ` 连接。**禁止**在此处写「N 条核心观点…」短句、主张 long 句或任何其它内容（那会占用作者位、破坏封面信息结构）；「N 条核心观点」等统计信息已由底部 index-bar 的 COVERAGE 格承载。封面其余版式（kicker/大标题/英文副标题/水印/故障列/二维码/四格统计）按固定模板，不随书漂移。

**其余硬规则**

1. **全页只保留背景正方形格子一种虚线**（34px 网格，起点对齐版心左上角）。顶栏之上两条线、核心论点下划线、栏间竖虚线、条目间淡虚线一律不画——浅色虚线压在背景格子上会产生叠影。
2. **来源标注可追溯**：`actions[].k="author"` 必须有 `p` 页码；`k="theory"` 不填页码。作者观点优先，不足再推演 2–3 条；每条观点合计 4–5 条。
3. **金句只放 1 句**，够格才列、宁缺毋滥；引号必须成套。
4. **右上角音乐开关、左下角按键指南是固定接口**：`.music-toggle` 固定右上；按键文案 `A 上一张 · D 下一张 · T 目录 · F 全屏 · G 音乐 · H 灯光`（竖版 W/S）；键位绑定 `F`（全屏）、`G`（音乐）、`H`（灯光，v48 起速读版也支持，与深读/多重版一致：关灯正文/首页转 `#121316` 星空黑、字体 `#c9cfe0`，默认开灯，按钮紧邻音乐左侧）。**无 E 编辑功能**。
5. **尾页四格 credits**：第 4 格固定 `CREATOR` / `Skill制作者：况达FDE`，生成器自动补齐。

**校验注意**：`.reveal` 元素初始带 `translateY(22px)`，未激活的页面做 `scrollHeight` 检查会误报 22px 溢出。全量巡检前先执行 `document.querySelectorAll('.slide').forEach(s=>s.classList.add('visible','active'))` 并等待动画归零，再测真实溢出。必须检查：`actionHidden=0`、四块正文字号一致、chip 与页码尺寸一致、下划线只在洞察页出现。密度自适应新增必查：`--body-fs` 由内容密度决定——若各页内容量相近（同一本书结构统一）全稿同一档属正常，需用「注入长文后该页自动降档」的对照测试确认机制有效，而非强求页间一定有差异；`--body-gap` > 4px 的页数占比合理（稀疏页已放宽）、每页「正文真实底到金句」距离不为大块留白（不应出现 > 120px 空白）、支撑/反例/行动三处 `.pg` 字号全部为 13px（用 `getComputedStyle` 遍历 `.support-list .pg`、`.action-list .pg`、`.counter .pg` 确认，禁止行内大字号页码）。

## 尾页 credits 规范（固定四格）

结语页（colophon）底部 credits 固定四格，`assets/theme.css` 用 `grid-template-columns:repeat(4,1fr)` 同排等宽，样式与前三项完全一致（上方 `.k` 全大写小字、下方 `.v` 正文）：

| 格 | k | v |
|---|---|---|
| 1 | `SOURCE 01` | 书名 + 作者 |
| 2 | `COVERAGE` | 覆盖范围 + 观点数 |
| 3 | `DELIVERABLE` | 交付物 |
| 4 | `CREATOR` | `Skill制作者：况达FDE`（固定，不随书变化） |

`templates/data.template.json` 已含第四格；`scripts/build_deck.js` 在生成结语时检查 `closing.credits`，无 `k=CREATOR` 则自动追加到末尾，已有则不覆盖——这样复用旧 `data.json` 重出也不会丢标识。不要用绝对定位或另起一行实现，必须占满第 4 列。

## 知识库同步规则（修改本 skill 时强制执行）

**触发条件：用户要求修改本 skill 的任何内容，或 AI 为修复问题改动了 `SKILL.md` / `references/` / `templates/` / `scripts/` / `assets/` 中任一文件时，同步更新 IMA 知识库中的存档就是本次修改的必经步骤。与修改本地文件同等优先级，不得省略、不得只改本地不同步、不得等用户再次提醒。**

固定目标（已固化，不要询问或另选）：
- **Skill 存档** → 知识库「SKILL」`ima_kb_SgMZpyuc` → 文件夹 `速读skill`（`folder_7528667831885176`）→ 子文件夹 `默认版本`（`folder_7528667924152336`）。文档名用语义化版本：`速读_v1.M.P.md`。**不要传到知识库根目录**。
- **书籍速读笔记** → 知识库「藏书阁」，ID `ima_kb_fHDToMFu`，文档名 `[书名][国别]作者-速读版.md`（同名替换）
- 本地存档：`D:/WorkBuddy/速读Skill_完整存档.md`（最新版）；版本副本：`D:/WorkBuddy/版本存档/*_v{N}.md`（永久保留，不覆盖）

**语义化命名规则（三段数字，沿用既有序列）**：内部版本 `vN`（`VERSION` 文件）映射为 `速读_v{M}.{m}.{p}.md`，其中 `M=1`、`m=N//10`、`p=N%10`（整除取余）。既有对照：v3=`速读_v1.0.3.md`、v9=`速读_v1.0.9.md`、v10=`速读_v1.1.0.md`、v12=`速读_v1.1.2.md`、v15=`速读_v1.1.5.md`、v20=`速读_v1.2.0.md`。打包脚本会自动生成该语义化命名文件，入库直接用它。

**版本管理（留历史）**：版本号存于 skill 根目录 `VERSION` 文件。每次修改 skill 后：
1. 打包时用 `--bump` 递增版本：`python ".../scripts/pack_archive.py" --note "本次修改说明" --bump`。
2. 脚本同时产出「规范名最新版」（覆盖）和「`版本存档/` 下的 `_v{N}` 副本」（永久保留）。
3. 知识库存档按语义化版本号命名、逐版共存（`速读_v1.0.3.md` … `速读_v1.1.5.md`），全部位于 `默认版本` 文件夹；旧版不删、可回溯。

同步流程（按顺序执行，全部成功才算完成）：
1. **重新打包**：`python "C:/Users/btckq/.workbuddy/skills/速读/scripts/pack_archive.py" --note "本次修改说明" --bump`（仅改同步规则时可不 bump）。脚本把 skill 全部文件全文按固定路径打包成存档 Markdown。
2. **准备语义化命名文件**：把 `D:/WorkBuddy/速读Skill_完整存档.md` 复制为 `D:/WorkBuddy/速读_v1.M.P.md`（M/P 按上条规则）。
3. **判定 IMA 接口形态**：读当前平台 `add_knowledge` 的工具 schema，按 [IMA 接口适配器](references/ima-adapter.md) 第二节判定形态 A（宿主封装态）或 B（原生 OpenAPI 态）。**两态字段互不兼容，判定前不要传参**。
4. **上传+入库**：按适配器对应形态的模板执行 `create_media → 上传 → add_knowledge`：
   - 目标 `knowledge_base_id=ima_kb_SgMZpyuc`、`folder_id=folder_7528667924152336`、文件名 `速读_v1.M.P.md`；
   - 形态 A：`apply_upload_mode=1`，PUT 到预签名 URL，add 带 `duplicate_name_strategy=DUPLICATE_NAME_STRATEGY_REPLACE`；
   - 形态 B：`apply_upload_mode=2`，COS v5 签名 PUT，add 带 `media_type=7`/`title`（含扩展名）/`file_info`，**不传** `duplicate_name_strategy`。
5. **验证**：按适配器稳定层的验证闭环，调用 `get_knowledge_list`（folder_id=`folder_7528667924152336`）或 `search_knowledge` 检索 `速读_v1.M.P`，确认已入 `默认版本` 文件夹且摘要为最新。

**失败处理**：任一步失败，必须在回复中明确告知用户「知识库未同步成功」及卡在哪一步，不得静默跳过；下次会话继续补传。

> 历史提示：曾把 `速读Skill_完整存档.md` 误传到 SKILL 库根目录（`默认版本` 文件夹之外）。v15 起统一用 `速读_v1.M.P.md` 命名并存入 `速读skill/默认版本`；检索以该文件夹内的语义化存档为准。

## 工作流

### Step 0 · 输入与确认
- 收到文档路径后确认格式。支持 `.pdf .docx .txt .md .epub`。**旧版 `.doc`（OLE2）不支持**：脚本会明确报错并提示先用 LibreOffice/Word 转 `.docx`。
- 输出目录：默认 `D:/WorkBuddy/`（用户偏好 D 盘）。**文件名固定为 `书名[国别]作者-速读版/深读版.html`**（例：`资本论[德]马克思-深读版.html`）；国别+作者取 `docs[0].authorDisplay`，缺失回退 `docs[0].author`，多文档取第一本；不加版本/口径后缀。

### Step 1 · 文本提取
```bash
python "C:/Users/btckq/.workbuddy/skills/速读/scripts/extract_text.py" "<输入路径>" "D:/WorkBuddy/.tmp_<主题>/content.txt"
```
- 优先走 PDF 文本层；文本层过薄时脚本自动回退 OCR（需 `pymupdf pytesseract pillow` + Tesseract 中文包）。
- **必须保留 `===== PAGE N =====` 页码标记**——支撑依据的 `src` 字段靠它溯源。
- 提取后用 `len(text)` 粗检：正文明显偏少（如 400 页书 < 10 万字符）要提示用户可能是扫描件。

### Step 2 · 观点提炼（数据清洗核心 · v21 四层逻辑）
读取 [提炼规范](references/extraction.md)，严格按「四层升级闸」流程：
0. **先查复用**：若 `D:/WorkBuddy/[主题]_data.json` 已存在（同一本书以前做过），直接复用，跳到 Step 3，省去最耗 token 的提炼步骤。除非用户明确要求重新提炼。
1. **闸1 入口分流**：先判图书类型（实用/理论/叙事/混合），据此决定「什么算一条观点」与下限是否浮动。
2. **闸2 逻辑单元**：建章节覆盖表（从目录/标题/`===== PAGE N =====` 或 `===== CH N =====` 标记），按**主旨**而非章节切分；每条通过准入四问（独立性/非同义/可检验/有边界）；同义观点合并，纯断言与关键词剔除；有独立主旨却为 0 条的章节定向回原文补读。
3. **闸3 分层结网**：每条打 `level`（哲学视角/学科原理/方法流程/经验技巧），写 `links`（支持/反驳/细化/前提/应用关系）；失衡时调整层次分布。
4. **闸4 密度校验**：用论点覆盖率、原理层占比、连接度复核，条数仅作参考。
5. **反常识筛查**：专找「早期优势后期反转」「解法即病因」这类机制反转，按权重降序单列 3–7 条洞察。
6. **补行动建议**：为每条观点补 `actions`。先回原文找作者明确的行动指引（`k:"author"` + `p` 填页码）；没有的据该条 `title`/`logic`/`support` 推演 2–3 条（`k:"theory"`，`p` 留空）。每条 4–5 条，规则详见 [观点页版式规范](#观点页版式规范定稿-v14--2026-11-19) 硬规则 2。
7. 落盘为 `D:/WorkBuddy/[主题]_data.json`（**规范名长期保留，不要删**），结构见 [templates/data.template.json](templates/data.template.json)，务必先跑校验：
```bash
python "C:/Users/btckq/.workbuddy/skills/速读/scripts/validate_data.py" "<data.json路径>" --min <下限>
```

### Step 3 · 生成演示稿（标准速读版 · 仅用户明确说「速读」时走；默认走 Step 3-N）
```bash
node "C:/Users/btckq/.workbuddy/skills/速读/scripts/build_deck.js" "<data.json路径>" "D:/WorkBuddy/[书名][国别]作者-速读版.html"
```
- **默认音乐已固化**：不传 `--music` 时自动用 skill 内置 `assets/default-music.mp3`（时空储蓄罐 - Jul 32）。用户当场另给音乐时才用 `--music "<新路径>"` 覆盖。
- Python 解释器固化路径：`C:/Users/btckq/.workbuddy/binaries/python/envs/default/Scripts/python.exe`（已装 pypdf/python-docx）。命令行 `python`/`python3` 不通时改用它。
- `--music-mode embed`（默认）把音乐 base64 内联，真正单文件；`link` 生成相邻文件引用；`none` 不加音乐。
- 音乐开关在**右上角**，默认关闭，点击播放/暂停（`G` 键同效）；不自动播放，规避浏览器拦截。
- 单文档顶栏的作者显示取 `docs[].authorDisplay`（如 `[日]高桥政史`），没有则回退 `author`；右下出处由 `srcLabel()` 生成「章节 P页码」（如 `规则3 P6-7`），页码取书页、无书页则取 PAGE。

**翻页按键（按版式方向二选一，不可混用）**

| 参数 | 版式 | 翻页键 | 说明 |
| --- | --- | --- | --- |
| `--orientation landscape`（默认） | 横版 | `A` 上一张 / `D` 下一张 | **不定义 W/S** |
| `--orientation portrait` | 竖版 | `W` 上切 / `S` 下切 | 区别于竖版上下滑动手势；不定义 A/D |

- 方向键、空格、Home/End、T/F/G/H 两种版式均保留（`G` 为音乐开关、`F` 全屏、`H` 灯光开关）；**无 E 编辑功能**。
- 页面左下角导航提示会随版式自动切换文案。

### Step 3-N · 深读导航版（默认模式，v24 / v50 改默认）
**用户未指定模式、或明确说「深读」时走本分支（默认，见核心原则18）。** 也可由「分层导航/知识星云/可折叠目录/星际巡游」等词触发。仅当用户明确说「速读模式/标准速读/不要深读」时才改走 Step 3 标准速读版。详见 [navigation.md](references/navigation.md)。
```bash
# ① 写分组 map（人工判定三层树，编号用深读 data 的原始 no）
# ② 构建导航 data（树遍历重排 + 注入 hn/tier/parent/children/refs/point）
python "C:/Users/btckq/.workbuddy/skills/速读/scripts/build_nav_data.py" "<深读data.json>" "<导航data.json>" --map "<map.json>"
# ③ 生成导航版 HTML（飞船图自动从 assets/ship.png 内联；文件名可加 -导航 后缀区分普通版）
node "C:/Users/btckq/.workbuddy/skills/速读/scripts/build_deck_nav.js" "<导航data.json>" "D:/WorkBuddy/[书名][国别]作者-深读版.html"
```
- 导航版快捷键：`Q` 目录 / `W` 星云 / `N` 层级导航 / `P` 巡游 / `Z` 撤销（连击回撤）/ `A` `D` 翻页 / `F` 全屏 / `G` 音乐。
- 层级编号核心 `i.0`、分层 `i.j`、基础 `i.j.k`。星云页是全稿唯一黑夜模式，其余页必须浅色原状。
- 校验：零溢出、页码13px、Q/W/Z/P 实测、树展开收起、星云悬停命中、飞船与速度滑块、零 JS 错误。

### Step 3-M · 多重深读版（第三模式，v47，多书/多演讲融合）
**仅在用户明确说「多重深读 / 多本图书融合 / 多个演讲稿融合」时走本分支**；与 Step 3（速读）、Step 3-N（深读）平级，互不污染。详见 [多重深读规范](references/multi.md)。
```bash
# ① 每位讲者/每本书各自提炼观点池（用标准速读字段），写 config.json（books[] 含 name/author/claim/ideas_file/insights_file/cores）
# ② 导出跨讲者关联素材：观点索引 + 可直接发给 agent 的分析 prompt；产出 cross_refs.json 后写入 config 的 cross_file
python "C:/Users/btckq/.workbuddy/skills/速读/scripts/gen_cross_prompt.py" "<data.json>" "<index.txt>" "<prompt.txt>"
# ③ 构建 4 层 data（图书→核心→分层→基础，全局连续编号 + 跨讲者 refs，meta.mode='multi'）
python "C:/Users/btckq/.workbuddy/skills/速读/scripts/build_multi_data.py" "<config.json>" "D:/WorkBuddy/[主题]_多重深读_data.json"
# ④ 专用校验（勿用 validate_data.py，它不认多doc）
python "C:/Users/btckq/.workbuddy/skills/速读/scripts/validate_multi.py" "<data.json>"
# ⑤ 生成 HTML（独立生成器，音乐/飞船/主题沿用深读版资源）
node "C:/Users/btckq/.workbuddy/skills/速读/scripts/build_deck_multi.js" "<data.json>" "D:/WorkBuddy/[主题]-多重深读版.html"
# ⑥ 浏览器全量审计（无 bug 才交付）
python "C:/Users/btckq/.workbuddy/skills/速读/scripts/audit_multi.py" "<out.html>"
```
- 4 层 hn：图书 `i` / 核心 `i.j` / 分层 `i.j.k` / 基础 `i.j.k.l`；星云 tier 依次为 `course`(中心) → `book` → `core` → `layer` → `foundation`。
- 目录页 4 层树（图书行可折叠），星云页中心=总主题、图书围绕中心（虚拟编号 100000+i），纵览页 `.multi-overview` 紧凑网格。
- 洞察页 ≤7 条（每位讲者取 1 条最锐利），避免 `.contrast` 页溢出。
- 校验：零溢出（舞台 1920×1080）、7 图书/核心/分层/基础节点数正确、Q/W/E/H 与树折叠实测、零 JS 错误。

### Step 3.5 · 生成 Markdown 速读笔记（与 HTML 同时交付）
```bash
python "C:/Users/btckq/.workbuddy/skills/速读/scripts/build_markdown.py" "<data.json路径>" "D:/WorkBuddy/" --version <当前版本>
```
- 每本书生成一份 `[书名][国别]作者-速读版.md`，带 YAML frontmatter（`title/version/author/book/source/tags/date`），可直接入库。
- 结构：一句话主张 → 阅读地图 → 观点索引表 → 逐条详解（推演逻辑/支撑依据/行动建议/金句/出处）→ 反常识洞察。
- 规范名文件覆盖更新；`--version > 1` 时另在 `D:/WorkBuddy/版本存档/` 生成 `_v{N}` 副本永久保留。

### Step 3.6 · Markdown 存入 IMA 知识库「藏书阁」
目标知识库：**藏书阁**，ID `ima_kb_fHDToMFu`（这是独立知识库，不是子文件夹）。
1. **先按 [IMA 接口适配器](references/ima-adapter.md) 判定当前平台的接口形态**（A 宿主封装态 / B 原生 OpenAPI 态），两态字段互不兼容。
2. 按对应形态模板执行 `create_media → 上传 → add_knowledge`：`knowledge_base_id=ima_kb_fHDToMFu`、`file_name=[书名][国别]作者-速读版.md`、入根目录省略 `folder_id`。形态 A 用预签名 URL + `duplicate_name_strategy=DUPLICATE_NAME_STRATEGY_REPLACE`；形态 B 用 COS v5 签名 + `media_type=7`/`title`（含扩展名）/`file_info`，不传 `duplicate_name_strategy`。
3. 用 `search_knowledge` 验证笔记可检索到；失败按适配器第六节回退。
4. > 1 的版本副本只存本地 `版本存档/`，不重复入库。

### Step 4 · 交付前校验（不可跳过）
读取 [排错清单](references/pitfalls.md)，按其中方法做程序化全量巡检：
- 每页 `scrollWidth/scrollHeight` 不超出舞台；只有一页可见；目录逐条跳转映射准确；音乐按钮存在且可点击。
- **先激活全部 slide 再测溢出**（见观点页版式规范末尾的校验注意），避免 `.reveal` 初始位移误报。
- 用 `present_files` 打开成品预览。

## 资源索引

| 文件 | 用途 | 何时读 |
| --- | --- | --- |
| `references/extraction.md` | **v21 四层判断逻辑**（入口分流/逻辑单元四问/分层结网/密度校验）+ 数量下限安全网、覆盖表、字段规范（含 `level`/`links`/`premise`/`counter`/三段式） | Step 2 必读 |
| `references/pitfalls.md` | 版式踩坑与程序化校验方法（含 v14 巡检必查项） | Step 4 必读 |
| `references/ima-adapter.md` | **v23 跨 AI 平台 IMA 接口适配器**：形态 A（宿主封装/MCP 预签名）/ 形态 B（原生 OpenAPI/COS 签名）探测决策树、两套完整模板、失败回退、验证闭环 | **所有 IMA 入库前必读**（Step 3.6 与知识库同步规则） |
| `references/navigation.md` | **v24 / v57 深读导航版规范**：两路径判定、三层树构建、层级编号、可折叠目录（v57 单击跳/双击折叠）、知识星云页、星际巡游、Q/W/N/P/Z 快捷键、颜色资源、校验清单、历史教训 | **走导航版分支时必读**（Step 3-N） |
| `templates/data.template.json` | v14 标准数据结构样例（含新字段、短 lede、P 页码、3 条洞察、`authorDisplay`） | Step 2 起新数据时照抄 |
| `scripts/validate_data.py` | v21 强校验：`level` 枚举、`links` 存在性、层次分布/连接度密度指标、排序、三段式、页码格式、洞察分组、总量下限；旧数据缺 level/links 仅 WARN 不 fail | Step 2 落盘后必跑 |
| `scripts/extract_text.py` | PDF/DOCX/EPUB/TXT 文本提取 | Step 1 |
| `scripts/build_deck.js` | JSON → 单文件 HTML 生成器（含观点页定稿模板） | Step 3 |
| `scripts/build_deck_nav.js` | **v60 深读导航版生成器**：树目录（v57 单击跳/双击折叠）+ 知识星云（v60 连线分级跟随）+ 层级导航 + 巡游飞船（独立文件，不污染普通版） | Step 3-N |
| `references/multi.md` | **v57 多重深读规范**：4 层结构（图书→核心→分层→基础）、三模式路由、数据构建、生成器改造、交互 UX、专用校验、历史教训 | 走多重深读分支时必读（Step 3-M） |
| `scripts/build_deck_multi.js` | **v60 多重深读生成器**：4 层树目录 + 课程中心星云 + 7 图书公转 + 紧凑纵览页 + UX 交互 + 性能版（DOM 延后构建/meta.fitValues 固化/连线跟随/防裁切/v60 修 fitBody 回调报错+降级；独立文件，零污染速读/深读版） | Step 3-M |
| `scripts/bake_fit_values.py` | **v59 版式基线采集器**：从非懒加载参考 HTML 采集每页字号/间距 → JSON，并入 data.json 的 `meta.fitValues` 保证懒加载版版式逐项一致 | Step 3-M（要保真时） |
| `scripts/build_multi_data.py` | **v45 多重深读数据构建器**：多 doc 全局重编号 + 每 doc 内 3 层树 + 注入 4 层 hn/tier/parent | Step 3-M ② |
| `scripts/validate_multi.py` | **v45 多重深读专用校验**：全局编号/4 层树/字段/父子一致/hn 段数/洞察≤7（勿用 validate_data.py 校验多 doc） | Step 3-M ③ |
| `scripts/gen_cross_prompt.py` | **v47 跨讲者关联素材生成器**：导出观点索引 + 可直接发给 agent 的关联分析 prompt | Step 3-M ② |
| `scripts/audit_multi.py` | **v47 多重深读浏览器审计**：页面类型/目录4层/星云节点/垂直+横向关联/巡游/灯光/溢出/JS 错误全量巡检 | Step 3-M ⑤ |
| `scripts/build_nav_data.py` | **v24 导航数据构建器**：三层树重排 + 注入 hn/tier/parent/children/refs/point，支持 --map 分组文件 | Step 3-N ① |
| `scripts/pack_archive.py` | 把 skill 全部文件打包成知识库存档 Markdown | **每次修改 skill 后必用** |
| `scripts/build_markdown.py` | data.json → 每本书一份知识库友好的 Markdown 笔记（含行动建议） | Step 3.5 必用 |
| `VERSION` | skill 版本号（改 skill 时 --bump 递增，留历史） | 打包脚本自动读取 |
| `assets/theme.css` | Cobalt Grid 样式（两色/坐标纸/固定舞台）+ 观点页定稿版式 | 生成器自动读取；版式细节见「观点页版式规范」 |
| `assets/default-music.mp3` | 默认背景音乐（v29 换为更小文件 3.8MB）；IMA 备份「SKILL/速读skill」 | 生成器自动读取（仅双音乐模式） |
| `assets/nebula-music.mp3` | **v30 星云页专属音乐**（深读版专用，响度已归一化与默认曲一致）；IMA 备份「SKILL/速读skill」 | `build_deck_nav.js` 自动内嵌 |
| `assets/ship.png` | **v24 导航版巡游飞船**（像素风，抠白底透明，运行时 base64 内联）；**v42 已入 IMA 备份「SKILL/速读skill」** | `build_deck_nav.js` 自动读取；跨设备恢复必取回 |
