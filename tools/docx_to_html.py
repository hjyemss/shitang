#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把《智慧食堂项目介绍.docx》转换成单文件网站（无外部依赖、无 JS 路由）。

用法： python3 tools/docx_to_html.py
产物： 贺嘉懿的项目介绍.html
"""

from __future__ import annotations

import base64
import html
import io
from pathlib import Path

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "智慧食堂项目介绍.docx"
SHOT = ROOT / "screenshots" / "01_overview.png"
OUT = ROOT / "贺嘉懿的项目介绍.html"
TITLE = "贺嘉懿的项目介绍"


# ------------------------------------------------------------------ 读取 docx
def iter_blocks(doc):
    """按文档顺序产出段落与表格。"""
    body = doc.element.body
    for child in body.iterchildren():
        if child.tag == qn("w:p"):
            yield Paragraph(child, doc)
        elif child.tag == qn("w:tbl"):
            yield Table(child, doc)


def run_style(p: Paragraph):
    sizes, bold, color = [], False, None
    for r in p.runs:
        if not r.text.strip():
            continue
        if r.font.size:
            sizes.append(r.font.size.pt)
        if r.font.bold:
            bold = True
        if r.font.color and r.font.color.rgb:
            color = str(r.font.color.rgb)
    return (max(sizes) if sizes else 10.5), bold, color


def is_centered(p: Paragraph) -> bool:
    return p.paragraph_format.alignment is not None and int(p.paragraph_format.alignment) == 1


# ------------------------------------------------------------------ HTML 片段
def esc(t: str) -> str:
    return html.escape(t, quote=False)


def table_html(tbl: Table) -> str:
    rows = tbl.rows
    if not rows:
        return ""
    out = ['<div class="tbl-wrap"><table>']
    head = rows[0].cells
    out.append("<thead><tr>" + "".join(f"<th>{esc(c.text.strip())}</th>" for c in head) + "</tr></thead><tbody>")
    for row in rows[1:]:
        cells = [c.text.strip() for c in row.cells]
        out.append("<tr>" + "".join(f"<td>{esc(c)}</td>" for c in cells) + "</tr>")
    out.append("</tbody></table></div>")
    return "".join(out)


def image_b64(path: Path, width: int = 1200) -> str:
    img = Image.open(path).convert("RGB")
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=86, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


# ------------------------------------------------------------------ 组装
def build() -> str:
    doc = Document(SRC)
    blocks = list(iter_blocks(doc))

    # 前 4 段是封面（标题 / 课题 / 英文 / 一句话），第 1 张表是项目信息
    cover_ps = [b for b in blocks if isinstance(b, Paragraph)]
    title = cover_ps[0].text.strip()
    subtitle = cover_ps[1].text.strip()
    english = cover_ps[2].text.strip()
    quote = cover_ps[3].text.strip()

    meta_tables = [b for b in blocks if isinstance(b, Table)]
    meta = meta_tables[0] if meta_tables else None

    body_parts: list[str] = []
    list_open = None  # 'ul' / 'ol' / None
    started = False

    def close_list():
        nonlocal list_open
        if list_open:
            body_parts.append(f"</{list_open}>")
            list_open = None

    for blk in blocks:
        if isinstance(blk, Table):
            close_list()
            if blk is meta:
                continue
            body_parts.append(table_html(blk))
            continue

        text = blk.text.strip()
        if not text:
            continue
        if not started:
            if not text.startswith("一、"):
                continue
            started = True

        style = blk.style.name if blk.style is not None else ""
        size, bold, _ = run_style(blk)

        if style.startswith("List Bullet"):
            if list_open != "ul":
                close_list()
                body_parts.append("<ul>")
                list_open = "ul"
            body_parts.append(f"<li>{esc(text)}</li>")
            continue
        if style.startswith("List Number"):
            if list_open != "ol":
                close_list()
                body_parts.append("<ol>")
                list_open = "ol"
            body_parts.append(f"<li>{esc(text)}</li>")
            continue

        close_list()

        if size >= 14:
            body_parts.append(f'<h2 id="{esc(text.split("、")[0])}">{esc(text)}</h2>')
        elif size >= 11.5 and bold:
            body_parts.append(f"<h3>{esc(text)}</h3>")
        elif is_centered(blk) and size <= 9.5:
            body_parts.append(f'<p class="cap">{esc(text)}</p>')
        else:
            body_parts.append(f"<p>{esc(text)}</p>")

        # 图：紧跟技术栈段落之后插入大屏截图
        if text.startswith("技术栈："):
            body_parts.append(
                '<figure><img alt="总控大屏·系统总览页" src="%s">'
                '<figcaption>图 1　总控大屏 · 系统总览页（演示数据）</figcaption></figure>' % image_b64(SHOT)
            )

    close_list()

    meta_html = table_html(meta) if meta is not None else ""

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(TITLE)}</title>
<style>
  :root {{
    --navy: #1f3e63;
    --blue: #1a6ca8;
    --teal: #0f6b5c;
    --ink: #1f2937;
    --muted: #5b6b7c;
    --line: #dbe4ee;
    --bg: #ffffff;
    --soft: #f5f8fc;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: "Songti SC", "SimSun", "Noto Serif CJK SC", Georgia, serif;
    font-size: 16px;
    line-height: 1.95;
    -webkit-font-smoothing: antialiased;
  }}
  .page {{ max-width: 900px; margin: 0 auto; padding: 64px 44px 96px; }}

  /* ---------- 封面 ---------- */
  .cover {{ padding: 8px 0 30px; border-bottom: 3px solid var(--navy); margin-bottom: 34px; }}
  .cover h1 {{
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
    font-size: 38px; line-height: 1.3; color: var(--navy);
    margin: 0 0 14px; letter-spacing: .5px; font-weight: 800;
  }}
  .cover .subject {{
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
    font-size: 19px; color: var(--blue); font-weight: 700; margin: 0 0 8px;
  }}
  .cover .en {{ font-size: 13px; color: var(--muted); letter-spacing: .3px; margin: 0 0 20px; font-family: Georgia, serif; }}
  .cover .slogan {{
    display: inline-block; background: #eef7f4; color: var(--teal);
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif; font-weight: 700;
    padding: 8px 16px; border-radius: 999px; font-size: 15px; margin: 0 0 4px;
  }}
  .meta {{ margin-top: 26px; }}

  /* ---------- 标题层级 ---------- */
  h2 {{
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
    font-size: 26px; color: var(--navy); font-weight: 800;
    margin: 52px 0 18px; padding: 0 0 10px 14px;
    border-left: 6px solid var(--navy); border-bottom: 1px solid var(--line);
  }}
  h3 {{
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
    font-size: 19px; color: var(--blue); font-weight: 700;
    margin: 30px 0 10px;
  }}

  p {{ margin: 0 0 14px; text-align: justify; text-indent: 2em; }}
  p.cap {{ text-indent: 0; text-align: center; font-size: 13px; color: var(--muted); margin-top: -6px; }}

  ul, ol {{ margin: 0 0 16px; padding-left: 1.6em; }}
  li {{ margin: 4px 0; text-align: justify; }}

  /* ---------- 表格 ---------- */
  .tbl-wrap {{ overflow-x: auto; margin: 6px 0 22px; border-radius: 10px; border: 1px solid var(--line); }}
  table {{ width: 100%; border-collapse: collapse; font-size: 15px; }}
  thead th {{
    background: var(--navy); color: #fff; text-align: left; font-weight: 700;
    padding: 11px 14px; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; white-space: nowrap;
  }}
  tbody td {{ padding: 11px 14px; border-top: 1px solid var(--line); vertical-align: top; line-height: 1.75; }}
  tbody tr:nth-child(even) {{ background: var(--soft); }}
  tbody td:first-child {{ font-weight: 600; color: #24405f; }}

  /* ---------- 插图 ---------- */
  figure {{ margin: 26px 0 30px; }}
  figure img {{
    width: 100%; height: auto; display: block; border-radius: 12px;
    border: 1px solid var(--line); box-shadow: 0 10px 26px rgba(19, 42, 74, .10);
  }}
  figcaption {{ text-align: center; font-size: 13px; color: var(--muted); margin-top: 10px; }}

  /* ---------- 页脚 ---------- */
  .foot {{
    margin-top: 64px; padding-top: 16px; border-top: 1px solid var(--line);
    font-size: 13px; color: var(--muted); display: flex; justify-content: space-between;
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  }}
  .foot a {{ color: var(--blue); text-decoration: none; }}

  @media (max-width: 640px) {{
    .page {{ padding: 32px 20px 60px; }}
    .cover h1 {{ font-size: 28px; }}
    h2 {{ font-size: 21px; }}
    table {{ font-size: 13.5px; }}
  }}
  @media print {{
    .page {{ max-width: none; padding: 0; }}
    h2 {{ page-break-after: avoid; }}
    .tbl-wrap, figure {{ page-break-inside: avoid; }}
    a {{ color: inherit; }}
  }}
</style>
</head>
<body>
<div class="page">

  <header class="cover">
    <h1>{esc(title)}</h1>
    <p class="subject">{esc(subtitle)}</p>
    <p class="en">{esc(english)}</p>
    <p class="slogan">{esc(quote)}</p>
    <div class="meta">{meta_html}</div>
  </header>

  {''.join(body_parts)}

  <footer class="foot">
    <span>{esc(TITLE)} · v1.0 · 2026 年 11 月</span>
    <span><a href="https://github.com/hjyemss/shitang" target="_blank" rel="noopener">github.com/hjyemss/shitang</a></span>
  </footer>
</div>
</body>
</html>
"""


if __name__ == "__main__":
    html_text = build()
    OUT.write_text(html_text, encoding="utf-8")
    print(f"已生成：{OUT}（{OUT.stat().st_size / 1024:.0f} KB）")
