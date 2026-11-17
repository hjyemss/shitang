# 人大附中智慧食堂综合管理与健康分析系统

科创项目 · **第一阶段交付：总控大屏（静态网页演示版）**

> 一句话：一个**双击就能打开、不需要装任何环境**的总控大屏，用来在答辩 / 招人时展示
> 「食堂要做什么」，同时把三个分模块的**接入位置和数据契约**全部留好。
>
> 三个分模块的业务代码（排队 CV、楼层汇总、营养分析）**不在本仓库内**，由合作方按
> `web/docs/INTERFACE.md` 分头开发，再以「写 JSON / 注册数据源 / 注册新页面」三种方式接入。

---

## 一、从这里开始

> 想看这个项目**讲的是什么、为什么做、怎么招人**？→ 读 [**项目说明 PROJECT_INTRO.md**](PROJECT_INTRO.md)
> （也有 Word 版 `智慧食堂项目介绍.docx` 和网页版 `贺嘉懿的项目介绍.html`）

| 我想… | 打开这个 |
| --- | --- |
| 直接看效果（最推荐） | 双击 `dist/智慧食堂总控大屏.html` |
| 改数据 / 看源码 | 双击 `web/index.html`，改 `web/data/*.json` 后点右上角「刷新」 |
| 看接口怎么接 | [`web/docs/INTERFACE.md`](web/docs/INTERFACE.md) |
| 看详细说明 | [`web/README.md`](web/README.md) |

不需要 Python、Node、数据库或任何服务：**纯 HTML + CSS + JS + JSON**。

想用本地服务跑（可选）：

```bash
cd web && python3 -m http.server 8600   # → http://localhost:8600
```

改了数据 / 改完代码重新打包单文件：

```bash
python3 tools/build_single_file.py      # → dist/智慧食堂总控大屏.html
```

---

## 二、页面一览

| 页面 | 展示什么 | 谁来供数 |
| --- | --- | --- |
| **系统总览** | 4 个核心 KPI、今日分时人流、模块接入状态、楼层承载、实时告警、系统资源 | `data/overview.json` |
| **排队拥堵监控** | 拥挤告警、窗口排队柱状图（20 人阈值线）、窗口明细、3 小时趋势、8 路摄像头 | `data/queue.json` ← CV 组 |
| **楼层分流建议** | AI 分流建议、三层座位使用率、人数占比环形图、楼层状态、三层人流堆叠图 | `data/floors.json` ← 硬件组 |
| **营养健康分析** | 学生选择、六维雷达、热量/蛋白质趋势、餐次构成、营养师建议、点餐流水、周报推送 | `data/nutrition.json` ← 数据组 |
| **扩展与接入** | 模块槽位、零代码通用模块示例、三种接入方式、合作规则 | `data/extensions.json` |
| **新分项目 A / B** | 预留的空槽位页（零代码生成，演示「以后可以加新分项目」） | 同上 |

右上角：**主题**（深 / 浅，记住选择）、**刷新**（重新读 JSON）。

---

## 三、目录

```
dist/智慧食堂总控大屏.html      单文件成品（交作业 / 发人用这个）
web/                            可维护的多文件版本
├── index.html
├── data/                       ★ 每个板块一个"数据表"（JSON）
│   ├── manifest.json           品牌 / 导航 / 模块状态
│   ├── overview.json  queue.json  floors.json  nutrition.json  extensions.json
├── assets/css/app.css
├── assets/js/{data,icons,charts,platform,pages,app}.js
└── docs/INTERFACE.md           ★ 给合作方的字段契约
tools/
├── export_web_data.py          从旧演示库导出 JSON + data.js
└── build_single_file.py        打包成 dist 单文件
screenshots/                    各页面截图
archived/streamlit/             第一阶段旧版（Streamlit，需 Python 环境，仅存档）
.venv/                          仅供 archived/streamlit 旧版使用；静态版完全不需要
```

---

## 四、给合作方的三个入口

1. **只交数据**：把结果写成 `web/data/<模块>.json`（字段见 INTERFACE.md）→ 页面自动更新。
2. **实时推送**：`Platform.registerDataSource('queue', fn)`，适合已有后端 / WebSocket / 行空板。
3. **新分项目**：在 `data/extensions.json` 填槽位（零代码），或写 `assets/js/modules/*.js`
   调 `Platform.registerPage({id,label,icon,render})` 注册新导航页 —— 各写各的文件，互不冲突。

---

## 五、数据说明

- 页面上的数字都是**演示数据**（仿真种子，日期 2026-11-17），不是真实食堂数据。
- 营养页的 12 名学生、点餐记录均为**虚构**，不涉及任何真实学生信息。
- 「生成并推送家长微信」只做前端模拟，**不会真的发送**、不上传任何数据。
- 换数据：直接改 `web/data/*.json`；或改 `tools/export_web_data.py` 后重跑。

---

## 六、已知边界

- 摄像头只有设备卡片，没有视频流（第二阶段接 YOLO 检测流）。
- 微信推送、权限登录需要后端，当前仅保留按钮与结果位。
- 移动端可用但未精修，演示以大屏（1920×1080）为主。

---

版本 v1.0.0 · 2026-11-17 · 第一阶段交付
