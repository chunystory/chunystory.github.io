#!/usr/bin/env python3
"""첫 페이지의 og:image 네 장(og/{ko,en,ja,es}.jpg, 1200×630)을 짓는다.

    python3 src/og.py

- 링크를 카카오톡 · 네이버 · X 에 붙였을 때 뜨는 큰 그림이다. 첫 화면(영웅 구획)을
  한 장으로 옮긴다 — 맨 위 이름, 눈썹 글, 제목(온도에 무지개), 아래 사실 한 줄, 오른쪽
  폰에는 그 언어의 홈 화면(shots/{lang}/home.webp — 17 Pro Max 1320×2868).
- 글은 네 표의 brand · hero.eyebrow · hero.title · fact.* 에서 온다. 그 문구를 고치면
  다시 돌린다.
- 헤드리스 크롬으로 찍고 sips(macOS)로 JPEG 로 줄인다. 글꼴은 사이트와 같은 Pretendard
  CDN 이라 네트워크가 있어야 한다(없으면 시스템 고딕으로 선다).
"""
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent
LANGS = ["ko", "en", "ja", "es"]
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# 제목 글자 크기 — 스페인어 첫 줄이 가장 길다.
TITLE_PX = {"ko": 66, "en": 68, "ja": 62, "es": 56}

PAGE = """<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-jp-dynamic-subset.min.css">
<style>
  html, body {{ margin: 0; width: 1200px; height: 630px; overflow: hidden; }}
  body {{ position: relative; background: #F5F1EA; color: #211E1B; -webkit-font-smoothing: antialiased;
    font-family: "Pretendard Variable", Pretendard, "Pretendard JP Variable", "Pretendard JP", "Apple SD Gothic Neo", "Hiragino Sans", sans-serif; }}
  .blobs {{ position: absolute; inset: -20%; filter: blur(70px); }}
  .blob {{ position: absolute; border-radius: 50%; }}
  .a {{ width: 640px; height: 400px; left: 80px; top: 520px; background: rgba(156,208,198,.55); }}
  .b {{ width: 560px; height: 360px; left: 760px; top: 60px; background: rgba(234,205,150,.55); }}
  .c {{ width: 620px; height: 380px; left: 900px; top: 560px; background: rgba(242,181,161,.6); }}
  .copy {{ position: absolute; left: 76px; top: 62px; bottom: 58px; width: 690px; display: flex; flex-direction: column; }}
  .brand {{ display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 700; letter-spacing: -.02em; }}
  .brand img {{ width: 54px; height: 54px; border-radius: 13px; }}
  .mid {{ margin: auto 0; }}
  .eyebrow {{ margin: 0 0 18px; max-width: 620px; font-size: 24px; font-weight: 600; line-height: 1.35; color: #BE2D1A; letter-spacing: .01em; text-wrap: balance; }}
  h1 {{ margin: 0; font-size: {title_px}px; line-height: 1.17; font-weight: 700; letter-spacing: -.03em; word-break: keep-all; }}
  :root[lang="en"] h1, :root[lang="es"] h1 {{ letter-spacing: -.02em; }}
  .grad {{ background: linear-gradient(90deg, #2F7A6E, #B5832C 55%, #D3664F); -webkit-background-clip: text; background-clip: text; color: transparent; }}
  .facts {{ font-size: 22px; color: #6C655D; }}
  .phone {{ position: absolute; right: 92px; top: 66px; width: 286px; aspect-ratio: 1320 / 2868; border-radius: 14% / 6.4%; background: #0A0908;
    box-shadow: 0 0 0 3px #0A0908, 0 0 0 11px #3A3532, 0 0 0 12px #6B645F, 0 40px 70px -24px rgba(58,34,24,.5); }}
  .phone img {{ display: block; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }}
  .phone::after {{ content: ""; position: absolute; left: 50%; top: 1.3%; width: 29.6%; height: 4.2%; margin-left: -14.8%; border-radius: 999px; background: #070606; }}
</style>
</head>
<body>
  <div class="blobs"><i class="blob a"></i><i class="blob b"></i><i class="blob c"></i></div>
  <div class="copy">
    <div class="brand"><img src="{icon}" alt="">{brand}</div>
    <div class="mid">
      <p class="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
    </div>
    <div class="facts">{facts}</div>
  </div>
  <div class="phone"><img src="{shot}" alt=""></div>
</body>
</html>
"""


def shoot(page: Path, png: Path, profile: Path) -> None:
    """한 장을 찍는다. 크롬은 그림을 쓰고도 가끔 스스로 닫히지 않아, 파일이 서면 닫는다.
    --virtual-time-budget 은 쓰지 않는다 — 글꼴을 받는 동안 멈춰 끝나지 않았다."""
    chrome = subprocess.Popen([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
        "--force-color-profile=srgb", "--allow-file-access-from-files", f"--user-data-dir={profile}",
        "--window-size=1200,630", f"--screenshot={png}", page.as_uri(),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        last = -1
        for _ in range(120):  # 30초
            if chrome.poll() is not None or (png.exists() and png.stat().st_size == last > 0):
                break
            last = png.stat().st_size if png.exists() else -1
            time.sleep(.25)
    finally:
        chrome.terminate()
        chrome.wait(timeout=10)
    if not png.exists() or png.stat().st_size == 0:
        sys.exit(f"{page.name}: 크롬이 그림을 쓰지 못했다")


def main() -> int:
    (OUT / "og").mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        for lang in LANGS:
            t = json.loads((ROOT / f"{lang}.json").read_text(encoding="utf-8"))
            page = tmp / f"{lang}.html"
            page.write_text(PAGE.format(
                lang=lang,
                title_px=TITLE_PX[lang],
                icon=(OUT / "icon-192.png").as_uri(),
                shot=(OUT / "shots" / lang / "home.webp").as_uri(),
                brand=t["brand"],
                eyebrow=t["hero.eyebrow"],
                title=t["hero.title"],
                facts=" · ".join(t[f"fact.{i}"] for i in (1, 3, 4, 5)),
            ), encoding="utf-8")
            png = tmp / f"{lang}.png"
            shoot(page, png, tmp / "profile")
            jpg = OUT / "og" / f"{lang}.jpg"
            subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "86", str(png), "--out", str(jpg)],
                           check=True, capture_output=True)
            print(f"  og/{lang}.jpg {jpg.stat().st_size:,} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
