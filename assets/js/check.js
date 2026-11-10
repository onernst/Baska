/* Baska: check module - validates items every 2 minutes to ensure each has a store and person assigned. */
(function (B) {
  'use strict';
  var S = B.state || (B.state = {});
  var $ = B.$, key = B.key;
  
  /* ---------- Configuration ---------- */
  var CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes in milliseconds
  var checkTimer = null;
  
  /* ---------- Validation ---------- */
  function validateItems() {
    var items = S.items || [];
    var incomplete = [];
    
    items.forEach(function (item) {
      var hasStore = !!key(item.store);
      var hasPerson = !!key(item.addedBy);
      
      if (!hasStore || !hasPerson) {
        incomplete.push({
          id: item.id,
          name: item.name,
          hasStore: hasStore,
          hasPerson: hasPerson
        });
      }
    });
    
    if (incomplete.length > 0) {
      reportIncomplete(incomplete);
    }
    
    return incomplete;
  }
  
  /* ---------- Reporting ---------- */
  function reportIncomplete(incomplete) {
    var message = 'Items missing store or person:\n';
    incomplete.forEach(function (item) {
      message += '- ' + item.name;
      if (!item.hasStore) message += ' (no store)';
      if (!item.hasPerson) message += ' (no person)';
      message += '\n';
    });
    
    console.warn('[Baska Check] ' + message);
    
    // Optionally show a toast notification
    if (B.toast) {
      B.toast(incomplete.length + ' item(s) missing store or person', null, 5000);
    }
  }
  
  /* ---------- Timer Management ---------- */
  function startCheck() {
    stopCheck();
    checkTimer = setInterval(validateItems, CHECK_INTERVAL);
    console.log('[Baska Check] Started validation interval (' + (CHECK_INTERVAL / 1000) + 's)');
  }
  
  function stopCheck() {
    if (checkTimer) {
      clearInterval(checkTimer);
      checkTimer = null;
      console.log('[Baska Check] Stopped validation interval');
    }
  }
  
  function runImmediateCheck() {
    console.log('[Baska Check] Running immediate validation...');
    return validateItems();
  }
  
  /* ---------- Exports ---------- */
  B.startItemCheck = startCheck;
  B.stopItemCheck = stopCheck;
  B.runItemCheck = runImmediateCheck;
  
  /* ---------- Auto-start ---------- */
  // Start the check when the module loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startCheck);
  } else {
    startCheck();
  }
  
  // Run an initial check
  setTimeout(runImmediateCheck, 1000);
  
})(window.Baska = window.Baska || {});
