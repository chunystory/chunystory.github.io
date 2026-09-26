/* 첫 페이지의 머무는 자리들 — 1.0.7 리뉴얼(2026-09-26).
 *
 * 앱의 몸짓을 웹으로 옮긴다. 모두 이 브라우저 안에서만 돈다 — 적은 글과 그은 획은
 * localStorage 에만 남고 어디로도 보내지 않는다.
 *
 * - 방문 인사 · 절기   : 다시 오면 며칠 만인지, 절기(한국어 · 일본어), 밤
 * - 오늘의 문장(머리)  : 앱의 TraceLine.of(오늘)과 같은 날 같은 줄
 * - 움직이는 화면       : 폰 틀 안의 앱 영상 아홉 편, 끝나면 다음 편
 * - 다섯 문             : 앱과 같은 들판 그림(js/art.js)이 들어설 때 한 번 숨 쉰다
 * - 창가 책상           : 물건을 누르면 들렸다 앉고 그 자리가 열린다. 밤에는 촛불
 * - 오늘의 문장         : 손으로 따라 적는다 — 잉크가 마르고 도장이 앉는다
 * - 받은 말 병          : 한 줄을 별로 접어 병에 — 누르면 하나를 꺼내 읽는다
 * - 하루 한 장          : 새벽~밤의 띠 위로 빛이 한 번 지나가며 순간이 켜진다
 *
 * 움직임을 줄인 설정에서는 곧장 끝 장면에 앉는다. 화면 밖의 그림은 돌지 않는다.
 */
