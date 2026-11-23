# 多重深读规范（v60 · 2026-11-22 更新 · 第三模式）

> 适用：用户说「多重深读 / 多本图书融合 / 多个演讲稿融合」。
> 这是与「速读版」「深读导航版」平级的**第三模式**，走独立生成器，**零污染**其它两模式。

## 一、定位与结构

核心差异：**多文档 4 层**，而非单文档 3 层。

| 层 | 名称 | 数据载体 | hn 段数 | 星云 tier | 说明 |
|---|---|---|---|---|---|
| 1 | 图书层 | `docs[]`（每本书/每位讲者一个 doc） | 1 段 `i` | `book` | 7 讲者即 7 个 doc |
| 2 | 核心观点 | `doc.ideas[tier=core]` | 2 段 `i.j` | `core` | 每个 doc 3-5 个核心 |
| 3 | 分层观点 | `[tier=layer]` | 3 段 `i.j.k` | `layer` | 核心下若干分层 |
| 4 | 基础观点 | `[tier=foundation]` | 4 段 `i.j.k.l` | `foundation` | 分层下若干基础 |

星云中心是额外虚拟节点 `tier=course`（data-idea=0），显示总主题。

## 二、三模式路由（v50 改定：默认深读）

| 用户原话 | 模式 | 生成器 | 数据构建 |
|---|---|---|---|
| 含「多重深读/多书融合/多演讲融合」 | 多重深读版 | `build_deck_multi.js` | `build_multi_data.py` |
| 明确说「速读模式/标准速读/不要深读」 | 标准速读版 | `build_deck.js` | 手工 data.json |
| **未说模式 / 含「深读」/ 只说「做演示稿」** | **深读导航版（默认）** | `build_deck_nav.js` | `build_nav_data.py` |

判定只看原话关键词，不靠主题复杂度猜。v25–v49 曾默认速读，v50 起**默认深读**，速读需显式声明。

## 三、数据构建

每位讲者/每本书**各自**按标准速读字段提炼观点池（见 extraction.md），再写 config.json：

```json
{
  "meta": {"title":"北大AI创投课 · 多重深读版","subtitle":"...","kicker":"...",
           "mapTitle":"7 书 · 4 层","mapTag":"MULTI-DECK · 2026","lede":"...",
           "insightLabel":"北大AI创投课 · 反常识洞察","closing":{...}},
  "insights_per_book": 1,
  "books": [
    {"name":"张涛","en":"...","author":"...","claim":"...",
     "ideas_file":"D:/.../ideas_zhangtao.json",
     "insights_file":"D:/.../insights_zhangtao.json",
     "cores":[{"label":"Chatbot 的终结","point":"chatbot 限制智能表达","nos":[1,2,3,4,5]}]}
  ]
}
```

`cores[].nos` 用该书观点池的原始编号。未被任何 core 覆盖的观点，自动挂到最后分层。`build_multi_data.py` 做：全局连续重编号 → 每 doc 内建 3 层树 → 注入 hn/tier/parent/children/coreNo/coreLabel/point → 写 `meta.mode='multi'`。

### 完整流程（5 步，含跨讲者关联）
```bash
# ① 分组提炼观点池 + 洞察（每组一份 ideas_*.json / insights_*.json，用标准速读字段）
# ② 生成跨讲者关联分析素材：导出观点索引 + 可直接发给 agent 的任务 prompt
python scripts/gen_cross_prompt.py <multi_data.json> <index.txt> <prompt.txt>
#    把 prompt.txt 交给 agent 分析，产出 cross_refs.json（见四·补）
# ③ config.json 里加 "cross_file": "<cross_refs.json路径>"，构建 4 层 data
python scripts/build_multi_data.py <config.json> <out_data.json>
# ④ 数据校验 + 生成
python scripts/validate_multi.py <out_data.json>
node scripts/build_deck_multi.js <out_data.json> <out.html>
# ⑤ 浏览器全量审计（页面/目录4层/星云/垂直+横向关联/交互/溢出/JS）
python scripts/audit_multi.py <out.html>
```

