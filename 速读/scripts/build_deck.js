#!/usr/bin/env node
/* ============================================================
   速读 · 通用演示稿生成器 (Node.js, 零依赖)
   输入: 清洗后的 JSON 数据 + assets/theme.css + 可选音乐
   输出: 单文件 HTML (1920x1080 固定舞台 / Cobalt Grid 风格)
   用法:
     node build_deck.js data.json output.html
     node build_deck.js data.json output.html --music /path/to.mp3
     node build_deck.js data.json output.html --orientation portrait
   --orientation: landscape(默认, A/D 翻页) | portrait(W/S 上下切换)
     横版只定义 A/D，不定义 W/S；竖版只定义 W/S，不定义 A/D。
   music-mode: embed(默认, 单文件离线) | link(相邻文件路径) | none
   ============================================================ */
const fs = require('fs');
const path = require('path');

const [, , DATA_PATH, OUT_PATH, ...FLAGS] = process.argv;
if (!DATA_PATH || !OUT_PATH) {
  console.error('用法: node build_deck.js <data.json> <output.html> [--music path] [--music-mode embed|link|none]');
  process.exit(1);
}

const SKILL_DIR = path.resolve(__dirname, '..');
const flag = (name, def) => {
  const i = FLAGS.indexOf(name);
  return i >= 0 ? (FLAGS[i + 1] || '') : def;
};
const musicMode = flag('--music-mode', 'embed');
const musicPath = flag('--music', path.join(SKILL_DIR, 'assets', 'default-music.mp3'));
const orientation = flag('--orientation', 'landscape');   // landscape=A/D, portrait=W/S
const isPortrait = orientation === 'portrait';
const NAV_HINT = isPortrait
  ? 'W 上切 · S 下切 · T 目录 · F 全屏 · G 音乐 · H 灯光'
  : 'A 上一张 · D 下一张 · T 目录 · F 全屏 · G 音乐 · H 灯光';
/* 只注入当前版式的翻页键代码：横版无 W/S，竖版无 A/D */
const KEY_BRANCH = isPortrait
  ? `        if (k === 'w' || k === 'W') { e.preventDefault(); this.prev(); return; }
        if (k === 's' || k === 'S') { e.preventDefault(); this.next(); return; }`
  : `        if (k === 'a' || k === 'A') { e.preventDefault(); this.prev(); return; }
        if (k === 'd' || k === 'D') { e.preventDefault(); this.next(); return; }`;

const D = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const meta = D.meta || {};
const docs = D.docs || [];
const insights = D.insights || [];
const closing = D.closing || {};
const ALL_IDEAS = docs.flatMap(doc => doc.ideas || []);
const TOTAL = ALL_IDEAS.length;

/* ---------- 工具 ---------- */
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pad = (n, len = 2) => String(n).padStart(len, '0');
/* v39 规则：书名用原书书名，剥掉括号后缀 */
const pureBookName = n => String(n == null ? '' : n).replace(/[（(][^）)]*[）)]/g, '').trim();

/* 页码统一：括号 + 书页/PDF/PAGE 一律压成 P16 / P6-7，不加括号 */
function fmtPage(s) {
  return String(s == null ? '' : s)
    .replace(/[（(]\s*书页\s*([\d\-–~]+)\s*[·・]?\s*(?:PDF\s*)?PAGE\s*([\d\-–~]+)\s*[）)]/gi, 'P$2')
    .replace(/[（(]\s*(?:PDF\s*)?PAGE\s*([\d\-–~]+)\s*[）)]/gi, 'P$1')
    .replace(/[（(]\s*书页\s*([\d\-–~]+)\s*[）)]/g, 'P$1')
    .replace(/书页\s*[\d\-–~]+\s*[·・]?\s*(?:PDF\s*)?PAGE\s*([\d\-–~]+)/gi, 'P$1')
    .replace(/\bPAGE\s*([\d\-–~]+)/gi, 'P$1')
    .replace(/书页\s*([\d\-–~]+)/g, 'P$1')
    .replace(/\s*[·・]\s*(?=P[\d])/g, ' ');
}

