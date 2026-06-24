/* RoadLog native bridge. */
(function(){
  try {
    if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return;
    var registerPlugin = window.Capacitor.registerPlugin;
    var BG = registerPlugin('BackgroundGeolocation');

    var watchers = {};
    var nextId = 1;

    function toPos(loc){
      return {
        coords: {
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: (loc.accuracy != null ? loc.accuracy : 0),
          altitude: (loc.altitude != null ? loc.altitude : null),
          altitudeAccuracy: null,
          heading: (loc.bearing != null ? loc.bearing : null),
          speed: (loc.speed != null ? loc.speed : null)
        },
        timestamp: (loc.time != null ? loc.time : Date.now())
      };
    }

    navigator.geolocation.watchPosition = function(success, error, options){
      var id = nextId++;
      BG.addWatcher({
        backgroundMessage: "RoadLog is recording your trip.",
        backgroundTitle: "RoadLog tracking",
        requestPermissions: true,
        stale: false,
        distanceFilter: 5
      }, function(location, err){
        if (err){ if (error) error({ code: (err.code === 'NOT_AUTHORIZED' ? 1 : 2), message: err.message || 'Location error' }); return; }
        if (location && success) success(toPos(location));
      }).then(function(wid){ watchers[id] = wid; });
      return id;
    };

    navigator.geolocation.clearWatch = function(id){
      var wid = watchers[id];
      if (wid){ BG.removeWatcher({ id: wid }); delete watchers[id]; }
    };

    navigator.geolocation.getCurrentPosition = function(success, error, options){
      var done = false;
      BG.addWatcher({ requestPermissions: true, stale: true, distanceFilter: 0 },
      function(location, err){
        if (done) return;
        if (err){ done = true; if (error) error({ code: 2, message: err.message || 'Location error' }); return; }
        if (location){ done = true; if (success) success(toPos(location)); }
      }).then(function(wid){
        var stop = function(){ try { BG.removeWatcher({ id: wid }); } catch(e){} };
        var poll = setInterval(function(){ if (done){ clearInterval(poll); stop(); } }, 300);
        setTimeout(function(){ if (!done){ done = true; clearInterval(poll); stop(); if (error) error({ code: 3, message: 'timeout' }); } }, (options && options.timeout) ? options.timeout : 12000);
      });
    };

    var Share = registerPlugin('Share');
    var Filesystem = registerPlugin('Filesystem');

    function fileToBase64(file){
      return new Promise(function(resolve, reject){
        var r = new FileReader();
        r.onload = function(){ resolve(String(r.result).split(',')[1]); };
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    }

    navigator.canShare = function(data){ return true; };

    navigator.share = async function(data){
      data = data || {};
      if (data.files && data.files.length){
        var file = data.files[0];
        var name = (file && file.name) ? file.name : 'roadlog.pdf';
        var base64 = await fileToBase64(file);
        await Filesystem.writeFile({ path: name, data: base64, directory: 'CACHE' });
        var uriRes = await Filesystem.getUri({ path: name, directory: 'CACHE' });
        await Share.share({
          title: data.title || 'RoadLog',
          text: data.text || '',
          files: [uriRes.uri]
        });
        return;
      }
      await Share.share({ title: data.title, text: data.text, url: data.url });
    };
  } catch(e){ console.warn('Native bridge skipped:', e); }
})();
