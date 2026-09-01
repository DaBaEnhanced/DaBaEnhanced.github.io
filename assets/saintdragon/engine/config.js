// Asset location + fetch policy.
//
// GitHub Pages (or any static host) can serve just the HTML/JS from this repo
// and point the art + audio at a separate origin -- Cloudflare R2, an S3/CDN
// bucket, a second Pages site. Edit web/config.json, which sits next to the
// top-level index.html:
//
//   {
//     "assetsBaseUrl":   "https://assets.example.com/saintdragon/",
//     "hdAssetsBaseUrl": "",   // blank -> assetsBaseUrl + "hd/"
//     "audioBaseUrl":    "",   // blank -> assetsBaseUrl's sibling "audio/"
//     "version":         "",   // blank -> keep the build-stamped ?v=
//     "fetch": { "retries": 3, "timeoutMs": 15000, "backoffMs": 800 }
//   }
//
// Every blank field falls back to the copy bundled beside these pages, so the
// checked-in config.json runs entirely from the repo with no external host.
//
// A remote host MUST send permissive CORS headers (Access-Control-Allow-Origin
// for this site, or *). The sprite sheet is read back through
// createImageBitmap, which a cross-origin image without CORS would break.
//
// Because a separate origin can be slow or drop a connection, every asset
// request goes through fetchRetry / loadImage below: an AbortController timeout
// plus a few exponential-backoff retries on timeout, network error, or HTTP 5xx.
// 4xx is not retried (a retry will not fix it).

(() => {
  'use strict';
  const here = document.currentScript.src;                    // .../web/engine/config.js
  const webRoot = new URL('../', here).href;                  // .../web/
  const configUrl = new URL('config.json', webRoot).href;     // .../web/config.json
  const withSlash = u => (u && !u.endsWith('/') ? u + '/' : u);
  const noSlash = u => (u && u.endsWith('/') ? u.slice(0, -1) : u);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Defaults; load() replaces these from config.json's "fetch" block.
  let policy = { retries: 3, timeoutMs: 15000, backoffMs: 800 };

  // fetch() with a hard timeout and bounded retries. Retries on AbortError
  // (timeout), TypeError (network/DNS/CORS), and 5xx. Returns the Response as
  // soon as one arrives with status < 500 (2xx/3xx/4xx -- caller checks .ok).
  async function fetchRetry(url, opts = {}) {
    const retries = opts.retries ?? policy.retries;
    const timeoutMs = opts.timeoutMs ?? policy.timeoutMs;
    const backoffMs = opts.backoffMs ?? policy.backoffMs;
    const init = { ...opts };
    delete init.retries; delete init.timeoutMs; delete init.backoffMs;
    let last;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const r = await fetch(url, { ...init, signal: ctl.signal });
        clearTimeout(timer);
        if (r.status >= 500) throw new Error('HTTP ' + r.status);
        return r;
      } catch (e) {
        clearTimeout(timer);
        last = e;
        if (attempt === retries) break;
        await sleep(backoffMs * 2 ** attempt + Math.random() * 250);
      }
    }
    throw new Error(`fetch gave up after ${retries + 1} tr${retries ? 'ies' : 'y'}: ${url} — ${last && last.message || last}`);
  }

  // <img> load with the same timeout + retry shape. crossOrigin is always set so
  // the result can feed createImageBitmap regardless of origin.
  function loadImage(url, opts = {}) {
    const retries = opts.retries ?? policy.retries;
    const timeoutMs = opts.timeoutMs ?? policy.timeoutMs;
    const backoffMs = opts.backoffMs ?? policy.backoffMs;
    return new Promise((resolve, reject) => {
      let attempt = 0;
      const once = () => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const timer = setTimeout(() => { img.src = ''; fail('timeout'); }, timeoutMs);
        const ok = () => { clearTimeout(timer); resolve(img); };
        const fail = why => {
          clearTimeout(timer);
          if (attempt++ < retries) setTimeout(once, backoffMs * 2 ** (attempt - 1) + Math.random() * 250);
          else reject(new Error(`image gave up after ${retries + 1} tr${retries ? 'ies' : 'y'}: ${url} — ${why}`));
        };
        img.onload = ok;
        img.onerror = () => fail('error');
        img.src = url;
      };
      once();
    });
  }

  let pending = null;

  window.SaintDragonAssets = {
    fetchRetry,
    loadImage,
    get policy() { return { ...policy }; },

    // -> Promise<{ assets, hd, audio, version }>
    //    assets / hd end with '/', audio does not (paula.js joins with '/').
    //    version is a string or null. Cached after the first call.
    load() {
      if (pending) return pending;
      pending = fetchRetry(configUrl, { retries: 2, timeoutMs: 8000 })
        .then(r => (r.ok ? r.json() : {}))
        .catch(() => ({}))   // no config / bad JSON -> all-blank -> bundled paths
        .then(cfg => {
          const f = cfg.fetch || {};
          policy = {
            retries: Number.isFinite(f.retries) ? f.retries : policy.retries,
            timeoutMs: Number.isFinite(f.timeoutMs) ? f.timeoutMs : policy.timeoutMs,
            backoffMs: Number.isFinite(f.backoffMs) ? f.backoffMs : policy.backoffMs,
          };
          const base = withSlash((cfg.assetsBaseUrl || '').trim());
          const assets = base || new URL('assets/', webRoot).href;
          const hd = withSlash((cfg.hdAssetsBaseUrl || '').trim())
                  || (base ? base + 'hd/' : new URL('assets/hd/', webRoot).href);
          const audio = noSlash((cfg.audioBaseUrl || '').trim())
                     || noSlash(new URL('audio/', webRoot).href);
          const version = (cfg.version || '').toString().trim() || null;
          return { assets, hd, audio, version };
        });
      return pending;
    },
  };
})();