/* 右下角出处：章节名 + 书页页码（无书页则用 PAGE），如「规则3 P6-7」 */
function srcLabel(src) {
  const s = String(src == null ? '' : src).trim();
  if (!s) return '';
  const book = s.match(/书页\s*([\d\-–~]+)/);
  const pdf = s.match(/PAGE\s*([\d\-–~]+)/i);
  const num = book ? book[1] : (pdf ? pdf[1] : '');
  const label = s.split(/[·・]/)[0]
    .replace(/书页\s*[\d\-–~]+/g, '')
    .replace(/(?:PDF\s*)?PAGE\s*[\d\-–~]+/gi, '')
    .trim();
  return fmtPage(num ? `${label} P${num}` : label);
}

/* 标题按字数分档，最多两行不溢出 */function titleClass(t) {
  const n = String(t).length;
  if (n <= 24) return 's1';
  if (n <= 30) return 's2';
  if (n <= 36) return 's3';
  return 's4';
}

/* 封面标题按字数分档，防止长标题单行溢出 */
function coverTitleClass(t) {
  const n = String(t).length;
  if (n <= 10) return 'c1';
  if (n <= 18) return 'c2';
  if (n <= 26) return 'c3';
  return 'c4';
}
const nl2br = s => esc(s).replace(/\n/g, '<br>');

/* 观点页使用 theme.css 中的固定字号（定稿 v3），不再按文本量自适应 */