(function () {
  'use strict';
  var i18n = window.MalondoI18n;
  if (!i18n) return;
  var art = window.MalondoArt || null;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  // ── 작은 손들 ──────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function keep(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function recall(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function t(k) { return i18n.t(k); }
  function fill(s, v) { return String(s).replace('{0}', v); }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function dayKey(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dark() {
    var th = root.getAttribute('data-theme');
    if (th) return th === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function theme() { return dark() ? 'dark' : 'light'; }
  function css(name) { return getComputedStyle(root).getPropertyValue('--' + name).trim(); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  // 앱의 곡선 — Motion.standard(0.2,0,0,1) 등.
  function bez(x1, y1, x2, y2) {
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var lo = 0, hi = 1, m = .5;
      for (var i = 0; i < 24; i++) {
        m = (lo + hi) / 2;
        var cx = 3 * m * (1 - m) * (1 - m) * x1 + 3 * m * m * (1 - m) * x2 + m * m * m;
        if (cx < x) lo = m; else hi = m;
      }
      return 3 * m * (1 - m) * (1 - m) * y1 + 3 * m * m * (1 - m) * y2 + m * m * m;
    };
  }
  var standard = bez(.2, 0, 0, 1), soft = bez(.4, 0, .2, 1);
  function settle(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3) + Math.sin(x * Math.PI) * .06 * (1 - x); }
  // 손끝 — 안드로이드 크롬에서만 온다. 무음이어도 손에 닿는 박.
  function buzz(ms) { try { if (!reduce && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function whenSeen(el, fn, threshold) {
    if (!el) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } });
    }, { threshold: threshold || .35 });
    io.observe(el);
  }
  function visible(el, fn, threshold) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { fn(e.isIntersecting); }); }, { threshold: threshold || .05 });
    io.observe(el);
  }
  function hidpi(canvas, w, h) {
    var r = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * r); canvas.height = Math.round(h * r);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(r, 0, 0, r, 0, 0);
    return ctx;
  }
  function locale() { return { ko: 'ko-KR', ja: 'ja-JP', es: 'es-ES' }[i18n.lang] || 'en-US'; }
  function fmtDate(d) {
    try { return d.toLocaleDateString(locale(), { month: 'long', day: 'numeric', weekday: 'short' }); }
    catch (e) { return (d.getMonth() + 1) + '/' + d.getDate(); }
  }
  function isNight(d) { var h = (d || new Date()).getHours(); return h >= 20 || h < 4; }
  var night = isNight();
  if (night) root.classList.add('night');
  function onTheme(fn) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn);
  }

  // 색 — #hex 와 rgb() 를 함께 읽는다.
  function rgb(c) {
    c = String(c).trim();
    if (c.charAt(0) === '#') {
      c = c.slice(1);
      if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
      return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
    }
    var m = c.match(/[\d.]+/g) || [0, 0, 0];
    return [+m[0], +m[1], +m[2]];
  }
  function mix(a, b, k) {
    var x = rgb(a), y = rgb(b);
    return 'rgb(' + Math.round(lerp(x[0], y[0], k)) + ',' + Math.round(lerp(x[1], y[1], k)) + ',' + Math.round(lerp(x[2], y[2], k)) + ')';
  }
  function alpha(c, a) { var x = rgb(c); return 'rgba(' + x[0] + ',' + x[1] + ',' + x[2] + ',' + a + ')'; }

  // 온도 칸 여섯 — 앱의 ToneRamp(단호 · 차분 · 담백 · 유쾌 · 공감 · 따뜻).
  var TONES = ['단호하게', '차분하게', '담백하게', '유쾌하게', '공감하며', '따뜻하게'];
  var TONE_C = [35.0, 35.7, 36.5, 37.1, 37.7, 38.2];
  function toneIndex(name) { var i = TONES.indexOf(name); return i < 0 ? 2 : i; }
  function coreAt(c) {
    var cores = [css('r1'), css('r2'), css('r3'), css('r4'), css('r5'), css('r6')];
    if (c <= TONE_C[0]) return cores[0];
    for (var i = 0; i < 5; i++) {
      if (c <= TONE_C[i + 1]) return mix(cores[i], cores[i + 1], (c - TONE_C[i]) / (TONE_C[i + 1] - TONE_C[i]));
    }
    return cores[5];
  }

  // 이 페이지에서의 오늘 — 하루 한 장의 「오늘 여기서의 나」가 읽는다.
  function note(kind) {
    var today = dayKey(new Date());
    var log = recall('malondo.today');
    if (!log || log.day !== today || !Array.isArray(log.events)) log = { day: today, events: [] };
    var now = new Date();
    log.events.push({ k: kind, h: now.getHours() + now.getMinutes() / 60 });
    if (log.events.length > 40) log.events = log.events.slice(-40);
    keep('malondo.today', log);
    if (window.MalondoDay) window.MalondoDay.refresh();
  }

  // 오늘의 문장 — 앱의 TraceLine.of: 2026-01-01 부터의 날수를 서른 줄로 돈다.
  var LINE_TONES = ['공감하며', '차분하게', '따뜻하게', '담백하게', '유쾌하게', '단호하게', '공감하며', '따뜻하게', '차분하게', '담백하게',
    '유쾌하게', '공감하며', '따뜻하게', '단호하게', '차분하게', '담백하게', '공감하며', '따뜻하게', '유쾌하게', '차분하게',
    '담백하게', '공감하며', '따뜻하게', '단호하게', '유쾌하게', '차분하게', '공감하며', '따뜻하게', '담백하게', '따뜻하게'];
  var lineIdx = (function () {
    var d = new Date();
    var n = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 1)) / 864e5);
    return ((n % 30) + 30) % 30;
  })();
  var lineTone = toneIndex(LINE_TONES[lineIdx]);
  function lineText() { return t('trace.line.' + lineIdx); }

  // ── 방문 인사 · 절기 ────────────────────────────────────────────────────
  var visit = (function () {
    var prev = recall('malondo.visit');
    var today = dayKey(new Date());
    var state;
    if (!prev || !prev.day) state = { kind: 'first' };
    else if (prev.day === today) state = { kind: 'today' };
    else {
      var a = new Date(prev.day + 'T00:00:00'), b = new Date(today + 'T00:00:00');
      state = { kind: 'back', days: Math.max(1, Math.round((b - a) / 864e5)) };
    }
    keep('malondo.visit', { day: today, first: (prev && prev.first) || today, count: ((prev && prev.count) || 0) + 1 });
    if (!prev || prev.day !== today) note('arrive');
    return state;
  })();

  // 절기 — 앱의 seasons.dart(Meeus 25장, 낮은 정밀도)를 그대로. 날짜는 한국 시각으로 가른다.
  var TERMS = [
    ['춘분', '낮과 밤이 같아지는 날', '春分', '昼と夜が同じになる日'],
    ['청명', '하늘이 맑아지는 때', '清明', '空が澄むころ'],
    ['곡우', '봄비가 곡식을 깨우는 때', '穀雨', '春の雨が穀物を目覚めさせるころ'],
    ['입하', '여름이 선다는 날', '立夏', '夏が立つという日'],
    ['소만', '볕이 차오르는 때', '小満', '日差しが満ちてくるころ'],
    ['망종', '씨를 뿌리는 때', '芒種', '種をまくころ'],
    ['하지', '낮이 가장 긴 날', '夏至', '昼がいちばん長い日'],
    ['소서', '더위가 시작되는 때', '小暑', '暑さが始まるころ'],
    ['대서', '더위가 한창인 때', '大暑', '暑さがいちばんのころ'],
    ['입추', '가을이 선다는 날', '立秋', '秋が立つという日'],
    ['처서', '더위가 물러가는 때', '処暑', '暑さがおさまるころ'],
    ['백로', '풀잎에 이슬이 맺히는 때', '白露', '草に露が宿るころ'],
    ['추분', '낮과 밤이 다시 같아지는 날', '秋分', '昼と夜がふたたび同じになる日'],
    ['한로', '찬 이슬이 내리는 때', '寒露', '冷たい露が降りるころ'],
    ['상강', '서리가 내리기 시작하는 때', '霜降', '霜が降りはじめるころ'],
    ['입동', '겨울이 선다는 날', '立冬', '冬が立つという日'],
    ['소설', '첫눈이 온다는 때', '小雪', '初雪が降るころ'],
    ['대설', '눈이 많이 온다는 때', '大雪', '雪がたくさん降るころ'],
    ['동지', '밤이 가장 긴 날', '冬至', '夜がいちばん長い日'],
    ['소한', '작은 추위가 오는 때', '小寒', '小さな寒さが来るころ'],
    ['대한', '겨울의 끝자락', '大寒', '冬の終わり'],
    ['입춘', '봄이 선다는 날', '立春', '春が立つという日'],
    ['우수', '눈이 비로 바뀌는 때', '雨水', '雪が雨に変わるころ'],
    ['경칩', '겨울잠 깬 것들이 나오는 날', '啓蟄', '冬眠から覚めたものが出てくる日']
  ];
  function sunLongitude(jd) {
    var T = (jd - 2451545.0) / 36525.0, rad = Math.PI / 180;
    var l0 = 280.46646 + 36000.76983 * T + .0003032 * T * T;
    var m = (357.52911 + 35999.05029 * T - .0001537 * T * T) * rad;
    var c = (1.914602 - .004817 * T - .000014 * T * T) * Math.sin(m) + (.019993 - .000101 * T) * Math.sin(2 * m) + .000289 * Math.sin(3 * m);
    var om = (125.04 - 1934.136 * T) * rad;
    var l = l0 + c - .00569 - .00478 * Math.sin(om);
    return ((l % 360) + 360) % 360;
  }
  function termDay(year, i) {
    var lon = i * 15;
    var ahead = (((lon - 280.5) % 360) + 360) % 360;
    var jd = Date.UTC(year, 0, 1) / 864e5 + 2440587.5 + ahead / 360 * 365.2422;
    for (var k = 0; k < 6; k++) {
      var diff = lon - sunLongitude(jd);
      diff = ((diff + 540) % 360) - 180;
      jd += diff / 360 * 365.2422;
      if (Math.abs(diff) < 1e-6) break;
    }
    var kst = new Date((jd - 2440587.5) * 864e5 + 9 * 36e5);
    return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  }
  function season(d) {
    var today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    var best = -1, since = -Infinity;
    [d.getFullYear() - 1, d.getFullYear()].forEach(function (y) {
      for (var i = 0; i < 24; i++) {
        var day = termDay(y, i);
        if (day <= today && day > since) { since = day; best = i; }
      }
    });
    return { i: best, isDay: since === today };
  }
  function paintVisit() {
    var box = $('visit');
    if (!box) return;
    var chips = [];
    if (visit.kind === 'first') chips.push(t('visit.first'));
    else if (visit.kind === 'today') chips.push(t('visit.today'));
    else chips.push(fill(t('visit.back'), visit.days) + ' · ' + t('visit.changed'));
    var lang = i18n.lang;
    if (lang === 'ko' || lang === 'ja') {
      var s = season(new Date()), row = TERMS[s.i];
      if (row) {
        chips.push(lang === 'ko'
          ? (s.isDay ? '오늘은 ' + row[0] + ' · ' + row[1] : row[0] + ' 무렵 · ' + row[1])
          : (s.isDay ? 'きょうは' + row[2] + ' · ' + row[3] : row[2] + 'のころ · ' + row[3]));
      }
    }
    if (night) chips.push(t('visit.night'));
    box.textContent = '';
    chips.forEach(function (c, k) {
      var li = document.createElement('li');
      li.textContent = c;
      li.style.setProperty('--k', k);
      box.appendChild(li);
    });
    box.hidden = false;
  }
  paintVisit();
  i18n.onChange(paintVisit);

  // ── 머리의 오늘의 문장 ─────────────────────────────────────────────────
  (function heroLine() {
    var a = $('heroLine');
    if (!a) return;
    function paint() {
      a.querySelector('q').textContent = lineText();
      a.style.setProperty('--line-c', 'var(--r' + (lineTone + 1) + ')');
      a.hidden = false;
    }
    paint();
    i18n.onChange(paint);
  })();

  // ── 움직이는 화면 — 폰 틀 안의 앱 영상 ────────────────────────────────
  (function tour() {
    var sec = $('tour'), video = $('tourVideo');
    if (!sec || !video) return;
    video.muted = true;
    var tabs = Array.prototype.slice.call(sec.querySelectorAll('[data-clip]'));
    var current = -1, seen = false, raf = 0, lang = i18n.lang;
    function src(k) { return '/video/tour-' + i18n.lang + '-' + tabs[k].getAttribute('data-clip'); }
    function label() {
      var tab = tabs[current];
      video.setAttribute('aria-label', fill(t('tour.video'), tab ? tab.querySelector('b').textContent : ''));
    }
    function select(k, play, user) {
      k = (k + tabs.length) % tabs.length;
      current = k;
      tabs.forEach(function (b, j) {
        b.setAttribute('aria-selected', j === k ? 'true' : 'false');
        b.classList.toggle('on', j === k);
        b.style.setProperty('--p', 0);
      });
      var base = src(k);
      video.poster = base + '.webp';
      video.src = base + '.mp4';
      label();
      if (play && seen && (!reduce || user)) video.play().catch(function () {});
      // 목록이 가로로 흐르는 좁은 화면에서는 고른 것이 보이게 민다(페이지는 움직이지 않는다).
      var strip = tabs[k].parentNode.parentNode;
      if (strip.scrollWidth > strip.clientWidth + 4) {
        var li = tabs[k].parentNode;
        strip.scrollTo({ left: li.offsetLeft - (strip.clientWidth - li.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
      }
    }
    tabs.forEach(function (b, k) {
      b.addEventListener('click', function () { buzz(6); select(k, true, true); });
    });
    video.addEventListener('ended', function () { select(current + 1, true, false); });
    video.addEventListener('click', function () { if (video.paused) video.play().catch(function () {}); else video.pause(); });
    function tick() {
      raf = requestAnimationFrame(tick);
      var d = video.duration;
      if (d && isFinite(d) && tabs[current]) tabs[current].style.setProperty('--p', (video.currentTime / d).toFixed(4));
    }
    visible(sec.querySelector('.stage'), function (on) {
      seen = on;
      if (on) {
        if (current < 0) select(0, true, false);
        else if (video.paused && !reduce) video.play().catch(function () {});
        if (!raf) tick();
      } else {
        video.pause();
        cancelAnimationFrame(raf); raf = 0;
      }
    }, .3);
    i18n.onChange(function () {
      if (current < 0 || i18n.lang === lang) return;
      lang = i18n.lang;
      var at = video.currentTime, playing = !video.paused;
      video.poster = src(current) + '.webp';
      video.src = src(current) + '.mp4';
      video.addEventListener('loadedmetadata', function once() {
        video.removeEventListener('loadedmetadata', once);
        try { video.currentTime = at; } catch (e) {}
        if (playing) video.play().catch(function () {});
      });
      label();
    });
  })();

  // ── 다섯 문 — 들판이 한 번 숨 쉰다 ─────────────────────────────────────
  (function doors() {
    var list = $('doors');
    if (!list || !art) return;
    var items = Array.prototype.slice.call(list.querySelectorAll('[data-scene]'));
    var clocks = items.map(function () { return { t0: 0, playing: false }; });
    var canv = items.map(function (b) { return b.querySelector('canvas'); });
    // 민들레 씨는 그림 칸 밖(위로 5, 오른쪽으로 3.6)까지 날아간다 — 둘레를 두고 그린다.
    var W = 0, H = 0, P = 0;
    function size() {
      H = window.innerWidth < 420 ? 50 : 62; W = Math.round(H * art.meadowAspect); P = Math.ceil(H * 6 / 44);
      canv.forEach(function (c) { c._ctx = hidpi(c, W + P * 2, H + P * 2); c.style.margin = (-P) + 'px ' + (-P / 2) + 'px'; });
    }
    function draw(k, u) {
      var ctx = canv[k]._ctx;
      ctx.clearRect(0, 0, W + P * 2, H + P * 2);
      ctx.save(); ctx.translate(P, P);
      art.drawMeadow(ctx, items[k].getAttribute('data-scene'), u, theme(), W, H);
      ctx.restore();
    }
    var running = false;
    function frame(now) {
      var any = false;
      items.forEach(function (_, k) {
        var c = clocks[k];
        if (!c.playing) return;
        var u = (now - c.t0) / 1000;
        if (u < 0) { any = true; return; }
        if (u >= art.meadowSeconds) { c.playing = false; draw(k, 99); return; }
        draw(k, u); any = true;
      });
      if (any) requestAnimationFrame(frame); else running = false;
    }
    function play(k, delay) {
      if (reduce) { draw(k, 99); return; }
      clocks[k].t0 = performance.now() + (delay || 0);
      clocks[k].playing = true;
      draw(k, 0);
      if (!running) { running = true; requestAnimationFrame(frame); }
    }
    size();
    items.forEach(function (_, k) { draw(k, reduce ? 99 : 0); });
    // 앱처럼 들어서는 문이 70ms 씩 늦게 — 들어선 뒤(260ms) 그림이 논다.
    whenSeen(list, function () { items.forEach(function (_, k) { play(k, 260 + k * 70); }); }, .3);
    items.forEach(function (b, k) {
      b.addEventListener('click', function () { buzz(8); play(k, 0); });
      b.addEventListener('mouseenter', function () { if (!clocks[k].playing) play(k, 0); });
    });
    var again = $('doorsReplay');
    if (again) again.addEventListener('click', function () { buzz(8); items.forEach(function (_, k) { play(k, k * 70); }); });
    // 크기가 정말 바뀔 때만 다시 잡는다 — 캔버스 폭을 새로 주면 그림이 지워진다(모바일은 주소창이 접힐 때마다 resize 가 온다).
    window.addEventListener('resize', function () {
      var h = window.innerWidth < 420 ? 50 : 62;
      if (h === H) return;
      size();
      items.forEach(function (_, k) { if (!clocks[k].playing) draw(k, 99); });
    });
    onTheme(function () { items.forEach(function (_, k) { if (!clocks[k].playing) draw(k, 99); }); });
  })();

  // ── 창가 책상 ─────────────────────────────────────────────────────────
  (function desk() {
    var stage = $('deskStage'), board = $('deskBoard'), canvas = $('deskCanvas');
    if (!stage || !board || !canvas || !art) return;
    var objects = art.deskObjects;
    var hits = $('deskHits'), labels = $('deskLabels'), detail = $('deskDetail');
    // 판 353×106 둘레에 여유 — 촛불의 볕(오른쪽 23)과 들림(위로 4).
    var PX = 20, PT = 8, PB = 3, UW = 353 + PX * 2, UH = 106 + PT + PB;
    var ctx, W = 0, k = 1, off = 0, lift = null, raf = 0, onScreen = false, flame0 = performance.now(), opened = -1;
    var SHOT = ['tracepage', 'ridges', 'letterbox', 'herbarium', 'jar', 'musicbox', 'candle'];
    stage.classList.toggle('night', night);
    function traces() {
      var tr = recall('malondo.trace') || {}, jar = recall('malondo.jar');
      var n = Array.isArray(jar) ? jar.length : 0;
      return { pages: Math.min(5, 1 + (tr.count || 0)), scribbles: true, sealed: true, pressed: true, stars: Math.min(11, 3 + n) };
    }
    function layout() {
      if (board.clientWidth < 60) { W = 0; return; }
      W = Math.min(board.clientWidth, 800);
      k = W / UW;
      off = (board.clientWidth - W) / 2;
      ctx = hidpi(canvas, W, Math.round(UH * k));
      each(hits.children, function (b, i) {
        var o = objects[i];
        b.style.left = ((PX + o.span[0]) * k + off) + 'px';
        b.style.width = ((o.span[1] - o.span[0]) * k) + 'px';
        b.style.top = ((PT + art.deskHitTop) * k) + 'px';
        b.style.height = ((96 - art.deskHitTop) * k) + 'px';
      });
      each(labels.children, function (s, i) {
        var o = objects[i], w = (o.span[1] - o.span[0]) * k;
        s.style.left = ((PX + o.x) * k - w / 2 + off) + 'px';
        s.style.width = w + 'px';
      });
      draw(performance.now());
    }
    function draw(now) {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, UH * k);
      var l = null;
      if (lift) {
        var v = (now - lift.t0) / art.deskLiftMs;
        if (v >= 1) lift = null; else l = { object: lift.object, v: v };
      }
      ctx.save();
      ctx.translate(PX * k, PT * k);
      art.drawDesk(ctx, {
        traces: traces(), lit: night,
        flame: reduce ? 0 : (((now - flame0) / 1000) / art.deskFlameSeconds) % 1,
        lift: l
      }, theme(), 353 * k, 106 * k);
      ctx.restore();
    }
    function loop(now) {
      draw(now);
      raf = onScreen && !reduce && (night || lift) ? requestAnimationFrame(loop) : 0;
    }
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }
    objects.forEach(function (o, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', t('desk.o.' + (i + 1) + '.h'));
      b.setAttribute('aria-controls', 'deskDetail');
      b.setAttribute('aria-expanded', 'false');
      b.addEventListener('click', function () { open(i); });
      hits.appendChild(b);
      var s = document.createElement('span');
      s.textContent = t('desk.o.' + (i + 1) + '.h');
      s.addEventListener('click', function () { open(i); });
      labels.appendChild(s);
    });
    function fillDetail(i) {
      detail.querySelector('h3').textContent = t('desk.o.' + (i + 1) + '.h');
      detail.querySelector('p').textContent = t('desk.o.' + (i + 1) + '.p');
      var img = detail.querySelector('img');
      img.src = '/shots/' + i18n.lang + '/' + SHOT[i] + '.webp';
      img.alt = t('desk.o.' + (i + 1) + '.alt');
    }
    function open(i) {
      opened = i;
      buzz(10);
      if (!reduce) { lift = { object: objects[i].name, t0: performance.now() }; kick(); }
      each(labels.children, function (s, j) { s.classList.toggle('on', j === i); });
      each(hits.children, function (b, j) { b.setAttribute('aria-expanded', j === i ? 'true' : 'false'); });
      // 앱처럼 물건이 들린 뒤(220ms) 자리가 열린다.
      setTimeout(function () {
        fillDetail(i);
        detail.hidden = false;
        detail.classList.remove('in'); void detail.offsetWidth; detail.classList.add('in');
        var r = detail.getBoundingClientRect();
        if (r.bottom > window.innerHeight) detail.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      }, reduce ? 0 : art.deskOpenDelayMs);
    }
    detail.querySelector('.close').addEventListener('click', function () {
      detail.hidden = true; opened = -1;
      each(labels.children, function (s) { s.classList.remove('on'); });
      each(hits.children, function (b) { b.setAttribute('aria-expanded', 'false'); });
    });
    function status() {
      $('deskStatus').textContent = (night ? t('desk.night') : t('desk.day')) + ' ' + t('desk.yours');
      each(labels.children, function (s, i) { s.textContent = t('desk.o.' + (i + 1) + '.h'); });
      each(hits.children, function (b, i) { b.setAttribute('aria-label', t('desk.o.' + (i + 1) + '.h')); });
      if (opened >= 0) fillDetail(opened);
    }
    status();
    i18n.onChange(status);
    layout();
    window.addEventListener('resize', function () { if (Math.min(board.clientWidth, 800) !== W) layout(); });
    visible(stage, function (on) { onScreen = on; if (on && !W) layout(); if (on) kick(); });
    window.MalondoDesk = { refresh: function () { draw(performance.now()); } };
    onTheme(function () { draw(performance.now()); });
  })();

  // ── 오늘의 문장 — 따라 적기 ───────────────────────────────────────────
  (function trace() {
    var wrap = $('tracePaper');
    if (!wrap) return;
    var guide = $('traceGuide'), ink = $('traceInk');
    var gctx, ictx, W = 0, H = 0, font = 40, top = 0, gap = 0;
    var tone = lineTone;
    var glyphs = [], strokes = [], live = null, done = false, left = 0, lang = i18n.lang;
    var letter = /[\p{L}\p{N}]/u;
    function family() { return getComputedStyle(wrap).fontFamily || 'serif'; }
    function tonePaint() {
      var box = $('traceTone');
      box.textContent = '';
      var dot = document.createElement('i');
      dot.style.background = 'var(--r' + (tone + 1) + ')';
      var name = document.createElement('span');
      name.textContent = t('tone.' + (tone + 1)) + ' ';
      var val = document.createElement('span');
      val.className = 'tv';
      val.textContent = i18n.fmtC(TONE_C[tone]) + i18n.sym();
      box.appendChild(dot); box.appendChild(name); box.appendChild(val);
      $('traceDate').textContent = fmtDate(new Date());
    }
    function layout() {
      if (wrap.clientWidth < 60) { W = 0; return; }
      W = Math.min(wrap.clientWidth, 640);
      var lines = lineText().split('\n');
      var probe = document.createElement('canvas').getContext('2d');
      font = Math.min(52, Math.max(26, W / 8.2));
      for (;;) {
        probe.font = font + 'px ' + family();
        var widest = Math.max.apply(null, lines.map(function (l) { return probe.measureText(l).width; }));
        if (widest <= W - 64 || font <= 20) break;
        font -= 2;
      }
      gap = font * 2.05; top = font * 1.4;
      H = Math.round(top + (lines.length - 1) * gap + font * 1.1);
      wrap.style.height = H + 'px';
      gctx = hidpi(guide, W, H); ictx = hidpi(ink, W, H);
      // 글자마다의 칸과, 잉크가 닿아야 할 자리의 표본.
      var mask = document.createElement('canvas'); var mctx = mask.getContext('2d');
      mask.width = W; mask.height = H;
      mctx.font = font + 'px ' + family(); mctx.fillStyle = '#000'; mctx.textBaseline = 'alphabetic';
      glyphs = [];
      lines.forEach(function (line, r) {
        var y = top + r * gap, x0 = 40;
        mctx.fillText(line, x0, y);
        var acc = '';
        Array.from(line).forEach(function (ch) {
          var a = mctx.measureText(acc).width; acc += ch; var b = mctx.measureText(acc).width;
          if (!letter.test(ch)) return;
          glyphs.push({ ch: ch, x: x0 + a, w: b - a, y: y, r: r, pts: [], hit: 0, ok: false });
        });
      });
      var data = mctx.getImageData(0, 0, W, H).data;
      glyphs.forEach(function (g) {
        var x1 = Math.floor(g.x), x2 = Math.ceil(g.x + g.w), y1 = Math.floor(g.y - font * .95), y2 = Math.ceil(g.y + font * .28);
        var step = Math.max(2, Math.round(font / 14));
        for (var y = y1; y < y2; y += step) for (var x = x1; x < x2; x += step) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          if (data[(y * W + x) * 4 + 3] > 120) g.pts.push([x, y, 0]);
        }
        if (g.pts.length < 6) g.pts.push([g.x + g.w / 2, g.y - font * .35, 0]);
      });
      left = glyphs.length;
      strokes = []; live = null; done = false;
      $('traceStamp').hidden = true; $('traceAgain').hidden = true; $('traceErase').hidden = false;
      paint(); redrawInk();
    }
    function paint() {
      if (!gctx) return;
      var lines = lineText().split('\n');
      gctx.clearRect(0, 0, W, H);
      // 줄 친 종이 — 여백선은 문장의 온도.
      gctx.strokeStyle = css('line'); gctx.lineWidth = 1;
      for (var r = 0; r < lines.length; r++) { var y = top + r * gap + font * .3; gctx.beginPath(); gctx.moveTo(0, y + .5); gctx.lineTo(W, y + .5); gctx.stroke(); }
      gctx.strokeStyle = alpha(css('r' + (tone + 1)), .35);
      gctx.beginPath(); gctx.moveTo(26.5, 0); gctx.lineTo(26.5, H); gctx.stroke();
      gctx.font = font + 'px ' + family(); gctx.textBaseline = 'alphabetic';
      var base = css('ink');
      var gi = 0;
      lines.forEach(function (line, r) {
        var acc = '', y = top + r * gap;
        Array.from(line).forEach(function (ch) {
          var x = 40 + gctx.measureText(acc).width;
          acc += ch;
          var g = letter.test(ch) ? glyphs[gi++] : null;
          gctx.fillStyle = alpha(base, done ? .05 : g && g.ok ? .07 : .22);
          gctx.fillText(ch, x, y);
        });
      });
      $('traceLeft').textContent = done ? t('trace.done') : left === glyphs.length ? t('trace.hint') : fill(t('trace.left'), left);
      $('traceProgress').style.setProperty('--p', glyphs.length ? (1 - left / glyphs.length).toFixed(3) : 0);
      wrap.setAttribute('aria-label', fill(t('trace.aria'), lineText().replace(/\n/g, ' ')));
    }
    function wet() { return css('r' + (tone + 1) + 'i'); }
    function drawStroke(s, from) {
      var c = done ? mix(wet(), css('ink'), .12) : wet();
      ictx.strokeStyle = c; ictx.fillStyle = c;
      ictx.lineCap = 'round'; ictx.lineJoin = 'round';
      var p = s.pts;
      if (p.length === 1) { ictx.beginPath(); ictx.arc(p[0][0], p[0][1], p[0][2] * .55, 0, 7); ictx.fill(); return; }
      for (var i = Math.max(1, from); i < p.length; i++) {
        var a = p[i - 1], b = p[i];
        ictx.lineWidth = b[2];
        ictx.beginPath();
        if (i >= 2) { var q = p[i - 2]; ictx.moveTo((q[0] + a[0]) / 2, (q[1] + a[1]) / 2); ictx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
        else { ictx.moveTo(a[0], a[1]); ictx.lineTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
        ictx.stroke();
      }
    }
    function redrawInk() {
      if (!ictx) return;
      ictx.clearRect(0, 0, W, H);
      strokes.forEach(function (s) { drawStroke(s, 1); });
    }
    function cover(x, y, px, py) {
      var reach = Math.max(6, font * .24), r2 = reach * reach;
      var steps = px == null ? 1 : Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / (reach * .5)));
      var turned = false;
      for (var s = 1; s <= steps; s++) {
        var cx = px == null ? x : lerp(px, x, s / steps), cy = py == null ? y : lerp(py, y, s / steps);
        glyphs.forEach(function (g) {
          if (g.ok) return;
          if (cx < g.x - reach || cx > g.x + g.w + reach || cy < g.y - font - reach || cy > g.y + font * .3 + reach) return;
          g.pts.forEach(function (pt) { if (!pt[2] && (pt[0] - cx) * (pt[0] - cx) + (pt[1] - cy) * (pt[1] - cy) <= r2) { pt[2] = 1; g.hit++; } });
          if (g.hit / g.pts.length >= .45) { g.ok = true; left--; turned = true; }
        });
      }
      if (turned) { buzz(6); paint(); if (left <= 0) finish(); }
    }
    function finish() {
      done = true;
      live = null;
      buzz([12, 60, 22]);
      var store = recall('malondo.trace') || { count: 0, days: {} };
      store.count = (store.count || 0) + 1;
      store.days = store.days || {};
      var key = dayKey(new Date());
      store.days[key] = (store.days[key] || 0) + 1;
      keep('malondo.trace', store);
      note('trace');
      if (window.MalondoDesk) window.MalondoDesk.refresh();
      // 잉크가 마르고(0.9초), 반 박자 뒤 도장이 앉는다.
      var t0 = performance.now(), from = wet(), dried = mix(from, css('ink'), .12);
      (function dry(now) {
        var u = reduce ? 1 : clamp((now - t0) / 900, 0, 1);
        ictx.save();
        ictx.globalCompositeOperation = 'source-in';
        ictx.fillStyle = mix(from, dried, soft(u));
        ictx.fillRect(0, 0, W, H);
        ictx.restore();
        if (u < 1) requestAnimationFrame(dry);
      })(t0);
      paint();
      var st = $('traceStamp'), d = new Date();
      st.querySelector('b').textContent = (d.getMonth() + 1) + '. ' + d.getDate();
      st.querySelector('span').textContent = t('tone.' + (tone + 1));
      st.style.color = wet();
      setTimeout(function () { st.hidden = false; st.classList.remove('in'); void st.offsetWidth; st.classList.add('in'); buzz(20); }, reduce ? 0 : 560);
      $('traceAgain').hidden = false;
      $('traceErase').hidden = true;
      week();
    }
    function clear() {
      strokes = []; live = null; done = false;
      glyphs.forEach(function (g) { g.ok = false; g.hit = 0; g.pts.forEach(function (p) { p[2] = 0; }); });
      left = glyphs.length;
      $('traceStamp').hidden = true;
      $('traceAgain').hidden = true;
      $('traceErase').hidden = false;
      redrawInk(); paint();
    }
    function week() {
      var store = recall('malondo.trace') || {};
      var days = store.days || {};
      var box = $('traceWeek');
      box.textContent = '';
      for (var b = 6; b >= 0; b--) {
        var d = new Date(); d.setDate(d.getDate() - b);
        var i = document.createElement('i');
        if (days[dayKey(d)]) i.className = 'on';
        if (b === 0) i.classList.add('today');
        box.appendChild(i);
      }
      $('traceCount').textContent = fill(t('trace.count'), store.count || 0);
    }
    // 손 — 느리면 굵고 빠르면 가늘다(펜의 결).
    var lastT = 0, width = 4;
    function pos(e) { var r = ink.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    ink.addEventListener('pointerdown', function (e) {
      if (done || !ictx) return;
      try { ink.setPointerCapture(e.pointerId); } catch (x) {}
      var p = pos(e);
      width = font * .1;
      live = { pts: [[p[0], p[1], width]] };
      strokes.push(live);
      lastT = performance.now();
      drawStroke(live, 0);
      cover(p[0], p[1], null, null);
      e.preventDefault();
    });
    ink.addEventListener('pointermove', function (e) {
      if (!live) return;
      var events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      if (!events.length) events = [e];
      events.forEach(function (ev) {
        if (!live) return;
        var p = pos(ev), q = live.pts[live.pts.length - 1];
        var d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (d < 1.2) return;
        var now = performance.now(), dt = Math.max(1, now - lastT); lastT = now;
        var target = font * (.13 - .07 * clamp((d / dt) / 1.3, 0, 1));
        width += (target - width) * .35;
        live.pts.push([p[0], p[1], width]);
        drawStroke(live, live.pts.length - 1);
        cover(p[0], p[1], q[0], q[1]);
      });
      // 긴 한 획은 끊어 둔다 — 앱의 pointsPerStroke 와 같은 생각.
      if (live && live.pts.length > 240) { live = { pts: [live.pts[live.pts.length - 1]] }; strokes.push(live); }
    });
    function up() { live = null; }
    ink.addEventListener('pointerup', up); ink.addEventListener('pointercancel', up);
    $('traceErase').addEventListener('click', function () { buzz(6); clear(); });
    $('traceAgain').addEventListener('click', function () { buzz(6); clear(); });
    tonePaint();
    week();
    // 글꼴이 선 뒤에 잰다 — 부리체의 그 글자들이 늦게 오면 칸이 어긋난다.
    function ready() {
      var fam = family().split(',')[0];
      if (document.fonts && document.fonts.load) return document.fonts.load('40px ' + fam, lineText()).then(null, function () {});
      return Promise.resolve();
    }
    // 먼저 지금 있는 글꼴로 한 번 세워 자리를 잡고(뒤의 구획이 밀리지 않게), 글꼴이 오면 다시 잰다.
    layout();
    ready().then(layout, layout);
    visible(wrap, function (on) { if (on && !W) layout(); });
    var lastW = 0;
    window.addEventListener('resize', function () {
      var w = Math.min(wrap.clientWidth, 640);
      if (Math.abs(w - W) > 2 && Math.abs(w - lastW) > 2) { lastW = w; layout(); }
    });
    i18n.onChange(function () {
      tonePaint(); week();
      if (i18n.lang !== lang) { lang = i18n.lang; ready().then(layout, layout); }
      else paint();
    });
    onTheme(function () { paint(); redrawInk(); });
  })();

  // ── 받은 말 병 ────────────────────────────────────────────────────────
  (function jar() {
    var canvas = $('jarCanvas');
    if (!canvas) return;
    var form = $('jarForm'), input = $('jarInput'), card = $('jarCard');
    var ctx, W = 0, H = 0;
    var stars = recall('malondo.jar');
    if (!Array.isArray(stars)) stars = [];
    var drop = null, pick = null, glint0 = performance.now(), raf = 0, timer = 0, onScreen = false;
    function papers() {
      var p = [];
      for (var i = 1; i <= 6; i++) p.push(dark() ? mix(css('t' + i), css('r' + i), .38) : css('t' + i));
      p.push(dark() ? mix(css('surface'), css('ink'), .12) : '#FFFFFF');
      return p;
    }
    // 병의 모양 — 몸 · 목 · 코르크.
    function shape() {
      var jw = Math.min(W * .62, 250), jh = jw * 1.18;
      var cx = W / 2, bottom = H - 16, topY = bottom - jh;
      return { cx: cx, w: jw, h: jh, top: topY, bottom: bottom, left: cx - jw / 2, neck: jw * .52 };
    }
    function pile(n, s) {
      var r = s.w * .085, cols = Math.max(1, Math.floor((s.w - 16) / (r * 2.05)));
      var out = [], seed = 7;
      function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      for (var i = 0; i < n; i++) {
        var row = Math.floor(i / cols), col = i % cols;
        var y = s.bottom - r - 6 - row * r * 1.6 - rand() * 2;
        if (y < s.top + s.h * .32) break;
        out.push({ x: s.left + 9 + r + col * r * 2.05 + (row % 2 ? r * .9 : 0) + (rand() - .5) * 3, y: y, r: r * (.88 + rand() * .2), rot: rand() * 1.3 });
      }
      return out;
    }
    function star(x, y, ro, ri, rot, fillC, lineC, lw) {
      var pts = [];
      for (var i = 0; i < 10; i++) { var a = rot - Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? ri : ro; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
      function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
      ctx.beginPath();
      var m = mid(pts[0], pts[1]); ctx.moveTo(m[0], m[1]);
      for (i = 1; i <= 10; i++) { var v = pts[i % 10], n = mid(v, pts[(i + 1) % 10]); ctx.quadraticCurveTo(v[0], v[1], n[0], n[1]); }
      ctx.closePath();
      ctx.fillStyle = fillC; ctx.fill();
      ctx.strokeStyle = lineC; ctx.lineWidth = lw || 1.2; ctx.lineJoin = 'round'; ctx.stroke();
    }
    function paperOf(i) { var s = stars[i]; return (s && s.p != null ? s.p : i) % 7; }
    function draw(now) {
      if (!ctx || !W) return;
      ctx.clearRect(0, 0, W, H);
      var s = shape(), line = css('ink-2'), pap = papers();
      // 볕 — 병 위로 비스듬히.
      var g = ctx.createRadialGradient(s.cx - s.w * .2, s.top + s.h * .35, 4, s.cx - s.w * .2, s.top + s.h * .35, s.w * 1.1);
      g.addColorStop(0, dark() ? 'rgba(205,166,105,.16)' : 'rgba(234,205,150,.3)'); g.addColorStop(1, 'rgba(234,205,150,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var spots = pile(stars.length, s);
      spots.forEach(function (p, i) {
        if (drop && i === spots.length - 1) return;
        if (pick && i === pick.k) return;
        star(p.x, p.y, p.r, p.r * .56, p.rot, pap[paperOf(i)], line, 1.1);
      });
      // 유리 — 몸과 목, 코르크.
      var r = 18, x = s.left, y = s.top + s.h * .16, w = s.w, h = s.h * .84;
      ctx.beginPath();
      ctx.moveTo(s.cx - s.neck / 2, s.top + 6);
      ctx.lineTo(s.cx - s.neck / 2, y - 6);
      ctx.quadraticCurveTo(x, y - 4, x, y + r);
      ctx.lineTo(x, y + h - r); ctx.quadraticCurveTo(x, y + h, x + r, y + h);
      ctx.lineTo(x + w - r, y + h); ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
      ctx.lineTo(x + w, y + r); ctx.quadraticCurveTo(x + w, y - 4, s.cx + s.neck / 2, y - 6);
      ctx.lineTo(s.cx + s.neck / 2, s.top + 6);
      ctx.fillStyle = dark() ? 'rgba(240,234,227,.04)' : 'rgba(255,255,255,.35)'; ctx.fill();
      ctx.strokeStyle = line; ctx.lineWidth = 1.6; ctx.stroke();
      // 유리 안쪽의 한 줄 볕.
      ctx.strokeStyle = dark() ? 'rgba(240,234,227,.1)' : 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + 12, y + r + 6); ctx.lineTo(x + 12, y + h * .62); ctx.stroke();
      ctx.fillStyle = dark() ? '#6B5B45' : '#E4D3B6';
      ctx.strokeStyle = line; ctx.lineWidth = 1.4;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(s.cx - s.neck / 2 - 3, s.top - 10, s.neck + 6, 18, 4); else ctx.rect(s.cx - s.neck / 2 - 3, s.top - 10, s.neck + 6, 18);
      ctx.fill(); ctx.stroke();
      // 유리를 지나는 빛 — 여섯 초에 한 번.
      var gt = reduce ? -1 : ((now - glint0) % 6000) / 1400;
      if (gt > 0 && gt < 1) {
        var gx = lerp(x - 20, x + w + 20, gt);
        ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y, w - 4, h - 2); ctx.clip();
        var lg = ctx.createLinearGradient(gx - 30, 0, gx + 30, 0);
        lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, dark() ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.55)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = lg; ctx.fillRect(gx - 30, y, 60, h); ctx.restore();
      }
      // 새 별이 떨어진다 — 병 입구 위에서 제자리로.
      if (drop) {
        var last = spots[spots.length - 1];
        if (!last) { drop = null; }
        else {
          var u = clamp((now - drop.t0) / 820, 0, 1), e = u * u;
          var fx = s.cx + 24, fy = s.top - 64;
          var sc = 1.4 - .4 * e;
          star(lerp(fx, last.x, e), lerp(fy, last.y, e), last.r * sc, last.r * .56 * sc, last.rot + u * 3, pap[paperOf(stars.length - 1)], line, 1.2);
          if (u >= 1) { drop = null; buzz([8, 40, 14]); }
        }
      }
      // 꺼낸 별이 올라와 펴진다.
      if (pick) {
        var pu = clamp((now - pick.t0) / 900, 0, 1), rise = standard(clamp(pu / .7, 0, 1)), open = clamp((pu - .7) / .3, 0, 1);
        var sp = pick.spot, tx = s.cx, ty = s.top - 26;
        var rr = lerp(sp.r, 24, rise) * (1 - open);
        if (rr > 1) star(lerp(sp.x, tx, rise), lerp(sp.y, ty, rise) - Math.sin(Math.PI * rise) * 18, rr, rr * lerp(.56, .8, open), sp.rot + rise * 4, pap[paperOf(pick.k)], line, 1.2);
        if (pu >= 1 && !pick.shown) { pick.shown = true; showCard(pick.k); }
      }
      $('jarCount').textContent = stars.length ? fill(t('jar.count'), stars.length) : t('jar.empty');
      canvas.setAttribute('aria-label', fill(t('jar.aria'), stars.length));
    }
    function loop(now) {
      draw(now);
      raf = 0;
      if (!onScreen) return;
      if (drop || (pick && !pick.shown)) { raf = requestAnimationFrame(loop); return; }
      if (reduce) return;
      // 빛이 지나는 동안만 돈다 — 나머지는 다음 빛까지 쉰다.
      var phase = (now - glint0) % 6000;
      if (phase < 1400) raf = requestAnimationFrame(loop);
      else { clearTimeout(timer); timer = setTimeout(kick, 6000 - phase); }
    }
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }
    function layout() {
      if (canvas.parentNode.clientWidth < 60) { W = 0; return; }
      W = Math.min(canvas.parentNode.clientWidth, 400); H = Math.round(Math.min(W * 1.02, 380));
      ctx = hidpi(canvas, W, H); draw(performance.now());
    }
    function showCard(i) {
      var s = stars[i];
      if (!s) return;
      card.querySelector('q').textContent = s.t;
      var when = new Date(s.at), whenText;
      try { whenText = when.toLocaleDateString(locale(), { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { whenText = dayKey(when); }
      card.querySelector('small').textContent = fill(t('jar.when'), whenText);
      card.hidden = false; card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
      buzz(10);
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!v || drop) return;
      // 띠가 접혀 별이 된다 — 적은 띠가 작아지며 병 쪽으로 사라지고, 병 위에서 별이 떨어진다.
      var strip = $('jarStrip');
      strip.textContent = v; strip.hidden = false;
      strip.classList.remove('fold'); void strip.offsetWidth; strip.classList.add('fold');
      input.value = '';
      input.blur();
      card.hidden = true; pick = null;
      buzz(8);
      setTimeout(function () {
        strip.hidden = true;
        stars.push({ t: v.slice(0, 80), at: Date.now(), p: Math.floor(Math.random() * 7) });
        if (stars.length > 60) stars = stars.slice(-60);
        keep('malondo.jar', stars);
        note('jar');
        drop = reduce ? null : { t0: performance.now() };
        if (window.MalondoDesk) window.MalondoDesk.refresh();
        if (!onScreen) canvas.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
        kick();
        if (reduce) draw(performance.now());
      }, reduce ? 0 : 600);
    });
    function take() {
      if (!stars.length || drop) return;
      card.hidden = true;
      var s = shape(), spots = pile(stars.length, s);
      if (!spots.length) return;
      var i = Math.floor(Math.random() * spots.length);
      note('take');
      if (reduce) { showCard(i); return; }
      pick = { k: i, spot: spots[i], t0: performance.now() };
      kick();
    }
    canvas.addEventListener('click', take);
    canvas.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); take(); } });
    $('jarTake').addEventListener('click', take);
    card.querySelector('button').addEventListener('click', function () { card.hidden = true; pick = null; draw(performance.now()); });
    $('jarClear').addEventListener('click', function () {
      if (!stars.length || !window.confirm(t('jar.clearAsk'))) return;
      stars = []; keep('malondo.jar', stars); card.hidden = true; pick = null; draw(performance.now());
      if (window.MalondoDesk) window.MalondoDesk.refresh();
    });
    layout();
    window.addEventListener('resize', function () { if (Math.min(canvas.parentNode.clientWidth, 400) !== W) layout(); });
    visible(canvas, function (on) { onScreen = on; if (on && !W) layout(); if (on) { glint0 = performance.now() - 5000; kick(); } else { clearTimeout(timer); } });
    function words() { input.placeholder = t('jar.placeholder'); draw(performance.now()); }
    words();
    i18n.onChange(words);
    onTheme(function () { draw(performance.now()); });
  })();

  // ── 하루 한 장 — 빛이 그날을 한 번 다시 지나간다 ──────────────────────
  (function day() {
    var sec = $('dayCard'), canvas = $('dayRibbon');
    if (!sec || !canvas) return;
    var ctx, W = 0, H = 66, t0 = 0, mode = 'sample', moments = [], from = 0, to = 24, raf = 0, felt = 0;
    var SAMPLE = [
      { h: 8 + 40 / 60, k: 'measure', c: 36.4, l: 'day.m.1' },
      { h: 12 + 20 / 60, k: 'saved', tone: 4, l: 'day.m.2' },
      { h: 13 + 10 / 60, k: 'measure', c: 37.6, l: 'day.m.1' },
      { h: 17.5, k: 'kind', l: 'day.m.3' },
      { h: 19.75, k: 'trace', tone: 4, l: 'day.m.4' },
      { h: 21.5, k: 'measure', c: 38.0, l: 'day.m.1' },
      { h: 21.5 + 1 / 60, k: 'pressed', c: 38.0, l: 'day.m.5' },
      { h: 22 + 5 / 60, k: 'mark', tone: 4, l: 'day.m.6' },
      { h: 23 + 10 / 60, k: 'sealed', c: 35.8, l: 'day.m.7' }
    ];
    var MINE = { arrive: ['measure', 'day.mine.arrive'], trace: ['trace', 'day.mine.trace'], jar: ['kind', 'day.mine.jar'], take: ['saved', 'day.mine.take'] };
    function mine() {
      var log = recall('malondo.today');
      if (!log || log.day !== dayKey(new Date()) || !Array.isArray(log.events)) return [];
      return log.events.map(function (e) { var m = MINE[e.k] || MINE.arrive; return { h: e.h, k: m[0], l: m[1], mine: true, tone: 3 }; });
    }
    function span() {
      if (!moments.length) { from = 6; to = 24; return; }
      from = Math.max(0, moments[0].h - 1); to = Math.min(24, moments[moments.length - 1].h + 1);
      if (to - from < 3) to = Math.min(24, from + 3);
    }
    function colorOf(m) { return m.c != null ? coreAt(m.c) : m.tone != null ? css('r' + (m.tone + 1)) : css('accent'); }
    function hm(h) { var a = Math.floor(h), m = Math.round((h - a) * 60); if (m === 60) { a++; m = 0; } return ('0' + a).slice(-2) + ':' + ('0' + m).slice(-2); }
    function mark(c, x, y, r, kind, col, surf) {
      c.fillStyle = col; c.strokeStyle = col; c.lineWidth = Math.max(1.2, r * .32); c.lineJoin = 'round';
      c.beginPath();
      if (kind === 'measure') { c.arc(x, y, r, 0, 7); c.fill(); }
      else if (kind === 'mark') { var q = r * .9; c.rect(x - q, y - q, q * 2, q * 2); c.fill(); }
      else if (kind === 'saved') { c.arc(x, y, r * .85, 0, 7); c.fillStyle = surf; c.fill(); c.stroke(); }
      else if (kind === 'sealed') {
        c.rect(x - r * 1.05, y - r * .75, r * 2.1, r * 1.5); c.fillStyle = surf; c.fill(); c.stroke();
        c.beginPath(); c.moveTo(x - r * 1.05, y - r * .75); c.lineTo(x, y + r * .15); c.lineTo(x + r * 1.05, y - r * .75); c.stroke();
      } else if (kind === 'kind') {
        for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .55 : r * 1.15; var px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
        c.closePath(); c.fill();
      } else { c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath(); c.fill(); }
    }
    function draw(now) {
      if (!ctx || !W) { raf = 0; return; }
      var dur = 1400 + 100 * Math.min(12, moments.length);
      var u = reduce ? 1 : clamp((now - t0) / dur, 0, 1);
      var L = lerp(from, to, soft(u));
      ctx.clearRect(0, 0, W, H);
      var pad = 10, y = H * .66, x0 = pad, x1 = W - pad;
      function xOf(h) { return x0 + (x1 - x0) * h / 24; }
      var g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, css('t1')); g.addColorStop(.27, css('t4')); g.addColorStop(.52, css('t6')); g.addColorStop(.77, css('t4')); g.addColorStop(1, css('t1'));
      ctx.fillStyle = g; ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x0, y - 3, x1 - x0, 6, 3); else ctx.rect(x0, y - 3, x1 - x0, 6);
      ctx.fill();
      // 해와 달 — 정오와 밤 아홉 시의 자리.
      ctx.strokeStyle = css('ink-3'); ctx.lineWidth = 1.1; ctx.lineCap = 'round';
      var sx = xOf(12), sy = y - 20;
      ctx.beginPath(); ctx.arc(sx, sy, 3.4, 0, 7); ctx.stroke();
      for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * 5.4, sy + Math.sin(a) * 5.4); ctx.lineTo(sx + Math.cos(a) * 7.2, sy + Math.sin(a) * 7.2); ctx.stroke(); }
      var mx = xOf(21), my = y - 20;
      ctx.beginPath(); ctx.arc(mx, my, 4.4, -2.3, 2.3); ctx.quadraticCurveTo(mx + .8, my, mx + 4.4 * Math.cos(-2.3), my + 4.4 * Math.sin(-2.3)); ctx.stroke();
      if (u > 0) { ctx.strokeStyle = alpha(css('accent'), .5); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(xOf(from), y); ctx.lineTo(xOf(L), y); ctx.stroke(); }
      var lastX = -99, lane = 0, surf = css('surface');
      moments.forEach(function (m) {
        var x = xOf(m.h);
        lane = Math.abs(x - lastX) < 10 ? Math.min(lane + 1, 3) : 0; lastX = x;
        var grow = u >= 1 ? 1 : settle(clamp((L - m.h) / Math.max(.2, (to - from) * .05), 0, 1));
        if (grow <= 0) return;
        var r = 4.6 * grow, yy = y - lane * 10;
        mark(ctx, x, yy, r + 1.8, m.k, surf, surf);
        mark(ctx, x, yy, r, m.k, colorOf(m), surf);
      });
      var glow = u <= 0 ? 0 : 1 - clamp((u - .88) / .12, 0, 1);
      if (glow > 0 && !reduce) {
        var lx = xOf(L), rg = ctx.createRadialGradient(lx, y, 0, lx, y, 15);
        rg.addColorStop(0, alpha(css('accent'), .35 * glow)); rg.addColorStop(1, alpha(css('accent'), 0));
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(lx, y, 15, 0, 7); ctx.fill();
        ctx.fillStyle = alpha(css('accent'), glow); ctx.beginPath(); ctx.arc(lx, y, 3.2, 0, 7); ctx.fill();
      }
      // 줄이 빛을 따라 떠오른다.
      each($('dayList').children, function (li, j) {
        var m = moments[j]; if (!m) return;
        var v = u >= 1 ? 1 : clamp((L - m.h) / Math.max(.25, (to - from) * .06), 0, 1);
        li.style.opacity = v; li.style.transform = 'translateX(' + (-8 * (1 - v)).toFixed(1) + 'px)';
      });
      while (felt < Math.min(8, moments.length) && L >= moments[felt].h) { felt++; buzz(5); }
      raf = u < 1 ? requestAnimationFrame(draw) : 0;
    }
    function list() {
      var ul = $('dayList'); ul.textContent = '';
      moments.forEach(function (m) {
        var li = document.createElement('li');
        var sw = document.createElement('canvas'); var sc = hidpi(sw, 12, 12);
        mark(sc, 6, 6, 4.6, m.k, colorOf(m), css('surface'));
        var tm = document.createElement('time'); tm.textContent = hm(m.h);
        var tx = document.createElement('span'); tx.textContent = t(m.l);
        var val = document.createElement('b');
        if (m.c != null) val.textContent = i18n.fmtC(m.c) + i18n.sym();
        else if (m.tone != null && !m.mine) val.textContent = t('tone.' + (m.tone + 1));
        li.appendChild(tm); li.appendChild(sw); li.appendChild(tx); li.appendChild(val);
        ul.appendChild(li);
      });
      $('dayEmpty').hidden = !(mode === 'mine' && moments.length < 2);
    }
    function head() {
      $('dayDate').textContent = fmtDate(new Date());
      $('dayHead').textContent = mode === 'sample' ? t('day.head') : t('day.mine.head');
      canvas.setAttribute('aria-label', fill(t('day.aria'), moments.length));
      each(sec.querySelectorAll('[data-day]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-day') === mode ? 'true' : 'false'); });
    }
    function start(m) {
      mode = m || mode;
      moments = (mode === 'sample' ? SAMPLE : mine()).slice().sort(function (a, b) { return a.h - b.h; });
      span(); head(); list();
      felt = 0; t0 = performance.now();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
    }
    function layout() { W = Math.min(canvas.parentNode.clientWidth, 720); if (W < 60) { W = 0; return; } ctx = hidpi(canvas, W, H); }
    layout();
    each(sec.querySelectorAll('[data-day]'), function (b) { b.addEventListener('click', function () { buzz(6); start(b.getAttribute('data-day')); }); });
    $('dayReplay').addEventListener('click', function () { buzz(6); start(); });
    // 처음엔 예시의 하루 — 오늘 여기서 한 일이 셋 이상이면 내 하루부터.
    head();
    whenSeen(canvas, function () { if (!W) layout(); if (W) start(mine().length >= 3 ? 'mine' : 'sample'); }, .6);
    function still() { if (!raf && moments.length) { t0 = -1e9; draw(performance.now()); } }
    window.addEventListener('resize', function () { if (Math.min(canvas.parentNode.clientWidth, 720) === W) return; layout(); still(); });
    i18n.onChange(function () { head(); list(); still(); });
    onTheme(function () { list(); still(); });
    window.MalondoDay = { refresh: function () { if (mode === 'mine') start('mine'); } };
  })();

  // ── 언어마다의 스크린샷 ────────────────────────────────────────────────
  i18n.onChange(function () {
    each(document.querySelectorAll('img[data-shot]'), function (im) {
      var want = '/shots/' + i18n.lang + '/' + im.getAttribute('data-shot') + '.webp';
      if (im.getAttribute('src') !== want) im.setAttribute('src', want);
    });
  });

  // ── 손에 반응하는 것 — 폰이 살짝 기울고, 머리의 빛이 손을 따라온다 ──
  if (!reduce && window.matchMedia('(pointer: fine)').matches) {
    each(document.querySelectorAll('[data-tilt]'), function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        el.style.setProperty('--rx', (-y * 7).toFixed(2) + 'deg');
        el.style.setProperty('--ry', (x * 9).toFixed(2) + 'deg');
      });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
    var hero = document.querySelector('.hero'), blobs = hero && hero.querySelector('.blobs'), pending = false, mx = 0, my = 0;
    if (hero && blobs) {
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        mx = ((e.clientX - r.left) / r.width - .5) * 36; my = ((e.clientY - r.top) / r.height - .5) * 24;
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () { pending = false; blobs.style.setProperty('--mx', mx.toFixed(1) + 'px'); blobs.style.setProperty('--my', my.toFixed(1) + 'px'); });
      });
    }
  }
})();
