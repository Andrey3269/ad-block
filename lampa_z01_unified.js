(function () {
  'use strict';

  // Unified Lampa installer:
  // - loads the z01.online balanceer stack (online.js + lampac-src-filter.js)
  // - removes trailers, shots, and torrents
  // - does not touch Lampa's native "Watch" button
  // - guards against duplicate initialization

  if (window.lampa_z01_unified_v1) return;
  window.lampa_z01_unified_v1 = true;

  var VERSION = '1.0.1';
  var HOST = 'http://z01.online/';

  function removeUnwantedUI(root) {
    try {
      var scope = root && root.querySelectorAll ? root : document;
      var selectors = [
        '.view--trailer',
        '[data-action="trailer"]',
        '.shots-view-button',
        '.view--shots',
        '.view--torrent',          // Добавлено скрытие кнопки торрента
        '[data-action="torrent"]'  // Добавлено скрытие кнопки торрента
      ];

      selectors.forEach(function (selector) {
        try {
          $(scope).find(selector).remove();
        } catch (e) {}
      });

      try {
        $('.shots-view-button, .view--shots, .view--trailer, .view--torrent, [data-action="torrent"]').remove();
      } catch (e) {}
    } catch (e) {}
  }

  function disableTorrentSetting() {
    // Заменили несуществующий safe() на стандартный try...catch
    try {
      if (window.lampa_settings) {
        window.lampa_settings.torrents_use = false;
      }
    } catch (e) {}

    try {
      if (window.Lampa && window.Lampa.SettingsApi && typeof window.Lampa.SettingsApi.addParam === 'function') {
        if (window.lampa_settings) window.lampa_settings.torrents_use = false;
      }
    } catch (e) {}
  }

  function installUiCleaner() {
    if (window.lampa_z01_unified_ui_cleaner) return;
    window.lampa_z01_unified_ui_cleaner = true;

    if (window.Lampa && window.Lampa.Listener) {
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
    }

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

    removeUnwantedUI(document);
  }

  function loadZ01() {
    if (window.lampa_z01_unified_loaded) return;
    window.lampa_z01_unified_loaded = true;

    var scripts = [
      HOST + 'online.js',
      HOST + 'lampac-src-filter.js'
    ];

    if (window.Lampa && window.Lampa.Utils && typeof window.Lampa.Utils.putScriptAsync === 'function') {
      try {
        Lampa.Utils.putScriptAsync(scripts, function () {
          removeUnwantedUI(document);
          window.lampa_z01_unified_ready = true;
        });
        return;
      } catch (e) {}
    }

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
    disableTorrentSetting(); // Исправление: теперь функция вызывается при старте

    setTimeout(function () {
      removeUnwantedUI(document);
    }, 800);

    setTimeout(function () {
      removeUnwantedUI(document);
    }, 2000);
  }

  if (window.appready) {
    start();
  } else if (window.Lampa && window.Lampa.Listener) {
    Lampa.Listener.follow('app', function (event) {
      if (event.type === 'ready') start();
    });
  }

  window.lampa_z01_unified = {
    version: VERSION,
    online: HOST + 'online.js',
    sourceFilter: HOST + 'lampac-src-filter.js',
    trailers: false,
    shots: false,
    torrents: false
  };
})();