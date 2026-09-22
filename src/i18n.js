/* 세 페이지(index · privacy · support)가 함께 쓰는 언어·단위 장치.
 *
 * - 표는 페이지마다 <script type="application/json" id="i18n"> 에 실려 온다.
 *   build.py 가 그 자리에 네 언어를 통째로 넣는다.
 * - 고른 언어는 localStorage 에 남는다. 같은 출처라 **페이지를 옮겨도 따라온다** —
 *   홈에서 English 를 고르고 처리방침으로 가면 처리방침도 영어로 선다.
 * - 온도 단위 단추와 언어 고르개는 없을 수도 있다(support). 없으면 건너뛴다.
 * - 값이 바뀔 때 다시 그려야 하는 것(홈의 다이얼)은 onChange 로 건다.
 */
(function () {
  var LANGS = ['ko', 'en', 'ja', 'es'];
  var dict;
  try {
    dict = JSON.parse(document.getElementById('i18n').textContent);
  } catch (e) {
    return; // 표가 없으면 HTML 에 구워진 한국어가 그대로 선다.
  }

  var lang = 'ko', unit = 'c', hooks = [];

  function keep(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function recall(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function deviceLang() {
    var list = navigator.languages || [navigator.language || 'ko'];
    for (var i = 0; i < list.length; i++) {
      var t = String(list[i]).slice(0, 2).toLowerCase();
      if (LANGS.indexOf(t) >= 0) return t;
    }
    return 'ko';
  }

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
  function fmtD(d) { return (unit === 'f' ? d * 9 / 5 : d).toFixed(1) + sym(); }

  function expand(s) {
    return String(s)
      .replace(/\{c:([\d.]+)\}/g, function (_, c) {
        return '<span class="tv" data-c="' + c + '">' + fmtC(+c) + sym() + '</span>';
      })
      .replace(/\{d:([\d.]+)\}/g, function (_, d) {
        return '<span class="tv" data-d="' + d + '">' + fmtD(+d) + '</span>';
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
      el.textContent = fmtD(+el.getAttribute('data-d'));
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

  function apply() {
    document.documentElement.lang = lang;
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
      if (remember) keep('malondo.lang', l);
      apply();
    },
    setUnit: function (u, remember) {
      unit = u === 'f' ? 'f' : 'c';
      if (remember) keep('malondo.unit', unit);
      paintUnits();
    },
    onChange: function (fn) { hooks.push(fn); },
  };

  // 셋 다 아는 값인지 보고 받는다 — 표에 없는 이름이 들어오면 한국어로 선다.
  function pick(v) { return (v && LANGS.indexOf(v) >= 0) ? v : null; }
  var q = pick(new URLSearchParams(location.search).get('lang'));
  lang = q || pick(recall('malondo.lang')) || deviceLang();
  unit = recall('malondo.unit') === 'f' ? 'f' : (recall('malondo.unit') === 'c' ? 'c' : deviceUnit());

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
})();
