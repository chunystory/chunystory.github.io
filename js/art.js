/*
 * 말온도 선 그림 — 앱의 CustomPainter 둘을 Canvas 2D 로 그대로 옮긴 것.
 *
 *   drawMeadow ← lib/widgets/fork_meadow.dart  _MeadowPainter (갈림길 문 다섯의 작은 들판)
 *   drawDesk   ← lib/widgets/window_desk.dart  _DeskPainter   (창가 책상의 일곱 물건)
 *                + lib/widgets/light_art.dart  paintLampPool · lampGold · LightInk (촛불의 볕)
 *
 * 색은 lib/theme/malondo_palette.dart · malondo_colors.dart, 곡선은
 * lib/theme/malondo_metrics.dart 의 Motion.* 에서 왔다. 좌표 · 선 굵기 · 알파 ·
 * 박자 · 그리는 순서를 앱과 같게 두었다 — 앱의 그림을 고치면 여기도 고친다.
 *
 * 쓰는 법
 *
 *   MalondoArt.drawMeadow(ctx, scene, u, theme, w, h)
 *     scene  'phrases' | 'letter' | 'dayMark' | 'lettingGo' | 'desk'
 *     u      들어선 뒤의 초(0 → meadowSeconds 1.5 에 한 번 논다). 99 는 끝 장면
 *            (앱의 still). 1.5 이상이면 모두 끝 장면이다.
 *     w × h  그림 좌표 72 × 44 를 h/44 배로 왼쪽 위부터 그린다(앱과 같이).
 *            w 는 h × 72/44 로 준다.
 *
 *   MalondoArt.drawDesk(ctx, opts, theme, w, h)
 *     opts.traces  {pages 0–5, scribbles, sealed, pressed, stars 0–11}
 *     opts.lit     촛불이 켜졌는지(앱에서는 밤)
 *     opts.flame   불꽃 한 바퀴(deskFlameSeconds 3초)의 자리 0…1 = (초 / 3) % 1
 *     opts.lift    {object: 'jar', v: 0…1} 누른 물건이 들렸다 앉는 중 —
 *                  v 는 누른 뒤 지난 시간 / deskLiftMs(420ms), 곧게 간다.
 *                  앱은 누른 뒤 deskOpenDelayMs(220ms)에 자리를 연다.
 *     w × h        판 353 × 106 을 w/353 배로 그린다. h 는 w × 106/353.
 *
 *   theme 은 'light' | 'dark'. 두 함수 모두 바탕을 칠하지 않는다(앱의 화가도
 *   칠하지 않는다) — 부르는 쪽이 지우고 devicePixelRatio 를 맞춘다.
 */
