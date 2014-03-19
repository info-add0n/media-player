/********/
var background = {};
if (navigator.userAgent.toLowerCase().indexOf('firefox') !== -1) {
  background.send = function (id, data) {
    self.port.emit(id, data);
  }
  background.receive = function (id, callback) {
    self.port.on(id, callback);
  }
  background.receive("attached", function () {
    if (window.frameElement === null) init();
  });
}
else {
  background.send = function (id, data) {
    chrome.extension.sendRequest({method: id, data: data});
  }
  background.receive = function (id, callback) {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.method == id) {
        callback(request.data);
      }
    });
  }
  init();
}
/********/
function $(id) {
  $.cache = $.cache || [];
  $.cache[id] = $.cache[id] || (window.content.document || document).getElementById(id);
  return $.cache[id];
}

// ******* This is to Support HTML5 YouTube Videos in Google Chrome *******
var iyplayer = 'function iyplayer(e) {document.body.dispatchEvent(new CustomEvent("iyplayer-event", {detail: {state: e}}));}';
location.href = 'javascript:' + iyplayer + '(' + inject + ')()';
function inject() {
  var player = document.getElementById('movie_player') || document.getElementById('movie_player-flash');
  player.addEventListener("onStateChange", "iyplayer");
  document.body.addEventListener("iplayer-send-command", function (e) {
    switch (e.detail.cmd) 
    {
    case "play":
      player.playVideo();
      break;
    case "pause":
      player.pauseVideo();
      break;
    case "stop":
      player.stopVideo();
      player.clearVideo();
      break;
    case "setVolume":
      player.setVolume(e.detail.volume);
      break;
    }
  });
}

function getVideoUrl() {
  return window.location.href;
}
function getVideoId() {
  return /watch\?v\=([^\&]*)/.exec(window.location.href || [null,null])[1];
}
function loadVideoById(id) {
  window.location.replace("https://www.youtube.com/watch?v=" + id);
}
function loadVideoByUrl(url) {
  window.location.replace(url);
}
function play() {
  document.body.dispatchEvent(new CustomEvent("iplayer-send-command", {detail: {cmd: "play"}}));
}
function pause() {
  document.body.dispatchEvent(new CustomEvent("iplayer-send-command", {detail: {cmd: "pause"}}));
}
function stop() {
  document.body.dispatchEvent(new CustomEvent("iplayer-send-command", {detail: {cmd: "stop"}}));
}
function setVolume(v) {
  document.body.dispatchEvent(new CustomEvent("iplayer-send-command", {detail: {cmd: "setVolume", volume: v}}));
}
// *******************

var player;
function youtube (callback, pointer) {
  function Player () {
    // Accessing the JavaScript functions of the embedded player'
    p = $('movie_player') || $('movie_player-flash') || {};
    p = (typeof XPCNativeWrapper != "undefined") ? XPCNativeWrapper.unwrap (p) : p;

    var extend = {
      getAvailableQualityLevels: p.getAvailableQualityLevels,
      getDuration: function () {return p.getDuration ? p.getDuration() : 0},
      getTitle: function () {
        if (!window.content.document && !document) return "no title";
        return [].reduce.call(
          (window.content.document || document).getElementsByClassName("watch-title"), 
          function (p, c) {return c.title;}, 
          "no title"
        );
      },
      getVideoUrl: function () {return p.getVideoUrl() || getVideoUrl()},
      getVideoId: function () {if (p.getVideoUrl) {return (/[?&]v=([^&]+)/.exec(p.getVideoUrl()) || [null,null])[1];} else {return getVideoId();}},
      loadVideoById: function (id) {if (p.loadVideoById) {p.loadVideoById(id);} else {loadVideoById();}},
      loadVideoByUrl:function (url) {if (p.loadVideoByUrl) {p.loadVideoByUrl(url);} else {loadVideoByUrl(url);}},
      addEventListener: function (a, b) {return p.addEventListener(a, b)},
      play: function () {if (p.playVideo) {p.playVideo();} else {play();}},
      pause: function () {if (p.pauseVideo) {p.pauseVideo();} else {pause();}},
      setVolume: function (v) {if (p.setVolume) {p.setVolume(v);} else {setVolume(v);}},
      stop: function () {
        if (p.stopVideo) {
          if (p.seekTo) p.seekTo(0);
          p.stopVideo();
          p.clearVideo();
        } else {stop();}
      },
      quality: function (val) {
        var levels = p.getAvailableQualityLevels();
        p.setPlaybackQuality(levels.indexOf(val) != -1 ? val : levels[0])
      }
    }
    return extend;
  }
  player = new Player();
  // if (player && player.getAvailableQualityLevels) {
  if (true){
    callback.call(pointer);
  }
}

function init () {
  youtube(function () {
    background.send('request-inits');
    background.send('player-details', {
      id: player.getVideoId(),
      title: player.getTitle(),
      duration: player.getDuration()
    });
    // inject new listener to unsafe window
    if (typeof unsafeWindow != "undefined") { // Firefox
      unsafeWindow.iyplayer = function (e) {
        background.send('player-state-changed', {
          state: e,
          id: player.getVideoId()
        });
      }
    }
    else {  // ******* This is Only for Chrome Browser *******
      document.body.addEventListener("iyplayer-event", function (e) {
        background.send('player-state-changed', {
          state: e.detail.state,
          id: player.getVideoId()
        });
      });
    }
  });
}

background.receive("player-play", function (videoId) {
  console.error(videoId , player.getVideoId())
  if (videoId == player.getVideoId()) {
    player.play();
  }
});
background.receive("player-pause", function (videoId) {
  if (videoId == player.getVideoId() || videoId == 'all') {
    player.pause();
  }
});
background.receive("player-stop", function () {
  player.stop();
});
background.receive("player-new-id", function (obj) {
  if (obj.id == player.getVideoId()) {
    window.location.replace("https://www.youtube.com/watch?v=" + obj.newID);
  }
});
background.receive("request-inits", function (obj) {
  player.setVolume(obj.volume * 10 + 10);
});

window.addEventListener("beforeunload", function( event ) {
  background.send('player-state-changed', {
    state: -1,
    id: player.getVideoId()
  });
});