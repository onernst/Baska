/* Baska: bootstrapping: composer, views/tabs, theme, demo data, event wiring, keyboard shortcuts. */
(function (B) {
  'use strict';
  var S = B.state || (B.state = {});
  var NO_STORE = B.NO_STORE, SVGNS = B.SVGNS, TONES = B.TONES, AVATAR_HUES = B.AVATAR_HUES, mq = B.mq, mqReduce = B.mqReduce, mqWide = B.mqWide, mqDark = B.mqDark, escapeHTML = B.escapeHTML, $ = B.$, el = B.el, icon = B.icon, reduced = B.reduced, isWide = B.isWide, key = B.key, round = B.round, qtyLabel = B.qtyLabel, plural = B.plural, newId = B.newId, findItem = B.findItem, rowEl = B.rowEl, parseQty = B.parseQty, hueFor = B.hueFor, makeAvatar = B.makeAvatar, bindStepper = B.bindStepper, trapFocus = B.trapFocus;
  var STORAGE_KEY = B.STORAGE_KEY, STORES_KEY = B.STORES_KEY, UI_KEY = B.UI_KEY;

  /* ---------- Exports (function declarations are hoisted) ---------- */
  B.composerUnit = composerUnit;
  B.setComposerOpen = setComposerOpen;
  B.renderComposerHint = renderComposerHint;
  B.showComposerError = showComposerError;
  B.addFromComposer = addFromComposer;
  B.setView = setView;
  B.effectiveTheme = effectiveTheme;
  B.applyTheme = applyTheme;
  B.loadDemo = loadDemo;
  B.syncComposerHeight = syncComposerHeight;
  /* ---------- Composer ---------- */
  function composerUnit() {
    var r = document.querySelector('input[name="cUnit"]:checked');
    return r ? r.value : 'unit';
  }
  function setComposerOpen(open) {
    var more = $('composerMore');
    clearTimeout(more._closeTimer);
    $('composer').classList.toggle('is-open', open);
    if (open) {
      more.hidden = false;
      more.classList.remove('closing');
      more.classList.add('open');
    } else if (!more.hidden) {
      // let the popover fade out before hiding it (skipped with reduced motion)
      more.classList.remove('open');
      more.classList.add('closing');
      more._closeTimer = setTimeout(function () { more.hidden = true; more.classList.remove('closing'); }, reduced() ? 0 : 160);
    }
    $('composerToggle').setAttribute('aria-expanded', String(open));
    $('composerHint').setAttribute('aria-expanded', String(open));
    if (open) B.refreshOptions();
  }
  function renderComposerHint() {
    var h = $('composerHint');
    h.textContent = '';
    var q = parseQty($('cQty').value);
    var who = $('cBy').value.trim() || B.loadLastUser();
    var store = $('cStore').value.trim() || (S.filter && S.filter !== NO_STORE ? B.storeName(S.filter) : '');
    var t = el('span', 'hint-text');
    t.appendChild(el('b', null, isNaN(q) ? '?' : qtyLabel(q, composerUnit())));
    t.appendChild(el('span', 'sep', '  ·  '));
    if (who) { t.appendChild(document.createTextNode('by ')); t.appendChild(el('b', null, who)); }
    else t.appendChild(document.createTextNode('no name set'));
    t.appendChild(el('span', 'sep', '  ·  '));
    if (store) { t.appendChild(document.createTextNode('at ')); t.appendChild(el('b', null, store)); }
    else t.appendChild(document.createTextNode('no store'));
    h.appendChild(t);
    h.setAttribute('aria-label', 'New items: ' + t.textContent.replace(/\s+·\s+/g, ', ') + '. Change');
    var stepMinus = document.querySelector('#cStepper [data-step="-1"]');
    stepMinus.disabled = !(q > 1);
  }
  function showComposerError(msg, field) {
    $('composerError').textContent = msg;
    ['cName', 'cQty'].forEach(function (id) { $(id).removeAttribute('aria-invalid'); });
    $('cStepper').removeAttribute('data-invalid');
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      if (field.id === 'cQty') $('cStepper').setAttribute('data-invalid', 'true');
      field.focus();
    }
  }
  function addFromComposer(e) {
    e.preventDefault();
    var nameEl = $('cName');
    var name = nameEl.value.trim();
    if (!name) { showComposerError('Type what you need first, e.g. "Oat milk".', nameEl); return; }
    var q = parseQty($('cQty').value);
    if (isNaN(q)) { setComposerOpen(true); showComposerError('Quantity must be a positive number, like 1 or 2.5.', $('cQty')); return; }
    // No fake "Me": use the typed name, else the remembered one, else leave it empty (shown as "unknown").
    var who = $('cBy').value.trim() || B.loadLastUser();
    var store = $('cStore').value.trim();
    if (!store && S.filter && S.filter !== NO_STORE) store = B.storeName(S.filter);
    var unit = composerUnit();
    var id = newId();
    S.items.push({ id: id, name: name, qty: q, done: false, addedBy: who, note: '', option: '', message: '', store: store, unit: unit });
    if (who) { B.saveLastUser(who); $('cBy').value = who; }
    S.ui.lastStore = store;
    // make sure the new item's group is open
    var gk = S.ui.group === 'store' ? (key(store) || NO_STORE) : (key(who) || NO_STORE);
    delete S.ui.collapsed[S.ui.group + ':' + gk];
    B.saveUI();
    B.save();

    nameEl.value = '';
    $('cQty').value = '1';
    var u = document.querySelector('input[name="cUnit"][value="unit"]'); if (u) u.checked = true;
    showComposerError('');
    B.render();
    nameEl.focus();

    var item = findItem(id);
    if (!B.matchesFilter(item)) {
      B.toast('Added ' + name + (store ? ' for ' + store : '') + '. It is hidden by the current filter.');
    } else {
      var r = rowEl(id);
      if (r) {
        if (!reduced()) r.classList.add('just-added');
        if (r.scrollIntoView) r.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
      }
    }
  }
  /* ---------- Views (mobile tabs) ---------- */
  function setView(v) {
    var app = $('app');
    if (app.dataset.view === v) return;
    app.dataset.view = v;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      if (t.dataset.view === v) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    if (!isWide()) window.scrollTo(0, 0);
  }
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.addEventListener('click', function () { setView(t.dataset.view); });
  });
  /* ---------- Theme ---------- */
  function effectiveTheme() { return S.ui.theme || (mqDark.matches ? 'dark' : 'light'); }
  function applyTheme() {
    if (S.ui.theme) document.documentElement.setAttribute('data-theme', S.ui.theme);
    else document.documentElement.removeAttribute('data-theme');
    var eff = effectiveTheme();
    $('themeBtn').setAttribute('aria-label', eff === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  $('themeBtn').addEventListener('click', function () {
    S.ui.theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
    B.saveUI();
    applyTheme();
  });
  if (mqDark.addEventListener) mqDark.addEventListener('change', applyTheme);
  /* ---------- Demo data (now keeps store + unit) ---------- */
  var DEMO_ITEMS = [
    { name: 'Milk', qty: 2, by: 'Maria', note: 'Whole milk, 1 gallon each', option: 'Urgent', message: 'Needed for breakfast tomorrow', store: 'Costco', unit: 'unit' },
    { name: 'Eggs', qty: 12, by: 'John', store: 'Walmart', unit: 'unit' },
    { name: 'Butter', qty: 1, by: 'Jane', done: true, store: 'Target', unit: 'unit' },
    { name: 'Cheese (sliced / shredded)', qty: 2, by: 'Jane', note: 'One sliced, one shredded', option: 'Need to buy', store: 'Costco', unit: 'unit' },
    { name: 'Yogurt / Greek Yogurt', qty: 4, by: 'John', store: 'Walmart', unit: 'box' },
    { name: 'Sour cream', qty: 1, by: 'Maria', store: 'Target', unit: 'unit' }
  ];
  function loadDemo() {
    var existing = {};
    S.items.forEach(function (i) { existing[i.name.toLowerCase()] = true; });
    var added = 0;
    DEMO_ITEMS.forEach(function (d) {
      if (existing[d.name.toLowerCase()]) return; // pressing twice adds nothing new
      S.items.push({
        id: newId(), name: d.name, qty: d.qty, done: !!d.done, addedBy: d.by || '',
        note: d.note || '', option: d.option || '', message: d.message || '',
        store: d.store || '', unit: d.unit || 'unit'
      });
      added++;
    });
    DEMO_ITEMS.forEach(function (d) {
      if (d.store && !S.stores.some(function (s) { return key(s.name) === key(d.store); })) S.stores.push({ name: d.store });
    });
    B.save();
    B.saveStores();
    B.render();
    B.toast(added ? 'Added ' + plural(added, 'demo item', 'demo items') : 'Demo items are already on your list');
  }
  /* ---------- Wiring ---------- */
  $('composer').addEventListener('submit', addFromComposer);
  $('cName').addEventListener('input', function () { if ($('composerError').textContent) showComposerError(''); });
  $('cName').addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!$('composerMore').hidden) { setComposerOpen(false); }
      else if ($('cName').value) { $('cName').value = ''; showComposerError(''); }
      else $('cName').blur();
    }
  });
  // Desktop: the options are a popover, so close it on outside click or Esc.
  document.addEventListener('pointerdown', function (e) {
    if (!isWide() || $('composerMore').hidden) return;
    if (!$('composer').contains(e.target) && !e.target.closest('dialog')) setComposerOpen(false);
  });
  $('composer').addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && e.target.id !== 'cName' && !$('composerMore').hidden) {
      setComposerOpen(false);
      $('composerToggle').focus();
    }
  });
  $('composerToggle').addEventListener('click', function () { setComposerOpen($('composerMore').hidden); });
  $('composerHint').addEventListener('click', function () { setComposerOpen($('composerMore').hidden); });
  bindStepper('cStepper', $('cQty'), function () {
    if ($('composerError').textContent && !isNaN(parseQty($('cQty').value))) showComposerError('');
    renderComposerHint();
  });
  $('cQty').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('composer').requestSubmit ? $('composer').requestSubmit() : addFromComposer(e); } });
  document.querySelectorAll('input[name="cUnit"]').forEach(function (r) { r.addEventListener('change', renderComposerHint); });
  $('cBy').addEventListener('input', function () { renderComposerHint(); B.refreshOptions(); });
  $('cStore').addEventListener('input', function () { renderComposerHint(); B.refreshOptions(); });
  $('cBy').addEventListener('change', B.renderPeople);

  document.querySelectorAll('input[name="groupMode"]').forEach(function (r) {
    r.checked = r.value === S.ui.group;
    r.addEventListener('change', function () {
      if (!r.checked) return;
      S.ui.group = r.value;
      B.saveUI();
      B.render();
    });
  });

  $('doneToggle').addEventListener('click', function () {
    S.showDone = !S.showDone;
    $('doneList').hidden = !S.showDone;
    $('doneToggle').setAttribute('aria-expanded', String(S.showDone));
  });
  $('clearDone').addEventListener('click', function () {
    var ids = S.items.filter(function (i) { return i.done && B.matchesFilter(i); }).map(function (i) { return i.id; });
    if (!ids.length) return;
    B.askConfirm({
      title: 'Clear ' + plural(ids.length, 'completed item', 'completed items') + '?',
      body: S.filter ? 'Removes the ticked-off items at ' + B.storeName(S.filter) + '. You can undo right after.' : 'Removes everything you have ticked off. You can undo right after.',
      ok: 'Clear',
      fallback: $('cName')
    }, function () { B.deleteItems(ids, 'Cleared ' + plural(ids.length, 'item', 'items')); });
  });
  $('feShowAll').addEventListener('click', function () { B.setFilter(null); $('cName').focus(); });
  $('demoBtn').addEventListener('click', loadDemo);
  $('storeForm').addEventListener('submit', B.addStore);
  $('storeName').addEventListener('input', function () { $('storeError').textContent = ''; $('storeName').removeAttribute('aria-invalid'); });

  // keyboard: "/" or "n" focuses the composer
  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if ($('details').open || $('confirmDlg').open) return;
    var t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (e.key === '/' || e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      setView('list');
      $('cName').focus();
    }
  });

  // keep the bottom padding in sync with the docked composer's height
  function syncComposerHeight() {
    var c = $('composer');
    var h = isWide() ? 0 : c.offsetHeight;
    document.documentElement.style.setProperty('--composer-h', h + 'px');
  }
  if (window.ResizeObserver) new ResizeObserver(syncComposerHeight).observe($('composer'));
  if (mqWide.addEventListener) mqWide.addEventListener('change', syncComposerHeight);

  // hide the tab bar while the on-screen keyboard is up (mobile)
  if (window.visualViewport) {
    var maxVH = window.visualViewport.height;
    window.visualViewport.addEventListener('resize', function () {
      var vh = window.visualViewport.height;
      maxVH = Math.max(maxVH, vh);
      var a = document.activeElement;
      var typing = a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'radio';
      document.body.classList.toggle('kb-open', !isWide() && typing && vh < maxVH - 150);
    });
    document.addEventListener('focusout', function () {
      setTimeout(function () {
        var a = document.activeElement;
        if (!a || !/^(INPUT|TEXTAREA)$/.test(a.tagName)) document.body.classList.remove('kb-open');
      }, 50);
    });
  }

  // sync between tabs
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) { S.items = B.load(); B.render(); if (S.detailId && !findItem(S.detailId)) B.closeDetails(); }
    else if (e.key === STORES_KEY) { S.stores = B.loadStores(); B.render(); }
  });
  /* ---------- Init ---------- */
  $('cBy').value = B.loadLastUser();
  $('cStore').value = S.filter && S.filter !== NO_STORE ? '' : S.ui.lastStore || '';
  B.validateFilter();
  if (S.filter && S.filter !== NO_STORE) $('cStore').value = B.storeName(S.filter);
  applyTheme();
  B.renderLocation();
  B.render();
  syncComposerHeight();
})(window.Baska = window.Baska || {});