(function (root) {
  'use strict';

  var PI = Math.PI;

  // ── 수 ────────────────────────────────────────────────────────────────

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function clamp01(x) { return clamp(x, 0, 1); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /** 구간 [a, b] 안의 자리(0…1) — _seg. */
  function seg(u, a, b) { return clamp((u - a) / (b - a), 0, 1); }

  /**
   * Flutter 의 Cubic(a, b, c, d) — CSS cubic-bezier 와 같은 곡선을 Flutter 와
   * 같은 이분법(오차 0.001)으로 푼다. 그래서 값이 앱과 같다.
   */
  function cubic(a, b, c, d) {
    function at(p, q, m) {
      return 3 * p * (1 - m) * (1 - m) * m + 3 * q * (1 - m) * m * m + m * m * m;
    }
    return function (t) {
      if (!(t > 0)) return 0;
      if (t >= 1) return 1;
      var start = 0, end = 1;
      for (;;) {
        var mid = (start + end) / 2, x = at(a, c, mid);
        if (Math.abs(t - x) < 0.001) return at(b, d, mid);
        if (x < t) start = mid; else end = mid;
      }
    };
  }

  var standard = cubic(0.215, 0.61, 0.355, 1.0);    // Motion.standard   = Curves.easeOutCubic
  var emphasized = cubic(0.645, 0.045, 0.355, 1.0); // Motion.emphasized = Curves.easeInOutCubic
  var breathing = cubic(0.445, 0.05, 0.55, 0.95);   // Motion.breathing  = Curves.easeInOutSine
  var settle = cubic(0.16, 1.0, 0.30, 1.0);         // Motion.settle
  var easeOut = cubic(0.0, 0.0, 0.58, 1.0);         // Curves.easeOut — 책상 물건이 들린다

  // ── 색 ────────────────────────────────────────────────────────────────
  // Flutter 의 Color 처럼 [r, g, b, a](0…1 실수)로 다룬다.

  function hex(s) {
    s = s.replace('#', '');
    var a = 1;
    if (s.length === 8) { a = parseInt(s.slice(0, 2), 16) / 255; s = s.slice(2); }
    return [
      parseInt(s.slice(0, 2), 16) / 255,
      parseInt(s.slice(2, 4), 16) / 255,
      parseInt(s.slice(4, 6), 16) / 255,
      a
    ];
  }

  /** Color.lerp — 채널마다 실수로 섞는다. */
  function mix(x, y, t) {
    var out = [];
    for (var i = 0; i < 4; i++) out.push(clamp01(x[i] * (1 - t) + y[i] * t));
    return out;
  }

  /** color.withValues(alpha: a) — 알파를 바꾼다. */
  function withAlpha(c, a) { return [c[0], c[1], c[2], clamp01(a)]; }

  /** _stroke · _fill 의 알파 — 원래 알파에 곱한다. */
  function fade(c, a) {
    return a === undefined ? c : [c[0], c[1], c[2], c[3] * clamp01(a)];
  }

  function css(c) {
    return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' +
      Math.round(c[2] * 255) + ',' + Math.round(c[3] * 10000) / 10000 + ')';
  }

  /** 내보내는 팔레트용 — 불투명하면 #RRGGBB. */
  function cssOut(c) {
    if (c[3] < 1) return css(c);
    var s = '#';
    for (var i = 0; i < 3; i++) s += ('0' + Math.round(c[i] * 255).toString(16)).slice(-2);
    return s.toUpperCase();
  }

  var WHITE = [1, 1, 1, 1]; // Colors.white

  var TONES = ['firm', 'calm', 'plain', 'lively', 'empathy', 'warm'];

  // MalondoPalette 의 원시 값 — 그림이 쓰는 것만. tones 는 [core, ink, tint],
  // 차가운 쪽(firm)에서 뜨거운 쪽(warm)으로.
  var RAW = {
    light: {
      frame: '#ECE6DC', canvas: '#F5F1EA', surface: '#FDFCFA', surfaceElevated: '#FFFFFF',
      sunken: '#F0EBE2', textPrimary: '#211E1B', textSecondary: '#56504A',
      textTertiary: '#6C655D', accent: '#BE2D1A', onAccent: '#FFF6F3', accentSoft: '#F9EAE8',
      meadowMid: '#578A80', meadowBlade: '#7BA69C', meadowTip: '#9EC2B9',
      tones: [
        ['#2B4669', '#2B4669', '#E8EEF6'],
        ['#325D57', '#325D57', '#E3F0EE'],
        ['#6D6359', '#6D6359', '#EEEDEB'],
        ['#976A23', '#895B13', '#F6ECDD'],
        ['#C76138', '#AA451E', '#F8EBE5'],
        ['#D76656', '#BE2D1A', '#F9EAE8']
      ]
    },
    dark: {
      frame: '#0E0B09', canvas: '#16120F', surface: '#211D19', surfaceElevated: '#2B2622',
      sunken: '#100D0B', textPrimary: '#F0EAE3', textSecondary: '#B8AFA5',
      textTertiary: '#9E958A', accent: '#E8ACA4', onAccent: '#16120F', accentSoft: '#40221E',
      meadowMid: '#2E443E', meadowBlade: '#3E5A53', meadowTip: '#4F7169',
      tones: [
        ['#7496C3', '#7496C3', '#222B37'],
        ['#50AA9E', '#50AA9E', '#1D2D2B'],
        ['#AEA396', '#AEA396', '#2D2A26'],
        ['#CDA669', '#CDA669', '#32291B'],
        ['#DFA690', '#DFA690', '#3A251D'],
        ['#E8ACA4', '#E8ACA4', '#40221E']
      ]
    }
  };

  /** 한 테마의 잉크 — _MeadowInk · LineInk · LightInk(c, .4) 를 한 벌로. */
  function inks(raw, dark) {
    var c = {};
    for (var key in raw) if (key !== 'tones') c[key] = hex(raw[key]);
    var s = raw.tones.map(function (t) {
      return { core: hex(t[0]), ink: hex(t[1]), tint: hex(t[2]) };
    });
    // LightInk(colors, warm) — 촛불은 warm .4 로 부른다.
    var warm = 0.4;
    var gold = mix(s[3].core, s[4].core, warm * 0.7);
    var lamp = dark ? {
      core: mix(c.canvas, mix(c.textPrimary, s[3].core, 0.4), 0.34), coreA: 0.92,
      halo: mix(c.canvas, mix(s[3].core, s[4].core, warm), 0.26), haloA: 0.95,
      gold: gold, goldA: 0.1,
      dim: c.frame, dimA: 0.16
    } : {
      core: c.surfaceElevated, coreA: 0.95,
      halo: mix(c.surfaceElevated, mix(s[3].tint, s[5].tint, warm), 0.8), haloA: 0.95,
      gold: gold, goldA: 0.11,
      dim: c.textPrimary, dimA: 0.05
    };
    return {
      dark: dark,
      c: c,
      stops: s,
      lamp: lamp,
      line: c.textSecondary,
      surface: c.surface,
      accent: c.accent,
      accentSoft: c.accentSoft,
      stem: dark ? c.meadowTip : c.meadowMid,
      leaf: mix(c.surface, dark ? c.meadowBlade : c.meadowTip, dark ? 0.55 : 0.4),
      petal: s[3].tint,
      petalLine: s[3].core,
      // 병 속 종이별의 종이 여섯
      papers: s.map(function (t) { return dark ? mix(t.tint, t.core, 0.38) : t.tint; })
    };
  }

  var INK = { light: inks(RAW.light, false), dark: inks(RAW.dark, true) };

  function inkOf(theme) { return theme === 'dark' ? INK.dark : INK.light; }

  function exportPalette(k) {
    var out = {};
    for (var key in k.c) out[key] = cssOut(k.c[key]);
    out.tones = {};
    TONES.forEach(function (name, i) {
      var t = k.stops[i];
      out.tones[name] = { core: cssOut(t.core), ink: cssOut(t.ink), tint: cssOut(t.tint) };
    });
    // 그림이 실제로 쓰는 잉크(섞어 만든 색 포함).
    out.ink = {
      line: cssOut(k.line),
      surface: cssOut(k.surface),
      accent: cssOut(k.accent),
      accentSoft: cssOut(k.accentSoft),
      stem: cssOut(k.stem),
      leaf: cssOut(k.leaf),
      petal: cssOut(k.petal),
      petalLine: cssOut(k.petalLine),
      lampGold: cssOut(k.lamp.gold),
      papers: k.papers.map(cssOut)
    };
    return out;
  }

  // ── 붓 ────────────────────────────────────────────────────────────────
  // Paint 한 벌 = {c: 색, w: 굵기(없으면 칠하기), cap, join}.

  /** fork_meadow 의 _fill. */
  function fillP(color, alpha) { return { c: fade(color, alpha) }; }

  /** fork_meadow 의 _stroke — 끝과 꺾임이 둥글다. */
  function strokeP(color, width, alpha) {
    return { c: fade(color, alpha), w: width, cap: 'round', join: 'round' };
  }

  /** Paint()..style = stroke — 적지 않으면 Flutter 기본값(butt · miter). */
  function pen(color, width, cap, join) {
    return { c: color, w: width, cap: cap || 'butt', join: join || 'miter' };
  }

  function draw(ctx, path, p) {
    if (p.c[3] <= 0) return; // 보이지 않는 칠
    if (p.w === undefined) {
      ctx.fillStyle = css(p.c);
      ctx.fill(path);
      return;
    }
    ctx.strokeStyle = css(p.c);
    ctx.lineWidth = p.w;
    ctx.lineCap = p.cap;
    ctx.lineJoin = p.join;
    ctx.miterLimit = 4; // Skia 기본값(캔버스 기본은 10)
    ctx.stroke(path);
  }

  function seg2(x1, y1, x2, y2) {
    var p = new Path2D();
    p.moveTo(x1, y1);
    p.lineTo(x2, y2);
    return p;
  }

  function circle(x, y, r) {
    var p = new Path2D();
    p.arc(x, y, r, 0, 2 * PI);
    return p;
  }

  /** drawOval(Rect.fromCenter(center, width, height)). */
  function oval(cx, cy, w, h) {
    var p = new Path2D();
    p.ellipse(cx, cy, w / 2, h / 2, 0, 0, 2 * PI);
    return p;
  }

  /** RRect.fromRectAndRadius(Rect.fromLTWH(x, y, w, h), Radius.circular(r)). */
  function rrect(x, y, w, h, r) {
    var p = new Path2D();
    p.moveTo(x + r, y);
    p.lineTo(x + w - r, y);
    p.arc(x + w - r, y + r, r, -PI / 2, 0);
    p.lineTo(x + w, y + h - r);
    p.arc(x + w - r, y + h - r, r, 0, PI / 2);
    p.lineTo(x + r, y + h);
    p.arc(x + r, y + h - r, r, PI / 2, PI);
    p.lineTo(x, y + r);
    p.arc(x + r, y + r, r, PI, PI * 1.5);
    p.closePath();
    return p;
  }

  function poly(pts, close) {
    var p = new Path2D();
    p.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    if (close) p.closePath();
    return p;
  }

  // ── 갈림길의 들판(_MeadowPainter) ────────────────────────────────────

  var GROUND = 40; // 땅의 높이. 식물 넷이 같은 땅에 선다.

  /** 잎 하나 — 밑동에서 ang 도 방향으로 l 만큼, 폭 w(_leaf). */
  function leaf(bx, by, ang, l, w) {
    var r = ang * PI / 180, dx = Math.cos(r), dy = Math.sin(r);
    function at(a, b) { return [bx + dx * a - dy * b, by + dy * a + dx * b]; }
    var c1 = at(l * 0.3, w), c2 = at(l * 0.75, w * 0.75), tip = at(l, 0);
    var c3 = at(l * 0.75, -w * 0.75), c4 = at(l * 0.3, -w);
    var p = new Path2D();
    p.moveTo(bx, by);
    p.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], tip[0], tip[1]);
    p.bezierCurveTo(c3[0], c3[1], c4[0], c4[1], bx, by);
    p.closePath();
    return p;
  }

  /** 건넬 말 — 두 꽃이 서로에게 기운다. 기울어 간 쪽이 따뜻하게 물든다. */
  function lean(ctx, k, u) {
    var tilt = 11 * emphasized(seg(u, 0.1, 0.85));
    var warm = breathing(seg(u, 0.65, 1.15));
    flower(ctx, k, 26, tilt, -1, 0);
    flower(ctx, k, 46, -tilt, 1, warm);
  }

  function flower(ctx, k, x, tilt, leafSide, warm) {
    var reach = 23;
    var r = tilt * PI / 180;
    var hx = x + Math.sin(r) * reach, hy = GROUND - Math.cos(r) * reach;
    var stem = new Path2D();
    stem.moveTo(x, GROUND);
    stem.quadraticCurveTo(x + Math.sin(r) * reach * 0.3, GROUND - reach * 0.55, hx, hy);
    draw(ctx, stem, strokeP(k.stem, 1.4));
    // 잎은 줄기의 바깥쪽에 — 두 꽃이 서로를 향할 때 잎은 등 뒤에 선다.
    var lf = leaf(
      x + Math.sin(r) * 8,
      GROUND - Math.cos(r) * 8,
      (leafSide < 0 ? -150 : -30) + tilt * 0.5,
      7,
      3
    );
    draw(ctx, lf, fillP(k.leaf));
    draw(ctx, lf, strokeP(k.stem, 1.1));
    var head = circle(hx, hy, 4.6);
    draw(ctx, head, fillP(k.surface));
    draw(ctx, head, strokeP(k.line, 1.3));
    if (warm > 0) {
      draw(ctx, head, fillP(k.accentSoft, warm));
      draw(ctx, head, strokeP(k.accent, 1.3, warm));
    }
    var eye = circle(hx, hy, 1.5);
    draw(ctx, eye, fillP(k.line, 1 - warm));
    draw(ctx, eye, fillP(k.accent, warm));
  }

  /** 마음부터 — 봉오리가 풀린다. 꽃잎 다섯이 천천히 벌어진다. */
  function bloom(ctx, k, u) {
    var open = emphasized(seg(u, 0.1, 1.0));
    var heart = breathing(seg(u, 0.7, 1.1));
    var stem = new Path2D();
    stem.moveTo(36, GROUND);
    stem.quadraticCurveTo(35, 30, 36, 21);
    draw(ctx, stem, strokeP(k.stem, 1.4));
    var lf = leaf(35.6, 33, -35, 8, 3.2);
    draw(ctx, lf, fillP(k.leaf));
    draw(ctx, lf, strokeP(k.stem, 1.1));
    var cx = 36, cy = 15.5;
    // 가운데 잎이 맨 위에 오게 — 바깥 잎부터 그린다.
    [0, 4, 1, 3, 2].forEach(function (j) {
      var th = (-90 + (j - 2) * 32 * open) * PI / 180;
      var d = lerp(2, 5.2, open);
      var petal = oval(0, 0, 2 * lerp(2.3, 2.9, open), 2 * lerp(5.3, 5.9, open));
      ctx.save();
      ctx.translate(cx + Math.cos(th) * d, cy + Math.sin(th) * d);
      ctx.rotate(th + PI / 2);
      draw(ctx, petal, fillP(k.petal));
      draw(ctx, petal, strokeP(k.petalLine, 1.1));
      ctx.restore();
    });
    if (heart > 0) draw(ctx, circle(cx, cy + 0.8, 2.1 * heart), fillP(k.accent));
  }

  /** 오늘 한 칸 — 씨앗 하나가 한 칸에 떨어져 앉고 떡잎 둘이 난다. */
  function plant(ctx, k, u) {
    var plot = breathing(seg(u, 0.45, 0.8));
    var bed = rrect(27, 35, 18, 5.5, 1.5);
    draw(ctx, bed, fillP(k.petal, 0.35 + 0.65 * plot));
    draw(ctx, bed, strokeP(k.line, 0.9));
    var fall = seg(u, 0.05, 0.5);
    if (fall < 1) {
      draw(ctx, oval(36, lerp(4, 34, emphasized(fall)), 3.8, 5),
        fillP(k.petalLine, clamp(fall * 4, 0, 1)));
    }
    var grow = standard(seg(u, 0.55, 0.95));
    var open = settle(seg(u, 0.85, 1.3));
    if (grow <= 0) return;
    var top = 35 - 13 * grow;
    draw(ctx, seg2(36, 35, 36, top), strokeP(k.stem, 1.4));
    if (open <= 0) return;
    var left = leaf(36, top + 0.5, -150, 6.2 * open, 2.6 * open);
    var right = leaf(36, top + 0.5, -30, 6.6 * open, 2.8 * open);
    draw(ctx, left, fillP(k.leaf));
    draw(ctx, left, strokeP(k.stem, 1.1));
    draw(ctx, right, fillP(k.accentSoft));
    draw(ctx, right, strokeP(k.accent, 1.1));
  }

  /** 놓아주기 — 민들레 씨가 오른쪽 것부터 하나씩, 다섯만 날아간다. */
  function drift(ctx, k, u) {
    var stem = new Path2D();
    stem.moveTo(30, GROUND);
    stem.quadraticCurveTo(27.5, 28, 31, 17.5);
    draw(ctx, stem, strokeP(k.stem, 1.4));
    var cx = 31, cy = 15, seeds = 11, leaving = 5;
    function angle(j) { return j / seeds * 2 * PI - 0.3; }
    var order = [];
    for (var j = 0; j < seeds; j++) order.push(j);
    order.sort(function (a, b) { return Math.cos(angle(b)) - Math.cos(angle(a)); });
    draw(ctx, circle(cx, cy, 1.7), fillP(k.line));
    for (var rank = 0; rank < seeds; rank++) {
      var a = angle(order[rank]);
      var dx = Math.cos(a), dy = Math.sin(a);
      var t0 = 0.15 + rank * 0.085;
      var p = rank < leaving ? seg(u, t0, t0 + 0.95) : 0;
      if (p >= 1) continue;
      var awayX = 36 * standard(p);
      var awayY = -11 * standard(p) + 2.2 * Math.sin(p * 7);
      var alpha = 1 - p * p;
      var tx = cx + dx * 7.2 + awayX, ty = cy + dy * 7.2 + awayY;
      draw(ctx, seg2(cx + dx * 2 + awayX, cy + dy * 2 + awayY, tx, ty), strokeP(k.line, 0.9, alpha));
      var tip = circle(tx, ty, 1.2);
      draw(ctx, tip, fillP(k.surface, alpha));
      draw(ctx, tip, strokeP(k.line, 0.9, alpha));
    }
  }

  /**
   * 창가 책상 — 펼친 공책에 한 줄이 적히고, 접은 별 하나가 유리병에
   * 떨어져 앉는다. 병에 볕이 한 번 든다.
   */
  function deskScene(ctx, k, u) {
    // 볕 — 별이 앉은 뒤 병 둘레에 한 번 번졌다가 옅게 남는다. 병보다 먼저.
    var lit = breathing(seg(u, 0.95, 1.2));
    var glow = lit * (1 - 0.55 * settle(seg(u, 1.2, 1.5)));
    if (glow > 0) draw(ctx, circle(53, 32, 5 + 7 * glow), fillP(k.accentSoft, 0.6 * glow));
    // 공책 — 등을 가운데 두고 펼친 두 쪽.
    var left = new Path2D();
    left.moveTo(8, 39.6);
    left.lineTo(21.5, 40);
    left.lineTo(21.5, 30.5);
    left.quadraticCurveTo(15, 29.2, 9.2, 30.4);
    left.closePath();
    var right = new Path2D();
    right.moveTo(21.5, 40);
    right.lineTo(35, 39.6);
    right.lineTo(33.8, 30.4);
    right.quadraticCurveTo(28, 29.2, 21.5, 30.5);
    right.closePath();
    draw(ctx, left, fillP(k.surface));
    draw(ctx, right, fillP(k.surface));
    draw(ctx, left, strokeP(k.line, 1.1));
    draw(ctx, right, strokeP(k.line, 1.1));
    // 왼쪽 쪽에는 먼저 적어 둔 두 줄.
    draw(ctx, seg2(11.5, 33.6, 19.5, 33.9), strokeP(k.stem, 1, 0.7));
    draw(ctx, seg2(11.5, 36.4, 17.5, 36.6), strokeP(k.stem, 1, 0.7));
    // 오른쪽 쪽에 펜이 한 줄을 적는다 — 물결 하나가 왼쪽부터 자란다.
    var write = standard(seg(u, 0.1, 0.75));
    if (write > 0) {
      var steps = 14, upto = Math.ceil(steps * write);
      var at = function (t) {
        return [24 + 7.6 * t, 34.6 - 1.3 * Math.sin(t * PI * 2.2)];
      };
      var wave = new Path2D();
      wave.moveTo(24, 34.6);
      for (var i = 1; i <= upto; i++) {
        var q = at(Math.min(i / steps, write));
        wave.lineTo(q[0], q[1]);
      }
      draw(ctx, wave, strokeP(k.accent, 1.2));
      // 펜 — 적는 동안만 선다.
      var penA = 1 - seg(u, 0.75, 0.95);
      if (penA > 0) {
        var tip = at(write);
        draw(ctx, seg2(tip[0], tip[1], tip[0] + 4.6, tip[1] - 7.2), strokeP(k.line, 1.5, penA));
      }
    }
    // 유리병 — 테두리만, 안의 별이 비친다.
    var jar = rrect(46, 24.5, 14, 15.5, 3.4);
    draw(ctx, jar, fillP(k.surface, 0.6));
    // 먼저 들어 있던 별 둘.
    jarStar(ctx, 50, 36.4, 2.6, 0.2, k.petal, k.petalLine, 1);
    jarStar(ctx, 55.6, 36.8, 2.5, -0.4, k.petal, k.petalLine, 1);
    // 새 별 — 위에서 떨어져 두 별 위에 앉는다. 앉은 별이 따뜻하다.
    var fall = emphasized(seg(u, 0.45, 1.0));
    var landed = seg(u, 0.95, 1.05);
    jarStar(
      ctx,
      lerp(60, 52.8, fall),
      lerp(3, 32.2, fall),
      2.7,
      fall * 2.4,
      mix(k.petal, k.accentSoft, landed),
      mix(k.petalLine, k.accent, landed),
      clamp(seg(u, 0.45, 0.55), 0, 1)
    );
    draw(ctx, jar, strokeP(k.line, 1.2));
    // 병의 목과 뚜껑 자리.
    draw(ctx, seg2(47.8, 24.5, 58.2, 24.5), strokeP(k.line, 1.6));
  }

  /** 병 속의 종이별 하나(_jarStar). */
  function jarStar(ctx, cx, cy, r, rot, fill, line, alpha) {
    if (alpha <= 0) return;
    var p = new Path2D();
    for (var i = 0; i < 10; i++) {
      var a = rot - PI / 2 + i * PI / 5;
      var rr = i % 2 === 0 ? r : r * 0.5;
      var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
    }
    p.closePath();
    draw(ctx, p, fillP(fill, alpha));
    draw(ctx, p, strokeP(line, 0.9, alpha));
  }

  var SCENES = {
    phrases: lean,
    letter: bloom,
    dayMark: plant,
    lettingGo: drift,
    desk: deskScene
  };

  function drawMeadow(ctx, scene, u, theme, w, h) {
    var k = inkOf(theme);
    u = +u;
    if (u !== u) u = 0; // NaN
    ctx.save();
    ctx.setLineDash([]);
    // 72 × 44 에서 그리고 한 번에 줄인다.
    ctx.scale(h / 44, h / 44);
    draw(ctx, seg2(4, GROUND + 0.5, 68, GROUND + 0.5), strokeP(k.stem, 1.2, 0.55));
    var paint = SCENES[scene];
    if (paint) paint(ctx, k, u);
    ctx.restore();
  }

  // ── 창가 책상(_DeskPainter) ──────────────────────────────────────────

  var DESK = [
    ['notebook', '따라 쓰기', 34],
    ['sketchbook', '낙서', 88],
    ['envelope', '편지', 124],
    ['herbarium', '말꽃', 171],
    ['jar', '받은 말 병', 219],
    ['musicBox', '오르골', 278],
    ['candle', '촛불', 330]
  ].map(function (o, i, all) {
    // 누르는 칸 — 이웃과의 가운데에서 가른다(DeskObject.span).
    var left = i === 0 ? 0 : (all[i - 1][2] + o[2]) / 2;
    var right = i === all.length - 1 ? 353 : (o[2] + all[i + 1][2]) / 2;
    return { name: o[0], label: o[1], x: o[2], span: [left, right] };
  });

  // Dart VM 의 math.Random(5).nextDouble() 첫 33개 — 병 속 별 열한 개가 하나에
  // 셋씩(가로 흔들림 · 세로 흔들림 · 돌림) 쓴다. 앱이 그릴 때마다 같은 씨로 뽑는다.
  var RANDOM5 = [
    0.1948500886817257, 0.6740855357468379, 0.22795486191199454,
    0.14027256285611311, 0.9013255240109781, 0.0811676330545813,
    0.9671167730844592, 0.908771586530177, 0.49935840289439437,
    0.11455892009548185, 0.26511257647147524, 0.25446007380778213,
    0.4342724196284832, 0.3335906988650903, 0.5375828312580055,
    0.3504721583867916, 0.805892886754213, 0.875970600535897,
    0.36811269451273865, 0.3034514558654112, 0.7438455595666852,
    0.9980657370152406, 0.2976646185577968, 0.6087664796328577,
    0.2112548588465456, 0.42465651271112403, 0.30762345042053285,
    0.20385229806187266, 0.05089076730962494, 0.9965854141877364,
    0.3571622984113134, 0.30116123509512016, 0.528089312523527
  ];

  /** 다섯 모 별 — 바깥 ro, 안 ri(_star). */
  function star(cx, cy, ro, ri, rot) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var a = rot - PI / 2 + i * PI / 5, rr = i % 2 === 1 ? ri : ro;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return poly(pts, true);
  }

  /** 가운데가 짙고 가장자리로 사라지는 원판 — ui.Gradient.radial. (0, 0) 중심. */
  function disc(ctx, r, colors, stops) {
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    for (var i = 0; i < colors.length; i++) g.addColorStop(stops[i], css(colors[i]));
    ctx.fillStyle = g;
    ctx.fill(circle(0, 0, r));
  }

  /** 창가 책상의 볕 — light_art.dart 의 paintLampPool(_dimAround + _pool). */
  function lampPool(ctx, ox, oy, rx, ry, l, i) {
    // _dimAround — 빛 둘레가 둥글게 어둑해진다.
    var drx = rx * 1.9, dry = ry * 1.9, a = 0.8 * clamp01(i);
    if (a > 0 && drx > 0) {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(1, dry / drx);
      disc(ctx, drx, [
        withAlpha(l.dim, l.dimA * a),
        withAlpha(l.dim, l.dimA * a * 0.75),
        withAlpha(l.dim, 0)
      ], [0, 0.5, 1]);
      ctx.restore();
    }
    // _pool — 금빛 번짐, 따뜻한 테, 흰 심.
    if (i <= 0) return;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(1, ry / rx);
    disc(ctx, rx * 1.25, [withAlpha(l.gold, l.goldA * 2 * i), withAlpha(l.gold, 0)], [0, 1]);
    disc(ctx, rx, [
      withAlpha(l.halo, l.haloA * i),
      withAlpha(l.halo, l.haloA * i * 0.35),
      withAlpha(l.halo, 0)
    ], [0, 0.6, 1]);
    disc(ctx, rx * 0.38, [withAlpha(l.core, l.coreA * i * 0.85), withAlpha(l.core, 0)], [0, 1]);
    ctx.restore();
  }

  function drawDesk(ctx, opts, theme, w, h) {
    opts = opts || {};
    var k = inkOf(theme), c = k.c, s = k.stops;
    var tr = opts.traces || {};
    var pages = clamp(Math.floor(+tr.pages || 0), 0, 5);
    var stars = clamp(Math.floor(+tr.stars || 0), 0, 11);
    var lit = !!opts.lit;
    var flame = +opts.flame || 0;
    var lift = opts.lift || null;

    ctx.save();
    ctx.setLineDash([]);
    ctx.scale(w / 353, w / 353);

    var line = pen(k.line, 1.3, 'round', 'round');
    var faint = pen(withAlpha(k.line, 0.4), 0.9, 'round');
    var fill = fillP(k.surface);

    // 책상 선과 다리.
    draw(ctx, seg2(0, 96, 353, 96), pen(k.line, 1.5, 'round'));
    draw(ctx, seg2(18, 96, 18, 104), pen(k.stem, 1.3));
    draw(ctx, seg2(335, 96, 335, 104), pen(k.stem, 1.3));

    // 누른 물건은 살짝 들렸다 앉는다.
    function object(name, paint) {
      var up = lift && lift.object === name
        ? Math.sin(PI * easeOut(clamp01(+lift.v || 0))) * 4
        : 0;
      ctx.save();
      ctx.translate(0, -up);
      paint();
      ctx.restore();
    }

    // 공책 — 펼쳐 세운 책. 쓴 만큼 아래에 장이 겹친다.
    object('notebook', function () {
      var i;
      for (i = pages; i > 0; i--) {
        draw(ctx, poly([[11, 88 + i * 1.6], [34, 94 + i * 1.2], [57, 88 + i * 1.6]]),
          pen(faint.c, 1, 'round'));
      }
      var left = poly([[10, 58], [34, 64], [34, 94], [10, 88]], true);
      var right = poly([[58, 58], [34, 64], [34, 94], [58, 88]], true);
      [left, right].forEach(function (page) {
        draw(ctx, page, fill);
        draw(ctx, page, line);
      });
      for (i = 0; i < 3; i++) {
        draw(ctx, seg2(14, 66 + i * 6, 30, 70 + i * 6), faint);
        draw(ctx, seg2(38, 70 + i * 6, 54, 66 + i * 6), faint);
      }
      draw(ctx, seg2(34, 94, 35.6, 100.5), pen(s[3].core, 1.6, 'round'));
    });

    // 스케치북 — 고리가 달린 세운 공책. 남긴 낙서가 있으면 표지에 한 줄.
    object('sketchbook', function () {
      ctx.save();
      ctx.translate(90, 96);
      ctx.rotate(-4 * PI / 180);
      ctx.translate(-90, -96);
      var cover = rrect(71, 40, 37, 56, 2);
      draw(ctx, cover, fill);
      draw(ctx, cover, line);
      for (var i = 0; i < 6; i++) draw(ctx, circle(75.5 + i * 5.6, 40, 2), pen(k.line, 1.1));
      var doodle = new Path2D();
      doodle.moveTo(78, 72);
      doodle.bezierCurveTo(82, 64, 86, 78, 90, 70);
      doodle.bezierCurveTo(94, 62, 96, 76, 100, 70);
      draw(ctx, doodle, pen(tr.scribbles ? s[5].core : withAlpha(k.line, 0.6), 1.2, 'round'));
      var under = new Path2D();
      under.moveTo(79, 84);
      under.quadraticCurveTo(89, 87, 99, 83);
      draw(ctx, under, faint);
      ctx.restore();
    });

    // 봉투 — 봉한 편지가 있으면 인장이 방의 따뜻한 한 점이다.
    object('envelope', function () {
      ctx.save();
      ctx.translate(122, 96);
      ctx.rotate(9 * PI / 180);
      ctx.translate(-122, -96);
      var env = rrect(104, 66, 38, 28, 2);
      draw(ctx, env, fill);
      draw(ctx, env, line);
      draw(ctx, poly([[104, 67], [123, 81], [142, 67]]), line);
      if (tr.sealed) {
        draw(ctx, circle(123, 81, 4.2), fillP(k.accent));
        var arc = new Path2D();
        arc.arc(123, 81, 2, PI, 2 * PI);
        draw(ctx, arc, pen(withAlpha(c.onAccent, 0.8), 0.9));
      }
      ctx.restore();
    });

    // 표본집 — 두툼한 책. 눌러 둔 꽃이 있으면 표지에 꽃.
    object('herbarium', function () {
      var spine = poly([[184, 44], [190, 41], [190, 93], [184, 96]], true);
      draw(ctx, spine, fillP(c.sunken));
      draw(ctx, spine, line);
      var cover = rrect(154, 44, 30, 52, 1.5);
      draw(ctx, cover, fill);
      draw(ctx, cover, line);
      draw(ctx, rrect(160, 50, 18, 5, 1), faint);
      if (!tr.pressed) return;
      var stalk = new Path2D();
      stalk.moveTo(169, 84);
      stalk.bezierCurveTo(169, 78, 168, 74, 169.4, 68);
      draw(ctx, stalk, pen(k.stem, 1.1, 'round'));
      var lf = new Path2D();
      lf.moveTo(169, 79);
      lf.bezierCurveTo(166, 77.4, 164, 77.8, 162.6, 79.4);
      lf.bezierCurveTo(164.6, 80.8, 167, 80.6, 169, 79);
      draw(ctx, lf, fillP(k.leaf));
      for (var i = 0; i < 5; i++) {
        var a = -PI / 2 + i * 2 * PI / 5;
        ctx.save();
        ctx.translate(169.4 + Math.cos(a) * 3.2, 64.6 + Math.sin(a) * 3.2);
        ctx.rotate(a);
        var petal = oval(0, 0, 4.8, 3.2);
        draw(ctx, petal, fillP(s[4].tint));
        draw(ctx, petal, pen(k.line, 0.9, 'round')); // faint..color = ink.line(불투명)
        ctx.restore();
      }
    });

    // 유리병 — 별이 쌓인 만큼 보인다(세지 않는다).
    object('jar', function () {
      var cork = rrect(209.5, 38, 19, 8, 1.6);
      draw(ctx, cork, fillP(s[3].tint));
      draw(ctx, cork, line);
      var body = new Path2D();
      body.moveTo(208, 46);
      body.lineTo(230, 46);
      body.lineTo(230, 50);
      body.bezierCurveTo(235, 52, 238, 55, 238, 60);
      body.lineTo(238, 88);
      body.arc(230, 88, 8, 0, PI / 2); // arcToPoint((230, 96), r 8, 시계 방향)
      body.lineTo(208, 96);
      body.arc(208, 88, 8, PI / 2, PI); // arcToPoint((200, 88), r 8, 시계 방향)
      body.lineTo(200, 60);
      body.bezierCurveTo(200, 55, 203, 52, 208, 50);
      body.closePath();
      draw(ctx, body, fillP(withAlpha(WHITE, k.dark ? 0.04 : 0.55)));
      for (var i = 0; i < stars; i++) {
        var row = Math.floor(i / 4), col = i % 4;
        var x = 207 + col * 7.4 + (row % 2 === 1 ? 3 : 0) + RANDOM5[i * 3] * 1.4;
        var y = 90 - row * 5.6 - RANDOM5[i * 3 + 1] * 1.2;
        var st = star(x, y, 3.1, 1.75, RANDOM5[i * 3 + 2] * 1.2);
        draw(ctx, st, fillP(k.papers[(i * 2 + 1) % 6]));
        draw(ctx, st, pen(k.line, 0.7, 'butt', 'round'));
      }
      draw(ctx, seg2(204.5, 60, 204.5, 84),
        pen(k.dark ? withAlpha(WHITE, 0.25) : WHITE, 1.6, 'round'));
      draw(ctx, body, line);
    });

    // 오르골 — 뚜껑이 열린 상자와 손잡이.
    object('musicBox', function () {
      var lid = poly([[255, 72], [262, 50], [296, 50], [299, 72]]);
      draw(ctx, lid, fill);
      draw(ctx, lid, line);
      var box = rrect(253, 72, 46, 24, 2);
      draw(ctx, box, fill);
      draw(ctx, box, line);
      draw(ctx, rrect(260, 76, 32, 8, 4), pen(withAlpha(k.line, 0.6), 1));
      for (var i = 0; i < 6; i++) {
        draw(ctx, circle(264 + i * 5, 80 + (i % 2 === 1 ? -1.2 : 1.2), 0.8), fillP(s[i].core));
      }
      draw(ctx, poly([[299, 84], [303, 84], [307, 79]]), line);
      draw(ctx, circle(307.6, 78.4, 1.9), fill);
      draw(ctx, circle(307.6, 78.4, 1.9), pen(k.line, 1.1));
    });

    // 촛불 — 밤에만 켜진다.
    object('candle', function () {
      var f = flame * PI * 2;
      if (lit) {
        var flick = 1 + Math.sin(f * 3) * 0.06 + Math.sin(f * 7) * 0.04;
        lampPool(ctx, 330, 54, 22 * flick, 22 * flick, k.lamp, 0.9);
      }
      var dish = oval(330, 95, 20, 4.4);
      draw(ctx, dish, fill);
      draw(ctx, dish, pen(k.line, 1.2, 'round', 'round'));
      var body = rrect(325.5, 63, 9, 32, 1.6);
      draw(ctx, body, fill);
      draw(ctx, body, line);
      draw(ctx, seg2(330, 63, 330, 59), line);
      if (lit) {
        var sway = Math.sin(f * 5) * 0.6;
        var fl = new Path2D();
        fl.moveTo(330, 59);
        fl.bezierCurveTo(327.3, 57.2, 327.6, 54.2, 330 + sway, 48.5);
        fl.bezierCurveTo(332.4, 54.2, 332.7, 57.2, 330, 59);
        fl.closePath();
        draw(ctx, fl, fillP(k.lamp.gold));
      }
    });

    ctx.restore();
  }

  root.MalondoArt = {
    palette: { light: exportPalette(INK.light), dark: exportPalette(INK.dark) },
    meadowScenes: ['phrases', 'letter', 'dayMark', 'lettingGo', 'desk'],
    meadowSeconds: 1.5,
    meadowAspect: 72 / 44,
    drawMeadow: drawMeadow,
    deskObjects: DESK,
    deskAspect: 353 / 106,
    deskHitTop: 20,        // 누르는 칸은 판의 y 20 아래부터(353 폭 기준)
    deskLiftMs: 420,       // 들렸다 앉는 시간
    deskOpenDelayMs: 220,  // 누른 뒤 자리가 열리기까지
    deskFlameSeconds: 3,   // 불꽃 한 바퀴
    drawDesk: drawDesk
  };
})(typeof window !== 'undefined' ? window : this);
