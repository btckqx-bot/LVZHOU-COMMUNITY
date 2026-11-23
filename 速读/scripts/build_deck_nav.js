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
/* v42：默认单音乐（星云曲通篇共用）；--dual-music 才启用 default+nebula 双音乐 */
const dualMusic = FLAGS.includes('--dual-music');
const orientation = flag('--orientation', 'landscape');   // landscape=A/D, portrait=W/S
const isPortrait = orientation === 'portrait';
const NAV_HINT = isPortrait
  ? 'W 上切 · S 下切 · Q 目录 · N 导航 · E 巡游 · R 速度 · Z 撤销 · F 全屏 · G 音乐 · H 灯光'
  : 'A 上一张 · D 下一张 · Q 目录 · W 星云 · N 导航 · E 巡游 · R 速度 · Z 撤销 · F 全屏 · G 音乐 · H 灯光';
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
/* v39 规则：书名一律用原书书名，剥掉（深读版）/（速读版）等括号后缀，全文统一 */
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
  ${(() => { const all = meta.stats || docs.map(d => ({ k: 'SCOPE', v: `${(d.ideas || []).length} 条观点` }));
    const nums = all.filter(s => s.type === 'num' || !s.type), feats = all.filter(s => s.type === 'feat');
    /* v41：3 个数字整合成一块 feat（SCOPE / 覆盖），文案 "25章 90条观点，字数约190万" */
    const scopeHtml = nums.length
      ? `<div class="cell feat"><div class="k">SCOPE / 覆盖</div><div class="v">${esc(nums[0]?.v||'')}章 ${esc(nums[1]?.v||'')}条观点，字数${esc(nums[2]?.v||'')}</div></div>`
      : '';
    const featHtml = feats.map(s => `<div class="cell feat"><div class="k">${esc(s.k)}</div><div class="v">${esc(s.v)}</div></div>`).join('');
    return scopeHtml + featHtml;
  })()}
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
const tocIndex = PAGE.length;   // T 键跳到目录
const isNavDeck = docs.length === 1 && (docs[0].ideas || []).some(v => v.hn);
if (isNavDeck) {
  /* 本书定制 · 可折叠树状目录：书籍 → 核心 → 分层 → 基础；v27 起默认全部展开 */
  const all = docs[0].ideas;
  const byNo = {}; all.forEach(v => byNo[v.no] = v);
  const cores = all.filter(v => v.tier === 'core');
  const bookName = String(docs[0].name || '').replace(/（.*?）/g,'').trim();
  const rowHtml = (v, hasKids) => {
    const arrow = hasKids ? '<span class="tr-arrow">▾</span>' : '<span class="tr-arrow leaf">·</span>';
    return `<div class="tr-row tier-${v.tier}" data-idea="${v.no}" ${hasKids?'data-toggle':''}>`
      + `${arrow}<span class="tr-hn">${esc(v.hn)}</span><span class="tr-t">${esc(v.title)}</span></div>`;
  };
  const layerHtml = (v) => {
    const kids = (v.children||[]).map(n=>byNo[n]).filter(Boolean);
    return `<div class="tr-children" data-children-of="${v.no}">`
      + kids.map(f => rowHtml(f, false)).join('') + `</div>`;
  };
  const coreHtml = (v) => {
    const layers = (v.children||[]).map(n=>byNo[n]).filter(Boolean);
    return `<div class="tr-children" data-children-of="${v.no}">`
      + layers.map(l => rowHtml(l, true) + layerHtml(l)).join('') + `</div>`;
  };
  add('toc-tree', `
<div class="topbar reveal r1"><div class="tb-left"><span class="tb-tag">CONTENTS</span><span class="tb-title">《${esc(bookName)}》· 分层目录</span></div>
<div class="tb-right"></div></div>
<div class="tree-wrap reveal r3">
  <div class="tr-children root-children">
    ${cores.map(c => rowHtml(c, true) + coreHtml(c)).join('')}
  </div>
</div>
`, { kind: 'toc' });
} else {
  const tocEntries = docs.flatMap((d, di) => (d.ideas || []).map(v => ({ d, di, v })));
  const tocTotalPages = Math.max(1, Math.ceil(tocEntries.length / TOC_ROWS_PER_PAGE));
  for (let p = 0; p < tocTotalPages; p++) {
    const chunk = tocEntries.slice(p * TOC_ROWS_PER_PAGE, (p + 1) * TOC_ROWS_PER_PAGE);
    const cols = [];
    for (let c = 0; c < TOC_COLS; c++) {
      const rows = chunk.slice(c * TOC_PER_COL, (c + 1) * TOC_PER_COL);
      if (!rows.length) continue;
      let colHtml = `<div class="toc-col">`;
      rows.forEach(({ d, di, v }) => {
        colHtml += `<div class="toc-row tier-${v.tier || 'foundation'}"><div class="n">${pad(v.no)}.</div><div class="t">${esc(v.title)}<em>${esc(String(v.chap || '').split('·')[0].trim())}</em></div></div>`;
      });
      cols.push(colHtml + `</div>`);
    }
    let docName = (docs[0] && docs[0].name) ? String(docs[0].name).trim() : '';
    if (docName && !/^[《<]/.test(docName)) docName = `《${docName}》`;
    add('toc', `
<div class="topbar reveal r1"><div class="tb-left"><span class="tb-tag">CONTENTS</span><span class="tb-title">${esc(docName||'')} · 全部 ${TOTAL} 条 · 第 ${p+1}/${tocTotalPages}</span></div>
<div class="tb-right"><span class="tb-tag">点击可跳转</span></div></div>
<div class="toc-grid" style="margin-top:26px">${cols.join('')}</div>
`, { kind: 'toc' });
  }
}

/* ---------- 本书定制：全局观点索引（供层级导航解析编号→页码） ---------- */
const navIdeasGlobal = docs.flatMap(d => (d.ideas || []));

