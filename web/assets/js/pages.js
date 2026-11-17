/* ============================================================
   五个页面
   ------------------------------------------------------------
   每个页面都是「一个 render 函数 + 可选 mount（绑定交互）」，
   想加新板块的人只要照抄一个 registerPage，不用碰别人代码。
   ============================================================ */
(function (global) {
  const P = global.Platform;
  const ui = P.ui;
  const C = global.Charts;
  const esc = P.esc;

  const PALETTE = ['var(--accent)', 'var(--ok)', 'var(--warn)', 'var(--accent2)', 'var(--danger)', '#a78bfa'];

  /* ======================================================= 1. 系统总览 */
  P.registerPage({
    id: 'overview',
    label: '系统总览',
    icon: 'grid',
    render: function (ctx) {
      const d = ctx.data.overview || {};
      const hourly = d.hourly || { categories: [], values: [] };
      const peak = hourly.values.indexOf(Math.max.apply(null, hourly.values || [0]));

      const hero = ui.hero(d.hero);
      const kpis = ui.kpis(d.kpis);

      const hourlyPanel = ui.panel({
        title: '今日就餐人次分布', sub: '按小时统计的进出场人流，用于预判拥堵时段', tag: 'TODAY / HOURLY', icon: 'trend',
        body: C.line({
          labels: hourly.categories, height: 250, width: 620,
          series: [{ name: '就餐人次', values: hourly.values, color: 'var(--accent)' }],
          markers: peak >= 0 ? [{ index: peak, value: hourly.values[peak], label: '峰值 ' + hourly.values[peak] }] : []
        }) + ui.legend([{ name: '就餐人次', color: 'var(--accent)' }, { name: '午高峰', color: 'var(--warn)' }])
      });

      const modulesPanel = ui.panel({
        title: '模块接入状态', sub: '三个业务板块与基础服务的连通情况', tag: 'MODULES', icon: 'plug',
        body: '<div class="modules">' + (d.modules || []).map(ui.moduleRow).join('') + '</div>'
      });

      const fl = (ctx.data.floors && ctx.data.floors.floors) || [];
      const seatTotal = fl.reduce((a, b) => a + b.seats, 0);
      const seatUsed = fl.reduce((a, b) => a + b.occupied, 0);

      const floorBars = (d.floors || []).map(f => {
        const tone = f.usage >= 80 ? 'danger' : f.usage >= 65 ? 'warn' : 'accent';
        return ui.barRow(f.name + ' · 座位占用', f.usage, tone);
      }).join('');

      const floorsPanel = ui.panel({
        title: '楼层承载', sub: '实时座位占用', tag: 'FLOORS', icon: 'layers',
        body: floorBars +
          '<div class="panel-sub" style="margin-top:10px">座位合计 ' + C.fmtInt(seatTotal) + ' · 在座 ' + C.fmtInt(seatUsed) +
          ' · 空余 ' + C.fmtInt(seatTotal - seatUsed) + '<br>占用超过 80% 时建议分流，等待时间会明显上升</div>'
      });

      const alertsPanel = ui.panel({
        title: '实时告警', sub: '按时间倒序，红色为需要立即处理', tag: 'ALERTS', icon: 'bell',
        body: ui.timeline(d.alerts)
      });

      const resPanel = ui.panel({
        title: '系统资源', sub: '采集自本地数据中台', tag: 'SYSTEM', icon: 'cpu',
        body: (d.resources || []).map(r =>
          ui.barRow(r.name, r.value, r.value >= 95 ? 'ok' : r.value >= 65 ? 'warn' : 'danger')).join('')
      });

      const notice = ui.alert(
        '集成说明：三个板块目前均由 data/*.json 提供演示数据。合作方接入真实硬件 / 算法后，' +
        '只需把结果写进对应 JSON（或注册一个数据源函数），本页所有指标、图表、告警会自动更新。',
        { tone: 'ok' });

      return hero + kpis +
        '<div class="grid-2">' + hourlyPanel + modulesPanel + '</div>' +
        '<div class="grid-3">' + floorsPanel + alertsPanel + resPanel + '</div>' +
        notice;
    }
  });

  /* ======================================================= 2. 排队拥堵监控 */
  P.registerPage({
    id: 'queue',
    label: '排队拥堵监控',
    icon: 'users',
    render: function (ctx) {
      const d = ctx.data.queue || {};
      const threshold = d.threshold || 20;

      const barsPanel = ui.panel({
        title: '各窗口排队人数', sub: '柱高为当前排队人数，红色虚线为拥挤阈值', tag: 'WINDOW / NOW', icon: 'trend',
        body: C.bars({
          width: 620,
          items: (d.windows || []).map(w => ({
            label: w.name.split('·')[0].trim(),
            value: w.people,
            tone: w.level === '拥挤' ? 'var(--danger)' : w.level === '一般' ? 'var(--warn)' : 'var(--ok)'
          })),
          threshold: { value: threshold, label: '拥挤阈值 ' + threshold + ' 人' },
          height: 300
        })
      });

      const rows = (d.windows || []).map(w => {
        const tone = w.level === '拥挤' ? 'danger' : w.level === '一般' ? 'warn' : 'ok';
        return [w.name, w.floor, w.people + ' 人', w.wait, ui.badge(w.level, tone)];
      });
      const tablePanel = ui.panel({
        title: '窗口实时明细', sub: '数据来自 data/queue.json 的最新快照', tag: 'SNAPSHOT', icon: 'database',
        body: ui.table(['窗口', '楼层', '排队', '预计等待', '拥挤度'], rows, { numFrom: 2, raw: true })
      });

      const trend = d.trend || { categories: [], series: [] };
      const trendPanel = ui.panel({
        title: '近 3 小时排队趋势', sub: '每 10 分钟一个采样点，可看出拥堵是否回落', tag: 'TREND / 3H', icon: 'trend',
        body: C.line({
          labels: trend.categories, height: 230, width: 1180,
          series: trend.series.map((s, i) => ({ name: s.name, values: s.values, color: PALETTE[i % PALETTE.length], area: false })),
          threshold: { value: threshold, label: '阈值 ' + threshold }
        }) + ui.legend(trend.series.map((s, i) => ({ name: s.name, color: PALETTE[i % PALETTE.length] })))
      });

      const camsPanel = ui.panel({
        title: '摄像头阵列', sub: '在线设备实时预览占位，第二阶段由 YOLO 服务推送检测流', tag: 'CAMERA GRID', icon: 'camera',
        body: ui.cameras(d.cameras)
      });

      const notice = ui.alert(
        '接口说明：本页只读 data/queue.json。CV 组把「窗口 → 排队人数」写进这个文件（或用 registerDataSource("queue", fn) 推送），' +
        '柱状图、明细表、告警条会同时刷新，前端不需要改一行代码。', { tone: 'info' });

      const toolbar = '<div class="field" style="align-items:center">' +
        '<button class="btn ghost" data-action="refresh">' + icon('refresh', 14) + ' 刷新监控数据</button>' +
        '<span class="kpi-src">最近一次快照：' + esc((d.hero && d.hero.stats && d.hero.stats[2] ? d.hero.stats[2].value : '--')) + '</span></div>';

      return ui.hero(d.hero) +
        (d.alert ? ui.alert(d.alert) : '') +
        ui.kpis(d.kpis) +
        '<div class="grid-2">' + barsPanel + tablePanel + '</div>' +
        trendPanel + camsPanel + notice + toolbar;
    },
    mount: function (root, ctx) {
      const btn = root.querySelector('[data-action="refresh"]');
      if (btn) btn.addEventListener('click', () => {
        ctx.toast('演示模式：真实接入后这里会重新拉取摄像头检测结果');
        ctx.rerender();
      });
    }
  });

  /* ======================================================= 3. 楼层分流建议 */
  P.registerPage({
    id: 'floors',
    label: '楼层分流建议',
    icon: 'layers',
    render: function (ctx) {
      const d = ctx.data.floors || {};
      const adv = d.advice || {};

      const advice = '<section class="advice">' +
        '<div class="a-eyebrow">' + icon('target', 12) + ' AI 分流建议 · 实时计算</div>' +
        '<h2>' + esc(adv.title || '') + '</h2>' +
        '<p>' + esc(adv.reason || '') + '</p>' +
        '<div class="a-badges">' + (adv.badges || []).map(b => ui.badge(b, 'ok')).join('') + '</div>' +
        '</section>';

      const share = d.share || [];
      const donutPanel = ui.panel({
        title: '各楼层就餐人数占比', sub: '按最后一次楼层快照统计', tag: 'SHARE', icon: 'pie',
        body: C.donut({
          items: share.map((s, i) => ({ label: s.name, value: s.value, color: PALETTE[i % PALETTE.length] })),
          centerValue: C.fmtInt(share.reduce((a, b) => a + b.value, 0)),
          centerLabel: '在餐总人数', size: 250
        })
      });

      const rows = (d.floors || []).map(f => [
        f.name, f.seats + ' 座', f.occupied, ui.badge(f.usage.toFixed(1) + '%', f.usage >= 80 ? 'danger' : f.usage >= 65 ? 'warn' : 'ok'), f.wait
      ]);
      const statePanel = ui.panel({
        title: '楼层实时状态', sub: '座位使用率 = 在座人数 ÷ 座位数', tag: 'FLOOR STATUS', icon: 'seat',
        body: ui.table(['楼层', '座位数', '在座', '使用率', '等待'], rows, { numFrom: 1, raw: true }) +
          '<div style="margin-top:8px">' + (d.floors || []).map(f =>
            ui.barRow(f.name, f.usage, f.usage >= 80 ? 'danger' : f.usage >= 65 ? 'warn' : 'accent')).join('') + '</div>'
      });

      const flow = d.flow || { categories: [], series: [] };
      const flowPanel = ui.panel({
        title: '三层人流分布（今日）', sub: '堆叠面积图展示各楼层分时就餐人数', tag: 'FLOW / TODAY', icon: 'layers',
        body: C.stacked({
          labels: flow.categories, height: 230, width: 1180,
          series: flow.series.map((s, i) => ({ name: s.name, values: s.values, color: PALETTE[i % PALETTE.length] }))
        }) + ui.legend(flow.series.map((s, i) => ({ name: s.name, color: PALETTE[i % PALETTE.length] })))
      });

      const notice = ui.alert(
        '接口说明：硬件组把多路摄像头的窗口级结果汇总成「楼层 → 在座 / 座位」写进 data/floors.json，' +
        '建议卡、环形图、状态表会按同一份数据重算，推荐算法也可以换成你们自己的实现。', { tone: 'info' });

      return ui.hero(d.hero) + advice + ui.kpis(d.kpis) +
        '<div class="grid-2">' + donutPanel + statePanel + '</div>' +
        flowPanel + notice;
    }
  });

  /* ======================================================= 4. 营养健康分析 */
  P.registerPage({
    id: 'nutrition',
    label: '营养健康分析',
    icon: 'leaf',
    render: function (ctx) {
      const all = (ctx.data.nutrition && ctx.data.nutrition.students) || [];
      if (!all.length) return ui.hero(null) + '<div class="empty">暂无营养数据</div>';

      const idx = Math.min(P.state.studentIndex || 0, all.length - 1);
      const s = all[idx];

      const hero = ui.hero({
        eyebrow: 'CONTROL CENTER / NUTRITION',
        title: '营养健康分析',
        subtitle: '读取学生餐卡点餐记录，生成六维营养雷达图与家长周报',
        stats: [
          { label: 'STUDENT', value: s.name, sub: s.class_name },
          { label: 'WEEK', value: s.week, sub: '统计周期' },
          { label: 'SCORE', value: s.kpis[3] ? s.kpis[3].value : '--', sub: '综合营养得分' }
        ]
      });

      const picker = '<div class="field">' +
        '<label for="stu">' + icon('user', 13) + ' 选择学生（按学号查询餐卡记录）</label>' +
        '<select id="stu">' + all.map((x, i) =>
          '<option value="' + i + '"' + (i === idx ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('') +
        '</select>' +
        '<span class="kpi-src">卡号 ' + esc(s.card_no) + ' · 学号 ' + esc(s.id) + '</span></div>';

      const radar = s.radar || { axes: [], actual: [] };
      const radarPanel = ui.panel({
        title: '本周营养摄入雷达图', sub: '虚线为推荐标准，实线为本周实际摄入', tag: 'RADAR / WEEK', icon: 'target',
        body: C.radar({
          axes: radar.axes.map((name, i) => ({ label: name, value: radar.actual[i] })),
          baseline: radar.standard || radar.axes.map(() => 100),
          max: 100, size: 300
        })
      });

      const t = s.trend || { categories: [], kcal: [], protein: [] };
      const trendPanel = ui.panel({
        title: '每日热量与蛋白质趋势', sub: '柱为热量，线为蛋白质（已放大 10 倍便于同图比较）', tag: 'TREND / 8D', icon: 'trend',
        body: C.combo({ labels: t.categories, bars: { values: t.kcal }, line: { values: t.protein }, height: 230, width: 620 }) +
          ui.legend([{ name: '热量 kcal', color: 'var(--accent)' }, { name: '蛋白质 ×10 g', color: 'var(--ok)' }])
      });

      const meals = s.meals || [];
      const mealPanel = ui.panel({
        title: '餐次热量构成', sub: '早 / 中 / 晚三餐占比', tag: 'MEAL MIX', icon: 'pie',
        body: C.donut({
          items: meals.map((m, i) => ({ label: m.name, value: m.value, color: PALETTE[i % PALETTE.length] })),
          centerValue: meals.length + ' 餐', centerLabel: '餐次构成', size: 210
        })
      });

      const advicePanel = ui.panel({
        title: '营养师建议', sub: '按六维得分自动生成', tag: 'ADVICE', icon: 'shield',
        body: (s.advice || []).map(a =>
          '<div style="padding:8px 0;border-bottom:1px dashed var(--line)">' +
          '<div style="font-size:13px;color:var(--warn)">' + esc(a.name) + ' · ' + C.fmt(a.score, 1) + ' 分</div>' +
          '<div style="font-size:12px;color:var(--muted);margin-top:3px">' + esc(a.tip) + '</div></div>').join('')
      });

      const recPanel = ui.panel({
        title: '最近点餐记录', sub: '来自餐卡消费流水', tag: 'RECORDS', icon: 'database',
        body: ui.table(['时间', '餐次', '菜品', '热量', '金额'],
          (s.records || []).map(r => [r.time, r.meal, r.dish, r.kcal + ' kcal', r.amount]), { numFrom: 3 })
      });

      const pushPanel = ui.panel({
        title: '家长周报推送', sub: '推送到微信服务号（当前为模拟发送）', tag: 'PUSH', icon: 'send',
        body: '<div class="field">' +
          '<button class="btn primary" data-action="push">' + icon('send', 14) + ' 生成并推送家长微信</button>' +
          '<span class="kpi-src">将生成《' + esc(s.class_name) + ' ' + esc(s.name) + ' · ' + esc(s.week) + ' 营养周报》</span></div>' +
          '<div id="push-result"></div>' +
          '<div style="margin-top:10px;font-size:11.5px;color:var(--dim)">历史推送：' +
          ((s.pushes || []).map(p => esc(p.day) + ' · ' + esc(p.channel) + ' · ' + esc(p.status)).join('　|　') || '暂无') +
          '</div>'
      });

      const notice = ui.alert(
        '接口说明：数据组把每人每日的餐卡明细写进 data/nutrition.json，前端负责聚合与可视化。' +
        '真实推送由后端的微信服务号 / 企业机器人完成，页面只保留按钮与结果位。', { tone: 'info' });

      return hero + picker + ui.kpis(s.kpis) +
        '<div class="grid-2">' + radarPanel + trendPanel + '</div>' +
        '<div class="grid-3">' + mealPanel + advicePanel + pushPanel + '</div>' +
        recPanel + notice;
    },
    mount: function (root, ctx) {
      const sel = root.querySelector('#stu');
      if (sel) sel.addEventListener('change', () => {
        P.state.studentIndex = Number(sel.value);
        ctx.rerender();
      });
      const btn = root.querySelector('[data-action="push"]');
      if (btn) btn.addEventListener('click', () => {
        const all = ctx.data.nutrition.students;
        const s = all[Math.min(P.state.studentIndex || 0, all.length - 1)];
        const box = root.querySelector('#push-result');
        if (box) {
          box.style.marginTop = '12px';
          box.innerHTML = ui.alert('已为「' + s.class_name + ' · ' + s.name + '」生成 ' + s.week +
            ' 营养周报，并推送到家长微信（模拟，不会真的发送）', { ok: true });
        }
        ctx.toast('周报已生成（模拟推送）');
      });
    }
  });

  /* ======================================================= 5. 扩展与接入 */
  P.registerPage({
    id: 'extensions',
    label: '扩展与接入',
    icon: 'plug',
    render: function (ctx) {
      const d = ctx.data.extensions || {};
      const intro = d.intro || {};

      const hero = ui.hero({
        eyebrow: 'CONTROL CENTER / EXTEND',
        title: intro.title || '扩展与接入',
        subtitle: intro.subtitle || '',
        stats: [
          { label: 'PAGES', value: P.pages.length + ' 个', sub: '已注册导航页' },
          { label: 'SLOTS', value: (d.slots || []).length + ' 个', sub: '模块槽位' },
          { label: 'CONTRACT', value: 'JSON', sub: '对接方式' }
        ]
      });

      const slots = (d.slots || []).map(s => {
        const filled = s.status !== '空槽位';
        return '<div class="slot ' + (filled ? 'filled' : '') + '">' +
          '<div class="slot-name">' + esc(s.name) +
          ui.badge(filled ? s.status : '空槽位', filled ? 'accent' : 'muted') + '</div>' +
          '<div class="slot-hint">' + esc(s.hint) + '</div>' +
          '<div class="slot-meta">' + esc(s.type) + ' · 负责人：' + esc(s.owner) + '</div></div>';
      }).join('');

      const contract = (d.contract || []).map(c =>
        '<div class="panel">' +
        '<div class="panel-head"><div><div class="panel-title">' + icon('code', 15) + esc(c.title) + '</div></div></div>' +
        '<div class="code">' + c.lines.map(esc).join('\n') + '</div></div>').join('');

      const g = d.genericDemo || {};
      const demo = ui.panel({
        title: g.name || '通用模块示例',
        sub: '这段是通用渲染器跑出来的，只靠 JSON 配置，没有写任何页面代码',
        tag: 'GENERIC / ZERO-CODE', icon: 'plus',
        body: ui.kpis(g.kpis || []) +
          '<div class="panel-sub" style="margin-top:10px">' + esc(g.note || '') + '</div>'
      });

      const sample = '<div class="panel"><div class="panel-head"><div><div class="panel-title">' +
        icon('link', 15) + '两行代码接入（示例）</div></div></div>' +
        '<div class="code">' +
        esc('// 1) 数据源：把你的算法结果直接推给平台\n') +
        esc("Platform.registerDataSource('queue', async () => ({\n") +
        esc('  windows: [...], trend: { categories: [...], series: [...] }\n') +
        esc('}));\n\n') +
        esc('// 2) 新分项目：注册一个自己的导航页\n') +
        esc("Platform.registerPage({\n  id: 'dish-waste', label: '剩菜监测', icon: 'leaf',\n") +
        esc('  render: (ctx) => \'<div class="panel">...我的板块...</div>\'\n});') +
        '</div></div>';

      return hero +
        ui.panel({ title: '模块槽位', sub: '三个分目标各占一个槽位，另外两个空槽位留给后续新分项目', tag: 'SLOTS', icon: 'grid', body: '<div class="slot-grid">' + slots + '</div>' }) +
        demo +
        '<div class="grid-3">' + contract + '</div>' +
        '<div class="grid-2">' + sample +
        ui.panel({
          title: '扩展规则（给合作方）', sub: '三条约定，保证各干各的也能拼起来', tag: 'RULES', icon: 'shield',
          body: '<div style="font-size:12.5px;color:var(--muted);line-height:2">' +
            '① 只改自己的文件：data/&lt;模块&gt;.json 或 assets/js/modules/&lt;模块&gt;.js，不要动别人的页面<br>' +
            '② 数据结构对齐 docs/INTERFACE.md 里的字段表，字段名不要自创<br>' +
            '③ 时间统一用 <b style="color:var(--text)">YYYY-MM-DD HH:MM</b>，数值统一为数字类型（不要写 "23 人"）<br>' +
            '④ 新增页面必须 registerPage 注册，否则导航里不会出现' +
            '</div>'
        }) + '</div>';
    }
  });

  /* ============================================== 通用模块页（零代码扩展） */
  // 当 data/extensions.json 里出现通用模块时，自动生成页面，无需写代码
  P.buildGenericPages = function () {
    const ext = P.data.extensions || {};
    (ext.slots || []).forEach(function (slot) {
      if (slot.status !== '空槽位' || P.getPage(slot.id)) return;
      const g = ext.genericDemo || {};
      P.registerPage({
        id: slot.id,
        label: slot.name,
        icon: 'plus',
        generic: true,
        render: function () {
          return ui.hero({
            eyebrow: 'CONTROL CENTER / ' + String(slot.id).toUpperCase(),
            title: slot.name,
            subtitle: slot.hint || '等待认领：在 data/extensions.json 里填入配置即可上线',
            stats: [
              { label: 'STATUS', value: slot.status, sub: slot.type },
              { label: 'OWNER', value: slot.owner, sub: '负责人' },
              { label: 'DATA', value: 'JSON', sub: '对接方式' }
            ]
          }) +
            ui.panel({
              title: '占位内容（示例数据）', sub: '把下面的结构换成你的真实数据即可',
              tag: 'PLACEHOLDER', icon: 'plus',
              body: ui.kpis(g.kpis || []) +
                '<div class="panel-sub" style="margin-top:10px">' + esc(g.note || '') + '</div>'
            }) +
            ui.alert('这个页面是通用渲染器自动生成的：在 data/extensions.json 里把该槽位的 status 改成「已接入」并补充字段，就能显示真实内容。');
        }
      });
    });
  };
})(window);
