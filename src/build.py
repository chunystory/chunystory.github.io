#!/usr/bin/env python3
"""index.html 을 짓는다.

    python3 src/build.py

- `src/index.tpl.html` 이 틀이고, 글은 `src/{ko,en,ja,es}.json` 에 있다.
- 한국어를 HTML 에 그대로 굽는다(자바스크립트가 없어도, 검색 엔진에도 한국어로 선다).
- 네 언어 표는 `<script id="i18n">` 에 통째로 넣고, 페이지의 스크립트가 언어와
  단위를 바꿀 때 그 표를 읽는다.
- 온도는 글 안에 `{c:36.5}` 로 적는다. 차이값은 `{d:0.7}`. 빌드와 스크립트가 같은
  규칙으로 `<span class="tv" data-c="36.5">36.5℃</span>` 로 편다 — 화씨로 바꿀 때
  그 span 만 다시 쓴다.

네 표의 키가 서로 다르면 멈춘다.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LANGS = ["ko", "en", "ja", "es"]


def expand(s: str) -> str:
    s = re.sub(r"\{c:([\d.]+)\}", lambda m: f'<span class="tv" data-c="{m[1]}">{float(m[1]):.1f}℃</span>', s)
    s = re.sub(r"\{d:([\d.]+)\}", lambda m: f'<span class="tv" data-d="{m[1]}">{float(m[1]):.1f}℃</span>', s)
    return s


def plain(s: str) -> str:
    return re.sub(r"<[^>]+>", "", expand(s)).replace('"', "&quot;")


def main() -> int:
    tables = {lang: json.loads((ROOT / f"{lang}.json").read_text(encoding="utf-8")) for lang in LANGS}
    keys = set(tables["ko"])
    ok = True
    for lang in LANGS[1:]:
        missing = keys - set(tables[lang])
        extra = set(tables[lang]) - keys
        if missing or extra:
            ok = False
            print(f"{lang}: 빠진 키 {sorted(missing)} · 남는 키 {sorted(extra)}")
    tpl = (ROOT / "index.tpl.html").read_text(encoding="utf-8")
    used = set(re.findall(r'data-i(?:-[a-z-]+)?="([^"]+)"', tpl))
    unknown = used - keys
    unused = keys - used - {"dial.warmer", "dial.cooler", "store.play"}
    if unknown:
        ok = False
        print(f"틀에는 있는데 표에 없는 키: {sorted(unknown)}")
    if unused:
        print(f"(참고) 표에는 있는데 틀이 쓰지 않는 키: {sorted(unused)}")
    if not ok:
        return 1

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
    (ROOT.parent / "index.html").write_text(out, encoding="utf-8")
    print(f"index.html {len(out.encode('utf-8')):,} bytes · 키 {len(keys)}개 × {len(LANGS)}개 언어")
    return 0


if __name__ == "__main__":
    sys.exit(main())
