#!/usr/bin/env python3
"""세 페이지(index · privacy · support)를 짓는다.

    python3 src/build.py

- 틀은 `src/*.tpl.html`, 글은 `src/*.{ko,en,ja,es}.json` 이다.
  index 만 이름에 접두가 없다(`ko.json`) — 처음 지은 자리라 그대로 둔다.
- **한국어를 HTML 에 그대로 굽는다.** 자바스크립트가 꺼져 있어도, 검색 엔진에도
  한국어 문서가 선다. 나머지 셋은 `<script id="i18n">` 의 표에서 읽어 바꿔 단다.
- 언어를 바꾸는 장치는 `src/i18n.js` 하나이고 세 페이지에 함께 구워 넣는다.
  고른 언어는 localStorage 에 남아 **페이지를 옮겨도 따라온다.**
- privacy · support 는 `src/page.css` 를 함께 쓴다.
- 온도는 글 안에 `{c:36.5}`, 차이는 `{d:0.7}` 로 적는다 — 빌드와 i18n.js 가 같은
  규칙으로 `<span class="tv" data-c="36.5">36.5℃</span>` 로 편다.

한 페이지의 네 표에서 키가 어긋나거나, 틀이 표에 없는 키를 부르면 멈춘다.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent
LANGS = ["ko", "en", "ja", "es"]

# (틀, 표 이름의 접두, 내놓을 파일). 접두가 빈 것은 index 다.
PAGES = [
    ("index.tpl.html", "", "index.html"),
    ("privacy.tpl.html", "privacy.", "privacy.html"),
    ("support.tpl.html", "support.", "support.html"),
]

# 틀이 쓰지 않아도 되는 키 — 자바스크립트가 직접 부른다.
SCRIPT_ONLY = {"dial.warmer", "dial.cooler", "store.play",
               "film.cap.2", "film.cap.3", "film.cap.4", "film.cap.5", "film.cap.6", "film.play"}


def places(literal: str) -> int:
    """글에 적은 소수 자릿수(적어도 한 자리)."""
    return max(1, len(literal.split(".", 1)[1])) if "." in literal else 1


def expand(s: str) -> str:
    s = re.sub(r"\{c:([\d.]+)\}", lambda m: f'<span class="tv" data-c="{m[1]}">{float(m[1]):.1f}℃</span>', s)
    # 차이는 글에 적은 자릿수를 지킨다({d:0.45} → 0.45℃). i18n.js 의 places() 와 같은 규칙이다.
    s = re.sub(r"\{d:([\d.]+)\}", lambda m: f'<span class="tv" data-d="{m[1]}">{float(m[1]):.{places(m[1])}f}℃</span>', s)
    return s


def plain(s: str) -> str:
    return re.sub(r"<[^>]+>", "", expand(s)).replace('"', "&quot;")


def build(tpl_name: str, prefix: str, out_name: str, i18n_js: str, page_css: str) -> bool:
    tables = {
        lang: json.loads((ROOT / f"{prefix}{lang}.json").read_text(encoding="utf-8"))
        for lang in LANGS
    }
    keys = set(tables["ko"])
    ok = True
    for lang in LANGS[1:]:
        missing = keys - set(tables[lang])
        extra = set(tables[lang]) - keys
        if missing or extra:
            ok = False
            print(f"  {out_name} · {lang}: 빠진 키 {sorted(missing)} · 남는 키 {sorted(extra)}")

    tpl = (ROOT / tpl_name).read_text(encoding="utf-8")
    used = set(re.findall(r'data-i(?:-[a-z-]+)?="([^"]+)"', tpl))
    unknown = used - keys
    unused = keys - used - SCRIPT_ONLY
    if unknown:
        ok = False
        print(f"  {out_name}: 틀에는 있는데 표에 없는 키 {sorted(unknown)}")
    if unused:
        print(f"  (참고) {out_name}: 표에는 있는데 틀이 쓰지 않는 키 {sorted(unused)}")
    if not ok:
        return False

    ko = tables["ko"]

    def fill(m: re.Match) -> str:
        open_tag, tag, key = m[1], m[2], m[3]
        text = expand(ko[key])
        if tag in ("title", "text"):
            text = re.sub(r"<[^>]+>", "", text)
        return f"{open_tag}{text}</{tag}>"

    out = re.sub(r'(<([a-zA-Z0-9]+)\b[^>]*\bdata-i="([^"]+)"[^>]*>)(</\2>)', fill, tpl)

    def attr(m: re.Match) -> str:
        name, key = m[1], m[2]
        return f'{name}="{plain(ko[key])}" data-i-{name}="{key}"'

    out = re.sub(r'data-i-(alt|aria-label|aria-roledescription|content)="([^"]+)"', attr, out)

    payload = json.dumps(tables, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    out = out.replace("{{I18N_JSON}}", payload)
    out = out.replace("{{I18N_JS}}", i18n_js)
    out = out.replace("{{PAGE_CSS}}", page_css)

    left = re.findall(r"\{\{[A-Z_]+\}\}", out)
    if left:
        print(f"  {out_name}: 채우지 못한 자리 {sorted(set(left))}")
        return False

    (OUT / out_name).write_text(out, encoding="utf-8")
    print(f"  {out_name} {len(out.encode('utf-8')):,} bytes · 키 {len(keys)}개 × {len(LANGS)}개 언어")
    return True


def main() -> int:
    i18n_js = (ROOT / "i18n.js").read_text(encoding="utf-8").rstrip()
    page_css = (ROOT / "page.css").read_text(encoding="utf-8").rstrip()
    ok = True
    for tpl, prefix, out_name in PAGES:
        if not build(tpl, prefix, out_name, i18n_js, page_css):
            ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
