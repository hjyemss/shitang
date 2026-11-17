# 接口契约 · INTERFACE

> 这份文档是「总控平台」和「三个分模块开发者」之间的约定。
> 只要按这里的字段写数据，前端不用改一行代码，页面会自动更新。

---

## 0. 三种接入方式（按难度从低到高）

| 方式 | 适合谁 | 要做什么 | 前端改动 |
| --- | --- | --- | --- |
| ① 写 JSON | 跑脚本、跑算法的同学 | 把结果写进 `web/data/<模块>.json` | 无 |
| ② 注册数据源 | 已有后端 / WebSocket / 串口 | 调 `Platform.registerDataSource(key, fn)` | 无 |
| ③ 注册新页面 | 要做一个全新分项目的同学 | 调 `Platform.registerPage({...})` | 无（自己写自己的文件） |

方式 ① 是默认路径，也是答辩现场最稳的路径：**网页是纯静态的，不依赖任何服务**。

---

## 1. 通用约定

| 约定 | 说明 |
| --- | --- |
| 编码 | UTF-8（无 BOM） |
| 时间 | 字符串 `YYYY-MM-DD HH:MM`（如 `2026-11-17 22:18`） |
| 数字 | 用 `number`，**不要**写 `"23 人"` 这种带单位的字符串 |
| 单位 | 单独放 `unit` 字段，前端负责拼接 |
| 颜色语义 | `tone` 取 `ok` / `warn` / `danger` / `accent` 四选一 |
| 缺字段 | 允许缺省，前端会跳过对应元素；但**不要**改已有字段名 |
| 文件位置 | 一律放在 `web/data/`，文件名不要改 |

改完 JSON 后：本地双击打开 → 点右上角「刷新」；用 `http.server` 打开则刷新浏览器即可。

---

## 2. 排队模块 · `queue.json`

负责人：CV 组 · 建议数据源：摄像头 + YOLO 人数统计

