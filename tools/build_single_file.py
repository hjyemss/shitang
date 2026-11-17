#!/usr/bin/env python3
"""
把 web/ 打包成一个单文件 HTML（双击即开，方便交作业 / 上传 / 发微信）

用法：
    python3 tools/build_single_file.py
产物：
    dist/智慧食堂总控大屏.html
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
DIST = ROOT / "dist"
OUT_NAME = "智慧食堂总控大屏.html"

LINK_RE = re.compile(r'<link rel="stylesheet" href="([^"]+)"\s*/?>')
SCRIPT_RE = re.compile(r'<script src="([^"]+)"></script>')


def read(rel: str) -> str:
    return (WEB / rel).read_text(encoding="utf-8")


def main() -> None:
    html = (WEB / "index.html").read_text(encoding="utf-8")

    css_count = 0
    js_count = 0

    def inline_css(m: re.Match) -> str:
        nonlocal css_count
        css_count += 1
        return "<style>\n" + read(m.group(1)) + "\n</style>"

    def inline_js(m: re.Match) -> str:
        nonlocal js_count
        js_count += 1
        body = read(m.group(1))
        # 防止脚本里出现 </script> 提前闭合
        body = body.replace("</script>", "<\\/script>")
        return "<script>\n" + body + "\n</script>"

    html = LINK_RE.sub(inline_css, html)
    html = SCRIPT_RE.sub(inline_js, html)
    html = html.replace(
        "<title>",
        "<!-- 单文件构建产物：由 tools/build_single_file.py 生成，请勿手改 -->\n  <title>",
    )

    DIST.mkdir(parents=True, exist_ok=True)
    out = DIST / OUT_NAME
    out.write_text(html, encoding="utf-8")
    print(f"打包完成：{out}")
    print(f"  内联 CSS {css_count} 个 / JS {js_count} 个")
    print(f"  体积 {out.stat().st_size / 1024:.1f} KB（含全部演示数据，可离线双击打开）")


if __name__ == "__main__":
    main()
