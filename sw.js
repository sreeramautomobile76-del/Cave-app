/* CAVE service worker: lets the app open with no internet.
   Change CACHE name (v1 -> v2) whenever you upload a new index.html. */
var CACHE = "cave-cache-v1";
var CORE = ["./", "index.html"];
var FB_HOST = "www.gstatic.com";
var FB_SCRIPTS = [
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      var jobs = CORE.map(function(u){ return c.add(u).catch(function(){}); });
      FB_SCRIPTS.forEach(function(u){
        jobs.push(fetch(u, { mode: "no-cors" }).then(function(r){ return c.put(u, r); }).catch(function(){}));
      });
      return Promise.all(jobs);
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  var url = new URL(req.url);

  // Page itself: try network first (so updates arrive), fall back to saved copy when offline.
  if(req.mode === "navigate"){
    e.respondWith(
      fetch(req).then(function(r){
        var copy = r.clone();
        caches.open(CACHE).then(function(c){ c.put("index.html", copy); });
        return r;
      }).catch(function(){
        return caches.match("index.html").then(function(m){ return m || caches.match("./"); });
      })
    );
    return;
  }

  // Firebase JS files and our own static files: saved copy first, then network.
  if(url.hostname === FB_HOST || url.origin === self.location.origin){
    e.respondWith(
      caches.match(req).then(function(m){
        if(m) return m;
        return fetch(req).then(function(r){
          if(r && (r.ok || r.type === "opaque")){
            var copy = r.clone();
            caches.open(CACHE).then(function(c){ c.put(req, copy); });
          }
          return r;
        });
      })
    );
  }
  // Everything else (Firebase database traffic) is left alone.
});