## 四、生成器改造要点（build_deck_multi.js）

从 `build_deck_nav.js` 复制后**纯增量**改造（原版零改动），共 7 处：

1. 顶部提前定义 `isMultiDeck = meta.mode==='multi' && docs.length>1` 与 `bookIdOf(bi)=100000+bi`（虚拟图书节点编号，避免与观点编号冲突）。
2. **纵览页**：原 `.compare` 页 N 份会超长溢出 → multi 走 `.multi-overview`（4 列紧凑网格，7 卡 2 行）+ `multiCss`。
3. **目录页**：multi 走 4 层树分支（图书行 `tier-book` 可折叠 → core → layer → foundation），折叠交互靠通用 `data-toggle`/`data-children-of` 机制。CSS `.tr-row.tier-book`。
4. **星云页**：multi 分支独立生成——中心 `tier=course`；7 图书围绕中心公转（a≈430-470）；每个图书下 core（a≈120-160）→ layer（a≈58-76）→ foundation（a≈24-36）逐层嵌套；连线 `data-a/data-b` 沿用 vlink/hlink；节点 `data-parent` 必须指向真实父节点 id（core 的 parent=bookId）。
5. **initOrbits**：`order = ['book','core','layer','foundation']`（加 book）。
6. **nodeHtml**（multi 分支）：`parentAttr = tier==='book' ? '0' : (v.parentAttr||v.parent||'0')`，保证 core 挂到 book。
7. **TIER_LABEL**：加 `course:'◉ 课程'`、`book:'◉ 图书·讲者'`。

星云装饰行：`图书 N · 核心 N · 分层 N · 基础 N`。洞察页 ≤7 条（每位讲者取 1 条）。

## 四·补、跨讲者横向关联（打破次元壁 · v46）

多重深读的**灵魂**：不同讲者的观点要能横向连起来，而不是 7 个孤岛。

### 数据侧
1. 观点池提炼完后，专门跑一轮「跨讲者关联分析」：读全部观点索引（编号|讲者|层级|标题），找出跨讲者的 呼应/对照/支撑/应用 关系，输出 `cross_refs.json`：`[{"a":旧no,"b":旧no,"type":"呼应","reason":"一句话理由"}]`。a、b 必须来自不同讲者；每条观点最多 4 条；目标 50-80 条覆盖全部讲者对。
2. `build_multi_data.py` 读 config 的 `cross_file`，做三件事：①把 `links` 里的 `#旧编号` 映射为全局新编号（**否则编号全错乱**）；②从 links 提取组内 refs；③合并跨讲者关联为 `refs` + 结构化 `crossRefs[{no,type,reason}]`。
3. **不要用 `build_nav_data.py` 的逻辑**——它只处理单 doc，不会生成跨讲者 refs。

### 生成器侧（build_deck_multi.js）
- 星云节点带 `data-cross`（crossRefs 的 JSON）；hlink 按类型着色：呼应绿 `#4FB286` / 对照橙 `#E08A5B` / 支撑紫 `#8E6FD8` / 应用蓝 `#5B9BD5`，跨讲者连线更粗更亮（stroke-width 1.5 / dash 6 5 / opacity .5），组内关联淡紫细线（0.9 / 3 6 / .22）。
- 信息栏横向关联区显示「横向关联（N · 跨讲者 M）」，跨讲者条目带彩色徽标 `跨讲者·类型` + reason 理由。浏览器端用 `escB()` 转义（Node 端 `esc` 不在浏览器作用域，直接调用会报 `esc is not defined`）。
- 图书节点 `data-children` 必须=本讲者核心编号（不是空数组），否则 hover 时"向下垂直关联"缺失——这是曾踩的坑。

## 五、校验（必须用 validate_multi.py）

`validate_data.py` **不适用**多文档 data（它假设每 doc 编号从 1、洞察每组 3-7 条，会对多 doc 全局编号报 ERROR，属误报）。用专用校验：

