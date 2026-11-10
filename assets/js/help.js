/* Baska: floating "bulb" helper.
   A round button (bottom-right) opens "Tips & help": a context tip for what's on the list right now,
   short feature tips with "Show me" actions, and keyboard shortcuts. "?" opens it from the keyboard.
   It glows until opened once; it can be hidden and brought back from Summary → Tips & help. */
(function (B) {
  'use strict';
  var S = B.state, $ = B.$, el = B.el, icon = B.icon, NO_STORE = B.NO_STORE;

  var fab = $('helpFab'), dlg = $('helpDlg');
  var returnFocus = null;

  /* ---------- Helpers ---------- */
  function wide() { return B.isWide ? B.isWide() : window.innerWidth >= 1024; }
  function closeThen(fn) {
    returnFocus = null;            // the action decides where focus goes
    if (dlg.open) dlg.close();
    setTimeout(fn, 60);
  }
  function goList() { if (B.setView) B.setView('list'); }
  function micAvailable() { var m = $('micBtn'); return m && !m.hidden; }
  function firstPendingRow() { return document.querySelector('#groups .row:not(.is-done) .row-main'); }

  /* ---------- Context tip ("Right now") ---------- */
  function contextTip() {
    var items = S.items || [];
    var pending = items.filter(function (i) { return !i.done; });
    var done = items.length - pending.length;
    var noStore = pending.filter(function (i) { return !(i.store || '').trim(); });
    if (!items.length) {
      return { text: 'Your list is empty. Add your first item, or load a few demo items to see how everything works.', btn: 'Load demo items',
        run: function () { closeThen(function () { goList(); B.loadDemo(); }); } };
    }
    if (!pending.length) {
      return { text: 'Everything is ticked off. Clear the finished items to start a fresh list.', btn: 'Clear completed',
        run: function () { closeThen(function () { goList(); $('clearDone').click(); }); } };
    }
    if (noStore.length) {
      return { text: B.plural(noStore.length, 'item has', 'items have') + ' no store yet. Tag them so they group and filter by store, and so you can share a store’s list.', btn: 'Show those items',
        run: function () { closeThen(function () { goList(); B.setFilter(NO_STORE); var r = firstPendingRow(); if (r) r.focus(); }); } };
    }
    if (done >= 3) {
      return { text: B.plural(done, 'ticked-off item is', 'ticked-off items are') + ' still on the list. Clear them to keep it tidy (you can undo).', btn: 'Clear completed',
        run: function () { closeThen(function () { goList(); $('clearDone').click(); }); } };
    }
    return { text: 'Heading out? Send someone just the items for one store, or just what one person asked for.', btn: 'Share the list',
      run: function () { closeThen(function () { goList(); B.openShare(null, $('shareBtn')); }); } };
  }

  /* ---------- Tips ---------- */
  var TIPS = [
    { icon: 'plus', title: 'Add items fast',
      text: 'Type a name and press Enter. The sliders button sets quantity, unit, person and store.',
      btn: 'Try it', run: function () { closeThen(function () { goList(); $('cName').focus(); }); } },
    { icon: 'mic', title: 'Add by voice', when: micAvailable,
      text: 'Tap the mic and say e.g. “two boxes of paper from Costco”. It fills in everything.',
      btn: 'Start', run: function () { closeThen(function () { goList(); $('micBtn').click(); }); } },
    { icon: 'check', title: 'Tick off and undo',
      text: 'Tap the circle to tick an item off. Changed your mind? Tap Undo in the message that appears.' },
    { icon: 'speaker', title: 'Details, photo and read aloud',
      text: 'Tap an item’s name for notes, a photo, and Read aloud — handy if small text is hard to see.',
      btn: 'Open an item', when: function () { return (S.items || []).some(function (i) { return !i.done; }); },
      run: function () { closeThen(function () { goList(); var r = firstPendingRow(); if (r) r.click(); }); } },
    { icon: 'share', title: 'Share by store or person',
      text: 'Send one store’s items, or what one person asked for, by WhatsApp, email or the share menu.',
      btn: 'Share', when: function () { return (S.items || []).length > 0; },
      run: function () { closeThen(function () { goList(); B.openShare(null, $('shareBtn')); }); } },
    { icon: 'pin', title: 'Filter and group',
      text: 'Use the store chips above the list to see one store. Group the list by store, by person, or not at all.' },
    { icon: 'store', title: 'Stores and nearby alerts',
      text: 'Add the stores you use, see how much is waiting at each, and turn on alerts for when you’re close by.',
      btn: 'Open stores', run: function () { closeThen(function () { if (wide()) $('storeName').focus(); else { B.setView('stores'); $('storeName').focus(); } }); } },
    { icon: 'moon', title: 'Light or dark',
      text: 'The moon / sun button at the top switches the theme. It follows your device until you choose.' }
  ];

  function renderTips() {
    var ul = $('hlTips');
    ul.textContent = '';
    TIPS.forEach(function (t) {
      if (t.when && !t.when()) return;
      var li = el('li', 'help-tip');
      var ic = el('span', 'help-tip-icon');
      ic.setAttribute('aria-hidden', 'true');
      ic.appendChild(icon(t.icon));
      var tx = el('div');
      tx.appendChild(el('h3', null, t.title));
      tx.appendChild(el('p', null, t.text));
      li.appendChild(ic);
      li.appendChild(tx);
      if (t.btn && t.run) {
        var b = el('button', 'btn btn-secondary');
        b.type = 'button';
        b.appendChild(document.createTextNode(t.btn));
        b.appendChild(icon('arrow'));
        b.setAttribute('aria-label', t.btn + ': ' + t.title);
        b.addEventListener('click', t.run);
        li.appendChild(b);
      }
      ul.appendChild(li);
    });
  }

  /* ---------- Open / close ---------- */
  function openHelp(from) {
    returnFocus = from || document.activeElement;
    var tip = contextTip();
    $('hlNowText').textContent = tip.text;
    var nb = $('hlNowBtn');
    nb.textContent = tip.btn;
    nb.onclick = tip.run;
    renderTips();
    if (!S.ui.helpSeen) { S.ui.helpSeen = true; B.saveUI(); fab.classList.remove('is-new'); }
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    nb.focus();
  }
  B.openHelp = openHelp;

  dlg.addEventListener('close', function () {
    var t = returnFocus;
    returnFocus = null;
    if (t && t.isConnected && t.offsetParent) t.focus();
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  B.trapFocus(dlg);
  $('hlClose').addEventListener('click', function () { dlg.close(); });

  /* ---------- Show / hide the bulb ---------- */
  function syncFab() {
    fab.hidden = !!S.ui.helpHidden;
    fab.classList.toggle('is-new', !S.ui.helpSeen);
  }
  $('hlHide').addEventListener('click', function () {
    S.ui.helpHidden = true;
    B.saveUI();
    syncFab();
    returnFocus = null;
    dlg.close();
    B.toast('Bulb hidden. Bring it back from Summary → Tips & help.', function () { S.ui.helpHidden = false; B.saveUI(); syncFab(); });
  });
  $('helpLink').addEventListener('click', function () {
    if (S.ui.helpHidden) { S.ui.helpHidden = false; B.saveUI(); syncFab(); }
    openHelp($('helpLink'));
  });
  fab.addEventListener('click', function () { openHelp(fab); });

  // "?" opens help (when not typing and no other panel is open)
  document.addEventListener('keydown', function (e) {
    if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault();
    openHelp(document.activeElement);
  });

  // lift the bulb above a toast on phones so they never overlap
  var region = $('toastRegion');
  if (region && window.MutationObserver) {
    new MutationObserver(function () {
      document.body.classList.toggle('toast-up', !wide() && region.childElementCount > 0);
    }).observe(region, { childList: true });
  }

  // S.ui is ready once app.js has run (it loads before this file)
  syncFab();
})(window.Baska);
