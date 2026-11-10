/* Baska: stores panel and the in-app confirm dialog. */
(function (B) {
  'use strict';
  var S = B.state || (B.state = {});
  var NO_STORE = B.NO_STORE, SVGNS = B.SVGNS, TONES = B.TONES, AVATAR_HUES = B.AVATAR_HUES, mq = B.mq, mqReduce = B.mqReduce, mqWide = B.mqWide, mqDark = B.mqDark, escapeHTML = B.escapeHTML, $ = B.$, el = B.el, icon = B.icon, reduced = B.reduced, isWide = B.isWide, key = B.key, round = B.round, qtyLabel = B.qtyLabel, plural = B.plural, newId = B.newId, findItem = B.findItem, rowEl = B.rowEl, parseQty = B.parseQty, hueFor = B.hueFor, makeAvatar = B.makeAvatar, bindStepper = B.bindStepper, trapFocus = B.trapFocus;
  var STORAGE_KEY = B.STORAGE_KEY, STORES_KEY = B.STORES_KEY, UI_KEY = B.UI_KEY;

  /* ---------- Exports (function declarations are hoisted) ---------- */
  B.renderStoresPanel = renderStoresPanel;
  B.askConfirm = askConfirm;

  /* ---------- Stores panel ---------- */
  function renderStoresPanel() {
    var listEl = $('storeListEl');
    listEl.textContent = '';
    var all = B.allStores();
    $('storeCount').textContent = all.length;
    if (!all.length) {
      var e = el('li', 'empty-row', 'No stores yet. Add the places you shop.');
      listEl.appendChild(e);
      return;
    }
    all.forEach(function (s) {
      var active = S.filter === s.key;
      var li = el('li', 'store-row' + (active ? ' active' : ''));
      var count = B.pendingAt(s.key);
      var main = el('button', 'store-main');
      main.type = 'button';
      main.setAttribute('aria-pressed', String(active));
      main.setAttribute('aria-label', s.name + ', ' + (count ? count + ' to buy' : 'nothing to buy') + (active ? '. Filter on, tap to show all' : '. Tap to filter the list'));
      main.appendChild(icon('pin'));
      var t = el('span', 'store-text');
      t.appendChild(el('span', 'store-name', s.name));
      t.appendChild(el('span', 'store-sub', (count ? count + ' to buy' : 'Nothing pending') + (s.fromList ? '' : ' · from items')));
      main.appendChild(t);
      if (active) main.appendChild(el('span', 'filter-flag', 'Filtered'));
      main.addEventListener('click', function () {
        B.setFilter(s.key);
        if (!isWide() && S.filter) B.setView('list');
      });
      li.appendChild(main);
      if (s.fromList) {
        var del = el('button', 'icon-btn danger');
        del.type = 'button';
        del.setAttribute('aria-label', 'Delete store ' + s.name);
        del.appendChild(icon('trash'));
        del.addEventListener('click', function () {
          var used = S.items.filter(function (i) { return key(i.store) === s.key; }).length;
          askConfirm({
            title: 'Delete ' + s.name + '?',
            body: used ? plural(used, 'item uses', 'items use') + ' this store. They stay on your list, just without a store.' : 'No items use this store.',
            ok: 'Delete store',
            fallback: $('storeName')
          }, function () { B.deleteStore(s.name); });
        });
        li.appendChild(del);
      } else {
        var lk = el('span', 'store-locked');
        lk.title = 'Used on items. Remove it from those items to clear it.';
        lk.appendChild(icon('lock'));
        lk.appendChild(el('span', 'sr-only', 'Used on items, cannot be deleted here'));
        li.appendChild(lk);
      }
      listEl.appendChild(li);
    });
  }
  /* ---------- Confirm dialog ---------- */
  var confirmDlg = $('confirmDlg');
  function askConfirm(o, yes) {
    $('cfTitle').textContent = o.title;
    $('cfBody').textContent = o.body;
    $('cfOk').textContent = o.ok || 'Delete';
    S.confirmYes = yes;
    S.confirmReturn = document.activeElement;
    S.confirmFallback = o.fallback || null;
    if (typeof confirmDlg.showModal === 'function') confirmDlg.showModal(); else confirmDlg.setAttribute('open', '');
    $('cfCancel').focus();
  }
  $('cfCancel').addEventListener('click', function () { S.confirmYes = null; confirmDlg.close(); });
  $('cfOk').addEventListener('click', function () {
    var fn = S.confirmYes; S.confirmYes = null;
    confirmDlg.close();
    if (fn) fn();
    var t = S.confirmReturn && S.confirmReturn.isConnected && S.confirmReturn.offsetParent ? S.confirmReturn : S.confirmFallback;
    if (t) t.focus();
  });
  confirmDlg.addEventListener('close', function () {
    if (S.confirmYes === null && S.confirmReturn && S.confirmReturn.isConnected) S.confirmReturn.focus();
  });
  confirmDlg.addEventListener('click', function (e) { if (e.target === confirmDlg) { S.confirmYes = null; confirmDlg.close(); } });
  trapFocus(confirmDlg);
})(window.Baska = window.Baska || {});
