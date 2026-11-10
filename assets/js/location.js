/* Baska: geolocation + Places proximity alerts, banner and notification (ported from the original). */
(function (B) {
  'use strict';
  var S = B.state || (B.state = {});
  var NO_STORE = B.NO_STORE, SVGNS = B.SVGNS, TONES = B.TONES, AVATAR_HUES = B.AVATAR_HUES, mq = B.mq, mqReduce = B.mqReduce, mqWide = B.mqWide, mqDark = B.mqDark, escapeHTML = B.escapeHTML, $ = B.$, el = B.el, icon = B.icon, reduced = B.reduced, isWide = B.isWide, key = B.key, round = B.round, qtyLabel = B.qtyLabel, plural = B.plural, newId = B.newId, findItem = B.findItem, rowEl = B.rowEl, parseQty = B.parseQty, hueFor = B.hueFor, makeAvatar = B.makeAvatar, bindStepper = B.bindStepper, trapFocus = B.trapFocus;
  var STORAGE_KEY = B.STORAGE_KEY, STORES_KEY = B.STORES_KEY, UI_KEY = B.UI_KEY;

  /* ---------- Exports (function declarations are hoisted) ---------- */
  B.calculateDistance = calculateDistance;
  B.mapsReady = mapsReady;
  B.searchNearbyPlaces = searchNearbyPlaces;
  B.checkProximity = checkProximity;
  B.showLocationNotification = showLocationNotification;
  B.hideLocationBanner = hideLocationBanner;
  B.setLocState = setLocState;
  B.renderLocation = renderLocation;
  B.enableLocationTracking = enableLocationTracking;
  B.disableLocationTracking = disableLocationTracking;
  /* ---------- Geolocation & proximity (ported from the original) ---------- */
  function calculateDistance(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lng1 || !lat2 || !lng2) return Infinity;
    var R = 3959; // Earth's radius in miles
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  function mapsReady() {
    return typeof google !== 'undefined' && !!google.maps && !!google.maps.places;
  }
  function searchNearbyPlaces(storeName, callback) {
    if (!S.userPosition || !mapsReady()) { callback([]); return; }
    var cacheKey = storeName.toLowerCase();
    if (S.nearbyPlacesCache[cacheKey] && Date.now() - S.nearbyPlacesCache[cacheKey].timestamp < 60000) {
      callback(S.nearbyPlacesCache[cacheKey].places); // cached for 1 minute
      return;
    }
    try {
      var service = new google.maps.places.PlacesService(document.createElement('div'));
      var request = {
        location: new google.maps.LatLng(S.userPosition.lat, S.userPosition.lng),
        radius: 4828, // 3 miles in meters
        query: storeName
      };
      service.textSearch(request, function (results, status) {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          var places = results.map(function (place) {
            return { name: place.name, lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
          });
          S.nearbyPlacesCache[cacheKey] = { places: places, timestamp: Date.now() };
          callback(places);
        } else {
          callback([]);
        }
      });
    } catch (e) {
      callback([]);
    }
  }
  function checkProximity() {
    if (!S.userPosition) return;
    var now = Date.now();
    if (now - S.lastNotificationTime < 300000) return; // throttle: 5 minutes
    var storeNames = {};
    S.items.forEach(function (i) { if (!i.done && i.store) storeNames[i.store.toLowerCase()] = i.store; });
    var storeNamesArray = Object.keys(storeNames);
    if (storeNamesArray.length === 0) return;
    var completed = 0, nearbyStores = [];
    storeNamesArray.forEach(function (storeName) {
      searchNearbyPlaces(storeName, function (places) {
        completed++;
        places.forEach(function (place) {
          var distance = calculateDistance(S.userPosition.lat, S.userPosition.lng, place.lat, place.lng);
          if (distance <= 3) {
            if (place.name.toLowerCase().includes(storeName) || storeName.includes(place.name.toLowerCase())) {
              nearbyStores.push({ name: place.name, distance: distance.toFixed(1) });
            }
          }
        });
        if (completed === storeNamesArray.length && nearbyStores.length > 0) {
          S.lastNotificationTime = now;
          var message = nearbyStores.length === 1
            ? 'You\'re near ' + nearbyStores[0].name + ' (' + nearbyStores[0].distance + ' mi) with items to buy!'
            : 'You\'re near ' + nearbyStores.length + ' stores with items to buy!';
          showLocationNotification(message);
        }
      });
    });
  }
  function showLocationNotification(message) {
    $('locationMessage').textContent = message;
    $('locationBanner').classList.add('show');
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Nearby Store Alert', { body: message }); } catch (e) { /* e.g. mobile needs a service worker */ }
    }
  }
  function hideLocationBanner() { $('locationBanner').classList.remove('show'); }
  window.hideLocationBanner = hideLocationBanner;
  $('locDismiss').addEventListener('click', hideLocationBanner);

  function setLocState(state, msg) { S.locState = state; S.locMsg = msg || ''; renderLocation(); }
  function renderLocation() {
    var pill = $('locPill');
    pill.dataset.state = S.locState;
    var full = { off: 'Alerts off', on: 'Alerts on', pending: 'Locating…', unavailable: 'No location' }[S.locState];
    $('locPillText').textContent = full;
    pill.setAttribute('aria-label', 'Nearby store alerts: ' + full.toLowerCase().replace('…', '') + '. Open stores');
    $('locCard').dataset.state = S.locState;
    var sw = $('locSwitch');
    sw.setAttribute('aria-checked', String(S.locState === 'on' || S.locState === 'pending'));
    $('locStatus').textContent = S.locMsg;
  }
  function enableLocationTracking() {
    if (!navigator.geolocation) {
      setLocState('unavailable', 'This browser cannot share your location, so nearby alerts are not available here.');
      return;
    }
    if ('Notification' in window && Notification.permission === 'default') {
      try { var p = Notification.requestPermission(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ }
    }
    setLocState('pending', 'Finding your location…');
    try {
      navigator.geolocation.getCurrentPosition(
        function (position) {
          S.userPosition = { lat: position.coords.latitude, lng: position.coords.longitude };
          setLocState('on', mapsReady()
            ? 'On. Watching for stores on your list within 3 miles.'
            : 'On, but store lookup needs Google Maps, which has not loaded. Alerts start once it is available.');
          checkProximity();
          if (S.watchId) navigator.geolocation.clearWatch(S.watchId);
          S.watchId = navigator.geolocation.watchPosition(
            function (pos) {
              S.userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              S.nearbyPlacesCache = {}; // position changed
              checkProximity();
            },
            function (error) {
              if (error && error.code === 1) {
                disableLocationTracking();
                setLocState('unavailable', 'Location permission was turned off. Allow it in your browser settings to get nearby alerts.');
              }
            },
            { enableHighAccuracy: true, maximumAge: 30000, timeout: 27000 }
          );
        },
        function (error) {
          S.userPosition = null;
          setLocState('unavailable', error && error.code === 1
            ? 'Location permission was denied. Allow it in your browser settings, then try again.'
            : 'Could not get your location. Check that location services are on and try again.');
        }
      );
    } catch (e) {
      setLocState('unavailable', 'Could not get your location in this browser.');
    }
  }
  function disableLocationTracking() {
    if (S.watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(S.watchId);
    S.watchId = null;
    S.userPosition = null;
    S.nearbyPlacesCache = {};
    setLocState('off', '');
  }
  $('locSwitch').addEventListener('click', function () {
    if (S.locState === 'on' || S.locState === 'pending') disableLocationTracking();
    else enableLocationTracking();
  });
  $('locPill').addEventListener('click', function () {
    B.setView('stores');
    var card = $('locCard');
    if (card.scrollIntoView) card.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    $('locSwitch').focus({ preventScroll: true });
  });
})(window.Baska = window.Baska || {});
