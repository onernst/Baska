/* Baska: voice input for the composer.
   Uses the browser's Web Speech API (Chrome, Edge, Safari). The mic button stays hidden where it is not supported.
   A spoken phrase like "two boxes of printer paper from Costco" becomes qty 2, unit box, name "Printer paper", store Costco,
   and is added right away (with an Undo toast). */
(function (B) {
  'use strict';
  var S = B.state, $ = B.$, key = B.key;

  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  var micBtn = $('micBtn');
  if (!Rec || !micBtn) return;           // unsupported browser: no mic button
  micBtn.hidden = false;

  /* ---------- Phrase parsing ---------- */
  var NUMBERS = {
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, fifty: 50, hundred: 100,
    couple: 2, 'a couple': 2, 'a couple of': 2, dozen: 12, 'a dozen': 12, 'half a dozen': 6,
    half: 0.5, 'a half': 0.5, 'half a': 0.5, 'one and a half': 1.5, 'two and a half': 2.5
  };
  var BOX_WORDS = /^(box|boxes|pack|packs|package|packages|carton|cartons|case|cases|crate|crates)\b/;
  var UNIT_WORDS = /^(unit|units|piece|pieces|pcs|item|items)\b/;
  var LEAD = /^(please\s+)?(add|put|buy|get|grab|pick up|i need|we need|we're out of|we are out of)\s+/;

  function knownStore(spoken) {
    var k = key(spoken);
    if (!k) return '';
    var list = B.allStores ? B.allStores() : (S.stores || []).map(function (s) { return { name: s.name, key: key(s.name) }; });
    for (var i = 0; i < list.length; i++) if (list[i].key === k) return list[i].name;
    for (var j = 0; j < list.length; j++) {
      if (k.indexOf(list[j].key) === 0 || list[j].key.indexOf(k) === 0) return list[j].name;   // "costco wholesale" → Costco
    }
    return '';
  }
  function titleCase(s) { return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  function parsePhrase(raw) {
    // `o` keeps the original casing (so "HDMI" stays "HDMI"); `t` is its lowercase twin used for matching.
    // Every cut is applied to both, so they always have the same length.
    var o = String(raw || '').replace(/\s+/g, ' ').replace(/[.!?,]+$/g, '').trim();
    var t = o.toLowerCase();
    function cutFront(n) { o = o.slice(n).trim(); t = t.slice(n).trim(); }
    var out = { qty: 1, unit: 'unit', name: '', store: '' };

    var lm = t.match(LEAD);
    if (lm) cutFront(lm[0].length);

    // store: "... from Costco" / "... at Costco" (only if something is left before it)
    var sm = t.match(/^(.+?)\s+(?:from|at)\s+(.+)$/);
    if (sm) {
      var spoken = o.slice(o.length - sm[2].length).trim();
      out.store = knownStore(spoken) || titleCase(spoken);
      o = o.slice(0, sm[1].length); t = sm[1];
    }

    // quantity: digits ("2", "2.5") or number words ("two", "a dozen", "one and a half")
    var dm = t.match(/^(\d+(?:[.,]\d+)?)\s*(?:x\s+)?/);
    if (dm) {
      out.qty = parseFloat(dm[1].replace(',', '.'));
      cutFront(dm[0].length);
    } else {
      var phrases = Object.keys(NUMBERS).sort(function (a, b) { return b.length - a.length; });
      for (var i = 0; i < phrases.length; i++) {
        var p = phrases[i];
        if (t === p) break;   // the whole phrase is a number word: treat it as the name
        if (t.indexOf(p + ' ') === 0) { out.qty = NUMBERS[p]; cutFront(p.length + 1); break; }
      }
    }

    // unit: "boxes of", "packs of", "pieces of"
    var um;
    if ((um = t.match(BOX_WORDS))) { out.unit = 'box'; cutFront(um[0].length); }
    else if ((um = t.match(UNIT_WORDS))) { out.unit = 'unit'; cutFront(um[0].length); }
    var of = t.match(/^of\s+/);
    if (of) cutFront(of[0].length);

    out.name = o ? o.charAt(0).toUpperCase() + o.slice(1) : '';
    if (!(out.qty > 0)) out.qty = 1;
    return out;
  }
  B.parseVoicePhrase = parsePhrase;   // exposed for testing

  /* ---------- Recognition ---------- */
  var rec = null, listening = false, gotFinal = false, prevPlaceholder = '';

  function setListening(on) {
    listening = on;
    micBtn.setAttribute('aria-pressed', String(on));
    micBtn.setAttribute('aria-label', on ? 'Stop listening' : 'Add an item by voice');
    $('composer').classList.toggle('is-listening', on);
    var input = $('cName');
    if (on) { prevPlaceholder = input.placeholder; input.placeholder = 'Listening…'; }
    else if (prevPlaceholder) input.placeholder = prevPlaceholder;
  }

  function applyAndAdd(transcript) {
    var p = parsePhrase(transcript);
    if (!p.name) { B.showComposerError('I heard “' + transcript + '” but no item name. Try again.'); return; }
    $('cName').value = p.name;
    $('cQty').value = String(p.qty);
    var r = document.querySelector('input[name="cUnit"][value="' + p.unit + '"]');
    if (r) r.checked = true;
    var storeEl = $('cStore'), prevStore = storeEl.value;
    if (p.store) storeEl.value = p.store;
    B.renderComposerHint();

    var before = S.items.length;
    B.addFromComposer({ preventDefault: function () {} });
    if (p.store) { storeEl.value = prevStore; B.renderComposerHint(); }   // a spoken store applies to this item only
    if (S.items.length === before) return;                                 // validation failed; error is already shown

    var added = S.items[S.items.length - 1];
    B.toast('Added by voice: ' + B.qtyLabel(added.qty, added.unit) + ' of ' + added.name + (added.store ? ' at ' + added.store : ''), function () {
      S.items = S.items.filter(function (i) { return i.id !== added.id; });
      B.save();
      B.render();
    });
  }

  function start() {
    B.showComposerError('');
    rec = new Rec();
    rec.lang = document.documentElement.lang && document.documentElement.lang !== 'en' ? document.documentElement.lang : (navigator.language || 'en-US');
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    gotFinal = false;

    rec.onresult = function (e) {
      var interim = '', final = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += txt; else interim += txt;
      }
      if (interim) $('cName').value = interim.trim();   // live feedback while speaking
      if (final) { gotFinal = true; applyAndAdd(final.trim()); }
    };
    rec.onerror = function (e) {
      var msg = {
        'not-allowed': 'Microphone access is blocked. Allow it in your browser’s site settings to add items by voice.',
        'service-not-allowed': 'Voice input is not available here. Try Chrome or Edge, or open the app from a web address.',
        'no-speech': 'I didn’t hear anything. Tap the mic and try again.',
        'audio-capture': 'No microphone was found.',
        'network': 'Voice input needs an internet connection.'
      }[e.error];
      if (msg) B.showComposerError(msg);
    };
    rec.onend = function () {
      setListening(false);
      if (!gotFinal && $('cName').value && !$('composerError').textContent) $('cName').focus();   // keep partial text editable
      rec = null;
    };

    try { rec.start(); setListening(true); }
    catch (err) { setListening(false); B.showComposerError('Could not start the microphone. Try again.'); }
  }

  function stop() { if (rec) rec.stop(); }

  micBtn.addEventListener('click', function () { if (listening) stop(); else start(); });
  document.addEventListener('keydown', function (e) { if (listening && e.key === 'Escape') { e.preventDefault(); if (rec) rec.abort(); } });
})(window.Baska);
