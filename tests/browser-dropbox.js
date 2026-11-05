// The records to Dropbox by themselves (v25), with Dropbox faked (window.fetch). Use: open the app with
// ?sim, paste this file, then `await dropboxTests()` (or run browser-all.js).
window.dropboxTests = async () => {
  localStorage.clear();
  const out = {};
  const realFetch = window.fetch;
  const calls = [];
  let tokens = 0, offline = false;
  window.fetch = async (url, o = {}) => {
    const u = String(url);
    if (!u.includes("dropbox")) return realFetch(url, o);
    if (offline) throw new TypeError("Failed to fetch");
    const body = o.body instanceof URLSearchParams ? Object.fromEntries(o.body) : o.body instanceof Blob ? await o.body.text() : o.body;
    calls.push({ url: u, headers: o.headers || {}, body });
    if (u.endsWith("/oauth2/token")) { tokens++; return new Response(JSON.stringify({ access_token: `A${tokens}`, refresh_token: body.grant_type === "authorization_code" ? "R1" : undefined, expires_in: 14400 }), { status: 200 }); }
    if (u.endsWith("/files/upload")) return new Response(JSON.stringify({ name: "x" }), { status: 200 });
    return new Response("{}", { status: 404 });
  };
  const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
  const dbxOff = () => { const b = document.getElementById("dbxOff"); if (!b.hidden) { b.click(); b.click(); } };
  const feed = (w, ms, o = {}) => { for (let i = 0; i < ms; i += 100) __pc.feed(w, o.yaw ?? -0.1, undefined, o.hands ?? false, w == null ? null : { cx: 0.5, cy: o.cy ?? 0.45, h: 0.39 }, null); };
  const pray = async () => { // a short Fajr that ends at the salam
    document.querySelector('[data-posture="auto"]').click(); document.querySelector('[data-key="fajr"]').click(); await wait(30);
    feed(0.3, 3500); feed(0.3, 1500, { hands: true }); feed(0.3, 10000);
    const rak = () => { feed(0.3, 600, { hands: true }); feed(0.3, 500); feed(0.42, 3000); feed(0.3, 1500); feed(0.45, 2500, { cy: 0.7 }); feed(0.3, 2000); feed(0.45, 2500, { cy: 0.7 }); };
    rak(); feed(0.3, 10000); rak(); feed(0.3, 12000); feed(0.3, 1000, { yaw: -0.6 }); feed(0.3, 600); feed(0.3, 800, { yaw: 0.3 }); feed(0.3, 2000);
    await wait(120);
  };
  try {
    await wait(50);
    // 1. not connected: the link to Dropbox's page
    const href = document.getElementById("dbxOpen").href;
    const q = new URL(href).searchParams;
    out.link = `${new URL(href).host} key ${q.get("client_id")} ${q.get("code_challenge_method")} ${q.get("token_access_type")} challenge ${q.get("code_challenge")?.length} chars redirect ${q.has("redirect_uri") ? "YES" : "none"}`;
    out.notConnected = `${document.getElementById("dbxState").textContent} | form shown: ${!document.getElementById("dbxConnect").hidden}`;
    // 2. the code pasted: the tokens asked for with the kept verifier
    document.getElementById("dbxCode").value = " CODE123 ";
    document.getElementById("dbxDone").click(); await wait();
    const t = calls.find((c) => c.url.endsWith("/oauth2/token"));
    out.connect = `${t ? `${t.body.grant_type} code=${t.body.code} verifier ${t.body.code_verifier?.length} chars key ${t.body.client_id}` : "NO TOKEN CALL"} | ${document.getElementById("dbxState").textContent} | form shown: ${!document.getElementById("dbxConnect").hidden}`;
    out.privacy = document.getElementById("privacyNote").textContent;
    // 3. a prayer: its record goes up by itself
    await pray();
    const up = calls.filter((c) => c.url.endsWith("/files/upload")).pop();
    out.upload = up ? `${up.headers.Authorization} | ${JSON.parse(up.headers["Dropbox-API-Arg"]).path} | ${String(up.body).split("\n")[0].slice(0, 30)} | screen: ${document.getElementById("rDbx").textContent}` : "NO UPLOAD";
    document.getElementById("rHome").click();
    // 4. no internet: it waits, and goes when the internet is back
    offline = true; await pray();
    out.offline = `screen: ${document.getElementById("rDbx").textContent} | waiting: ${JSON.parse(localStorage.getItem("prayerCounter.dbxQueue") || "[]").length}`;
    document.getElementById("rHome").click();
    offline = false; window.dispatchEvent(new Event("online")); await wait(120);
    out.backOnline = `waiting: ${JSON.parse(localStorage.getItem("prayerCounter.dbxQueue") || "[]").length} | uploads so far: ${calls.filter((c) => c.url.endsWith("/files/upload")).length}`;
    // 5. the access token ran out: a new one from the refresh token, then the upload
    const s = JSON.parse(localStorage.getItem("prayerCounter.dropbox")); s.exp = 0; localStorage.setItem("prayerCounter.dropbox", JSON.stringify(s));
    await pray();
    const ref = calls.filter((c) => c.url.endsWith("/oauth2/token")).pop();
    const up2 = calls.filter((c) => c.url.endsWith("/files/upload")).pop();
    out.refresh = `${ref.body.grant_type} ${ref.body.refresh_token} key ${ref.body.client_id} | upload with ${up2.headers.Authorization}`;
    document.getElementById("rHome").click();
    // 6. disconnect (two taps)
    document.getElementById("dbxOff").click(); document.getElementById("dbxOff").click(); await wait();
    out.disconnected = `${document.getElementById("dbxState").textContent} | kept: ${localStorage.getItem("prayerCounter.dropbox") ? "TOKEN STILL THERE" : "nothing"}`;
    // 7. (v26) back from Dropbox's "Allow" with the code: this copy began the sign-in -> it finishes by itself
    await wait(80); // (the link is made again: a new sign-in is waiting)
    const panel = () => `${document.getElementById("dbxPanel").hidden ? "no box" : document.getElementById("dbxPanelTitle").textContent} | code shown: ${document.getElementById("dbxPanelCode").textContent || "-"} | copy button: ${!document.getElementById("dbxPanelCopy").hidden}`;
    const n0 = calls.length;
    await __pc.dbxBack({ code: "BACK1", error: null, hasSignIn: true }); await wait();
    const t2 = calls.slice(n0).find((c) => c.url.endsWith("/oauth2/token"));
    out.backHere = `${t2 ? `${t2.body.grant_type} code=${t2.body.code} verifier ${t2.body.code_verifier?.length}` : "NO TOKEN CALL"} | ${panel()} | ${document.getElementById("dbxState").textContent.slice(0, 10)}`;
    // ...opened in Safari (not the copy that began it): the code shown big, to copy
    dbxOff(); await wait();
    __pc.dbxBack({ code: "SAFARI-CODE-42", error: null, hasSignIn: false });
    out.backInSafari = panel();
    // ..."Cancel" on Dropbox's page
    __pc.dbxBack({ code: null, error: "access_denied", hasSignIn: true });
    out.backDenied = `${panel()} | ${document.getElementById("dbxPanelHint").textContent.slice(0, 30)}`;
    document.getElementById("dbxPanelClose").click();
    out.closed = document.getElementById("dbxPanel").hidden ? "closed" : "STILL OPEN";
  } finally {
    window.fetch = realFetch;
    localStorage.clear();
  }
  console.log(out);
  return out;
};
// Results (v25): link www.dropbox.com, the key, S256, offline, no redirect; connect authorization_code with
// the verifier; upload "Bearer A1" to /prayer_...txt, "اتبعت للـ Dropbox ✓"; offline: waits (1), back online:
// 0 waiting; refresh: refresh_token R1 then the upload with the new token; disconnected: nothing kept.
// v26: backHere: authorization_code BACK1 with the verifier, "الـ Dropbox اتوصل ✓"; backInSafari: the code shown
// with the copy button; backDenied: "ما اتوصلش" + the hint; closed.