/* ---------- 2.5 星云页（黑夜模式 / 统一小点 / 悬停显论点 + 紫实线垂直 + 紫虚线横向，仅此页） ---------- */
if (docs.length === 1 && (docs[0].ideas || []).some(v => v.tier)) {
  const navIdeas = docs[0].ideas;
  const cores = navIdeas.filter(v => v.tier === 'core');
  const byCore = {};
  cores.forEach(c => {
    const layers = (c.children || []).map(n => navIdeas.find(v => v.no === n)).filter(Boolean);
    byCore[c.no] = layers.map(l => ({ layer: l, founds: (l.children || []).map(n => navIdeas.find(v => v.no === n)).filter(Boolean) }));
  });
  const CENTER = [744, 440];   // v37 星云中心左移4.5格(约156)：腾出右侧给信息栏
  const V_COLOR = '#8E6FD8', H_COLOR = '#B388E8';
  const DOT = '#c9c9c6';
  const RAD = { core:6, layer:4.5, foundation:3.2 };  // 大小差距小
  let nodes = '', vlinks = '', hlinks = '', labels = '';
  const POS = {};
  const rnd = (i) => (((i * 9301 + 49297) % 233280) / 233280);
  /* 轨道参数：a,br,phase,speed,tilt,seed,mass(质量→速度差异),depth(三维深度→大小/明暗) */
  const mkOrb = (a,br,phase,speed,tilt,seed,mass,depth) => [a,br,phase,speed,tilt,seed,mass,depth].map(x=>+x.toFixed(5)).join(',');
  /* 椭圆轨道：θ = phase + speed*t/mass + 微扰(引力抖动)；旋转倾角 tilt */
  const orbitPos = (center, p, t) => {
    const a=p[0], br=p[1], phase=p[2], speed=p[3], tilt=p[4], seed=p[5], mass=p[6]||1;
    const th = phase + (speed/mass)*t + 0.045*Math.sin(seed + t*0.12);
    const c=Math.cos(th), sn=Math.sin(th), ct=Math.cos(tilt), st=Math.sin(tilt);
    const x=a*c, y=a*br*sn;
    return [center[0] + x*ct - y*st, center[1] + x*st + y*ct];
  };
  const nodeHtml = (v, orb) => {
    const tier = v.tier, depth = orb ? (orb.p[7] || 0) : 0;
    const r = (RAD[tier] || 4) * (1 - depth*0.28);        // 三维深度：远→小
    const op = (0.72 + depth*0.24).toFixed(2);            // 远→略暗
    const tw = tier === 'core' ? ' tw-core' : (tier === 'layer' ? ' tw-layer' : '');  // 闪烁分级：核心>分层>基础(不闪)
    const point = v.point || pad(v.no);
    const pp = orb ? orbitPos(orb.center, orb.p, 0) : [0,0];
    const x=pp[0], y=pp[1];
    const off = x > 1500 ? -(point.length * 8 + 12) : 12;
    const parentAttr = tier === 'core' ? '0' : (v.parent || '');
    return `<g class="sky-node${tier==='core'?' is-core':''}" data-idea="${v.no}" data-tier="${tier}" data-hn="${esc(v.hn||'')}" data-orb="${orb?orb.str:''}" data-point="${esc(point)}" data-title="${esc(v.title)}" data-children="${(v.children||[]).join(',')}" data-parent="${parentAttr}" data-refs="${(v.refs||[]).join(',')}" style="cursor:pointer">`
      + `<circle class="hit" cx="${x}" cy="${y}" r="${r+8}" fill="transparent"/>`
      + `<circle class="star${tw}" cx="${x}" cy="${y}" r="${r}" fill="${DOT}" opacity="${op}" style="animation-delay:-${(rnd(v.no*7)*6).toFixed(1)}s"/>`
      + `<text class="pt" x="${x+off}" y="${y+5}">${esc(point)}</text>`
      + `</g>`;
  };
  /* 中心大圆点：本书 */
  const coreNos = cores.map(c => c.no);
  const bookTitle = pureBookName(docs[0].name || '本书');
  POS[0] = CENTER;
  nodes += `<g class="sky-node book-node" data-idea="0" data-tier="book" data-hn="0.0" data-orb="" data-point="${esc(bookTitle)}" data-title="${esc('《'+bookTitle+'》全书总命题：'+(docs[0].claim||'知识在组织中持续创造并螺旋上升'))}" data-children="${coreNos.join(',')}" data-parent="" data-refs="" style="cursor:pointer">`
    + `<circle class="hit" cx="${CENTER[0]}" cy="${CENTER[1]}" r="26" fill="transparent"/>`
    + `<circle class="star book-star tw-book" cx="${CENTER[0]}" cy="${CENTER[1]}" r="11" fill="#d8cdf5"/>`
    + `<text class="book-label" x="${CENTER[0]}" y="${CENTER[1]+34}">《${esc(bookTitle)}》</text>`
    + `</g>`;
  /* 核心层：围绕书公转（椭圆、差速、倾角各异） */
  cores.forEach((c, ci) => {
    const n = Math.max(1, cores.length);
    const a = 400 + rnd(ci+1)*40, br = 0.50 + rnd(ci+11)*0.10;
    const phase = ci/n*Math.PI*2 + 0.35;
    const speed = 0.0075 + rnd(ci+21)*0.003;   // v31 再减半：一圈约 300-420 秒
    const mass = 0.8 + rnd(ci+41)*0.5, depth = rnd(ci+51)*0.6;
    const tilt = rnd(ci+31)*0.30 - 0.15;
    const seed = ci*1.7;
    const str = mkOrb(a,br,phase,speed,tilt,seed,mass,depth);
    const orb = {center:CENTER, p:[a,br,phase,speed,tilt,seed,mass,depth], str};
    POS[c.no] = orbitPos(CENTER, orb.p, 0);
    vlinks += `<line class="vlink uplink" data-a="0" data-b="${c.no}" x1="${CENTER[0]}" y1="${CENTER[1]}" x2="${POS[c.no][0]}" y2="${POS[c.no][1]}" stroke="${V_COLOR}" stroke-width="1.8"/>`;
    nodes += nodeHtml(c, orb);
    const groups = byCore[c.no] || [];
    /* 分层：围绕各自核心公转 */
    groups.forEach((g, li) => {
      const m = Math.max(1, groups.length);
      const a2 = 165 + rnd(ci*17+li+101)*55, br2 = 0.5 + rnd(ci*17+li+201)*0.15;
      const phase2 = li/m*Math.PI*2 + ci*0.7;
      const speed2 = 0.021 + rnd(ci*17+li+301)*0.011;  // v31 再减半
      const mass2 = 0.8 + rnd(ci*17+li+501)*0.5, depth2 = rnd(ci*17+li+601)*0.6;
      const tilt2 = rnd(ci*17+li+401)*0.5 - 0.25;   // v39：限制倾角，保持扁长横向不越界
      const seed2 = li*2.3 + ci;
      const str2 = mkOrb(a2,br2,phase2,speed2,tilt2,seed2,mass2,depth2);
      const orb2 = {center:POS[c.no], p:[a2,br2,phase2,speed2,tilt2,seed2,mass2,depth2], str:str2};
      POS[g.layer.no] = orbitPos(POS[c.no], orb2.p, 0);
      vlinks += `<line class="vlink" data-a="${c.no}" data-b="${g.layer.no}" x1="${POS[c.no][0]}" y1="${POS[c.no][1]}" x2="${POS[g.layer.no][0]}" y2="${POS[g.layer.no][1]}" stroke="${V_COLOR}" stroke-width="1.4"/>`;
      nodes += nodeHtml(g.layer, orb2);
      /* 基础：围绕各自分层公转 */
      g.founds.forEach((f, fi) => {
        const k = Math.max(1, g.founds.length);
        const a3 = 62 + rnd(ci*31+li*7+fi+501)*20, br3 = 0.55 + rnd(ci*31+li*7+fi+601)*0.15;
        const phase3 = fi/k*Math.PI*2 + li*0.5;
        const speed3 = 0.05 + rnd(ci*31+li*7+fi+701)*0.025; // v31 再减半
        const mass3 = 0.8 + rnd(ci*31+li*7+fi+901)*0.5, depth3 = rnd(ci*31+li*7+fi+1001)*0.6;
        const tilt3 = rnd(ci*31+li*7+fi+801)*0.5 - 0.25;  // v39：限制倾角
        const seed3 = fi*3.1 + li + ci*0.5;
        const str3 = mkOrb(a3,br3,phase3,speed3,tilt3,seed3,mass3,depth3);
        const orb3 = {center:POS[g.layer.no], p:[a3,br3,phase3,speed3,tilt3,seed3,mass3,depth3], str:str3};
        POS[f.no] = orbitPos(POS[g.layer.no], orb3.p, 0);
        vlinks += `<line class="vlink" data-a="${g.layer.no}" data-b="${f.no}" x1="${POS[g.layer.no][0]}" y1="${POS[g.layer.no][1]}" x2="${POS[f.no][0]}" y2="${POS[f.no][1]}" stroke="${V_COLOR}" stroke-width="1"/>`;
        nodes += nodeHtml(f, orb3);
      });
    });
  });
  const hPairs = new Set();
  navIdeas.forEach(v => {
    (v.refs || []).forEach(n => {
      if (POS[v.no] && POS[n] && v.no !== n) {
        const key = [v.no, n].sort((a,b)=>a-b).join('-');
        if (!hPairs.has(key)) { hPairs.add(key);
          const [ax, ay] = POS[v.no], [bx, by] = POS[n];
          const mx = (ax+bx)/2, my = (ay+by)/2 - 60;
          hlinks += `<path class="hlink" data-a="${v.no}" data-b="${n}" d="M${ax} ${ay} Q${mx} ${my} ${bx} ${by}" fill="none" stroke="${H_COLOR}" stroke-width="1.2" stroke-dasharray="5 6"/>`;
        }
      }
    });
  });
  add('navmap', `
<div class="map-head"><span class="mh-title"><i>Knowledge Nebula</i><b>知识星云</b></span></div>
<div class="navmap-body">
  <div class="navmap-wrap">
    <svg viewBox="0 0 1800 900" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
${vlinks}${hlinks}${nodes}
    </svg>
  </div>
  <div class="map-info" data-map-info style="visibility:hidden">
    <div class="mi-empty">将鼠标移到任意星点<br>点亮它的论点与关联</div>
    <div class="mi-body" data-map-info-body style="display:none">
      <div class="mi-tier" data-mi-tier></div>
      <div class="mi-title" data-mi-title></div>
      <div class="mi-rel" data-mi-vert></div>
      <div class="mi-rel" data-mi-cross></div>
      <div class="mi-hint">点击星点 / 关联条目跳转</div>
    </div>
  </div>
  <!-- 右下角装饰：观点数量（点缀横线，不明显） -->
  <div class="map-stat-deco">
    <span class="msd-line"></span>
    <span class="msd-txt">核心 ${cores.length} · 分层 ${navIdeas.filter(v=>v.tier==='layer').length} · 基础 ${navIdeas.filter(v=>v.tier==='foundation').length}</span>
    <span class="msd-line"></span>
  </div>
  <!-- 右下角巡游开关 + 宇宙速度选择 -->
  <div class="cruise-ctrl">
    <div class="cruise-bar">
      <button class="cruise-toggle" data-cruise-toggle title="星际巡游 (E)"><span class="ct-key">E</span><span class="ct-label"><span class="ct-name">巡游</span><span class="ct-state">OFF</span></span></button>
      <button class="speed-hit" data-speed-hit title="点击切换宇宙速度 (R)"><span class="ct-key">R</span><span class="sp-val" data-speed-val>第一宇宙速度</span></button>
      <input type="range" class="speed-range-hidden" data-speed-range min="0" max="2" step="1" value="0" style="display:none"/>
    </div>
  </div>
  <!-- 巡游飞船（像素风，默认隐藏，P 或按钮开启） -->
  <div class="cruise-ship" data-cruise-ship style="display:none"><img src="__SHIP_DATA__" alt="ship"/></div>
</div>
`, {}, { kind: 'navmap' });
}

