/* Baska: ids, pluralisation, avatar hue, escaping, DOM + small UI helpers. */
(function (B) {
  'use strict';
  var S = B.state || (B.state = {});

  /* ---------- Exports (function declarations are hoisted) ---------- */
  B.mq = mq;
  B.escapeHTML = escapeHTML;
  B.$ = $;
  B.el = el;
  B.icon = icon;
  B.reduced = reduced;
  B.isWide = isWide;
  B.key = key;
  B.round = round;
  B.qtyLabel = qtyLabel;
  B.plural = plural;
  B.newId = newId;
  B.findItem = findItem;
  B.rowEl = rowEl;
  B.parseQty = parseQty;
  B.hueFor = hueFor;
  B.makeAvatar = makeAvatar;
  B.bindStepper = bindStepper;
  B.trapFocus = trapFocus;

  var NO_STORE = '\u0001nostore';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var TONES = { 'Urgent': 'urgent', 'Important': 'important', 'Need to buy': 'need', 'On hold': 'hold' };
  var AVATAR_HUES = [330, 215, 25, 145, 275, 190, 355, 60, 245, 100];

  function mq(q) { try { return window.matchMedia(q); } catch (e) { return { matches: false, addEventListener: function () {} }; } }
  var mqReduce = mq('(prefers-reduced-motion: reduce)');
  var mqWide = mq('(min-width: 1024px)');
  var mqDark = mq('(prefers-color-scheme: dark)');

  /* ---------- Escaping ---------- */
  // The app renders user text with textContent only. This helper exists for any
  // future code that must build markup strings.
  function escapeHTML(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* ---------- DOM helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function icon(name, cls) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    var u = document.createElementNS(SVGNS, 'use');
    u.setAttribute('href', '#i-' + name);
    s.appendChild(u);
    return s;
  }
  function reduced() { return !!mqReduce.matches; }
  function isWide() { return !!mqWide.matches; }
  function key(s) { return (s || '').trim().toLowerCase(); }
  function round(n) { return Math.round(n * 1000) / 1000; }
  function qtyLabel(q, unit) {
    var n = round(q), plural = n !== 1;
    return n + ' ' + (unit === 'box' ? (plural ? 'boxes' : 'box') : (plural ? 'units' : 'unit'));
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function findItem(id) { for (var i = 0; i < S.items.length; i++) if (S.items[i].id === id) return S.items[i]; return null; }
  function rowEl(id) {
    var rows = document.querySelectorAll('.row');
    for (var i = 0; i < rows.length; i++) if (rows[i].dataset.id === id) return rows[i];
    return null;
  }
  function parseQty(raw) {
    var s = String(raw).trim().replace(',', '.');
    if (s === '') return NaN;
    var n = Number(s);
    return isFinite(n) && n > 0 ? n : NaN;
  }
  /* ---------- Avatar (original hue logic) ---------- */
  function hueFor(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
    return h;
  }
  function makeAvatar(who, cls) {
    var e = el('span', 'avatar' + (cls ? ' ' + cls : ''));
    e.setAttribute('aria-hidden', 'true');
    var w = (who || '').trim();
    e.title = 'Added by ' + (w || 'unknown');
    if (w) {
      var hue = AVATAR_HUES[hueFor(w.toLowerCase()) % AVATAR_HUES.length];
      e.textContent = w.charAt(0).toUpperCase();
      e.style.setProperty('--h', hue);
    } else {
      e.textContent = '?';
      e.classList.add('unknown');
    }
    return e;
  }

  function bindStepper(wrapId, input, onChange) {
    Array.prototype.forEach.call(document.querySelectorAll('#' + wrapId + ' [data-step]'), function (b) {
      b.addEventListener('click', function () {
        var step = Number(b.getAttribute('data-step'));
        var cur = parseQty(input.value);
        if (isNaN(cur)) cur = step > 0 ? 0 : 2;
        var next = round(cur + step);
        if (next <= 0) next = cur < 1 ? cur : 1;
        if (step < 0 && cur > 1 && next < 1) next = 1;
        input.value = String(next);
        onChange();
      });
    });
    input.addEventListener('input', onChange);
  }

  function trapFocus(dlg) {
    dlg.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call(
        dlg.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'),
        function (n) { return !n.disabled && n.offsetParent !== null && !(n.type === 'radio' && !n.checked && dlg.querySelector('input[name="' + n.name + '"]:checked')); }
      );
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---------- Exported constants ---------- */
  B.NO_STORE = NO_STORE;
  B.SVGNS = SVGNS;
  B.TONES = TONES;
  B.AVATAR_HUES = AVATAR_HUES;
  B.mqReduce = mqReduce;
  B.mqWide = mqWide;
  B.mqDark = mqDark;
})(window.Baska = window.Baska || {});
