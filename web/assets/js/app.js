/* ============================================================
   启动 & 外壳（侧边栏 / 顶栏 / 路由）
   ============================================================ */
(function (global) {
  const P = global.Platform;
  const ui = P.ui;
  const esc = P.esc;

  P.state = { studentIndex: 0 };

  const els = {
    sidebar: document.getElementById('sidebar'),
    topbar: document.getElementById('topbar'),
    view: document.getElementById('view'),
    foot: document.getElementById('foot'),
    toast: document.getElementById('toast')
  };

  let toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2600);
  }

  /* ------------------------------------------------------- 导航顺序 */
  function navItems() {
    const order = (P.data.manifest && P.data.manifest.nav) || [];
    const map = {};
    P.pages.forEach(p => { map[p.id] = p; });
    const items = [];
    order.forEach(o => { if (map[o.id]) { items.push(map[o.id]); delete map[o.id]; } });
    Object.keys(map).forEach(k => items.push(map[k]));
    return items;
  }

  /* ------------------------------------------------------- 侧边栏 */
  function renderSidebar(activeId) {
    const m = (P.data.manifest && P.data.manifest.brand) || {};
    const nav = navItems().map(p =>
      '<a class="nav-item' + (p.id === activeId ? ' active' : '') + '" href="#/' + p.id + '" data-id="' + p.id + '">' +
      icon(p.icon || 'grid', 16) + '<span>' + esc(p.label) + '</span></a>').join('');

    const mods = ((P.data.manifest && P.data.manifest.modules) || []).map(mod => {
      const tone = mod.status === 'running' ? 'ok' : mod.status === 'mock' ? 'accent' : 'warn';
      const text = mod.status === 'running' ? '运行中' : mod.status === 'mock' ? '模拟数据' : '待接入';
      return '<div class="status-row"><span>' + esc(mod.name) + '</span><b style="color:' +
        P.toneOf(tone) + '">' + text + '</b></div>';
    }).join('');

    els.sidebar.innerHTML =
      '<div class="brand"><div class="brand-mark">' + icon('grid', 20) + '</div>' +
      '<div><div class="brand-t">' + esc(m.title || '智慧食堂') + '</div>' +
      '<div class="brand-s">' + esc(m.subtitle || 'CONTROL CENTER') + '</div></div></div>' +
      '<div class="side-label">主导航 · NAVIGATION</div>' +
      '<nav class="nav">' + nav + '</nav>' +
      '<div class="side-label">系统状态 · STATUS</div>' +
      '<div class="status-list">' + mods + '</div>' +
      '<div class="side-foot">v' + esc(P.version) + ' · 静态演示版<br>数据源：data/*.json<br>' +
      '三个分模块接口已预留</div>';
  }

  /* ------------------------------------------------------- 顶栏 */
  function renderTopbar(page) {
    els.topbar.innerHTML =
      '<div class="crumb">控制中心 / <b>' + esc(page ? page.label : '') + '</b></div>' +
      '<div class="spacer"></div>' +
      '<span class="pill"><span class="dot"></span>系统运行中</span>' +
      '<button class="icon-btn" id="btn-theme" title="切换深色 / 浅色">' + icon('sun', 14) + '<span>主题</span></button>' +
      '<button class="icon-btn" id="btn-refresh" title="重新读取数据">' + icon('refresh', 14) + '<span>刷新</span></button>';

    els.topbar.querySelector('#btn-theme').addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = cur;
      try { localStorage.setItem('canteen-theme', cur); } catch (err) { /* 沙箱里忽略 */ }
      toast(cur === 'light' ? '已切换到浅色主题' : '已切换到深色主题');
    });

    els.topbar.querySelector('#btn-refresh').addEventListener('click', async () => {
      await P.load();
      renderPage(P.currentId || 'overview');
      toast('已重新读取 data/*.json');
    });
  }

  function allPages() {
    return navItems();
  }

  /* ------------------------------------------------------- 页脚 */
  function renderFoot() {
    const m = P.data.manifest || {};
    els.foot.innerHTML =
      '<span>演示数据 · 纯静态页面（' + (P.data._inline ? '内联数据' : 'data/*.json') + '），无需后端与安装</span>' +
      '<span>最近更新：' + esc(m.updated || '--') + ' · 平台 v' + esc(P.version) + '</span>';
  }

  /* ------------------------------------------------------- 路由渲染 */
  function renderPage(id) {
    const page = P.getPage(id) || P.pages[0];
    if (!page) {
      els.view.innerHTML = '<div class="empty">还没有注册任何页面</div>';
      return;
    }
    const ctx = {
      data: P.data,
      page: page,
      toast: toast,
      rerender: () => renderPage(page.id)
    };
    try {
      els.view.innerHTML = page.render(ctx) || '';
      if (page.mount) page.mount(els.view, ctx);
    } catch (err) {
      console.error(err);
      els.view.innerHTML = ui.alert('页面渲染出错：' + err.message);
    }
    renderSidebar(page.id);
    renderTopbar(page);
    renderFoot();
    document.title = page.label + ' · 人大附中智慧食堂综合调度中心';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  P.onNavigate = function (id) {
    P.currentId = id;
    renderPage(id);
  };

  // 导航点击：一律拦掉默认跳转，改用内存路由（在 srcdoc / 沙箱 iframe 里也不会报错）
  document.addEventListener('click', function (e) {
    const a = e.target.closest('.nav-item');
    if (!a) return;
    e.preventDefault();
    const id = a.dataset.id;
    if (id && id !== P.currentId) P.navigate(id);
  });

  /* ------------------------------------------------------- 启动 */
  async function start() {
    // boot 内部完成：加载数据 → 应用数据源 → 注册通用模块 → 按 hash 渲染首屏
    await P.boot({});
  }

  start().catch(err => {
    console.error(err);
    els.view.innerHTML = '<div class="empty">启动失败：' + esc(err.message) + '</div>';
  });
})(window);
