'use strict';

// Talks to the attendance server from any page. A failed request is never retried on its own:
// the attendant sees the problem and taps again, so a tap can't be counted twice by accident.

(function (root) {
  function newTapId() {
    newTapId.n = (newTapId.n || 0) + 1;
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${newTapId.n}`;
  }

  function createApi({ base = '', getPin = () => '', onPinNeeded = () => {} } = {}) {
    async function request(method, path, body) {
      let res;
      try {
        res = await fetch(base + path, {
          method,
          headers: { 'content-type': 'application/json', 'x-pin': getPin() || '' },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch {
        throw Object.assign(new Error('No connection to the AV computer.'), { status: 0 });
      }
      let data = null;
      try { data = await res.json(); } catch { data = null; }
      if (res.status === 401) onPinNeeded();
      if (!res.ok) throw Object.assign(new Error((data && data.error) || `Error ${res.status}`), { status: res.status });
      return data;
    }

    // Live state. onStatus gets 'live' or 'reconnecting'; the browser's EventSource reconnects by itself.
    function subscribe(onState, onStatus = () => {}) {
      const pin = encodeURIComponent(getPin() || '');
      const es = new EventSource(`${base}/api/events${pin ? `?pin=${pin}` : ''}`);
      es.onopen = () => onStatus('live');
      es.onmessage = (e) => { onStatus('live'); onState(JSON.parse(e.data)); };
      es.onerror = () => onStatus('reconnecting');
      return () => es.close();
    }

    return {
      get: (path) => request('GET', path),
      post: (path, body = {}) => request('POST', path, body),
      subscribe,
    };
  }

  // Remembered PIN for this phone. Storage can be blocked (private mode), so every access is guarded.
  const pinStore = {
    get() { try { return localStorage.getItem('attendance-pin') || ''; } catch { return ''; } },
    set(v) { try { localStorage.setItem('attendance-pin', v); } catch { /* not remembered */ } },
    clear() { try { localStorage.removeItem('attendance-pin'); } catch { /* nothing to clear */ } },
  };

  const api = { createApi, newTapId, pinStore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AttendanceApi = api;
})(typeof window !== 'undefined' ? window : globalThis);