```json
{
  "hero":   { "eyebrow": "CONTROL CENTER / QUEUE", "title": "排队拥堵监控",
              "subtitle": "一句话说明", "stats": [{ "label": "QUEUE NOW", "value": "57 人", "sub": "六个窗口合计" }] },
  "threshold": 20,
  "kpis":   [{ "icon": "people", "label": "当前排队总人数", "value": "57", "unit": "人",
               "tone": "danger", "delta": "1 个窗口拥挤", "source": "实时快照" }],
  "alert":  "1号窗口 当前拥挤，排队 23 人（超过 20 人阈值）",
  "windows": [
    { "name": "1号窗口 · 盖饭", "floor": "1F", "people": 23, "wait": "约 9 分钟", "level": "拥挤" }
  ],
  "trend": { "categories": ["19:18", "19:28"], "series": [{ "name": "1号窗口", "values": [23, 25] }] },
  "cameras": [
    { "id": "CAM-01", "name": "一层 · 1号窗口", "floor": "1F", "status": "online",
      "resolution": "1920×1080", "fps": 25 }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `threshold` | number | 是 | 拥挤判定的排队人数阈值，图上的红色虚线用它 |
| `windows[].people` | number | 是 | 该窗口当前排队人数 |
| `windows[].level` | string | 是 | 只认 `拥挤` / `一般` / `通畅` 三个值（决定颜色） |
| `windows[].wait` | string | 否 | 展示用的预估等待，如 `约 9 分钟` |
| `trend.categories` | string[] | 否 | 横轴时间点，建议 10 分钟一个点 |
| `trend.series[].values` | number[] | 否 | 长度必须和 `categories` 一致 |
| `cameras[].status` | string | 否 | `online` / `offline`（决定在线徽标颜色） |

**替换成真实算法时**：YOLO 脚本每 10 秒把 `windows` 的 `people` 更新一次，`alert` 按阈值重算，写回这个文件即可。

---

## 3. 楼层模块 · `floors.json`

负责人：硬件组 · 建议数据源：多路摄像头分区计数 + 座位占用

```json
{
  "advice": { "title": "现在请前往「三楼」就餐", "reason": "原因说明",
              "badges": ["数据完整性校验通过", "建议前往耗时约 2 分钟"] },
  "floors": [
    { "name": "一楼", "seats": 480, "occupied": 402, "usage": 83.8, "wait": "约 10 分钟", "tone": "danger" }
  ],
  "share":  [{ "name": "一楼", "value": 479, "tone": "accent" }],
  "flow":   { "categories": ["07:00"], "series": [{ "name": "一楼", "values": [12], "tone": "accent" }] }
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `floors[].usage` | number | 是 | 座位使用率（0–100），**直接给百分比数值**，不要带 `%` |
| `floors[].occupied` / `seats` | number | 是 | 在座 / 座位数 |
| `share[].value` | number | 否 | 各楼层就餐人数（环形图用），建议等于 `occupied` |
| `flow.series[].values` | number[] | 否 | 分时人流，长度与 `categories` 一致 |

分流算法可以完全由你们重写，只要最终输出 `advice.title` + `advice.reason` 两句话即可。

---

## 4. 营养模块 · `nutrition.json`

负责人：数据组 · 建议数据源：餐卡消费流水 + 菜品营养库

```json
{
  "students": [
    {
      "label": "高二(3)班 · 王小明", "id": "S2023001", "name": "王小明",
      "class_name": "高二(3)班", "card_no": "6221 0034", "week": "2026-W46",
      "kpis": [
        { "icon": "nutrition", "label": "日均热量", "value": "1819", "unit": "kcal",
          "tone": "ok", "delta": "推荐 2000 kcal", "source": "点餐记录" }
      ],
      "radar": { "axes": ["蛋白质", "碳水化合物", "膳食纤维", "维生素", "钙铁锌", "脂肪控制"],
                 "actual": [100, 65.5, 45.1, 84.4, 60.8, 87.5],
                 "standard": [100, 100, 100, 100, 100, 100] },
      "advice": [{ "name": "膳食纤维", "score": 45.1, "tip": "每天一份深色蔬菜" }],
      "trend": { "categories": ["11/10"], "kcal": [1170], "protein": [66.7] },
      "meals": [{ "name": "晚餐", "value": 56.2, "tone": "accent" }],
      "records": [{ "time": "11-17 17:24", "meal": "晚餐", "dish": "香菇青菜", "kcal": "110", "amount": "¥4.9" }],
      "pushes": [{ "day": "11-11", "channel": "微信服务号", "status": "成功" }]
    }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `students` | array | 是 | 每个学生一条，页面左上角下拉框由此生成 |
| `radar.actual` | number[6] | 是 | 顺序必须和 `axes` 一致，0–100 |
| `radar.standard` | number[6] | 否 | 推荐基线（虚线多边形），默认全 100 |
| `trend.kcal` / `protein` | number[] | 否 | 长度与 `categories` 一致 |
| `meals[].value` | number | 否 | 各餐次热量占比（合计 100） |
| `records[]` | array | 否 | 展示最近 10 条即可 |

`kpis` 建议固定 4 个（日均热量 / 蛋白质达标率 / 本周餐费 / 综合得分），顺序不要变，右上角得分取第 4 个。

---

## 5. 总览与导航 · `overview.json` / `manifest.json`

- `overview.json`：首页四张 KPI、分时人流 `hourly`、模块状态 `modules`、楼层占用 `floors`、告警 `alerts`、系统资源 `resources`。
- `manifest.json`：`brand`（标题 / 副标题）、`nav`（导航项，`id` 必须和注册的页面 id 一致）、`modules`（状态列表）、`extensionSlots`（预留槽位）、`updated`（页脚时间）。

`modules[].status` 只认三个值：`running`（运行中）、`mock`（模拟数据）、`planned`（待接入）。
`alerts[].level` 只认：`info` / `warn` / `critical`（决定徽标文案与颜色）。

---

## 6. 新增一个分项目（方式 ③）

### 6.1 零代码：只加配置

编辑 `web/data/extensions.json` 的 `slots`，把某个空槽位改掉：

```json
{ "id": "waste", "name": "剩菜监测", "owner": "你的名字", "status": "已接入",
  "type": "模块", "hint": "按餐次统计剩菜重量，写入 data/waste.json" }
```

刷新页面 → 左侧导航出现「剩菜监测」→ 自动生成一个通用页（KPI 卡片 + 说明）。
再把数据写进 `extensions.json` 的 `genericDemo`（或提供 `data/waste.json`）即可展示真实数字。

> 当前版本：`slot-a` / `slot-b` 两个空槽位就是给后续新分项目留的。

### 6.2 写代码：注册一个自己的页面

新建 `web/assets/js/modules/waste.js`，在 `index.html` 里把它加在 `pages.js` 之后：

```js
Platform.registerPage({
  id: 'waste',              // 必须和 manifest.nav 里的 id 一致
  label: '剩菜监测',
  icon: 'leaf',             // 图标名见 icons.js
  render: function (ctx) {
    const d = ctx.data.extensions || {};
    return Platform.ui.hero({
      eyebrow: 'CONTROL CENTER / WASTE', title: '剩菜监测',
      subtitle: '按餐次统计剩菜重量', stats: []
    }) + Platform.ui.panel({ title: '今日剩菜', body: '...' });
  }
});
```

平台提供的工具（都在 `window.Platform` / `window.Charts` 上）：

| API | 作用 |
| --- | --- |
| `Platform.registerPage({id,label,icon,render,mount})` | 注册导航页；`mount(root, ctx)` 里绑事件 |
| `Platform.registerDataSource('queue', fn)` | 用函数覆盖某个数据文件（实时推送用） |
| `Platform.ui.hero/kpi/panel/table/badge/alert/timeline` | 统一风格组件 |
| `Charts.line/bars/donut/radar/stacked/combo` | 纯 SVG 图表，自动跟随主题 |
| `ctx.toast(msg)` / `ctx.rerender()` | 轻提示 / 重绘当前页 |

---

## 7. 常见坑

1. **JSON 里多了逗号**（最后一个元素后面）→ 页面白屏。改完先在浏览器控制台 / `python -m json.tool` 检查。
2. **把数字写成字符串**（`"people": "23"`）→ 排序和阈值判断会出错。
3. **`series` 长度和 `categories` 不一致** → 曲线会错位。
4. **`level` / `tone` 自创词**（比如「比较挤」）→ 取不到颜色，退化为默认色。
5. **直接改 `data.js`** → 下次跑 `tools/export_web_data.py` 会被覆盖；要改就改 `data/*.json`。
6. **改完没刷新** → 页面右上角「刷新」按钮会重新读 JSON。

---

版本：v1.0.0 · 维护：平台组 · 更新时间：2026-11-17
