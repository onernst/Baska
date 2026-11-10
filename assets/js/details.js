/* Baska: item details drawer (desktop) / bottom sheet (mobile), focus handling, autosave. */
(function (B) {
  'use strict';
  var S = B.state || (B.state = {});
  var NO_STORE = B.NO_STORE, SVGNS = B.SVGNS, TONES = B.TONES, AVATAR_HUES = B.AVATAR_HUES, mq = B.mq, mqReduce = B.mqReduce, mqWide = B.mqWide, mqDark = B.mqDark, escapeHTML = B.escapeHTML, $ = B.$, el = B.el, icon = B.icon, reduced = B.reduced, isWide = B.isWide, key = B.key, round = B.round, qtyLabel = B.qtyLabel, plural = B.plural, newId = B.newId, findItem = B.findItem, rowEl = B.rowEl, parseQty = B.parseQty, hueFor = B.hueFor, makeAvatar = B.makeAvatar, bindStepper = B.bindStepper, trapFocus = B.trapFocus;
  var STORAGE_KEY = B.STORAGE_KEY, STORES_KEY = B.STORES_KEY, UI_KEY = B.UI_KEY;

  /* ---------- Exports (function declarations are hoisted) ---------- */
  B.openDetails = openDetails;
  B.fillDetails = fillDetails;
  B.updateDetailMinus = updateDetailMinus;
  B.saveDetail = saveDetail;
  B.closeDetails = closeDetails;
  /* ---------- Details drawer / sheet ---------- */
  var detailsDlg = $('details');
  function openDetails(id, returnEl) {
    var it = findItem(id);
    if (!it) return;
    S.detailId = id;
    S.detailReturnFocus = returnEl || null;
    fillDetails(it, true);
    detailsDlg.classList.remove('closing');
    if (!detailsDlg.open) {
      if (typeof detailsDlg.showModal === 'function') detailsDlg.showModal();
      else detailsDlg.setAttribute('open', '');
    }
    $('dClose').focus();
  }
  function fillDetails(it, fields) {
    $('dTitle').textContent = it.name;
    var st = $('dStatus');
    st.textContent = it.done ? 'Completed' : 'To buy';
    st.classList.toggle('done', it.done);
    var meta = $('dMeta');
    meta.textContent = '';
    meta.appendChild(makeAvatar(it.addedBy));
    meta.appendChild(document.createTextNode('Added by ' + (it.addedBy || 'unknown') + ' · ' + qtyLabel(it.qty, it.unit) + (it.store ? ' · ' + it.store : '')));
    $('dToggleText').textContent = it.done ? 'Done · move back to list' : 'Mark as done';
    $('dToggleDone').setAttribute('aria-pressed', String(it.done));
    if (!fields) return;
    var opt = TONES[it.option] || !it.option ? it.option : '';
    Array.prototype.forEach.call(document.querySelectorAll('input[name="dOption"]'), function (r) { r.checked = r.value === opt; });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="dUnit"]'), function (r) { r.checked = r.value === (it.unit === 'box' ? 'box' : 'unit'); });
    $('dQty').value = String(round(it.qty));
    $('dQty').removeAttribute('aria-invalid');
    $('dStepper').removeAttribute('data-invalid');
    $('dQtyError').textContent = '';
    $('dStore').value = it.store || '';
    $('dNote').value = it.note;
    $('dMessage').value = it.message;
    $('dSavedText').textContent = 'Saves automatically';
    $('dSaved').classList.remove('flash');
    updateDetailMinus();
  }
  function updateDetailMinus() {
    var q = parseQty($('dQty').value);
    document.querySelector('#dStepper [data-step="-1"]').disabled = !(q > 1);
  }
  function saveDetail(field, value) {
    var it = S.detailId ? findItem(S.detailId) : null;
    if (!it) return;
    it[field] = value;
    B.save();
    B.render();
    fillDetails(it, false);
    var s = $('dSaved');
    $('dSavedText').textContent = 'Saved';
    s.classList.add('flash');
    clearTimeout(S.savedTimer);
    S.savedTimer = setTimeout(function () { $('dSavedText').textContent = 'Saves automatically'; s.classList.remove('flash'); }, 1600);
  }
  function closeDetails() {
    if (!detailsDlg.open) return;
    if (reduced()) { detailsDlg.close(); return; }
    detailsDlg.classList.add('closing');
    setTimeout(function () { detailsDlg.classList.remove('closing'); if (detailsDlg.open) detailsDlg.close(); }, 190);
  }
  detailsDlg.addEventListener('close', function () {
    var id = S.detailId;
    S.detailId = null;
    var target = null;
    if (id && findItem(id)) {
      var r = rowEl(id);
      if (r && r.offsetParent) target = r.querySelector('.row-main');
    }
    if (!target && S.detailReturnFocus && S.detailReturnFocus.isConnected && S.detailReturnFocus.offsetParent) target = S.detailReturnFocus;
    if (!target) target = isWide() ? $('cName') : $('listTitle');
    S.detailReturnFocus = null;
    target.focus();
  });
  detailsDlg.addEventListener('cancel', function (e) { e.preventDefault(); closeDetails(); });
  detailsDlg.addEventListener('click', function (e) { if (e.target === detailsDlg) closeDetails(); });
  trapFocus(detailsDlg);
  $('dClose').addEventListener('click', closeDetails);

  document.querySelectorAll('input[name="dOption"]').forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) saveDetail('option', r.value); });
  });
  document.querySelectorAll('input[name="dUnit"]').forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) saveDetail('unit', r.value); });
  });
  bindStepper('dStepper', $('dQty'), function () {
    var q = parseQty($('dQty').value);
    updateDetailMinus();
    if (isNaN(q)) {
      $('dQtyError').textContent = 'Quantity must be a positive number.';
      $('dQty').setAttribute('aria-invalid', 'true');
      $('dStepper').setAttribute('data-invalid', 'true');
      return;
    }
    $('dQtyError').textContent = '';
    $('dQty').removeAttribute('aria-invalid');
    $('dStepper').removeAttribute('data-invalid');
    saveDetail('qty', q);
  });
  $('dStore').addEventListener('input', function (e) { saveDetail('store', e.target.value.trim()); });
  $('dNote').addEventListener('input', function (e) { saveDetail('note', e.target.value); });
  $('dMessage').addEventListener('input', function (e) { saveDetail('message', e.target.value); });
  $('dForm').addEventListener('submit', function (e) { e.preventDefault(); });
  $('dToggleDone').addEventListener('click', function () {
    var it = S.detailId ? findItem(S.detailId) : null;
    if (!it) return;
    saveDetail('done', !it.done);
    if (it.done) B.toast(it.name + ' completed', function () { var x = findItem(it.id); if (x) { x.done = false; B.save(); B.render(); if (S.detailId === x.id) fillDetails(x, false); } });
  });
  $('dDelete').addEventListener('click', function () {
    var it = S.detailId ? findItem(S.detailId) : null;
    if (!it) return;
    S.detailReturnFocus = null;
    var id = it.id, nm = it.name;
    closeDetails();
    setTimeout(function () { B.deleteItems([id], 'Deleted ' + nm); }, reduced() ? 0 : 200);
  });
})(window.Baska = window.Baska || {});
