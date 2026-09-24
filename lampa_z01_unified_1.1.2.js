(function () {
  'use strict';

  // Lampa Z01 Unified 1.1.2
  // - Z01/LAMPAC online button becomes the main "Смотреть" button
  // - RuTube plugin supplies a separate "Трейлеры" button with its own icon/player
  // - native YouTube trailer button is hidden
  // - Shorts/Shots and torrent controls are hidden
  // - no interception of the player's native Watch/YouTube handlers
  // - external scripts never block Lampa startup

  if (window.lampa_z01_unified_v112) return;
  window.lampa_z01_unified_v112 = true;

  var VERSION = '1.1.2';
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

  function getText(node) {
    return ((node && node.textContent) || '').replace(/\s+/g, ' ').trim().toLowerCase();
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

    // Do not ever block Lampa on a third-party script.
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

  function removeSelectorItems(root) {
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

      // Explicit torrent controls. We deliberately do NOT remove
      // .view--online because that is the Z01/LAMPAC Watch button.
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
        safe(function () { node.remove(); });
      });
    }

    // Hide a torrent button only when the text clearly says it is a torrent
    // action. This avoids touching Lampa's internal online/watch container.
    each(root, '.full-start__button, .selector', function (node) {
      var text = getText(node);
      if (text === 'торренты' || text === 'торрент' || text === 'torrents' || text === 'torrent' ||
          text === 'shorts' || text === 'shots' || text === 'шортс') {
        safe(function () { node.remove(); });
      }
    });
  }

  function findZ01Watch(root) {
    var candidates = [];

    safe(function () {
      candidates = candidates.concat([].slice.call(root.querySelectorAll('.full-start__button.lampac--button')));
    });

    safe(function () {
      candidates = candidates.concat([].slice.call(root.querySelectorAll('.full-start__button.view--online')));
    });

    safe(function () {
      candidates = candidates.concat([].slice.call(root.querySelectorAll('.view--online')));
    });

    for (var i = 0; i < candidates.length; i++) {
      var node = candidates[i];
      if (!node || node.classList.contains('view--rutube_trailer')) continue;

      var text = getText(node);
      var looksOnline = /онлайн|online|lampac|z01/.test(text + ' ' + (node.className || ''));
      if (node.classList.contains('lampac--button') || looksOnline) return node;
    }

    return null;
  }

  function markZ01WatchButton(root) {
    var watch = findZ01Watch(root);
    if (!watch) return null;

    safe(function () {
      watch.classList.add('lampa-z01-watch');
      watch.classList.remove('lampa-z01-hidden-action');
      watch.style.display = '';

      var span = watch.querySelector('span');
      if (span) {
        span.textContent = 'Смотреть';
      } else {
        // Preserve the Z01 icon if present; only replace textual contents when
        // no dedicated label span exists.
        var html = watch.innerHTML;
        if (html && /онлайн|online/i.test(html)) {
          watch.innerHTML = html.replace(/онлайн|online/ig, 'Смотреть');
        }
      }

      watch.setAttribute('data-subtitle', 'Z01');
    });

    return watch;
  }

  function pruneOtherActionButtons(root, watch, trailer) {
    // Keep only the two requested buttons in the main action row.
    var containers = [];
    safe(function () {
      containers = containers.concat([].slice.call(root.querySelectorAll('.full-start-new__buttons, .full-start__buttons')));
    });

    containers.forEach(function (container) {
      safe(function () {
        var buttons = container.querySelectorAll('.full-start__button');
        for (var i = 0; i < buttons.length; i++) {
          var node = buttons[i];
          var keep = node === watch || node === trailer ||
            node.classList.contains('lampa-z01-watch') ||
            node.classList.contains('view--rutube_trailer');

          if (!keep) {
            var text = getText(node);
            // Be conservative: hide obvious noise in the action row, but don't
            // remove unrelated metadata controls outside this row.
            if (text === 'трейлер' || text === 'trailer' || text === 'онлайн' || text === 'online' ||
                text === 'торренты' || text === 'торрент' || text === 'torrents' || text === 'torrent' ||
                text === 'shorts' || text === 'shots' || text === 'шортс') {
              node.style.display = 'none';
              node.classList.add('lampa-z01-hidden-action');
            }
          }
        }
      });
    });
  }

  function arrangeRutubeButton(root, watch) {
    var trailer = safe(function () { return root.querySelector('.view--rutube_trailer'); });
    if (!trailer) return null;

    safe(function () {
      trailer.classList.add('lampa-z01-rutube-trailer');
      trailer.style.display = '';
      if (watch && watch.parentNode === trailer.parentNode) {
        watch.parentNode.insertBefore(watch, trailer);
        watch.parentNode.insertBefore(trailer, watch.nextSibling);
      }
    });

    return trailer;
  }

  function addStyle() {
    if (document.getElementById('lampa-z01-unified-style')) return;

    var style = document.createElement('style');
    style.id = 'lampa-z01-unified-style';
    style.textContent =
      '.lampa-z01-watch .button__icon{margin-right:.35em}' +
      '.lampa-z01-rutube-trailer .button__icon{margin-right:.35em}' +
      '.full-start-new__buttons .lampa-z01-watch,.full-start__buttons .lampa-z01-watch{order:-20}' +
      '.full-start-new__buttons .lampa-z01-rutube-trailer,.full-start__buttons .lampa-z01-rutube-trailer{order:-19}' +
      '.lampa-z01-hidden-action{display:none!important;}';
    safe(function () { (document.head || document.documentElement).appendChild(style); });
  }

  function clean(root) {
    root = root || document;
    addStyle();
    removeSelectorItems(root);

    var watch = markZ01WatchButton(root);
    var trailer = arrangeRutubeButton(root, watch);

    // The RuTube script creates its own button asynchronously. Keep the two
    // requested controls side-by-side when it appears.
    pruneOtherActionButtons(root, watch, trailer);
  }

  function installCleaner() {
    if (window.lampa_z01_unified_cleaner_v112) return;
    window.lampa_z01_unified_cleaner_v112 = true;

    safe(function () {
      Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'complite' && e.type !== 'complete') return;

        var root = document;
        safe(function () {
          root = e.object && e.object.activity ? e.object.activity.render() : document;
        });

        clean(root);
        later(function () { clean(root); }, 120);
        later(function () { clean(root); }, 450);
        later(function () { clean(root); }, 1000);
        later(function () { clean(document); }, 1800);
      });
    });

    clean(document);
  }

  function start() {
    installCleaner();

    if (!window.lampa_z01_unified_z01_loading_v112) {
      window.lampa_z01_unified_z01_loading_v112 = true;
      loadScriptsSequential(Z01_URLS, function () {
        window.lampa_z01_unified_z01_ready_v112 = true;
        clean(document);
        later(function () { clean(document); }, 250);
        later(function () { clean(document); }, 900);
      });
    }

    if (!window.lampa_z01_unified_rutube_loading_v112) {
      window.lampa_z01_unified_rutube_loading_v112 = true;
      later(function () {
        loadScript(RUTUBE_URL, function () {
          window.lampa_z01_unified_rutube_ready_v112 = true;
          later(function () { clean(document); }, 250);
          later(function () { clean(document); }, 900);
        });
      }, 1500);
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
    watchRedirect: 'z01-online-button',
    trailerButton: 'rutube',
    nativeYoutubeTrailerHidden: true,
    shortsRemoved: true,
    torrentsRemoved: true
  };
})();
