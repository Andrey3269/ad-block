(function() {
  'use strict';

  var Defined = {
    api: 'lampac',
    localhost: 'http://rc.bwa.ad/',
    apn: ''
  };

  var balansers_with_search;
  
  var unic_id = Lampa.Storage.get('lampac_unic_id', '');
  if (!unic_id) {
    unic_id = Lampa.Utils.uid(8).toLowerCase();
    Lampa.Storage.set('lampac_unic_id', unic_id);
  }
  
    function getAndroidVersion() {
  if (Lampa.Platform.is('android')) {
    try {
      var current = AndroidJS.appVersion().split('-');
      return parseInt(current.pop());
    } catch (e) {
      return 0;
    }
  } else {
    return 0;
  }
}

var hostkey = 'http://rc.bwa.ad'.replace('http://', '').replace('https://', '');

if (!window.rch_nws || !window.rch_nws[hostkey]) {
  if (!window.rch_nws) window.rch_nws = {};

  window.rch_nws[hostkey] = {
    type: Lampa.Platform.is('android') ? 'apk' : Lampa.Platform.is('tizen') ? 'cors' : undefined,
    startTypeInvoke: false,
    rchRegistry: false,
    apkVersion: getAndroidVersion()
  };
}

window.rch_nws[hostkey].typeInvoke = function rchtypeInvoke(host, call) {
  if (!window.rch_nws[hostkey].startTypeInvoke) {
    window.rch_nws[hostkey].startTypeInvoke = true;

    var check = function check(good) {
      window.rch_nws[hostkey].type = Lampa.Platform.is('android') ? 'apk' : good ? 'cors' : 'web';
      call();
    };

    if (Lampa.Platform.is('android') || Lampa.Platform.is('tizen')) check(true);
    else {
      var net = new Lampa.Reguest();
      net.silent('http://rc.bwa.ad'.indexOf(location.host) >= 0 ? 'https://github.com/' : host + '/cors/check', function() {
        check(true);
      }, function() {
        check(false);
      }, false, {
        dataType: 'text'
      });
    }
  } else call();
};

window.rch_nws[hostkey].Registry = function RchRegistry(client, startConnection) {
  window.rch_nws[hostkey].typeInvoke('http://rc.bwa.ad', function() {

    client.invoke("RchRegistry", {
      host: location.host,
      rchtype: Lampa.Platform.is('android') ? 'apk' : Lampa.Platform.is('tizen') ? 'cors' : (window.rch_nws[hostkey].type || 'web'),
      apkVersion: Lampa.Platform.is('android') ? (window.rch_nws[hostkey].apkVersion || 0) : 0,
      player: Lampa.Storage.field('player')
    });

    if (window.rch_nws[hostkey].rchRegistry)
      return;

    window.rch_nws[hostkey].rchRegistry = true;

    var handled = false;
    client.on('RchRegistry', function (clientIp, connectionId, rchtype) {
      if (startConnection && !handled) {
	    handled = true;
	    startConnection();
      }
    });

    client.on("RchClient", function(rchId, url, data, headers, returnHeaders) {
      var network = new Lampa.Reguest();
	  
	  function sendResult(uri, html) {
	    $.ajax({
	      url: 'http://rc.bwa.ad/rch/' + uri + '?id=' + rchId,
	      type: 'POST',
	      data: html,
	      async: true,
	      cache: false,
	      contentType: false,
	      processData: false,
	      success: function(j) {},
	      error: function() {
	        client.invoke("RchResult", rchId, '');
	      }
	    });
	  }

      function result(html) {
        if (Lampa.Arrays.isObject(html) || Lampa.Arrays.isArray(html)) {
          html = JSON.stringify(html);
        }

        if (typeof CompressionStream !== 'undefined' && html && html.length > 1000) {
          var compressionStream = new CompressionStream('gzip');
          var encoder = new TextEncoder();
          var readable = new ReadableStream({
            start: function(controller) {
              controller.enqueue(encoder.encode(html));
              controller.close();
            }
          });
          var compressedStream = readable.pipeThrough(compressionStream);
          new Response(compressedStream).arrayBuffer()
            .then(function(compressedBuffer) {
              var compressedArray = new Uint8Array(compressedBuffer);
              if (compressedArray.length > html.length) {
                sendResult('result', html);
              } else {
                sendResult('gzresult', compressedArray);
              }
            })
            .catch(function() {
              sendResult('result', html);
            });

        } else {
          sendResult('result', html);
        }
      }

      if (url == 'eval') {
        console.log('RCH', url, data);
        result(eval(data));
      } else if (url == 'evalrun') {
        console.log('RCH', url, data);
        eval(data);
      } else if (url == 'ping') {
        result('pong');
      } else {
        console.log('RCH', url);
        network["native"](url, result, function(e) {
          console.log('RCH', 'result empty, ' + e.status);
          result('');
        }, data, {
          dataType: 'text',
          timeout: 1000 * 8,
          headers: headers,
          returnHeaders: returnHeaders
        });
      }
    });

    client.on('Connected', function(connectionId) {
      console.log('RCH', 'ConnectionId: ' + connectionId);
      window.rch_nws[hostkey].connectionId = connectionId;
    });
    client.on('Closed', function() {
      console.log('RCH', 'Connection closed');
    });
    client.on('Error', function(err) {
      console.log('RCH', 'error:', err);
    });
  });
};

  window.rch_nws[hostkey].typeInvoke('http://rc.bwa.ad', function() {});

  function rchInvoke(json, call) {
    if (!window.nwsClient) 
      window.nwsClient = {};

    var client = window.nwsClient[hostkey];
    if (client && client.connectionId != null) {
      call();
    }
    else if (client) {
      console.log('RCH', 'Reconnecting...');
      client.reconnect(function() {
        call();
      });
    }
    else {
      window.nwsClient[hostkey] = new NativeWsClient(json.nws, {
        autoReconnect: true
      });

      window.nwsClient[hostkey].on('Connected', function(connectionId) {
        window.rch_nws[hostkey].Registry(window.nwsClient[hostkey], function() {
          call();
        });
      });

      window.nwsClient[hostkey].connect();
    }
  }

  function rchRun(json, call) {
    if (typeof NativeWsClient == 'undefined') {
      Lampa.Utils.putScript(["http://rc.bwa.ad/js/nws-client-es5.js?v21042026"], function() {}, false, function() {
        rchInvoke(json, call);
      }, true);
    } else {
      rchInvoke(json, call);
    }
  }

  function account(url) {
    url = url + '';
    if (url.indexOf('account_email=') == -1) {
      var email = Lampa.Storage.get('account_email');
      if (email) url = Lampa.Utils.addUrlComponent(url, 'account_email=' + encodeURIComponent(email));
    }
    if (url.indexOf('uid=') == -1) {
      var uid = Lampa.Storage.get('lampac_unic_id', '');
      if (uid) url = Lampa.Utils.addUrlComponent(url, 'uid=' + encodeURIComponent(uid));
    }
    if (url.indexOf('token=') == -1) {
      var token = '';
      if (token != '') url = Lampa.Utils.addUrlComponent(url, 'token=');
    }
    if (url.indexOf('nws_id=') == -1) {
      var nws_id = Lampa.Storage.get('lampac_nws_id', '');
      if (nws_id) url = Lampa.Utils.addUrlComponent(url, 'nws_id=' + encodeURIComponent(nws_id));
    }
    return url;
  }

  function addHeaders() {
    var bwaesgcmkey = Lampa.Storage.get('bwaesgcmkey', '');
    if (bwaesgcmkey) return { 'X-Kit-AesGcm': Lampa.Storage.get('bwaesgcmkey', '') };
    return {};
  }

  function formatEpisodeNumber(episodeNumber) {
    return (episodeNumber < 10 ? '0' : '') + episodeNumber;
  }

  var BWA_QUALITY_KEY = 'bwarc_default_quality';
  var BWA_QUALITY_AUTO = 0;
  var BWA_QUALITY_LIST = [2160, 1440, 1080, 720, 576, 480, 360];

  function getPreferredQuality() {
    var value = parseInt(Lampa.Storage.get(BWA_QUALITY_KEY, 1080), 10);
    if (value === BWA_QUALITY_AUTO || BWA_QUALITY_LIST.indexOf(value) !== -1) return value;
    return 1080;
  }

  function setPreferredQuality(value) {
    value = parseInt(value, 10);
    if (value !== BWA_QUALITY_AUTO && BWA_QUALITY_LIST.indexOf(value) === -1) value = 1080;
    Lampa.Storage.set(BWA_QUALITY_KEY, value);
  }

  var BWA_VOICE_KEY = 'bwarc_default_voice';
  function getPreferredVoice() {
    return String(Lampa.Storage.get(BWA_VOICE_KEY, '') || '');
  }
  function setPreferredVoice(value) {
    Lampa.Storage.set(BWA_VOICE_KEY, String(value || ''));
  }

  function qualityText(value) {
    return parseInt(value, 10) === 0 ? 'Авто' : String(parseInt(value, 10)) + 'p';
  }

  function normalizedQualityMap(map) {
    var result = {};
    if (!map || typeof map !== 'object') return result;
    for (var key in map) {
      var value = parseInt(String(key).replace(/[^0-9]/g, ''), 10);
      if (!value || !map[key]) continue;
      result[value] = map[key];
    }
    return result;
  }

  function pickQuality(map, preferred) {
    var normalized = normalizedQualityMap(map);
    var keys = Object.keys(normalized).map(function(k) { return parseInt(k, 10); }).sort(function(a, b) { return b - a; });
    if (!keys.length) return null;

    if (preferred > 0 && normalized[preferred]) return {
      quality: preferred,
      url: normalized[preferred]
    };

    if (preferred > 0) {
      var below = keys.filter(function(q) { return q <= preferred; });
      if (below.length) return {
        quality: below[0],
        url: normalized[below[0]]
      };
    }

    return {
      quality: keys[0],
      url: normalized[keys[0]]
    };
  }

  var Network = Lampa.Reguest;

  function component(object) {
    var network = new Network();
    var scroll = new Lampa.Scroll({
      mask: true,
      over: true
    });
    var files = new Lampa.Explorer(object);
    var filter = new Lampa.Filter(object);
    var sources = {};
    var last;
    var source;
    var balanser;
    var initialized;
    var balanser_timer;
    var images = [];
    var number_of_requests = 0;
    var number_of_requests_timer;
    var life_wait_times = 0;
    var life_wait_timer;
    var filter_sources = {};
    var current_videos = [];
    var auto_source_key = '__auto__';
    var auto_max_sources = 10;
    var filter_translate = {
      season: Lampa.Lang.translate('torrent_serial_season'),
      voice: Lampa.Lang.translate('torrent_parser_voice'),
      source: Lampa.Lang.translate('settings_rest_source')
    };
    var filter_find = {
      season: [],
      voice: []
    };
    var bwa_toolbar = null;
    var bwa_voice_filter = '';
    var bwa_season_filter = null;
    var bwa_all_videos = [];
    var bwa_series_groups = [];
    var bwa_series_playlist = [];

    function bwaSafeText(value) {
      if (value === null || typeof value === 'undefined') return '';
      if (typeof value === 'string' || typeof value === 'number') return String(value);
      if (value && typeof value.title === 'string') return value.title;
      if (value && typeof value.name === 'string') return value.name;
      return '';
    }

    function bwaItemVoice(item) {
      return bwaSafeText(item && (item.voice_name || item.text));
    }

    function bwaSeriesKey(item) {
      var season = parseInt(item && item.season, 10) || 1;
      var episode = parseInt(item && item.episode, 10) || 1;
      return season + ':' + episode;
    }

    function bwaSeriesSeasons(items) {
      var map = {};
      (items || []).forEach(function(item) {
        if (!item || !item.season) return;
        map[parseInt(item.season, 10)] = true;
      });
      return Object.keys(map).map(function(s) { return parseInt(s, 10); }).sort(function(a,b){ return a-b; });
    }

    function bwaVariantQuality(item) {
      var picked = pickQuality(item && (item.qualitys || item.quality || {}), getPreferredQuality());
      return picked ? picked.quality : 0;
    }

    function bwaChooseSeriesVariant(group, getChoiceFn) {
      var items = (group && group.items || []).slice();
      if (!items.length) return null;
      var choice = getChoiceFn ? getChoiceFn() : {};
      var voice = bwa_voice_filter || choice.voice_name || getPreferredVoice() || '';
      if (voice) {
        var exact = items.filter(function(item) { return bwaItemVoice(item).toLowerCase() === voice.toLowerCase(); });
        if (exact.length) items = exact;
      }
      items.sort(function(a,b) {
        var aq = bwaVariantQuality(a), bq = bwaVariantQuality(b);
        var preferred = typeof choice.quality !== 'undefined' ? parseInt(choice.quality, 10) : getPreferredQuality();
        if (isNaN(preferred)) preferred = getPreferredQuality();
        var ad = preferred ? Math.abs(aq - preferred) : 0;
        var bd = preferred ? Math.abs(bq - preferred) : 0;
        if (ad !== bd) return ad - bd;
        if (aq !== bq) return bq - aq;
        return bwaItemVoice(a).localeCompare(bwaItemVoice(b));
      });
      return items[0];
    }

    this.groupSeriesVideos = function(items) {
      var map = {};
      (items || []).forEach(function(item) {
        if (!item || !item.episode) return;
        var key = bwaSeriesKey(item);
        if (!map[key]) {
          map[key] = { season: parseInt(item.season,10)||1, episode: parseInt(item.episode,10)||1, items: [] };
        }
        map[key].items.push(item);
      });
      return Object.keys(map).map(function(key){ return map[key]; }).sort(function(a,b){
        return a.season - b.season || a.episode - b.episode;
      });
    };

    this.ensureSeriesSeason = function(items) {
      if (!object.movie.name) return;
      var seasons = bwaSeriesSeasons(items);
      if (!seasons.length) { bwa_season_filter = null; return; }
      if (seasons.indexOf(parseInt(bwa_season_filter,10)) !== -1) return;
      var saved = parseInt(this.getChoice().season_number,10);
      if (seasons.indexOf(saved) !== -1) bwa_season_filter = saved;
      else bwa_season_filter = seasons[0];
    };

    this.seriesForSeason = function(items) {
      var groups = this.groupSeriesVideos(items);
      this.ensureSeriesSeason(items);
      if (bwa_season_filter === null) return groups;
      return groups.filter(function(group){ return group.season === parseInt(bwa_season_filter,10); });
    };

    this.openBwaSeason = function() {
      var _this = this;
      var enabled = Lampa.Controller.enabled().name;
      var seasons = bwaSeriesSeasons(bwa_all_videos);
      if (!seasons.length) { Lampa.Noty.show('Сезоны пока не найдены'); return; }
      Lampa.Select.show({
        title: 'Сезон',
        items: seasons.map(function(season){
          return { title: 'Сезон ' + season, season: season, selected: parseInt(bwa_season_filter,10) === season };
        }),
        onBack: function(){ Lampa.Controller.toggle(enabled); },
        onSelect: function(item){
          bwa_season_filter = item.season;
          _this.replaceChoice({ season_number: item.season, season: Math.max(0, seasons.indexOf(item.season)) });
          Lampa.Controller.toggle(enabled);
          _this.display(bwa_all_videos);
        }
      });
    };

    this.openEpisodeVariants = function(group, callback) {
      var enabled = Lampa.Controller.enabled().name;
      var variants = (group.items || []).slice();
      var seen = {};
      var items = [];
      variants.sort(function(a,b){
        var aq = bwaVariantQuality(a), bq = bwaVariantQuality(b);
        if (aq !== bq) return bq - aq;
        return bwaItemVoice(a).localeCompare(bwaItemVoice(b));
      }).forEach(function(variant){
        var voice = bwaItemVoice(variant) || 'Оригинал';
        var quality = bwaVariantQuality(variant);
        var sourceName = bwaSafeText(variant._bwa_source_name || '');
        var key = voice.toLowerCase() + '|' + quality + '|' + sourceName.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        var q = quality ? quality + 'p' : 'качество авто';
        items.push({
          title: voice + '  •  ' + q + (sourceName ? '  •  ' + sourceName : ''),
          variant: variant
        });
      });
      if (!items.length) { callback(variants[0]); return; }
      if (items.length === 1) { callback(items[0].variant); return; }
      Lampa.Select.show({
        title: 'S' + formatEpisodeNumber(group.season) + 'E' + formatEpisodeNumber(group.episode) + ' • Варианты',
        items: items,
        onBack: function(){ Lampa.Controller.toggle(enabled); },
        onSelect: function(item){
          var variant = item.variant;
          var choice = _this.getChoice();
          choice.voice_name = bwaItemVoice(variant);
          choice.quality = bwaVariantQuality(variant);
          if (variant.voice_id) choice.voice_id = variant.voice_id;
          _this.saveChoice(choice);
          Lampa.Controller.toggle(enabled);
          callback(variant);
        }
      });
    };

    function bwaUnique(list) {
      var out = [];
      var seen = {};
      (list || []).forEach(function(value) {
        value = String(value || '').trim();
        if (!value || seen[value.toLowerCase()]) return;
        seen[value.toLowerCase()] = true;
        out.push(value);
      });
      return out;
    }

    function bwaQualityStats(items) {
      var counts = {};
      (items || []).forEach(function(item) {
        var map = normalizedQualityMap(item.qualitys || item.quality || {});
        Object.keys(map).forEach(function(q) {
          counts[q] = (counts[q] || 0) + 1;
        });
      });
      return counts;
    }

    this.updateBwaToolbar = function(status) {
      if (!bwa_toolbar || !bwa_toolbar.length) return;
      var currentList = this.current_videos || [];
      var all = bwa_all_videos.length || currentList.length || 0;
      var allItems = bwa_all_videos.length ? bwa_all_videos : currentList;
      var voices = bwaUnique(allItems.map(function(item) { return bwaItemVoice(item); }));
      var sourceCount = filter_sources.filter(function(key) {
        return key !== auto_source_key && sources[key] && sources[key].show;
      }).length;
      var counts = bwaQualityStats(allItems);
      var titleChoice = this.getChoice ? this.getChoice() : {};
      var preferred = typeof titleChoice.quality !== 'undefined' ? parseInt(titleChoice.quality, 10) : getPreferredQuality();
      if (isNaN(preferred)) preferred = getPreferredQuality();
      var qCount = preferred ? (counts[preferred] || 0) : 0;
      var sourceText = balanser === auto_source_key ? 'Все источники' : (sources[balanser] ? sources[balanser].name : 'Источник');
      var voiceText = bwa_voice_filter || (voices.length === 1 ? voices[0] : (voices.length ? 'Все • ' + voices.length : 'Озвучка'));
      var statusText = status || (all ? ('Найдено: ' + currentList.length + (currentList.length !== all ? ' / ' + all : '')) : 'Готово к поиску');
      bwa_toolbar.find('.bwa-ui__source-label').text(bwaSafeText(sourceText));
      bwa_toolbar.find('.bwa-ui__quality-label').text(qualityText(preferred) + (qCount ? ' · ' + qCount : ''));
      bwa_toolbar.find('.bwa-ui__voice-label').text(voiceText);
      bwa_toolbar.find('.bwa-ui__status').text(statusText);
      bwa_toolbar.find('.bwa-ui__count').text(object.movie.name ? ('Сезон ' + (bwa_season_filter || '—') + ' · ' + currentList.length + ' серий') : (voices.length ? (voices.length + ' озв.') : (sourceCount ? (sourceCount + ' источн.') : '')));
      if (object.movie.name) {
        bwa_toolbar.find('.bwa-ui__season').removeClass('hide');
        bwa_toolbar.find('.bwa-ui__season-label').text(bwa_season_filter ? 'Сезон ' + bwa_season_filter : 'Сезон');
      }
      var resetVoice = bwa_toolbar.find('.bwa-ui__reset-voice');
      if (bwa_voice_filter) resetVoice.removeClass('hide').text('Сброс озвучки');
      else resetVoice.addClass('hide');
    };

    this.createBwaToolbar = function() {
      var _thisToolbar = this;
      var body = scroll.body();
      body.find('.bwa-ui').remove();
      var serial = !!object.movie.name;
      var title = object.movie.title || object.movie.original_title || object.movie.name || 'Онлайн';
      var toolbar = $('<div class="bwa-ui">' +
        '<div class="bwa-ui__top">' +
          '<div class="bwa-ui__identity">' +
            '<div class="bwa-ui__logo"><span>▶</span></div>' +
            '<div class="bwa-ui__titles"><div class="bwa-ui__title"></div><div class="bwa-ui__status"></div></div>' +
          '</div>' +
          '<div class="bwa-ui__count"></div>' +
        '</div>' +
        '<div class="bwa-ui__controls">' +
          '<div class="bwa-ui__button selector bwa-ui__source"><span class="bwa-ui__icon">◉</span><span class="bwa-ui__label">Источник</span><strong class="bwa-ui__source-label"></strong></div>' +
          '<div class="bwa-ui__button selector bwa-ui__voice"><span class="bwa-ui__icon">♫</span><span class="bwa-ui__label">Озвучка</span><strong class="bwa-ui__voice-label"></strong></div>' +
          '<div class="bwa-ui__button selector bwa-ui__quality"><span class="bwa-ui__icon">HD</span><span class="bwa-ui__label">Качество</span><strong class="bwa-ui__quality-label"></strong></div>' +
          '<div class="bwa-ui__button selector bwa-ui__season hide"><span class="bwa-ui__icon">№</span><span class="bwa-ui__label">Сезон</span><strong class="bwa-ui__season-label"></strong></div>' +
          '<div class="bwa-ui__button selector bwa-ui__reset-voice hide">Сброс озвучки</div>' +
        '</div>' +
        '<div class="bwa-ui__hint">' + (serial ? 'Выберите озвучку, качество и серию — OK для просмотра' : 'Выберите вариант — OK для просмотра') + '</div>' +
      '</div>');
      toolbar.find('.bwa-ui__title').text(title);
      body.prepend(toolbar);
      bwa_toolbar = toolbar;

      toolbar.find('.bwa-ui__quality').on('hover:enter', function() {
        _thisToolbar.openBwaQuality();
      });
      toolbar.find('.bwa-ui__season').on('hover:enter', function() {
        _thisToolbar.openBwaSeason();
      });
      toolbar.find('.bwa-ui__voice').on('hover:enter', function() {
        _thisToolbar.openBwaVoice();
      });
      toolbar.find('.bwa-ui__source').on('hover:enter', function() {
        _thisToolbar.openBwaSource();
      });
      toolbar.find('.bwa-ui__reset-voice').on('hover:enter', function() {
        bwa_voice_filter = '';
        setPreferredVoice('');
        _thisToolbar.replaceChoice({ voice: 0, voice_url: '', voice_name: '' });
        _thisToolbar.display(bwa_all_videos.length ? bwa_all_videos : _thisToolbar.current_videos);
      });

      this.updateBwaToolbar();
    };

    this.openBwaQuality = function() {
      var _this = this;
      var enabled = Lampa.Controller.enabled().name;
      var all = bwa_all_videos.length ? bwa_all_videos : this.current_videos;
      var counts = bwaQualityStats(all);
      var items = [{ title: 'Авто — лучшее доступное', quality: 0, selected: getPreferredQuality() === 0 }];
      BWA_QUALITY_LIST.forEach(function(q) {
        var count = counts[q] || 0;
        items.push({
          title: q + 'p' + (count ? '  ·  ' + count + ' вариантов' : ''),
          quality: q,
          selected: getPreferredQuality() === q
        });
      });
      Lampa.Select.show({
        title: 'Качество по умолчанию',
        items: items,
        onBack: function() { Lampa.Controller.toggle(enabled); },
        onSelect: function(item) {
          setPreferredQuality(item.quality);
          _this.replaceChoice({ quality: item.quality });
          Lampa.Controller.toggle(enabled);
          _this.display(all);
          Lampa.Noty.show('Качество: ' + qualityText(item.quality));
        }
      });
    };

    this.openBwaVoice = function() {
      var _this = this;
      var enabled = Lampa.Controller.enabled().name;
      var all = bwa_all_videos.length ? bwa_all_videos : this.current_videos;
      var names = bwaUnique(all.map(function(item) {
        return item.voice_name || item.text;
      }));
      if (balanser !== auto_source_key && filter_find.voice.length) {
        names = bwaUnique(filter_find.voice.map(function(item) { return item.title; }));
      }
      if (!names.length) {
        Lampa.Noty.show('Озвучки пока не найдены');
        return;
      }
      var items = [{ title: 'Все озвучки', value: '' }].concat(names.map(function(name) {
        return { title: name, value: name, selected: bwa_voice_filter === name };
      }));
      Lampa.Select.show({
        title: 'Озвучка',
        items: items,
        onBack: function() { Lampa.Controller.toggle(enabled); },
        onSelect: function(item) {
          if (balanser !== auto_source_key && filter_find.voice.length) {
            var idx = filter_find.voice.findIndex(function(v) { return v.title === item.value; });
            if (!item.value) {
              bwa_voice_filter = '';
              setPreferredVoice('');
              _this.replaceChoice({ voice: 0, voice_url: '', voice_name: '' });
              Lampa.Controller.toggle(enabled);
              _this.request(_this.requestParams(source));
            } else if (idx >= 0) {
              bwa_voice_filter = item.value;
              setPreferredVoice(item.value);
              var choice = _this.getChoice();
              choice.voice_name = item.value;
              choice.voice_url = filter_find.voice[idx].url;
              choice.voice = idx;
              _this.saveChoice(choice);
              Lampa.Controller.toggle(enabled);
              _this.reset();
              _this.request(filter_find.voice[idx].url);
            } else {
              Lampa.Controller.toggle(enabled);
            }
          } else {
            bwa_voice_filter = item.value || '';
            setPreferredVoice(bwa_voice_filter);
            _this.replaceChoice({ voice_name: bwa_voice_filter });
            Lampa.Controller.toggle(enabled);
            _this.display(all);
          }
        }
      });
    };

    this.openBwaSource = function() {
      var _this = this;
      var enabled = Lampa.Controller.enabled().name;
      var items = filter_sources.filter(function(key) {
        return key === auto_source_key || (sources[key] && sources[key].show);
      }).map(function(key) {
        return {
          title: key === auto_source_key ? 'Все источники' : sources[key].name,
          source: key,
          selected: key === balanser
        };
      });
      if (!items.length) return;
      Lampa.Select.show({
        title: 'Источник',
        items: items,
        onBack: function() { Lampa.Controller.toggle(enabled); },
        onSelect: function(item) {
          Lampa.Controller.toggle(enabled);
          _this.changeBalanser(item.source);
        }
      });
    };
	
    if (balansers_with_search == undefined) {
      network.timeout(10000);
      network.silent(account('http://rc.bwa.ad/lite/withsearch'), function(json) {
        balansers_with_search = json;
      }, function() {
		  balansers_with_search = [];
	  });
    }
	
    function balanserName(j) {
      var bals = j.balanser;
      var name = j.name.split(' ')[0];
      return (bals || name).toLowerCase();
    }
	
	function clarificationSearchAdd(value){
		var id = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
		var all = Lampa.Storage.get('clarification_search','{}');
		
		all[id] = value;
		
		Lampa.Storage.set('clarification_search',all);
	}
	
	function clarificationSearchDelete(){
		var id = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
		var all = Lampa.Storage.get('clarification_search','{}');
		
		delete all[id];
		
		Lampa.Storage.set('clarification_search',all);
	}
	
	function clarificationSearchGet(){
		var id = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
		var all = Lampa.Storage.get('clarification_search','{}');
		
		return all[id];
	}
	
    this.initialize = function() {
      var _this = this;
      this.loading(true);
      filter.onSearch = function(value) {
		  
		clarificationSearchAdd(value);
		
        Lampa.Activity.replace({
          search: value,
          clarification: true,
          similar: true
        });
      };
      filter.onBack = function() {
        _this.start();
      };
      filter.render().find('.selector').on('hover:enter', function() {
        clearInterval(balanser_timer);
      });
      filter.render().find('.filter--search').appendTo(filter.render().find('.torrent-filter'));
      filter.onSelect = function(type, a, b) {
        if (type == 'filter') {
          if (a.stype == 'quality') {
            setPreferredQuality(a.quality);
            Lampa.Select.close();
            if (_this.current_videos && _this.current_videos.length) {
              _this.reset();
              _this.display(_this.current_videos);
            }
            return;
          }
          if (a.reset) {
			  clarificationSearchDelete();
			  
            _this.replaceChoice({
              season: 0,
              voice: 0,
              voice_url: '',
              voice_name: ''
            });
            setTimeout(function() {
              Lampa.Select.close();
              Lampa.Activity.replace({
				  clarification: 0,
				  similar: 0
			  });
            }, 10);
          } else {
            var url = filter_find[a.stype][b.index].url;
            var choice = _this.getChoice();
            if (a.stype == 'voice') {
              choice.voice_name = filter_find.voice[b.index].title;
              choice.voice_url = url;
            }
            choice[a.stype] = b.index;
            _this.saveChoice(choice);
            _this.reset();
            _this.request(url);
            setTimeout(Lampa.Select.close, 10);
          }
        } else if (type == 'sort') {
          Lampa.Select.close();
          object.lampac_custom_select = a.source;
          _this.changeBalanser(a.source);
        }
      };
      if (filter.addButtonBack) filter.addButtonBack();
      filter.render().find('.filter--sort span').text(Lampa.Lang.translate('lampac_balanser'));
      scroll.body().addClass('torrent-list');
      files.appendFiles(scroll.render());
      files.appendHead(filter.render());
      scroll.minus(files.render().find('.explorer__files-head'));
      scroll.body().append(Lampa.Template.get('lampac_content_loading'));
      this.createBwaToolbar();
      Lampa.Controller.enable('content');
      this.loading(false);
	  if(object.balanser){
		  files.render().find('.filter--search').remove();
		  sources = {};
		  sources[object.balanser] = {name: object.balanser};
		  balanser = object.balanser;
		  filter_sources = [];
		  
		  return network["native"](account(object.url.replace('rjson=','nojson=')), this.parse.bind(this), function(){
			  files.render().find('.torrent-filter').remove();
			  _this.empty();
		  }, false, {
            dataType: 'text',
			headers: addHeaders()
		  });
	  } 
      this.externalids().then(function() {
        return _this.createSource();
      }).then(function(json) {
        if (!balansers_with_search.find(function(b) {
            return balanser.slice(0, b.length) == b;
          })) {
          filter.render().find('.filter--search').addClass('hide');
        }
        _this.search();
      })["catch"](function(e) {
        _this.noConnectToServer(e);
      });
    };
    this.rch = function(json, noreset) {
      var _this2 = this;
	  rchRun(json, function() {
        if (!noreset) _this2.find();
        else noreset();
	  });
    };
    this.externalids = function() {
      return new Promise(function(resolve, reject) {
        if (!object.movie.imdb_id || !object.movie.kinopoisk_id) {
          var query = [];
          query.push('id=' + encodeURIComponent(object.movie.id));
          query.push('serial=' + (object.movie.name ? 1 : 0));
          if (object.movie.imdb_id) query.push('imdb_id=' + (object.movie.imdb_id || ''));
          if (object.movie.kinopoisk_id) query.push('kinopoisk_id=' + (object.movie.kinopoisk_id || ''));
          var url = Defined.localhost + 'externalids?' + query.join('&');
          network.timeout(10000);
          network.silent(account(url), function(json) {
            for (var name in json) {
              object.movie[name] = json[name];
            }
            resolve();
          }, function() {
            resolve();
          }, false, {
              headers: addHeaders()
		  });
        } else resolve();
      });
    };
    this.updateBalanser = function(balanser_name) {
      var last_select_balanser = Lampa.Storage.cache('online_last_balanser', 3000, {});
      last_select_balanser[object.movie.id] = balanser_name;
      Lampa.Storage.set('online_last_balanser', last_select_balanser);
    };
    this.changeBalanser = function(balanser_name) {
      this.updateBalanser(balanser_name);
      Lampa.Storage.set('online_balanser', balanser_name);
      var to = this.getChoice(balanser_name);
      var from = this.getChoice();
      if (from.voice_name) to.voice_name = from.voice_name;
      this.saveChoice(to, balanser_name);
      Lampa.Activity.replace();
    };
    this.requestParams = function(url) {
      var query = [];
      var card_source = object.movie.source || 'tmdb'; //Lampa.Storage.field('source')
      query.push('id=' + encodeURIComponent(object.movie.id));
      if (object.movie.imdb_id) query.push('imdb_id=' + (object.movie.imdb_id || ''));
      if (object.movie.kinopoisk_id) query.push('kinopoisk_id=' + (object.movie.kinopoisk_id || ''));
	  if (object.movie.tmdb_id) query.push('tmdb_id=' + (object.movie.tmdb_id || ''));
	  if (object.movie.keywords && object.movie.keywords.results) {
         for (var i = 0, a = object.movie.keywords.results; i < a.length; i++) {
            if (a[i].name == 'anime') {
                query.push('anime=1');
                break;
            }
         }
	  }
      query.push('title=' + encodeURIComponent(object.clarification ? object.search : object.movie.title || object.movie.name));
      query.push('original_title=' + encodeURIComponent(object.movie.original_title || object.movie.original_name));
      query.push('serial=' + (object.movie.name ? 1 : 0));
      query.push('original_language=' + (object.movie.original_language || ''));
      query.push('year=' + ((object.movie.release_date || object.movie.first_air_date || '0000') + '').slice(0, 4));
      query.push('source=' + card_source);
      query.push('clarification=' + (object.clarification ? 1 : 0));
      query.push('similar=' + (object.similar ? true : false));
      query.push('rchtype=' + (((window.rch_nws && window.rch_nws[hostkey]) ? window.rch_nws[hostkey].type : (window.rch && window.rch[hostkey]) ? window.rch[hostkey].type : '') || ''));
      if (Lampa.Storage.get('account_email', '')) query.push('cub_id=' + Lampa.Utils.hash(Lampa.Storage.get('account_email', '')));
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + query.join('&');
    };
    this.getLastChoiceBalanser = function() {
      var last_select_balanser = Lampa.Storage.cache('online_last_balanser', 3000, {});
      if (last_select_balanser[object.movie.id]) {
        return last_select_balanser[object.movie.id];
      } else {
        return Lampa.Storage.get('online_balanser', filter_sources.length ? filter_sources[0] : '');
      }
    };
    this.startSource = function(json) {
      return new Promise(function(resolve, reject) {
        json.forEach(function(j) {
          var name = balanserName(j);
          sources[name] = {
            url: j.url,
            name: j.name,
            show: typeof j.show == 'undefined' ? true : j.show
          };
        });
        filter_sources = Lampa.Arrays.getKeys(sources);
        if (filter_sources.length > 1 && !sources[auto_source_key]) {
          var ordered_sources = {};
          ordered_sources[auto_source_key] = {
            url: '',
            name: Lampa.Lang.translate('lampac_auto_sources'),
            show: true
          };
          filter_sources.forEach(function(key) {
            ordered_sources[key] = sources[key];
          });
          sources = ordered_sources;
          filter_sources = Lampa.Arrays.getKeys(sources);
        }
        if (filter_sources.length) {
          var last_select_balanser = Lampa.Storage.cache('online_last_balanser', 3000, {});
          if (last_select_balanser[object.movie.id]) {
            balanser = last_select_balanser[object.movie.id];
          } else {
            balanser = Lampa.Storage.get('online_balanser', sources[auto_source_key] ? auto_source_key : filter_sources[0]);
          }
          if (!sources[balanser]) balanser = filter_sources[0];
          if (!sources[balanser].show && !object.lampac_custom_select) balanser = filter_sources[0];
          source = sources[balanser].url;
          if (balanser === auto_source_key) source = '';
          Lampa.Storage.set('active_balanser', balanser);
          resolve(json);
        } else {
          reject();
        }
      });
    };
    this.lifeSource = function() {
      var _this3 = this;
      return new Promise(function(resolve, reject) {
        var url = _this3.requestParams(Defined.localhost + 'lifeevents?memkey=' + (_this3.memkey || ''));
        var red = false;
        var gou = function gou(json, any) {
          if (json.accsdb) return reject(json);
          var last_balanser = _this3.getLastChoiceBalanser();
          if (!red) {
            var _filter = json.online.filter(function(c) {
              return any ? c.show : c.show && c.name.toLowerCase() == last_balanser;
            });
            if (_filter.length) {
              red = true;
              resolve(json.online.filter(function(c) {
                return c.show;
              }));
            } else if (any) {
              reject();
            }
          }
        };
        var fin = function fin(call) {
          network.timeout(3000);
          network.silent(account(url), function(json) {
            life_wait_times++;
            filter_sources = [];
            sources = {};
            json.online.forEach(function(j) {
              var name = balanserName(j);
              sources[name] = {
                url: j.url,
                name: j.name,
                show: typeof j.show == 'undefined' ? true : j.show
              };
            });
            filter_sources = Lampa.Arrays.getKeys(sources);
            filter.set('sort', filter_sources.map(function(e) {
              return {
                title: sources[e].name,
                source: e,
                selected: e == balanser,
                ghost: !sources[e].show
              };
            }));
            filter.chosen('sort', [sources[balanser] ? sources[balanser].name : balanser]);
            gou(json);
            var lastb = _this3.getLastChoiceBalanser();
            if (life_wait_times > 15 || json.ready) {
              filter.render().find('.lampac-balanser-loader').remove();
              gou(json, true);
            } else if (!red && sources[lastb] && sources[lastb].show) {
              gou(json, true);
              life_wait_timer = setTimeout(fin, 1000);
            } else {
              life_wait_timer = setTimeout(fin, 1000);
            }
          }, function() {
            life_wait_times++;
            if (life_wait_times > 15) {
              reject();
            } else {
              life_wait_timer = setTimeout(fin, 1000);
            }
          }, false, {
              headers: addHeaders()
		  });
        };
        fin();
      });
    };
    this.createSource = function() {
      var _this4 = this;
      return new Promise(function(resolve, reject) {
        var url = _this4.requestParams(Defined.localhost + 'lite/events?life=true');
        network.timeout(15000);
        network.silent(account(url), function(json) {
          if (json.accsdb) return reject(json);
          if (json.life) {
			_this4.memkey = json.memkey;
			if (json.title) {
              if (object.movie.name) object.movie.name = json.title;
              if (object.movie.title) object.movie.title = json.title;
			}
            filter.render().find('.filter--sort').append('<span class="lampac-balanser-loader" style="width: 1.2em; height: 1.2em; margin-top: 0; background: url(./img/loader.svg) no-repeat 50% 50%; background-size: contain; margin-left: 0.5em"></span>');
            _this4.lifeSource().then(_this4.startSource).then(resolve)["catch"](reject);
          } else {
            _this4.startSource(json).then(resolve)["catch"](reject);
          }
        }, reject, false, {
            headers: addHeaders()
		  });
      });
    };
    /**
     * Подготовка
     */
    this.create = function() {
      return this.render();
    };
    /**
     * Начать поиск
     */
    this.search = function() { //this.loading(true)
      this.filter({
        source: filter_sources,
        quality: true
      }, this.getChoice());
      if (balanser === auto_source_key) this.findAuto();
      else this.find();
    };

    this.findAuto = function() {
      var _this = this;
      this.reset();
      filter_find.season = [];
      filter_find.voice = [];

      var targets = filter_sources.filter(function(key) {
        return key !== auto_source_key && sources[key] && sources[key].show;
      }).slice(0, auto_max_sources);

      if (!targets.length) {
        this.empty();
        return;
      }

      var pendingSources = targets.length;
      var collected = [];
      var seen = {};
      var completedSources = 0;
      _this.updateBwaToolbar('Ищем сразу по ' + targets.length + ' источникам…');

      var finishAll = function() {
        pendingSources--;
        completedSources++;
        _this.updateBwaToolbar('Проверено ' + completedSources + ' / ' + targets.length + ' источников…');

        if (pendingSources > 0) return;

        if (!collected.length) {
          _this.empty();
          return;
        }

        collected.sort(function(a, b) {
          var aq = pickQuality(a.qualitys || a.quality, getPreferredQuality());
          var bq = pickQuality(b.qualitys || b.quality, getPreferredQuality());
          var av = aq ? aq.quality : 0;
          var bv = bq ? bq.quality : 0;

          if (av !== bv) return bv - av;
          if ((a._bwa_source_name || '') !== (b._bwa_source_name || '')) {
            return (a._bwa_source_name || '').localeCompare(b._bwa_source_name || '');
          }

          return String(a.voice_name || a.text || '').localeCompare(String(b.voice_name || b.text || ''));
        });

        _this.current_videos = collected;
        _this.display(collected);
      };

      targets.forEach(function(key) {
        var meta = sources[key];
        var sourceFinished = false;

        var sourceDone = function() {
          if (sourceFinished) return;
          sourceFinished = true;
          finishAll();
        };

        var addVideos = function(videos, voice) {
          videos.forEach(function(item) {
            item._bwa_source = key;
            item._bwa_source_name = meta.name;

            if (voice && !item.voice_name) item.voice_name = voice;

            var sig = [
              item.url || '',
              item.stream || '',
              item.episode || '',
              item.season || '',
              String(item.voice_name || item.text || '').toLowerCase(),
              JSON.stringify(normalizedQualityMap(item.quality || item.qualitys || {}))
            ].join('|');

            if (!seen[sig]) {
              seen[sig] = true;
              collected.push(item);
            }
          });
        };

        var load = function(url, depth, voice, done) {
          network["native"](account(url), function(raw) {
            var json = Lampa.Arrays.decodeJson(raw, {});
            if (Lampa.Arrays.isObject(raw) && raw.rch) json = raw;

            if (json && json.rch) {
              rchRun(json, function() {
                load(url, depth, voice, done);
              });
              return;
            }

            process(raw, depth, voice, done);
          }, function() {
            done();
          }, false, {
            dataType: 'text',
            headers: addHeaders()
          });
        };

        var process = function(raw, depth, voice, done) {
          var items = _this.parseJsonDate(raw, '.videos__item');
          var buttons = _this.parseJsonDate(raw, '.videos__button');

          var videos = items.filter(function(v) {
            return v.method === 'play' || v.method === 'call';
          });

          if (videos.length) {
            addVideos(videos, voice);
            done();
            return;
          }

          var links = items.filter(function(v) {
            return v.method === 'link' && !v.similar && v.url;
          });

          if (links.length && depth < 2) {
            var maxLinks = Math.min(links.length, 6);
            var remainingLinks = maxLinks;

            links.slice(0, maxLinks).forEach(function(link) {
              load(link.url, depth + 1, voice, function() {
                remainingLinks--;

                if (remainingLinks === 0) done();
              });
            });

            return;
          }

          if (buttons.length && depth < 2) {
            var voiceButtons = buttons.slice(0, 10);
            var remainingButtons = voiceButtons.length;

            voiceButtons.forEach(function(button) {
              load(button.url, depth + 1, button.text || voice, function() {
                remainingButtons--;

                if (remainingButtons === 0) done();
              });
            });

            return;
          }

          done();
        };

        load(_this.requestParams(meta.url), 0, '', sourceDone);
      });
    };

    this.find = function() {
      this.updateBwaToolbar('Проверяем источник…');
      this.request(this.requestParams(source));
    };
    this.request = function(url) {
      number_of_requests++;
      if (number_of_requests < 10) {
        network["native"](account(url), this.parse.bind(this), this.doesNotAnswer.bind(this), false, {
          dataType: 'text',
		  headers: addHeaders()
        });
        clearTimeout(number_of_requests_timer);
        number_of_requests_timer = setTimeout(function() {
          number_of_requests = 0;
        }, 4000);
      } else this.empty();
    };
    this.parseJsonDate = function(str, name) {
      try {
        var html = $('<div>' + str + '</div>');
        var elems = [];
        html.find(name).each(function() {
          var item = $(this);
          var data = JSON.parse(item.attr('data-json'));
          var season = item.attr('s');
          var episode = item.attr('e');
          var text = item.text();
          if (!object.movie.name) {
            if (text.match(/\d+p/i)) {
              if (!data.quality) {
                data.quality = {};
                data.quality[text] = data.url;
              }
              text = object.movie.title;
            }
            if (text == 'По умолчанию') {
              text = object.movie.title;
            }
          }
          if (episode) data.episode = parseInt(episode);
          if (season) data.season = parseInt(season);
          if (text) data.text = text;
          data.active = item.hasClass('active');
          elems.push(data);
        });
        return elems;
      } catch (e) {
        return [];
      }
    };
    this.getFileUrl = function(file, call, waiting_rch) {
	  var _this = this;
	  
      if(Lampa.Storage.field('player') !== 'inner' && file.stream && Lampa.Platform.is('apple')){
		  var newfile = Lampa.Arrays.clone(file);
		  newfile.method = 'play';
		  newfile.url = file.stream;
		  call(newfile, {});
	  }
      else if (file.method == 'play') call(file, {});
      else {
        Lampa.Loading.start(function() {
          Lampa.Loading.stop();
          Lampa.Controller.toggle('content');
          network.clear();
        });
        network["native"](account(file.url), function(json) {
			if(json.rch){
				if(waiting_rch) {
					waiting_rch = false;
					Lampa.Loading.stop();
					call(false, {});
				}
				else {
					_this.rch(json,function(){
						Lampa.Loading.stop();
						
						_this.getFileUrl(file, call, true);
					});
				}
			}
			else{
				Lampa.Loading.stop();
				call(json, json);
			}
        }, function() {
          Lampa.Loading.stop();
          call(false, {});
        }, false, {
            headers: addHeaders()
		  });
      }
    };
    this.toPlayElement = function(file) {
      var play = {
        title: file.title,
        url: file.url,
        quality: file.qualitys,
        timeline: file.timeline,
        subtitles: file.subtitles,
		segments: file.segments,
        callback: file.mark,
		season: file.season,
		episode: file.episode,
		voice_name: file.voice_name,
		thumbnail: file.thumbnail
      };
      return play;
    };
    this.orUrlReserve = function(data) {
      if (data.url && typeof data.url == 'string' && data.url.indexOf(" or ") !== -1) {
        var urls = data.url.split(" or ");
        data.url = urls[0];
        data.url_reserve = urls[1];
      }
    };
    this.setDefaultQuality = function(data, preferredOverride) {
      if (!data.quality || !Lampa.Arrays.getKeys(data.quality).length) return;

      var preferred = typeof preferredOverride !== 'undefined' ? parseInt(preferredOverride, 10) : getPreferredQuality();
      if (isNaN(preferred)) preferred = getPreferredQuality();
      var picked = pickQuality(data.quality, preferred);
      if (picked && picked.url) {
        data.url = picked.url;
        data.selected_quality = picked.quality;
        this.orUrlReserve(data);
      }

      for (var q in data.quality) {
        if (typeof data.quality[q] === 'string' && data.quality[q].indexOf(" or ") !== -1)
          data.quality[q] = data.quality[q].split(" or ")[0];
      }
    };
    this.display = function(videos) {
      var _this5 = this;
      bwa_all_videos = (videos || []).slice();
      var visibleVideos = bwa_all_videos.slice();
      if (bwa_voice_filter) {
        visibleVideos = visibleVideos.filter(function(item) {
          return bwaItemVoice(item).trim().toLowerCase() === bwa_voice_filter.trim().toLowerCase();
        });
      }

      var serial = !!object.movie.name;
      if (serial) {
        var groups = this.seriesForSeason(visibleVideos);
        bwa_series_groups = groups;
        var reps = [];
        groups.forEach(function(group){
          var selected = bwaChooseSeriesVariant(group, function(){ return _this5.getChoice(); });
          if (!selected) return;
          selected._bwa_group = group;
          selected._bwa_variant_count = group.items.length;
          selected._bwa_voice_count = bwaUnique(group.items.map(function(v){ return bwaItemVoice(v); })).length;
          selected._bwa_source_count = bwaUnique(group.items.map(function(v){ return bwaSafeText(v._bwa_source_name || ''); })).filter(Boolean).length;
          reps.push(selected);
        });
        visibleVideos = reps;
        bwa_series_playlist = reps.slice();
      } else {
        bwa_series_groups = [];
        bwa_series_playlist = visibleVideos.slice();
      }

      this.current_videos = visibleVideos;
      this.draw(visibleVideos, {
        serialGroups: serial ? bwa_series_groups : null,
        onEnter: function onEnter(item, html) {
          var run = function(selectedItem) {
            _this5.playBwaItem(selectedItem, bwa_series_playlist.length ? bwa_series_playlist : visibleVideos);
          };
          if (serial && item._bwa_group && item._bwa_group.items.length > 1) {
            _this5.openEpisodeVariants(item._bwa_group, run);
          } else run(item);
        },
        onContextMenu: function onContextMenu(item, html, data, call) {
          _this5.getFileUrl(item, function(stream) {
            call({
              file: stream && stream.url,
              quality: item.qualitys
            });
          }, true);
        }
      });
      var seasonText = serial && bwa_season_filter ? ('Сезон ' + bwa_season_filter + ' · ') : '';
      this.updateBwaToolbar(bwa_voice_filter ? (seasonText + 'Озвучка: ' + bwa_voice_filter + ' · ' + visibleVideos.length + ' серий') : (seasonText + 'Показано серий: ' + visibleVideos.length));
      this.filter({
        season: filter_find.season.map(function(s) { return s.title; }),
        voice: filter_find.voice.map(function(b) { return b.title; }),
        quality: true
      }, this.getChoice());
    };

    this.playBwaItem = function(item, videos) {
      var _this = this;
      this.getFileUrl(item, function(json, json_call) {
        if (json && json.url) {
          var playlist = [];
          var first = _this.toPlayElement(item);
          first.url = json.url;
          first.headers = json_call.headers || json.headers;
          first.quality = json_call.quality || item.qualitys;
          first.segments = json_call.segments || item.segments;
          first.hls_manifest_timeout = json_call.hls_manifest_timeout || json.hls_manifest_timeout;
          first.subtitles = json.subtitles;
          first.subtitles_call = json_call.subtitles_call || json.subtitles_call;
          if (json.vast && json.vast.url) {
            first.vast_url = json.vast.url;
            first.vast_msg = json.vast.msg;
            first.vast_region = json.vast.region;
            first.vast_platform = json.vast.platform;
            first.vast_screen = json.vast.screen;
          }
          _this.orUrlReserve(first);
          var titleChoice = _this.getChoice();
          var titlePreferredQuality = typeof titleChoice.quality !== 'undefined' ? parseInt(titleChoice.quality, 10) : getPreferredQuality();
          if (isNaN(titlePreferredQuality)) titlePreferredQuality = getPreferredQuality();
          _this.setDefaultQuality(first, titlePreferredQuality);
          if (item.season) {
            (videos || [item]).forEach(function(elem) {
              var cell = _this.toPlayElement(elem);
              if (elem === item) cell.url = json.url;
              else if (elem.method === 'call') {
                if (Lampa.Storage.field('player') !== 'inner') {
                  cell.url = elem.stream;
                  delete cell.quality;
                } else {
                  cell.url = function(call) {
                    _this.getFileUrl(elem, function(stream, stream_json) {
                      if (stream && stream.url) {
                        cell.url = stream.url;
                        cell.quality = stream_json.quality || elem.qualitys;
                        cell.segments = stream_json.segments || elem.segments;
                        cell.subtitles = stream.subtitles;
                        _this.orUrlReserve(cell);
                        _this.setDefaultQuality(cell, titlePreferredQuality);
                        elem.mark && elem.mark();
                      } else {
                        cell.url = '';
                        Lampa.Noty.show(Lampa.Lang.translate('lampac_nolink'));
                      }
                      call();
                    }, function() { cell.url = ''; call(); });
                  };
                }
              } else cell.url = elem.url;
              _this.orUrlReserve(cell);
              _this.setDefaultQuality(cell, titlePreferredQuality);
              playlist.push(cell);
            });
          } else playlist.push(first);
          if (playlist.length > 1) first.playlist = playlist;
          if (first.url) {
            first.isonline = true;
            Lampa.Player.play(first);
            Lampa.Player.playlist(playlist);
            if (first.subtitles_call) _this.loadSubtitles(first.subtitles_call);
            item.mark && item.mark();
            _this.updateBalanser(balanser);
          } else Lampa.Noty.show(Lampa.Lang.translate('lampac_nolink'));
        } else Lampa.Noty.show(Lampa.Lang.translate('lampac_nolink'));
      }, true);
    };

	this.loadSubtitles = function(link){
		network.silent(account(link), function(subs){
			Lampa.Player.subtitles(subs)
		}, function() {},false, {
            headers: addHeaders()
		  })
	}
    this.parse = function(str) {
      var json = Lampa.Arrays.decodeJson(str, {});
      if (Lampa.Arrays.isObject(str) && str.rch) json = str;
      if (json.rch) return this.rch(json);
      try {
        var items = this.parseJsonDate(str, '.videos__item');
        var buttons = this.parseJsonDate(str, '.videos__button');
        if (items.length == 1 && items[0].method == 'link' && !items[0].similar) {
          filter_find.season = items.map(function(s) {
            return {
              title: s.text,
              url: s.url
            };
          });
          this.replaceChoice({
            season: 0
          });
          this.request(items[0].url);
        } else {
          this.activity.loader(false);
          var videos = items.filter(function(v) {
            return v.method == 'play' || v.method == 'call';
          });
          var similar = items.filter(function(v) {
            return v.similar;
          });
          if (videos.length) {
            if (buttons.length) {
              filter_find.voice = buttons.map(function(b) {
                return {
                  title: b.text,
                  url: b.url
                };
              });
              var select_voice_url = this.getChoice(balanser).voice_url;
              var select_voice_name = this.getChoice(balanser).voice_name;
              var find_voice_url = buttons.find(function(v) {
                return v.url == select_voice_url;
              });
              var find_voice_name = buttons.find(function(v) {
                return v.text == select_voice_name;
              });
              var find_voice_active = buttons.find(function(v) {
                return v.active;
              }); ////console.log('b',buttons)
              ////console.log('u',find_voice_url)
              ////console.log('n',find_voice_name)
              ////console.log('a',find_voice_active)
              if (find_voice_url && !find_voice_url.active) {
                //console.log('Lampac', 'go to voice', find_voice_url);
                this.replaceChoice({
                  voice: buttons.indexOf(find_voice_url),
                  voice_name: find_voice_url.text
                });
                this.request(find_voice_url.url);
              } else if (find_voice_name && !find_voice_name.active) {
                //console.log('Lampac', 'go to voice', find_voice_name);
                this.replaceChoice({
                  voice: buttons.indexOf(find_voice_name),
                  voice_name: find_voice_name.text
                });
                this.request(find_voice_name.url);
              } else {
                if (find_voice_active) {
                  this.replaceChoice({
                    voice: buttons.indexOf(find_voice_active),
                    voice_name: find_voice_active.text
                  });
                }
                this.display(videos);
              }
            } else {
              this.replaceChoice({
                voice: 0,
                voice_url: '',
                voice_name: ''
              });
              this.display(videos);
            }
          } else if (items.length) {
            if (similar.length) {
              this.similars(similar);
              this.activity.loader(false);
            } else { //this.activity.loader(true)
              filter_find.season = items.map(function(s) {
                return {
                  title: s.text,
                  url: s.url
                };
              });
              var select_season = this.getChoice(balanser).season;
              var season = filter_find.season[select_season];
              if (!season) season = filter_find.season[0];
              //console.log('Lampac', 'go to season', season);
              this.request(season.url);
            }
          } else {
            this.doesNotAnswer(json);
          }
        }
      } catch (e) {
        //console.log('Lampac', 'error', e.stack);
        this.doesNotAnswer(e);
      }
    };
    this.similars = function(json) {
      var _this6 = this;
      scroll.clear();
      json.forEach(function(elem) {
        elem.title = elem.text;
        elem.info = '';
        var info = [];
        var year = ((elem.start_date || elem.year || object.movie.release_date || object.movie.first_air_date || '') + '').slice(0, 4);
        if (year) info.push(year);
        if (elem.details) info.push(elem.details);
        var name = elem.title || elem.text;
        elem.title = name;
        elem.time = elem.time || '';
        elem.info = info.join('<span class="online-prestige-split">●</span>');
        var item = Lampa.Template.get('lampac_prestige_folder', elem);
		if (elem.img) {
		  var image = $('<img style="height: 7em; width: 7em; border-radius: 0.3em;"/>');
		  item.find('.online-prestige__folder').empty().append(image);

		  if (elem.img !== undefined) {
		    if (elem.img.charAt(0) === '/')
		      elem.img = Defined.localhost + elem.img.substring(1);
		    if (elem.img.indexOf('/proxyimg') !== -1)
		      elem.img = account(elem.img);
		  }

		  Lampa.Utils.imgLoad(image, elem.img);
		}
        item.on('hover:enter', function() {
          _this6.reset();
          _this6.request(elem.url);
        }).on('hover:focus', function(e) {
          last = e.target;
          scroll.update($(e.target), true);
        });
        scroll.append(item);
      });
	  this.filter({
        season: filter_find.season.map(function(s) {
          return s.title;
        }),
        voice: filter_find.voice.map(function(b) {
          return b.title;
        }),
        quality: true
      }, this.getChoice());
      Lampa.Controller.enable('content');
    };
    this.getChoice = function(for_balanser) {
      var data = Lampa.Storage.cache('online_choice_' + (for_balanser || balanser), 3000, {});
      var save = data[object.movie.id] || {};
      Lampa.Arrays.extend(save, {
        season: 0,
        voice: 0,
        voice_name: '',
        voice_id: 0,
        episodes_view: {},
        movie_view: ''
      });
      return save;
    };
    this.saveChoice = function(choice, for_balanser) {
      var data = Lampa.Storage.cache('online_choice_' + (for_balanser || balanser), 3000, {});
      data[object.movie.id] = choice;
      Lampa.Storage.set('online_choice_' + (for_balanser || balanser), data);
      this.updateBalanser(for_balanser || balanser);
    };
    this.replaceChoice = function(choice, for_balanser) {
      var to = this.getChoice(for_balanser);
      Lampa.Arrays.extend(to, choice, true);
      this.saveChoice(to, for_balanser);
    };
    this.clearImages = function() {
      images.forEach(function(img) {
        img.onerror = function() {};
        img.onload = function() {};
        img.src = '';
      });
      images = [];
    };
    /**
     * Очистить список файлов
     */
    this.reset = function() {
      last = false;
      clearInterval(balanser_timer);
      network.clear();
      this.clearImages();
      scroll.render().find('.empty').remove();
      scroll.clear();
      scroll.reset();
      scroll.body().append(Lampa.Template.get('lampac_content_loading'));
      this.createBwaToolbar();
    };
    /**
     * Загрузка
     */
    this.loading = function(status) {
      if (status) this.activity.loader(true);
      else {
        this.activity.loader(false);
        this.activity.toggle();
      }
    };
    /**
     * Построить фильтр
     */
    this.filter = function(filter_items, choice) {
      var _this7 = this;
      var select = [];
      var add = function add(type, title) {
        var need = _this7.getChoice();
        var items = filter_items[type];
        var subitems = [];
        var value = need[type];
        items.forEach(function(name, i) {
          subitems.push({
            title: name,
            selected: value == i,
            index: i
          });
        });
        select.push({
          title: title,
          subtitle: items[value],
          items: subitems,
          stype: type
        });
      };
      filter_items.source = filter_sources;
      select.push({
        title: Lampa.Lang.translate('torrent_parser_reset'),
        reset: true
      });

      if (filter_items.quality) {
        var qualityItems = [{
          title: 'Авто',
          quality: 0,
          selected: getPreferredQuality() === 0
        }];

        BWA_QUALITY_LIST.forEach(function(q) {
          qualityItems.push({
            title: q + 'p',
            quality: q,
            selected: getPreferredQuality() === q
          });
        });

        select.push({
          title: Lampa.Lang.translate('lampac_quality'),
          subtitle: qualityText(getPreferredQuality()),
          items: qualityItems,
          stype: 'quality'
        });
      }
      this.saveChoice(choice);
      if (filter_items.voice && filter_items.voice.length) add('voice', Lampa.Lang.translate('torrent_parser_voice'));
      if (filter_items.season && filter_items.season.length) add('season', Lampa.Lang.translate('torrent_serial_season'));
      filter.set('filter', select);
      filter.set('sort', filter_sources.map(function(e) {
        return {
          title: e == auto_source_key ? Lampa.Lang.translate('lampac_auto_sources') : sources[e].name,
          source: e,
          selected: e == balanser,
          ghost: !sources[e].show
        };
      }));
      this.selected(filter_items);
    };
    /**
     * Показать что выбрано в фильтре
     */
    this.selected = function(filter_items) {
      var need = this.getChoice(),
        select = [];
      for (var i in need) {
        if (filter_items[i] && filter_items[i].length) {
          if (i == 'voice') {
            select.push(filter_translate[i] + ': ' + filter_items[i][need[i]]);
          } else if (i !== 'source') {
            if (filter_items.season.length >= 1) {
              select.push(filter_translate.season + ': ' + filter_items[i][need[i]]);
            }
          }
        }
      }
      filter.chosen('filter', select);
      filter.chosen('sort', [sources[balanser].name]);
    };
    this.getEpisodes = function(season, call) {
      var episodes = [];
	  var tmdb_id = object.movie.id;
	  if (['cub', 'tmdb'].indexOf(object.movie.source || 'tmdb') == -1) 
        tmdb_id = object.movie.tmdb_id;
      if (typeof tmdb_id == 'number' && object.movie.name) {
		  Lampa.Api.sources.tmdb.get('tv/' + tmdb_id + '/season/' + season, {}, function(data){
			  episodes = data.episodes || [];
			  
			  call(episodes);
		  }, function(){
			  call(episodes);
		  })
      } else call(episodes);
    };
    this.watched = function(set) {
      var file_id = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
      var watched = Lampa.Storage.cache('online_watched_last', 5000, {});
      if (set) {
        if (!watched[file_id]) watched[file_id] = {};
        Lampa.Arrays.extend(watched[file_id], set, true);
        Lampa.Storage.set('online_watched_last', watched);
        this.updateWatched();
      } else {
        return watched[file_id];
      }
    };
    this.updateWatched = function() {
      var watched = this.watched();
      var body = scroll.body().find('.online-prestige-watched .online-prestige-watched__body').empty();
      if (watched) {
        var line = [];
        if (watched.balanser_name) line.push(watched.balanser_name);
        if (watched.voice_name) line.push(watched.voice_name);
        if (watched.season) line.push(Lampa.Lang.translate('torrent_serial_season') + ' ' + watched.season);
        if (watched.episode) line.push(Lampa.Lang.translate('torrent_serial_episode') + ' ' + watched.episode);
        line.forEach(function(n) {
          body.append('<span>' + n + '</span>');
        });
      } else body.append('<span>' + Lampa.Lang.translate('lampac_no_watch_history') + '</span>');
    };
    /**
     * Отрисовка файлов
     */
    this.draw = function(items) {
      var _this8 = this;
      var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (!items.length) return this.empty();
      this.current_videos = items;
      scroll.clear();
      if (object.movie.name && bwa_season_filter) {
        var header = $('<div class="bwa-season-header"><div class="bwa-season-header__main">Сезон ' + bwa_season_filter + '</div><div class="bwa-season-header__meta">' + items.length + ' серий • OK — выбрать озвучку и качество</div></div>');
        scroll.append(header);
      }
      if(!object.balanser)scroll.append(Lampa.Template.get('lampac_prestige_watched', {}));
      this.updateWatched();
      this.getEpisodes(items[0].season, function(episodes) {
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var serial = object.movie.name ? true : false;
        var choice = _this8.getChoice();
        var fully = window.innerWidth > 480;
        var scroll_to_element = false;
        var scroll_to_mark = false;
        items.forEach(function(element, index) {
          var episode = serial && episodes.length && !params.similars ? episodes.find(function(e) {
            return e.episode_number == element.episode;
          }) : false;
          var episode_num = element.episode || index + 1;
          var episode_last = choice.episodes_view[element.season];
          var voice_name = bwaSafeText(choice.voice_name || (filter_find.voice[0] ? filter_find.voice[0].title : false) || element.voice_name || (serial ? 'Неизвестно' : element.text) || 'Неизвестно');
          if (element.quality && !element.qualitys) element.qualitys = element.quality;

          var qualityMap = normalizedQualityMap(element.qualitys || {});
          var availableQualities = Object.keys(qualityMap).map(function(q) {
            return parseInt(q, 10);
          }).sort(function(a, b) { return b - a; });
          var preferred = getPreferredQuality();
          var picked = pickQuality(qualityMap, preferred);
          var qualityLabel = availableQualities.length ? availableQualities.map(function(q) {
            return q + 'p';
          }).join(' · ') : '';
          var preferredLabel = picked ? picked.quality + 'p' + (preferred > 0 && picked.quality !== preferred ? ' ↓' : '') : '';

          Lampa.Arrays.extend(element, {
            voice_name: voice_name,
            info: voice_name.length > 60 ? voice_name.substr(0, 60) + '...' : voice_name,
            quality: qualityLabel,
            _bwa_preferred_quality: picked ? picked.quality : 0,
            _bwa_available_qualities: availableQualities,
            time: Lampa.Utils.secondsToTime((episode ? episode.runtime : object.movie.runtime) * 60, true)
          });

          if (picked && element.method === 'play' && !element.stream) element.url = picked.url;
          var hash_timeline = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var hash_behold = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.voice_name].join('') : object.movie.original_title + element.voice_name);
          var data = {
            hash_timeline: hash_timeline,
            hash_behold: hash_behold
          };
          var info = [];
          if (element._bwa_source_name && fully) {
            var sourceInfoText = bwaSafeText(element._bwa_source_name);
            if (sourceInfoText) info.push(sourceInfoText);
          }
          if (element.season) {
            element.translate_episode_end = _this8.getLastEpisode(items);
            element.translate_voice = element.voice_name;
          }
          if (element.text && !episode) element.title = bwaSafeText(element.text);
          element.timeline = Lampa.Timeline.view(hash_timeline);
          if (episode) {
            element.title = episode.name;
            if (element.info.length < 30 && episode.vote_average) info.push(Lampa.Template.get('lampac_prestige_rate', {
              rate: parseFloat(episode.vote_average + '').toFixed(1)
            }, true));
            if (episode.air_date && fully) info.push(Lampa.Utils.parseTime(episode.air_date).full);
          } else if (object.movie.release_date && fully) {
            info.push(Lampa.Utils.parseTime(object.movie.release_date).full);
          }
          if (!serial && object.movie.tagline && element.info.length < 30) info.push(object.movie.tagline);
          if (element.info) { var safeInfo = bwaSafeText(element.info); if (safeInfo) info.push(safeInfo); }
          if (info.length) element.info = info.map(function(i) {
            return '<span>' + i + '</span>';
          }).join('<span class="online-prestige-split">●</span>');
          var html = Lampa.Template.get('lampac_prestige_full', element);
          var tags = html.find('.bwa-card__tags');
          if (tags.length) {
            var addTag = function(text, kind) {
              if (!text) return;
              $('<span class="bwa-card__tag"></span>').addClass(kind ? 'bwa-card__tag--' + kind : '').text(text).appendTo(tags);
            };
            if (preferredLabel) addTag(preferredLabel, preferred > 0 && picked && picked.quality !== preferred ? 'fallback' : 'quality');
            if (element.voice_name || element.text) addTag(element.voice_name || element.text, 'voice');
            if (element._bwa_source_name && balanser === auto_source_key) addTag(bwaSafeText(element._bwa_source_name), 'source');
            if (serial && element.episode) addTag('Серия ' + formatEpisodeNumber(element.episode), 'episode');
            if (serial && element._bwa_variant_count > 1) addTag(element._bwa_variant_count + ' вариантов', 'muted');
            if (serial && element._bwa_voice_count > 1) addTag(element._bwa_voice_count + ' озвучки', 'voice-count');
            if (serial && element._bwa_source_count > 1) addTag(element._bwa_source_count + ' источника', 'source-count');
            if (availableQualities.length > 1) addTag(availableQualities.length + ' качества', 'muted');
          }
          var loader = html.find('.online-prestige__loader');
          var image = html.find('.online-prestige__img');
		  if(object.balanser) image.hide();
          if (!serial) {
            if (choice.movie_view == hash_behold) scroll_to_element = html;
          } else if (typeof episode_last !== 'undefined' && episode_last == episode_num) {
            scroll_to_element = html;
          }
          if (serial && !episode) {
            image.append('<div class="online-prestige__episode-number">' + formatEpisodeNumber(element.episode || index + 1) + '</div>');
            loader.remove();
          }
		  else if (!serial && object.movie.backdrop_path == 'undefined') loader.remove();
          else {
            var img = html.find('img')[0];
            img.onerror = function() {
              img.src = './img/img_broken.svg';
            };
            img.onload = function() {
              image.addClass('online-prestige__img--loaded');
              loader.remove();
              if (serial) image.append('<div class="online-prestige__episode-number">' + formatEpisodeNumber(element.episode || index + 1) + '</div>');
            };
            img.src = Lampa.TMDB.image('t/p/w300' + (episode ? episode.still_path : object.movie.backdrop_path));
            images.push(img);
			element.thumbnail = img.src
          }
          html.find('.online-prestige__timeline').append(Lampa.Timeline.render(element.timeline));
          if (viewed.indexOf(hash_behold) !== -1) {
            scroll_to_mark = html;
            html.find('.online-prestige__img').append('<div class="online-prestige__viewed">' + Lampa.Template.get('icon_viewed', {}, true) + '</div>');
          }
          element.mark = function() {
            viewed = Lampa.Storage.cache('online_view', 5000, []);
            if (viewed.indexOf(hash_behold) == -1) {
              viewed.push(hash_behold);
              Lampa.Storage.set('online_view', viewed);
              if (html.find('.online-prestige__viewed').length == 0) {
                html.find('.online-prestige__img').append('<div class="online-prestige__viewed">' + Lampa.Template.get('icon_viewed', {}, true) + '</div>');
              }
            }
            choice = _this8.getChoice();
            if (!serial) {
              choice.movie_view = hash_behold;
            } else {
              choice.episodes_view[element.season] = episode_num;
            }
            _this8.saveChoice(choice);
            var voice_name_text = choice.voice_name || element.voice_name || element.title;
            if (voice_name_text.length > 30) voice_name_text = voice_name_text.slice(0, 30) + '...';
            _this8.watched({
              balanser: balanser,
              balanser_name: Lampa.Utils.capitalizeFirstLetter(sources[balanser] ? sources[balanser].name.split(' ')[0] : balanser),
              voice_id: choice.voice_id,
              voice_name: voice_name_text,
              episode: element.episode,
              season: element.season
            });
          };
          element.unmark = function() {
            viewed = Lampa.Storage.cache('online_view', 5000, []);
            if (viewed.indexOf(hash_behold) !== -1) {
              Lampa.Arrays.remove(viewed, hash_behold);
              Lampa.Storage.set('online_view', viewed);
              Lampa.Storage.remove('online_view', hash_behold);
              html.find('.online-prestige__viewed').remove();
            }
          };
          element.timeclear = function() {
            element.timeline.percent = 0;
            element.timeline.time = 0;
            element.timeline.duration = 0;
            Lampa.Timeline.update(element.timeline);
          };
          html.on('hover:enter', function() {
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            if (params.onEnter) params.onEnter(element, html, data);
          }).on('hover:focus', function(e) {
            last = e.target;
            if (params.onFocus) params.onFocus(element, html, data);
            scroll.update($(e.target), true);
          });
          if (params.onRender) params.onRender(element, html, data);
          _this8.contextMenu({
            html: html,
            element: element,
            onFile: function onFile(call) {
              if (params.onContextMenu) params.onContextMenu(element, html, data, call);
            },
            onClearAllMark: function onClearAllMark() {
              items.forEach(function(elem) {
                elem.unmark();
              });
            },
            onClearAllTime: function onClearAllTime() {
              items.forEach(function(elem) {
                elem.timeclear();
              });
            }
          });
          scroll.append(html);
        });
        if (serial && episodes.length > items.length && !params.similars) {
          var left = episodes.slice(items.length);
          left.forEach(function(episode) {
            var info = [];
            if (episode.vote_average) info.push(Lampa.Template.get('lampac_prestige_rate', {
              rate: parseFloat(episode.vote_average + '').toFixed(1)
            }, true));
            if (episode.air_date) info.push(Lampa.Utils.parseTime(episode.air_date).full);
            var air = new Date((episode.air_date + '').replace(/-/g, '/'));
            var now = Date.now();
            var day = Math.round((air.getTime() - now) / (24 * 60 * 60 * 1000));
            var txt = Lampa.Lang.translate('full_episode_days_left') + ': ' + day;
            var html = Lampa.Template.get('lampac_prestige_full', {
              time: Lampa.Utils.secondsToTime((episode ? episode.runtime : object.movie.runtime) * 60, true),
              info: info.length ? info.map(function(i) {
                return '<span>' + i + '</span>';
              }).join('<span class="online-prestige-split">●</span>') : '',
              title: episode.name,
              quality: day > 0 ? txt : ''
            });
            var loader = html.find('.online-prestige__loader');
            var image = html.find('.online-prestige__img');
            var season = items[0] ? items[0].season : 1;
            html.find('.online-prestige__timeline').append(Lampa.Timeline.render(Lampa.Timeline.view(Lampa.Utils.hash([season, episode.episode_number, object.movie.original_title].join('')))));
            var img = html.find('img')[0];
            if (episode.still_path) {
              img.onerror = function() {
                img.src = './img/img_broken.svg';
              };
              img.onload = function() {
                image.addClass('online-prestige__img--loaded');
                loader.remove();
                image.append('<div class="online-prestige__episode-number">' + formatEpisodeNumber(episode.episode_number) + '</div>');
              };
              img.src = Lampa.TMDB.image('t/p/w300' + episode.still_path);
              images.push(img);
            } else {
              loader.remove();
              image.append('<div class="online-prestige__episode-number">' + formatEpisodeNumber(episode.episode_number) + '</div>');
            }
            html.on('hover:focus', function(e) {
              last = e.target;
              scroll.update($(e.target), true);
            });
            html.css('opacity', '0.5');
            scroll.append(html);
          });
        }
        if (scroll_to_element) {
          last = scroll_to_element[0];
        } else if (scroll_to_mark) {
          last = scroll_to_mark[0];
        }
        Lampa.Controller.enable('content');
      });
    };
    /**
     * Меню
     */
    this.contextMenu = function(params) {
      params.html.on('hover:long', function() {
        function show(extra) {
          var enabled = Lampa.Controller.enabled().name;
          var menu = [];
          if (Lampa.Platform.is('webos')) {
            menu.push({
              title: Lampa.Lang.translate('player_lauch') + ' - Webos',
              player: 'webos'
            });
          }
          if (Lampa.Platform.is('android')) {
            menu.push({
              title: Lampa.Lang.translate('player_lauch') + ' - Android',
              player: 'android'
            });
          }
          menu.push({
            title: Lampa.Lang.translate('player_lauch') + ' - Lampa',
            player: 'lampa'
          });
          menu.push({
            title: Lampa.Lang.translate('lampac_video'),
            separator: true
          });
          if (extra && extra.quality) {
            menu.push({
              title: Lampa.Lang.translate('lampac_quality') + ': ' + qualityText(getPreferredQuality()),
              qualitySelect: true,
              separator: true
            });
          }

          menu.push({
            title: Lampa.Lang.translate('torrent_parser_label_title'),
            mark: true
          });
          menu.push({
            title: Lampa.Lang.translate('torrent_parser_label_cancel_title'),
            unmark: true
          });
          menu.push({
            title: Lampa.Lang.translate('time_reset'),
            timeclear: true
          });
          if (extra) {
            menu.push({
              title: Lampa.Lang.translate('copy_link'),
              copylink: true
            });
          }
          if (window.lampac_online_context_menu)
            window.lampac_online_context_menu.push(menu, extra, params);
          menu.push({
            title: Lampa.Lang.translate('more'),
            separator: true
          });
          if (Lampa.Account.logged() && params.element && typeof params.element.season !== 'undefined' && params.element.translate_voice) {
            menu.push({
              title: Lampa.Lang.translate('lampac_voice_subscribe'),
              subscribe: true
            });
          }
          menu.push({
            title: Lampa.Lang.translate('lampac_clear_all_marks'),
            clearallmark: true
          });
          menu.push({
            title: Lampa.Lang.translate('lampac_clear_all_timecodes'),
            timeclearall: true
          });
          Lampa.Select.show({
            title: Lampa.Lang.translate('title_action'),
            items: menu,
            onBack: function onBack() {
              Lampa.Controller.toggle(enabled);
            },
            onSelect: function onSelect(a) {
              if (a.mark) params.element.mark();
              if (a.unmark) params.element.unmark();
              if (a.timeclear) params.element.timeclear();
              if (a.clearallmark) params.onClearAllMark();
              if (a.timeclearall) params.onClearAllTime();
              if (window.lampac_online_context_menu)
                window.lampac_online_context_menu.onSelect(a, params);
              Lampa.Controller.toggle(enabled);
              if (a.player) {
                Lampa.Player.runas(a.player);
                params.html.trigger('hover:enter');
              }
              if (a.copylink) {
                if (extra.quality) {
                  var qual = [];
                  for (var i in extra.quality) {
                    qual.push({
                      title: i,
                      file: extra.quality[i]
                    });
                  }
                  Lampa.Select.show({
                    title: Lampa.Lang.translate('settings_server_links'),
                    items: qual,
                    onBack: function onBack() {
                      Lampa.Controller.toggle(enabled);
                    },
                    onSelect: function onSelect(b) {
                      Lampa.Utils.copyTextToClipboard(b.file, function() {
                        Lampa.Noty.show(Lampa.Lang.translate('copy_secuses'));
                      }, function() {
                        Lampa.Noty.show(Lampa.Lang.translate('copy_error'));
                      });
                    }
                  });
                } else {
                  Lampa.Utils.copyTextToClipboard(extra.file, function() {
                    Lampa.Noty.show(Lampa.Lang.translate('copy_secuses'));
                  }, function() {
                    Lampa.Noty.show(Lampa.Lang.translate('copy_error'));
                  });
                }
              }
              if (a.qualitySelect) {
                var qualityItems = [{
                  title: 'Авто',
                  quality: 0,
                  selected: getPreferredQuality() === 0
                }];

                BWA_QUALITY_LIST.forEach(function(q) {
                  qualityItems.push({
                    title: q + 'p',
                    quality: q,
                    selected: getPreferredQuality() === q
                  });
                });

                Lampa.Select.show({
                  title: Lampa.Lang.translate('lampac_quality_default'),
                  items: qualityItems,
                  onBack: function() {
                    Lampa.Controller.toggle(enabled);
                  },
                  onSelect: function(b) {
                    setPreferredQuality(b.quality);
                    Lampa.Noty.show('Качество: ' + qualityText(b.quality));
                    Lampa.Controller.toggle(enabled);
                  }
                });
              }

              if (a.subscribe) {
                Lampa.Account.subscribeToTranslation({
                  card: object.movie,
                  season: params.element.season,
                  episode: params.element.translate_episode_end,
                  voice: params.element.translate_voice
                }, function() {
                  Lampa.Noty.show(Lampa.Lang.translate('lampac_voice_success'));
                }, function() {
                  Lampa.Noty.show(Lampa.Lang.translate('lampac_voice_error'));
                });
              }
            }
          });
        }
        params.onFile(show);
      }).on('hover:focus', function() {
        if (Lampa.Helper) Lampa.Helper.show('online_file', Lampa.Lang.translate('helper_online_file'), params.html);
      });
    };
    /**
     * Показать пустой результат
     */
    this.empty = function() {
      var html = Lampa.Template.get('lampac_does_not_answer', {});
      html.find('.online-empty__buttons').remove();
      html.find('.online-empty__title').text(Lampa.Lang.translate('empty_title_two'));
      html.find('.online-empty__time').text(Lampa.Lang.translate('empty_text'));
      scroll.clear();
      scroll.append(html);
      this.createBwaToolbar();
      this.updateBwaToolbar('Нет результатов');
      this.loading(false);
    };
    this.noConnectToServer = function(er) {
      var html = Lampa.Template.get('lampac_does_not_answer', {});
      html.find('.online-empty__buttons').remove();
      html.find('.online-empty__title').text(Lampa.Lang.translate('title_error'));
      html.find('.online-empty__time').text(er && er.accsdb ? er.msg : Lampa.Lang.translate('lampac_does_not_answer_text').replace('{balanser}', balanser[balanser].name));
      scroll.clear();
      scroll.append(html);
      this.createBwaToolbar();
      this.updateBwaToolbar('Не удалось подключиться');
      this.loading(false);
    };
    this.doesNotAnswer = function(er) {
      var _this9 = this;
      this.reset();
      var html = Lampa.Template.get('lampac_does_not_answer', {
        balanser: balanser
      });
      if(er && er.accsdb) html.find('.online-empty__title').html(er.msg);
	  
      var tic = er && er.accsdb ? 10 : 5;
      html.find('.cancel').on('hover:enter', function() {
        clearInterval(balanser_timer);
      });
      html.find('.change').on('hover:enter', function() {
        clearInterval(balanser_timer);
        filter.render().find('.filter--sort').trigger('hover:enter');
      });
      scroll.clear();
      scroll.append(html);
      this.createBwaToolbar();
      this.updateBwaToolbar('Источник не ответил');
      this.loading(false);
      balanser_timer = setInterval(function() {
        tic--;
        html.find('.timeout').text(tic);
        if (tic == 0) {
          clearInterval(balanser_timer);
          var keys = Lampa.Arrays.getKeys(sources);
          var indx = keys.indexOf(balanser);
          var next = keys[indx + 1];
          if (!next) next = keys[0];
          balanser = next;
          if (Lampa.Activity.active().activity == _this9.activity) _this9.changeBalanser(balanser);
        }
      }, 1000);
    };
    this.getLastEpisode = function(items) {
      var last_episode = 0;
      items.forEach(function(e) {
        if (typeof e.episode !== 'undefined') last_episode = Math.max(last_episode, parseInt(e.episode));
      });
      return last_episode;
    };
    /**
     * Начать навигацию по файлам
     */
    this.start = function() {
      if (Lampa.Activity.active().activity !== this.activity) return;
      if (!initialized) {
        initialized = true;
        this.initialize();
      }
      Lampa.Background.immediately(Lampa.Utils.cardImgBackgroundBlur(object.movie));
      Lampa.Controller.add('content', {
        toggle: function toggle() {
          Lampa.Controller.collectionSet(scroll.render(), files.render());
          Lampa.Controller.collectionFocus(last || false, scroll.render());
        },
        gone: function gone() {
          clearTimeout(balanser_timer);
        },
        up: function up() {
          if (Navigator.canmove('up')) {
            Navigator.move('up');
          } else Lampa.Controller.toggle('head');
        },
        down: function down() {
          Navigator.move('down');
        },
        right: function right() {
          if (Navigator.canmove('right')) Navigator.move('right');
          else filter.show(Lampa.Lang.translate('title_filter'), 'filter');
        },
        left: function left() {
          if (Navigator.canmove('left')) Navigator.move('left');
          else Lampa.Controller.toggle('menu');
        },
        back: this.back.bind(this)
      });
      Lampa.Controller.toggle('content');
    };
    this.render = function() {
      return files.render();
    };
    this.back = function() {
      Lampa.Activity.backward();
    };
    this.pause = function() {};
    this.stop = function() {};
    this.destroy = function() {
      network.clear();
      this.clearImages();
      files.destroy();
      scroll.destroy();
      clearInterval(balanser_timer);
      clearTimeout(life_wait_timer);
    };
  }
  
  function addSourceSearch(spiderName, spiderUri) {
    var network = new Lampa.Reguest();

    var source = {
      title: spiderName,
      search: function(params, oncomplite) {
        function searchComplite(links) {
          var keys = Lampa.Arrays.getKeys(links);

          if (keys.length) {
            var status = new Lampa.Status(keys.length);

            status.onComplite = function(result) {
              var rows = [];

              keys.forEach(function(name) {
                var line = result[name];

                if (line && line.data && line.type == 'similar') {
                  var cards = line.data.map(function(item) {
                    item.title = Lampa.Utils.capitalizeFirstLetter(item.title);
                    item.release_date = item.year || '0000';
                    item.balanser = spiderUri;
                    if (item.img !== undefined) {
                      if (item.img.charAt(0) === '/')
                        item.img = Defined.localhost + item.img.substring(1);
                      if (item.img.indexOf('/proxyimg') !== -1)
                        item.img = account(item.img);
                    }

                    return item;
                  })

                  rows.push({
                    title: name,
                    results: cards
                  })
                }
              })

              oncomplite(rows);
            }

            keys.forEach(function(name) {
              network.silent(account(links[name]), function(data) {
                status.append(name, data);
              }, function() {
                status.error();
              }, false, {
                  headers: addHeaders()
		  })
            })
          } else {
            oncomplite([]);
          }
        }

        network.silent(account(Defined.localhost + 'lite/' + spiderUri + '?title=' + params.query), function(json) {
          if (json.rch) {
            rchRun(json, function() {
              network.silent(account(Defined.localhost + 'lite/' + spiderUri + '?title=' + params.query), function(links) {
                searchComplite(links);
              }, function() {
                oncomplite([]);
              }, false, {
                  headers: addHeaders()
		  });
            });
          } else {
            searchComplite(json);
          }
        }, function() {
          oncomplite([]);
        }, false, {
            headers: addHeaders()
		  });
      },
      onCancel: function() {
        network.clear()
      },
      params: {
        lazy: true,
        align_left: true,
        card_events: {
          onMenu: function() {}
        }
      },
      onMore: function(params, close) {
        close();
      },
      onSelect: function(params, close) {
        close();

        Lampa.Activity.push({
          url: params.element.url,
          title: 'Lampac - ' + params.element.title,
          component: 'bwarch',
          movie: params.element,
          page: 1,
          search: params.element.title,
          clarification: true,
          balanser: params.element.balanser,
          noinfo: true
        });
      }
    }

    Lampa.Search.addSource(source)
  }

  function openBwa(object) {
    try {
      resetTemplates();
      Lampa.Component.add('bwarch', component);

      var isSerial = !!(object && (object.number_of_seasons || object.first_air_date || object.media_type === 'tv'));
      var idSource = isSerial ? (object.original_name || object.original_title || object.title) : (object.original_title || object.original_name || object.title);
      var id = Lampa.Utils.hash(idSource || '');
      var all = Lampa.Storage.get('clarification_search', '{}');
      var savedSearch = all && all[id] ? all[id] : '';

      Lampa.Activity.push({
        url: '',
        title: Lampa.Lang.translate('title_online'),
        component: 'bwarch',
        search: savedSearch || object.title || object.original_title || '',
        search_one: object.title || '',
        search_two: object.original_title || '',
        movie: object,
        page: 1,
        clarification: !!savedSearch
      });
    } catch (err) {
      console.log('BWARC', 'open error', err);
      if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show('BwaRC: не удалось открыть онлайн');
    }
  }

  function addBwaFullButton(e) {
    try {
      if (!e || !e.data || !e.data.movie) return;
      var root = e.object && e.object.activity && e.object.activity.render ? e.object.activity.render() : null;
      if (!root || !root.length) return;

      if (root.find('.view--bwarc').length) return;

      var container = root.find('.full-start-new__buttons');
      if (!container.length) container = root.find('.full-start__buttons');

      var anchor = root.find('.view--torrent');
      if (!container.length && anchor.length) container = anchor.parent();
      if (!container.length && anchor.length) container = anchor;
      if (!container.length) return;

      var button = $("<div class=\"full-start__button selector view--bwarc\" data-subtitle=\"BwaRC\">" +
        "<svg class=\"button__icon\" width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">" +
        "<path d=\"M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z\" fill=\"currentColor\" opacity=\".2\"/>" +
        "<path d=\"M9 8.5v7l6-3.5z\" fill=\"currentColor\"/>" +
        "<path d=\"M6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"/>" +
        "</svg><span>Онлайн</span></div>");

      button.on('hover:enter', function() {
        openBwa(e.data.movie);
      });
      button.on('click', function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        openBwa(e.data.movie);
      });

      if (anchor.length) anchor.after(button);
      else container.append(button);
    } catch (err) {
      console.log('BWARC', 'button error', err);
    }
  }

  function startPlugin() {
    window.bwarch_plugin = true;
    var manifst = {
      type: 'video',
      version: '2.2.1',
      name: 'BwaRC',
      description: 'BWA online: удобный интерфейс источников, озвучок и качества, сезоны и серии, 1080p по умолчанию',
      component: 'bwarch',
      onContextMenu: function onContextMenu(object) {
        return {
          name: Lampa.Lang.translate('lampac_watch'),
          description: ''
        };
      },
      onContextLauch: function onContextLauch(object) {
        openBwa(object);
      }
    };
	
	
    Lampa.Manifest.plugins = manifst;
    Lampa.Lang.add({
      lampac_watch: { //
        ru: 'Смотреть онлайн',
        en: 'Watch online',
        uk: 'Дивитися онлайн',
        zh: '在线观看'
      },
      lampac_video: { //
        ru: 'Видео',
        en: 'Video',
        uk: 'Відео',
        zh: '视频'
      },
      lampac_no_watch_history: {
        ru: 'Нет истории просмотра',
        en: 'No browsing history',
        ua: 'Немає історії перегляду',
        zh: '没有浏览历史'
      },
      lampac_nolink: {
        ru: 'Не удалось извлечь ссылку',
        uk: 'Неможливо отримати посилання',
        en: 'Failed to fetch link',
        zh: '获取链接失败'
      },
      lampac_quality: {
        ru: 'Качество',
        uk: 'Якість',
        en: 'Quality',
        zh: '画质'
      },
      lampac_quality_default: {
        ru: 'Качество по умолчанию',
        uk: 'Якість за замовчуванням',
        en: 'Default quality',
        zh: '默认画质'
      },
      lampac_auto_sources: {
        ru: 'Авто • все источники',
        uk: 'Авто • усі джерела',
        en: 'Auto • all sources',
        zh: '自动 • 所有来源'
      },
      lampac_balanser: { //
        ru: 'Источник',
        uk: 'Джерело',
        en: 'Source',
        zh: '来源'
      },
      helper_online_file: { //
        ru: 'Удерживайте клавишу "ОК" для вызова контекстного меню',
        uk: 'Утримуйте клавішу "ОК" для виклику контекстного меню',
        en: 'Hold the "OK" key to bring up the context menu',
        zh: '按住“确定”键调出上下文菜单'
      },
      title_online: { //
        ru: 'Онлайн',
        uk: 'Онлайн',
        en: 'Online',
        zh: '在线的'
      },
      lampac_voice_subscribe: { //
        ru: 'Подписаться на перевод',
        uk: 'Підписатися на переклад',
        en: 'Subscribe to translation',
        zh: '订阅翻译'
      },
      lampac_voice_success: { //
        ru: 'Вы успешно подписались',
        uk: 'Ви успішно підписалися',
        en: 'You have successfully subscribed',
        zh: '您已成功订阅'
      },
      lampac_voice_error: { //
        ru: 'Возникла ошибка',
        uk: 'Виникла помилка',
        en: 'An error has occurred',
        zh: '发生了错误'
      },
      lampac_clear_all_marks: { //
        ru: 'Очистить все метки',
        uk: 'Очистити всі мітки',
        en: 'Clear all labels',
        zh: '清除所有标签'
      },
      lampac_clear_all_timecodes: { //
        ru: 'Очистить все тайм-коды',
        uk: 'Очистити всі тайм-коди',
        en: 'Clear all timecodes',
        zh: '清除所有时间代码'
      },
      lampac_change_balanser: { //
        ru: 'Изменить балансер',
        uk: 'Змінити балансер',
        en: 'Change balancer',
        zh: '更改平衡器'
      },
      lampac_balanser_dont_work: { //
        ru: 'Поиск не дал результатов',
        uk: 'Пошук не дав результатів',
        en: 'Search did not return any results',
        zh: '搜索 未返回任何结果'
      },
      lampac_balanser_timeout: { //
        ru: 'Источник будет переключен автоматически через <span class="timeout">10</span> секунд.',
        uk: 'Джерело буде автоматично переключено через <span class="timeout">10</span> секунд.',
        en: 'The source will be switched automatically after <span class="timeout">10</span> seconds.',
        zh: '平衡器将在<span class="timeout">10</span>秒内自动切换。'
      },
      lampac_does_not_answer_text: {
        ru: 'Поиск не дал результатов',
        uk: 'Пошук не дав результатів',
        en: 'Search did not return any results',
        zh: '搜索 未返回任何结果'
      }
    });
    Lampa.Template.add('lampac_css', "\n        <style>\n        @charset 'UTF-8';.online-prestige{position:relative;-webkit-border-radius:.3em;border-radius:.3em;background-color:rgba(0,0,0,0.3);display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex}.online-prestige__body{padding:1.2em;line-height:1.3;-webkit-box-flex:1;-webkit-flex-grow:1;-moz-box-flex:1;-ms-flex-positive:1;flex-grow:1;position:relative}@media screen and (max-width:480px){.online-prestige__body{padding:.8em 1.2em}}.online-prestige__img{position:relative;width:13em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0;min-height:8.2em}.online-prestige__img>img{position:absolute;top:0;left:0;width:100%;height:100%;-o-object-fit:cover;object-fit:cover;-webkit-border-radius:.3em;border-radius:.3em;opacity:0;-webkit-transition:opacity .3s;-o-transition:opacity .3s;-moz-transition:opacity .3s;transition:opacity .3s}.online-prestige__img--loaded>img{opacity:1}@media screen and (max-width:480px){.online-prestige__img{width:7em;min-height:6em}}.online-prestige__folder{padding:1em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0}.online-prestige__folder>svg{width:4.4em !important;height:4.4em !important}.online-prestige__viewed{position:absolute;top:1em;left:1em;background:rgba(0,0,0,0.45);-webkit-border-radius:100%;border-radius:100%;padding:.25em;font-size:.76em}.online-prestige__viewed>svg{width:1.5em !important;height:1.5em !important}.online-prestige__episode-number{position:absolute;top:0;left:0;right:0;bottom:0;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;-moz-box-pack:center;-ms-flex-pack:center;justify-content:center;font-size:2em}.online-prestige__loader{position:absolute;top:50%;left:50%;width:2em;height:2em;margin-left:-1em;margin-top:-1em;background:url(./img/loader.svg) no-repeat center center;-webkit-background-size:contain;-o-background-size:contain;background-size:contain}.online-prestige__head,.online-prestige__footer{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-pack:justify;-webkit-justify-content:space-between;-moz-box-pack:justify;-ms-flex-pack:justify;justify-content:space-between;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige__timeline{margin:.8em 0}.online-prestige__timeline>.time-line{display:block !important}.online-prestige__title{font-size:1.7em;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;line-clamp:1;-webkit-box-orient:vertical}@media screen and (max-width:480px){.online-prestige__title{font-size:1.4em}}.online-prestige__time{padding-left:2em}.online-prestige__info{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige__info>*{overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;line-clamp:1;-webkit-box-orient:vertical}.online-prestige__quality{padding-left:1em;white-space:nowrap}.online-prestige__scan-file{position:absolute;bottom:0;left:0;right:0}.online-prestige__scan-file .broadcast__scan{margin:0}.online-prestige .online-prestige-split{font-size:.8em;margin:0 1em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0}.online-prestige.focus::after{content:'';position:absolute;top:-0.6em;left:-0.6em;right:-0.6em;bottom:-0.6em;-webkit-border-radius:.7em;border-radius:.7em;border:solid .3em #fff;z-index:-1;pointer-events:none}.online-prestige+.online-prestige{margin-top:1.5em}.online-prestige--folder .online-prestige__footer{margin-top:.8em}.online-prestige-watched{padding:1em}.online-prestige-watched__icon>svg{width:1.5em;height:1.5em}.online-prestige-watched__body{padding-left:1em;padding-top:.1em;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-flex-wrap:wrap;-ms-flex-wrap:wrap;flex-wrap:wrap}.online-prestige-watched__body>span+span::before{content:' ● ';vertical-align:top;display:inline-block;margin:0 .5em}.online-prestige-rate{display:-webkit-inline-box;display:-webkit-inline-flex;display:-moz-inline-box;display:-ms-inline-flexbox;display:inline-flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige-rate>svg{width:1.3em !important;height:1.3em !important}.online-prestige-rate>span{font-weight:600;font-size:1.1em;padding-left:.7em}.online-empty{line-height:1.4}.online-empty__title{font-size:1.8em;margin-bottom:.3em}.online-empty__time{font-size:1.2em;font-weight:300;margin-bottom:1.6em}.online-empty__buttons{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex}.online-empty__buttons>*+*{margin-left:1em}.online-empty__button{background:rgba(0,0,0,0.3);font-size:1.2em;padding:.5em 1.2em;-webkit-border-radius:.2em;border-radius:.2em;margin-bottom:2.4em}.online-empty__button.focus{background:#fff;color:black}.online-empty__templates .online-empty-template:nth-child(2){opacity:.5}.online-empty__templates .online-empty-template:nth-child(3){opacity:.2}.online-empty-template{background-color:rgba(255,255,255,0.3);padding:1em;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center;-webkit-border-radius:.3em;border-radius:.3em}.online-empty-template>*{background:rgba(0,0,0,0.3);-webkit-border-radius:.3em;border-radius:.3em}.online-empty-template__ico{width:4em;height:4em;margin-right:2.4em}.online-empty-template__body{height:1.7em;width:70%}.online-empty-template+.online-empty-template{margin-top:1em}\n        .online-prestige__quality{font-weight:600;opacity:.95;max-width:42%;overflow:hidden;text-overflow:ellipsis}.online-prestige__body{min-width:0}.online-prestige__info{min-width:0}.online-prestige__info>*{min-width:0}@media screen and (max-width:900px){.online-prestige__quality{max-width:38%;font-size:.92em}}@media screen and (max-width:480px){.online-prestige{min-height:6em}.online-prestige__body{padding:.75em .9em}.online-prestige__title{font-size:1.15em}.online-prestige__info{font-size:.88em}.online-prestige__quality{font-size:.84em;max-width:45%}.online-prestige__timeline{margin:.45em 0}}\n.bwa-ui{margin:0 0 1.1em;padding:1em 1.1em;background:linear-gradient(135deg,rgba(255,255,255,.10),rgba(255,255,255,.045));border:1px solid rgba(255,255,255,.10);border-radius:.65em;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.bwa-ui__top{display:flex;align-items:center;justify-content:space-between;gap:1em;margin-bottom:.8em}.bwa-ui__identity{display:flex;align-items:center;gap:.75em;min-width:0}.bwa-ui__logo{width:2.25em;height:2.25em;border-radius:.6em;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.11);font-size:1.05em;flex-shrink:0}.bwa-ui__titles{min-width:0}.bwa-ui__title{font-size:1.15em;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bwa-ui__status{font-size:.82em;opacity:.60;margin-top:.15em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bwa-ui__count{font-size:.82em;opacity:.65;white-space:nowrap}.bwa-ui__controls{display:flex;gap:.55em;flex-wrap:wrap}.bwa-ui__button{display:flex;align-items:center;gap:.45em;min-height:2.7em;padding:.55em .8em;background:rgba(0,0,0,.20);border:1px solid rgba(255,255,255,.08);border-radius:.45em;max-width:100%;transition:background .15s,transform .15s}.bwa-ui__button.focus{background:#fff;color:#111;transform:translateY(-1px)}.bwa-ui__icon{opacity:.8;font-size:.82em;min-width:1.5em;text-align:center}.bwa-ui__label{opacity:.65}.bwa-ui__button strong{font-weight:600;max-width:20em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bwa-ui__hint{font-size:.78em;opacity:.42;margin-top:.7em}.bwa-ui__reset-voice{color:#ffb8b8}.bwa-ui__reset-voice.hide{display:none}.bwa-card__tags{display:flex;align-items:center;gap:.45em;flex-wrap:wrap;margin:.65em 0 .1em;min-height:0}.bwa-card__tag{display:inline-flex;align-items:center;padding:.25em .55em;background:rgba(255,255,255,.10);border-radius:.35em;font-size:.78em;line-height:1.2;white-space:nowrap;max-width:17em;overflow:hidden;text-overflow:ellipsis}.bwa-card__tag--quality{background:rgba(255,255,255,.18);font-weight:700}.bwa-card__tag--fallback{background:rgba(255,185,80,.18)}.bwa-card__tag--voice{background:rgba(255,255,255,.08)}.bwa-card__tag--source{background:rgba(255,255,255,.065);opacity:.76}.bwa-card__tag--muted{opacity:.5}@media screen and (max-width:700px){.bwa-ui{padding:.75em}.bwa-ui__label{display:none}.bwa-ui__button{padding:.55em .65em}.bwa-ui__button strong{max-width:12em}.bwa-card__tag{font-size:.72em;max-width:12em}}@media screen and (max-width:480px){.bwa-ui{margin-bottom:.75em}.bwa-ui__top{margin-bottom:.6em}.bwa-ui__logo{width:2em;height:2em}.bwa-ui__title{font-size:1em}.bwa-ui__status{font-size:.72em}.bwa-ui__hint{display:none}.bwa-ui__button{min-height:2.35em}.bwa-card__tags{gap:.3em;margin-top:.45em}.bwa-card__tag{padding:.22em .45em}.bwa-card__tag--source,.bwa-card__tag--muted{display:none}}\n        .view--bwarc{border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.055);}.view--bwarc.focus{background:#fff;color:#111;border-color:#fff}.view--bwarc .button__icon{margin-right:.35em}.view--bwarc span{white-space:nowrap}.bwa-ui__season.hide{display:none}.bwa-season-header{margin:0 0 .8em;padding:.75em 1em;border-radius:.5em;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between;gap:1em}.bwa-season-header__main{font-size:1.25em;font-weight:600}.bwa-season-header__meta{font-size:.84em;opacity:.55;text-align:right}.bwa-card__tag--episode{font-weight:700;background:rgba(255,255,255,.16)}.bwa-card__tag--voice-count,.bwa-card__tag--source-count{background:rgba(255,255,255,.06)}.bwa-ui__count{max-width:22em;overflow:hidden;text-overflow:ellipsis}@media screen and (max-width:700px){.bwa-season-header{align-items:flex-start;flex-direction:column;gap:.2em}.bwa-season-header__meta{text-align:left}.bwa-ui__count{display:none}}\n</style>\n    ");
    $('body').append(Lampa.Template.get('lampac_css', {}, true));

    function resetTemplates() {
      Lampa.Template.add('lampac_prestige_full', "<div class=\"online-prestige online-prestige--full selector\">\n            <div class=\"online-prestige__img\">\n                <img alt=\"\">\n                <div class=\"online-prestige__loader\"></div>\n            </div>\n            <div class=\"online-prestige__body\">\n                <div class=\"online-prestige__head\">\n                    <div class=\"online-prestige__title\">{title}</div>\n                    <div class=\"online-prestige__time\">{time}</div>\n                </div>\n                <div class=\"bwa-card__tags\"></div>\n\n                <div class=\"online-prestige__timeline\"></div>\n\n                <div class=\"online-prestige__footer\">\n                    <div class=\"online-prestige__info\">{info}</div>\n                    <div class=\"online-prestige__quality\">{quality}</div>\n                </div>\n            </div>\n        </div>");
      Lampa.Template.add('lampac_content_loading', "<div class=\"online-empty\">\n            <div class=\"broadcast__scan\"><div></div></div>\n\t\t\t\n            <div class=\"online-empty__templates\">\n                <div class=\"online-empty-template selector\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n                <div class=\"online-empty-template\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n                <div class=\"online-empty-template\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n            </div>\n        </div>");
      Lampa.Template.add('lampac_does_not_answer', "<div class=\"online-empty\">\n            <div class=\"online-empty__title\">\n                #{lampac_balanser_dont_work}\n            </div>\n            <div class=\"online-empty__time\">\n                #{lampac_balanser_timeout}\n            </div>\n            <div class=\"online-empty__buttons\">\n                <div class=\"online-empty__button selector cancel\">#{cancel}</div>\n                <div class=\"online-empty__button selector change\">#{lampac_change_balanser}</div>\n            </div>\n            <div class=\"online-empty__templates\">\n                <div class=\"online-empty-template\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n                <div class=\"online-empty-template\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n                <div class=\"online-empty-template\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n            </div>\n        </div>");
      Lampa.Template.add('lampac_prestige_rate', "<div class=\"online-prestige-rate\">\n            <svg width=\"17\" height=\"16\" viewBox=\"0 0 17 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                <path d=\"M8.39409 0.192139L10.99 5.30994L16.7882 6.20387L12.5475 10.4277L13.5819 15.9311L8.39409 13.2425L3.20626 15.9311L4.24065 10.4277L0 6.20387L5.79819 5.30994L8.39409 0.192139Z\" fill=\"#fff\"></path>\n            </svg>\n            <span>{rate}</span>\n        </div>");
      Lampa.Template.add('lampac_prestige_folder', "<div class=\"online-prestige online-prestige--folder selector\">\n            <div class=\"online-prestige__folder\">\n                <svg viewBox=\"0 0 128 112\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <rect y=\"20\" width=\"128\" height=\"92\" rx=\"13\" fill=\"white\"></rect>\n                    <path d=\"M29.9963 8H98.0037C96.0446 3.3021 91.4079 0 86 0H42C36.5921 0 31.9555 3.3021 29.9963 8Z\" fill=\"white\" fill-opacity=\"0.23\"></path>\n                    <rect x=\"11\" y=\"8\" width=\"106\" height=\"76\" rx=\"13\" fill=\"white\" fill-opacity=\"0.51\"></rect>\n                </svg>\n            </div>\n            <div class=\"online-prestige__body\">\n                <div class=\"online-prestige__head\">\n                    <div class=\"online-prestige__title\">{title}</div>\n                    <div class=\"online-prestige__time\">{time}</div>\n                </div>\n\n                <div class=\"online-prestige__footer\">\n                    <div class=\"online-prestige__info\">{info}</div>\n                </div>\n            </div>\n        </div>");
      Lampa.Template.add('lampac_prestige_watched', "<div class=\"online-prestige online-prestige-watched selector\">\n            <div class=\"online-prestige-watched__icon\">\n                <svg width=\"21\" height=\"21\" viewBox=\"0 0 21 21\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <circle cx=\"10.5\" cy=\"10.5\" r=\"9\" stroke=\"currentColor\" stroke-width=\"3\"/>\n                    <path d=\"M14.8477 10.5628L8.20312 14.399L8.20313 6.72656L14.8477 10.5628Z\" fill=\"currentColor\"/>\n                </svg>\n            </div>\n            <div class=\"online-prestige-watched__body\">\n                \n            </div>\n        </div>");
    }
    // Штатную кнопку «Смотреть» не перехватываем. В некоторых сборках Lampa
    // она ведёт на трейлер/YouTube, поэтому BwaRC имеет свою отдельную кнопку «Онлайн».
    if (Lampa.Listener && Lampa.Listener.follow) {
      Lampa.Listener.follow('full', function(e) {
        if (e.type === 'complite') {
          setTimeout(function() { addBwaFullButton(e); }, 0);
        }
      });

      // Если карточка уже открыта к моменту загрузки плагина.
      try {
        if (Lampa.Activity.active && Lampa.Activity.active().component === 'full') {
          var active = Lampa.Activity.active();
          addBwaFullButton({
            object: { activity: active.activity },
            data: { movie: active.card }
          });
        }
      } catch (e) {}
    }

    function registerBwaSettings() {
      if (!Lampa.SettingsApi || !Lampa.SettingsApi.addComponent || !Lampa.SettingsApi.addParam) return;
      try {
        Lampa.SettingsApi.addComponent({
          component: 'bwarc_quality',
          icon: '<svg></svg>',
          name: 'BwaRC'
        });
        Lampa.SettingsApi.addParam({
          component: 'bwarc_quality',
          param: {
            name: BWA_QUALITY_KEY,
            type: 'select',
            values: {
              '0': 'Авто',
              '2160': '4K (2160p)',
              '1440': '1440p',
              '1080': '1080p',
              '720': '720p',
              '576': '576p',
              '480': '480p',
              '360': '360p'
            },
            default: '1080'
          },
          field: {
            name: 'Качество по умолчанию',
            description: '1080p используется по умолчанию, если доступно; при отсутствии выбирается ближайшее качество'
          },
          onChange: function(value) { setPreferredQuality(value); }
        });
      } catch (e) {}
    }
    registerBwaSettings();

    if (Lampa.Manifest.app_digital >= 177) {
        var balansers_sync = [
            "filmix",
            "filmixtv",
            "fxapi",
            "rezka",
            "pizdatoehd",
            "getstv",
            "kinopub",
            "zetflixdb",
            "collaps",
            "hdvb",
            "kodik",
            "bamboo",
            "eneyida",
            "kinoukr",
            "uafilm",
            "uakino",
            "kinotochka",
            "remux",
            "anilibria",
            "animedia",
            "animego",
            "animevost",
            "animebesst",
            "alloha",
            "mirage",
            "phantom",
            "animelib",
            "moonanime",
            "vibix",
            "fancdn",
            "cdnvideohub",
            "vokino",
            "hydraflix",
            "videasy",
            "vidsrc",
            "movpi",
            "vidlink",
            "smashystream",
            "autoembed",
            "pidtor",
            "videoseed",
            "iptvonline",
            "veoveo",
            "kinoflix",
            "leproduction",
            "vkmovie",
            "videoseed",
            "veoveo",
            "kinogo",
            "kinobase",
            "fancdn",
            "asiage",
            "geosaitebi",
            "mikai",
            "dreamerscast"
        ];
      balansers_sync.forEach(function(name) {
        Lampa.Storage.sync('online_choice_' + name, 'object_object');
      });
      Lampa.Storage.sync('online_watched_last', 'object_object');
    }
  }
  if (!window.bwarch_plugin) startPlugin();

})();