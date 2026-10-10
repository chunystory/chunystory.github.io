#!/usr/bin/env python3
"""네 페이지(index · privacy · support · history)를 짓고, 검색 엔진이 읽을 sitemap.xml 을 함께 쓴다.

    python3 src/build.py

- 틀은 `src/*.tpl.html`, 글은 `src/*.{ko,en,ja,es}.json` 이다.
  index 만 이름에 접두가 없다(`ko.json`) — 처음 지은 자리라 그대로 둔다.
- **첫 페이지는 언어마다 제 주소에 굽는다** — `/`(한국어) · `/en/` · `/ja/` · `/es/`.
  글이 HTML 에 그대로 있어서 자바스크립트를 돌리지 않는 검색 엔진(네이버)도, 기기
  언어가 en-US 인 구글의 렌더러도 그 주소의 언어를 읽는다. 주소마다 canonical ·
  hreflang · og · JSON-LD(앱 · 자주 묻는 것)를 그 언어로 단다.
- privacy · support · history 는 주소가 하나다. 한국어로 굽고, 나머지 셋은 `<script id="i18n">`
  의 표에서 읽어 바꿔 단다 — 앱 안의 링크가 언어 없이 이 주소를 연다.
- 언어를 바꾸는 장치는 `src/i18n.js` 하나이고 세 페이지에 함께 구워 넣는다.
  고른 언어는 localStorage 에 남아 **페이지를 옮겨도 따라온다.**
- privacy · support 는 `src/page.css` 를 함께 쓴다.
- 온도는 글 안에 `{c:36.5}`, 차이는 `{d:0.7}` 로 적는다 — 빌드와 i18n.js 가 같은
  규칙으로 `<span class="tv" data-c="36.5">36.5℃</span>` 로 편다.
- sitemap.xml 의 lastmod 는 구운 파일이 실제로 달라졌을 때만 오늘로 바뀐다.
  달라진 주소를 검색 엔진에 바로 알리려면 `python3 src/indexnow.py`.

한 페이지의 네 표에서 키가 어긋나거나, 틀이 표에 없는 키를 부르면 멈춘다.

1.1.1 리뉴얼(2026-10-11) — 개인정보 다음에 하루 한 쪽(#daily) · 한 달 한 장(#month) · 홈 화면 위젯(#widget)을
앞세우고, 이력 페이지(history.html)를 더했다. 위젯 사진(`shots/{lang}/widget-*.webp`)과 영상(`video/{lang}/widget.mp4`)은
시뮬레이터의 진짜 홈 화면에 위젯을 올리고 시스템 언어를 바꿔 가며 찍었다. 이력의 글은 App Store 「버전 기록」에 실제로
나간 출시 노트(날짜는 한국 시각)에서 옮겼다.

1.0.10 리뉴얼(2026-10-06) 뒤의 첫 페이지가 쓰는 그림과 영상:
- `shots/{lang}/*.webp` — 17 Pro Max 시뮬레이터에서 찍은 실제 앱 화면(720폭). 샘플 기록장
  다섯 쪽(day-*)과 서랍 칸(drawer-*)은 촬영용 진입점이 심은 꾸밈이다.
- `video/{lang}/*.mp4 · .webp` — 같은 진입점이 손짓을 포인터 이벤트로 넣어 녹화한 장면(576폭,
  포스터는 장면의 핵심 자리). `video/tour-{lang}-*` · `how-*` 는 그 전 판의 영상이다.
- `stickers/*.webp` — 앱의 StickerArt 를 투명 바탕으로 구운 그림. 효과 실험실과 직접 꾸며 보기
  (`js/decor.js`)가 앱의 효과 이름 그대로(`fx.e.*`) 웹에서 흉내 낸다.

이름(2026-10-07): 꾸미는 것을 「다이어리 · 플래너 · 手帳 · diario」라 부르지 않는다 — 일정 · 할 일까지
기대하게 된다. 말온도가 꾸미는 것은 그날의 말과 온도의 기록이다. 물건은 기록장 · 記録帳 · record book ·
cuaderno, 하는 일은 기록 꾸미기 · 記録を飾る · decorate your records · decora tus registros.
"""
import datetime
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent
LANGS = ["ko", "en", "ja", "es"]
SITE = "https://chunystory.github.io"

# 첫 페이지의 언어별 주소 — i18n.js 의 HOME 과 같다.
HOME = {"ko": "/", "en": "/en/", "ja": "/ja/", "es": "/es/"}
# 네 언어 어디에도 맞지 않는 사람에게 보일 주소. 한국어보다 영어가 읽힐 공산이 크다.
X_DEFAULT = "en"
OG_LOCALE = {"ko": "ko_KR", "en": "en_US", "ja": "ja_JP", "es": "es_ES"}
CURRENCY = {"ko": "KRW", "en": "USD", "ja": "JPY", "es": "EUR"}
APP_STORE = "https://apps.apple.com/kr/app/id6809147797"
PLAY = "https://play.google.com/store/apps/details?id=com.malondo.malondo_app"