/* 像素故障列 SVG */
function glitchSVG(seed, h, w) {
  let r = seed * 9301 + 49297;
  const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  let rects = '', y = 0;
  while (y < h) {
    const step = 8 + Math.floor(rnd() * 26);
    const wRatio = 0.35 + rnd() * 0.65;
    const x = Math.floor(rnd() * (1 - wRatio) * w);
    const rw = Math.floor(w * wRatio);
    const th = 3 + Math.floor(rnd() * 9);
    const op = (0.35 + rnd() * 0.55).toFixed(2);
    rects += `<rect x="${x}" y="${y}" width="${rw}" height="${th}" opacity="${op}"/>`;
    y += step;
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><g fill="#1F2BE0">${rects}</g></svg>`;
}

/* 二维码式网格块 */
function qrSVG(seed) {
  let r = seed * 7919 + 13;
  const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  let cells = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (rnd() > 0.52) cells += `<rect x="${x * 14}" y="${y * 14}" width="12" height="12"/>`;
  const eye = (x, y) => `<rect x="${x}" y="${y}" width="28" height="28"/><rect x="${x + 6}" y="${y + 6}" width="16" height="16" fill="#F0EBDE"/><rect x="${x + 10}" y="${y + 10}" width="8" height="8"/>`;
  return `<svg width="118" height="118" viewBox="0 0 118 118" xmlns="http://www.w3.org/2000/svg"><g fill="#1F2BE0">${cells}${eye(0, 0)}${eye(88, 0)}${eye(0, 88)}</g></svg>`;
}

/* ---------- 页面收集 + 索引映射 ---------- */
const PAGE = [];
const pageMap = [];   // {kind, ...} 与 PAGE 一一对应，供目录/洞察跳转
let pageNo = 0;
function slide(cls, inner, opts = {}) {
  pageNo++;
  const pn = pad(pageNo);
  return `<section class="slide ${cls}" data-page="${pageNo}">
${opts.glitch ? `<div class="glitch">${glitchSVG(opts.glitchSeed || 3, opts.glitchH || 640, opts.glitchW || 250)}</div>` : ''}
${opts.qr ? `<div class="qr">${qrSVG(opts.qrSeed || 5)}</div>` : ''}
${opts.watermark || ''}
<div class="hairline-top"></div><div class="hairline-bot"></div>
<div class="frame">${inner}</div>
<div class="page-num">${pn}<span> / __TOTAL_PAGES__</span></div>
<div class="nav-hint">${NAV_HINT}</div>
</section>`;
}
function add(cls, inner, opts, mapInfo) { PAGE.push(slide(cls, inner, opts)); pageMap.push(mapInfo || { kind: cls }); }

/* ---------- 1. 封面（必备页：单文档也要封面，版式同双书封面） ---------- */
let docIdx = 0;
/* 封面副行（原 lede 位）固定显示作者及国别：authorDisplay 优先，回退 author；多文档用 · 连接 */
const coverAuthor = docs.map(d => (d.authorDisplay || d.author || '').trim()).filter(Boolean).join(' · ');
add('cover', `
<div class="cover-kicker reveal r1">${esc(meta.kicker || `NO. 001 — ${pad(TOTAL, 3)} / 速读精读`)}</div>
<div style="align-self:center">
  <h1 class="cover-title ${coverTitleClass(meta.title || '')} reveal r3">${nl2br(meta.title || '速读精读')}<span class="en"><i>${esc(meta.subtitle || '')}</i></span></h1>
  <p class="cover-lede reveal r4">${esc(coverAuthor)}</p>
</div>
<div class="index-bar reveal r7">
  ${(meta.stats || docs.map(d => ({ k: 'SCOPE', v: `${(d.ideas || []).length} 条观点` }))).map(s =>
    `<div class="cell"><div class="k">${esc(s.k)}</div><div class="v">${esc(s.v)}</div></div>`).join('')}
</div>
`, { glitch: true, glitchSeed: 7, glitchH: 640, glitchW: 250, qr: true, qrSeed: 11, watermark: meta.watermark ? `<svg class="wm reveal r6" width="360" height="320" viewBox="0 0 360 320" xmlns="http://www.w3.org/2000/svg"><text x="180" y="290" text-anchor="middle" font-family="DM Mono, monospace" font-size="300" font-weight="500" fill="none" stroke="rgba(31,43,224,0.16)" stroke-width="2">${esc(meta.watermark)}</text></svg>` : '' });

/* ---------- 2. 多文档对照页 ---------- */
if (docs.length > 1) {
  add('contrast', `
<div class="topbar reveal r1"><div class="tb-left"><span class="tb-tag">READING MAP</span><span class="tb-title">${esc(meta.mapTitle || '文档对照')}</span></div>
<div class="tb-right"><span class="tb-tag">${esc(meta.mapTag || 'SPEED READ')}</span></div></div>
<div class="compare" style="margin-top:40px">${docs.map((d, i) => `
  <div class="side reveal r${i === 0 ? 2 : 4}">
    <div class="booktag">DOC ${pad(i + 1)}</div>
    <h3>${esc(d.name)}</h3>
    <div class="full">${esc(d.author || '')}</div>
    <div class="claim">${esc(d.claim || '')}</div>
    <ul>${(d.highlights || []).slice(0, 5).map((h, j) => `<li><b>${pad(j + 1)}</b><span>${esc(h)}</span></li>`).join('')}</ul>
    <div class="stat"><div><div class="n">${(d.ideas || []).length}</div><div class="l">核心观点</div></div><div><div class="n">${d.chapters || (d.ideas || []).length}</div><div class="l">覆盖章节</div></div></div>
  </div>`).join('')}</div>
`, { kind: 'contrast' });
}

/* ---------- 3. 目录（自动分页：每页 30 行，左列填满 15 再放右列，全部可点不裁切） ---------- */
const TOC_ROWS_PER_PAGE = 30;  // 定稿 v3：两栏各最多 15 行，先左后右
const TOC_COLS = 2;
const TOC_PER_COL = 15;
const tocEntries = docs.flatMap((d, di) => (d.ideas || []).map(v => ({ d, di, v })));
const tocIndex = PAGE.length;   // T 键跳到目录首页
{
  const tocTotalPages = Math.max(1, Math.ceil(tocEntries.length / TOC_ROWS_PER_PAGE));
  for (let p = 0; p < tocTotalPages; p++) {
    const chunk = tocEntries.slice(p * TOC_ROWS_PER_PAGE, (p + 1) * TOC_ROWS_PER_PAGE);
    const cols = [];
    for (let c = 0; c < TOC_COLS; c++) {
      const rows = chunk.slice(c * TOC_PER_COL, (c + 1) * TOC_PER_COL);
      if (!rows.length) continue;
      let colHtml = `<div class="toc-col">`;
      rows.forEach(({ d, di, v }) => {
        /* 目录 v3：不再生成分组头（.toc-group），直接从第 1 行起排 */
        colHtml += `<div class="toc-row"><div class="n">${pad(v.no)}.</div><div class="t">${esc(v.title)}<em>${esc(String(v.chap || '').split('·')[0].trim())}</em></div></div>`;
      });
      cols.push(colHtml + `</div>`);
    }
    let docName = (docs[0] && docs[0].name) ? String(docs[0].name).trim() : '';
    if (docName && !/^[《<]/.test(docName)) docName = `《${docName}》`;
    const tocTitle = docName ? `${esc(docName)} · ` : '';
    add('toc', `
<div class="topbar reveal r1"><div class="tb-left"><span class="tb-tag">CONTENTS</span><span class="tb-title">${tocTitle}全部 ${TOTAL} 条观点 · 第 ${p + 1}/${tocTotalPages} 页</span></div>
<div class="tb-right"><span class="tb-tag">点击可跳转</span></div></div>
<div class="toc-grid" style="margin-top:26px">${cols.join('')}</div>
`, { kind: 'toc' });
  }
}

/* ---------- 每份文档:扉页 + 观点页 ---------- */
docs.forEach((doc, di) => {
  add('chapter', `
<div style="align-self:center">
  <div class="chapter-no reveal r1">${pad(di + 1)}</div>
  <h2 class="chapter-title reveal r3">${esc(pureBookName(doc.name))}<span class="en">${esc(doc.en || '')}</span></h2>
</div>
<div class="chapter-meta reveal r6">
  ${(doc.meta || [
    { n: doc.chapters || (doc.ideas || []).length, l: '覆盖章节' },
    { n: (doc.ideas || []).length, l: '核心观点' },
    { n: doc.pages || '—', l: '原文字数/页数' }
  ]).map(m => `<div><div class="n">${esc(m.n)}</div><div class="l">${esc(m.l)}</div></div>`).join('')}
</div>
`, { glitch: true, glitchSeed: 21 + di * 21, glitchH: 1080, glitchW: 150 }, { kind: 'chapter', doc: di });

  /* 观点页 v3 —— 顶栏 + 核心论点 + 左(推演逻辑含前提假设) + 右(支撑含反例边界 + 行动) + V12 金句 */
  (doc.ideas || []).forEach(v => {
    const logicHtml = (v.logic || []).map((s, i) => {
      const isConcl = /^推论/.test(s);
      const txt = s.replace(/^推论[：:]\s*/, '');
      return `<li class="${isConcl ? 'concl' : ''}"><div class="step">${pad(i + 1)}</div><div class="txt">${esc(txt)}</div></li>`;
    }).join('');

    /* 前提 / 假设置顶：原文标作者观点，非原文标推演 */
    const premRow = (label, arr) => {
      if (!arr || !arr.length) return '';
      const items = arr.map(x => {
        const author = x.origin === '原文';
        const chip = `<span class="src-chip ${author ? 'author' : 'theory'}">${author ? '作者观点' : '推演'}</span>`;
        return `<span class="prem-item">${esc(x.t)}${chip}</span>`;
      }).join('');
      return `<div class="prem-row"><span class="plabel">${label}</span><span class="ptexts">${items}</span></div>`;
    };
    const premiseHtml = v.premise
      ? premRow('前提', v.premise.premise) + premRow('假设', v.premise.assumption)
      : '';

    /* 支撑依据：反例/边界 —— 沿用前提/假设行样式，句末标作者观点/推演 */
    /* 页码拆分统一走句末 P\d token：中文整句无空格，不能用 \S+ 锚定前一个词 */
    const splitPage = (s) => {
      const raw = fmtPage(String(s == null ? '' : s)).trim();
      const m = raw.match(/^([\s\S]*?)\s+(P\d+(?:[-\u2013\u2014~]\d+)?)\s*$/);
      return m ? { text: m[1], page: m[2] } : { text: raw, page: '' };
    };
    const pgSpan = (p) => p ? `<span class="pg">${esc(p)}</span>` : '';
    const supHtml = (v.support || []).map(s => {
      const sp = splitPage(s);
      return `<li><div class="mark"></div><div class="txt">${esc(sp.text)}${pgSpan(sp.page)}</div></li>`;
    }).join('')
      + (v.counter ? (() => {
          const c = v.counter;
          const author = c.origin === '原文';
          const chip = `<span class="src-chip ${author ? 'author' : 'theory'}">${author ? '作者观点' : '推演'}</span>`;
          /* v38：剥离文本里已有的前缀/后缀，避免与 plabel/chip 重复 */
          let raw = String(c.t == null ? '' : c.t);
          raw = raw.replace(/^(边界|反例)[：:]\s*/, '').replace(/[\[【](推演|原文)[\]】]\s*$/, '').trim();
          const sp = splitPage(raw);
          return `<li class="counter"><div class="txt"><div class="prem-row cb-row"><span class="plabel">${esc(c.kind || '边界')}</span><span class="ptexts">${esc(sp.text)}${pgSpan(sp.page)}${chip}</span></div></div></li>`;
        })() : '');

    /* 行动建议：作者观点优先置顶，推演建议按数据权重顺序后置；三段式语义连成一句自然话 */
    const sortedActions = (v.actions || []).slice().sort((a, b) => (a.k === 'author' ? 0 : 1) - (b.k === 'author' ? 0 : 1));
    const actHtml = sortedActions.map(a => {
      const author = a.k === 'author';
      const chip = `<span class="src-chip ${author ? 'author' : 'theory'}">${author ? '作者观点' : '推演'}</span>`;
      const pg = a.p ? `<span class="pg">${esc(fmtPage(a.p))}</span>` : '';
      let text = String(a.t == null ? '' : a.t);
      const parts = text.split('｜');
      if (parts.length >= 3) text = parts.join('，');   // 三层语义保留，去掉标签字样
      return `<li class="${author ? 'author' : 'theory'}"><div class="mark${author ? '' : ' theory'}"></div><div class="txt">${esc(text)}${chip}${pg}</div></li>`;
    }).join('');
    const bookAuthor = doc.authorDisplay || doc.author || '';
    const srcShort = srcLabel(v.src);
    /* v21 分层 chip：内联在标题末尾（右上角），悬停显示结网关系；旧数据无 level 时不渲染 */
    const LEVEL_CLASS = { '哲学视角': 'L-philosophy', '学科原理': 'L-principle', '方法流程': 'L-method', '经验技巧': 'L-tactic' };
    const levelChip = v.level
      ? `<span class="layer-chip ${LEVEL_CLASS[v.level] || ''}"${v.links ? ` title="${esc(v.links)}"` : ''}>${esc(v.level)}</span>`
      : '';
    add('slide-idea', `
<div class="topbar reveal r1"><div class="tb-left"><span class="no-chip">NO.${pad(v.no)}</span><span class="book-name">《${esc(pureBookName(doc.name))}》</span><span class="book-author">${esc(bookAuthor)}</span><span class="tb-chap">　　${esc(String(v.chap || '').replace(/^[◆◇·][^｜|]*[｜|]\s*/, ''))}</span></div>
<div class="tb-right"></div></div>
<h2 class="idea-title ${titleClass(v.title)} reveal r2">${esc(v.title)}${levelChip}</h2>
<div class="cols reveal r3">
  <div class="col left-col"><div class="block reasoning"><div class="col-head"><span class="cn">推演逻辑</span><span class="en">REASONING</span></div>
    ${premiseHtml}
    <ul class="logic-list">${logicHtml}</ul></div></div>
  <div class="col right-col">
    <div class="block evidence"><div class="col-head"><span class="cn">支撑依据</span><span class="en">EVIDENCE</span></div><ul class="support-list">${supHtml}</ul></div>
    <div class="block action"><div class="col-head"><span class="cn">行动建议</span><span class="en">ACTION</span></div><ul class="action-list">${actHtml}</ul></div>
  </div>
</div>
<div class="quote-row reveal r4"><div class="qs"><div class="q q1"><span class="qm open">“</span>${esc(v.quote)}<span class="qm close">”</span></div></div><div class="src">${esc(srcShort)}</div></div>
`, {}, { kind: 'idea', doc: di, no: v.no });
  });
});

/* ---------- 洞察页 ---------- */
if (insights.length) {
  const groups = [...new Set(insights.map(i => i.group))];
  groups.forEach(g => {
    const list = insights.filter(i => i.group === g).slice(0, 7);  // 一页最多 7 条，数据已按反常识权重排序
    const label = list[0].label || '反常识洞察';
    add('insight', `
<div class="topbar reveal r1"><div class="tb-left"><span class="tb-tag">INSIGHT</span><span class="tb-title">${esc(label)}</span></div>
<div class="tb-right"><span class="tb-tag">COUNTER-INTUITIVE</span></div></div>
<div class="insight-list">${list.map((it, i) => `<div class="insight-item reveal" style="transition-delay:${(0.2 + i * 0.1).toFixed(2)}s">
  <div class="n">${pad(it.n)}</div><div class="t">${it.text}</div></div>`).join('')}</div>
`, { kind: 'insight', group: g });
  });
}

/* ---------- 结语 ---------- */
if (closing.title || closing.lede) {
  /* 尾页 credits 第 4 格为固定创作者标识：旧 data.json 复用时自动补齐，已有 CREATOR 则不覆盖 */
  const CREDIT_CREATOR = { k: 'CREATOR', v: 'Skill制作者：况达FDE' };
  const creditsOut = Array.isArray(closing.credits) ? closing.credits.slice() : [];
  if (!creditsOut.some(c => c && String(c.k).toUpperCase() === 'CREATOR')) creditsOut.push(CREDIT_CREATOR);
  add('colophon', `
<div class="colophon-inner">
  <div class="colophon-kicker reveal r1">${esc(closing.kicker || 'CLOSING')}</div>
  <h2 class="reveal r3">${closing.title || '速读之后'}</h2>
  <p class="lede reveal r5">${closing.lede || ''}</p>
</div>
<div class="credits reveal r7">${creditsOut.map(c => `<div><div class="k">${esc(c.k)}</div><div class="v">${esc(c.v)}</div></div>`).join('')}</div>
`, { glitch: true, glitchSeed: 77, glitchH: 1080, glitchW: 130 }, { kind: 'colophon' });
}

/* ---------- 目录跳转映射 ---------- */
const ideaPageIndices = {};
pageMap.forEach((m, i) => { if (m.kind === 'idea') ideaPageIndices[`${m.doc}-${m.no}`] = i; });
const tocOrder = docs.flatMap((d, di) => (d.ideas || []).map(v => ideaPageIndices[`${di}-${v.no}`]));
const insightOrder = pageMap.map((m, i) => m.kind === 'insight' ? i : -1).filter(i => i >= 0);

/* ---------- 音乐 ---------- */
let musicCss = '', musicHtml = '', audioVar = 'null';
if (musicMode !== 'none' && fs.existsSync(musicPath)) {
  let src = musicPath;
  if (musicMode === 'embed') {
    const b64 = fs.readFileSync(musicPath).toString('base64');
    const mime = /\.ogg$/i.test(musicPath) ? 'audio/ogg' : /\.wav$/i.test(musicPath) ? 'audio/wav' : 'audio/mpeg';
    src = `data:${mime};base64,${b64}`;
  }
  audioVar = JSON.stringify(src);
  musicCss = `
.music-toggle{
  position:fixed; top:18px; right:18px; z-index:10002;
  height:40px; padding:0 14px; display:flex; align-items:center; gap:8px;
  border:1.5px solid var(--ink); background:var(--paper); color:var(--ink);
  font-family:var(--f-mono); font-size:14px; letter-spacing:.04em; cursor:pointer;
  transition:background .2s,color .2s;
}
.music-toggle:hover,.music-toggle.playing{ background:var(--ink); color:var(--paper); }
.music-toggle .ico{ font-size:15px; line-height:1; }
`;
  musicHtml = `<button class="music-toggle" id="musicToggle" title="播放/关闭背景音乐 (G)"><span class="ico" id="musicIco">G</span><span id="musicTxt">MUSIC OFF</span></button>`;
} else if (musicMode !== 'none') {
  console.warn('音乐文件不存在，已跳过:', musicPath);
}

/* ---------- 灯光开关 H（速读版 v48 新增，与深读/多重版一致） ---------- */
const lightsCss = `
.lights-toggle{
  position:fixed; top:18px; right:${musicMode !== 'none' ? '160px' : '18px'}; z-index:10002;
  height:40px; padding:0 14px; display:flex; align-items:center; gap:8px;
  border:1.5px solid var(--ink); background:var(--paper); color:var(--ink);
  font-family:var(--f-mono); font-size:14px; letter-spacing:.04em; cursor:pointer;
  transition:background .2s,color .2s;
}
.lights-toggle:hover,.lights-toggle.on{ background:var(--ink); color:var(--paper); }
.lights-toggle .ico{ font-size:15px; line-height:1; }
body.lights-off{ --paper:#121316; --paper-2:#1b1c20; --ink:#c9cfe0; --ink-soft:#8f96a8; --grid:rgba(190,190,205,.075); --ink-faint:rgba(190,190,205,.18); --slide-bg:#121316; }
body.lights-off .slide::after{ background:radial-gradient(ellipse 70% 60% at 50% 45%, rgba(120,110,190,.10), transparent 70%); }
body.lights-off .music-toggle,body.lights-off .lights-toggle{ background:#121316; color:#c9cfe0; border-color:#c9cfe0; }
`;
const lightsHtml = `<button class="lights-toggle" id="lightsToggle" title="灯光开关 (H)"><span class="ico">H</span><span id="lightsTxt">LIGHT ON</span></button>`;

/* ---------- 组装 ---------- */
const themeCss = fs.readFileSync(path.join(SKILL_DIR, 'assets', 'theme.css'), 'utf8');
const fontLink = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Hanken+Grotesk:wght@400;600;700&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;1,6..72,300;1,6..72,400&family=Noto+Sans+SC:wght@400;700;900&family=Noto+Serif+SC:wght@400;600;700;900&display=swap';

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(meta.title || '速读演示稿')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${fontLink}" rel="stylesheet" media="print" onload="this.media='all'"><noscript><link href="${fontLink}" rel="stylesheet"></noscript>   <!-- v55 PERF: 字体非阻塞，file://离线不卡DCL -->
<style>
${themeCss}
${musicCss}
${lightsCss}
</style>
</head>
<body>
${lightsHtml}
${musicHtml}
<div class="deck-viewport">
  <main class="deck-stage" id="deckStage">
${PAGE.join('\n')}
  </main>
</div>
<script>
const TOC_ORDER = ${JSON.stringify(tocOrder)};
const INSIGHT_ORDER = ${JSON.stringify(insightOrder)};
const TOC_INDEX = ${tocIndex};
const AUDIO_SRC = ${audioVar};

/* 固定 1920x1080 舞台，整体等比缩放，不按设备重排 */
class SlidePresentation {
  constructor() {
    this.slides = Array.from(document.querySelectorAll('.slide'));
    this.current = 0; this.stage = document.getElementById('deckStage');
    this.setupStageScale(); this.setupKeyboard(); this.setupTouch(); this.setupWheel(); this.buildNav(); this.show(0);
  }
  setupStageScale() {
    const scale = () => {
      const f = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      const x = (window.innerWidth - 1920 * f) / 2, y = (window.innerHeight - 1080 * f) / 2;
      this.stage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + f + ')';
    };
    scale(); window.addEventListener('resize', scale);
  }
  setupKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.target.getAttribute && e.target.getAttribute('contenteditable') === 'true') return;
      const k = e.key;
      /* 翻页键按版式注入，两者互斥不混用 */
${KEY_BRANCH}
      switch (k) {
        case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown': e.preventDefault(); this.next(); break;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': e.preventDefault(); this.prev(); break;
        case 'Home': e.preventDefault(); this.show(0); break;
        case 'End': e.preventDefault(); this.show(this.slides.length - 1); break;
        case 't': case 'T': e.preventDefault(); this.show(TOC_INDEX); break;
        case 'f': case 'F': document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); break;
        case 'g': case 'G': window.music && window.music.toggle(); break;
        case 'h': case 'H': window.lights && window.lights.toggle(); break;
      }
    });
  }
  setupTouch() {
    let x0 = null, y0 = null;
    document.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    document.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) dx < 0 ? this.next() : this.prev();
      x0 = null; y0 = null;
    }, { passive: true });
  }
  setupWheel() {
    let lock = false;
    document.addEventListener('wheel', e => {
      if (lock || Math.abs(e.deltaY) < 18) return;
      lock = true; e.deltaY > 0 ? this.next() : this.prev();
      setTimeout(() => { lock = false; }, 480);
    }, { passive: true });
  }
  buildNav() {
    document.querySelectorAll('.toc-row').forEach((row, i) => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => this.show(TOC_ORDER[i]));
    });
    document.querySelectorAll('.insight-item').forEach((row, i) => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => this.show(INSIGHT_ORDER[i]));
    });
  }
  next() { this.show(this.current + 1); }
  prev() { this.show(this.current - 1); }
  show(i) {
    this.current = Math.max(0, Math.min(i, this.slides.length - 1));
    this.slides.forEach((s, k) => { s.classList.toggle('active', k === this.current); s.classList.toggle('visible', k === this.current); });
    history.replaceState(null, '', '#' + (this.current + 1));
  }
}
window.deck = new SlidePresentation();
(function(){ const n = parseInt(location.hash.replace('#',''), 10); if (n >= 1 && n <= window.deck.slides.length) window.deck.show(n - 1); })();

/* 音乐开关：默认关闭，用户点击后才播放（规避浏览器自动播放限制） */
class MusicPlayer {
  constructor() {
    this.btn = document.getElementById('musicToggle');
    if (!this.btn || !AUDIO_SRC) return;
    this.audio = new Audio(AUDIO_SRC);
    this.audio.loop = true; this.audio.volume = 0.35; this.playing = false;
    this.ico = document.getElementById('musicIco'); this.txt = document.getElementById('musicTxt');
    this.btn.addEventListener('click', () => this.toggle());
  }
  toggle() {
    if (this.playing) { this.audio.pause(); this.playing = false; }
    else { this.audio.play().catch(() => {}); this.playing = true; }
    this.btn.classList.toggle('playing', this.playing);
    this.ico.textContent = 'G';
    this.txt.textContent = this.playing ? 'MUSIC ON' : 'MUSIC OFF';
  }
}
window.music = new MusicPlayer();

/* 正文自适应（内容密度驱动）：稀疏页字号更大、行距更松；密集页字号更小、更紧凑。
   两阶段：① 字号在 24/23/22/21/20/19 中取最大可用档；② 用 --body-gap 吃掉正文底到金句的空白，
   令内容自然铺满、消除金句前的大留白。绝不隐藏条目、不压金句、不溢出舞台。 */
function fitBody() {
  document.querySelectorAll('.slide-idea').forEach(slide => {
    const cols = slide.querySelector('.cols');
    const quote = slide.querySelector('.quote-row');
    if (!cols || !quote) return;
    cols.style.setProperty('--body-fs', '');
    cols.style.setProperty('--body-gap', '4px');

    // 正文真实底：取所有列表末项里最靠下的那条，而非 cols 容器底（容器 flex 撑满）
    const contentBottom = () => {
      let b = 0;
      cols.querySelectorAll('.logic-list li, .support-list li, .action-list li').forEach(li => {
        const r = li.getBoundingClientRect();
        if (r.height > 0 && r.bottom > b) b = r.bottom;
      });
      return b;
    };
    const fits = () => {
      const cb = cols.getBoundingClientRect(), qb = quote.getBoundingClientRect();
      const overCols = cols.scrollHeight > cols.clientHeight + 2;
      const hitQuote = contentBottom() > qb.top + 2 || cb.bottom > qb.top + 2;
      return !overCols && !hitQuote;
    };

    // ① 字号：从大到小取第一个不溢出的档位
    let chosen = 19;
    for (const fs of [24, 23, 22, 21, 20, 19]) {
      cols.style.setProperty('--body-fs', fs + 'px');
      if (fits()) { chosen = fs; break; }
    }
    cols.style.setProperty('--body-fs', chosen + 'px');

    // ② 间距：在最小可用字号下，把每条 padding 从 4px 逐步放大，吃金句前空白；
    //    一旦命中金句/溢出即回退到上一档。密集页自然停在 4px，稀疏页变松弛。
    let chosenGap = 4;
    for (let g = 6; g <= 22; g += 2) {
      cols.style.setProperty('--body-gap', g + 'px');
      if (fits()) { chosenGap = g; } else { break; }
    }
    cols.style.setProperty('--body-gap', chosenGap + 'px');
  });
}
fitBody();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitBody);
window.addEventListener('load', fitBody);
window.addEventListener('resize', fitBody);

/* 编辑功能已移除：无编辑热区/按钮/编辑器实例，E 键无绑定 */
/* 灯光开关 H（速读版 v48 新增） */
(function(){
  var btn=document.getElementById('lightsToggle'), txt=document.getElementById('lightsTxt');
  var off=false;
  function setOff(v){ off=v; document.body.classList.toggle('lights-off',off); if(btn) btn.classList.toggle('on',off); if(txt) txt.textContent = off ? 'LIGHT OFF' : 'LIGHT ON'; }
  if(btn) btn.addEventListener('click',function(e){ e.stopPropagation(); setOff(!off); });
  window.lights = { toggle:function(){ setOff(!off); } };
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT_PATH, html.replace(/__TOTAL_PAGES__/g, pad(PAGE.length)), 'utf8');
console.log('SAVED:', OUT_PATH);
console.log('SLIDES:', PAGE.length, '| IDEAS:', TOTAL, '| DOCS:', docs.length);
console.log('BYTES:', fs.statSync(OUT_PATH).size, '| MUSIC:', musicMode);
