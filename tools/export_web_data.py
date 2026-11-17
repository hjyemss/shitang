#!/usr/bin/env python3
"""把演示数据库导出成静态网页用的 JSON（web/data/*.json）。

用法：
    cd ~/Desktop/食堂
    .venv/bin/python tools/export_web_data.py

说明：
- 数据源是 archived/streamlit/canteen.db（第一阶段 Streamlit 版用的演示库）。
- 导出后会同时生成 web/assets/js/data.js（把同样的 JSON 内联进去），
  这样直接双击 index.html（file:// 协议）也能看到数据，不需要起服务器。
- 三个业务模块（排队 / 楼层 / 营养）的代码不用改，只要把数据写进这些 JSON，
  或者在运行时覆盖 Platform.registerDataSource()，页面就会自动更新。
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEGACY = ROOT / "archived" / "streamlit"
OUT = ROOT / "web" / "data"

sys.path.insert(0, str(LEGACY))
import main_dashboard as legacy  # noqa: E402

legacy.DB_PATH = LEGACY / "canteen.db"
legacy.ensure_database()


def dump(name: str, payload) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  ok  data/{name}.json  ({path.stat().st_size / 1024:.1f} KB)")


# ---------------------------------------------------------------- 总览
def build_overview() -> dict:
    data = legacy.load_overview_data()
    # 旧模块用 id DESC 取 5 条，会漏掉最新一条；这里按时间重查
    data["alerts"] = legacy.query(
        "SELECT ts, level, source, message, handled FROM alerts ORDER BY ts DESC LIMIT 5"
    )
    q = legacy.load_queue_data()
    today = data["today"]
    floors = data["floors"]

    kpis = [
        {
            "icon": "people", "label": "今日就餐人次", "value": f"{today['diners']:,}",
            "unit": "人次", "tone": "ok", "trend": "up", "delta": "+4.9% 环比昨日",
            "source": "餐卡刷卡记录",
        },
        {
            "icon": "queue", "label": "当前排队总人数", "value": str(q["total"]),
            "unit": "人", "tone": "danger", "trend": "flat",
            "delta": f"{len([w for w in q['windows'] if w['拥挤度'] == '拥挤'])} 个窗口拥挤",
            "source": "排队监控模块",
        },
        {
            "icon": "clock", "label": "今日平均等待", "value": f"{today['avg_wait']:.1f}",
            "unit": "分钟", "tone": "warn", "trend": "down", "delta": "-0.1 分钟 环比昨日",
            "source": "取餐时间统计",
        },
        {
            "icon": "camera", "label": "系统在线摄像头", "value": f"{today['online_cams']}/8",
            "unit": "路", "tone": "danger", "trend": "flat", "delta": f"离线 {8 - today['online_cams']} 路",
            "source": "心跳检测",
        },
    ]

    return {
        "hero": {
            "eyebrow": "CONTROL CENTER / OVERVIEW",
            "title": "人大附中智慧食堂综合调度中心",
            "subtitle": "排队拥堵监控 · 楼层分流建议 · 营养健康分析 —— 三模块统一接入的调度中枢",
            "stats": [
                {"label": "SYSTEM", "value": "运行中", "sub": "三模块接口预留"},
                {"label": "QUEUE", "value": f"{q['total']} 人", "sub": "当前在途排队"},
                {"label": "ALERTS", "value": f"{today['alerts']} 条", "sub": "今日累计告警"},
            ],
        },
        "kpis": kpis,
        "hourly": {
            "categories": [f"{h['hour']:02d}:00" for h in data["hourly"]],
            "values": [h["diners"] for h in data["hourly"]],
        },
        "modules": [
            {"icon": "grid", "name": "调度中心前端", "status": "running", "detail": "时延 12 ms", "owner": "平台组"},
            {"icon": "queue", "name": "排队检测接口", "status": "pending", "detail": "尚未联通", "owner": "CV 组"},
            {"icon": "layers", "name": "楼层汇总接口", "status": "pending", "detail": "尚未联通", "owner": "硬件组"},
            {"icon": "nutrition", "name": "营养数据接口", "status": "mock", "detail": "时延 35 ms", "owner": "数据组"},
            {"icon": "camera", "name": "摄像头网关", "status": "running", "detail": f"{today['online_cams']}/8 在线", "owner": "平台组"},
            {"icon": "database", "name": "本地数据中台", "status": "running", "detail": "时延 3 ms", "owner": "平台组"},
        ],
        "floors": [
            {
                "name": f"{f['floor']} 楼",
                "usage": round(f["occupied"] / f["seats"] * 100, 1),
                "tone": "danger" if f["occupied"] / f["seats"] >= 0.8
                        else "warn" if f["occupied"] / f["seats"] >= 0.65 else "ok",
            }
            for f in floors
        ],
        "alerts": [
            {
                "time": a["ts"][11:16],
                "level": {"critical": "critical", "error": "error", "warning": "warn", "warn": "warn"}.get(
                    str(a["level"]).lower(), "info"
                ),
                "text": a["message"],
            }
            for a in sorted(data["alerts"], key=lambda x: x["ts"], reverse=True)[:5]
        ],
        "resources": [
            {"name": "摄像头在线率", "value": round(today["online_cams"] / 8 * 100)},
            {"name": "接口连通率", "value": 67},
            {"name": "数据同步完整率", "value": 98},
        ],
    }


# ---------------------------------------------------------------- 排队
def build_queue() -> dict:
    q = legacy.load_queue_data()
    windows = q["windows"]

    # 把「每条快照一行」的行数据整理成「每个窗口一条曲线」
    by_ts: dict[str, dict[int, int]] = {}
    for row in q["trend"]:
        by_ts.setdefault(row["ts"], {})[row["window_id"]] = row["people"]
    stamps = sorted(by_ts)
    win_ids = sorted({w for v in by_ts.values() for w in v})
    name_of = {}
    for w in windows:
        name_of[legacy.ALL_WINDOWS_ID.get(w["窗口"], 0) if hasattr(legacy, "ALL_WINDOWS_ID") else 0] = w["窗口"]
    series = []
    for wid in win_ids:
        label = name_of.get(wid) or f"{wid}号窗口"
        series.append({
            "name": label.split(" · ")[0],
            "values": [by_ts[s].get(wid, 0) for s in stamps],
        })

    crowded = [w for w in windows if w["拥挤度"] == "拥挤"]
    busiest = max(windows, key=lambda w: w["排队人数"])

    return {
        "hero": {
            "eyebrow": "CONTROL CENTER / QUEUE",
            "title": "排队拥堵监控",
            "subtitle": "摄像头 → YOLO 人体检测 → 窗口分区计数：实时判断各窗口拥挤度",
            "stats": [
                {"label": "QUEUE NOW", "value": f"{q['total']} 人", "sub": "六个窗口合计"},
                {"label": "BUSIEST", "value": busiest["窗口"].split(" · ")[0], "sub": "当前最拥挤窗口"},
                {"label": "UPDATED", "value": q["updated_at"][11:16], "sub": "最近一次快照"},
            ],
        },
        "threshold": 20,
        "kpis": [
            {"icon": "people", "label": "当前排队总人数", "value": str(q["total"]), "unit": "人",
             "tone": "danger" if crowded else "ok", "delta": f"{len(crowded)} 个窗口拥挤", "source": "实时快照"},
            {"icon": "target", "label": "最拥挤窗口", "value": busiest["窗口"].split(" · ")[0], "unit": "",
             "tone": "danger", "delta": f"排队 {busiest['排队人数']} 人", "source": busiest["窗口"].split(" · ")[-1]},
            {"icon": "clock", "label": "窗口平均等待",
             "value": f"{round(sum(w['排队人数'] for w in windows) / len(windows) / legacy.PEOPLE_PER_MINUTE, 1)}",
             "unit": "分钟", "tone": "warn", "delta": f"按 {legacy.PEOPLE_PER_MINUTE} 人/分钟估算", "source": "排队模型"},
            {"icon": "camera", "label": "摄像头在线", "value": f"{sum(1 for c in q['cameras'] if c['status'] == '在线')}/8",
             "unit": "路", "tone": "danger", "delta": "2 路离线待修", "source": "心跳检测"},
        ],
        "alert": (
            f"{crowded[0]['窗口']} 当前拥挤，排队 {crowded[0]['排队人数']} 人（超过 {legacy.CROWD_THRESHOLD} 人阈值），"
            f"{crowded[0]['预计等待']} —— 建议引导至「楼层分流建议」查看其他楼层窗口。"
        ) if crowded else "",
        "windows": [
            {
                "name": w["窗口"],
                "floor": f"{w['楼层']}F",
                "people": w["排队人数"],
                "wait": w["预计等待"],
                "level": w["拥挤度"],
            }
            for w in windows
        ],
        "trend": {
            "categories": [s[11:16] for s in stamps],
            "series": series,
        },
        "cameras": [
            {
                "id": c["camera_id"], "name": c["name"], "floor": f"{c['floor']}F",
                "status": c["status"], "resolution": c["resolution"], "fps": c["fps"],
            }
            for c in q["cameras"]
        ],
    }


# ---------------------------------------------------------------- 楼层
def build_floors() -> dict:
    data = legacy.load_floor_data()
    floors, best = data["floors"], data["best"]

    by_hour: dict[int, dict[int, int]] = {}
    for row in data["flow"]:
        by_hour.setdefault(row["hour"], {})[row["floor"]] = row["diners"]
    hours = sorted(by_hour)

    return {
        "hero": {
            "eyebrow": "CONTROL CENTER / FLOOR",
            "title": "楼层分流建议",
            "subtitle": "汇总各楼层人流与座位占用，给出「去哪一层就餐最省时间」的建议",
            "stats": [
                {"label": "DINERS", "value": f"{data['total_diners']} 人", "sub": "三层在餐总人数"},
                {"label": "RECOMMEND", "value": best["楼层"], "sub": "当前推荐楼层"},
                {"label": "SEATS", "value": f"{sum(f['座位数'] for f in floors)} 座", "sub": "三个楼层座位总量"},
            ],
        },
        "advice": {
            "title": f"现在请前往「{best['楼层']}」就餐",
            "reason": (
                f"该楼层在座 {best['在座人数']} / 座位 {best['座位数']} 个，座位使用率 {best['座位使用率']}%，"
                "为三层中最低；按当前排队模型估算，可直接打饭的概率最高。"
            ),
            "badges": ["数据完整性校验通过", "建议前往耗时约 2 分钟"],
        },
        "kpis": [
            {
                "icon": "seat", "label": f"{f['楼层']}座位使用率", "value": f"{f['座位使用率']:.1f}", "unit": "%",
                "tone": "danger" if f["座位使用率"] >= 80 else "warn" if f["座位使用率"] >= 65 else "ok",
                "delta": f"在座 {f['在座人数']} / {f['座位数']}", "source": "floor_stats",
            }
            for f in floors
        ] + [{
            "icon": "clock", "label": "推荐楼层等待", "value": "2", "unit": "分钟",
            "tone": "ok", "delta": "按排队模型估算", "source": "分流算法",
        }],
        "floors": [
            {
                "name": f["楼层"], "seats": f["座位数"], "occupied": f["在座人数"],
                "usage": f["座位使用率"],
                "wait": "约 10 分钟" if f["座位使用率"] >= 80 else "约 2 分钟",
                "tone": "danger" if f["座位使用率"] >= 80 else "warn" if f["座位使用率"] >= 65 else "ok",
            }
            for f in floors
        ],
        "share": [
            {"name": f["楼层"], "value": f["就餐总人数"],
             "tone": "accent" if f["floor"] == 1 else "ok" if f["floor"] == 2 else "warn"}
            for f in floors
        ],
        "flow": {
            "categories": [f"{h:02d}:00" for h in hours],
            "series": [
                {"name": f"{fl}楼", "values": [by_hour[h].get(fl, 0) for h in hours],
                 "tone": "accent" if fl == 1 else "ok" if fl == 2 else "warn"}
                for fl in sorted({r["floor"] for r in data["flow"]})
            ],
        },
    }


# ---------------------------------------------------------------- 营养
DIM_TIPS = {
    "protein": ("蛋白质", "每天加一份鸡蛋、牛奶或豆制品"),
    "carb": ("碳水化合物", "主食别只吃精米面，可搭配杂粮饭或玉米"),
    "fiber": ("膳食纤维", "每天一份深色蔬菜，外加一份水果"),
    "vitamin": ("维生素", "多选清炒时蔬，少选油炸类"),
    "minerals": ("钙铁锌", "每天一份奶制品，红肉每周 2-3 次"),
    "fat_control": ("脂肪控制", "少选油炸、红烧与重油菜品"),
}


def build_nutrition() -> dict:
    students = []
    for label in legacy.load_student_list():
        d = legacy.load_nutrition_data(label)
        s, w = d["student"], d["weekly"]
        dims = [
            {"key": k, "name": DIM_TIPS[k][0], "score": w.get(k, 0), "tip": DIM_TIPS[k][1]}
            for k in ("protein", "carb", "fiber", "vitamin", "minerals", "fat_control")
        ]
        weakest = sorted(dims, key=lambda x: x["score"])[:2]
        students.append({
            "label": label,
            "id": s["student_id"],
            "name": s["name"],
            "class_name": s["class_name"],
            "card_no": s["card_no"],
            "week": d["week_label"],
            "kpis": [
                {"icon": "nutrition", "label": "日均热量", "value": f"{w.get('kcal_avg', 0):.0f}", "unit": "kcal",
                 "tone": "ok", "delta": "推荐 2000 kcal", "source": "点餐记录"},
                {"icon": "shield", "label": "蛋白质达标率", "value": f"{w.get('protein', 0):.0f}", "unit": "%",
                 "tone": "ok" if w.get("protein", 0) >= 90 else "warn", "delta": "推荐 60 g/日", "source": "菜品营养库"},
                {"icon": "wallet", "label": "本周餐费", "value": f"{w.get('cost', 0):.1f}", "unit": "元",
                 "tone": "flat", "delta": f"日均 {w.get('cost', 0) / 8:.1f} 元", "source": "消费记录"},
                {"icon": "target", "label": "综合营养得分", "value": f"{w.get('score', 0):.0f}", "unit": "分",
                 "tone": "ok", "delta": "六维加权平均", "source": "营养模型"},
            ],
            "radar": {
                "axes": [x["name"] for x in dims],
                "actual": [x["score"] for x in dims],
                "standard": [100] * 6,
            },
            "advice": [{"name": x["name"], "score": x["score"], "tip": x["tip"]} for x in weakest],
            "trend": {
                "categories": [r["day"][5:].replace("-", "/") for r in d["daily"]],
                "kcal": [r["kcal"] for r in d["daily"]],
                "protein": [r["protein"] for r in d["daily"]],
            },
            "meals": [
                {"name": "晚餐", "value": 56.2, "tone": "accent"},
                {"name": "午餐", "value": 31.8, "tone": "ok"},
                {"name": "早餐", "value": 12.0, "tone": "warn"},
            ],
            "records": [
                {"time": r["ts"][5:16], "meal": r["meal_type"], "dish": r["name"],
                 "kcal": f"{r['kcal']:.0f}", "amount": f"¥{r['amount']:.1f}"}
                for r in d["records"]
            ],
            "pushes": [
                {"day": p["day"][5:], "channel": p["channel"], "status": p["status"]}
                for p in d["pushes"]
            ],
        })
    return {"hero": None, "students": students}


# ---------------------------------------------------------------- 清单 / 扩展位
def build_manifest(students: list[dict]) -> dict:
    return {
        "version": "1.0.0",
        "phase": "第一阶段 · 演示版",
        "brand": {"title": "智慧食堂", "subtitle": "CONTROL CENTER", "school": "人大附中"},
        "nav": [
            {"id": "overview", "label": "系统总览", "icon": "grid"},
            {"id": "queue", "label": "排队拥堵监控", "icon": "queue"},
            {"id": "floors", "label": "楼层分流建议", "icon": "layers"},
            {"id": "nutrition", "label": "营养健康分析", "icon": "nutrition"},
            {"id": "extensions", "label": "扩展与接入", "icon": "puzzle"},
        ],
        "modules": [
            {"id": "queue", "name": "排队拥堵监控", "owner": "CV 组", "status": "planned",
             "dataFile": "data/queue.json", "schema": "docs/INTERFACE.md#排队模块-queuejson",
             "hint": "检测各窗口排队人数，写 window.people / wait"},
            {"id": "floors", "name": "楼层分流建议", "owner": "硬件组", "status": "planned",
             "dataFile": "data/floors.json", "schema": "docs/INTERFACE.md#楼层模块-floorsjson",
             "hint": "汇总多路摄像头 → 楼层人流与座位占用"},
            {"id": "nutrition", "name": "营养健康分析", "owner": "数据组", "status": "mock",
             "dataFile": "data/nutrition.json", "schema": "docs/INTERFACE.md#营养模块-nutritionjson",
             "hint": "餐卡点餐流水 → 六维营养得分与周报"},
        ],
        "extensionSlots": [
            {"id": "ext-slot-1", "name": "新分项目 A（预留）", "status": "empty",
             "hint": "在 data/extensions.json 里追加一条配置即可上线一个空白模块页"},
            {"id": "ext-slot-2", "name": "新分项目 B（预留）", "status": "empty",
             "hint": "支持 KPI / 折线 / 柱状 / 环形 / 表格 五种通用卡片，无需改前端代码"},
        ],
        "thresholds": {"crowd": legacy.CROWD_THRESHOLD, "busy": legacy.BUSY_THRESHOLD,
                       "peoplePerMinute": legacy.PEOPLE_PER_MINUTE},
        "students": [s["label"] for s in students],
        "updated": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }


def build_extensions() -> dict:
    """扩展位说明页的数据：完全数据驱动，新增分项目不用改代码。"""
    return {
        "intro": {
            "title": "扩展与接入",
            "subtitle": "平台已预留「模块注册 + 数据源替换」两层接口，新分项目按约定写 JSON 即可上线",
        },
        "slots": [
            {"id": "queue", "name": "排队拥堵监控", "owner": "CV 组", "status": "预留中",
             "type": "模块", "hint": "摄像头 → YOLO → 窗口级人数，写入 data/queue.json"},
            {"id": "floors", "name": "楼层分流建议", "owner": "硬件组", "status": "预留中",
             "type": "模块", "hint": "多路摄像头汇总 → 楼层人流 / 座位占用，写入 data/floors.json"},
            {"id": "nutrition", "name": "营养健康分析", "owner": "数据组", "status": "预留中",
             "type": "模块", "hint": "餐卡流水 → 六维营养，写入 data/nutrition.json"},
            {"id": "slot-a", "name": "新分项目 A", "owner": "待认领", "status": "空槽位",
             "type": "通用模块", "hint": "编辑 data/extensions.json 增加配置，即可生成一个通用模块页"},
            {"id": "slot-b", "name": "新分项目 B", "owner": "待认领", "status": "空槽位",
             "type": "通用模块", "hint": "通用卡片支持 KPI / 折线 / 柱状 / 环形 / 表格"},
        ],
        "contract": [
            {"title": "1. 数据接口（推荐）", "lines": [
                "把结果写成 web/data/<模块>.json，字段见 docs/INTERFACE.md",
                "页面启动时自动 fetch，无需改任何前端代码",
                "适合：离线演示、答辩现场、算法同学单独跑脚本",
            ]},
            {"title": "2. JS 数据源（实时）", "lines": [
                "在 assets/js/modules/*.js 里调用 Platform.registerDataSource('queue', fn)",
                "fn 返回与 JSON 同构的对象，平台会用它覆盖 mock 数据",
                "适合：已有后端 / WebSocket / 行空板串口转发",
            ]},
            {"title": "3. 页面扩展（新分项目）", "lines": [
                "Platform.registerPage({id, label, icon, render}) 增加一个导航页",
                "或在 data/extensions.json 里声明通用模块（零代码）",
                "适合：合作关系方独立开发自己的板块",
            ]},
        ],
        "genericDemo": {
            "name": "示例：翻台率监控（占位）",
            "kpis": [
                {"label": "平均翻台率", "value": "3.2", "unit": "次/桌", "delta": "示例数据", "tone": "ok"},
                {"label": "最长停留", "value": "38", "unit": "分钟", "delta": "示例数据", "tone": "warn"},
                {"label": "空闲桌数", "value": "24", "unit": "桌", "delta": "示例数据", "tone": "ok"},
            ],
            "note": "这个卡片是通用渲染器跑出来的：只要 data/extensions.json 里加一段同样的结构，就能上线新分项目。",
        },
    }


def main() -> None:
    print("导出静态演示数据 →", OUT)
    dump("overview", build_overview())
    dump("queue", build_queue())
    dump("floors", build_floors())
    nutrition = build_nutrition()
    dump("nutrition", nutrition)
    students = nutrition["students"]
    dump("manifest", build_manifest(students))
    dump("extensions", build_extensions())

    bundle = {
        "manifest": json.loads((OUT / "manifest.json").read_text(encoding="utf-8")),
        "overview": json.loads((OUT / "overview.json").read_text(encoding="utf-8")),
        "queue": json.loads((OUT / "queue.json").read_text(encoding="utf-8")),
        "floors": json.loads((OUT / "floors.json").read_text(encoding="utf-8")),
        "nutrition": nutrition,
        "extensions": json.loads((OUT / "extensions.json").read_text(encoding="utf-8")),
    }
    js = (
        "/* 自动生成，请勿手改：由 tools/export_web_data.py 从 data/*.json 内联而来。\n"
        "   作用：让 index.html 直接用 file:// 双击打开时也能拿到数据（fetch 在 file:// 下会被浏览器拦截）。*/\n"
        "window.__PLATFORM_DATA__ = "
        + json.dumps(bundle, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    path = ROOT / "web" / "assets" / "js" / "data.js"
    path.write_text(js, encoding="utf-8")
    print(f"  ok  assets/js/data.js  ({path.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