# (틀, 표 이름의 접두, 내놓을 파일). 접두가 빈 것은 index 다.
PAGES = [
    ("index.tpl.html", "", "index.html"),
    ("privacy.tpl.html", "privacy.", "privacy.html"),
    ("support.tpl.html", "support.", "support.html"),
    ("history.tpl.html", "history.", "history.html"),
]
# 언어마다 제 주소에 굽는 페이지.
PAGED = {"index.html"}

# 틀이 쓰지 않아도 되는 키 — 자바스크립트가 직접 부른다.
SCRIPT_ONLY = {"dial.warmer", "dial.cooler",
               "film.cap.2", "film.cap.3", "film.cap.4", "film.cap.5", "film.cap.6", "film.play",
               "suggest.say", "suggest.go", "suggest.close",
               "desk.night", "desk.day", "desk.yours",
               "trace.aria", "trace.hint", "trace.left", "trace.done", "trace.count",
               "jar.placeholder", "jar.empty", "jar.count", "jar.when", "jar.aria", "jar.clearAsk",
               "fx.now"}
# 머무는 자리들(js/play.js)이 이름으로 부르는 키 묶음 — 방문 인사, 서른 줄의 오늘의 문장,
# 책상의 일곱 물건. 그리고 효과 실험실(js/decor.js)의 효과 이름 마흔아홉과 갈래 넷 — 앱의
# sticker_effects.dart 와 같은 이름이고, 번역은 앱의 표(assets/i18n)에서 옮겼다.
SCRIPT_PREFIXES = ("visit.", "trace.line.", "desk.o.", "fx.e.", "fx.g.")

# JSON-LD 의 featureList — 기록 꾸미기부터, 그다음 말온도가 처음부터 해 온 일.
FEATURES = ("daily.title", "decor.title", "widget.title", "auto.title", "drawer.title", "fx.title", "paper.title", "month.title", "f.talk.h", "f.letter.h",
            "f.measure.h", "f.mark.h", "f.letgo.h", "f.people.h", "desk.title")

FILL = re.compile(r'(<([a-zA-Z0-9]+)\b[^>]*\bdata-i="([^"]+)"[^>]*>)(</\2>)')
ATTR = re.compile(r'data-i-(alt|aria-label|aria-roledescription|content)="([^"]+)"')

# 이번에 쓴 파일과, 그것이 전과 달라졌는지 — sitemap 의 lastmod 가 본다.
WRITTEN: dict[str, bool] = {}


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


def text(s: str) -> str:
    """JSON-LD 에 넣을 맨 글 — 줄바꿈은 빈칸으로, 태그는 걷고, 온도는 편다."""
    return html.unescape(re.sub(r"<[^>]+>", "", expand(s.replace("<br>", " "))))


def out_path(out_name: str, lang: str) -> str:
    """구운 파일이 설 자리(저장소 뿌리에서). 한국어는 뿌리, 나머지는 언어 폴더."""
    return out_name if out_name not in PAGED or lang == "ko" else f"{lang}/{out_name}"


def url_of(out_name: str, lang: str) -> str:
    """그 파일의 주소. index.html 은 폴더 주소로 부른다."""
    path = out_path(out_name, lang)
    return f"{SITE}/{path[: -len('index.html')] if path.endswith('index.html') else path}"


def hreflang(out_name: str) -> str:
    rows = [f'<link rel="alternate" hreflang="{lang}" href="{url_of(out_name, lang)}">' for lang in LANGS]
    rows.append(f'<link rel="alternate" hreflang="x-default" href="{url_of(out_name, X_DEFAULT)}">')
    return "\n".join(rows)


