'use strict';

// Settings (AV computer only): everything the old settings window had, grouped — the attendance video,
// appearance, phones (QR, PIN, links), the OBS dock, Google Sheets, Start with Windows and updates.

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

  function google(g) {
    if (!g) return '';
    const link = (f, label) => (f ? `<div class="lrow"><div class="lrow__text"><span class="dim small">${label}</span><code>${UI.esc(f.name)}</code></div><div class="lrow__btns"><a class="st-btn st-btn--secondary" href="${UI.esc(f.url)}" target="_blank" rel="noopener">Open</a></div></div>` : '');
    const when = g.lastSyncAt ? new Date(g.lastSyncAt).toLocaleString() : 'not yet';
    let body;
    if (g.choice) {
      const names = [...g.choice.attendance, ...g.choice.log].map((f) => `<code>${UI.esc(f.name)}</code>`).join('<br>');
      body = `${UI.banner('warn', 'info', 'Use the existing sheets?', 'This Google account already has sheets made by this app:')}<p class="st-card__hint">${names}</p>
        <div class="row2"><button class="st-btn st-btn--primary" data-google="use">Use the existing sheets</button><button class="st-btn st-btn--secondary" data-google="new">Create new ones</button></div>`;
    } else if (g.connected && g.files) {
      body = `<p class="st-card__hint">Connected as <b>${UI.esc(g.email || 'your Google account')}</b>. ${g.syncing ? 'Syncing…' : g.pending ? `${g.pending} meeting${g.pending === 1 ? '' : 's'} waiting to sync.` : `Up to date (last sync: ${UI.esc(when)}).`}</p>
        ${g.error ? UI.banner('danger', 'warn', "Couldn't sync", g.error, 'alert') : ''}
        ${link(g.files.attendance, 'Attendance sheet')}${link(g.files.log, 'Log sheet')}
        <div class="row2"><button class="st-btn st-btn--secondary" data-google="sync" ${g.syncing ? 'disabled' : ''}>Sync now</button><button class="st-btn st-btn--secondary" data-google="disconnect">Disconnect</button></div>`;
    } else if (g.connecting || g.connected) {
      body = `<p class="st-card__hint">${g.connecting ? 'Finish signing in in the browser window that opened…' : 'Setting up the sheets…'}</p>${g.error ? UI.banner('danger', 'warn', "Couldn't set up", g.error, 'alert') : ''}`;
    } else {
      body = `${g.error ? UI.banner('danger', 'warn', 'Not connected', g.error, 'alert') : ''}
        <button class="st-btn st-btn--primary" data-google="connect" ${g.configured ? '' : 'disabled'}>Connect Google</button>
        ${g.configured ? '' : '<p class="st-card__hint">Google sign-in is not set up in this build yet.</p>'}`;
    }
    return `<section class="st-card set"><h3 class="st-card__title">Google Sheets</h3>
      <p class="st-card__hint">After every finalized meeting, the names and numbers are written to two Google Sheets. <b>Names are then stored on this computer and in the Google account you connect.</b> Connect only an account the congregation has agreed to. Past meetings keep updating if they are changed.</p>${body}</section>`;
  }

  function render(info, mem, state) {
    const s = info.settings;
    const mode = state.countMode;
    const people = state.roster.length;
    const u = info.update || { state: 'idle' };
    return `${UI.bar('Settings')}
      <div class="pad setpad">
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
        <section class="st-card set"><h3 class="st-card__title">Counting</h3>
          <p class="st-card__hint">How attendance is counted. Pick one; they can't be mixed. Choose it before the meeting starts.</p>
          <div class="st-seg" role="group" aria-label="Counting">${[['list', 'By list'], ['sections', 'By section'], ['overall', 'Overall']].map(([v, l]) => `<button data-count="${v}" aria-pressed="${mode === v}">${l}</button>`).join('')}</div>
          <p class="st-card__hint">${{ list: '<b>By list</b>: attendants mark each person at the Kingdom Hall or on Zoom.', sections: '<b>By section</b>: tap Left, Center and Right at the hall, and type the Zoom total.', overall: '<b>Overall</b>: type the Kingdom Hall total and the Zoom total.' }[mode]}</p>
          ${mode === 'list' || people ? `<div class="lrow"><div class="lrow__text"><span class="dim small">Publisher list</span><code>${people ? `${people} people` : 'Not added yet'}</code></div><div class="lrow__btns"><button class="st-btn st-btn--secondary" data-go="${people ? 'list' : 'setup'}">${people ? 'Open' : 'Add the list'}</button></div></div>` : `<div class="lrow"><div class="lrow__text"><span class="dim small">Publisher list</span><code>Not used when counting this way</code></div><div class="lrow__btns"><button class="st-btn st-btn--secondary" data-go="setup">Add the list</button></div></div>`}
        </section>
        <section class="st-card set"><h3 class="st-card__title">Cleaners on the video</h3>
          ${sw('announceCleaners', s.announceCleaners, 'Announce cleaners', 'The last slide shows the attendance on the left and the field service groups that clean on the right')}
          ${s.announceCleaners ? `<label class="lbl">Hall name on the slide<input class="field wide" id="clName" maxlength="30" value="${UI.esc(s.cleanersHallName || '')}" placeholder="Kingdom Hall" autocomplete="off"></label>
          <p class="st-card__hint">The groups are picked for each meeting on the <b>AV desk</b> (FSG 1 to 5).</p>` : ''}
        </section>
        <section class="st-card set"><h3 class="st-card__title">Appearance</h3>
          <p class="st-card__hint">This screen and every phone's pages. Auto follows each phone or computer.</p>
          ${seg('Appearance', 'appearance', ['light', 'dark', 'auto'], s.appearance || 'light')}
        </section>
        <section class="st-card set"><h3 class="st-card__title">Phones</h3>
          <div class="connect"><img class="qr" src="${info.qr}" alt="QR code that opens Kingdom Hall Attendance"><div><div class="dim small">PIN</div><div class="pin st-num">${UI.esc(s.pin)}</div><button class="st-btn st-btn--secondary" data-act="newPin">New PIN</button></div></div>
          ${linkRow(mem, 'count', 'The one link for everyone', info.links.count)}
          ${linkRow(mem, 'named', 'Short name (iPhones and computers)', info.links.named)}
          <p class="st-card__hint">The address can change from week to week. If a saved link stops working, scan the QR code again.</p>
          ${(info.links.others || []).length ? `<p class="st-card__hint"><b>Phone still can't connect?</b> This computer has other addresses. Try one of these:</p>${info.links.others.map((o, i) => linkRow(mem, `other${i}`, UI.esc(o.name), o.url)).join('')}` : ''}
          <p class="st-card__hint">Phones must be on the same Wi-Fi as this computer. If Windows asks about the firewall the first time, choose <b>Private networks</b>.</p>
        </section>
        <section class="st-card set"><h3 class="st-card__title">OBS dock</h3>
          ${linkRow(mem, 'dock', 'Dock address (opens the AV desk)', info.links.dock)}
          <ol class="steps"><li>In OBS: <b>View → Docks → Custom Browser Docks…</b></li><li>Dock Name: <b>Attendance</b>. URL: the dock address above. <b>Apply</b>.</li><li>Near the end of the meeting, press <b>Finalize</b> in the dock.</li></ol>
        </section>
        ${google(mem.google)}
        <section class="st-card set">${sw('openAtLogin', s.openAtLogin, 'Start with Windows', 'Opens hidden in the tray when the computer starts')}</section>
        <section class="st-card set"><h3 class="st-card__title">Updates</h3>
          <p class="st-card__hint"><b>Kingdom Hall Attendance ${UI.esc(info.version)}</b> · ${UI.esc((UPDATE_TEXT[u.state] || UPDATE_TEXT.idle)(u))}</p>
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
      return mem.info ? render(mem.info, mem, ctx.state) : `${UI.bar('Settings')}<div class="pad"><p class="dim" style="text-align:center">Loading…</p></div>`;
    },

    // Loads the settings when the screen opens, and keeps the update status fresh while it stays open.
    after({ ctx }) {
      const mem = ctx.memory('settings');
      const load = () => Promise.all([ctx.api.get('/api/settings'), ctx.api.get('/api/google').catch(() => null)])
        .then(([info, g]) => { mem.info = info; mem.google = g; ctx.redraw(); }).catch((err) => ctx.note(err.message));
      if (!mem.info) load();
      clearTimeout(mem.poll);
      mem.poll = setTimeout(() => { if (location.hash === '#/settings') load(); }, 2000);
    },

    async onClick(b, ctx) {
      const mem = ctx.memory('settings');
      const post = async (path, body = {}) => {
        try { mem.info = await ctx.api.post(path, body); ctx.redraw(); } catch (err) { ctx.note(err.message); }
      };
      if (b.dataset.google) {
        const a = b.dataset.google;
        try {
          if (a === 'connect') {
            const { url } = await ctx.api.post('/api/google/connect', {});
            window.open(url, '_blank');
            mem.google = await ctx.api.get('/api/google');
          } else if (a === 'use' || a === 'new') mem.google = await ctx.api.post('/api/google/choose', { use: a === 'use' });
          else if (a === 'sync') mem.google = await ctx.api.post('/api/google/sync', {});
          else if (a === 'disconnect') {
            if (!window.confirm('Disconnect Google? Nothing is deleted from the Google account, but new meetings stop syncing.')) return;
            mem.google = await ctx.api.post('/api/google/disconnect', {});
          }
        } catch (err) { ctx.note(err.message); }
        ctx.redraw();
        return;
      }
      if (b.dataset.count) return post('/api/settings', { countMode: b.dataset.count });
      if (b.dataset.theme) return post('/api/settings', { theme: b.dataset.theme });
      if (b.dataset.appearance) return post('/api/settings', { appearance: b.dataset.appearance });
      if (b.dataset.sw) return post('/api/settings', { [b.dataset.sw]: b.getAttribute('aria-checked') !== 'true' });
      if (b.dataset.host) return post(`/api/host/${b.dataset.host}`);
      if (b.dataset.folder) return post('/api/host/open-folder', { which: b.dataset.folder });
      if (b.dataset.act === 'newPin') {
        ctx.memory('side').stale = true; // the sidebar shows the PIN too
        await post('/api/pin/new');
        ctx.note('New PIN made. Phones need the new PIN.', 'ok');
        return;
      }
      if (b.dataset.act === 'install') {
        const r = await ctx.api.post('/api/host/install-update', {}).catch(() => ({ ok: false }));
        if (!r.ok) ctx.note('Wait until the video is finished, then try again.');
        return;
      }
      const key = b.dataset.copy || b.dataset.open;
      const other = /^other(\d+)$/.exec(key || '');
      const url = mem.info && (other ? (mem.info.links.others[Number(other[1])] || {}).url : mem.info.links[key]);
      if (b.dataset.copy && url) {
        if (await copy(url)) { mem.copied = b.dataset.copy; ctx.redraw(); setTimeout(() => { mem.copied = null; ctx.redraw(); }, 1500); }
      }
      if (b.dataset.open && url) window.open(url, '_blank');
    },

    async onChange(el, ctx) {
      const key = { congIn: 'congregation', clName: 'cleanersHallName' }[el.id];
      if (!key) return;
      const mem = ctx.memory('settings');
      try { mem.info = await ctx.api.post('/api/settings', { [key]: el.value }); ctx.note('Saved', 'ok'); } catch (err) { ctx.note(err.message); }
    },
  };
})();
