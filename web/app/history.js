'use strict';

// History: every finalized meeting, newest first, with who was at the Kingdom Hall or on Zoom, and the two
// downloads: the circuit overseer's workbook and the numbers-only CSV.

(function () {
  const UI = window.AppUI;
  const ART = window.AttendanceUiArt;
  const M = window.AttendanceModel;
  const { pinStore } = window.AttendanceApi;
  const views = (window.AppViews = window.AppViews || {});
  const LANES = ['left', 'center', 'right'];

  // Totals of a stored meeting (same rules as the AV computer's).
  function totalsOf(m) {
    let hall = m.lanes.left + m.lanes.center + m.lanes.right + (m.unnamed || 0);
    let zoom = m.zoom || 0;
    for (const x of Object.values(m.marks || {})) { if (x.where === 'kh') hall += x.n; else zoom += x.n; }
    return { hall, zoom, total: hall + zoom };
  }

  const withPin = (url) => { const pin = pinStore.get(); return pin ? `${url}?pin=${encodeURIComponent(pin)}` : url; };
  const day = (date) => new Date(`${date}T12:00:00`);

  function list(entries) {
    if (!entries.length) {
      return `${UI.bar('History')}<div class="pad"><div class="st-empty"><div class="st-empty__art st-arrive st-rest">${UI.disc(ART.historyArt, 'st-disc--lg')}</div>
        <h3>No meetings yet</h3><p>Each meeting appears here after the AV desk presses Finalize.</p></div></div>`;
    }
    const rows = entries.map((m, i) => {
      const t = totalsOf(m);
      return `<button class="hrow" data-go="history/${i}"><span class="when"><b class="st-num">${day(m.date).getDate()}</b>${day(m.date).toLocaleDateString('en-US', { month: 'short' })}</span><span><b>${UI.typeName(m.type)}</b><small>${UI.longDate(m.date)} · Hall ${t.hall} · Zoom ${t.zoom}</small></span><span class="num st-num">${t.total}</span>${UI.icon('chev', 'chev')}</button>`;
    }).join('');
    return `${UI.bar('History')}
      <div class="pad">
        <a class="st-btn st-btn--primary st-btn--main st-btn--block" href="${withPin('/api/history.xlsx')}" download>${UI.icon('down')}Download for the circuit overseer</a>
        <a class="st-btn st-btn--secondary st-btn--block" href="${withPin('/api/history.csv')}" download>${UI.icon('down')}Download CSV (numbers only)</a>
        <p class="dim small" style="margin-top:-8px">An Excel file like your attendance sheet: one sheet per meeting with every name at KH or Zoom, and a summary with monthly averages.</p>
        <div style="display:grid;gap:var(--space-2)">${rows}</div>
      </div>`;
  }

  function detail(m) {
    const t = totalsOf(m);
    let body = '';
    if (m.people && m.people.length) {
      for (const [g, ps] of M.groupsOf(m.people)) {
        body += `<div class="ghead"><b>${UI.esc(g)}</b><span>${M.countMarked(ps, m.marks || {})} of ${ps.length}</span></div>` + ps.map((p) => {
          const x = (m.marks || {})[p.id];
          const tag = x ? `<span class="tag ${x.where === 'kh' ? 'kh' : 'zm'}">${x.where === 'kh' ? 'Kingdom Hall' : 'Zoom'}${x.n > 1 ? ` · ${x.n}` : ''}</span>` : '<span class="tag no">Not marked</span>';
          return `<div class="who"><span>${UI.esc(p.name)}</span>${tag}</div>`;
        }).join('');
      }
      if (m.unnamed) body += `<div class="who"><span>Unnamed visitors</span><span class="tag kh">Kingdom Hall · ${m.unnamed}</span></div>`;
    } else {
      body = `<div class="st-list st-list--cards">${LANES.map((l) => `<div class="st-row"><span class="st-row__label">${l[0].toUpperCase() + l.slice(1)}</span><span class="st-row__meta st-num">${m.lanes[l]}</span></div>`).join('')}
        <div class="st-row"><span class="st-row__label">Zoom (typed total)</span><span class="st-row__meta st-num">${m.zoom || 0}</span></div></div>`;
    }
    return `${UI.bar(UI.typeName(m.type), UI.longDate(m.date), '', { to: 'history', label: 'History' })}
      <div class="pad">${UI.tiles(t)}<div>${body}</div></div>`;
  }

  views.history = {
    render({ ctx, arg }) {
      const mem = ctx.memory('history');
      if (!mem.entries) return `${UI.bar('History')}<div class="pad"><p class="dim" style="text-align:center">Loading…</p></div>`;
      if (arg !== undefined && mem.entries[Number(arg)]) return detail(mem.entries[Number(arg)]);
      return list(mem.entries);
    },

    // Fetches the history when the screen opens, and again after a meeting is finalized or unlocked.
    after({ ctx }) {
      const mem = ctx.memory('history');
      const key = `${ctx.state.meeting.date}|${ctx.state.meeting.finalized}|${ctx.state.meeting.finalizedAt}`;
      if (mem.key === key || mem.loading) return;
      mem.loading = true;
      ctx.api.get('/api/history').then((entries) => {
        mem.entries = entries;
        mem.key = key;
        mem.loading = false;
        ctx.redraw();
      }).catch((err) => { mem.loading = false; ctx.note(err.message); });
    },
  };
})();
