/* Baska: rendering: list grouping, rows, chips, progress ring, stats, people, empty states, toast. */
(function (B) {
  'use strict';
  var S = B.state || (B.state = {});
  var NO_STORE = B.NO_STORE, SVGNS = B.SVGNS, TONES = B.TONES, AVATAR_HUES = B.AVATAR_HUES, mq = B.mq, mqReduce = B.mqReduce, mqWide = B.mqWide, mqDark = B.mqDark, escapeHTML = B.escapeHTML, $ = B.$, el = B.el, icon = B.icon, reduced = B.reduced, isWide = B.isWide, key = B.key, round = B.round, qtyLabel = B.qtyLabel, plural = B.plural, newId = B.newId, findItem = B.findItem, rowEl = B.rowEl, parseQty = B.parseQty, hueFor = B.hueFor, makeAvatar = B.makeAvatar, bindStepper = B.bindStepper, trapFocus = B.trapFocus;
  var STORAGE_KEY = B.STORAGE_KEY, STORES_KEY = B.STORES_KEY, UI_KEY = B.UI_KEY;

  /* ---------- Exports (function declarations are hoisted) ---------- */
  B.render = render;
  B.captureFocus = captureFocus;
  B.restoreFocus = restoreFocus;
  B.renderHeader = renderHeader;
  B.renderChips = renderChips;
  B.chip = chip;
  B.setFilter = setFilter;
  B.buildGroups = buildGroups;
  B.renderList = renderList;
  B.makeRow = makeRow;
  B.renderStats = renderStats;
  B.renderPeople = renderPeople;
  B.refreshOptions = refreshOptions;
  B.hideToast = hideToast;
  B.toast = toast;
  /* ---------- Render: everything except the open drawer ---------- */
  function render() {
    B.validateFilter();
    var focus = captureFocus();
    renderHeader();
    renderChips();
    renderList();
    renderStats();
    renderPeople();
    B.renderStoresPanel();
    refreshOptions();
    B.renderComposerHint();
    restoreFocus(focus);
  }

  function captureFocus() {
    var a = document.activeElement;
    if (!a || !a.closest) return null;
    var row = a.closest('.row');
    if (!row) return null;
    var part = a.classList.contains('row-main') ? '.row-main' : '.check input';
    var all = Array.prototype.slice.call(document.querySelectorAll('#groups .row, #doneList .row'));
    var idx = all.indexOf(row);
    var neighbors = all.slice(idx + 1).concat(all.slice(0, Math.max(idx, 0)).reverse()).map(function (r) { return r.dataset.id; });
    return { id: row.dataset.id, part: part, neighbors: neighbors };
  }
  function restoreFocus(f) {
    if (!f) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    var ids = [f.id].concat(f.neighbors);
    for (var i = 0; i < ids.length; i++) {
      var r = rowEl(ids[i]);
      if (r && r.offsetParent) {
        var t = r.querySelector(f.part) || r.querySelector('.row-main');
        if (t) { t.focus(); return; }
      }
    }
    (isWide() ? $('cName') : $('listTitle')).focus({ preventScroll: true });
  }

  function renderHeader() {
    var total = S.items.length;
    var done = S.items.filter(function (i) { return i.done; }).length;
    var pct = total ? done / total : 0;
    var C = 94.25;
    $('ringBar').setAttribute('stroke-dashoffset', String(C - C * pct));
    $('ringNum').textContent = done;
    $('progDone').textContent = done;
    $('progTotal').textContent = total;
    $('progress').setAttribute('aria-label', done + ' of ' + total + ' items done');
    if (S.lastDoneCount !== -1 && done > S.lastDoneCount && !reduced()) {
      var ring = $('ring');
      ring.classList.remove('bump'); void ring.offsetWidth; ring.classList.add('bump');
    }
    S.lastDoneCount = done;
    $('heroDone').textContent = done;
    $('heroOf').textContent = 'of ' + plural(total, 'item', 'items') + ' ticked off';
    $('heroBar').style.width = (pct * 100).toFixed(1) + '%';
    var pending = total - done;
    $('tabBadge').textContent = pending ? String(pending) : '';
  }

  function renderChips() {
    var wrap = $('chips');
    var prevScroll = wrap.scrollLeft;
    wrap.textContent = '';
    $('chipsWrap').hidden = S.items.length === 0;
    if (!S.items.length) return;
    var pendingAll = S.items.filter(function (i) { return !i.done; }).length;
    wrap.appendChild(chip('All', pendingAll, null));
    B.allStores().forEach(function (s) { wrap.appendChild(chip(s.name, B.pendingAt(s.key), s.key)); });
    var noStore = S.items.filter(function (i) { return !i.done && !key(i.store); }).length;
    if (noStore || S.filter === NO_STORE) wrap.appendChild(chip('No store', noStore, NO_STORE));
    wrap.scrollLeft = prevScroll;
    var act = wrap.querySelector('[aria-pressed="true"]');
    if (act) {
      var l = act.offsetLeft, w = act.offsetWidth;
      if (l < wrap.scrollLeft + 16 || l + w > wrap.scrollLeft + wrap.clientWidth - 16) wrap.scrollLeft = l - 24;
    }
  }
  function chip(label, count, k) {
    var b = el('button', 'chip' + (count ? '' : ' dim'));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(S.filter === k));
    b.setAttribute('aria-label', label + ', ' + count + ' to buy');
    b.appendChild(el('span', 'chip-label', label));
    b.appendChild(el('span', 'chip-count', String(count)));
    b.addEventListener('click', function () { setFilter(k); });
    return b;
  }
  function setFilter(k) {
    if (k !== null && S.filter === k) k = null;
    S.filter = k;
    S.ui.filter = k;
    B.saveUI();
    if (k && k !== NO_STORE) $('cStore').value = B.storeName(k);
    render();
  }

  function buildGroups(list) {
    var map = {}, order = [];
    function add(k, label, extra) {
      if (!map[k]) { map[k] = { key: k, label: label, items: [], person: extra }; order.push(k); }
      return map[k];
    }
    if (S.ui.group === 'store') {
      B.allStores().forEach(function (s) { map[s.key] = { key: s.key, label: s.name, items: [] }; order.push(s.key); });
      list.forEach(function (i) {
        var k = key(i.store);
        if (!k) add(NO_STORE, 'No store').items.push(i);
        else (map[k] || add(k, i.store.trim())).items.push(i);
      });
    } else {
      list.forEach(function (i) {
        var k = key(i.addedBy);
        if (!k) add(NO_STORE, 'Unknown', '').items.push(i);
        else add(k, i.addedBy.trim(), i.addedBy.trim()).items.push(i);
      });
    }
    // empty groups out, "No store"/"Unknown" last
    var out = order.map(function (k) { return map[k]; }).filter(function (g) { return g.items.length; });
    out.sort(function (a, b) { return (a.key === NO_STORE) - (b.key === NO_STORE); });
    return out;
  }

  function renderList() {
    clearTimeout(S.moveTimer); clearTimeout(S.leaveTimer); S.moveTimer = S.leaveTimer = null;
    var groupsEl = $('groups');
    groupsEl.textContent = '';
    var vis = S.items.filter(B.matchesFilter);
    var act = vis.filter(function (i) { return !i.done; });
    var dn = vis.filter(function (i) { return i.done; });
    var pendingAll = S.items.filter(function (i) { return !i.done; }).length;

    $('emptyState').hidden = S.items.length > 0;

    // list subtitle
    var sub;
    if (!S.items.length) sub = 'Nothing to buy yet';
    else if (S.filter) sub = plural(act.length, 'item', 'items') + ' to buy at ' + B.storeName(S.filter) + ' · ' + pendingAll + ' in total';
    else sub = pendingAll ? plural(pendingAll, 'item', 'items') + ' to buy · ' + B.unitSummary(S.items.filter(function (i) { return !i.done; })) : 'All ticked off';
    $('listSub').textContent = sub;

    var fe = $('filteredEmpty');
    if (S.items.length && !act.length) {
      fe.hidden = false;
      if (S.filter) {
        $('feTitle').textContent = S.filter === NO_STORE ? 'Nothing left without a store 🎉' : 'Nothing left at ' + B.storeName(S.filter) + ' 🎉';
        $('feBody').textContent = dn.length ? 'Everything here is ticked off.' : 'No items are tagged with this store yet.';
        $('feShowAll').hidden = false;
      } else {
        $('feTitle').textContent = 'All done. Nice shopping.';
        $('feBody').textContent = 'Every item on the list is ticked off. Add something new whenever you need it.';
        $('feShowAll').hidden = true;
      }
    } else {
      fe.hidden = true;
    }

    if (act.length) {
      var showStore = S.ui.group !== 'store';
      if (S.ui.group === 'none') {
        var ul = el('ul', 'rows');
        ul.setAttribute('aria-label', 'Items to buy');
        act.forEach(function (i) { ul.appendChild(makeRow(i, { showStore: true })); });
        groupsEl.appendChild(ul);
      } else {
        buildGroups(act).forEach(function (g, idx) {
          var ck = S.ui.group + ':' + g.key;
          var collapsed = !!S.ui.collapsed[ck];
          var sec = el('section', 'group');
          var h = el('h2', 'group-head');
          var btn = el('button', 'group-toggle');
          btn.type = 'button';
          var listId = 'grp-' + idx;
          btn.setAttribute('aria-controls', listId);
          btn.setAttribute('aria-expanded', String(!collapsed));
          var gi = el('span', 'g-icon');
          gi.setAttribute('aria-hidden', 'true');
          if (S.ui.group === 'person') gi.appendChild(makeAvatar(g.person));
          else gi.appendChild(icon(g.key === NO_STORE ? 'store' : 'pin'));
          btn.appendChild(gi);
          btn.appendChild(el('span', 'g-name', g.label));
          var cnt = el('span', 'g-count', '· ' + g.items.length);
          btn.appendChild(cnt);
          var rule = el('span', 'g-rule'); rule.setAttribute('aria-hidden', 'true');
          btn.appendChild(rule);
          btn.appendChild(icon('chev', 'chev'));
          btn.setAttribute('aria-label', g.label + ', ' + plural(g.items.length, 'item', 'items'));
          btn.addEventListener('click', function () {
            var now = btn.getAttribute('aria-expanded') === 'true';
            btn.setAttribute('aria-expanded', String(!now));
            $(listId).hidden = now;
            if (now) S.ui.collapsed[ck] = true; else delete S.ui.collapsed[ck];
            B.saveUI();
          });
          h.appendChild(btn);
          var shb = el('button', 'icon-btn g-share');
          shb.type = 'button';
          shb.setAttribute('aria-haspopup', 'dialog');
          shb.setAttribute('aria-label', 'Share ' + (S.ui.group === 'person' ? 'items from ' : '') + g.label);
          shb.title = 'Share ' + g.label;
          shb.appendChild(icon('share'));
          shb.addEventListener('click', function () { if (B.openShare) B.openShare({ mode: S.ui.group, key: g.key }, shb); });
          h.appendChild(shb);
          sec.appendChild(h);
          var ul2 = el('ul', 'rows');
          ul2.id = listId;
          ul2.hidden = collapsed;
          g.items.forEach(function (i) { ul2.appendChild(makeRow(i, { showStore: showStore })); });
          sec.appendChild(ul2);
          groupsEl.appendChild(sec);
        });
      }
    }

    // completed
    var comp = $('completed');
    comp.hidden = dn.length === 0;
    $('doneCount').textContent = '· ' + dn.length;
    var doneList = $('doneList');
    doneList.textContent = '';
    dn.forEach(function (i) { doneList.appendChild(makeRow(i, { showStore: !S.filter })); });
    doneList.hidden = !S.showDone;
    $('doneToggle').setAttribute('aria-expanded', String(S.showDone));
    $('clearDone').textContent = S.filter ? 'Clear these' : 'Clear completed';
  }

  function makeRow(item, opts) {
    var li = el('li', 'row' + (item.done ? ' is-done static' : ''));
    li.dataset.id = item.id;

    var lab = el('label', 'check');
    var cb = el('input');
    cb.type = 'checkbox';
    cb.checked = item.done;
    cb.setAttribute('aria-label', (item.done ? 'Done: ' : 'Mark done: ') + item.name);
    var box = el('span', 'box');
    box.appendChild(icon('check'));
    lab.appendChild(cb);
    lab.appendChild(box);
    cb.addEventListener('change', function () { B.onCheck(item.id, cb.checked, li, cb); });

    var main = el('button', 'row-main');
    main.type = 'button';
    main.setAttribute('aria-haspopup', 'dialog');
    var photo = B.itemPhoto ? B.itemPhoto(item.id) : '';
    if (photo) {
      var th = el('img', 'row-thumb');
      th.src = photo;
      th.alt = '';                 // decorative here; the name is right next to it
      th.loading = 'lazy';
      main.appendChild(th);
    }
    var text = el('span', 'row-text');
    var name = el('span', 'row-name');
    name.appendChild(document.createTextNode(item.name));
    var strike = document.createElementNS(SVGNS, 'svg');
    strike.setAttribute('class', 'strike');
    strike.setAttribute('viewBox', '0 0 100 12');
    strike.setAttribute('preserveAspectRatio', 'none');
    strike.setAttribute('aria-hidden', 'true');
    var sp = document.createElementNS(SVGNS, 'path');
    sp.setAttribute('d', 'M1 7.2 C 14 5.2, 26 7.8, 40 6.2 S 66 4.6, 80 6.6 S 94 6.8, 99 5.4');
    sp.setAttribute('pathLength', '1');
    strike.appendChild(sp);
    name.appendChild(strike);
    text.appendChild(name);

    var meta = el('span', 'row-meta');
    meta.appendChild(el('span', 'qty-pill', qtyLabel(item.qty, item.unit)));
    if (item.option) {
      meta.appendChild(el('span', 'tag t-' + (TONES[item.option] || 'other'), item.option));
    }
    if (opts.showStore && item.store) {
      var sb = el('span', 'meta-bit');
      sb.appendChild(icon('pin'));
      sb.appendChild(document.createTextNode(item.store));
      meta.appendChild(sb);
    }
    if (item.note || item.message) {
      var nb = el('span', 'meta-bit');
      nb.appendChild(icon(item.note ? 'note' : 'msg'));
      nb.appendChild(el('span', 'sr-only', item.note && item.message ? 'Has a note and a message' : item.note ? 'Has a note' : 'Has a message'));
      nb.title = item.note || item.message;
      meta.appendChild(nb);
    }
    var by = el('span', 'sr-only', ', added by ' + (item.addedBy || 'unknown'));
    meta.appendChild(by);
    text.appendChild(meta);
    main.appendChild(text);
    main.appendChild(makeAvatar(item.addedBy));
    main.addEventListener('click', function () { B.openDetails(item.id, main); });

    li.appendChild(lab);
    li.appendChild(main);
    return li;
  }
  /* ---------- Stats / people / stores panel ---------- */
  function renderStats() {
    var pending = S.items.filter(function (i) { return !i.done; });
    var done = S.items.filter(function (i) { return i.done; });
    $('statTotal').textContent = S.items.length;
    $('statPending').textContent = pending.length;
    $('statDone').textContent = done.length;
    $('statTotalUnits').textContent = B.unitSummary(S.items);
    $('statPendingUnits').textContent = B.unitSummary(pending);
    $('statDoneUnits').textContent = B.unitSummary(done);
  }

  function renderPeople() {
    var list = $('peopleList');
    list.textContent = '';
    var ps = B.people();
    if (!ps.length) {
      var li0 = el('li');
      li0.appendChild(el('p', 'muted-note', 'People show up here as they add items.'));
      list.appendChild(li0);
      return;
    }
    var current = key($('cBy').value || B.loadLastUser());
    ps.forEach(function (p) {
      var li = el('li');
      var b = el('button', 'person' + (p.key === current ? ' current' : ''));
      b.type = 'button';
      b.setAttribute('aria-label', p.name + ', ' + p.pending + ' to buy. Add items as ' + p.name);
      b.appendChild(makeAvatar(p.name));
      b.appendChild(el('span', 'person-name', p.name));
      b.appendChild(el('span', 'person-sub', p.pending ? p.pending + ' to buy' : 'all done'));
      b.addEventListener('click', function () {
        $('cBy').value = p.name;
        B.renderComposerHint(); renderPeople(); refreshOptions();
        B.setView('list');
        $('cName').focus();
        toast('Adding items as ' + p.name);
      });
      li.appendChild(b);
      list.appendChild(li);
    });
  }




  function refreshOptions() {
    var pl = $('peopleOptions'), sl = $('storeOptions');
    pl.textContent = ''; sl.textContent = '';
    var ps = B.people();
    var last = B.loadLastUser();
    if (last && !ps.some(function (p) { return p.key === key(last); })) ps.push({ name: last, key: key(last) });
    ps.forEach(function (p) { var o = el('option'); o.value = p.name; pl.appendChild(o); });
    var ss = B.allStores();
    ss.forEach(function (s) { var o = el('option'); o.value = s.name; sl.appendChild(o); });

    // quick-pick chips in the composer
    var bq = $('cByQuick'), sq = $('cStoreQuick');
    bq.textContent = ''; sq.textContent = '';
    var curBy = key($('cBy').value), curStore = key($('cStore').value);
    ps.slice(0, 6).forEach(function (p) {
      var b = el('button');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(p.key === curBy));
      b.appendChild(makeAvatar(p.name));
      b.appendChild(document.createTextNode(p.name));
      b.addEventListener('click', function () { $('cBy').value = p.name; refreshOptions(); B.renderComposerHint(); renderPeople(); });
      bq.appendChild(b);
    });
    ss.slice(0, 8).forEach(function (s) {
      var b = el('button', 'no-av', s.name);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(s.key === curStore));
      b.addEventListener('click', function () {
        $('cStore').value = s.key === curStore ? '' : s.name;
        refreshOptions(); B.renderComposerHint();
      });
      sq.appendChild(b);
    });
  }
  /* ---------- Toast ---------- */
  function hideToast() {
    clearTimeout(S.toastTimer);
    var t = document.querySelector('#toastRegion .toast');
    if (!t) return;
    t.classList.remove('show');
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, reduced() ? 0 : 220);
  }
  function toast(msg, undo) {
    var reg = $('toastRegion');
    clearTimeout(S.toastTimer);
    reg.textContent = '';
    var t = el('div', 'toast');
    t.appendChild(el('span', 'toast-msg', msg));
    if (undo) {
      var b = el('button', 'toast-undo', 'Undo');
      b.type = 'button';
      b.addEventListener('click', function () { hideToast(); undo(); });
      t.appendChild(b);
    }
    var x = el('button', 'icon-btn toast-x');
    x.type = 'button';
    x.setAttribute('aria-label', 'Dismiss');
    x.appendChild(icon('x'));
    x.addEventListener('click', hideToast);
    t.appendChild(x);
    reg.appendChild(t);
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add('show'); }); });
    var start = function (ms) { clearTimeout(S.toastTimer); S.toastTimer = setTimeout(hideToast, ms); };
    start(5000);
    t.addEventListener('mouseenter', function () { clearTimeout(S.toastTimer); });
    t.addEventListener('mouseleave', function () { start(2500); });
    t.addEventListener('focusin', function () { clearTimeout(S.toastTimer); });
    t.addEventListener('focusout', function () { start(2500); });
  }
})(window.Baska = window.Baska || {});
