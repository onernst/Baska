/* Baska: items / stores / ui state, derived data and actions (toggle, delete + undo, stores). */
(function (B) {
  'use strict';
  var S = B.state || (B.state = {});
  var NO_STORE = B.NO_STORE, SVGNS = B.SVGNS, TONES = B.TONES, AVATAR_HUES = B.AVATAR_HUES, mq = B.mq, mqReduce = B.mqReduce, mqWide = B.mqWide, mqDark = B.mqDark, escapeHTML = B.escapeHTML, $ = B.$, el = B.el, icon = B.icon, reduced = B.reduced, isWide = B.isWide, key = B.key, round = B.round, qtyLabel = B.qtyLabel, plural = B.plural, newId = B.newId, findItem = B.findItem, rowEl = B.rowEl, parseQty = B.parseQty, hueFor = B.hueFor, makeAvatar = B.makeAvatar, bindStepper = B.bindStepper, trapFocus = B.trapFocus;
  var STORAGE_KEY = B.STORAGE_KEY, STORES_KEY = B.STORES_KEY, UI_KEY = B.UI_KEY;

  /* ---------- Exports (function declarations are hoisted) ---------- */
  B.allStores = allStores;
  B.storeName = storeName;
  B.pendingAt = pendingAt;
  B.people = people;
  B.matchesFilter = matchesFilter;
  B.validateFilter = validateFilter;
  B.unitSummary = unitSummary;
  B.onCheck = onCheck;
  B.scheduleMove = scheduleMove;
  B.collapseDone = collapseDone;
  B.focusRow = focusRow;
  B.deleteItems = deleteItems;
  B.addStore = addStore;
  B.deleteStore = deleteStore;

  /* ---------- State ---------- */
  var ui = B.loadUI();
  Object.assign(S, {
    items: B.load(),
    stores: B.loadStores(),
    ui: ui,
    filter: ui.filter,            // null = all, lowercase store key, or NO_STORE
    showDone: false,              // Completed starts collapsed
    userPosition: null, watchId: null, lastNotificationTime: 0, nearbyPlacesCache: {},
    locState: 'off', locMsg: '',
    moveTimer: null, leaveTimer: null, toastTimer: null, savedTimer: null,
    detailId: null, detailReturnFocus: null,
    confirmYes: null, confirmReturn: null, confirmFallback: null,
    lastDoneCount: -1
  });
  /* ---------- Derived data ---------- */
  function allStores() {
    var seen = {}, out = [];
    S.stores.forEach(function (s) {
      var k = key(s.name);
      if (!k || seen[k]) return;
      seen[k] = true;
      out.push({ name: s.name.trim(), key: k, fromList: true });
    });
    S.items.forEach(function (i) {
      var k = key(i.store);
      if (!k || seen[k]) return;
      seen[k] = true;
      out.push({ name: i.store.trim(), key: k, fromList: false });
    });
    return out;
  }
  function storeName(k) {
    if (k === NO_STORE) return 'No store';
    var list = allStores();
    for (var i = 0; i < list.length; i++) if (list[i].key === k) return list[i].name;
    return k;
  }
  function pendingAt(k) {
    return S.items.filter(function (i) { return !i.done && key(i.store) === k; }).length;
  }
  function people() {
    var map = {}, order = [];
    S.items.forEach(function (i) {
      var k = key(i.addedBy);
      if (!k) return;
      if (!map[k]) { map[k] = { name: i.addedBy.trim(), key: k, pending: 0, total: 0 }; order.push(k); }
      map[k].total++;
      if (!i.done) map[k].pending++;
    });
    return order.map(function (k) { return map[k]; });
  }
  function matchesFilter(item) {
    if (!S.filter) return true;
    if (S.filter === NO_STORE) return !key(item.store);
    return key(item.store) === S.filter;
  }
  function validateFilter() {
    if (!S.filter || S.filter === NO_STORE) return;
    var ok = allStores().some(function (s) { return s.key === S.filter; });
    if (!ok) { S.filter = null; S.ui.filter = null; B.saveUI(); }
  }
  function unitSummary(list) {
    var u = 0, b = 0;
    list.forEach(function (i) { if (i.unit === 'box') b += i.qty; else u += i.qty; });
    u = round(u); b = round(b);
    var parts = [];
    if (u || !b) parts.push(qtyLabel(u, 'unit'));
    if (b) parts.push(qtyLabel(b, 'box'));
    return parts.join(' · ');
  }
  /* ---------- Check off ---------- */
  function onCheck(id, checked, li, cb) {
    var item = findItem(id);
    if (!item) return;
    item.done = checked;
    B.save();
    cb.setAttribute('aria-label', (checked ? 'Done: ' : 'Mark done: ') + item.name);
    var inActive = !!li.closest('#groups');
    B.renderHeader(); B.renderStats(); B.renderChips(); B.renderPeople(); B.renderStoresPanel();
    if (inActive) {
      li.classList.remove('static');
      li.classList.toggle('is-done', checked);
      scheduleMove();
      if (checked) {
        B.toast(item.name + ' completed', function () {
          var it = findItem(id);
          if (!it) return;
          it.done = false; B.save(); B.render(); focusRow(id);
        });
      }
    } else {
      B.render();
      if (!checked) B.toast(item.name + ' is back on the list');
    }
  }
  function scheduleMove() {
    clearTimeout(S.moveTimer); clearTimeout(S.leaveTimer);
    if (S.pointerGo) { $('groups').removeEventListener('pointerleave', S.pointerGo); S.pointerGo = null; }
    S.waitedForPointer = false;
    if (reduced()) { S.moveTimer = setTimeout(B.render, 250); return; }
    S.moveTimer = setTimeout(collapseDone, 700);
  }
  // Ticked rows keep their slot while a mouse pointer is over the list, so the
  // next target doesn't move under it; they then collapse smoothly (height -> 0).
  var canHover = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : { matches: false };
  function collapseDone() {
    var groups = $('groups');
    if (canHover.matches && groups.matches(':hover') && !S.waitedForPointer) {
      S.waitedForPointer = true;
      var go = function () {
        groups.removeEventListener('pointerleave', go);
        S.pointerGo = null;
        clearTimeout(S.moveTimer);
        S.moveTimer = setTimeout(collapseDone, 150);
      };
      S.pointerGo = go;
      groups.addEventListener('pointerleave', go);
      S.moveTimer = setTimeout(go, 4000); // never hold rows forever
      return;
    }
    S.waitedForPointer = false;
    var rows = document.querySelectorAll('#groups .row');
    var leaving = [];
    for (var i = 0; i < rows.length; i++) {
      var it = findItem(rows[i].dataset.id);
      if (it && it.done) leaving.push(rows[i]);
    }
    if (!leaving.length) { B.render(); return; }
    leaving.forEach(function (r) { r.style.height = r.offsetHeight + 'px'; });
    void document.body.offsetHeight; // commit the start height
    leaving.forEach(function (r) { r.classList.add('leaving'); r.style.height = '0px'; });
    S.leaveTimer = setTimeout(B.render, 300);
  }
  function focusRow(id) {
    var r = rowEl(id);
    if (r && r.offsetParent) { var m = r.querySelector('.row-main'); if (m) m.focus(); }
  }
  /* ---------- Delete with undo ---------- */
  function deleteItems(ids, msg) {
    var removed = [];
    S.items = S.items.filter(function (it, idx) {
      if (ids.indexOf(it.id) !== -1) { removed.push({ it: it, idx: idx }); return false; }
      return true;
    });
    if (!removed.length) return;
    B.save();
    B.render();
    B.toast(msg, function () {
      removed.forEach(function (r) { S.items.splice(Math.min(r.idx, S.items.length), 0, r.it); });
      B.save();
      B.render();
      focusRow(removed[0].it.id);
    });
  }

  /* ---------- Store actions ---------- */
  function addStore(e) {
    if (e) e.preventDefault();
    var input = $('storeName');
    var name = input.value.trim();
    var err = $('storeError');
    if (!name) { err.textContent = 'Type a store name first.'; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    var exists = S.stores.some(function (s) { return s.name.toLowerCase() === name.toLowerCase(); });
    if (exists) { err.textContent = name + ' is already on your list of stores.'; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    S.stores.push({ name: name });
    B.saveStores();
    input.value = '';
    err.textContent = '';
    input.removeAttribute('aria-invalid');
    B.render();
    B.toast('Added ' + name + ' to your stores');
    input.focus();
  }

  function deleteStore(name) {
    S.stores = S.stores.filter(function (s) { return s.name.toLowerCase() !== name.toLowerCase(); });
    S.items.forEach(function (i) {
      if (i.store && i.store.toLowerCase() === name.toLowerCase()) i.store = '';
    });
    // also catch items whose store differs only by surrounding spaces
    S.items.forEach(function (i) { if (key(i.store) === key(name)) i.store = ''; });
    B.saveStores();
    B.save();
    if (S.filter === key(name)) { S.filter = null; S.ui.filter = null; B.saveUI(); }
    if (key($('cStore').value) === key(name)) $('cStore').value = '';
    delete S.nearbyPlacesCache[name.toLowerCase()];
    $('storeError').textContent = '';
    $('storeName').removeAttribute('aria-invalid');
    B.render();
    B.toast('Deleted ' + name);
  }
})(window.Baska = window.Baska || {});
