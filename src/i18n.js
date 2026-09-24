/* 세 페이지(index · privacy · support)가 함께 쓰는 언어·단위 장치.
 *
 * - 표는 페이지마다 <script type="application/json" id="i18n"> 에 실려 온다.
 *   build.py 가 그 자리에 네 언어를 통째로 넣는다.
 * - 첫 페이지는 언어마다 제 주소가 있다 — / · /en/ · /ja/ · /es/ (<html data-paged>).
 *   그 주소의 언어로 구워져 있어서 검색 엔진도 네 언어를 제 주소로 읽는다. 그래서
 *   첫 페이지는 **기기 언어로 글을 바꿔 달지 않는다** — 구글의 렌더러는 기기 언어가
 *   en-US 라, 바꿔 달면 한국어 주소에서 영어를 읽어 간다. 기기 언어가 다르면 아래에
 *   한 줄로 권하기만 하고(#suggest), 사람이 고르면 그 자리에서 바꾸고 주소도 옮긴다.
 * - privacy · support 는 주소가 하나다. ?lang= → 고른 언어 → 기기 언어 순으로 고른다
 *   (앱 안의 링크가 언어 없이 이 주소를 연다).
 * - 고른 언어는 localStorage 에 남는다. 같은 출처라 **페이지를 옮겨도 따라온다** —
 *   홈에서 English 를 고르고 처리방침으로 가면 처리방침도 영어로 선다.
 * - 온도 단위 단추와 언어 고르개는 없을 수도 있다(support). 없으면 건너뛴다.
 * - 값이 바뀔 때 다시 그려야 하는 것(홈의 다이얼)은 onChange 로 건다.
 */
