# 排错清单（来自实战：52 页演示稿调试记录）

生成后用 Node + Playwright 程序化巡检，**不要靠肉眼看**。

## 一、必查项

```js
// 用 playwright 打开 file:// HTML，逐页检查
const pages = await page.$$('.slide');
for (let i = 0; i < pages.length; i++) {
  await page.evaluate(i => {
    document.querySelectorAll('.slide').forEach((s, k) => {
      s.classList.toggle('active', k === i);
      s.classList.toggle('visible', k === i);
    });
  }, i);
  const bad = await page.evaluate(() => {
    const s = document.querySelector('.slide.active');
    const stage = document.querySelector('.deck-stage');
    return {
      overflowX: s.scrollWidth > stage.clientWidth + 2,
      overflowY: s.scrollHeight > stage.clientHeight + 2,
      childrenOut: [...s.querySelectorAll('*')].filter(el => {
        const r = el.getBoundingClientRect(), b = stage.getBoundingClientRect();
        return r.right > b.right + 2 || r.bottom > b.bottom + 2 || r.left < b.left - 2;
      }).map(el => el.className).slice(0, 5)
    };
  });
  if (bad.overflowX || bad.overflowY || bad.childrenOut.length)
    console.log('SLIDE', i + 1, JSON.stringify(bad));
}
```

## 二、已踩过的坑（不要再犯）

| 现象 | 真凶 | 修法（生成器已内置） |
| --- | --- | --- |
| 目录页内容被撑出舞台 | 行高/padding 过大；或单文档几十行全塞一页 | 定稿 v7：**每页≤30 行、两栏各 15 行、先左后右**（先填满左栏再填右栏），超出自动分页并标「第 p/P 页」，生成器已内置 |
| 目录页竖向溢出（标题过长书，如《卡片笔记写作法》平均 26 字、最长 35 字） | 标题换行把 `.toc-row` 行高从 47px 撑到 71px，15 行累计 849–897px，超过 `.toc-grid` 的 710px | `.toc-row .t` 加 `white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0` 单行省略；短标题书不受影响，完整标题在观点页展示；已在 `assets/theme.css` 固化 |
| 演示稿里出现「观点速查 / INDEX」页，与目录重复 | 生成器旧版在每份文档扉页后插一张 `bkidx` 速查表 | **禁止生成该页**：目录每行已可点击跳转到观点页，速查表无增量价值；`build_deck.js` 不得恢复 `add('bkidx', ...)` 逻辑 |
| 单文档演示稿没有封面、首页直接是目录 | 生成器封面曾带 `docs.length > 1` 门槛 | 封面为必备页，单文档也必须出；版式同双书封面（kicker/大标题/英文副标题/lede/水印/故障列/二维码/index-bar）；标题按字数分档 c1–c4 防溢出 |
| CSS 透视网格不显示 | 纯 CSS 透视失效 | 改用内联 SVG 画线 |
| 封面大数字水印无描边 | `-webkit-text-stroke` 在无 GPU 环境失效 | 用 SVG `<text stroke>` |
| 结束页常驻遮挡 | `.end{display:flex}` 与显隐冲突 | 移除冲突规则，只用 `.active/.visible` |
| 手机端版式崩坏 | 用媒体查询重排内容 | 固定 1920×1080 整体缩放，禁止重排 |
| 目录跳转错位 | 硬编码页码偏移 | 生成器用 `pageMap` 动态计算 `TOC_ORDER` |
| 支撑依据与行动建议之间出现「虚线」，压在背景格子上像叠影 | `.block.action` 曾带 `border-top:1px solid var(--ink-faint)`，浅色实线在 34px 格子上视觉呈虚线 | **删除该 border，只用 `padding-top:22px` 留白分组**；观点页除背景格子外不得有任何分隔线（含淡色实线） |
| 行动建议空白（v13 旧坑，已废除） | 旧 `fitActions()` 空间不足时把行动项全部 `display:none`，通用巡检因只测容器而「假通过」 | **删除隐藏逻辑**：`fitBody()` 改为在 21/20/19px 中取最大可用档，112 条行动必须全部可见；巡检必须检查 `actionHidden=0` |
| 支撑依据里出现「（书页6 · PDF PAGE16）」这类双页码标注 | data 里手写了两套页码 | 渲染层 `fmtPage()` 统一压成 `P16`/`P6-7`（不加括号、不写书页/PDF/PAGE）；`extraction.md` 已把该格式定为数据规范 |

## 三、交互验证

