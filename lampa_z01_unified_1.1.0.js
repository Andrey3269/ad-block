(function () {
  'use strict';

  // Lampa Z01 Unified 1.1.0
  // One installer for:
  //   - z01.online balanceer
  //   - RuTube trailers/player
  //   - removal of native YouTube trailer button
  //   - removal of Shorts/Shots UI
  //   - removal of torrent UI/settings (best-effort, build-safe)
  //   - stable button order: Watch -> Trailers
  //
  // NOTE: the external z01 and RuTube plugins remain upstream dependencies.
  // We do not alter Lampa's native Watch button or route it to trailers.

  if (window.lampa_z01_unified_v110) return;
  window.lampa_z01_unified_v110 = true;

  var VERSION = '1.1.0';
  var Z01 = 'http://z01.online/';
  var RUTUBE = 'https://plugin.rootu.top/rutube.js';

  function safe(fn) {
    try { return fn(); } catch (e) { return null; }
  }

  function each(selector, cb, root) {
    root = root || document;
    safe(function () {
      Array.prototype.slice.call(root.querySelectorAll(selector)).forEach(cb);
    });
  }

  function removeTorrentUi(root) {
    root = root || document;

    var selectors = [
      '.view--torrent',
      '.view--torrents',
      '.torrent-view',
      '.torrent-view-button',
      '.torrent-button',
      '[data-action="torrent"]',
      '[data-action="torrents"]',
      '[data-type="torrent"]',
      '[data-type="torrents"]',
      '.full-start__button[data-subtitle*="торрент"]',
      '.full-start__button[data-subtitle*="Torrent"]'
    ];

    selectors.forEach(function (selector) {
      each(selector, function (node) { node.remove(); }, root);
    });

    // Remove obvious text-only torrent buttons without touching the Watch button.
    safe(function () {
      Array.prototype.slice.call(root.querySelectorAll('.full-start__button, .selector'))
        .forEach(function (node) {
          var text = (node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (text === 'торренты' || text === 'torrents' || text === 'torrent') {
            node.remove();
          }
        });
    });
  }

  function removeTrailerAndShotsUi(root) {
    root = root || document;

    // Native Lampa/YouTube trailer button.
    [
      '.view--trailer',
      '[data-action="trailer"]',
      '.shots-view-button',
      '.view--shots',
      '.shots-view',
      '[data-action="shots"]',
      '[data-action="shorts"]'
    ].forEach(function (selector) {
      each(selector, function (node) { node.remove(); }, root);
    });
  }

  function hideBrokenRutubeButtonWhenNoResults(root) {
    root = root || document;
    safe(function () {
      each('.view--rutube_trailer', function (node) {
        // RuTube plugin normally toggles visibility itself; do not force-hide a loaded button.
        if (node.classList.contains('hide')) return;
        node.setAttribute('data-unified', '1');
      }, root);
    });
  }

  function arrangeButtons(root) {
    root = root || document;

    safe(function () {
      var watch = root.querySelector('.view--online');
      var trailer = root.querySelector('.view--rutube_trailer');

      // Some builds use a different online/watch class. Do not repurpose torrent buttons.
      if (!watch) watch = root.querySelector('.full-start__button[data-action="online"]');
      if (!watch) watch = root.querySelector('.full-start__button.view--watch');

      if (watch && trailer && watch.parentNode === trailer.parentNode) {
        watch.parentNode.insertBefore(trailer, watch.nextSibling);
      }
    });
  }

  function cleanup(root) {
    root = root || document;
    removeTrailerAndShotsUi(root);
    removeTorrentUi(root);
    hideBrokenRutubeButtonWhenNoResults(root);
    arrangeButtons(root);
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

  function installCleaner() {
    if (window.lampa_z01_unified_cleaner_v110) return;
    window.lampa_z01_unified_cleaner_v110 = true;

    disableTorrentSetting();

    safe(function () {
      Lampa.Listener.follow('full', function (e) {
        if (e.type === 'complite' || e.type === 'complete') {
          var root = e.object && e.object.activity ? e.object.activity.render() : document;
          setTimeout(function () { cleanup(root); }, 0);
          setTimeout(function () { cleanup(root); }, 120);
          setTimeout(function () { cleanup(document); }, 500);
          setTimeout(function () { cleanup(document); }, 1200);
        }
      });
    });

    if (window.MutationObserver && !window.lampa_z01_unified_observer_v110) {
      window.lampa_z01_unified_observer_v110 = new MutationObserver(function () {
        // Keep this intentionally cheap; no full document rebuilds.
        cleanup(document);
      });

      safe(function () {
        window.lampa_z01_unified_observer_v110.observe(document.documentElement, {
          childList: true,
          subtree: true
        });
      });
    }

    cleanup(document);
  }

  function loadExternalPlugins(done) {
    var urls = [
      Z01 + 'online.js',
      Z01 + 'lampac-src-filter.js',
      RUTUBE
    ];

    if (window.lampa_z01_unified_external_loading_v110) {
      setTimeout(done, 250);
      return;
    }
    window.lampa_z01_unified_external_loading_v110 = true;

    if (Lampa.Utils && typeof Lampa.Utils.putScriptAsync === 'function') {
      safe(function () {
        Lampa.Utils.putScriptAsync(urls, function () {
          window.lampa_z01_unified_external_ready_v110 = true;
          setTimeout(done, 50);
        });
        return true;
      });
    }

    // Fallback for builds without putScriptAsync or if it threw.
    var index = 0;
    function next() {
      if (index >= urls.length) {
        window.lampa_z01_unified_external_ready_v110 = true;
        done();
        return;
      }

      var script = document.createElement('script');
      script.async = true;
      script.src = urls[index++];
      script.onload = next;
      script.onerror = next;
      (document.head || document.documentElement).appendChild(script);
    }

    if (!window.lampa_z01_unified_external_ready_v110) next();
  }

  // Best-effort RuTube-only ad handling.
  // We deliberately do NOT globally monkey-patch document.createElement('video')
  // or fake a premium subscription because doing that can break Lampa's actual
  // video player and is broader than the trailer player itself.
  function installRutubeAdGuard() {
    if (window.lampa_z01_unified_rutube_ad_guard_v110) return;
    window.lampa_z01_unified_rutube_ad_guard_v110 = true;

    // The official/rootu plugin already reports adStart/adEnd via the player.
    // We only keep the trailer UI from being left in an ad state.
    safe(function () {
      Lampa.Listener.follow('player', function (e) {
        if (!e || !e.type) return;
        if (e.type === 'destroy') {
          cleanup(document);
        }
      });
    });
  }

  function start() {
    installCleaner();
    disableTorrentSetting();
    installRutubeAdGuard();

    loadExternalPlugins(function () {
      cleanup(document);
      setTimeout(function () { cleanup(document); }, 400);
      setTimeout(function () { cleanup(document); }, 1000);
      setTimeout(function () { cleanup(document); }, 2000);
    });
  }

  if (window.appready) {
    start();
  } else {
    safe(function () {
      Lampa.Listener.follow('app', function (event) {
        if (event.type === 'ready') start();
      });
    });
  }

  window.lampa_z01_unified = {
    version: VERSION,
    z01: [Z01 + 'online.js', Z01 + 'lampac-src-filter.js'],
    rutube: RUTUBE,
    nativeTrailer: false,
    shorts: false,
    torrents: false,
    watchButton: 'native'
  };
})();
