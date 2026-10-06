/* 첫 페이지의 꾸미는 다이어리 — 1.0.10 리뉴얼(2026-10-06).
 *
 * - 영상 폰(.reel)   : 실제 앱을 시뮬레이터에서 움직여 녹화한 것. 보일 때만 돈다.
 * - 스티커 벽        : 앱의 그림(StickerArt 를 그대로 구운 것)을 흩어 붙이고 저마다 효과.
 * - 효과 실험실      : 앱의 효과 이름 그대로 — 움직임 · 빛 · 날씨 · 종이, 갈래마다 하나씩 겹친다.
 * - 직접 꾸며 보기   : 종이 한 장에 스티커를 붙이고 끌고 효과를 입힌다. 이 브라우저에만 남는다.
 * - 꾸며 본 하루들   : 넘기기 단추.
 *
 * 움직임을 줄인 설정에서는 영상이 저절로 돌지 않고(눌러야 돈다) 효과는 멈춘 한 장이다.
 */
(function () {
  'use strict';
  var i18n = window.MalondoI18n;
  if (!i18n) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function t(k) { return i18n.t(k); }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function keep(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function recall(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  // ── 영상 폰 ────────────────────────────────────────────────────────────
  (function reels() {
    var vids = document.querySelectorAll('video.reel[data-reel]');
    if (!vids.length) return;
    function base(v) {
      var name = v.getAttribute('data-reel');
      return name.indexOf('tour-') === 0 ? '/video/tour-' + i18n.lang + '-' + name.slice(5) : '/video/' + i18n.lang + '/' + name;
    }
    function arm(v) {
      if (v.getAttribute('data-armed') === i18n.lang) return;
      v.setAttribute('data-armed', i18n.lang);
      v.poster = base(v) + '.webp';
      v.src = base(v) + '.mp4';
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          arm(v);
          if (!reduce && !v.hasAttribute('data-held')) v.play().catch(function () {});
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { threshold: 0.45 });
    each(vids, function (v) {
      v.muted = true;
      v.setAttribute('playsinline', '');
      io.observe(v);
      v.addEventListener('click', function () {
        arm(v);
        if (v.paused) { v.removeAttribute('data-held'); v.play().catch(function () {}); }
        else { v.setAttribute('data-held', ''); v.pause(); }
      });
    });
    i18n.onChange(function () {
      each(vids, function (v) {
        if (!v.getAttribute('data-armed') || v.getAttribute('data-armed') === i18n.lang) return;
        var playing = !v.paused;
        arm(v);
        if (playing) v.play().catch(function () {});
      });
    });
  })();

  // ── 효과 — 앱의 sticker_effects.dart 와 같은 이름 · 같은 갈래 ───────────────
  var GROUPS = ['motion', 'light', 'air', 'finish'];
  var EFFECTS = {
    motion: ['still', 'breathe', 'sway', 'float', 'beat', 'bounce', 'jelly', 'swing', 'drift', 'flutter', 'wind*', 'spin*'],
    light: ['glint', 'glow', 'candle', 'dusk', 'neon', 'aurora', 'sunbeam*', 'starlight*', 'prism*', 'holo*'],
    air: ['snow', 'petals', 'leaves', 'rain', 'steam', 'embers', 'hearts', 'notes', 'stardust', 'clouds', 'fireflies*', 'bubbles*', 'seeds*', 'meteor*', 'butterflies*', 'confetti*'],
    finish: ['vintage', 'faded', 'mono', 'vellum', 'lifted', 'outline', 'grain*', 'curl*', 'foil*', 'lightleak*']
  };
  var OVERLAY = { glint: 1, sunbeam: 1, dusk: 1, aurora: 1, prism: 1, holo: 1, foil: 1, lightleak: 1, grain: 1 };
  var FILTER_LIGHT = { glow: 1, candle: 1, neon: 1 };
  var CANVAS_LIGHT = { starlight: 1 };
  function plain(n) { return n.replace('*', ''); }
  function premium(n) { return n.indexOf('*') > 0; }

  // 스티커 한 장의 겹 — 움직임(.mo) › 빛 필터(.lt) › 종이 필터(.fi) › 그림 + 덧칠 둘.
  function build(src) {
    var mo = document.createElement('div'); mo.className = 'mo';
    var lt = document.createElement('div'); lt.className = 'lt';
    var fi = document.createElement('div'); fi.className = 'fi body';
    var img = document.createElement('img'); img.src = src; img.alt = ''; img.draggable = false;
    var o1 = document.createElement('i'); o1.className = 'ov';
    var o2 = document.createElement('i'); o2.className = 'ov';
    var mask = 'url("' + src + '")';
    o1.style.setProperty('--m', mask); o2.style.setProperty('--m', mask);
    fi.appendChild(img); fi.appendChild(o1); fi.appendChild(o2);
    lt.appendChild(fi); mo.appendChild(lt);
    return { root: mo, mo: mo, lt: lt, fi: fi, img: img, o1: o1, o2: o2 };
  }
  function paint(parts, fx) {
    var m = fx.motion && fx.motion !== 'still' ? 'fx-' + fx.motion : '';
    parts.mo.className = 'mo ' + m;
    var l = fx.light || '';
    parts.lt.className = 'lt' + (FILTER_LIGHT[l] ? ' fx-' + l : '');
    var f = fx.finish || '';
    parts.fi.className = 'fi body' + (f && !OVERLAY[f] ? ' fx-' + f : '');
    parts.o1.className = 'ov' + (OVERLAY[l] ? ' on ov-' + l : '');
    parts.o2.className = 'ov' + (OVERLAY[f] ? ' on ov-' + f : '') + (f === 'curl' ? '' : '');
    if (f === 'curl') parts.fi.className += ' fx-curl';
  }

  // ── 날씨 · 별빛 — 캔버스 하나에 모든 스티커의 알갱이를 ─────────────────────
  function Air(canvas, pad) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1, raf = 0, on = false, last = 0;
    var emitters = []; // {get: fn → {x,y,s,kind}, ps: []}
    function size() {
      var r = pad.getBoundingClientRect();
      if (Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 1) return;
      W = r.width; H = r.height; dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    var COLORS = { petals: ['#F4B7C5', '#F7C9D3', '#EFA2B6'], leaves: ['#D9894A', '#C46A3A', '#E2A55B', '#B5803C'], confetti: ['#F08AA0', '#F4C55E', '#7DBE7A', '#6FA8DC', '#C79BE0', '#F2A65E'] };
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function spawn(kind, b) {
      var s = b.s, p = { k: kind, t: 0, life: 1 };
      // 알갱이는 스티커 크기를 따라 자란다 — 큰 실험실 종이에서도 눈에 띄게.
      var k = clamp(s / 64, 1, 2.6);
      switch (kind) {
        case 'snow': p.x = b.x + rnd(-.75, .75) * s; p.y = b.y - s * .75 + rnd(-10, 0); p.vy = rnd(18, 32); p.vx = rnd(-6, 6); p.r = rnd(1.6, 3.2); p.life = rnd(2.2, 3.4); break;
        case 'petals': p.x = b.x + rnd(-.8, .4) * s; p.y = b.y - s * .7; p.vy = rnd(20, 34); p.vx = rnd(8, 22); p.r = rnd(3, 5); p.a = rnd(0, 6); p.va = rnd(-2, 2); p.c = COLORS.petals[(Math.random() * 3) | 0]; p.life = rnd(2.4, 3.4); break;
        case 'leaves': p.x = b.x + rnd(-.7, .7) * s; p.y = b.y - s * .7; p.vy = rnd(22, 36); p.vx = rnd(-10, 10); p.r = rnd(4, 6.5); p.a = rnd(0, 6); p.va = rnd(-2.4, 2.4); p.c = COLORS.leaves[(Math.random() * 4) | 0]; p.life = rnd(2.4, 3.2); break;
        case 'rain': p.x = b.x + rnd(-.8, .8) * s; p.y = b.y - s * .8; p.vy = rnd(150, 210); p.vx = -16; p.life = rnd(.7, 1); break;
        case 'steam': p.x = b.x + rnd(-.18, .18) * s; p.y = b.y - s * .32; p.vy = rnd(-18, -12); p.vx = rnd(-4, 4); p.r = rnd(4, 7); p.life = rnd(2.2, 3); break;
        case 'embers': p.x = b.x + rnd(-.4, .4) * s; p.y = b.y + rnd(-.1, .3) * s; p.vy = rnd(-36, -22); p.vx = rnd(-8, 8); p.r = rnd(1.1, 2.2); p.life = rnd(1.4, 2.4); break;
        case 'hearts': p.x = b.x + rnd(-.45, .45) * s; p.y = b.y - s * .2; p.vy = rnd(-30, -20); p.vx = rnd(-6, 6); p.r = rnd(3.5, 6); p.life = rnd(1.8, 2.6); break;
        case 'notes': p.x = b.x + rnd(-.5, .5) * s; p.y = b.y - s * .2; p.vy = rnd(-24, -16); p.vx = rnd(-8, 8); p.r = rnd(11, 15); p.a = rnd(-.3, .3); p.life = rnd(2, 2.8); p.g = Math.random() < .5 ? '♪' : '♫'; break;
        case 'stardust': p.a = rnd(0, 6.28); p.rr = s * rnd(.5, .78); p.va = rnd(.5, 1.1) * (Math.random() < .5 ? -1 : 1); p.r = rnd(.8, 1.8); p.life = rnd(1.6, 2.6); p.cx = b.x; p.cy = b.y; break;
        case 'clouds': p.y = b.y + rnd(-.7, -.1) * s; p.x = b.x - s * 1.1; p.vx = rnd(10, 16); p.r = rnd(.16, .24) * s / k; p.life = rnd(4, 5.5); break;
        case 'fireflies': p.x = b.x + rnd(-.8, .8) * s; p.y = b.y + rnd(-.8, .6) * s; p.vx = rnd(-8, 8); p.vy = rnd(-8, 8); p.r = rnd(1.6, 2.6); p.ph = rnd(0, 6); p.life = rnd(3, 4.5); break;
        case 'bubbles': p.x = b.x + rnd(-.5, .5) * s; p.y = b.y + s * .3; p.vy = rnd(-26, -16); p.vx = rnd(-5, 5); p.r = rnd(4, 9); p.life = rnd(2.2, 3.2); break;
        case 'seeds': p.x = b.x + rnd(-.2, .2) * s; p.y = b.y - s * .1; p.vy = rnd(-16, -8); p.vx = rnd(18, 30); p.r = rnd(4, 6); p.life = rnd(3, 4); break;
        case 'meteor': p.x = b.x + s * rnd(.2, .9); p.y = b.y - s * rnd(.7, 1); p.vx = -150; p.vy = 90; p.life = .9; break;
        case 'butterflies': p.a = rnd(0, 6.28); p.rr = s * rnd(.6, .8); p.va = rnd(.6, .9); p.cx = b.x; p.cy = b.y; p.r = rnd(5, 7); p.life = 6; p.ph = rnd(0, 6); break;
        case 'confetti': p.x = b.x + rnd(-.9, .9) * s; p.y = b.y - s * .9; p.vy = rnd(40, 70); p.vx = rnd(-12, 12); p.w = rnd(3, 6); p.h = rnd(5, 9); p.a = rnd(0, 6); p.va = rnd(-5, 5); p.c = COLORS.confetti[(Math.random() * 6) | 0]; p.life = rnd(1.6, 2.4); break;
        case 'starlight': p.x = b.x + rnd(-.7, .7) * s; p.y = b.y + rnd(-.7, .7) * s; p.r = rnd(1.2, 2.4); p.life = rnd(1.2, 2); break;
      }
      if (p.r) p.r *= k;
      if (p.w) { p.w *= k; p.h *= k; }
      if (p.vy) p.vy *= Math.sqrt(k);
      return p;
    }
    var RATE = { snow: 7, petals: 3.2, leaves: 2.4, rain: 16, steam: 4, embers: 6, hearts: 2.6, notes: 1.6, stardust: 7, clouds: .4, fireflies: 2.2, bubbles: 2.4, seeds: 1.4, meteor: .45, butterflies: .34, confetti: 9, starlight: 6 };
    var CAP = { butterflies: 2, clouds: 3 };
    function heart(c, x, y, r) {
      c.beginPath(); c.moveTo(x, y + r * .35);
      c.bezierCurveTo(x - r * 1.2, y - r * .5, x - r * .45, y - r * 1.25, x, y - r * .45);
      c.bezierCurveTo(x + r * .45, y - r * 1.25, x + r * 1.2, y - r * .5, x, y + r * .35);
      c.fill();
    }
    function draw(p, a) {
      var c = ctx;
      c.globalAlpha = a;
      switch (p.k) {
        case 'snow': c.fillStyle = 'rgba(255,255,255,.95)'; c.strokeStyle = 'rgba(120,140,170,.55)'; c.lineWidth = .8; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.28); c.fill(); c.stroke(); break;
        case 'petals': c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.c; c.beginPath(); c.ellipse(0, 0, p.r, p.r * .55, 0, 0, 6.28); c.fill(); c.restore(); break;
        case 'leaves': c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.c; c.beginPath(); c.moveTo(-p.r, 0); c.quadraticCurveTo(0, -p.r * .7, p.r, 0); c.quadraticCurveTo(0, p.r * .7, -p.r, 0); c.fill(); c.restore(); break;
        case 'rain': c.strokeStyle = 'rgba(110,150,200,.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 2.5, p.y - 10); c.stroke(); break;
        case 'steam': c.fillStyle = 'rgba(150,135,120,.22)'; c.beginPath(); c.arc(p.x, p.y, p.r * (1 + p.t * .6), 0, 6.28); c.fill(); break;
        case 'embers': c.fillStyle = 'rgba(255,' + (140 + ((p.t * 300) % 60) | 0) + ',70,1)'; c.shadowColor = 'rgba(255,150,60,.9)'; c.shadowBlur = 6; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.28); c.fill(); c.shadowBlur = 0; break;
        case 'hearts': c.fillStyle = '#F08AA0'; heart(c, p.x, p.y, p.r); break;
        case 'notes': c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = '#8E7CC3'; c.font = p.r + 'px serif'; c.fillText(p.g, 0, 0); c.restore(); break;
        case 'stardust': var sx = p.cx + Math.cos(p.a) * p.rr, sy = p.cy + Math.sin(p.a) * p.rr * .8; c.fillStyle = '#F4C55E'; c.shadowColor = 'rgba(255,220,120,.9)'; c.shadowBlur = 5; c.beginPath(); c.arc(sx, sy, p.r, 0, 6.28); c.fill(); c.shadowBlur = 0; break;
        case 'clouds': c.fillStyle = 'rgba(255,255,255,.85)'; c.strokeStyle = 'rgba(150,170,200,.35)'; c.lineWidth = 1; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.28); c.arc(p.x + p.r * .9, p.y + p.r * .15, p.r * .8, 0, 6.28); c.arc(p.x - p.r * .85, p.y + p.r * .2, p.r * .7, 0, 6.28); c.fill(); break;
        case 'fireflies': var fa = .5 + .5 * Math.sin(p.ph + p.t * 4); c.fillStyle = 'rgba(214,240,120,' + (.35 + .65 * fa) + ')'; c.shadowColor = 'rgba(220,255,120,.95)'; c.shadowBlur = 10; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.28); c.fill(); c.shadowBlur = 0; break;
        case 'bubbles': c.strokeStyle = 'rgba(140,170,210,.75)'; c.lineWidth = 1; c.fillStyle = 'rgba(200,230,255,.18)'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.28); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(p.x - p.r * .35, p.y - p.r * .35, p.r * .22, 0, 6.28); c.fill(); break;
        case 'seeds': c.strokeStyle = 'rgba(120,110,100,.7)'; c.lineWidth = .8; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.r * .6, p.y + p.r * 1.2); c.stroke(); for (var k = 0; k < 7; k++) { var ang = -Math.PI + k * Math.PI / 6; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + Math.cos(ang) * p.r, p.y + Math.sin(ang) * p.r); c.stroke(); } break;
        case 'meteor': var g = c.createLinearGradient(p.x, p.y, p.x + 40, p.y - 24); g.addColorStop(0, 'rgba(255,250,220,.95)'); g.addColorStop(1, 'rgba(255,250,220,0)'); c.strokeStyle = g; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 40, p.y - 24); c.stroke(); break;
        case 'butterflies': var bx = p.cx + Math.cos(p.a) * p.rr, by = p.cy + Math.sin(p.a * 1.3) * p.rr * .6, fl = .35 + .65 * Math.abs(Math.sin(p.ph + p.t * 10)); c.save(); c.translate(bx, by); c.fillStyle = '#8FB4E8'; c.strokeStyle = '#4C6A96'; c.lineWidth = .8; c.beginPath(); c.ellipse(-p.r * .55 * fl, 0, p.r * .6 * fl, p.r * .8, -.4, 0, 6.28); c.ellipse(p.r * .55 * fl, 0, p.r * .6 * fl, p.r * .8, .4, 0, 6.28); c.fill(); c.stroke(); c.fillStyle = '#4C6A96'; c.fillRect(-.6, -p.r * .6, 1.2, p.r * 1.2); c.restore(); break;
        case 'confetti': c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.t * 6)), p.w, p.h * Math.abs(Math.cos(p.t * 6)) + .5); c.restore(); break;
        case 'starlight': var sa = Math.sin(Math.PI * clamp(p.t / p.life, 0, 1)); c.fillStyle = 'rgba(255,246,214,1)'; c.shadowColor = 'rgba(255,230,160,.95)'; c.shadowBlur = 8; c.beginPath(); c.arc(p.x, p.y, p.r * sa, 0, 6.28); c.fill(); c.shadowBlur = 0; break;
      }
      c.globalAlpha = 1;
    }
    function step(dt) {
      emitters.forEach(function (em) {
        var b = em.get();
        if (!b) return;
        em.kinds.forEach(function (kind) {
          em.acc[kind] = (em.acc[kind] || 0) + dt * (RATE[kind] || 2);
          var count = em.ps.filter(function (p) { return p.k === kind; }).length;
          while (em.acc[kind] >= 1) {
            em.acc[kind] -= 1;
            if (CAP[kind] && count >= CAP[kind]) continue;
            em.ps.push(spawn(kind, b)); count++;
          }
        });
        em.ps = em.ps.filter(function (p) { return p.t < p.life && em.kinds.indexOf(p.k) >= 0; });
        em.ps.forEach(function (p) {
          p.t += dt;
          if (p.k === 'stardust' || p.k === 'butterflies') { p.a += p.va * dt; p.cx = b.x; p.cy = b.y; }
          else if (p.k === 'fireflies') { p.vx += (Math.random() - .5) * 30 * dt; p.vy += (Math.random() - .5) * 30 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
          else if (p.k !== 'starlight') {
            p.x += (p.vx || 0) * dt + (p.k === 'snow' || p.k === 'petals' || p.k === 'leaves' || p.k === 'notes' ? Math.sin(p.t * 2.2) * .35 : 0);
            p.y += (p.vy || 0) * dt;
            if (p.va) p.a += p.va * dt;
          }
        });
      });
    }
    function frame(now) {
      raf = 0;
      if (!on) return;
      size();
      var dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
      step(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      emitters.forEach(function (em) {
        em.ps.forEach(function (p) {
          var u = p.t / p.life, a = u < .15 ? u / .15 : u > .75 ? (1 - u) / .25 : 1;
          draw(p, clamp(a, 0, 1));
        });
      });
      if (emitters.some(function (em) { return em.kinds.length || em.ps.length; })) raf = requestAnimationFrame(frame);
      else { last = 0; }
    }
    function kick() { if (on && !raf && !reduce) raf = requestAnimationFrame(frame); }
    new IntersectionObserver(function (es) { es.forEach(function (e) { on = e.isIntersecting; if (on) kick(); }); }, { threshold: 0.05 }).observe(pad);
    return {
      set: function (id, get, kinds) {
        var em = emitters.filter(function (x) { return x.id === id; })[0];
        if (!em) { em = { id: id, get: get, ps: [], acc: {}, kinds: [] }; emitters.push(em); }
        em.get = get; em.kinds = kinds.filter(Boolean);
        kick();
      },
      drop: function (id) { emitters = emitters.filter(function (x) { return x.id !== id; }); kick(); }
    };
  }

  // ── 실험실 · 직접 꾸며 보기 ──────────────────────────────────────────────
  var TRAY_FX = ['deco-heart', 'deco-flower', 'deco-star', 'deco-cloud', 'deco-moon', 'deco-butterfly', 'deco-coffee', 'desk-globe', 'desk-candle', 'deco-letter'];
  var TRAY_PLAY = ['deco-heart', 'deco-flower-10', 'deco-star', 'deco-sparkle', 'deco-cloud', 'deco-moon', 'deco-sun', 'deco-rainbow', 'deco-leaf', 'deco-clover', 'deco-butterfly', 'deco-bow', 'deco-coffee', 'deco-letter', 'deco-note', 'deco-paw', 'deco-check', 'deco-ring', 'arrow-curve', 'arrow-heart', 'tape-hanji', 'tape-warmStripe', 'tape-calmDot', 'desk-globe', 'desk-candle', 'desk-jar', 'tone-cup', 'card-dusk', 'card-stars', 'card-lanterns'];
  var DEFAULT_FX = { // 앱의 처음 효과(effect_profiles.dart)에 가깝게
    'deco-heart': { motion: 'beat' }, 'deco-flower': { motion: 'sway', air: 'petals' }, 'deco-flower-10': { motion: 'sway' }, 'deco-star': { light: 'glint' },
    'deco-sparkle': { light: 'glow' }, 'deco-cloud': { motion: 'float' }, 'deco-moon': { light: 'glow' }, 'deco-butterfly': { motion: 'flutter' },
    'deco-coffee': { air: 'steam' }, 'desk-globe': { air: 'snow' }, 'desk-candle': { light: 'candle', air: 'embers' }, 'deco-letter': { motion: 'float' },
    'deco-sun': { motion: 'breathe' }, 'deco-rainbow': { motion: 'sway' }, 'deco-leaf': { motion: 'sway', air: 'leaves' }, 'deco-clover': { motion: 'breathe' },
    'deco-bow': { motion: 'swing' }, 'deco-note': { air: 'notes' }, 'deco-paw': { motion: 'bounce' }, 'deco-check': {}, 'deco-ring': {},
    'arrow-curve': {}, 'arrow-heart': { motion: 'beat' }, 'tape-hanji': {}, 'tape-warmStripe': {}, 'tape-calmDot': {}, 'desk-jar': { light: 'glint' },
    'tone-cup': { air: 'steam' }, 'card-dusk': { light: 'dusk' }, 'card-stars': { light: 'starlight' }, 'card-lanterns': { air: 'embers' }
  };
  function src(name) { return '/stickers/' + name + '.webp'; }
  function wide(name) { return /^(tape|arrow|card)-/.test(name); }

  function Lab(root) {
    var mode = root.getAttribute('data-mode');
    var pad = root.querySelector('[data-pad]');
    var canvas = pad.querySelector('canvas.air');
    var tray = root.querySelector('[data-tray]');
    var tabs = root.querySelector('[data-tabs]');
    var chips = root.querySelector('[data-chips]');
    var now = root.querySelector('[data-now]');
    var air = Air(canvas, pad);
    var group = 'motion';
    var items = [];   // {id, name, x, y, w, r, fx, el, parts}
    var sel = null;
    var KEY = 'malondo.play';
    var seq = 1;

    function boxOf(it) {
      var r = pad.getBoundingClientRect(), b = it.el.getBoundingClientRect();
      if (!r.width) return null;
      return { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2, s: Math.max(b.width, b.height) * .62 };
    }
    function refresh(it) {
      paint(it.parts, it.fx);
      var kinds = [];
      if (it.fx.air) kinds.push(it.fx.air);
      if (CANVAS_LIGHT[it.fx.light]) kinds.push(it.fx.light);
      air.set(it.id, function () { return boxOf(it); }, kinds);
    }
    function place(it) {
      it.el.style.setProperty('--x', it.x + '%');
      it.el.style.setProperty('--y', it.y + '%');
      it.el.style.setProperty('--w', it.w + '%');
      it.el.style.setProperty('--r', it.r + 'deg');
    }
    function add(name, at, quiet) {
      var it = at || { id: 'p' + (seq++), name: name, x: 30 + Math.random() * 40, y: 30 + Math.random() * 40, w: wide(name) ? 34 : 20, r: Math.round((Math.random() - .5) * 18), fx: JSON.parse(JSON.stringify(DEFAULT_FX[name] || {})) };
      var el = document.createElement('div');
      el.className = 'placed';
      el.setAttribute('data-id', it.id);
      var parts = build(src(it.name));
      el.appendChild(parts.root);
      pad.appendChild(el);
      it.el = el; it.parts = parts;
      place(it);
      items.push(it);
      grab(it);
      refresh(it);
      if (!quiet) select(it);
      save();
      return it;
    }
    function select(it) {
      sel = it;
      items.forEach(function (x) { x.el.classList.toggle('sel', x === it && mode === 'play'); });
      renderChips();
      tools();
    }
    function save() {
      if (mode !== 'play') return;
      keep(KEY, items.map(function (it) { return { id: it.id, name: it.name, x: +it.x.toFixed(1), y: +it.y.toFixed(1), w: it.w, r: it.r, fx: it.fx }; }));
    }
    function remove(it) {
      if (!it) return;
      air.drop(it.id);
      it.el.remove();
      items = items.filter(function (x) { return x !== it; });
      select(items[items.length - 1] || null);
      save();
    }
    function grab(it) {
      if (mode !== 'play') return;
      var start = null;
      it.el.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        select(it);
        it.el.setPointerCapture(e.pointerId);
        var r = pad.getBoundingClientRect();
        start = { px: e.clientX, py: e.clientY, x: it.x, y: it.y, w: r.width, h: r.height };
        items.forEach(function (x) { x.el.style.zIndex = x === it ? 4 : 2; });
      });
      it.el.addEventListener('pointermove', function (e) {
        if (!start) return;
        it.x = clamp(start.x + (e.clientX - start.px) / start.w * 100, 4, 96);
        it.y = clamp(start.y + (e.clientY - start.py) / start.h * 100, 4, 96);
        place(it);
      });
      function end() { if (start) { start = null; save(); } }
      it.el.addEventListener('pointerup', end);
      it.el.addEventListener('pointercancel', end);
    }
    function label(name) { return t('fx.e.' + plain(name)); }
    function renderTabs() {
      tabs.textContent = '';
      GROUPS.forEach(function (g) {
        var b = document.createElement('button');
        b.type = 'button'; b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', g === group ? 'true' : 'false');
        b.textContent = t('fx.g.' + g);
        b.addEventListener('click', function () { group = g; renderTabs(); renderChips(); });
        tabs.appendChild(b);
      });
    }
    function renderChips() {
      chips.textContent = '';
      var it = sel;
      EFFECTS[group].forEach(function (name) {
        var n = plain(name);
        var b = document.createElement('button');
        b.type = 'button';
        var cur = it ? (it.fx[group] || (group === 'motion' ? 'still' : '')) : '';
        b.setAttribute('aria-pressed', cur === n ? 'true' : 'false');
        b.textContent = label(name);
        if (premium(name)) { var s = document.createElement('sup'); s.textContent = '†'; b.appendChild(s); }
        b.disabled = !it;
        b.addEventListener('click', function () {
          if (!sel) return;
          if (sel.fx[group] === n && group !== 'motion') delete sel.fx[group];
          else sel.fx[group] = n;
          if (group === 'motion' && n === 'still') delete sel.fx.motion;
          refresh(sel); renderChips(); save();
        });
        chips.appendChild(b);
      });
      if (now) {
        if (!it) { now.textContent = mode === 'play' ? '' : ''; return; }
        var parts = GROUPS.map(function (g) { return it.fx[g] ? t('fx.e.' + it.fx[g]) : null; }).filter(Boolean);
        now.textContent = '';
        var b2 = document.createElement('b'); b2.textContent = t('fx.now');
        now.appendChild(b2);
        now.appendChild(document.createTextNode(' · ' + (parts.length ? parts.join(' · ') : t('fx.e.still'))));
      }
    }
    function tools() {
      each(root.querySelectorAll('[data-act]'), function (b) {
        var act = b.getAttribute('data-act');
        b.disabled = act === 'clear' ? !items.length : !sel;
      });
    }
    function renderTray() {
      tray.textContent = '';
      (mode === 'play' ? TRAY_PLAY : TRAY_FX).forEach(function (name) {
        var b = document.createElement('button');
        b.type = 'button';
        var im = document.createElement('img'); im.src = src(name); im.alt = ''; im.loading = 'lazy';
        b.appendChild(im);
        b.setAttribute('aria-label', name.replace(/^(deco|desk|tone|card|tape|arrow)-/, ''));
        b.addEventListener('click', function () {
          if (mode === 'fx') {
            var keepFx = sel ? sel.fx : {};
            remove(sel);
            var it = add(name, { id: 'fx' + (seq++), name: name, x: 50, y: 50, w: wide(name) ? 66 : 40, r: 0, fx: Object.keys(keepFx).length ? keepFx : JSON.parse(JSON.stringify(DEFAULT_FX[name] || {})) });
            select(it);
          } else {
            add(name);
          }
        });
        tray.appendChild(b);
      });
    }
    each(root.querySelectorAll('[data-act]'), function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-act');
        if (act === 'clear') { items.slice().forEach(remove); return; }
        if (!sel) return;
        if (act === 'bigger') sel.w = clamp(sel.w * 1.18, 8, 80);
        if (act === 'smaller') sel.w = clamp(sel.w / 1.18, 8, 80);
        if (act === 'turn') sel.r = ((sel.r + 15 + 180) % 360) - 180;
        if (act === 'remove') { remove(sel); return; }
        place(sel); save();
      });
    });
    pad.addEventListener('pointerdown', function (e) { if (e.target === pad || e.target === canvas) select(null); });

    // 처음 모습.
    renderTabs(); renderTray();
    if (mode === 'fx') {
      var first = add('deco-heart', { id: 'fx0', name: 'deco-heart', x: 50, y: 50, w: 40, r: 0, fx: { motion: 'beat', light: 'glow', air: 'hearts' } }, true);
      select(first);
    } else {
      var saved = recall(KEY);
      var start = Array.isArray(saved) && saved.length ? saved : [
        { name: 'tape-hanji', x: 26, y: 13, w: 36, r: -8, fx: {} },
        { name: 'deco-flower-10', x: 72, y: 26, w: 24, r: 8, fx: { motion: 'sway', air: 'petals' } },
        { name: 'deco-heart', x: 30, y: 46, w: 18, r: -10, fx: { motion: 'beat' } },
        { name: 'desk-globe', x: 70, y: 64, w: 26, r: 4, fx: { air: 'snow' } },
        { name: 'deco-star', x: 24, y: 78, w: 16, r: -14, fx: { light: 'glint', air: 'stardust' } }
      ];
      start.forEach(function (s) { s.id = s.id || 'p' + (seq++); add(s.name, s, true); });
      // 다음 이름은 남아 있는 이름의 가장 큰 수 다음부터 — 되살린 것과 겹치지 않게.
      seq = items.reduce(function (m, it) { var n = parseInt(String(it.id).slice(1), 10); return isFinite(n) && n >= m ? n + 1 : m; }, items.length + 1);
      select(null);
      var d = root.querySelector('[data-date]');
      if (d) {
        var paintDate = function () {
          var dt = new Date();
          d.textContent = dt.toLocaleDateString(i18n.lang === 'ko' ? 'ko-KR' : i18n.lang === 'ja' ? 'ja-JP' : i18n.lang === 'es' ? 'es-ES' : 'en-US', { month: 'long', day: 'numeric', weekday: 'short' });
        };
        paintDate(); i18n.onChange(paintDate);
      }
    }
    i18n.onChange(function () { renderTabs(); renderChips(); });
    tools();
  }
  each(document.querySelectorAll('.studio[data-mode]'), function (root) {
    try { Lab(root); } catch (e) { if (window.console) console.warn(e); }
  });

  // ── 스티커 벽 — 서랍의 그림을 한눈에. 저마다 처음 효과로 산다. ──────────────────
  (function wall() {
    var box = $('wall');
    if (!box) return;
    var names = ['deco-heart', 'deco-star', 'deco-sparkle', 'deco-flower', 'deco-leaf', 'deco-clover', 'deco-butterfly', 'deco-cloud', 'deco-sun', 'deco-moon', 'deco-rainbow', 'deco-bow',
      'deco-bubble', 'deco-arrow', 'deco-wave', 'deco-ring', 'deco-check', 'deco-bang', 'deco-note', 'deco-coffee', 'deco-letter', 'deco-clip', 'deco-pin', 'deco-paw',
      'arrow-curve', 'arrow-wave', 'arrow-loop', 'arrow-heart', 'arrow-swirl', 'arrow-bounce', 'arrow-uturn', 'arrow-around',
      'tape-hanji', 'tape-warmStripe', 'tape-calmDot', 'tape-ramp', 'tape-livelyStripe', 'tape-highlightCalm',
      'desk-globe', 'desk-candle', 'desk-jar', 'tone-cup', 'tone-weather', 'tone-orb', 'card-dusk', 'card-stars', 'card-lanterns', 'card-window'];
    var motion = { 'deco-heart': 'beat', 'deco-flower': 'sway', 'deco-butterfly': 'flutter', 'deco-cloud': 'float', 'deco-sun': 'breathe', 'deco-bow': 'swing', 'deco-note': 'bounce', 'deco-leaf': 'sway', 'deco-paw': 'bounce', 'deco-rainbow': 'sway', 'deco-letter': 'float', 'desk-globe': 'float', 'arrow-heart': 'beat', 'deco-clover': 'breathe', 'deco-coffee': 'float' };
    var light = { 'deco-star': 'glow', 'deco-sparkle': 'glow', 'deco-moon': 'glow', 'desk-candle': 'candle', 'card-stars': 'glow', 'tone-orb': 'glow' };
    names.forEach(function (n, k) {
      var im = document.createElement('img');
      im.src = src(n); im.alt = ''; im.loading = 'lazy'; im.draggable = false;
      var cls = [];
      if (motion[n]) cls.push('fx-' + motion[n]);
      if (light[n]) cls.push('fx-' + light[n]);
      if (wide(n)) cls.push('wide2');
      im.className = cls.join(' ');
      im.style.rotate = (((k * 37) % 11) - 5) + 'deg';
      im.style.animationDelay = (-(k * .37) % 3).toFixed(2) + 's';
      box.appendChild(im);
    });
  })();

  // ── 넘겨 보는 앨범 — 단추 · 화살표 키 · 마우스로 끌기 ────────────────────────────
  (function albums() {
    function go(a, dir) {
      var f = a.querySelector('figure');
      if (!f) return;
      a.scrollBy({ left: dir * (f.offsetWidth + 32), behavior: reduce ? 'auto' : 'smooth' });
    }
    each(document.querySelectorAll('[data-album]'), function (b) {
      b.addEventListener('click', function () {
        var a = $(b.getAttribute('data-album'));
        if (a) go(a, +b.getAttribute('data-dir'));
      });
    });
    each(document.querySelectorAll('.album'), function (a) {
      a.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { go(a, 1); e.preventDefault(); }
        if (e.key === 'ArrowLeft') { go(a, -1); e.preventDefault(); }
      });
      var down = null;
      a.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse') return;
        down = { x: e.clientX, l: a.scrollLeft };
        a.style.scrollSnapType = 'none';
        a.setPointerCapture(e.pointerId);
      });
      a.addEventListener('pointermove', function (e) { if (down) a.scrollLeft = down.l - (e.clientX - down.x); });
      function up() { if (!down) return; down = null; a.style.scrollSnapType = ''; }
      a.addEventListener('pointerup', up);
      a.addEventListener('pointercancel', up);
      each(a.querySelectorAll('img'), function (im) { im.draggable = false; });
    });
  })();
})();
