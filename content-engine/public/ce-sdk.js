/* Content Engine 추적 SDK v1 — 개인정보를 수집하지 않습니다 (무작위 익명 ID, 세션 ID, UTM만 저장) */
(function (w, d) {
  if (w.ce && w.ce.__loaded) return;
  var cfg = { endpoint: "", workspaceId: "", productId: null, autoPageView: true, sessionMinutes: 30 };
  var LS = "ce_aid", SS = "ce_sid", ST = "ce_sid_t", UTM = "ce_utm", LV = "ce_last_visit";
  function rand() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function get(store, k) { try { return store.getItem(k); } catch (e) { return null; } }
  function set(store, k, v) { try { store.setItem(k, v); } catch (e) {} }
  function readCookie(n) { var m = d.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : null; }
  function anon() { var a = get(localStorage, LS) || readCookie("ce_aid"); if (!a) { a = rand(); } set(localStorage, LS, a); return a; }
  function session() {
    var now = Date.now(), t = Number(get(sessionStorage, ST) || 0), s = get(sessionStorage, SS);
    if (!s || now - t > cfg.sessionMinutes * 60000) { s = rand(); set(sessionStorage, SS, s); }
    set(sessionStorage, ST, String(now));
    return s;
  }
  function captureUtm() {
    var p = new URLSearchParams(w.location.search), u = {};
    ["source", "medium", "campaign", "content"].forEach(function (k) { var v = p.get("utm_" + k); if (v) u[k] = v.slice(0, 200); });
    if (Object.keys(u).length) { set(localStorage, UTM, JSON.stringify({ u: u, t: Date.now() })); return u; }
    try { var saved = JSON.parse(get(localStorage, UTM) || "null"); if (saved && Date.now() - saved.t < 30 * 86400000) return saved.u; } catch (e) {}
    return undefined;
  }
  var queue = [], timer = null, userId = null;
  function flush() {
    if (!queue.length || !cfg.endpoint) return;
    var events = queue.splice(0, 20);
    var body = JSON.stringify({ events: events });
    try {
      if (navigator.sendBeacon && body.length < 60000) { navigator.sendBeacon(cfg.endpoint, new Blob([body], { type: "application/json" })); return; }
    } catch (e) {}
    try { fetch(cfg.endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: body, keepalive: true }); } catch (e) {}
  }
  function track(name, props) {
    if (!cfg.workspaceId) return;
    var utm = captureUtm();
    queue.push({
      workspaceId: cfg.workspaceId, productId: cfg.productId, channelContentId: utm && utm.content ? utm.content : null,
      anonymousId: anon(), userId: userId, sessionId: session(), eventName: name, properties: props || {},
      timestamp: new Date().toISOString(), landingPage: w.location.href.slice(0, 1000), referrer: (d.referrer || "").slice(0, 1000), utm: utm
    });
    clearTimeout(timer); timer = setTimeout(flush, 800);
  }
  function pageView() {
    var last = Number(get(localStorage, LV) || 0), now = Date.now();
    var hadId = !!get(localStorage, LS);
    track("page_view", { path: w.location.pathname.slice(0, 200), title: (d.title || "").slice(0, 120) });
    if (hadId && last && now - last > cfg.sessionMinutes * 60000) track("return_visit", {});
    set(localStorage, LV, String(now));
  }
  var ce = {
    __loaded: true,
    init: function (o) { cfg = Object.assign(cfg, o || {}); if (!cfg.endpoint && o && o.host) cfg.endpoint = o.host.replace(/\/$/, "") + "/api/collect"; if (cfg.autoPageView) pageView(); },
    track: track,
    identify: function (id) { userId = id ? String(id).slice(0, 128) : null; },
    flush: flush
  };
  w.addEventListener("pagehide", flush);
  d.addEventListener("visibilitychange", function () { if (d.visibilityState === "hidden") flush(); });
  w.ce = ce;
  var q = w.ceq || [];
  q.forEach(function (c) { try { ce[c[0]].apply(ce, c.slice(1)); } catch (e) {} });
})(window, document);
