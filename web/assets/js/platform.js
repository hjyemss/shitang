/* ============================================================
   平台内核 Platform
   ------------------------------------------------------------
   三件事：
   1) 数据：优先 fetch data/*.json（便于合作方直接改 JSON），
      失败则回落到 assets/js/data.js 内联数据（file:// 直接双击打开）
   2) 注册：registerPage / registerModule / registerDataSource，
      三方各自开发自己的板块，只需要往平台里注册，不用改别人的代码
   3) 渲染：统一 UI 组件（hero / kpi / panel / table / badge …）
   ============================================================ */
(function (global) {
  const DATA_FILES = ['manifest', 'overview', 'queue', 'floors', 'nutrition', 'extensions'];

  const Platform = {
    version: '1.0.0',
    data: {},
    pages: [],
    modules: [],
    dataSources: {},
    ui: {},
    _ready: []
  };

  /* --------------------------------------------------------- 数据加载 */
  Platform.load = async function () {
    const inline = global.__PLATFORM_DATA__ || {};
    for (const name of DATA_FILES) {
      let payload = null;
      // 只有 http(s) 下才去 fetch 外部 JSON；file:// 与 srcdoc 直接用内联数据
      const canFetch = location.protocol === 'http:' || location.protocol === 'https:';
      if (canFetch) {
        try {
          const res = await fetch('data/' + name + '.json', { cache: 'no-store' });
          if (res.ok) payload = await res.json();
        } catch (e) {
          // http 下取不到就退回内联数据
        }
      }
      if (!payload) payload = inline[name] || null;
      Platform.data[name] = payload;
    }
    Platform.data._inline = JSON.stringify(inline).length > 2;
    return Platform.data;
  };

  /* --------------------------------------------------------- 注册接口 */
  // 新增一个导航页：{ id, label, icon, eyebrow, render(root, ctx) }
  Platform.registerPage = function (def) {
    if (!def || !def.id) throw new Error('registerPage 需要 id');
    Platform.pages.push(def);
    return def;
  };

  // 声明一个业务模块（显示在总览的「模块接入状态」里）
  Platform.registerModule = function (def) {
    Platform.modules.push(def);
    return def;
  };

  // 注册实时数据源：fn() 返回与 JSON 同构的对象，覆盖 mock 数据
  Platform.registerDataSource = function (key, fn) {
    Platform.dataSources[key] = fn;
    return fn;
  };

  // 应用已注册的实时数据源（页面渲染前调用一次）
  Platform.applyDataSources = async function () {
    for (const key of Object.keys(Platform.dataSources)) {
      try {
        const out = await Platform.dataSources[key]();
        if (out) Platform.data[key] = out;
      } catch (e) {
        console.warn('[platform] 数据源失败：' + key, e);
      }
    }
  };

  Platform.getPage = function (id) {
    return Platform.pages.find(p => p.id === id) || null;
  };

  /* --------------------------------------------------------- 小工具 */
  const html = (s) => String(s === null || s === undefined ? '' : s);

  Platform.esc = function (s) {
    return html(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  };

  Platform.num = function (v) {
    const n = Number(v);
    if (!isFinite(n)) return html(v);
    return n.toLocaleString('zh-CN');
  };

  Platform.toneOf = function (tone) {
    const map = { ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', accent: 'var(--accent)', flat: 'var(--dim)' };
    return map[tone] || 'var(--accent)';
  };

  Platform.badgeClass = function (tone) {
    const map = { ok: 'tag-ok', warn: 'tag-warn', danger: 'tag-danger', accent: 'tag-info', info: 'tag-info' };
    return map[tone] || 'tag-muted';
  };

  /* --------------------------------------------------------- UI 组件 */
  const ui = Platform.ui;

  // 顶部横幅
  ui.hero = function (hero) {
    if (!hero) return '';
    const stats = (hero.stats || []).map(s =>
      '<div class="hero-stat"><div class="k">' + Platform.esc(s.label) + '</div>' +
      '<div class="v">' + Platform.esc(s.value) + '</div>' +
      '<div class="s">' + Platform.esc(s.sub) + '</div></div>').join('');
    return '<section class="hero"><div class="hero-main">' +
      '<span class="hero-eyebrow">' + Platform.esc(hero.eyebrow) + '</span>' +
      '<h1>' + Platform.esc(hero.title) + '</h1>' +
      '<p>' + Platform.esc(hero.subtitle) + '</p>' +
      '</div><div class="hero-stats">' + stats + '</div></section>';
  };

  // 指标卡
  ui.kpi = function (k) {
    const tone = Platform.toneOf(k.tone);
    const trendIcon = k.trend === 'up' ? 'trend' : k.trend === 'down' ? 'trend' : 'info';
    return '<div class="kpi" style="--tone:' + tone + '">' +
      '<div class="kpi-head"><span class="kpi-ico">' + icon(k.icon || 'info', 14) + '</span>' +
      '<span>' + Platform.esc(k.label) + '</span></div>' +
      '<div class="kpi-value"><b>' + Platform.esc(k.value) + '</b>' +
      (k.unit ? '<span>' + Platform.esc(k.unit) + '</span>' : '') + '</div>' +
      '<div class="kpi-foot">' +
      (k.delta ? '<span class="chip">' + icon(trendIcon, 11) + Platform.esc(k.delta) + '</span>' : '<span></span>') +
      '<span class="kpi-src">' + Platform.esc(k.source || '') + '</span>' +
      '</div></div>';
  };

  ui.kpis = function (list) {
    return '<div class="kpis">' + (list || []).map(ui.kpi).join('') + '</div>';
  };

  // 面板
  ui.panel = function (opt) {
    const head = '<div class="panel-head"><div>' +
      '<div class="panel-title">' + (opt.icon ? icon(opt.icon, 15) : '') + Platform.esc(opt.title || '') + '</div>' +
      (opt.sub ? '<div class="panel-sub">' + Platform.esc(opt.sub) + '</div>' : '') +
      '</div>' + (opt.tag ? '<div class="panel-tag">' + Platform.esc(opt.tag) + '</div>' : '') + '</div>';
    return '<section class="panel ' + (opt.cls || '') + '">' + head + (opt.body || '') + '</section>';
  };

  // 表格：headers 数组，rows 二维数组（单元格可含 HTML，需自行转义）
  ui.table = function (headers, rows, opt) {
    opt = opt || {};
    const th = headers.map((h, i) => '<th class="' + (opt.numFrom && i >= opt.numFrom ? 'num' : '') + '">' + Platform.esc(h) + '</th>').join('');
    const tr = rows.map(r => '<tr>' + r.map((c, i) =>
      '<td class="' + (opt.numFrom && i >= opt.numFrom ? 'num' : '') + '">' + (opt.raw ? c : Platform.esc(c)) + '</td>').join('') + '</tr>').join('');
    return '<table class="table"><thead><tr>' + th + '</tr></thead><tbody>' + tr + '</tbody></table>';
  };

  ui.badge = function (text, tone) {
    return '<span class="badge ' + Platform.badgeClass(tone) + '">' + Platform.esc(text) + '</span>';
  };

  ui.alert = function (text, opt) {
    opt = opt || {};
    const tone = opt.tone || (opt.ok ? 'ok' : 'danger');
    const ico = tone === 'ok' ? 'check' : tone === 'info' ? 'info' : 'alert';
    return '<div class="alert ' + tone + '">' + icon(ico, 16) +
      '<div>' + Platform.esc(text) + '</div></div>';
  };

  ui.barRow = function (label, pct, tone) {
    return Charts.progress({ label: label, value: pct, tone: Platform.toneOf(tone) });
  };

  const LEVEL_LABEL = { info: '提示', warn: '警告', warning: '警告', error: '严重', critical: '严重', ok: '正常' };

  ui.timeline = function (items) {
    const rows = (items || []).map(it => {
      const raw = String(it.level || 'info').toLowerCase();
      const emo = (raw === 'warn' || raw === 'warning' || raw === 'error' || raw === 'critical' || it.level === '警告' || it.level === '严重');
      const tone = emo ? 'danger' : 'accent';
      const text = LEVEL_LABEL[raw] || it.level;
      return '<div class="tl-item"><span class="tl-time">' + Platform.esc(it.time) + '</span>' +
        ui.badge(text, tone) +
        '<span class="tl-text">' + Platform.esc(it.text) + '</span></div>';
    }).join('');
    return '<div class="timeline">' + rows + '</div>';
  };

  ui.moduleRow = function (m) {
    const tone = m.status === 'running' ? 'ok' : m.status === 'mock' ? 'accent' : 'warn';
    const label = m.status === 'running' ? '运行中' : m.status === 'mock' ? '模拟数据' : '待接入';
    return '<div class="module"><span class="m-ico">' + icon(m.icon || 'plug', 14) + '</span>' +
      '<div class="m-body"><div class="m-name">' + Platform.esc(m.name) + '</div>' +
      '<div class="m-detail">' + Platform.esc(m.owner || '') + ' · ' + Platform.esc(m.detail || '') + '</div></div>' +
      ui.badge(label, tone) + '</div>';
  };

  ui.cameras = function (list) {
    const cards = (list || []).map(c => {
      const online = c.status === 'online' || c.status === '在线';
      return '<div class="cam"><div class="cam-top"><span>' + Platform.esc(c.id) + '</span>' +
        ui.badge(online ? '在线' : '离线', online ? 'ok' : 'danger') + '</div>' +
        '<div class="cam-name">' + Platform.esc(c.name) + '</div>' +
        '<div class="cam-meta">' + Platform.esc(c.floor) + ' · ' + Platform.esc(c.resolution || '') +
        (c.fps ? ' · ' + c.fps + ' fps' : '') + '</div></div>';
    }).join('');
    return '<div class="cams">' + cards + '</div>';
  };

  ui.legend = function (items) {
    const parts = (items || []).map(i => '<span><i style="background:' + (i.color || Platform.toneOf(i.tone)) + '"></i>' +
      Platform.esc(i.name || i.label) + '</span>').join('');
    return '<div class="legend">' + parts + '</div>';
  };

  /* --------------------------------------------------------- 路由 */
  Platform.currentId = null;
  Platform.onNavigate = null;   // 由 app.js 注入

  // 纯内存路由：不写 location.hash / history，避免在 srcdoc 等受限容器里被浏览器拦截
  Platform.navigate = function (id, push) {
    if (!id || !Platform.getPage(id)) return;
    Platform.currentId = id;
    if (Platform.onNavigate) Platform.onNavigate(id);
  };

  /* --------------------------------------------------------- 启动 */
  Platform.boot = async function (opts) {
    await Platform.load();
    await Platform.applyDataSources();
    // 通用模块页（data/extensions.json 声明即可，零代码）
    if (typeof Platform.buildGenericPages === 'function') Platform.buildGenericPages();
    const hash = (location.hash || '').replace(/^#\/?/, '');
    const nav = (Platform.data.manifest && Platform.data.manifest.nav) || [];
    const first = nav.length ? nav[0].id : (Platform.pages[0] && Platform.pages[0].id);
    // 若以 #/xxx 打开则直接进该页，其余情况进第一页；全过程不碰浏览历史
    if (hash && Platform.getPage(hash)) {
      Platform.navigate(hash, false);
    } else {
      Platform.navigate(first, false);
    }

    // 主题（localStorage 在沙箱里可能不可用，取不到就用默认深色）
    try {
      const saved = global.localStorage && global.localStorage.getItem('canteen-theme');
      if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
    } catch (e) { /* 忽略：受限容器里没有存储权限 */ }

    Platform._ready.forEach(fn => fn(Platform));
    if (opts && opts.onReady) opts.onReady(Platform);
  };

  Platform.ready = function (fn) { Platform._ready.push(fn); };

  global.Platform = Platform;
})(window);
