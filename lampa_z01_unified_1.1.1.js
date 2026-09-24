(function () {
  'use strict';

  // Lampa Z01 Unified 1.1.1
  // Stable version:
  // - loads z01 balanceer after Lampa is ready
  // - loads RuTube trailer plugin asynchronously (without blocking startup)
  // - removes native YouTube trailer button, Shorts/Shots and torrent UI
  // - keeps native Watch button untouched
  // - places RuTube Trailers after Watch when both are present

  if (window.lampa_z01_unified_v111) return;
  window.lampa_z01_unified_v111 = true;

  var VERSION = '1.1.1';
  var Z01_URLS = [
    'http://z01.online/online.js',
    'http://z01.online/lampac-src-filter.js'
  ];
  var RUTUBE_URL = 'https://plugin.rootu.top/rutube.js';

  function later(fn, ms) {
    try { return setTimeout(fn, ms || 0); } catch (e) { return 0; }
  }

  function safe(fn) {
    try { return fn(); } catch (e) { return null; }
  }

  function each(root, selector, cb) {
    safe(function () {
      var nodes = root.querySelectorAll(selector);
      for (var i = 0; i < nodes.length; i++) cb(nodes[i]);
    });
  }

  function loadScript(url, done) {
    if (document.querySelector('script[data-lampa-z01-unified-src="' + url.replace(/"/g, '\\"') + '"]')) {
      later(done, 0);
      return;
    }

    var script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-lampa-z01-unified-src', url);
    script.src = url;

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      if (done) done();
    }

    script.onload = finish;
    script.onerror = finish;
    (document.head || document.documentElement).appendChild(script);

    // Never keep Lampa waiting forever for an external server.
    later(finish, 12000);
  }

  function loadScriptsSequential(urls, done) {
    var index = 0;
    function next() {
      if (index >= urls.length) {
        if (done) done();
        return;
      }
      loadScript(urls[index++], next);
    }
    next();
  }

  function removeBySelectors(root) {
    var selectors = [
      // Native YouTube trailer / preview
      '.view--trailer',
      '[data-action="trailer"]',

      // Shorts / Shots
      '.shots-view-button',
      '.view--shots',
      '.shots-view',
      '[data-action="shots"]',
      '[data-action="shorts"]',

      // Torrents
      '.view--torrent',
      '.view--torrents',
      '.torrent-view',
      '.torrent-view-button',
      '.torrent-button',
      '[data-action="torrent"]',
      '[data-action="torrents"]',
      '[data-type="torrent"]',
      '[data-type="torrents"]'
    ];

    for (var i = 0; i < selectors.length; i++) {
      each(root, selectors[i], function (node) {
        try { node.remove(); } catch (e) { if (node.parentNode) node.parentNode.removeChild(node); }
      });
    }

    // Text fallback, deliberately narrow to avoid touching Watch/Online.
    safe(function () {
      each(root, '.full-start__button, .selector', function (node) {
        var text = (node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (text === 'торренты' || text === 'torrents' || text === 'torrent' || text === 'shorts' || text === 'shots') {
          node.remove();
        }
      });
    });
  }

  function arrangeTrailerButton(root) {
    safe(function () {
      var watch = root.querySelector('.view--online') ||
        root.querySelector('.full-start__button[data-action="online"]') ||
        root.querySelector('.full-start__button.view--watch');
      var trailer = root.querySelector('.view--rutube_trailer');

      if (watch && trailer && watch.parentNode === trailer.parentNode) {
        watch.parentNode.insertBefore(trailer, watch.nextSibling);
      }
    });
  }

  function clean(root) {
    root = root || document;
    removeBySelectors(root);
    arrangeTrailerButton(root);
  }

  function installCleaner() {
    if (window.lampa_z01_unified_cleaner_v111) return;
    window.lampa_z01_unified_cleaner_v111 = true;

    safe(function () {
      Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'complite' && e.type !== 'complete') return;

        var root = document;
        safe(function () {
          root = e.object && e.object.activity ? e.object.activity.render() : document;
        });

        clean(root);
        later(function () { clean(root); }, 100);
        later(function () { clean(root); }, 500);
        later(function () { clean(document); }, 1200);
      });
    });

    // No MutationObserver here: removing DOM nodes from inside an observer can
    // create a hot mutation loop and freeze Lampa on some builds.
    clean(document);
  }

  function start() {
    installCleaner();

    // Z01 balanceer: load without blocking app startup.
    if (!window.lampa_z01_unified_z01_loading_v111) {
      window.lampa_z01_unified_z01_loading_v111 = true;
      loadScriptsSequential(Z01_URLS, function () {
        window.lampa_z01_unified_z01_ready_v111 = true;
      });
    }

    // RuTube is intentionally delayed: it is a large external player and must
    // not be allowed to hold up Lampa startup.
    if (!window.lampa_z01_unified_rutube_loading_v111) {
      window.lampa_z01_unified_rutube_loading_v111 = true;
      later(function () {
        loadScript(RUTUBE_URL, function () {
          window.lampa_z01_unified_rutube_ready_v111 = true;
          later(function () { clean(document); }, 300);
          later(function () { clean(document); }, 1000);
        });
      }, 1800);
    }
  }

  if (window.appready) {
    start();
  } else {
    safe(function () {
      Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') start();
      });
    });
  }

  window.lampa_z01_unified = {
    version: VERSION,
    z01: Z01_URLS.slice(),
    rutube: RUTUBE_URL,
    nativeWatchUntouched: true,
    nativeTrailerRemoved: true,
    shortsRemoved: true,
    torrentsRemoved: true
  };
})();