(function () {
  var LANGS = ['ko', 'en', 'ja', 'es'];
  // 언어마다의 첫 페이지 주소 — build.py 의 HOME 과 같다.
  var HOME = { ko: '/', en: '/en/', ja: '/ja/', es: '/es/' };
  var dict;
  try {
    dict = JSON.parse(document.getElementById('i18n').textContent);
  } catch (e) {
    return; // 표가 없으면 HTML 에 구워진 글이 그대로 선다.
  }

  var root = document.documentElement;
  var paged = root.hasAttribute('data-paged');
  var lang = 'ko', unit = 'c', hooks = [];

  function keep(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function recall(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // 넷 중 하나인지 보고 받는다 — 표에 없는 이름이 들어오면 null.
  function pick(v) { return (v && LANGS.indexOf(v) >= 0) ? v : null; }

  // 기기가 고른 언어 가운데 이 사이트가 아는 첫 것. 하나도 모르면 null.
  function deviceWants() {
    var list = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      var t = pick(String(list[i]).slice(0, 2).toLowerCase());
      if (t) return t;
    }
    return null;
  }
  function deviceLang() { return deviceWants() || 'ko'; }

  // 일상에서 화씨를 쓰는 여덟 나라 — lib/temperature_unit.dart 와 같은 목록
  function deviceUnit() {
    var list = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      var m = /[-_]([A-Za-z]{2})\b/.exec(String(list[i]));
      if (m && 'US BS BZ KY FM LR MH PW'.split(' ').indexOf(m[1].toUpperCase()) >= 0) return 'f';
    }
    return 'c';
  }

  function t(k) {
    var d = dict[lang] || dict.ko;
    if (d && d[k] != null) return d[k];
    return (dict.ko && dict.ko[k]) || '';
  }

  function fmtC(c) { return unit === 'f' ? (c * 9 / 5 + 32).toFixed(1) : c.toFixed(1); }
  function sym() { return unit === 'f' ? '°F' : '℃'; }
  // 차이는 절대 온도가 아니다 — 32 를 더하지 않는다.
  // 자릿수는 글에 적은 대로 지킨다 — {d:0.45} 는 0.45℃ · 0.81°F. 한 자리로 깎으면
  // 판정 띠 ±0.45℃ 가 「0.5℃」로 섰다.
  function places(s) { var i = String(s).indexOf('.'); return i < 0 ? 1 : Math.max(1, String(s).length - i - 1); }
  function fmtD(d, p) { return (unit === 'f' ? d * 9 / 5 : d).toFixed(p == null ? 1 : p) + sym(); }

  function expand(s) {
    return String(s)
      .replace(/\{c:([\d.]+)\}/g, function (_, c) {
        return '<span class="tv" data-c="' + c + '">' + fmtC(+c) + sym() + '</span>';
      })
      .replace(/\{d:([\d.]+)\}/g, function (_, d) {
        return '<span class="tv" data-d="' + d + '">' + fmtD(+d, places(d)) + '</span>';
      });
  }

  function strip(s) { return s.replace(/<[^>]+>/g, ''); }

  function paintUnits() {
    Array.prototype.forEach.call(document.querySelectorAll('.tv[data-c]'), function (el) {
      var v = fmtC(+el.getAttribute('data-c'));
      if (el.classList.contains('bare')) el.textContent = v;
      else if (el.querySelector('small')) el.innerHTML = v + '<small>' + sym() + '</small>';
      else el.textContent = v + sym();
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tv[data-d]'), function (el) {
      var d = el.getAttribute('data-d');
      el.textContent = fmtD(+d, places(d));
    });
    Array.prototype.forEach.call(document.querySelectorAll('.unit-h'), function (el) {
      el.textContent = sym();
    });
    var b = document.getElementById('unit');
    if (b) b.textContent = unit === 'f' ? '°F' : '℃';
    Array.prototype.forEach.call(document.querySelectorAll('[data-unit]'), function (x) {
      x.classList.toggle('on', x.getAttribute('data-unit') === unit);
    });
    fire();
  }

  // 다른 페이지로 가는 길에 지금 언어를 싣는다. 받는 쪽(privacy · support)이 스스로 고를
  // 언어와 같으면 주소를 깨끗이 둔다. 첫 페이지로 돌아가는 길(data-home)은 그 언어의 주소로.
  function relink() {
    var own = pick(recall('malondo.lang')) || deviceLang();
    Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function (a) {
      var m = /^\/(privacy|support)\.html(?:\?lang=[a-z]{2})?(#.*)?$/.exec(a.getAttribute('href'));
      if (m) a.setAttribute('href', '/' + m[1] + '.html' + (lang === own ? '' : '?lang=' + lang) + (m[2] || ''));
      else if (a.hasAttribute('data-home')) a.setAttribute('href', HOME[lang]);
    });
  }

  // 첫 페이지의 주소를 보는 언어에 맞춘다 — 옮겨 붙이는 주소가 보는 언어와 같게. 다른 쿼리는 둔다.
  function syncUrl() {
    if (!paged || !window.history || !history.replaceState) return;
    var q = new URLSearchParams(location.search);
    q.delete('lang');
    var s = q.toString();
    var want = HOME[lang] + (s ? '?' + s : '') + location.hash;
    if (want !== location.pathname + location.search + location.hash) {
      try { history.replaceState(history.state, '', want); } catch (e) {}
    }
  }

  function apply() {
    root.lang = lang;
    Array.prototype.forEach.call(document.querySelectorAll('[data-i]'), function (el) {
      var s = expand(t(el.getAttribute('data-i')));
      if (el.namespaceURI === 'http://www.w3.org/2000/svg' || el.tagName === 'TITLE') el.textContent = strip(s);
      else el.innerHTML = s;
    });
    ['alt', 'aria-label', 'aria-roledescription', 'content'].forEach(function (a) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-i-' + a + ']'), function (el) {
        el.setAttribute(a, strip(expand(t(el.getAttribute('data-i-' + a)))));
      });
    });
    var sel = document.getElementById('lang');
    if (sel) sel.value = lang;
    Array.prototype.forEach.call(document.querySelectorAll('#fan li'), function (li) {
      li.classList.toggle('on', li.getAttribute('data-lang') === lang);
    });
    relink();
    paintUnits();
  }

  function fire() { hooks.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  var api = {
    get lang() { return lang; },
    get unit() { return unit; },
    langs: LANGS,
    t: t, fmtC: fmtC, sym: sym, fmtD: fmtD, apply: apply,
    setLang: function (l, remember) {
      if (LANGS.indexOf(l) < 0) return;
      lang = l;
      if (remember) {
        keep('malondo.lang', l);
        var box = document.getElementById('suggest');
        if (box) box.hidden = true;
      }
      apply();
      syncUrl();
    },
    setUnit: function (u, remember) {
      unit = u === 'f' ? 'f' : 'c';
      if (remember) keep('malondo.unit', unit);
      paintUnits();
    },
    onChange: function (fn) { hooks.push(fn); },
  };

  var q = pick(new URLSearchParams(location.search).get('lang'));
  var chosen = pick(recall('malondo.lang'));
  var pageLang = pick(root.getAttribute('lang')) || 'ko';
  if (paged) {
    // 예전 주소(/?lang=en)는 그 언어의 주소로 옮긴다 — 퍼져 있던 링크와 검색 결과를 한 주소로 모은다.
    if (q && q !== pageLang) { location.replace(HOME[q] + location.hash); return; }
    lang = chosen || pageLang;
  } else {
    lang = q || chosen || deviceLang();
  }
  // 한국어로 구운 글을 한국어가 아닌 기기가 읽을 때(구글의 렌더러가 그렇다 — en-US)
  // 단위까지 기기를 따르면 36.5℃ 가 97.7°F 로 색인된다. 그때는 섭씨로 둔다.
  var u = recall('malondo.unit');
  unit = u === 'f' || u === 'c' ? u : (lang === 'ko' && deviceWants() !== 'ko') ? 'c' : deviceUnit();

  var sel = document.getElementById('lang');
  if (sel) sel.addEventListener('change', function (e) { api.setLang(e.target.value, true); });
  var ub = document.getElementById('unit');
  if (ub) ub.addEventListener('click', function () { api.setUnit(unit === 'f' ? 'c' : 'f', true); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-unit]'), function (x) {
    x.addEventListener('click', function () { api.setUnit(x.getAttribute('data-unit'), true); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('#fan li button'), function (b) {
    b.addEventListener('click', function () { api.setLang(b.parentNode.getAttribute('data-lang'), true); });
  });

  window.MalondoI18n = api;
  apply();
  syncUrl();

  // 기기 언어가 이 페이지와 다르면 한 번 권한다. 사람의 손이 처음 닿을 때 띄운다 —
  // 손이 닿지 않는 검색 엔진의 렌더러에는 이 한 줄이 서지 않아, 한국어 페이지에
  // 영어 한 줄이 섞여 색인되지 않는다.
  var box = document.getElementById('suggest');
  var want = deviceWants();
  if (paged && box && want && want !== lang && !chosen && recall('malondo.suggest') !== 'no') {
    var shown = false;
    var show = function () {
      if (shown) return;
      shown = true;
      ['scroll', 'pointerdown', 'keydown'].forEach(function (ev) { window.removeEventListener(ev, show); });
      if (lang === want) return; // 그새 사람이 골랐다
      var d = dict[want] || {};
      box.lang = want;
      box.querySelector('.say').textContent = d['suggest.say'] || '';
      var go = box.querySelector('.go'), x = box.querySelector('.x');
      go.textContent = d['suggest.go'] || want;
      x.setAttribute('aria-label', d['suggest.close'] || '×');
      go.addEventListener('click', function () { api.setLang(want, true); });
      x.addEventListener('click', function () { box.hidden = true; keep('malondo.suggest', 'no'); });
      box.hidden = false;
    };
    ['scroll', 'pointerdown', 'keydown'].forEach(function (ev) { window.addEventListener(ev, show, { passive: true }); });
  }
})();