```bash
python scripts/validate_multi.py "<data.json>"
```

检查项：全局编号连续 / 每 doc 4 层齐备 / 字段完整 / logic 末步推论 / actions 三段式 / src 与 support 带 P 页码 / 树父子一致 / hn 段数=层级 / 洞察 ≤7 且含 `<b>` / 连接度。

浏览器巡检（用系统 Chrome，playwright 若无内核可 `executable_path` 指向 `C:\Program Files\Google\Chrome\Application\chrome.exe`）：零溢出（舞台 1920×1080）、Q 目录 4 层、W 星云 course+book+观点节点齐、E 巡游飞船显示、H 灯光、树折叠、零 JS 错误。

## 五·补、交互 UX（v57 · 用户 2026-11-22 认可）

**交互①（单击跳/双击折叠）深读版 `build_deck_nav.js` 与多重版 `build_deck_multi.js` 共用**；其余 ②–⑤ 图书相关项为**多重专属**（深读/速读无图书层，无从谈起）。性能基线沿用 v53/54/56 精简补丁（深读与多重共用）：

1. **目录树单击跳观点、双击折叠（深读 + 多重共用）**：所有 `.tr-row` 统一先跳观点——`click` 用 `setTimeout(doJump, 220)` 延迟 220ms，`dblclick` 时 `clearTimeout(row._clickTimer)` 取消跳转再执行 `doFold()` 折叠。**不要用 `row._dbl` 标志法**（双击前两次 click 已触发跳转，标志拦不住）；`doFold` 只作用于带 `data-toggle` 的行，无子节点的末级行双击不报错。深读版 v57 起也用此交互，详见 [navigation.md](navigation.md)。
2. **图书入口直达首观点**：纵览卡 `.mo-card[data-book]` 与目录图书行点击后 `this.show(BOOK_PAGE[i])`，其中 `BOOK_PAGE[i] = ideaPageIndices[i-首个观点no]`。星云中心的 course 节点（data-idea=0）是全书枢纽，只做 hover 显示总览（`NO_TO_PAGE` 无 '0' 键，点击无跳转属预期行为，非 bug）。
3. **取消图书扉页**：多重版不再生成每书 chapter 封面页（原 `if(false) add('chapter',...)` 分支直接删除），避免与封面统计重复、减少页面数；统计已移入封面 index-bar。
4. **`data-book` 只挂图书行（踩坑）**：`rowHtml()` 里必须 `v.tier==='book'` 才加 `data-book="${v.book}"`。**不能**写 `v.book!=null`——观点对象自带 `book` 字段，会导致所有目录行误挂、点击跳错。
5. **文案**：纵览页标题「7 位讲者纵览」→「图书纵览」，星云中心 `data-title`「7 位讲者」→「7 本图书」（与 4 层结构一致）。

**性能归因结论（用户追问四次 UX 是否导致卡顿）**：不是。干净 A/B（精简版 + 仅这 4 项 UX）与精简极速版 CDP 实测 Layout 6.945 vs 6.975、Task 8.825 vs 8.83，差异在噪声内。卡顿来自生成器重生成时夹带的其它版本差异，删扉页后仍卡亦印证。headless 单次 DCL 极不稳定（同文件 9.4s~17.3s 波动），**不得据此归因**，必须用独立进程 CDP A/B。

## 五·补2、性能版（v59 · 用户 2026-11-22 真机确认后固化）

仅 `build_deck_multi.js`，深读/速读零改动。5 项优化：

