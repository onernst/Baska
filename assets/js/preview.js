/* Baska: item preview in the details drawer, for low-vision use.
   - A large preview: the item's photo if one was added, otherwise the item name in big, high-contrast type.
   - "Read aloud": speaks the item (name, quantity, store, tag, note, message) with the browser's text-to-speech.
   - Optional "read items aloud when I open them" setting (saved in the ui prefs).
   - Add / change / remove a photo (camera or file). Photos are downscaled and stored under their own key. */
(function (B) {
  'use strict';
  var S = B.state || (B.state = {});
  var $ = B.$;

  var MAX_SIDE = 640, QUALITY = 0.72;
  var photos = B.loadPhotos();
  var tts = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  var speakingId = null;

  /* ---------- Photos ---------- */
  B.itemPhoto = function (id) { return photos[id] || ''; };

  function pruneOrphans() {
    if (!S.items) return;
    var ids = {}, changed = false;
    S.items.forEach(function (i) { ids[i.id] = true; });
    Object.keys(photos).forEach(function (id) { if (!ids[id]) { delete photos[id]; changed = true; } });
    if (changed) B.savePhotos(photos);
  }
  // after app.js has loaded the items; deleted items keep their photo until the next visit so Undo still works
  window.addEventListener('load', pruneOrphans);
  window.addEventListener('storage', function (e) { if (e.key === B.PHOTOS_KEY) { photos = B.loadPhotos(); if (S.detailId) showPreview(S.detailId); } });

  function resize(file, done) {
    var reader = new FileReader();
    reader.onerror = function () { done(null); };
    reader.onload = function () {
      var img = new Image();
      img.onerror = function () { done(null); };
      img.onload = function () {
        var scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);   // transparent PNGs → white, not black
        ctx.drawImage(img, 0, 0, w, h);
        try { done(c.toDataURL('image/jpeg', QUALITY)); } catch (err) { done(null); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function setPhotoError(msg) { $('dPhotoError').textContent = msg || ''; }

  /* ---------- Preview ---------- */
  function showPreview(id) {
    var it = B.findItem(id);
    if (!it) return;
    var src = photos[id] || '';
    var img = $('dPhotoImg'), ph = $('dPhotoPh');
    if (src) {
      img.src = src;
      img.alt = 'Photo of ' + it.name;
      img.hidden = false; ph.hidden = true;
    } else {
      img.removeAttribute('src'); img.alt = ''; img.hidden = true; ph.hidden = false;
      $('dPhotoInitial').textContent = it.name.trim().charAt(0).toUpperCase() || '?';
      $('dPhotoName').textContent = it.name;
      var hue = B.AVATAR_HUES[B.hueFor(it.name.toLowerCase()) % B.AVATAR_HUES.length];
      $('dPhoto').style.setProperty('--ph-hue', hue);
    }
    $('dPhoto').classList.toggle('has-photo', !!src);
    $('dPhotoAddText').textContent = src ? 'Change photo' : 'Add photo';
    $('dPhotoRemove').hidden = !src;
    $('dAutoRead').checked = !!(S.ui && S.ui.readAloud);
    setPhotoError('');
  }

  /* ---------- Read aloud ---------- */
  function spokenText(it) {
    var parts = [it.name + '.', B.qtyLabel(it.qty, it.unit) + '.'];
    parts.push(it.done ? 'Already ticked off.' : 'Still to buy.');
    if (it.store) parts.push('Get it at ' + it.store + '.');
    if (it.option) parts.push('Marked ' + it.option + '.');
    if (it.addedBy) parts.push('Added by ' + it.addedBy + '.');
    if (it.note) parts.push('Note: ' + it.note);
    if (it.message) parts.push('Message: ' + it.message);
    return parts.join(' ');
  }
  function setSpeaking(on) {
    $('dSpeak').setAttribute('aria-pressed', String(on));
    $('dSpeakText').textContent = on ? 'Stop reading' : 'Read aloud';
  }
  function stopSpeaking() {
    if (!tts) return;
    speakingId = null;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }
  function speak(id) {
    var it = B.findItem(id);
    if (!it || !tts) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(spokenText(it));
    u.lang = navigator.language || 'en-US';
    u.rate = 0.95;
    u.onend = u.onerror = function () { if (speakingId === id) { speakingId = null; setSpeaking(false); } };
    speakingId = id;
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }
  B.speakItem = speak;

  if (!tts) {
    $('dSpeak').hidden = true;
    document.querySelector('.d-autoread').hidden = true;
  }

  /* ---------- Hook into the details drawer ---------- */
  var openDetails = B.openDetails;
  B.openDetails = function (id, returnEl) {
    stopSpeaking();
    openDetails(id, returnEl);
    showPreview(id);
    if (tts && S.ui && S.ui.readAloud) speak(id);
  };
  $('details').addEventListener('close', stopSpeaking);

  /* ---------- Events ---------- */
  $('dSpeak').addEventListener('click', function () {
    if (!S.detailId) return;
    if (speakingId) stopSpeaking(); else speak(S.detailId);
  });
  $('dAutoRead').addEventListener('change', function (e) {
    S.ui.readAloud = e.target.checked;
    B.saveUI();
    if (e.target.checked && S.detailId && !speakingId) speak(S.detailId);
  });
  $('dPhotoAdd').addEventListener('click', function () { $('dPhotoInput').click(); });
  $('dPhotoInput').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    var id = S.detailId;
    e.target.value = '';                         // allow picking the same file again
    if (!file || !id) return;
    if (!/^image\//.test(file.type)) { setPhotoError('That file is not an image.'); return; }
    setPhotoError('');
    $('dPhotoAddText').textContent = 'Adding…';
    resize(file, function (dataUrl) {
      if (!dataUrl) { showPreview(id); setPhotoError('Could not read that image. Try another photo.'); return; }
      var prev = photos[id];
      photos[id] = dataUrl;
      if (!B.savePhotos(photos)) {
        if (prev) photos[id] = prev; else delete photos[id];
        showPreview(id);
        setPhotoError('Not enough space in this browser to save the photo. Remove photos from other items and try again.');
        return;
      }
      if (S.detailId === id) { showPreview(id); $('dPhotoAdd').focus(); }
      if (B.render) B.render();
    });
  });
  $('dPhotoRemove').addEventListener('click', function () {
    var id = S.detailId;
    if (!id || !photos[id]) return;
    var prev = photos[id];
    delete photos[id];
    B.savePhotos(photos);
    showPreview(id);
    $('dPhotoAdd').focus();
    if (B.render) B.render();
    B.toast('Photo removed', function () { photos[id] = prev; B.savePhotos(photos); if (S.detailId === id) showPreview(id); if (B.render) B.render(); });
  });
})(window.Baska = window.Baska || {});
