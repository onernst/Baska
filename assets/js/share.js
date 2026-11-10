/* Baska: share the list as plain text, by store, by person, or everything.
   Opened from the "Share" button in the list header (follows the current grouping / filter)
   or from the share icon on a store / person group header (pre-selects that group).
   Sends through the phone's share sheet (Web Share API), Copy, WhatsApp or Email. */
(function (B) {
  'use strict';
  var S = B.state, $ = B.$, el = B.el, key = B.key, NO_STORE = B.NO_STORE;

  var dlg = $('shareDlg');
  var mode = 'store';          // 'store' | 'person' | 'all'
  var picked = {};             // selected group keys for the current mode
  var returnFocus = null;
  var canNativeShare = typeof navigator.share === 'function';

  /* ---------- Grouping ---------- */
  function groupKey(it, m) {
    return m === 'person' ? (key(it.addedBy) || NO_STORE) : (key(it.store) || NO_STORE);
  }
  function groupLabel(it, m) {
    if (m === 'person') return (it.addedBy || '').trim() || 'Unknown';
    return (it.store || '').trim() || 'No store';
  }
  // groups that have something to share, in a stable order ("No store"/"Unknown" last)
  function groups(m, includeDone) {
    var map = {}, order = [];
    S.items.forEach(function (it) {
      if (it.done && !includeDone) return;
      var k = groupKey(it, m);
      if (!map[k]) { map[k] = { key: k, label: groupLabel(it, m), items: [], pending: 0 }; order.push(k); }
      map[k].items.push(it);
      if (!it.done) map[k].pending++;
    });
    if (m === 'store') {
      // follow the order of the stores list where possible
      var rank = {};
      B.allStores().forEach(function (s, i) { rank[s.key] = i; });
      order.sort(function (a, b) {
        if (a === NO_STORE || b === NO_STORE) return (a === NO_STORE) - (b === NO_STORE);
        return (rank[a] == null ? 1e6 : rank[a]) - (rank[b] == null ? 1e6 : rank[b]);
      });
    } else {
      order.sort(function (a, b) { return (a === NO_STORE) - (b === NO_STORE); });
    }
    return order.map(function (k) { return map[k]; });
  }

  /* ---------- Text ---------- */
  function itemLine(it, m, withNotes) {
    var line = (it.done ? '☑ ' : '☐ ') + it.name + ' — ' + B.qtyLabel(it.qty, it.unit);
    if (it.option) line += ' · ' + it.option;
    if (m === 'person' && it.store) line += ' · at ' + it.store.trim();
    var out = [line];
    if (withNotes && it.note) out.push('    Note: ' + it.note.replace(/\s+/g, ' ').trim());
    if (withNotes && it.message) out.push('    Message: ' + it.message.replace(/\s+/g, ' ').trim());
    return out.join('\n');
  }
  function sortForList(items) {
    // to-buy first, then ticked off; keep list order otherwise
    return items.filter(function (i) { return !i.done; }).concat(items.filter(function (i) { return i.done; }));
  }
  function buildText() {
    var includeDone = $('shDone').checked, withNotes = $('shNotes').checked;
    var m = mode === 'all' ? 'store' : mode;
    var gs = groups(m, includeDone).filter(function (g) { return mode === 'all' || picked[g.key]; });
    if (!gs.length) return '';
    var total = gs.reduce(function (n, g) { return n + g.pending; }, 0);

    var title;
    if (mode === 'all') title = 'Shopping list';
    else if (gs.length === 1) title = mode === 'store' ? 'Shopping list · ' + gs[0].label : 'Shopping list · from ' + gs[0].label;
    else title = 'Shopping list · ' + gs.map(function (g) { return g.label; }).join(', ');
    var date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

    var lines = [title, B.plural(total, 'item', 'items') + ' to buy · ' + date];
    gs.forEach(function (g) {
      lines.push('');
      var head = mode === 'person' ? 'From ' + g.label : g.label;
      lines.push(head.toUpperCase() + ' (' + g.pending + ' to buy)');
      sortForList(g.items).forEach(function (it) { lines.push(itemLine(it, mode, withNotes)); });
    });
    lines.push('', '— shared from Baska');
    return lines.join('\n');
  }

  /* ---------- Dialog rendering ---------- */
  function renderChips() {
    var wrap = $('shChips');
    wrap.textContent = '';
    $('shPickWrap').hidden = mode === 'all';
    if (mode === 'all') return;
    $('shPickLabel').textContent = mode === 'store' ? 'Stores to include' : 'People to include';
    var gs = groups(mode, $('shDone').checked);
    gs.forEach(function (g) {
      var b = el('button');
      b.type = 'button';
      if (mode === 'person') b.appendChild(B.makeAvatar(g.key === NO_STORE ? '' : g.label));
      else b.className = 'no-av';
      b.appendChild(document.createTextNode(g.label + ' '));
      b.appendChild(el('span', 'n', String(g.pending)));
      b.setAttribute('aria-pressed', String(!!picked[g.key]));
      b.setAttribute('aria-label', g.label + ', ' + g.pending + ' to buy');
      b.addEventListener('click', function () {
        if (picked[g.key]) delete picked[g.key]; else picked[g.key] = true;
        b.setAttribute('aria-pressed', String(!!picked[g.key]));
        update();
      });
      wrap.appendChild(b);
    });
    var allOn = gs.length && gs.every(function (g) { return picked[g.key]; });
    $('shAll').textContent = allOn ? 'Clear selection' : 'Select all';
    $('shAll').hidden = !gs.length;
    if (!gs.length) wrap.appendChild(el('p', 'share-status', mode === 'store' ? 'No stores have items yet.' : 'No items yet.'));
  }
  function update() {
    var text = buildText();
    $('shPreview').value = text || (mode === 'all' ? 'Nothing to share yet.' : 'Pick at least one ' + (mode === 'store' ? 'store' : 'person') + ' to share.');
    var off = !text;
    ['shNative', 'shCopy'].forEach(function (id) { $(id).disabled = off; });
    ['shWhatsApp', 'shEmail'].forEach(function (id) {
      var a = $(id);
      a.setAttribute('aria-disabled', String(off));
      if (off) { a.removeAttribute('href'); return; }
    });
    if (!off) {
      $('shWhatsApp').href = 'https://wa.me/?text=' + encodeURIComponent(text);
      var subject = text.split('\n')[0];
      $('shEmail').href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
    }
    var gs = mode === 'all' ? [] : groups(mode, $('shDone').checked);
    var allOn = gs.length && gs.every(function (g) { return picked[g.key]; });
    $('shAll').textContent = allOn ? 'Clear selection' : 'Select all';
    status('');
  }
  function status(msg) { $('shStatus').textContent = msg; }

  /* ---------- Open / close ---------- */
  // opts: { mode: 'store'|'person'|'all', key: groupKey }
  function openShare(opts, from) {
    opts = opts || {};
    returnFocus = from || document.activeElement;
    mode = opts.mode || (S.ui.group === 'person' ? 'person' : S.ui.group === 'store' ? 'store' : 'all');
    picked = {};
    if (opts.key) picked[opts.key] = true;
    else if (mode === 'store' && S.filter) picked[S.filter] = true;
    else if (mode !== 'all') groups(mode, false).forEach(function (g) { picked[g.key] = true; });
    document.querySelector('input[name="shMode"][value="' + mode + '"]').checked = true;
    renderChips();
    update();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    (canNativeShare ? $('shNative') : $('shCopy')).focus();
  }
  B.openShare = openShare;

  function closeShare() { if (dlg.open) dlg.close(); }
  dlg.addEventListener('close', function () {
    // the group button may have been re-rendered while the dialog was open; fall back to the main Share button
    var t = returnFocus && returnFocus.isConnected && returnFocus.offsetParent ? returnFocus : $('shareBtn');
    if (t && t.offsetParent) t.focus();
    returnFocus = null;
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeShare(); });
  B.trapFocus(dlg);

  /* ---------- Events ---------- */
  $('shNative').hidden = !canNativeShare;
  $('shareBtn').addEventListener('click', function () { openShare(null, $('shareBtn')); });
  $('shClose').addEventListener('click', closeShare);

  document.querySelectorAll('input[name="shMode"]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      mode = r.value;
      picked = {};
      if (mode !== 'all') groups(mode, $('shDone').checked).forEach(function (g) { picked[g.key] = true; });
      renderChips();
      update();
    });
  });
  $('shAll').addEventListener('click', function () {
    var gs = groups(mode, $('shDone').checked);
    var allOn = gs.every(function (g) { return picked[g.key]; });
    picked = {};
    if (!allOn) gs.forEach(function (g) { picked[g.key] = true; });
    renderChips();
    update();
  });
  $('shDone').addEventListener('change', function () { renderChips(); update(); });
  $('shNotes').addEventListener('change', update);

  $('shNative').addEventListener('click', function () {
    var text = buildText();
    if (!text) return;
    navigator.share({ title: text.split('\n')[0], text: text })
      .then(function () { status('Shared.'); })
      .catch(function (err) { if (err && err.name !== 'AbortError') status('Could not open the share menu. Use Copy instead.'); });
  });
  $('shCopy').addEventListener('click', function () {
    var text = buildText();
    if (!text) return;
    function fallback() {
      var ta = $('shPreview');
      ta.focus(); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      status(ok ? 'Copied to clipboard.' : 'Select the text above and copy it.');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { status('Copied to clipboard.'); }, fallback);
    } else fallback();
  });
})(window.Baska);
