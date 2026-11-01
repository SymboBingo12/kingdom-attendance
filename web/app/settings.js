'use strict';

// Settings (AV computer only): everything the old settings window had, grouped — the attendance video,
// appearance, phones (QR, PIN, links), the OBS dock, Start with Windows and updates.

(function () {
  const UI = window.AppUI;
  const views = (window.AppViews = window.AppViews || {});
  const cap = (v) => v[0].toUpperCase() + v.slice(1);

  const UPDATE_TEXT = {
    unsupported: (u) => u.message,
    idle: () => 'Not checked yet.',
    checking: () => 'Checking for a new version…',
    current: () => 'Up to date.',
    downloading: (u) => `Downloading version ${u.version}… ${u.percent}%`,
    ready: (u) => `Version ${u.version} is ready. It installs when the app is quit, or press Restart and update.`,
    error: (u) => `Couldn't check for updates: ${u.message}`,
  };

  function linkRow(mem, key, label, url) {
    if (!url) return '';
    return `<div class="lrow"><div class="lrow__text"><span class="dim small">${label}</span><code>${UI.esc(url)}</code></div>
      <div class="lrow__btns"><button class="st-btn st-btn--secondary" data-copy="${key}">${mem.copied === key ? 'Copied' : 'Copy'}</button><button class="st-btn st-btn--secondary" data-open="${key}">Open</button></div></div>`;
  }

  const seg = (label, attr, values, current) => `<div class="st-seg" role="group" aria-label="${label}">${values.map((v) => `<button data-${attr}="${v}" aria-pressed="${current === v}">${cap(v)}</button>`).join('')}</div>`;
  const sw = (key, on, label, sub) => `<div class="st-option"><span>${label}<small>${sub}</small></span><button class="st-switch" role="switch" aria-checked="${!!on}" data-sw="${key}" aria-label="${label}"></button></div>`;

  function render(info, mem) {
    const s = info.settings;
    const u = info.update || { state: 'idle' };
    return `${UI.bar('Settings')}
      <div class="pad">
        <section class="st-card set"><h3 class="st-card__title">Attendance video</h3>
          <label class="lbl">Congregation name (shown on the video)<input class="field wide" id="congIn" maxlength="80" value="${UI.esc(s.congregation || '')}" placeholder="Riverside Congregation" autocomplete="off"></label>
          <div class="lbl">M³ shared folder</div>
          <div class="folder"><code class="${s.m3Folder ? '' : 'warn'}">${s.m3Folder ? UI.esc(s.m3Folder) : 'Not set: videos go to the Desktop'}</code>
            <button class="st-btn st-btn--primary" data-host="choose-folder">Choose…</button><button class="st-btn st-btn--secondary" data-folder="m3" ${s.m3Folder ? '' : 'disabled'}>Open</button></div>
          <p class="st-card__hint">In M³: <b>Settings → Integrations → Shared folder</b>, turn on <b>"Add media from a shared folder"</b> and choose this same folder. The video then appears in that meeting's media list by itself.</p>
          <p class="lbl-line">Video colours <span class="dim">· only the attendance video, not this screen</span></p>
          ${seg('Video colours', 'theme', ['light', 'dark'], s.theme || 'light')}
          <button class="st-btn st-btn--secondary" data-folder="videos">Open the videos folder</button>
        </section>
        <section class="st-card set"><h3 class="st-card__title">Appearance</h3>
          <p class="st-card__hint">This screen and every phone's pages. Auto follows each phone or computer.</p>
          ${seg('Appearance', 'appearance', ['light', 'dark', 'auto'], s.appearance || 'light')}
        </section>
        <section class="st-card set"><h3 class="st-card__title">Phones</h3>
          <div class="connect"><img class="qr" src="${info.qr}" alt="QR code that opens Kingdom Attendance"><div><div class="dim small">PIN</div><div class="pin st-num">${UI.esc(s.pin)}</div><button class="st-btn st-btn--secondary" data-act="newPin">New PIN</button></div></div>
          ${linkRow(mem, 'count', 'The one link for everyone', info.links.count)}
          ${linkRow(mem, 'named', 'Short name (iPhones and computers)', info.links.named)}
          <p class="st-card__hint">The address can change from week to week. If a saved link stops working, scan the QR code again.</p>
        </section>
        <section class="st-card set"><h3 class="st-card__title">OBS dock</h3>
          ${linkRow(mem, 'dock', 'Dock address (opens the AV desk)', info.links.dock)}
          <ol class="steps"><li>In OBS: <b>View → Docks → Custom Browser Docks…</b></li><li>Dock Name: <b>Attendance</b>. URL: the dock address above. <b>Apply</b>.</li><li>Near the end of the meeting, press <b>Finalize</b> in the dock.</li></ol>
        </section>
        <section class="st-card set">${sw('openAtLogin', s.openAtLogin, 'Start with Windows', 'Opens hidden in the tray when the computer starts')}</section>
        <section class="st-card set"><h3 class="st-card__title">Updates</h3>
          <p class="st-card__hint"><b>Kingdom Attendance ${UI.esc(info.version)}</b> · ${UI.esc((UPDATE_TEXT[u.state] || UPDATE_TEXT.idle)(u))}</p>
          <div class="row2"><button class="st-btn st-btn--secondary" data-host="check-update" ${['unsupported', 'checking', 'downloading', 'ready'].includes(u.state) ? 'disabled' : ''}>Check now</button>${u.state === 'ready' ? '<button class="st-btn st-btn--primary" data-act="install">Restart and update</button>' : ''}</div>
          ${sw('autoUpdate', s.autoUpdate, 'Update automatically', 'New versions download in the background and install when the app is quit. It never restarts by itself.')}
        </section>
        <p class="dim small" style="text-align:center">An independent project. Not affiliated with or endorsed by any organisation. MIT licence · © 2026 Caio (SymboBingo12).</p>
      </div>`;
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }

  views.settings = {
    render({ ctx }) {
      const mem = ctx.memory('settings');
      return mem.info ? render(mem.info, mem) : `${UI.bar('Settings')}<div class="pad"><p class="dim" style="text-align:center">Loading…</p></div>`;
    },

    // Loads the settings when the screen opens, and keeps the update status fresh while it stays open.
    after({ ctx }) {
      const mem = ctx.memory('settings');
      const load = () => ctx.api.get('/api/settings').then((info) => { mem.info = info; ctx.redraw(); }).catch((err) => ctx.note(err.message));
      if (!mem.info) load();
      clearTimeout(mem.poll);
      mem.poll = setTimeout(() => { if (location.hash === '#/settings') load(); }, 2000);
    },

    async onClick(b, ctx) {
      const mem = ctx.memory('settings');
      const post = async (path, body = {}) => {
        try { mem.info = await ctx.api.post(path, body); ctx.redraw(); } catch (err) { ctx.note(err.message); }
      };
      if (b.dataset.theme) return post('/api/settings', { theme: b.dataset.theme });
      if (b.dataset.appearance) return post('/api/settings', { appearance: b.dataset.appearance });
      if (b.dataset.sw) return post('/api/settings', { [b.dataset.sw]: b.getAttribute('aria-checked') !== 'true' });
      if (b.dataset.host) return post(`/api/host/${b.dataset.host}`);
      if (b.dataset.folder) return post('/api/host/open-folder', { which: b.dataset.folder });
      if (b.dataset.act === 'newPin') { await post('/api/pin/new'); ctx.note('New PIN made. Phones need the new PIN.', 'ok'); return; }
      if (b.dataset.act === 'install') {
        const r = await ctx.api.post('/api/host/install-update', {}).catch(() => ({ ok: false }));
        if (!r.ok) ctx.note('Wait until the video is finished, then try again.');
        return;
      }
      const url = mem.info && mem.info.links[b.dataset.copy || b.dataset.open];
      if (b.dataset.copy && url) {
        if (await copy(url)) { mem.copied = b.dataset.copy; ctx.redraw(); setTimeout(() => { mem.copied = null; ctx.redraw(); }, 1500); }
      }
      if (b.dataset.open && url) window.open(url, '_blank');
    },

    async onChange(el, ctx) {
      if (el.id !== 'congIn') return;
      const mem = ctx.memory('settings');
      try { mem.info = await ctx.api.post('/api/settings', { congregation: el.value }); ctx.note('Saved', 'ok'); } catch (err) { ctx.note(err.message); }
    },
  };
})();
