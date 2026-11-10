/* Baska: localStorage persistence (same keys + sanitizing as the original app) and UI prefs. */
(function (B) {
  'use strict';
  var S = B.state || (B.state = {});

  /* ---------- Exports (function declarations are hoisted) ---------- */
  B.load = load;
  B.loadStores = loadStores;
  B.save = save;
  B.saveStores = saveStores;
  B.loadLastUser = loadLastUser;
  B.saveLastUser = saveLastUser;
  B.loadUI = loadUI;
  B.saveUI = saveUI;

  var STORAGE_KEY = 'itemChecklistDashboard.v1';
  var STORES_KEY = 'itemChecklistDashboard.stores';
  var UI_KEY = 'itemChecklistDashboard.ui';
  /* ---------- Persistence (same keys + shape as the original) ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.filter(function (i) {
        return i && typeof i.name === 'string' && typeof i.id === 'string';
      }).map(function (i) {
        return {
          id: i.id, name: i.name, qty: Number(i.qty) || 1, done: !!i.done,
          addedBy: typeof i.addedBy === 'string' ? i.addedBy : '',
          note: typeof i.note === 'string' ? i.note : '',
          option: typeof i.option === 'string' ? i.option : '',
          message: typeof i.message === 'string' ? i.message : '',
          store: typeof i.store === 'string' ? i.store : '',
          unit: typeof i.unit === 'string' ? i.unit : 'unit'
        };
      });
    } catch (e) {
      return [];
    }
  }
  function loadStores() {
    try {
      var raw = localStorage.getItem(STORES_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.filter(function (s) { return s && typeof s.name === 'string'; })
        .map(function (s) { return { name: s.name }; });
    } catch (e) {
      return [];
    }
  }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S.items)); } catch (e) { /* session only */ } }
  function saveStores() { try { localStorage.setItem(STORES_KEY, JSON.stringify(S.stores)); } catch (e) { /* ignore */ } }
  function loadLastUser() { try { return localStorage.getItem(STORAGE_KEY + '.lastUser') || ''; } catch (e) { return ''; } }
  function saveLastUser(v) { try { localStorage.setItem(STORAGE_KEY + '.lastUser', v); } catch (e) { /* ignore */ } }
  function loadUI() {
    var d = { group: 'store', theme: '', collapsed: {}, filter: null, lastStore: '' };
    try {
      var raw = localStorage.getItem(UI_KEY);
      if (!raw) return d;
      var p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return d;
      if (p.group === 'store' || p.group === 'person' || p.group === 'none') d.group = p.group;
      if (p.theme === 'light' || p.theme === 'dark') d.theme = p.theme;
      if (p.collapsed && typeof p.collapsed === 'object') d.collapsed = p.collapsed;
      if (typeof p.filter === 'string') d.filter = p.filter;
      if (typeof p.lastStore === 'string') d.lastStore = p.lastStore;
      if (typeof p.readAloud === 'boolean') d.readAloud = p.readAloud;
      if (typeof p.helpSeen === 'boolean') d.helpSeen = p.helpSeen;
      if (typeof p.helpHidden === 'boolean') d.helpHidden = p.helpHidden;
    } catch (e) { /* defaults */ }
    return d;
  }
  function saveUI() { try { localStorage.setItem(UI_KEY, JSON.stringify(S.ui)); } catch (e) { /* ignore */ } }

  /* ---------- Item photos ----------
     Kept under their own key ({ itemId: dataURL }) so the items array keeps the original app's shape
     and a full photo store can never stop the list itself from saving. */
  var PHOTOS_KEY = 'itemChecklistDashboard.photos';
  B.loadPhotos = function () {
    try {
      var p = JSON.parse(localStorage.getItem(PHOTOS_KEY) || '{}');
      return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
    } catch (e) { return {}; }
  };
  // returns false when the browser refuses (usually storage full)
  B.savePhotos = function (photos) {
    try { localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos)); return true; } catch (e) { return false; }
  };
  B.PHOTOS_KEY = PHOTOS_KEY;

  /* ---------- Exported constants ---------- */
  B.STORAGE_KEY = STORAGE_KEY;
  B.STORES_KEY = STORES_KEY;
  B.UI_KEY = UI_KEY;
})(window.Baska = window.Baska || {});