/* ---------- 每份文档:扉页 + 观点页 ---------- */
docs.forEach((doc, di) => {
  if (false) add('chapter', `   /* 导航版：删除星空后的扉页（与封面统计重复），统计已移入封面 index-bar */
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
          /* v38：文本已含"边界：/反例："前缀与"[推演]/[原文]"后缀，先剥离，避免与 plabel/chip 重复（回到早期规则：标签只出现一次） */
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
      ? `<span class="layer-chip ${LEVEL_CLASS[v.level] || ''}">${esc(v.level)}</span>`
      : '';
    /* 本书定制：层级徽标 + 面包屑 + 下钻/横向跳转导航 overlay */
    const TIER_BADGE = { core: '核心观点', layer: '分层观点', foundation: '根基支撑' };
    /* v36：去掉前缀符号与 N；两枚徽标统一样式（见 .idea-meta），N 键展开导航面板 */
    const tierBadge = `<span class="tier-badge tier-${v.tier || 'foundation'}" data-nav-open title="按 N 展开层级与理论链接">${TIER_BADGE[v.tier] || '观点'}</span>`;
    const crumbCore = navIdeasGlobal.find(x => x.no === v.coreNo);
    const crumbParent = v.parent ? navIdeasGlobal.find(x => x.no === v.parent) : null;
    const hnLabel = v.hn || pad(v.no);
    const crumb = `${crumbCore ? `${esc(crumbCore.hn||pad(crumbCore.no))} ${esc(crumbCore.coreLabel || '')}` : ''}${crumbParent && crumbParent.tier === 'layer' ? ` › ${esc(crumbParent.hn||pad(crumbParent.no))}` : ''} › ${TIER_BADGE[v.tier] || '观点'}`.trim();
    /* overlay 内容：上钻父、下钻子、横向关联 */
    const navRows = [];
    if (v.parent) { const p = navIdeasGlobal.find(x => x.no === v.parent); if (p) navRows.push(`<div class="navitem up" data-idea="${p.no}"><span class="ar">↑</span> 上层 · ${esc(p.hn||pad(p.no))} ${esc(p.title)}</div>`); }
    (v.children || []).forEach(n => { const c = navIdeasGlobal.find(x => x.no === n); if (c) navRows.push(`<div class="navitem down" data-idea="${c.no}"><span class="ar">↓</span> ${esc(c.hn||pad(c.no))} ${esc(c.title)}</div>`); });
    (v.refs || []).forEach(n => { const r = navIdeasGlobal.find(x => x.no === n); if (r) navRows.push(`<div class="navitem cross" data-idea="${r.no}"><span class="ar">→</span> 横向 ${esc(r.hn||pad(r.no))} ${esc(r.title)}</div>`); });
    /* v36：理论链接构成 —— 解析 links 文本里的 #编号，生成可点击跳转项；按 N 直接展示，不再靠悬停 title */
    const theorySet = new Set();
    const linkNos = [];
    String(v.links || '').replace(/#(\d+)/g, (m, num) => { const k = +num; if (!theorySet.has(k)) { theorySet.add(k); linkNos.push(k); } return m; });
    const theoryRows = linkNos.map(no => { const t = navIdeasGlobal.find(x => x.no === no);
      return `<div class="navitem theory" data-idea="${no}"><span class="ar">#</span> ${esc(t ? (t.hn||pad(t.no))+' '+String(t.title) : '观点 '+pad(no))}</div>`; }).join('');
    const theoryText = String(v.links || '').replace(/#(\d+)/g, (m, num) => { const t = navIdeasGlobal.find(x => x.no === +num); return t ? (t.hn || pad(t.no)) : '#'+pad(+num); });
    const navOverlay = `
<div class="nav-overlay" data-nav-overlay>
  <div class="nav-panel">
    <div class="nav-head"><span class="nav-crumb">${crumb}</span><span class="nav-close" data-nav-close>✕ 关闭</span></div>
    <div class="nav-sec-label">① 分层观点 · 层级导航</div>
    <div class="nav-body">${navRows.join('') || '<div class="navitem">（暂无层级关联）</div>'}</div>
    <div class="nav-sec-label">② ${esc(v.level || '理论链接')} · 理论链接构成</div>
    <div class="nav-theory">${theoryRows || '<div class="navitem">（暂无理论链接）</div>'}<div class="nav-theory-txt">${esc(theoryText)}</div></div>
    <div class="nav-foot">↑ 上层　↓ 下钻　→ 横向引申　·　点击任意条目跳转　·　按 N 或 Esc 关闭</div>
  </div>
</div>`;
    add('slide-idea', `
<div class="topbar reveal r1"><div class="tb-left"><span class="no-chip">${esc(v.hn||('NO.'+pad(v.no)))}</span><span class="book-name">《${esc(pureBookName(doc.name))}》</span><span class="book-author">${esc(bookAuthor)}</span><span class="tb-chap">　　${esc(String(v.chap || '').replace(/^[◆◇·][^｜|]*[｜|]\s*/, ''))}</span></div>
<div class="tb-right"></div></div>${navOverlay}
<h2 class="idea-title ${titleClass(v.title)} reveal r2">${esc(v.title)}</h2>
<div class="cols reveal r3">
  <div class="col left-col"><div class="block reasoning"><div class="col-head"><span class="cn">推演逻辑</span><span class="en">REASONING</span></div>
    ${premiseHtml}
    <ul class="logic-list">${logicHtml}</ul></div></div>
  <div class="col right-col">
    <div class="block evidence"><div class="col-head"><span class="cn">支撑依据</span><span class="en">EVIDENCE</span></div><ul class="support-list">${supHtml}</ul></div>
    <div class="block action"><div class="col-head"><span class="cn">行动建议</span><span class="en">ACTION</span></div><ul class="action-list">${actHtml}</ul></div>
  </div>
</div>
<!-- v34：层级徽标 + 方法论 chip 移到左栏底部金句上方，左对齐、避开右上角音乐按钮 -->
<div class="idea-meta">
  <div class="im-tier">${tierBadge}</div>
  <div class="im-level">${levelChip || '<span></span>'}</div>
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
let musicCss = '', musicHtml = '', audioVar = 'null', nebulaAudioVar = 'null';
const nebulaPath = flag('--nebula-music', path.join(SKILL_DIR, 'assets', 'nebula-music.mp3'));
/* v42 默认单音乐：把唯一音源设为星云曲（星云页+正文页共用），不再嵌入 default 曲，省约 4MB */
const effectiveMusicPath = dualMusic ? musicPath : nebulaPath;
if (musicMode !== 'none' && fs.existsSync(effectiveMusicPath)) {
  let src = effectiveMusicPath;
  if (musicMode === 'embed') {
    const b64 = fs.readFileSync(effectiveMusicPath).toString('base64');
    const mime = /\.ogg$/i.test(effectiveMusicPath) ? 'audio/ogg' : /\.wav$/i.test(effectiveMusicPath) ? 'audio/wav' : 'audio/mpeg';
    src = `data:${mime};base64,${b64}`;
  }
  audioVar = JSON.stringify(src);
  /* 双音乐模式：星云页专用曲；单音乐模式留 null（setScene 直接 return，全程同一曲） */
  if (dualMusic && fs.existsSync(nebulaPath)) {
    nebulaAudioVar = JSON.stringify(musicMode === 'embed' ? 'data:audio/mpeg;base64,' + fs.readFileSync(nebulaPath).toString('base64') : nebulaPath);
  }
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
/* ===== 灯光开关 H + v40/v41 全部固化规则 ===== */
.lights-toggle{ position:fixed; top:18px; right:160px; z-index:10002; height:40px; padding:0 14px; display:flex; align-items:center; gap:8px; border:1.5px solid var(--ink); background:var(--paper); color:var(--ink); font-family:var(--f-mono); font-size:14px; letter-spacing:.04em; cursor:pointer; transition:background .2s,color .2s; }
.lights-toggle:hover,.lights-toggle.on{ background:var(--ink); color:var(--paper); }
.lights-toggle .ico{ font-size:15px; line-height:1; }
body.lights-off{ --paper:#121316; --paper-2:#1b1c20; --ink:#c9cfe0; --ink-soft:#8f96a8; --grid:rgba(190,190,205,.075); --ink-faint:rgba(190,190,205,.18); --slide-bg:#121316; }
body.lights-off .slide::after{ background:radial-gradient(ellipse 70% 60% at 50% 45%, rgba(120,110,190,.10), transparent 70%); }
body.lights-off .music-toggle,body.lights-off .lights-toggle{ background:#121316; color:#c9cfe0; border-color:#c9cfe0; }
body.lights-off .slide.navmap{ background:#121316 !important; }
.slide.navmap .map-stat-deco{ left:auto; right:0; top:auto; bottom:-19px; gap:8px; justify-content:flex-end; }
.slide.navmap .map-stat-deco .msd-line{ display:none; }
.slide.navmap .nav-hint{ transition:font-size .15s,font-weight .15s,opacity .15s; pointer-events:auto !important; z-index:6 !important; }
.slide.navmap .nav-hint:hover{ font-size:15px; font-weight:700; opacity:.85; color:#d8d8e4 !important; }
.nav-hint{ transition:font-size .15s,font-weight .15s,opacity .15s; }
.nav-hint:hover{ font-size:15px; font-weight:700; opacity:.85; }

`;
  musicHtml = `<button class="lights-toggle" id="lightsToggle" title="开灯/关灯 (H)"><span class="ico">H</span><span id="lightsTxt">LIGHT ON</span></button><button class="music-toggle" id="musicToggle" title="播放/关闭背景音乐 (G)"><span class="ico" id="musicIco">G</span><span id="musicTxt">MUSIC OFF</span></button>`;
} else if (musicMode !== 'none') {
  console.warn('音乐文件不存在，已跳过:', musicPath);
}

/* ---------- 组装 ---------- */
const themeCss = fs.readFileSync(path.join(SKILL_DIR, 'assets', 'theme.css'), 'utf8');
const navCss = `
/* ===== 封面统计栏（v38：3数字+2特征 同比例/无竖线/英文斜杠装饰字） ===== */
.cover .index-bar{ display:flex; align-items:stretch; }
.cover .index-bar .num-group{ flex:1 1 0; display:flex; gap:20px; align-items:flex-start; }
.cover .index-bar .cell{ padding:16px 0 14px; border:none; display:flex; flex-direction:column; gap:6px; }
.cover .index-bar .cell.num{ flex:1 1 0; min-width:0; align-items:flex-start; }
.cover .index-bar .cell.feat{ flex:1 1 0; min-width:0; align-items:center; text-align:center; justify-content:flex-start; }
.cover .index-bar .v{ font-family:var(--f-cn-display); font-weight:700; color:var(--ink); line-height:1.15; }
.cover .index-bar .cell.num .v{ font-size:27px; }
.cover .index-bar .cell.feat .v{ font-size:19px; line-height:1.5; }
.cover .index-bar .k{ font-family:var(--f-mono); font-size:13px; letter-spacing:.08em; color:#1F2BE0; margin:0; white-space:nowrap; }
/* ===== v38：正文编号框统一尺寸（短序号只少显示点+数字，框与前数字位置一致） ===== */
.slide-idea .no-chip{
  box-sizing:border-box; display:inline-flex; align-items:center; justify-content:flex-start;
  width:96px; height:34px; padding:0 14px;
  font-family:var(--f-mono); font-size:19px; letter-spacing:.1em; white-space:nowrap;
}
/* ===== 本书定制 · 层级导航 ===== */
.slide-idea .tb-right{ width:auto; display:flex; align-items:center; }
.tier-badge{ font-family:var(--f-mono); font-size:13px; letter-spacing:.04em; padding:5px 10px; border:1.5px solid var(--ink); white-space:nowrap; cursor:pointer; transition:background .2s,color .2s; }
.tier-badge b{ font-size:11px; opacity:.6; margin-left:4px; }
.tier-badge:hover{ background:var(--ink); color:var(--paper); }
.tier-badge.tier-core{ background:var(--ink); color:var(--paper); }
.tier-badge.tier-layer{ border-color:#0f6e56; color:#0f6e56; }
.tier-badge.tier-foundation{ border-color:#888780; color:#5f5e5a; }
/* v36：两枚徽标统一形态——长高、字号、加粗全部一致（参考原 layer-chip），左对齐、避开右上角音乐按钮 */
.slide-idea .frame > .idea-meta{ flex:0 0 auto; display:flex; flex-direction:column; align-items:flex-start; gap:5px; padding:6px 0 4px; }
.idea-meta .im-tier,.idea-meta .im-level{ display:flex; align-items:center; min-height:26px; }
.idea-meta .tier-badge,.idea-meta .layer-chip{
  box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center;
  min-width:118px; min-height:26px;
  font-family:var(--f-cn-display); font-size:15px; font-weight:700;
  line-height:1; letter-spacing:.04em; padding:6px 12px 5px; border:1.5px solid var(--ink);
  white-space:nowrap;
}
.idea-meta .tier-badge{ cursor:pointer; transition:background .2s,color .2s; background:var(--ink); color:var(--paper); }
.idea-meta .tier-badge.tier-layer{ background:#0f6e56; border-color:#0f6e56; color:#fff; }
.idea-meta .tier-badge.tier-foundation{ background:#5f5e5a; border-color:#5f5e5a; color:#fff; }
.idea-meta .layer-chip{ cursor:default; color:var(--ink); background:transparent; }
.idea-meta .layer-chip.L-philosophy{ background:var(--ink); color:var(--paper); }
.idea-meta .layer-chip.L-principle{ border-color:#1F2BE0; color:#1F2BE0; }
.idea-meta .layer-chip.L-method{ border-style:dashed; }
.idea-meta .layer-chip.L-tactic{ border-color:#888780; color:#5f5e5a; }
.idea-meta .layer-chip.L-tactic{ border-color:#888780; color:#5f5e5a; }
/* 目录层级视觉 */
.toc-row.tier-core .n{ color:#1f2be0; font-weight:700; }
.toc-row.tier-layer .n{ color:#0f6e56; }
.toc-row.tier-foundation .n{ color:#888780; }
/* 导航 overlay：绝对定位覆盖舞台，默认隐藏 */
.nav-overlay{ position:absolute; inset:0; z-index:60; display:none; align-items:center; justify-content:center; background:rgba(247,246,241,.96); }
.nav-overlay.open{ display:flex; }
.nav-panel{ width:86%; max-height:86%; display:flex; flex-direction:column; border:2px solid var(--ink); background:var(--paper); }
.nav-head{ display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1.5px solid var(--ink); }
.nav-crumb{ font-family:var(--f-mono); font-size:17px; color:var(--ink); }
.nav-close{ font-family:var(--f-mono); font-size:14px; cursor:pointer; }
.nav-close:hover{ text-decoration:underline; }
.nav-body{ padding:14px 24px; overflow:auto; display:grid; grid-template-columns:1fr 1fr; gap:6px 18px; }
.navitem{ font-size:15px; padding:8px 12px; border:1px solid var(--ink-faint); cursor:pointer; white-space:normal; overflow:visible; word-break:break-word; line-height:1.5; }  /* v38：观点完整显示，不截断 */
.navitem:hover{ background:var(--ink); color:var(--paper); }
.navitem .ar{ font-family:var(--f-mono); font-weight:700; margin-right:8px; }
.navitem.up .ar{ color:#1f2be0; }
.navitem.down .ar{ color:#0f6e56; }
.navitem.cross .ar{ color:#ba7517; }
.nav-sec-label{ padding:10px 24px 4px; font-family:var(--f-cn-display); font-size:15px; font-weight:700; color:var(--ink); letter-spacing:.04em; }
.nav-theory{ padding:0 24px 12px; overflow:auto; }
.nav-theory .navitem.theory{ border-left:3px solid #1F2BE0; color:#1F2BE0; }
.nav-theory .navitem.theory .ar{ color:#1F2BE0; }
.nav-theory-txt{ margin-top:8px; font-family:var(--f-cn-display); font-size:15px; line-height:1.6; color:var(--ink-soft); }
.nav-foot{ padding:12px 24px; border-top:1px solid var(--ink-faint); font-family:var(--f-mono); font-size:13px; color:var(--ink-soft); }
/* ===== 树状目录 · 可折叠（本书定制） ===== */
.slide.toc-tree .frame{ display:flex; flex-direction:column; padding-top:14px; transform:translateY(-51px); }  /* v38：整体上移1.5格(51px)，消除顶部空白浪费；topbar与下方观点一起移动 */
.tree-wrap{ flex:1 1 auto; min-height:0; overflow:auto; padding:14px 26px; margin-top:12px; border:1px solid var(--ink-faint); }
.tr-row{ display:flex; align-items:center; gap:12px; padding:7px 12px; line-height:1.3; transition:background .15s,transform .15s; }
.tr-row .tr-arrow{ font-family:var(--f-mono); font-size:14px; color:var(--ink-soft); width:14px; flex:0 0 auto; }
.tr-row .tr-arrow.leaf{ color:var(--ink-faint); }
.tr-row .tr-hn{ font-family:var(--f-mono); font-size:14px; color:var(--ink-soft); flex:0 0 62px; }
.tr-row .tr-t{ font-family:var(--f-cn-display); font-size:17px; color:var(--ink); line-height:1.4; }
.tr-row:hover{ background:rgba(31,43,224,.06); transform:translateX(6px); }
.tr-row:hover .tr-t{ font-weight:700; font-size:21px; }
.tr-row:hover .tr-hn{ color:var(--ink); font-weight:700; }
.tr-row.book{ border-bottom:1.5px solid var(--ink); margin-bottom:6px; }
.tr-row.book .tr-t{ font-weight:700; font-size:22px; }
.tr-children{ margin-left:22px; padding-left:16px; border-left:1px dashed var(--ink-faint); }
.tr-children .tr-row.tier-core .tr-hn{ font-size:18px; }
.tr-row.tier-core .tr-t{ font-weight:700; font-size:24px; }
.tr-row.tier-layer .tr-t{ font-size:20px; }
.tree-tip{ flex:0 0 auto; text-align:center; font-family:var(--f-mono); font-size:13px; color:var(--ink-soft); padding-top:10px; }

/* ===== 星云页 · 黑夜模式（仅此页；背景改黑、保留正方格） ===== */
.slide.navmap{ background:#121316 !important; --grid:rgba(190,190,205,.075); --slide-bg:#121316; }
.slide.navmap::after{ background:radial-gradient(ellipse 70% 60% at 50% 45%, rgba(120,110,190,.10), transparent 70%); }
.slide.navmap .page-num,.slide.navmap .nav-hint{ color:#7a7a86 !important; }
.slide.navmap .frame{ display:flex; flex-direction:column; padding:0; }
/* v31：去掉星云页上下蓝线与标题下的浅色大长线，让星点自由舒展 */
.slide.navmap .hairline-top,.slide.navmap .hairline-bot{ display:none !important; }
.slide.navmap .map-head{ border-bottom:none !important; }
/* v33：标题移左上、英文在上中文在下、左对齐；map-head 脱离文档流，让星点区占满全屏 */
.map-head{ position:absolute; top:22px; left:32px; z-index:12; display:flex; flex-direction:column; align-items:flex-start; gap:4px; pointer-events:none; }
.map-head .mh-kicker{ font-family:var(--f-mono); font-size:13px; letter-spacing:.08em; color:#8a86a8; }
/* v40：去掉 STRUCTURE MAP；知识星云移到英文上方；英文位置保持不变（用 margin 补偿去掉的 kicker 高度） */
.map-head .mh-title{ position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:2px; text-align:left; white-space:nowrap; margin-top:-49px; }
.map-head .mh-title b{ position:absolute; bottom:calc(100% + 2px); left:0; font-size:36px; font-weight:500; color:rgba(198,206,232,.72); letter-spacing:.1em; line-height:1.15; }
.map-head .mh-title i{ font-family:var(--f-serif); font-style:italic; font-size:17px; color:rgba(198,206,232,.5); letter-spacing:.08em; }
.navmap-body{ flex:1 1 auto; min-height:0; position:relative; display:flex; }
.navmap-wrap{ flex:1 1 auto; min-width:0; overflow:visible; position:relative; z-index:4; }
.navmap-wrap svg{ display:block; width:100%; height:100%; }
/* v33：星点区在最上层，底部页码/导航提示不遮挡星点 */
.slide.navmap .page-num,.slide.navmap .nav-hint{ z-index:2 !important; pointer-events:none; }
/* 星点：默认同色、大小接近；论点默认隐去 */
.sky-node .star{ transition:opacity .2s,fill .2s,r .2s; }
/* v31 分层闪烁：书(恒星)>核心>分层>基础(不闪)。用 brightness 避免覆盖 hover 的 opacity/dim */
@keyframes twinkleBook{ 0%,100%{ filter:brightness(.85); } 50%{ filter:brightness(1.6); } }   /* v53 PERF: 去 drop-shadow */
@keyframes twinkleCore{ 0%,100%{ filter:brightness(.9); } 50%{ filter:brightness(1.4); } }   /* v53 PERF: 去 drop-shadow */
@keyframes twinkleLayer{ 0%,100%{ filter:brightness(.92); } 50%{ filter:brightness(1.28); } }
.tw-book{ animation:twinkleBook 9s ease-in-out infinite; }
.tw-core{ animation:twinkleCore 4.8s ease-in-out infinite; }
.tw-layer{ animation:twinkleLayer 3.6s ease-in-out infinite; }
.sky-node .pt{ font-family:var(--f-cn-display); font-size:18px; font-weight:700; fill:#f0f0f6; opacity:0; transition:opacity .2s; paint-order:stroke; stroke:#121316; stroke-width:4px; stroke-linejoin:round; }
.sky-node.hot .pt{ opacity:1; }
.sky-node.hot .star{ fill:#b9a8f0; }
.book-star{ stroke:#f0e9ff; stroke-width:2; }
.book-label{ font-family:var(--f-cn-display); font-size:17px; font-weight:700; fill:#e6dcf7; text-anchor:middle; paint-order:stroke; stroke:#121316; stroke-width:4px; }
.sky-node.dim .star{ opacity:.18; }
/* 关联线：默认极淡，悬停点亮其垂直(紫实线)/横向(紫虚线) */
.vlink,.hlink{ opacity:.10; transition:opacity .2s,stroke-width .2s; }
.vlink.hl{ opacity:1 !important; stroke-width:2.6 !important; }
.hlink.hl{ opacity:.9 !important; stroke-width:2.2 !important; animation:dashflow .7s linear infinite; }
@keyframes dashflow{ to{ stroke-dashoffset:-22; } }
/* 悬停侧栏：深色玻璃面板 */
.map-info{ position:absolute; right:-34px; top:0; width:574px; max-height:100%; overflow:auto; background:#18181f; border:1px solid #4a4a5a; z-index:25; pointer-events:none; }  /* v40：信息栏在上完整覆盖(不透明z25>巡游控件20)，文字高时盖住控件而非重叠显示 */  /* v32: 隐藏时不拦截右侧星点的 hover；显示时 JS 置 auto */
.map-info.vis{ pointer-events:auto; }
.mi-empty{ font-family:var(--f-mono); font-size:16px; color:#7a7a86; text-align:center; padding:70px 20px; line-height:2.1; }
.mi-body{ padding:22px 24px; }
.mi-tier{ font-family:var(--f-mono); font-size:14px; letter-spacing:.06em; color:#9a94bb; margin-bottom:8px; }
.mi-title{ font-size:20px; font-weight:700; line-height:1.5; color:#ececf2; padding-bottom:12px; border-bottom:1px solid #3a3a48; margin-bottom:12px; }
.mi-label{ font-family:var(--f-mono); font-size:14px; letter-spacing:.05em; padding:7px 9px; margin:8px 0 5px; }
.mi-label.vert{ color:#b9a8f0; background:rgba(142,111,216,.12); }
.mi-label.cross{ color:#d0aef5; background:rgba(179,136,232,.12); }
.mi-row{ font-size:16px; line-height:1.55; padding:7px 10px; cursor:pointer; color:#d6d6de; white-space:normal; overflow:visible; word-break:break-all; border-radius:2px; }
.mi-row:hover{ background:#e8e8ee; color:#121316; }
.mi-row.up,.mi-row.down{ border-left:3px solid #8E6FD8; }
.mi-row.cross{ border-left:3px dashed #B388E8; }
.mi-hint{ font-family:var(--f-mono); font-size:11px; color:#7a7a86; margin-top:14px; padding-top:10px; border-top:1px solid #3a3a48; }
.navmap-legend{ display:flex; gap:30px; justify-content:center; align-items:center; font-size:13px; color:#9a9aa8; padding-top:12px; border-top:1px solid #33343c; flex:0 0 auto; }
.navmap-legend span{ display:inline-flex; align-items:center; gap:9px; }
.navmap-legend i{ display:inline-block; flex:0 0 auto; }
.lg-dot{ width:9px; height:9px; border-radius:50%; background:#c9c9c6; }
.lg-v{ width:22px; height:0; border-top:2px solid #8E6FD8; }
.lg-h{ width:22px; height:0; border-top:2px dashed #B388E8; }
/* 右下角装饰数字：细线点缀、不明显 */
.map-stat-deco{ position:absolute; left:auto; right:18px; top:auto; bottom:-19px; display:flex; align-items:center; justify-content:flex-end; gap:8px; z-index:6; }
.msd-line{ display:inline-block; width:46px; height:0; border-top:1px solid rgba(154,166,200,.35); }
.msd-txt{ font-family:var(--f-mono); font-size:17px; letter-spacing:.08em; color:rgba(198,206,232,.6); }
/* 巡游开关 */
.cruise-ctrl{ position:absolute; left:32px; right:auto; top:3px; bottom:auto; z-index:20; }
.cruise-bar{ box-sizing:border-box; display:flex; align-items:stretch; width:260px; background:rgba(24,25,31,.9); border:1px solid rgba(198,206,232,.28); }
.cruise-toggle{ box-sizing:border-box; flex:1 1 0; min-width:0; display:flex; align-items:center; gap:9px; padding:8px 14px; border:none; border-right:1px solid rgba(198,206,232,.28); background:transparent; color:#d8d8e4; font-family:var(--f-mono); font-size:13px; cursor:pointer; }
.speed-hit{ flex:1 1 0; min-width:0; display:flex; align-items:center; justify-content:center; gap:9px; padding:8px 14px; border:none; background:transparent; color:#d8d8e4; cursor:pointer; }
.speed-hit:hover{ background:rgba(185,168,240,.12); }
.sp-label{ font-family:var(--f-mono); font-size:12px; color:#9a94bb; }
.sp-val{ font-family:var(--f-mono); font-size:13px; font-weight:400; color:#d8d8e4; white-space:nowrap; text-align:center; }
.cruise-toggle:hover{ background:rgba(185,168,240,.12); }
.cruise-toggle.on{ background:rgba(80,64,130,.35); }
.ct-dot{ width:9px; height:9px; border-radius:50%; background:#6a6a7a; }
.cruise-toggle.on .ct-dot{ background:#b9a8f0; box-shadow:0 0 8px #b9a8f0; }
.ct-key{ border:1px solid #4a4a62; padding:0 5px; border-radius:2px; color:#9a94bb; }
.cruise-toggle .ct-label{ display:flex; flex-direction:row; align-items:center; gap:5px; line-height:1.1; }
.cruise-toggle .ct-name{ font-size:13px; }
.cruise-toggle .ct-state{ font-size:13px; font-weight:400; }
/* 巡游飞船 */
.cruise-ship{ position:absolute; width:38px; height:38px; z-index:18; cursor:grab; transform:translate(-50%,-50%); transition:left 2.4s cubic-bezier(.4,0,.5,1),top 2.4s cubic-bezier(.4,0,.5,1); filter:drop-shadow(0 0 6px rgba(190,205,255,.5)); }
.cruise-ship.dragging{ cursor:grabbing; transition:none; }
.cruise-ship img{ display:block; width:100%; height:100%; transform-origin:50% 50%; }
.cruise-ship.cruising img{ animation:shipbob 1.6s ease-in-out infinite; }
@keyframes shipbob{ 0%,100%{ margin-top:0; } 50%{ margin-top:-4px; } }
`;
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
${navCss}
${musicCss}
</style>
</head>
<body>
${musicHtml}
<div class="deck-viewport">
  <main class="deck-stage" id="deckStage">
${PAGE.join('\n')}
  </main>
</div>
<script>
const TOC_ORDER = ${JSON.stringify(tocOrder)};
const INSIGHT_ORDER = ${JSON.stringify(insightOrder)};
const NO_TO_PAGE = ${JSON.stringify(Object.fromEntries(docs.flatMap((d,di)=>(d.ideas||[]).map(v=>[String(v.no), ideaPageIndices[`${di}-${v.no}`]]))))};
const TOC_INDEX = ${tocIndex};
const NAVMAP_INDEX = ${(() => { const i = pageMap.findIndex(m => m && m.kind === 'navmap'); return i; })()};
const AUDIO_SRC = ${audioVar};
const NEBULA_AUDIO_SRC = ${nebulaAudioVar};

/* 固定 1920x1080 舞台，整体等比缩放，不按设备重排 */
class SlidePresentation {
  constructor() {
    this.slides = Array.from(document.querySelectorAll('.slide'));
    this.current = 0; this.stage = document.getElementById('deckStage');
    this.actionStack = [];
    this.setupStageScale(); this.setupKeyboard(); this.setupTouch(); this.setupWheel(); this.buildNav(); this.show(0, true); this.initOrbits();
  }
  initOrbits() {
    const slide = document.querySelector('.slide.navmap');
    if (!slide) return;
    const svg = slide.querySelector('.navmap-wrap svg');
    const nodes = [...slide.querySelectorAll('.sky-node')].filter(n => n.getAttribute('data-orb'));
    if (!nodes.length) return;
    const byId = {}; nodes.forEach(n => byId[n.getAttribute('data-idea')] = n);
    const parse = (n) => (n.getAttribute('data-orb')||'').split(',').map(Number);
    const links = [...slide.querySelectorAll('.vlink,.hlink')].map(l => ({ el:l, a:l.getAttribute('data-a'), b:l.getAttribute('data-b'), path:l.classList.contains('hlink') }));
    const CENTER = [744,440];   // v37 与生成端一致：整体左移4.5格
    const orbitPos = (center, p, t, pulse) => {
      const a=p[0]*pulse, br=p[1], phase=p[2], speed=p[3], tilt=p[4], seed=p[5], mass=p[6]||1;
      const th = phase + (speed/mass)*t + 0.045*Math.sin(seed + t*0.12);
      const c=Math.cos(th), sn=Math.sin(th), ct=Math.cos(tilt), st=Math.sin(tilt);
      const x=a*c, y=a*br*sn;
      return [center[0] + x*ct - y*st, center[1] + x*st + y*ct];
    };
    const pos = {}; pos['0'] = CENTER;
    let t0 = performance.now(), enterAt = -1e9, active = false;
    this._orbitEnter = () => { enterAt = performance.now(); };
    const tick = (now) => {
      active = !!(slide.classList.contains('active') && slide.classList.contains('visible'));
      window.__navActive = active;   /* v53 PERF: 发布活跃态给 hoverLoop */
      if (!active) { requestAnimationFrame(tick); return; }   /* v53 PERF: 离开星云页停算 */
      /* v53 PERF: 大图节流——节点>200 时每 50ms 刷一次 DOM（20fps 足够慢速公转），小图保持满帧 */
      if (nodes.length > 200) {
        if (!tick._last || now - tick._last >= 50) tick._last = now;
        else { requestAnimationFrame(tick); return; }
      }
      const t = (now - t0) / 1000;
      const since = now - enterAt;
      const pulse = since < 1100 ? 1 + 0.06 * Math.sin(since/95) * Math.exp(-since/330) : 1;   // 打开波动：衰减脉冲
      const order = ['core','layer','foundation'];
      /* Step1: 轨道基准位置（hover 星点冻结，移开后弹性弹回） */
      const FZ = window.__orbitFreeze || (window.__orbitFreeze = {no:null, pos:null, from:null, t0:0, releaseNo:null});
      if (FZ.no !== FZ.tracked) {
        if (FZ.tracked && FZ.pos) { FZ.from = FZ.pos.slice(); FZ.releaseNo = FZ.tracked; FZ.t0 = now; }
        FZ.tracked = FZ.no; FZ.pos = null;
      }
      if (FZ.no && !FZ.pos && pos[FZ.no]) FZ.pos = pos[FZ.no].slice();
      order.forEach(tier => nodes.filter(n => n.getAttribute('data-tier')===tier).forEach(n => {
        const no = n.getAttribute('data-idea');
        const p = parse(n);
        const par = n.getAttribute('data-parent') || '0';
        const c = pos[par] || CENTER;
        const target = orbitPos(c, p, t, pulse);
        if (FZ.no === no && FZ.pos) { pos[no] = FZ.pos.slice(); return; }
        pos[no] = target;
      }));
      if (FZ.from) {
        const k = Math.min(1, (now - FZ.t0)/420), e = 1-Math.pow(1-k,3);
        const no = FZ.releaseNo, cur = pos[no];
        const rn = nodes.find(n => n.getAttribute('data-idea') === no);
        const tgt = rn ? orbitPos(pos[rn.getAttribute('data-parent')||'0'] || CENTER, parse(rn), t, pulse) : null;
        if (cur && tgt) { cur[0]=FZ.from[0]+(tgt[0]-FZ.from[0])*e; cur[1]=FZ.from[1]+(tgt[1]-FZ.from[1])*e; }
        if (k>=1) FZ.from = null;
      }
      /* Step2: 引力/排斥 —— 过近节点互相推开（每帧重算，不累积漂移） */
      const ids = nodes.map(n => n.getAttribute('data-idea'));
      const MIN = 30, PUSH = 0.9;
      const ROUNDS = ids.length > 150 ? 0 : (ids.length > 140 ? 1 : 3);   /* v54 PERF: 节点>150 直接关排斥，仅保留椭圆轨道旋转；实测 CPU 再降约50% */
      for (let it=0; it<ROUNDS; it++) {
        for (let i=0; i<ids.length; i++) for (let j=i+1; j<ids.length; j++) {
          const a=pos[ids[i]], b=pos[ids[j]]; if(!a||!b) continue;
          const dx=b[0]-a[0], dy=b[1]-a[1]; const d=Math.hypot(dx,dy);
          if (d>0.01 && d<MIN) {
            const f=(MIN-d)/d*PUSH, fx=dx*f*0.5, fy=dy*f*0.5;
            a[0]-=fx; a[1]-=fy; b[0]+=fx; b[1]+=fy;
          } else if (d<=0.01) { a[0]-=0.5; b[0]+=0.5; }
        }
      }
      /* Step3: 分轴柔性边界力（横向宽松、纵向收紧，多轮软推回但不钳死成线） */
      const BX=18, BY=14, BP=0.5;   // v39：星点自由舒展，页面边界即极限；倾角收紧后自然不越界，力仅兜底不挤线
      for (let b=0; b<4; b++) nodes.forEach(n => {
        const xy=pos[n.getAttribute('data-idea')]; if(!xy) return;
        if(xy[0]<BX) xy[0]+=(BX-xy[0])*BP; else if(xy[0]>1800-BX) xy[0]-=(xy[0]-(1800-BX))*BP;
        if(xy[1]<BY) xy[1]+=(BY-xy[1])*BP; else if(xy[1]>900-BY) xy[1]-=(xy[1]-(900-BY))*BP;
      });
      nodes.forEach(n => {
        const no=n.getAttribute('data-idea'), xy=pos[no]; if(!xy) return;
        const x=xy[0], y=xy[1];
        n.querySelector('.star').setAttribute('cx', x); n.querySelector('.star').setAttribute('cy', y);
        /* v56: 命中用数学坐标、标签仅hover显示，故 hit/pt 无需每帧写入 */
      });
      /* v60: 连线分级更新——hover 时高亮线必须跟随公转的子节点，否则实线端点脱节；
         非 hover 时细线仍按 v56 10fps 刷新（opacity .10 无感），保留省写入收益 */
      const hov = window.__orbitFreeze ? window.__orbitFreeze.no : null;
      const hi = hov != null;
      const updAll = !tick._lk || (now - tick._lk >= 100);        /* 非 hover：细线 10fps 全量 */
      const updHi = hi && (!tick._lkh || (now - tick._lkh >= 33)); /* hover 中：高亮线 30fps 跟随 */
      if (updAll) tick._lk = now;
      if (updHi) tick._lkh = now;
      links.forEach(l => {
        if(!updAll && !(updHi && l.el.classList.contains('hl'))) return;
        const pa=pos[l.a]||CENTER, pb=pos[l.b]||CENTER;
        if(l.path){ const mx=(pa[0]+pb[0])/2, my=(pa[1]+pb[1])/2-60; l.el.setAttribute('d', 'M'+pa[0]+' '+pa[1]+' Q'+mx+' '+my+' '+pb[0]+' '+pb[1]); }
        else { l.el.setAttribute('x1',pa[0]); l.el.setAttribute('y1',pa[1]); l.el.setAttribute('x2',pb[0]); l.el.setAttribute('y2',pb[1]); }
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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
      const inToc = this.slides[this.current] && this.slides[this.current].classList.contains('toc-tree');
      if (inToc && (k === 'ArrowDown' || k === 'ArrowUp' || k === 'PageDown' || k === 'PageUp' || k === ' ' || k === 'Home' || k === 'End')) return;  // 目录页：上下键留给原生滚动，不翻页
      switch (k) {
        case 'ArrowRight': e.preventDefault(); this.next(); break;
        case 'ArrowLeft': e.preventDefault(); this.prev(); break;
        case 'ArrowDown': case ' ': case 'PageDown': e.preventDefault(); this.next(); break;
        case 'ArrowUp': case 'PageUp': e.preventDefault(); this.prev(); break;
        case 'Home': e.preventDefault(); this.show(0); break;
        case 'End': e.preventDefault(); this.show(this.slides.length - 1); break;
        case 'q': case 'Q': case 't': case 'T': e.preventDefault(); this.show(TOC_INDEX); break;
        case 'w': case 'W': e.preventDefault(); { const mi = NAVMAP_INDEX; if (mi >= 0) this.show(mi); } break;
        case 'e': case 'E': e.preventDefault(); if (window.__orbitFreeze) window.__orbitFreeze.no = null; this.toggleCruise && this.toggleCruise(); break;
        case 'r': case 'R': e.preventDefault(); { const sh = document.querySelector('[data-speed-hit]'); if (sh) sh.click(); } break;
        case 'z': case 'Z': e.preventDefault(); this.undo(); break;
        case 'n': case 'N': e.preventDefault(); this.toggleNav(this.slides[this.current]); break;
        case 'Escape': e.preventDefault(); this.closeNav(); break;
        case 'f': case 'F': document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); break;
        case 'g': case 'G': window.music && window.music.toggle(); break;
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
      const cur = this.slides[this.current];
      if (cur && cur.classList.contains('toc-tree')) return;  // 目录页：滚轮留给 .tree-wrap 原生纵向滚动
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
    /* v57 UX：树状目录——单击跳观点、双击折叠（与多重深读版一致） */
    document.querySelectorAll('.tree-wrap .tr-row').forEach(row => {
      row.style.cursor = 'pointer';
      const doFold = () => {
        if (!row.hasAttribute('data-toggle')) return;
        const no = row.getAttribute('data-idea');
        const box = row.parentElement.querySelector(\`:scope > .tr-children[data-children-of="\${no}"]\`)
          || row.nextElementSibling;
        if (box && box.classList.contains('tr-children')) {
          const open = box.style.display !== 'none';
          box.style.display = open ? 'none' : 'block';
          const ar = row.querySelector('.tr-arrow');
          if (ar) ar.textContent = open ? '▸' : '▾';
          this.actionStack.push({ type:'tree', no:no, open:open });
        }
      };
      const doJump = () => {
        const no = row.getAttribute('data-idea');
        const pg = NO_TO_PAGE[no];
        if (pg != null) this.show(pg);
      };
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        clearTimeout(row._clickTimer);
        row._clickTimer = setTimeout(doJump, 220);   /* 延迟跳转，给双击留窗口 */
      });
      row.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        clearTimeout(row._clickTimer);   /* 取消两次单击的跳转 */
        doFold();
      });
    });
    document.querySelectorAll('.insight-item').forEach((row, i) => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => this.show(INSIGHT_ORDER[i]));
    });
    /* 本书定制：点云节点悬停 → 显示内容＋垂直/横向关联＋高亮紫色关联线 */
    const mapSlide = document.querySelector('.slide.navmap');
    if (mapSlide) {
      const info = mapSlide.querySelector('[data-map-info]');
      const body = mapSlide.querySelector('[data-map-info-body]');
      const empty = mapSlide.querySelector('.mi-empty');
      const allLinks = [...mapSlide.querySelectorAll('.vlink,.hlink')];
      const nodesMap = {};
      [...mapSlide.querySelectorAll('.sky-node')].forEach(n => { nodesMap[n.getAttribute('data-idea')] = n; });
      const TIER_LABEL = { book:'◉ 本书', core:'◆ 核心观点', layer:'◇ 分层观点', foundation:'· 根基支撑' };
      const listHtml = (arr, cls) => {
        if (!arr || !arr.length) return '';
        return arr.map(no => { const n = nodesMap[String(no)]; const t = n ? (n.getAttribute('data-title')||n.getAttribute('data-point')) : String(no);
          const hn = n ? (n.getAttribute('data-hn')||String(no)) : String(no);
          return \`<div class="mi-row \${cls}" data-idea="\${no}">\${hn} \${t}</div>\`; }).join('');
      };
      /* 点亮某节点（hover 与巡游共用） */
      function showNodeInfo(node) {
        if (!node) return;
        /* v56: 标签仅在点亮时定位一次（平时不写），从 star 当前 cx/cy 取值 */
        const _pt = node.querySelector('.pt'), _star = node.querySelector('.star');
        if(_pt && _star){
          const _x = +(_star.getAttribute('cx')||744), _y = +(_star.getAttribute('cy')||440);
          const _off = _x>1500 ? -(_pt.textContent.length*8+12) : 12;
          _pt.setAttribute('x', _x+_off); _pt.setAttribute('y', _y+5);
        }
        const no = node.getAttribute('data-idea');
        const tier = node.getAttribute('data-tier');
        const title = node.getAttribute('data-title') || '';
        const parent = node.getAttribute('data-parent') ? [node.getAttribute('data-parent')] : [];
        const children = (node.getAttribute('data-children')||'').split(',').filter(Boolean);
        const refs = (node.getAttribute('data-refs')||'').split(',').filter(Boolean);
        mapSlide.querySelector('[data-mi-tier]').textContent = TIER_LABEL[tier] || '';
        mapSlide.querySelector('[data-mi-title]').textContent = title;
        let vertHtml = '';
        if (parent.length) vertHtml += \`<div class="mi-label vert">上层关联（\${parent.length}）</div>\${listHtml(parent,'up')}\`;
        if (children.length) vertHtml += \`<div class="mi-label vert">向下垂直关联（\${children.length}）</div>\${listHtml(children,'down')}\`;
        mapSlide.querySelector('[data-mi-vert]').innerHTML = vertHtml;
        mapSlide.querySelector('[data-mi-cross]').innerHTML = refs.length
          ? \`<div class="mi-label cross">横向关联（\${refs.length}）</div>\${listHtml(refs,'cross')}\` : '';
        if (infoPanel) { infoPanel.style.visibility = 'visible'; infoPanel.classList.add('vis'); }
        empty.style.display = 'none'; body.style.display = 'block';
        const related = new Set([no, ...parent, ...children, ...refs].map(String));
        allLinks.forEach(l => {
          const hit = related.has(l.getAttribute('data-a')) && related.has(l.getAttribute('data-b'));
          l.classList.toggle('hl', hit);
        });
        Object.keys(nodesMap).forEach(k => { nodesMap[k].classList.toggle('dim', !related.has(k)); nodesMap[k].classList.remove('hot'); });
        node.classList.add('hot');
      }
      const infoPanel = mapSlide.querySelector('[data-map-info]');
      let hoveredNo = null;
      /* 最近距离命中：鼠标在图区移动时选最近的星点，避免密集处命中错误节点 */
      const wrap = mapSlide.querySelector('.navmap-wrap');
      const svgElHover = mapSlide.querySelector('.navmap-wrap svg');
      const centerOf = (node) => { const c = node.querySelector('.star'); return c ? [ +c.getAttribute('cx'), +c.getAttribute('cy') ] : null; };
      function pickNearest(evt, base) {
        const lim = base || 26;   // 命中阈值（viewBox 单位）
        const rect = svgElHover.getBoundingClientRect();
        const vb = svgElHover.viewBox.baseVal;
        const sc = Math.min(rect.width/vb.width, rect.height/vb.height);
        const ox = rect.left + (rect.width - vb.width*sc)/2, oy = rect.top + (rect.height - vb.height*sc)/2;
        const mx = (evt.clientX - ox)/sc, my = (evt.clientY - oy)/sc;
        let best = null, bestD = lim;
        mapSlide.querySelectorAll('.sky-node').forEach(node => {
          const c = centerOf(node); if (!c) return;
          const d = Math.hypot(c[0]-mx, c[1]-my);
          const r = (node.getAttribute('data-tier')==='book' ? lim*1.3 : lim);
          if (d < r && d < bestD) { bestD = d; best = node; }
        });
        return best;
      }
      /* v32：星点持续移动，鼠标静止时节点会飘离命中点。用 rAF 持续跟随最后鼠标坐标重新命中，
         保证 hover 高亮（实线/虚线/侧栏）始终跟随当前位置，而非只在 mousemove 那一瞬。 */
      let lastMouse = null, mouseIn = false;
      const updateHover = () => {
        if (cruiseOn || !mouseIn || !lastMouse) return;
        const node = pickNearest(lastMouse);
        const no = node ? node.getAttribute('data-idea') : null;
        if (no !== hoveredNo) {
          hoveredNo = no;
          if (node) { this.stopCruise && this.stopCruise(); showNodeInfo(node); if (window.__orbitFreeze) window.__orbitFreeze.no = no; }
          else { if (window.__orbitFreeze) window.__orbitFreeze.no = null; clearSky(); }
        }
      };
      /* v32：document 级监听 + 坐标范围判断，避免 wrap 子元素(星点/侧栏)吞掉 mouseenter 导致漏检 */
      document.addEventListener('mousemove', (e) => {
        const r = svgElHover.getBoundingClientRect();
        const inside = e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom;
        if (inside) { mouseIn = true; lastMouse = { clientX:e.clientX, clientY:e.clientY }; }
        else if (mouseIn) { mouseIn = false; lastMouse = null; clearSky(); }
      });
      const hoverLoop = () => { if (window.__navActive) updateHover(); requestAnimationFrame(hoverLoop); };   /* v53 PERF: 非星云页停算 */
      requestAnimationFrame(hoverLoop);
      function clearSky() {
        hoveredNo = null;
        if (window.__orbitFreeze) window.__orbitFreeze.no = null;
        if (infoPanel) { infoPanel.style.visibility = 'hidden'; infoPanel.classList.remove('vis'); }
        allLinks.forEach(l => l.classList.remove('hl'));
        Object.keys(nodesMap).forEach(k => { nodesMap[k].classList.remove('dim'); nodesMap[k].classList.remove('hot'); });
      }
      /* 兜底：鼠标离开整个图区（含快速划过/落到侧栏）必清除，杜绝文字残留 */
      if (wrap) wrap.addEventListener('mouseleave', clearSky);
      mapSlide.addEventListener('mouseleave', clearSky);
      /* ===== 星际巡游：按目录顺序飞到下一颗星，侧栏显示该观点 ===== */
      const ship = mapSlide.querySelector('[data-cruise-ship]');
      const cruiseBtn = mapSlide.querySelector('[data-cruise-toggle]');
      const speedRange = mapSlide.querySelector('[data-speed-range]');
      const speedVal = mapSlide.querySelector('[data-speed-val]');
      const svgEl = mapSlide.querySelector('.navmap-wrap svg');
      const cruiseOrder = Object.keys(NO_TO_PAGE).map(Number).sort((a,b)=>a-b);
      const SPEEDS = [ {n:'第一',ms:31700,label:'31.7s'}, {n:'第二',ms:22400,label:'22.4s'}, {n:'第三',ms:15000,label:'15s'} ];  // v52：第一/第三飞行时间翻转（第一=31.7s 最慢，第三=15s 最快）
      let cruiseIdx = 0, cruiseTimer = null, cruiseOn = false;
      const curSpeed = () => SPEEDS[+(speedRange && speedRange.value) || 0];
      if (speedRange && speedVal) speedRange.addEventListener('input', () => {
        const s = curSpeed(); speedVal.textContent = s.n + '宇宙速度';
        if (cruiseOn) { clearInterval(cruiseTimer); cruiseTimer = setInterval(cruiseTick, s.ms); }
      });
      const speedHit = mapSlide.querySelector('[data-speed-hit]');
      if (speedHit && speedRange) speedHit.addEventListener('click', (e) => {
        e.stopPropagation();
        speedRange.value = String(((+speedRange.value || 0) + 1) % SPEEDS.length);
        speedRange.dispatchEvent(new Event('input'));
      });
      const nodePos = (no) => { const n = nodesMap[String(no)]; if (!n) return null; const c = n.querySelector('.star'); return c ? [ +c.getAttribute('cx'), +c.getAttribute('cy') ] : null; };
      function flyTo(no) {
        const pos = nodePos(no); const node = nodesMap[String(no)];
        if (!pos || !node) return;
        const vb = svgEl.viewBox.baseVal, rect = svgEl.getBoundingClientRect();
        const sc = Math.min(rect.width / vb.width, rect.height / vb.height);
        const px = (pos[0] - vb.x) * sc + (rect.width - vb.width*sc)/2;
        const py = (pos[1] - vb.y) * sc + (rect.height - vb.height*sc)/2;
        ship.style.left = px + 'px'; ship.style.top = py + 'px';
        ship.dataset.pos = pos.join(',');
        showNodeInfo(node);
      }
      function cruiseTick() { cruiseIdx = (cruiseIdx+1) % cruiseOrder.length; flyTo(cruiseOrder[cruiseIdx]); }
      this.stopCruise = () => { if (cruiseTimer) { clearInterval(cruiseTimer); cruiseTimer = null; } cruiseOn = false; if (ship) { ship.style.display='none'; ship.classList.remove('cruising'); } if (cruiseBtn) { cruiseBtn.classList.remove('on'); cruiseBtn.querySelector('.ct-state').textContent='OFF'; } };
      this.toggleCruise = () => {
        if (cruiseOn) { this.stopCruise(); return; }
        cruiseOn = true; ship.style.display='block'; ship.classList.add('cruising');
        cruiseBtn.classList.add('on'); cruiseBtn.querySelector('.ct-state').textContent='ON';
        showNodeInfo(null); Object.keys(nodesMap).forEach(k=>nodesMap[k].classList.remove('hot'));
        flyTo(cruiseOrder[cruiseIdx]);
        if (cruiseTimer) clearInterval(cruiseTimer);
        cruiseTimer = setInterval(cruiseTick, curSpeed().ms);
      };
      if (cruiseBtn) cruiseBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleCruise(); });
      /* 拖拽飞船到某星点附近：展示该点并从该点继续顺序巡游 */
      if (ship) {
        let dragging = false;
        ship.addEventListener('mousedown', (e) => { if (!cruiseOn) return; e.preventDefault(); dragging = true; ship.classList.add('dragging'); ship.style.transition = 'none'; e.stopPropagation(); });
        document.addEventListener('mousemove', (e) => {
          if (!dragging) return;
          const wrapRect = wrap.getBoundingClientRect();
          ship.style.left = (e.clientX - wrapRect.left) + 'px';
          ship.style.top = (e.clientY - wrapRect.top) + 'px';
        });
        document.addEventListener('mouseup', (e) => {
          if (!dragging) return;
          dragging = false; ship.classList.remove('dragging'); ship.style.transition = '';
          const node = pickNearest(e, 36);
          if (node) {
            const no = node.getAttribute('data-idea');
            const idx = cruiseOrder.indexOf(+no);
            if (idx >= 0) cruiseIdx = idx;
            flyTo(+no);
            if (cruiseOn) { if (cruiseTimer) clearInterval(cruiseTimer); cruiseTimer = setInterval(cruiseTick, curSpeed().ms); }
          } else if (ship.dataset.pos) {
            const p = ship.dataset.pos.split(',').map(Number);
            ship.style.left = ''; ship.style.top = '';
            const node0 = nodesMap[ship.dataset.cruiseNo] || nodesMap[String(cruiseOrder[cruiseIdx])];
            if (node0) flyTo(+node0.getAttribute('data-idea'));
          }
        });
      }
    }
    /* 本书定制：编号跳转（结构地图节点 / 导航面板条目） */
    const jumpByIdea = (el) => {
      const no = el.getAttribute('data-idea');
      const pg = NO_TO_PAGE[no];
      if (pg != null) { this.closeNav(); this.show(pg); }
    };
    document.querySelectorAll('[data-idea]').forEach(el => { el.style.cursor = 'pointer'; });
    document.addEventListener('click', (e) => {
      const t = e.target.closest ? e.target.closest('[data-idea]') : null;
      if (t) { e.stopPropagation(); jumpByIdea(t); }
    });
    /* 层级导航 overlay 开关 */
    document.querySelectorAll('[data-nav-open]').forEach(el => {
      el.addEventListener('click', (e) => { e.stopPropagation(); this.toggleNav(el.closest('.slide')); });
    });
    document.querySelectorAll('[data-nav-close]').forEach(el => {
      el.addEventListener('click', (e) => { e.stopPropagation(); this.closeNav(); });
    });
  }
  toggleNav(slide) {
    if (!slide) return;
    const ov = slide.querySelector('[data-nav-overlay]');
    if (!ov) return;
    const open = ov.classList.toggle('open');
    this.navOpen = open;
  }
  closeNav() {
    document.querySelectorAll('[data-nav-overlay].open').forEach(ov => ov.classList.remove('open'));
    this.navOpen = false;
  }
  next() { this.show(this.current + 1); }
  prev() { this.show(this.current - 1); }
  show(i, silent) {
    const target = Math.max(0, Math.min(i, this.slides.length - 1));
    if (!silent && target !== this.current) this.actionStack.push({ type:'page', from:this.current });
    this.closeNav();
    if (this.stopCruise && target !== NAVMAP_INDEX) this.stopCruise();
    this.current = target;
    this.slides.forEach((s, k) => { s.classList.toggle('active', k === this.current); s.classList.toggle('visible', k === this.current); });
    if (target === NAVMAP_INDEX && this._orbitEnter) this._orbitEnter();
    if (window.music && window.music.setScene) window.music.setScene(target === NAVMAP_INDEX ? 'nebula' : 'other');
    history.replaceState(null, '', '#' + (this.current + 1));
  }
  undo() {
    const a = this.actionStack.pop();
    if (!a) return;
    if (a.type === 'page') this.show(a.from, true);
    else if (a.type === 'tree') {
      const box = document.querySelector(\`.tr-children[data-children-of="\${a.no}"]\`);
      const row = document.querySelector(\`.tr-row[data-idea="\${a.no}"][data-toggle]\`);
      if (box) box.style.display = a.open ? 'block' : 'none';
      if (row) { const ar = row.querySelector('.tr-arrow'); if (ar) ar.textContent = a.open ? '▾' : '▸'; }
      if (!this.slides[this.current].classList.contains('toc-tree')) this.show(TOC_INDEX, true);
    }
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
    this.nebula = NEBULA_AUDIO_SRC ? new Audio(NEBULA_AUDIO_SRC) : null;
    [this.audio, this.nebula].forEach(a => { if (a) { a.loop = true; a.volume = 0.35; } });
    this.playing = false; this.scene = 'other'; this.nebulaTime = 0; this.normalTime = 0;
    this.ico = document.getElementById('musicIco'); this.txt = document.getElementById('musicTxt');
    this.btn.addEventListener('click', () => this.toggle());
  }
  get current() { return this.scene === 'nebula' && this.nebula ? this.nebula : this.audio; }
  toggle() {
    if (this.playing) { this.current.pause(); this.playing = false; }
    else { this.current.play().catch(() => {}); this.playing = true; }
    this.btn.classList.toggle('playing', this.playing);
    this.ico.textContent = 'G';
    this.txt.textContent = this.playing ? 'MUSIC ON' : 'MUSIC OFF';
  }
  /* 深读版：星云页切专用曲，离开切回默认曲；音量一致(0.35)，记忆各曲进度 */
  setScene(scene) {
    if (!this.nebula || scene === this.scene) return;
    const from = this.current;
    if (this.playing) from.pause();
    if (scene === 'nebula') this.normalTime = this.audio.currentTime || 0;
    else this.nebulaTime = this.nebula.currentTime || 0;
    this.scene = scene;
    const to = this.current;
    to.currentTime = scene === 'nebula' ? (this.nebulaTime || 0) : (this.normalTime || 0);
    if (this.playing) to.play().catch(() => {});
  }
}
window.music = new MusicPlayer();
/* v58: 音乐默认关闭，不做自动播放/首次交互恢复；仅用户点按钮或按 G 才播放 */

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
/* 灯光开关 H */
(function(){
  var btn=document.getElementById('lightsToggle'), txt=document.getElementById('lightsTxt');
  var off=false;
  function setOff(v){ off=v; document.body.classList.toggle('lights-off',off); if(btn) btn.classList.toggle('on',off); if(txt) txt.textContent = off ? 'LIGHT OFF' : 'LIGHT ON'; }
  if(btn) btn.addEventListener('click',function(e){ e.stopPropagation(); setOff(!off); });
  document.addEventListener('keydown',function(e){ if(e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return; if(e.key==='h'||e.key==='H'){ e.preventDefault(); setOff(!off); } });
})();
</script>
</body>
</html>
`;

const shipPath = path.join(SKILL_DIR, 'assets', 'ship.png');
const shipData = fs.existsSync(shipPath)
  ? 'data:image/png;base64,' + fs.readFileSync(shipPath).toString('base64')
  : '';
fs.writeFileSync(OUT_PATH, html.replace(/__TOTAL_PAGES__/g, pad(PAGE.length)).replace(/__SHIP_DATA__/g, shipData), 'utf8');
console.log('SAVED:', OUT_PATH);
console.log('SLIDES:', PAGE.length, '| IDEAS:', TOTAL, '| DOCS:', docs.length);
console.log('BYTES:', fs.statSync(OUT_PATH).size, '| MUSIC:', musicMode, '| DUAL:', dualMusic);
