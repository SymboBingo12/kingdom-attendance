'use strict';

// The AV desk (also the OBS dock at /desk): totals, Finalize and the video, Midweek/Weekend,
// New meeting, and the QR code with the PIN for phones. AV computer only.

(function () {
  const UI = window.AppUI;
  const ART = window.AttendanceUiArt;
  const views = (window.AppViews = window.AppViews || {});

  function waiting(layer) {
    layer.innerHTML = `<div class="waiting"><div class="st-wait"><div class="st-wait__art">${UI.disc(ART.deskArt)}</div><h3>Making the video…</h3><p>About a minute on this computer.</p></div></div>`;
  }

  function celebrate(layer, state) {
    layer.innerHTML = `<div class="overlay"><div class="st-scrim" id="scrim"></div><div class="st-sheet" id="sheetEl"><div class="st-sheet__art">${UI.disc(ART.deskArt, '', { done: true })}<i></i><i></i><i></i><i></i><i></i></div>
      <h3>${UI.esc(state.render.message || 'Ready in M³')}</h3><p>Today's attendance: <b class="st-num">${state.totals.total}</b></p><button class="st-btn st-btn--primary st-btn--main st-btn--block" id="closeSheet">Done</button></div></div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById('scrim').classList.add('is-open');
      document.getElementById('sheetEl').classList.add('is-open');
    }));
    const close = () => { layer.innerHTML = ''; };
    document.getElementById('closeSheet').addEventListener('click', close);
    document.getElementById('scrim').addEventListener('click', close);
  }

  function status(state) {
    const r = state.render;
    if (r.status === 'error') return UI.banner('danger', 'warn', "Couldn't make the video", r.message, 'alert');
    if (state.meeting.finalized && state.meeting.videoStale) return UI.banner('warn', 'warn', 'Attendance changed after finalizing', 'The record is updated. Update the video so M³ has the new numbers.');
    if (r.status === 'ready') return UI.banner('ok', 'info', r.message || 'Ready in M³', r.savedTo ? `Saved in ${r.savedTo}.` : '');
    if (state.meeting.finalized) return UI.banner('', 'lock', 'Finalized', 'Changes still update the record; then update the video.');
    return '';
  }

  // Only shown when sync needs attention; phones see the same headline.
  function googleNote(state) {
    const g = state.google;
    if (!g || !g.connected) return '';
    if (g.error) return UI.banner('warn', 'warn', 'Google Sheets not up to date', g.error);
    if (g.pending || g.syncing) return UI.banner('', 'info', 'Syncing to Google Sheets', g.pending ? `${g.pending} meeting${g.pending === 1 ? '' : 's'} waiting.` : '');
    return '';
  }

  // With Announce cleaners on, Finalize (and Update the video) first asks which field service groups (1-5) clean the restrooms and the hall.
  function askCleaners(layer, ctx, then) {
    const state = ctx.state;
    const draft = { ...(state.meeting.cleaners || { restrooms: null, hall: null }) };
    const row = (key, label) => `<div class="lbl">${UI.esc(label)} · FSG</div><div class="st-seg" role="group" aria-label="${UI.esc(label)}">${[1, 2, 3, 4, 5].map((n) => `<button data-pick="${key}:${n}" aria-pressed="${draft[key] === n}">${n}</button>`).join('')}</div>`;
    layer.innerHTML = `<div class="overlay"><div class="st-scrim" id="askScrim"></div><div class="st-sheet" id="askSheet">
      <h3>Who are the cleaners?</h3><p class="dim">The last slide of the video names them.</p>
      ${row('restrooms', 'Restrooms')}${row('hall', state.cleaners.hallName)}
      <p class="st-card__hint">Tap a number again to clear it. A group left empty is not shown.</p>
      <button class="st-btn st-btn--primary st-btn--main st-btn--block" id="askGo">${then === 'rerender' ? 'Update the video' : 'Finalize'}</button>
      <button class="st-btn st-btn--quiet st-btn--block" id="askCancel">Cancel</button></div></div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const sc = document.getElementById('askScrim');
      const sh = document.getElementById('askSheet');
      if (sc && sh) { sc.classList.add('is-open'); sh.classList.add('is-open'); }
    }));
    const close = () => { layer.innerHTML = ''; };
    layer.querySelectorAll('[data-pick]').forEach((btn) => btn.addEventListener('click', () => {
      const [key, n] = btn.dataset.pick.split(':');
      draft[key] = draft[key] === Number(n) ? null : Number(n);
      layer.querySelectorAll(`[data-pick^="${key}:"]`).forEach((o) => o.setAttribute('aria-pressed', String(draft[key] === Number(o.dataset.pick.split(':')[1]))));
    }));
    document.getElementById('askCancel').addEventListener('click', close);
    document.getElementById('askScrim').addEventListener('click', close);
    document.getElementById('askGo').addEventListener('click', async () => {
      close();
      if (await ctx.act('/api/cleaners', { restrooms: draft.restrooms, hall: draft.hall })) await ctx.act(then === 'rerender' ? '/api/rerender' : '/api/finalize');
    });
  }

  views.desk = {
    render({ state, ctx }) {
      const m = state.meeting;
      const mem = ctx.memory('desk');
      const c = mem.connect;
      const rendering = state.render.status === 'rendering';
      return `${UI.bar('AV desk', UI.typeName(m.type), `<span class="acts"><button class="st-btn st-btn--secondary" data-act="connect">Connect</button>${UI.livePill(state, ctx.live)}</span>`)}
        <div class="pad deskgrid"><div class="deskmain">
          ${UI.tiles(state.totals)}
          ${state.mode === 'names' ? `<p class="dim small" style="margin-top:-8px">Zoom comes from the names marked Zoom. Kingdom Hall includes ${m.unnamed || 0} unnamed visitor${m.unnamed === 1 ? '' : 's'}.</p>` : ''}
          ${status(state)}
          ${googleNote(state)}
          ${m.finalized
            ? `<button class="st-btn ${m.videoStale ? 'st-btn--primary' : 'st-btn--secondary'} st-btn--main st-btn--block" data-act="rerender" ${rendering ? 'disabled' : ''}>Update the video</button>`
            : `<button class="st-btn st-btn--primary st-btn--main st-btn--block" data-act="finalize">Finalize</button>
               <p class="dim small" style="margin-top:-8px">Saves the attendance in History and makes the video for M³. Later changes overwrite it and ask you to update the video.${state.cleaners ? ' You will be asked who the cleaners are.' : ''}</p>`}
          </div><div class="deskside">
          <section class="st-card"><h3 class="st-card__title">Connect a phone</h3>
            ${c ? `<div class="connect"><img class="qr" src="${c.qr}" alt="QR code that opens Kingdom Hall Attendance"><div><div class="dim small">PIN</div><div class="pin st-num">${UI.esc(c.pin)}</div><div class="dim small">${UI.esc(c.count)}</div></div></div>`
              : '<p class="dim small">Loading the QR code…</p>'}
            <p class="st-card__hint" style="margin-top:var(--space-3)">One QR code for everyone: attendants and the Zoom host land on the same home screen.</p></section>
          <section class="st-card"><h3 class="st-card__title">Meeting</h3>
            <div class="st-seg" role="group" aria-label="Meeting"><button data-type="midweek" aria-pressed="${m.type === 'midweek'}">Midweek</button><button data-type="weekend" aria-pressed="${m.type === 'weekend'}">Weekend</button></div>
            <button class="st-btn st-btn--secondary st-btn--block" style="margin-top:var(--space-3)" data-act="new" ${rendering ? 'disabled' : ''}>${mem.newConfirm ? 'Tap again to clear every mark' : 'New meeting'}</button></section>
        </div></div>`;
    },

    after({ ctx }) {
      const state = ctx.state;
      const mem = ctx.memory('desk');
      if (!mem.connect && !mem.loadingConnect) {
        mem.loadingConnect = true;
        ctx.api.get('/api/connect').then((c) => { mem.connect = c; ctx.redraw(); }).catch(() => { mem.loadingConnect = false; });
      }
      const s = state.render.status;
      if (s !== mem.lastStatus) {
        if (s === 'rendering') waiting(ctx.layer);
        else if (s === 'ready' && mem.lastStatus === 'rendering') celebrate(ctx.layer, state);
        else ctx.layer.innerHTML = '';
        mem.lastStatus = s;
      }
    },

    async onClick(b, ctx) {
      const mem = ctx.memory('desk');
      if (b.dataset.type) { await ctx.act('/api/type', { type: b.dataset.type }); return; }
      const a = b.dataset.act;
      if (a === 'connect') { const c = mem.connect || await ctx.api.get('/api/connect'); mem.connect = c; UI.connectSheet(ctx.layer, c); }
      else if (a === 'finalize') { if (ctx.state.cleaners) askCleaners(ctx.layer, ctx, 'finalize'); else await ctx.act('/api/finalize'); }
      else if (a === 'unlock') await ctx.act('/api/unlock');
      else if (a === 'rerender') { if (ctx.state.cleaners) askCleaners(ctx.layer, ctx, 'rerender'); else await ctx.act('/api/rerender'); }
      else if (a === 'new') {
        if (!mem.newConfirm) {
          mem.newConfirm = true;
          ctx.redraw();
          clearTimeout(mem.newTimer);
          mem.newTimer = setTimeout(() => { mem.newConfirm = false; ctx.redraw(); }, 4000);
          return;
        }
        mem.newConfirm = false;
        await ctx.act('/api/new');
      }
    },
  };
})();
