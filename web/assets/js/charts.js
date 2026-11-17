/* ============================================================
   轻量图表库：纯手写 SVG，不依赖 echarts / plotly / CDN
   —— 单文件即可离线演示，答辩现场断网也不怕
   —— 颜色全部走 CSS 变量，深浅主题切换自动跟随
   —— 每个图都支持 opt.width 指定画布宽度：
       半宽面板传 560，整屏通栏传 1180，字号才不会缩成蚂蚁
   ============================================================ */
(function (global) {
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function fmt(v, digits) {
    if (v === null || v === undefined || isNaN(v)) return '--';
    const d = digits === undefined ? 0 : digits;
    return Number(v).toFixed(d).replace(/\.0+$/, '');
  }
  function fmtInt(v) {
    return String(Math.round(Number(v) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // 让刻度落在整数上：返回 { max, step }
  function niceScale(maxValue, ticks) {
    ticks = ticks || 4;
    const raw = Math.max(maxValue, 1) / ticks;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    return { max: step * ticks, step: step };
  }

  function svgWrap(w, h, body) {
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h +
      '" preserveAspectRatio="xMidYMid meet" role="img" style="max-height:' + (h * 1.9).toFixed(0) + 'px">' +
      body + '</svg>';
  }

  /* --------------------------------------------------------- 折线 / 面积 */
  function line(opt) {
    const labels = opt.labels || [];
    const series = opt.series || [];
    const W = opt.width || 760;
    const h = opt.height || 230;
    const pad = { l: 40, r: 16, t: 18, b: 28 };
    const n = labels.length;
    const all = series.reduce((a, s) => a.concat(s.values || []), []);
    const scale = niceScale(Math.max.apply(null, all.concat([1])) * 1.15, 4);
    const yMax = opt.yMax || scale.max;
    const innerW = W - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const x = i => pad.l + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
    const y = v => pad.t + innerH - (Math.max(0, v) / yMax) * innerH;

    let g = '';
    for (let k = 0; k <= 4; k++) {
      const vy = pad.t + (innerH * k) / 4;
      g += '<line x1="' + pad.l + '" y1="' + vy + '" x2="' + (W - pad.r) + '" y2="' + vy + '" stroke="var(--grid)"/>';
      g += '<text x="' + (pad.l - 8) + '" y="' + (vy + 4) + '" text-anchor="end" font-size="11" fill="var(--dim)">' +
        fmtInt(yMax - (yMax * k) / 4) + '</text>';
    }

    series.forEach((s, si) => {
      const pts = (s.values || []).map((v, i) => [x(i), y(v)]);
      if (!pts.length) return;
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      if (s.area !== false) {
        const gid = 'grad' + si + '_' + Math.random().toString(36).slice(2, 7);
        g += '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="' + (s.color || 'var(--accent)') + '" stop-opacity="0.30"/>' +
          '<stop offset="100%" stop-color="' + (s.color || 'var(--accent)') + '" stop-opacity="0"/>' +
          '</linearGradient></defs>';
        g += '<path d="' + d + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (pad.t + innerH) +
          ' L' + pts[0][0].toFixed(1) + ' ' + (pad.t + innerH) + ' Z" fill="url(#' + gid + ')"/>';
      }
      g += '<path d="' + d + '" fill="none" stroke="' + (s.color || 'var(--accent)') +
        '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
      const last = pts[pts.length - 1];
      g += '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.8" fill="' +
        (s.color || 'var(--accent)') + '"/>';
    });

    if (opt.threshold && opt.threshold.value !== undefined) {
      const ty = y(opt.threshold.value);
      g += '<line x1="' + pad.l + '" y1="' + ty + '" x2="' + (W - pad.r) + '" y2="' + ty +
        '" stroke="var(--danger)" stroke-width="1.2" stroke-dasharray="5 5" opacity="0.85"/>';
      g += '<text x="' + (pad.l + 6) + '" y="' + (ty - 6) + '" text-anchor="start" font-size="11" fill="var(--danger)">' +
        esc(opt.threshold.label || '阈值') + '</text>';
    }

    (opt.markers || []).forEach(m => {
      if (m.index === undefined || !labels[m.index]) return;
      const mx = x(m.index), my = y(m.value);
      g += '<circle cx="' + mx + '" cy="' + my + '" r="3.6" fill="var(--warn)" stroke="var(--panel)" stroke-width="1.5"/>';
      g += '<text x="' + mx + '" y="' + (my - 11) + '" text-anchor="middle" font-size="11" fill="var(--warn)">' +
        esc(m.label) + '</text>';
    });

    const step = Math.ceil(n / 8);
    labels.forEach((lb, i) => {
      if (i % step !== 0 && i !== n - 1) return;
      g += '<text x="' + x(i) + '" y="' + (h - 9) + '" text-anchor="middle" font-size="11" fill="var(--dim)">' +
        esc(lb) + '</text>';
    });

    return svgWrap(W, h, g);
  }

  /* --------------------------------------------------------- 柱状 + 阈值线 */
  function bars(opt) {
    const items = opt.items || [];
    const W = opt.width || 760;
    const h = opt.height || 240;
    const pad = { l: 40, r: 16, t: 22, b: 34 };
    const innerW = W - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const scale = niceScale(Math.max.apply(null, items.map(i => i.value).concat([1])) * 1.22, 4);
    const yMax = opt.yMax || scale.max;
    const band = innerW / Math.max(items.length, 1);
    const bw = Math.min(band * 0.5, 52);
    const y = v => pad.t + innerH - (Math.max(0, v) / yMax) * innerH;

    let g = '';
    for (let k = 0; k <= 4; k++) {
      const vy = pad.t + (innerH * k) / 4;
      g += '<line x1="' + pad.l + '" y1="' + vy + '" x2="' + (W - pad.r) + '" y2="' + vy + '" stroke="var(--grid)"/>';
      g += '<text x="' + (pad.l - 8) + '" y="' + (vy + 4) + '" text-anchor="end" font-size="11" fill="var(--dim)">' +
        fmtInt(yMax - (yMax * k) / 4) + '</text>';
    }

    items.forEach((it, i) => {
      const cx = pad.l + band * i + band / 2;
      const bh = Math.max(2, pad.t + innerH - y(it.value));
      g += '<rect x="' + (cx - bw / 2) + '" y="' + y(it.value) + '" width="' + bw + '" height="' + bh +
        '" rx="4" fill="' + (it.tone || 'var(--accent)') + '" opacity="0.92"/>';
      g += '<text x="' + cx + '" y="' + (y(it.value) - 8) + '" text-anchor="middle" font-size="11.5" fill="var(--text)">' +
        fmtInt(it.value) + (it.unit || '') + '</text>';
      g += '<text x="' + cx + '" y="' + (h - 11) + '" text-anchor="middle" font-size="11" fill="var(--dim)">' +
        esc(it.label) + '</text>';
    });

    if (opt.threshold && opt.threshold.value !== undefined) {
      const ty = y(opt.threshold.value);
      g += '<line x1="' + pad.l + '" y1="' + ty + '" x2="' + (W - pad.r) + '" y2="' + ty +
        '" stroke="var(--danger)" stroke-width="1.2" stroke-dasharray="5 5" opacity="0.85"/>';
      g += '<text x="' + (W - pad.r) + '" y="' + (ty - 6) + '" text-anchor="end" font-size="11" fill="var(--danger)">' +
        esc(opt.threshold.label || '阈值') + '</text>';
    }
    return svgWrap(W, h, g);
  }

  /* --------------------------------------------------------- 环形图 */
  function donut(opt) {
    const items = (opt.items || []).filter(i => i.value > 0);
    const size = opt.size || 250;
    const cx = size / 2, cy = size / 2;
    const R = size / 2 - 8;
    const r = R * 0.64;
    const total = items.reduce((a, b) => a + b.value, 0) || 1;
    const colors = ['var(--accent)', 'var(--ok)', 'var(--warn)', 'var(--accent2)', 'var(--danger)'];
    let ang = -Math.PI / 2;
    let g = '';

    const arc = (a0, a1, ro, ri) => {
      const p = (a, rad) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const s1 = p(a0, ro), e1 = p(a1, ro), s2 = p(a1, ri), e2 = p(a0, ri);
      return 'M' + s1[0].toFixed(2) + ' ' + s1[1].toFixed(2) +
        ' A' + ro + ' ' + ro + ' 0 ' + large + ' 1 ' + e1[0].toFixed(2) + ' ' + e1[1].toFixed(2) +
        ' L' + s2[0].toFixed(2) + ' ' + s2[1].toFixed(2) +
        ' A' + ri + ' ' + ri + ' 0 ' + large + ' 0 ' + e2[0].toFixed(2) + ' ' + e2[1].toFixed(2) + ' Z';
    };

    items.forEach((it, i) => {
      const a0 = ang, a1 = ang + (it.value / total) * Math.PI * 2;
      ang = a1;
      const color = it.color || colors[i % colors.length];
      const pad = 0.012;
      g += '<path d="' + arc(a0 + pad, Math.max(a0 + pad, a1 - pad), R, r) + '" fill="' + color + '" opacity="0.95"/>';
      const mid = (a0 + a1) / 2;
      const pct = (it.value / total) * 100;
      if (pct >= 6) {
        const lx = cx + ((R + r) / 2) * Math.cos(mid);
        const ly = cy + ((R + r) / 2) * Math.sin(mid);
        g += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="middle" font-size="12" ' +
          'fill="#fff" font-weight="600">' + pct.toFixed(1) + '%</text>';
      }
    });

    g += '<text x="' + cx + '" y="' + (cy - 3) + '" text-anchor="middle" font-size="21" font-weight="700" fill="var(--text)">' +
      esc(opt.centerValue !== undefined ? opt.centerValue : fmtInt(total)) + '</text>';
    g += '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" font-size="11" fill="var(--dim)">' +
      esc(opt.centerLabel || '总计') + '</text>';

    const legend = items.map((it, i) =>
      '<span><i style="background:' + (it.color || colors[i % colors.length]) + '"></i>' + esc(it.label) + '</span>').join('');

    return '<div style="display:flex;justify-content:center;align-items:center;gap:20px;flex-wrap:wrap">' +
      '<svg viewBox="0 0 ' + size + ' ' + size + '" style="width:' + size + 'px;max-width:100%;height:auto" role="img">' +
      g + '</svg><div class="legend" style="flex-direction:column;gap:9px">' + legend + '</div></div>';
  }

  /* --------------------------------------------------------- 雷达图 */
  function radar(opt) {
    const axes = opt.axes || [];
    const n = Math.max(axes.length, 3);
    const size = opt.size || 300;
    const cx = size / 2, cy = size / 2 + 2;
    const R = size / 2 - 46;
    const max = opt.max || 100;
    const pt = (i, v) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
      const rr = (v / max) * R;
      return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
    };
    let g = '';

    [0.25, 0.5, 0.75, 1].forEach(k => {
      const pts = [];
      for (let i = 0; i < n; i++) pts.push(pt(i, max * k));
      g += '<polygon points="' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') +
        '" fill="none" stroke="var(--grid)"/>';
    });
    for (let i = 0; i < n; i++) {
      const p = pt(i, max);
      g += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) +
        '" stroke="var(--grid)"/>';
    }

    if (opt.baseline) {
      const pts = opt.baseline.map((v, i) => pt(i, v));
      g += '<polygon points="' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') +
        '" fill="none" stroke="var(--dim)" stroke-width="1.2" stroke-dasharray="4 4" opacity="0.7"/>';
    }

    const poly = axes.map((a, i) => pt(i, a.value));
    g += '<polygon points="' + poly.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') +
      '" fill="var(--accent)" fill-opacity="0.18" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>';
    poly.forEach(p => { g += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="var(--accent)"/>'; });

    axes.forEach((a, i) => {
      const ang = -Math.PI / 2 + (i * Math.PI * 2) / n;
      const lx = cx + (R + 24) * Math.cos(ang);
      const ly = cy + (R + 24) * Math.sin(ang);
      const anchor = Math.abs(Math.cos(ang)) < 0.25 ? 'middle' : (Math.cos(ang) > 0 ? 'start' : 'end');
      g += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 3).toFixed(1) + '" text-anchor="' + anchor +
        '" font-size="11" fill="var(--muted)">' + esc(a.label) + '</text>';
      g += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 17).toFixed(1) + '" text-anchor="' + anchor +
        '" font-size="10" fill="var(--dim)">' + fmtInt(a.value) + '</text>';
    });

    return '<svg class="chart" viewBox="0 0 ' + size + ' ' + size + '" style="max-height:330px" ' +
      'preserveAspectRatio="xMidYMid meet" role="img">' + g + '</svg>';
  }

  /* --------------------------------------------------------- 堆叠面积图 */
  function stacked(opt) {
    const labels = opt.labels || [];
    const series = opt.series || [];
    const W = opt.width || 1180;
    const h = opt.height || 240;
    const pad = { l: 40, r: 16, t: 16, b: 28 };
    const n = labels.length;
    const innerW = W - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0));
    const scale = niceScale(Math.max.apply(null, totals.concat([1])), 3);
    const yMax = scale.max;
    const x = i => pad.l + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
    const y = v => pad.t + innerH - (v / yMax) * innerH;
    let g = '';

    for (let k = 0; k <= 3; k++) {
      const vy = pad.t + (innerH * k) / 3;
      g += '<line x1="' + pad.l + '" y1="' + vy + '" x2="' + (W - pad.r) + '" y2="' + vy + '" stroke="var(--grid)"/>';
      g += '<text x="' + (pad.l - 8) + '" y="' + (vy + 4) + '" text-anchor="end" font-size="11" fill="var(--dim)">' +
        fmtInt(yMax - (yMax * k) / 3) + '</text>';
    }

    const base = labels.map(() => 0);
    series.forEach((s, si) => {
      const color = s.color || ['var(--accent)', 'var(--ok)', 'var(--warn)', 'var(--accent2)'][si % 4];
      const top = labels.map((_, i) => base[i] + (s.values[i] || 0));
      const up = labels.map((_, i) => x(i) + ',' + y(top[i]).toFixed(1)).join(' ');
      const down = labels.map((_, i) => x(n - 1 - i) + ',' + y(base[n - 1 - i]).toFixed(1)).join(' ');
      g += '<polygon points="' + up + ' ' + down + '" fill="' + color + '" opacity="0.5"/>';
      for (let i = 0; i < n; i++) base[i] = top[i];
    });

    const step = Math.ceil(n / 9);
    labels.forEach((lb, i) => {
      if (i % step !== 0 && i !== n - 1) return;
      g += '<text x="' + x(i) + '" y="' + (h - 9) + '" text-anchor="middle" font-size="11" fill="var(--dim)">' +
        esc(lb) + '</text>';
    });

    return svgWrap(W, h, g);
  }

  /* --------------------------------------------------------- 柱 + 折线组合 */
  function combo(opt) {
    const labels = opt.labels || [];
    const W = opt.width || 760;
    const barsS = opt.bars || { values: [] };
    const lineS = opt.line || { values: [] };
    const h = opt.height || 230;
    const pad = { l: 44, r: 44, t: 20, b: 30 };
    const innerW = W - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const band = innerW / Math.max(labels.length, 1);
    const bw = Math.min(band * 0.52, 40);
    const s1 = niceScale(Math.max.apply(null, barsS.values.concat([1])) * 1.15, 3);
    const s2 = niceScale(Math.max.apply(null, lineS.values.concat([1])) * 1.15, 3);
    const y = v => pad.t + innerH - (v / s1.max) * innerH;
    const y2 = v => pad.t + innerH - (v / s2.max) * innerH;
    let g = '';

    for (let k = 0; k <= 3; k++) {
      const vy = pad.t + (innerH * k) / 3;
      g += '<line x1="' + pad.l + '" y1="' + vy + '" x2="' + (W - pad.r) + '" y2="' + vy + '" stroke="var(--grid)"/>';
      g += '<text x="' + (pad.l - 8) + '" y="' + (vy + 4) + '" text-anchor="end" font-size="11" fill="var(--dim)">' +
        fmtInt(s1.max - (s1.max * k) / 3) + '</text>';
      g += '<text x="' + (W - pad.r + 8) + '" y="' + (vy + 4) + '" font-size="11" fill="var(--dim)">' +
        fmtInt(s2.max - (s2.max * k) / 3) + '</text>';
    }

    labels.forEach((lb, i) => {
      const cx = pad.l + band * i + band / 2;
      const v = barsS.values[i] || 0;
      g += '<rect x="' + (cx - bw / 2) + '" y="' + y(v) + '" width="' + bw + '" height="' +
        Math.max(2, pad.t + innerH - y(v)) + '" rx="3" fill="var(--accent)" opacity="0.85"/>';
      g += '<text x="' + cx + '" y="' + (h - 10) + '" text-anchor="middle" font-size="10.5" fill="var(--dim)">' + esc(lb) + '</text>';
    });

    const pts = labels.map((_, i) => [pad.l + band * i + band / 2, y2(lineS.values[i] || 0)]);
    g += '<path d="' + pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') +
      '" fill="none" stroke="var(--ok)" stroke-width="2" stroke-linejoin="round"/>';
    pts.forEach(p => { g += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.8" fill="var(--ok)"/>'; });

    return svgWrap(W, h, g);
  }

  /* --------------------------------------------------------- 进度条 */
  function progress(opt) {
    const pct = Math.max(0, Math.min(100, opt.value || 0));
    const tone = opt.tone || 'var(--accent)';
    return '<div class="bar-row"><div class="bar-top"><span>' + esc(opt.label || '') + '</span><b>' +
      fmt(pct, 1) + '%</b></div><div class="bar"><i style="--tone:' + tone + ';width:' + pct + '%"></i></div></div>';
  }

  global.Charts = { line, bars, donut, radar, stacked, combo, progress, fmt, fmtInt, esc, niceScale };
})(window);