- 键盘：`A/D` 翻页（横版默认）或 `W/S` 上下切换（竖版 `--orientation portrait`）；两者互斥不可混用；空格/Home/End 通用，`T` 目录、`F` 全屏、`G` 音乐；**无 E 编辑功能**（按键指南不显示 E、不注入编辑热区/按钮/实例）。
- 目录：逐条点击，验证 `data-page` 与目标观点页一一对应。
- 音乐：默认 `MUSIC OFF`，点击后变 `MUSIC ON` 且 `<audio>` 处于播放态；再点暂停。
- 始终只有一页 `.active`；`display:none` 出现次数为 0。
- 封面页存在且为第 1 页（`.cover` 索引 0）；单文档也有封面。
- 观点页除背景格子外无任何分隔线：`.block.action` 的 `border-top` 必须为 0，支撑与行动之间只有留白。
- 行动建议不越版心底线：每页 `.block.action` 的 `scrollHeight` 不得大于 `clientHeight`；**所有行动项必须可见（`actionHidden=0`），作者观点全部排在推演项之前**。
- 支撑依据与右下出处均无「书页/PDF/PAGE/括号」字样，页码只有 `P16` 或 `P6-7` 形式。
- 目录页数 = `ceil(观点数/30)`；每页 `.toc-row` 数 ≤30，先填满左栏 15 条再填右栏 15 条；无行被裁切。
- **演示稿中不存在 `.bkidx` / `INDEX` 速查页**；观点导航只有目录一处入口。
- 目录行点击跳转与目标观点页一一对应（跨页顺序正确）。
- 移动端 390×844：舞台等比缩放居中，无裁切。
- 控制台零 JS 错误。

## 四、性能与体积

- 音乐 base64 内嵌会让 HTML 增大约 9MB（6.6MB mp3 × 4/3）。用户要求极小文件时改用 `--music-mode link`。
- 生成后检查 `fs.statSync(out).size`，异常偏小说明 PAGE 没收集全。

## 五、v14 版式新增坑（2026-11-19 实战）

| 现象 | 真凶 | 修法（生成器已内置） |
| --- | --- | --- |
| 首页正文塞满、留白消失 | `meta.lede` 写了长主张句 | lede 固定短句「{N} 条核心观点，每条拆成推演逻辑与支撑依据两栏。」；主张放正文，不进封面 |
| chip「作者观点/推演」框比行动建议的大 | 反例/边界 chip 在 flex 容器 `.ptexts` 里被交叉轴拉伸 | `.cb-row .ptexts{display:block}` 回普通文本流；chip 全板块统一 12px / 1px 6px / 15px 高 |
| chip 出现「理论推演」四字 | 旧文案未改 | 全板块标签只有「作者观点」「推演」两种 |
| 前提/假设、反例/边界排版散乱 | 假设用左右两栏、反例用 inline tag | 前提/假设两行置顶、反例/边界用同款 `.prem-row` 行样式 |
| 三字标签把行动建议拆碎 | 渲染了「何时/做法/到位」字样 | `actions[].t` 用全角 `｜` 存三段，渲染时 `join('，')` 成自然句 |
| 洞察板块不够醒目 / 下划线跑全文 | 洞察字号与其它正文一致、`.hl` 全局加下划线 | 洞察标题 37px、观点 32px，`<b>` 加粗+下划线仅此板块；正文一律无下划线 |
| 金句版式漂移 | 试改版加双横线/独立功能键行 | 回 V12：33px 单上横线、出处 20px、无独立功能键行；按键提示在左下角 |
| 支撑页码字号与正文混在一起 | 页码直接拼在 support 文本里 | `splitPage()` 把句末 `章节 Pn` 拆成独立 `.pg`（13px），与行动建议一致 |
| 作者名与章节粘在一起 | 顶栏 `.book-author` 未加粗、无间距 | 作者 17px 加粗，后接两个全角空格再接章节 |

**v14 巡检必查**：`actionHidden=0`、作者项全部置顶、`bodyUnderline=0` 且洞察下划线>0、`premChipH=actChipH`、`supPgFont=actPgFont=13px`、`quoteFont=33px` 且 `quoteBorders=1px/0px`、`coverLede` 为短句、`actionTopPad=22px`。

## 六、v18 密度自适应与页码统一坑（2026-11-19 实战）

| 现象 | 真凶 | 修法（生成器已内置） |
| --- | --- | --- |
| 内容稀疏的页正文压得太紧、字号偏小；行动建议下方到金句之间一大块空白 | `fitBody()` 字号档锁死 `[21,20,19]`，且四块列表 padding 固定 4/6px，稀疏页内容贴顶、底部空出 180–247px | 两阶段自适应：①字号档扩为 `[24,23,22,21,20,19]` 取最大可用；②`--body-gap` 从 4px 递增到 22px 吃空白，密页停 4px、疏页放宽。CSS 四处 `li` padding 统一用 `var(--body-gap)` |
| 用 `.cols` 容器底做金句碰撞检测，永远误判「有空白」或「压金句」 | `.cols` 是 `flex:1 1 auto` 撑满剩余高度，`getBoundingClientRect().bottom` 恒等于金句上沿附近，反映不了内容真实底 | `fitBody()` 改用「正文真实底」：遍历 `.logic-list/.support-list/.action-list` 的所有 `li`，取最靠下的 `bottom` |
| 支撑依据的页码 `P16` 是正文大字号（如 21px），行动建议页码却是 13px，同稿忽大忽小 | `splitPage()` 旧正则 `(\S+\s+P\d+)` 要求页码前有一个无空格词；中文整句无空格 → 匹配失败，页码留在正文 txt 里按 `--body-fs` 渲染 | 正则改为句末 token `^([\s\S]*?)\s+(P\d+(?:[-\u2013\u2014~]\d+)?)\s*$`；反例/边界 `counter.t` 也必须走 `splitPage()` 拆 `.pg` |
| 中文整句被 `splitPage` 从中间切开（如「作者学法语：从英语环境… P20」被拆成正文「作者+英文」+页码） | `\S+` 贪婪吞掉整段中文 | 同上：用非贪婪前缀 + 句末页码锚点，页码前不再要求 `\S+` |