1. **非当前页 DOM 延后构建（PERF①）**：`.slide-idea` 正文存 `LAZY_SLIDES`（idx→完整 section HTML），正文位放空 frame，翻到才 `hydrate(i)` 注入。保留 466 个 slide 壳与索引映射（目录/页码不变）。`constructor` 只 `hydrate(0)`；`show()` 开头 `this.hydrate(i)`；`_bindOneSlide` 补单页导航绑定。
2. **版式保真（硬要求）**：字号/间距从 data 的 `meta.fitValues` 读，固化进 `.cols` 的 `--body-fs/--body-gap`，运行时不重算。采集流程：先用**非懒加载**参考版生成 HTML → `python scripts/bake_fit_values.py <参考HTML> <out.json>` → 把 JSON 并入 data.json 的 `meta.fitValues`。**无此字段时降级**（v60 修正）：生成器输出 `FIT_PAGES`（有固化值的页索引），`show()` 在页面 active/visible 后对无固化值页跑 `fitBody(this.slides[target])`（hydrate 内 rect=0 会误判最小字号）；全局回调 `fonts.ready/load/resize` 必须包成 `() => fitBody()`，否则 FontFaceSet/Event 被当 oneSlide 传参报错。门禁：多页抽样 computed-style 逐项 diff（frame/分隔线/cols/金句/字号/间距/reveal）。
3. **去 twinkle 动画（PERF④）**：`.tw-book/core/layer` 改静态 `filter:brightness()`，去掉 keyframes 动画（数百节点每帧重绘）。
4. **连线分级更新（PERF⑤b，用户报错修复）**：hover 中每 33ms 只刷新 `.hl` 高亮线（**必须跟随公转的子节点**，否则端点脱节），非 hover 细线冻结。`updHi = hi && (!tick._lkh || (now-tick._lkh>=33))`——漏 `!tick._lkh` 会因 `NaN>=33=false` 死锁、高亮线永不刷新。
5. **支撑块防裁切（PERF⑥）**：`navCss` 注入 `.block.evidence{flex:0 0 auto!important;overflow:visible!important}`, `fitBody.fits()` 增加"支撑末行不得压到行动标题"判定。用户字体更宽致边界行换行被 `overflow:hidden` 静默裁半行（原版潜在缺陷）。
6. **环境坑**：实验/生成必须用 Skill 自带 `assets/theme.css`（27KB）；旧的 `D:/WorkBuddy/assets/theme.css`（23KB）缺 `.slide-idea .topbar` 等规则，会让 hairline/topbar/action-list 全乱。

实测 466 页：DOM 66,538→9,344（-86%）、加载 5.8s→2.0s、字号逐项一致、水合/跳转/星云/零 JS 错误全通过。

## 六、历史教训

- 洞察条数 >7 会让 `.contrast` 页溢出——多讲者必须每位取 1 条。
- 原 `.compare` 纵览页放 7 份 doc 会高 1674px，必须换 `.multi-overview` 紧凑网格。
- `isMultiDeck` 定义必须放在纵览页分支之前，否则 ReferenceError。
- 星云 core 节点的 `data-parent` 若写死 '0' 会全部挂到中心而非图书层，必须用 `parentAttr`。
- 阅读地图页（`.contrast`）在多重模式被复用为纵览页，overflow 检查要看它的高度。
- **编号框截断（v49 尝试 / v51 根治）**：多重版 hn 是 4 段（`7.3.1.1`），深读版固定 `width:96px` 装不下会被截成 `7.3.1.`。v49 改固定 `width:124px` 仍可能截（字号大时）；**v51 根治方案**：`.slide-idea .no-chip{ width:auto !important; min-width:118px; font-size:17px; letter-spacing:.04em }`——宽度随内容自适应，任何段数都绝不截断。实测全部 71 个 4 段编号零溢出、顶栏无溢出。**只改 `build_deck_multi.js`，不动深读版 96px 规格。** 另注意 theme.css 有一条同选择器旧规则（`font-size:19px`），navCss 的后置规则会覆盖它，但验证时必须看浏览器 computed style 而非只看 HTML 文本。

## 七、首次实战（2026-11-20）

北大AI创投课：7 位讲者（张涛/朱啸虎/李丰/杨锦方/王小川/王淼森/戴春博）、29 万字、179 条观点、7 图书/27 核心/81 分层/71 基础、连接度 99%、7 洞察。成品 191 页 / 9.3MB，巡检全绿。
