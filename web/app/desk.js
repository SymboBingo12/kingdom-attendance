'use strict';

// The AV desk (also the OBS dock at /desk): totals, Finalize and the video, Unlock, Midweek/Weekend,
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
    if (r.status === 'ready') return UI.banner('ok', 'info', r.message || 'Ready in M³', r.savedTo ? `Saved in ${r.savedTo}. Phones are locked.` : 'Phones are locked.');
    if (r.status === 'error') return UI.banner('danger', 'warn', "Couldn't make the video", r.message, 'alert');
    if (state.meeting.finalized) return UI.banner('', 'lock', 'Finalized', 'Phones are locked.');
    return '';
  }

  views.desk = {
    render({ state, ctx }) {
      const m = state.meeting;
      const mem = ctx.memory('desk');
      const c = mem.connect;
      const rendering = state.render.status === 'rendering';
      return `${UI.bar('AV desk', UI.typeName(m.type), UI.livePill(state, ctx.live))}
        <div class="pad">
          ${UI.tiles(state.totals)}
          ${state.mode === 'names' ? `<p class="dim small" style="margin-top:-8px">Zoom comes from the names marked Zoom. Kingdom Hall includes ${m.unnamed || 0} unnamed visitor${m.unnamed === 1 ? '' : 's'}.</p>` : ''}
          ${status(state)}
          ${m.finalized
            ? `<div class="row2"><button class="st-btn st-btn--secondary st-btn--main" data-act="unlock" ${rendering ? 'disabled' : ''}>Unlock</button><button class="st-btn st-btn--secondary st-btn--main" data-act="rerender" ${rendering ? 'disabled' : ''}>Make the video again</button></div>`
            : `<button class="st-btn st-btn--primary st-btn--main st-btn--block" data-act="finalize">Finalize</button>
               <p class="dim small" style="margin-top:-8px">Locks the numbers and makes the attendance video for M³.</p>`}
          <section class="st-card"><h3 class="st-card__title">Connect a phone</h3>
            ${c ? `<div class="connect"><img class="qr" src="${c.qr}" alt="QR code that opens Kingdom Attendance"><div><div class="dim small">PIN</div><div class="pin st-num">${UI.esc(c.pin)}</div><div class="dim small">${UI.esc(c.count)}</div></div></div>`
              : '<p class="dim small">Loading the QR code…</p>'}
            <p class="st-card__hint" style="margin-top:var(--space-3)">One QR code for everyone: attendants and the Zoom host land on the same home screen.</p></section>
          <section class="st-card"><h3 class="st-card__title">Meeting</h3>
            <div class="st-seg" role="group" aria-label="Meeting"><button data-type="midweek" aria-pressed="${m.type === 'midweek'}">Midweek</button><button data-type="weekend" aria-pressed="${m.type === 'weekend'}">Weekend</button></div>
            <button class="st-btn st-btn--secondary st-btn--block" style="margin-top:var(--space-3)" data-act="new" ${rendering ? 'disabled' : ''}>${mem.newConfirm ? 'Tap again to clear every mark' : 'New meeting'}</button></section>
        </div>`;
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
      if (a === 'finalize') await ctx.act('/api/finalize');
      else if (a === 'unlock') await ctx.act('/api/unlock');
      else if (a === 'rerender') await ctx.act('/api/rerender');
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