def json_ld(lang: str, t: dict, url: str) -> str:
    """검색 엔진이 읽는 이 페이지의 뜻 — 사이트 이름, 앱, 자주 묻는 것. 모두 이 페이지의 언어로."""
    faq = sorted(int(m[1]) for k in t if (m := re.fullmatch(r"faq\.(\d+)\.q", k)))
    graph = [
        {
            "@type": "WebSite",
            "@id": f"{SITE}/#website",
            "url": f"{SITE}/",
            "name": "말온도",
            "alternateName": "Malondo",
            "inLanguage": LANGS,
        },
        {
            "@type": "MobileApplication",
            "@id": f"{SITE}/#app",
            "name": t["brand"],
            "alternateName": "Malondo" if lang == "ko" else "말온도",
            "description": text(t["meta.desc"]),
            "url": url,
            "applicationCategory": "LifestyleApplication",
            "operatingSystem": "iOS 15.0 or later, Android 7.0 or later",
            "inLanguage": LANGS,
            "installUrl": [APP_STORE, PLAY],
            "image": f"{SITE}/icon-1024.png",
            "screenshot": [f"{SITE}/shots/{lang}/{n}.webp" for n in ("home", "day-full", "widget-large", "month-page", "drawer-deco", "effects", "phrases")],
            "featureList": [text(t[k]) for k in FEATURES],
            "keywords": text(t["meta.keywords"]),
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": CURRENCY[lang]},
        },
        {
            "@type": "FAQPage",
            "@id": f"{url}#faq",
            "url": url,
            "inLanguage": lang,
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": text(t[f"faq.{i}.q"]),
                    "acceptedAnswer": {"@type": "Answer", "text": text(t[f"faq.{i}.a"])},
                }
                for i in faq
            ],
        },
    ]
    doc = {"@context": "https://schema.org", "@graph": graph}
    return json.dumps(doc, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def write(rel: str, content: str) -> None:
    """달라졌을 때만 쓴다 — 쓴 적과 달라진 적을 WRITTEN 에 남긴다."""
    path = OUT / rel
    old = path.read_text(encoding="utf-8") if path.exists() else None
    WRITTEN[rel] = old != content
    if old != content:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")


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
    unused = {k for k in keys - used - SCRIPT_ONLY if not k.startswith(SCRIPT_PREFIXES)}
    if unknown:
        ok = False
        print(f"  {out_name}: 틀에는 있는데 표에 없는 키 {sorted(unknown)}")
    if unused:
        print(f"  (참고) {out_name}: 표에는 있는데 틀이 쓰지 않는 키 {sorted(unused)}")
    if not ok:
        return False

    payload = json.dumps(tables, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

    for lang in LANGS if out_name in PAGED else ["ko"]:
        t = tables[lang]

        def fill(m: re.Match) -> str:
            open_tag, tag, key = m[1], m[2], m[3]
            s = expand(t[key])
            if tag in ("title", "text"):
                s = re.sub(r"<[^>]+>", "", s)
            return f"{open_tag}{s}</{tag}>"

        def attr(m: re.Match) -> str:
            name, key = m[1], m[2]
            return f'{name}="{plain(t[key])}" data-i-{name}="{key}"'

        out = ATTR.sub(attr, FILL.sub(fill, tpl))

        url = url_of(out_name, lang)
        slots = {
            "LANG": lang,
            "URL": url,
            "HREFLANG": hreflang(out_name),
            "OG_LOCALE": OG_LOCALE[lang],
            "OG_LOCALE_ALT": "\n".join(
                f'<meta property="og:locale:alternate" content="{OG_LOCALE[other]}">'
                for other in LANGS if other != lang),
            "I18N_JSON": payload,
            "I18N_JS": i18n_js,
            "PAGE_CSS": page_css,
        }
        if "{{JSON_LD}}" in out:
            slots["JSON_LD"] = json_ld(lang, t, url)
        for slot, value in slots.items():
            out = out.replace("{{" + slot + "}}", value)

        rel = out_path(out_name, lang)
        left = re.findall(r"\{\{[A-Z_]+\}\}", out)
        if left:
            print(f"  {rel}: 채우지 못한 자리 {sorted(set(left))}")
            return False

        write(rel, out)
        mark = "" if WRITTEN[rel] else " (그대로)"
        print(f"  {rel} {len(out.encode('utf-8')):,} bytes · 키 {len(keys)}개 × {len(LANGS)}개 언어{mark}")
    return True


def sitemap(today: str) -> None:
    """모든 주소와 언어 짝. 파일이 그대로면 lastmod 도 그대로 둔다."""
    path = OUT / "sitemap.xml"
    before = dict(re.findall(r"<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>",
                             path.read_text(encoding="utf-8"))) if path.exists() else {}
    rows = []
    for _, _, out_name in PAGES:
        for lang in LANGS if out_name in PAGED else ["ko"]:
            loc = url_of(out_name, lang)
            changed = WRITTEN.get(out_path(out_name, lang), True)
            rows.append("  <url>")
            rows.append(f"    <loc>{loc}</loc>")
            rows.append(f"    <lastmod>{today if changed or loc not in before else before[loc]}</lastmod>")
            if out_name in PAGED:
                for other in LANGS:
                    rows.append(f'    <xhtml:link rel="alternate" hreflang="{other}" href="{url_of(out_name, other)}"/>')
                rows.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{url_of(out_name, X_DEFAULT)}"/>')
            rows.append("  </url>")
    xml = "\n".join([
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        *rows,
        "</urlset>",
        "",
    ])
    write("sitemap.xml", xml)
    print(f"  sitemap.xml 주소 {sum(r.strip().startswith('<loc>') for r in rows)}개"
          + ("" if WRITTEN["sitemap.xml"] else " (그대로)"))


def main() -> int:
    i18n_js = (ROOT / "i18n.js").read_text(encoding="utf-8").rstrip()
    page_css = (ROOT / "page.css").read_text(encoding="utf-8").rstrip()
    ok = True
    for tpl, prefix, out_name in PAGES:
        if not build(tpl, prefix, out_name, i18n_js, page_css):
            ok = False
    if ok:
        sitemap(datetime.date.today().isoformat())
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
