// The records go to Dropbox by themselves (v25): into the "app folder" of the user's own Dropbox app
// (Dropbox -> Apps -> its name), the only place this app can reach there. Connected once on the
// phone with Dropbox's "PKCE" sign-in for apps with no secret: the app opens Dropbox's page, the
// person allows it there and copies the code Dropbox shows, and pastes it back here. Only the
// refresh token is kept, on the phone. A record that cannot go now (no internet) waits in a queue.

export const DBX_KEY = "7rhah781xwe7x4m"; // the app's key (a public name, not a secret)
// v26: after "Allow", Dropbox sends the person back here with the code (his iPhone did not show the code
// on Dropbox's own page). Registered in the Dropbox app as a Redirect URI. Elsewhere (tests on this PC)
// the code is shown by Dropbox to copy, as before.
export const DBX_REDIRECT = "https://mohamedtayseer.github.io/prayer-counter/";
const STORE = "prayerCounter.dropbox";     // { refresh, access, exp }
const QUEUE = "prayerCounter.dbxQueue";    // [ { name, text } ]
const VERIFIER = "prayerCounter.dbxVerifier";
const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const UPLOAD_URL = "https://content.dropboxapi.com/2/files/upload";

const load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ } };
const drop = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const dbxConnected = () => !!load(STORE, null)?.refresh;
export const dbxWaiting = () => load(QUEUE, []).length;

// Dropbox's page to allow the app (opened by a plain link tap, so no pop-up blocker stops it). The
// secret half of the sign-in (the verifier) is made once and kept until the code comes back.
const here = () => (location.origin + location.pathname).replace(/index\.html$/, "");
// (the sign-in in progress: { v: the verifier, redirect: where Dropbox sends the code back, or null })
function pending() {
  let st = load(VERIFIER, null);
  if (typeof st === "string") st = { v: st, redirect: null }; // (kept by v25)
  if (!st?.v) { st = { v: b64url(crypto.getRandomValues(new Uint8Array(48))), redirect: here() === DBX_REDIRECT ? DBX_REDIRECT : null }; save(VERIFIER, st); }
  return st;
}
export async function dbxConnectUrl() {
  const st = pending();
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(st.v)));
  const q = new URLSearchParams({ client_id: DBX_KEY, response_type: "code", code_challenge: b64url(hash), code_challenge_method: "S256", token_access_type: "offline" });
  if (st.redirect) q.set("redirect_uri", st.redirect); // (none: Dropbox shows the code to copy)
  return `https://www.dropbox.com/oauth2/authorize?${q}`;
}
// Opened by Dropbox's redirect? { code } or { error }, else null. hasSignIn: this copy of the app (not
// Safari, on an iPhone home-screen app) began the sign-in and can finish it by itself.
export function dbxReturn() {
  const q = new URLSearchParams(location.search);
  if (!q.has("code") && !q.has("error")) return null;
  return { code: q.get("code"), error: q.get("error") ? (q.get("error_description") || q.get("error")) : null, hasSignIn: !!load(VERIFIER, null) };
}

// The code the person copied from Dropbox's page -> the tokens. Returns "" or what went wrong.
export async function dbxFinishConnect(code) {
  let st = load(VERIFIER, null);
  if (typeof st === "string") st = { v: st, redirect: null };
  if (!st?.v) return "اضغط «افتح الـ Dropbox» الأول.";
  try {
    const body = new URLSearchParams({ code: code.trim(), grant_type: "authorization_code", code_verifier: st.v, client_id: DBX_KEY });
    if (st.redirect) body.set("redirect_uri", st.redirect); // (the same as in the sign-in)
    const r = await fetch(TOKEN_URL, { method: "POST", body });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.refresh_token) return "الكود ده ما نفعش. افتح الـ Dropbox تاني وانسخ الكود الجديد.";
    save(STORE, { refresh: j.refresh_token, access: j.access_token, exp: Date.now() + (j.expires_in || 0) * 1000 - 60000 });
    drop(VERIFIER);
    return "";
  } catch { return "مفيش نت دلوقتي. جرّب تاني."; }
}

export function dbxDisconnect() { drop(STORE); drop(VERIFIER); }

export function dbxQueue(name, text) {
  const q = load(QUEUE, []);
  if (!q.some((x) => x.name === name)) q.push({ name, text });
  save(QUEUE, q.slice(-20)); // (at most 20 waiting)
}

async function accessToken(force = false) {
  const s = load(STORE, null);
  if (!s?.refresh) return null;
  if (!force && s.access && Date.now() < s.exp) return s.access;
  const r = await fetch(TOKEN_URL, { method: "POST", body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: s.refresh, client_id: DBX_KEY }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    if (r.status === 400 || r.status === 401) { drop(STORE); throw new Error("revoked"); } // (allowed no more)
    throw new Error(`token ${r.status}`);
  }
  save(STORE, { ...s, access: j.access_token, exp: Date.now() + (j.expires_in || 0) * 1000 - 60000 });
  return j.access_token;
}

// Sends what is waiting. Returns { sent, left, error: "" | "offline" | "revoked" | ... }.
let busy = null;
export function dbxFlush() {
  busy ||= (async () => {
    let sent = 0, error = "";
    try {
      for (let q = load(QUEUE, []); q.length && dbxConnected(); q = load(QUEUE, [])) {
        const { name, text } = q[0];
        const put = async (tok) => fetch(UPLOAD_URL, { method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/octet-stream", "Dropbox-API-Arg": JSON.stringify({ path: `/${name}`, mode: "add", autorename: true, mute: true }) }, body: new Blob([text]) });
        let r = await put(await accessToken());
        if (r.status === 401) r = await put(await accessToken(true));
        if (!r.ok) { error = `upload ${r.status}`; break; }
        save(QUEUE, load(QUEUE, []).filter((x) => x.name !== name));
        sent++;
      }
    } catch (e) { error = e?.message === "revoked" ? "revoked" : "offline"; }
    busy = null;
    return { sent, left: load(QUEUE, []).length, error };
  })();
  return busy;
}