**v18 巡检必查**：`--body-fs` 由密度决定（结构统一的书同档正常，用「注入长文→该页降档」对照测试验证机制）、`--body-gap>4px` 页占比合理、每页「正文真实底→金句」无 >120px 大留白、`.support-list .pg`/`.action-list .pg`/`.counter .pg` 三处字号全为 13px。

## 七、v21 四层判断逻辑与分层 chip 坑（2026-11-19 实战）

| 现象 | 真凶 | 修法（已内置） |
| --- | --- | --- |
| 观点条数忽多忽少（20 多 vs 50 多），无法解释 | 旧逻辑按章节切，结构单元粒度全凭临场判断；下限只管地板不管天花板 | v21 四层升级闸：入口分流→逻辑单元准入四问→分层结网→密度校验；条数退为参考值，用论点覆盖率/原理层占比/连接度衡量 |
| 同一主旨被拆成多条、出现纯断言凑数 | 章节是文法单位不是逻辑单位；无准入标准 | 准入四问（独立性/非同义/可检验/有边界），同义强制合并到 `support`，纯断言与关键词堆砌剔除 |
| 分层 chip 与右上角音乐开关重叠 | 初版把 chip 放进顶栏 `.tb-right` 空槽，而音乐开关固定在右上 | chip 内联到 `<h2 class="idea-title">` 末尾（标题右上角），顶栏右槽恢复空；`build_deck.js` 原生渲染，`theme.css` 定义 `.idea-title .layer-chip` |
| 新增 level/links 字段后旧 data.json 重出失败 | 校验器对新字段强制 error，历史数据无此字段 | 兼容策略：level 有则校验枚举、无则 WARN；links 有则查空、无则 WARN；密度指标仅 WARN 不影响 PASS；生成器对无 level 数据不渲染 chip |

**v21 巡检必查**：`level` 四层枚举合法、每条有 `links`、层次分布不极端偏一层、连接度过半、`layer-chip` 在标题内且不与音乐重叠、`title` 属性含结网文本；用新数据（含 level）与旧数据（无 level）各跑一次 validate 确认兼容。

## 八、v23 跨 AI 平台 IMA 接口形态坑（2026-11-19 实战）

| 现象 | 真凶 | 修法（见 `references/ima-adapter.md`） |
| --- | --- | --- |
| 在 A 态平台（WorkBuddy MCP）按裸 HTTP 写法传 `media_type`/`title`/`file_info`，报 `must NOT have additional properties` | 宿主 MCP 工具的 schema 是 `additionalProperties:false`，只认 `duplicate_name_strategy`/`folder_id`/`media_id`/`knowledge_base_id` | 入库前先读 `add_knowledge` 的 schema 判形态；A 态只传 `duplicate_name_strategy`，绝不传 B 态字段 |
| 在 B 态平台（千问 raw_call）沿用 `duplicate_name_strategy`，报 `参数错误 110001` | 原生 OpenAPI 无此字段，必填 `media_type=7`/`title`（含扩展名）/`file_info` | B 态按官方原始字段构造 body；删 `duplicate_name_strategy`；`title` 必须与含扩展名的 `file_name` 完全一致 |
| create_media 后 PUT 403 | ①file_size 与实际字节数不一致（签名头 Content-Length 锁定该值）；②A 态漏 `x-cos-acl: private`；③B 态漏 `Authorization` 或 `x-cos-security-token` | file_size 用实际字节数；A 态原样带 `auth_headers`；B 态按 COS v5 签名算法生成 `Authorization` 并带 token 头 |
| COS v5 签名算错导致 PUT 403 | `HttpString` 格式或 header-list 参与签名方式不对 | 用 adapter 第 5 节实测通过的最小版：`HttpString = "put\n/{cos_key}\n\n\n"`、header-list 为空、`SignKey=HMAC-SHA1(secret_key,"start;expired")` |
| 同一 media_id 再次 add 报 `invalid media_id` | media_id 是一次性的，不能复用 | 每次入库重新 create_media 拿新 media_id |

**v23 巡检必查**：任何 IMA 入库前确认已按适配器第二节判形态；A 态 add 无 B 字段、B 态 add 无 `duplicate_name_strategy` 且 `title` 含扩展名；两态均验证 `file_size=实际字节数`；入库后走验证闭环。跨端新增平台（如豆包）若形态不符，按适配器第六节「未知形态处理」停止并报告，不要猜。
