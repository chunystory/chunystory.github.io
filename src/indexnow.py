#!/usr/bin/env python3
"""sitemap.xml 의 주소를 IndexNow 로 검색 엔진에 알린다 — 네이버 · Bing · Yandex 들이 받는다.

    python3 src/indexnow.py            # sitemap 의 주소 전부
    python3 src/indexnow.py --changed  # 오늘 lastmod 가 바뀐 주소만

- 푸시하고 GitHub Pages 가 새 판을 세운 **뒤에** 돌린다. 검색 엔진은 알림을 받자마자
  주소를 읽으러 오므로, 옛 판이 서 있으면 옛 글을 가져간다.
- 열쇠는 저장소 뿌리의 `<열쇠>.txt` 한 장이다(글이 곧 열쇠). 검색 엔진이 그 파일을
  읽어 이 사이트의 주인이 보낸 알림인지 확인하므로, 그 파일을 지우거나 옮기지 않는다.
- IndexNow 는 한 곳에 알리면 참여하는 엔진끼리 나눈다. 그래도 네이버에는 따로 한 번 더
  보낸다 — 한국어 검색이 이 사이트의 본진이다.
- 구글은 IndexNow 를 받지 않는다. 구글은 Search Console 의 sitemap 제출로 간다.
"""
import datetime
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent
HOST = "chunystory.github.io"
ENDPOINTS = [
    "https://api.indexnow.org/indexnow",
    "https://searchadvisor.naver.com/indexnow",
]


def key() -> str:
    found = [p.stem for p in OUT.glob("*.txt") if re.fullmatch(r"[0-9a-f]{32}", p.stem)
             and p.read_text(encoding="utf-8").strip() == p.stem]
    if len(found) != 1:
        sys.exit(f"열쇠 파일을 하나로 찾지 못했다: {found}")
    return found[0]


def urls(changed_only: bool) -> list[str]:
    xml = (OUT / "sitemap.xml").read_text(encoding="utf-8")
    pairs = re.findall(r"<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>", xml)
    today = datetime.date.today().isoformat()
    return [loc for loc, mod in pairs if not changed_only or mod == today]


def main() -> int:
    k = key()
    todo = urls("--changed" in sys.argv)
    if not todo:
        print("알릴 주소가 없다.")
        return 0
    body = json.dumps({
        "host": HOST,
        "key": k,
        "keyLocation": f"https://{HOST}/{k}.txt",
        "urlList": todo,
    }).encode("utf-8")
    ok = True
    for endpoint in ENDPOINTS:
        req = urllib.request.Request(endpoint, data=body, method="POST",
                                     headers={"Content-Type": "application/json; charset=utf-8"})
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                print(f"  {endpoint} → {res.status} · 주소 {len(todo)}개")
        except urllib.error.HTTPError as e:
            ok = False
            print(f"  {endpoint} → {e.code} {e.reason} {e.read()[:200]!r}")
        except urllib.error.URLError as e:
            ok = False
            print(f"  {endpoint} → 닿지 않음 {e.reason}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
