/* RoadLog native background-GPS bridge.
   The builder injects this into a COPY of index.html at build time.
   It runs ONLY inside the native app. In a normal browser it does nothing,
   so your web version keeps behaving exactly the same. */
(function(){
  try {
    if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return;
    var BG = window.Capacitor.registerPlugin('BackgroundGeolocation');
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
      BG.addWatcher({
        requestPermissions: true,
        stale: true,
        distanceFilter: 0
      }, function(location, err){
        if (done) return;
        if (err){ done = true; if (error) error({ code: 2, message: err.message || 'Location error' }); return; }
        if (location){ done = true; if (success) success(toPos(location)); }
      }).then(function(wid){
        var stop = function(){ try { BG.removeWatcher({ id: wid }); } catch(e){} };
        var poll = setInterval(function(){ if (done){ clearInterval(poll); stop(); } }, 300);
        setTimeout(function(){ if (!done){ done = true; clearInterval(poll); stop(); if (error) error({ code: 3, message: 'timeout' }); } }, (options && options.timeout) ? options.timeout : 12000);
      });
    };
  } catch(e){ console.warn('Native GPS bridge skipped:', e); }
})();
