(function () {
  'use strict';

  // Unified Lampa installer:
  // - loads the z01.online balanceer stack (online.js + lampac-src-filter.js)
  // - removes trailers
  // - removes Shots/Shorts button
  // - does not touch Lampa's native "Watch" button
  // - guards against duplicate initialization

  if (window.lampa_z01_unified_v1) return;
  window.lampa_z01_unified_v1 = true;

  var VERSION = '1.0.0';
  var HOST = 'http://z01.online/';

  function removeUnwantedUI(root) {
    try {
      var scope = root && root.querySelectorAll ? root : document;
      var selectors = [
        '.view--trailer',
        '[data-action="trailer"]',
        '.shots-view-button',
        '.view--shots'
      ];

      selectors.forEach(function (selector) {
        try {
          $(scope).find(selector).remove();
        } catch (e) {}
      });

      // Some Lampa builds render the button dynamically or use extra wrappers.
      try {
        $('.shots-view-button, .view--shots, .view--trailer').remove();
      } catch (e) {}
    } catch (e) {}
  }

  function disableTorrentSetting() {
    safe(function () {
      if (window.lampa_settings) {
        window.lampa_settings.torrents_use = false;
      }
    });

    // Some Lampa builds expose SettingsApi instead of only lampa_settings.
    safe(function () {
      if (Lampa.SettingsApi && typeof Lampa.SettingsApi.addParam === 'function') {
        // Do not create a new user-facing toggle; force the intended unified UI.
        if (window.lampa_settings) window.lampa_settings.torrents_use = false;
      }
    });
  }

  function installUiCleaner() {
    if (window.lampa_z01_unified_ui_cleaner) return;
    window.lampa_z01_unified_ui_cleaner = true;

    // Clean every full-card render so async buttons cannot come back.
    Lampa.Listener.follow('full', function (e) {
      if (e.type === 'complite' || e.type === 'complete') {
        setTimeout(function () {
          removeUnwantedUI(e.object && e.object.activity ? e.object.activity.render() : document);
        }, 0);
        setTimeout(function () {
          removeUnwantedUI(document);
        }, 150);
      }
    });

    // Also clean the DOM when a build creates Shots/Trailer controls later.
    if (window.MutationObserver && !window.lampa_z01_unified_observer) {
      window.lampa_z01_unified_observer = new MutationObserver(function () {
        removeUnwantedUI(document);
      });

      try {
        window.lampa_z01_unified_observer.observe(document.documentElement, {
          childList: true,
          subtree: true
        });
      } catch (e) {}
    }

    // Initial pass.
    removeUnwantedUI(document);
  }

  function loadZ01() {
    if (window.lampa_z01_unified_loaded) return;
    window.lampa_z01_unified_loaded = true;

    var scripts = [
      HOST + 'online.js',
      HOST + 'lampac-src-filter.js'
    ];

    // Preferred Lampa loader used by z01's own entrypoint.
    if (Lampa.Utils && typeof Lampa.Utils.putScriptAsync === 'function') {
      try {
        Lampa.Utils.putScriptAsync(scripts, function () {
          removeUnwantedUI(document);
          window.lampa_z01_unified_ready = true;
        });
        return;
      } catch (e) {}
    }

    // Fallback for older Lampa builds without putScriptAsync.
    var index = 0;
    function next() {
      if (index >= scripts.length) {
        window.lampa_z01_unified_ready = true;
        removeUnwantedUI(document);
        return;
      }

      var script = document.createElement('script');
      script.async = true;
      script.src = scripts[index++];
      script.onload = next;
      script.onerror = next;
      (document.head || document.documentElement).appendChild(script);
    }

    next();
  }

  function start() {
    installUiCleaner();
    loadZ01();

    // One more cleanup after external plugins have initialized.
    setTimeout(function () {
      removeUnwantedUI(document);
    }, 800);

    setTimeout(function () {
      removeUnwantedUI(document);
    }, 2000);
  }

  if (window.appready) {
    start();
  } else {
    Lampa.Listener.follow('app', function (event) {
      if (event.type === 'ready') start();
    });
  }

  // Informational marker for debugging in Lampa console.
  window.lampa_z01_unified = {
    version: VERSION,
    online: HOST + 'online.js',
    sourceFilter: HOST + 'lampac-src-filter.js',
    trailers: false,
    shots: false
  };
})();
