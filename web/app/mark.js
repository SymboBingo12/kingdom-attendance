'use strict';

// Mark attendance. With a publisher list: each person KH or Zoom (− n + for a household), search, filters,
// unnamed visitors and visitors added by name. Without a list: Left / Center / Right and the Zoom total.
// Everything locks once the AV desk presses Finalize.

(function () {
  const UI = window.AppUI;
  const M = window.AttendanceModel;
  const views = (window.AppViews = window.AppViews || {});
  const LANES = ['left', 'center', 'right'];
  const MAX_ZOOM = 999;
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  // The list plus today's visitors, who appear under the list's visitor group.
  function everyone(state) {
    const vg = (state.roster.find((p) => /visitor/i.test(p.group)) || { group: 'Visitors' }).group;
    return [...state.roster, ...(state.visitors || []).map((v) => ({ ...v, group: vg, size: 1 }))];
  }

  const finalBanner = () => UI.banner('warn', 'lock', 'Already finalized', 'A change here updates the record. The AV desk then updates the video.');

  function names(state, ctx) {
    const mem = ctx.memory('mark');
    const m = state.meeting;
    const lock = '';
    const people = everyone(state);
    const left = people.filter((p) => !m.marks[p.id]).length;
    let html = '';
    for (const [g, ps] of M.groupsOf(people)) {
      const shown = ps.filter((p) => M.visible(p, m.marks, mem.q, mem.filter));
      if (!shown.length) continue;
      html += `<div class="ghead"><b>${UI.esc(g)}</b><span>${M.countMarked(ps, m.marks)} of ${ps.length}</span></div><div class="pgrid">`;
      html += shown.map((p) => {
        const x = m.marks[p.id];
        const step = x ? `<span class="step"><button data-dec="${p.id}" aria-label="One fewer for ${UI.esc(p.name)}" ${lock}>−</button><b class="st-num">${x.n}</b><button data-inc="${p.id}" aria-label="One more for ${UI.esc(p.name)}" ${lock}>+</button></span>` : '';
        return `<div class="prow"><span class="nm">${UI.esc(p.name)}</span>${step}<button class="mk kh" data-mark="kh" data-id="${p.id}" aria-pressed="${!!x && x.where === 'kh'}" aria-label="${UI.esc(p.name)} at the Kingdom Hall" ${lock}>KH</button><button class="mk zm" data-mark="zoom" data-id="${p.id}" aria-pressed="${!!x && x.where === 'zoom'}" aria-label="${UI.esc(p.name)} on Zoom" ${lock}>Zoom</button></div>`;
      }).join('') + '</div>';
    }
    const q = String(mem.q || '').trim();
    if (!html) html = `<p class="empty-note">${mem.filter === 'none' && !q ? 'Everyone on the list is marked.' : 'No names match.'}</p>`;
    if (mem.filter === 'all' && !q) {
      html += `<div class="ghead"><b>Not on the list</b></div>
        <div class="prow notlisted"><span class="nm">Unnamed visitors<br><span class="dim small">People at the hall you don't know by name</span></span><span class="step"><button data-unnamed="-1" aria-label="One fewer unnamed visitor" ${lock}>−</button><b class="st-num">${m.unnamed || 0}</b><button data-unnamed="1" aria-label="One more unnamed visitor" ${lock}>+</button></span></div>
        <div style="padding:var(--space-3) 0"><div class="add-row"><input class="field" id="newName" maxlength="80" placeholder="Add a visitor by name" autocomplete="off" ${lock}><button class="mk kh" data-add="kh" ${lock}>KH</button><button class="mk zm" data-add="zoom" ${lock}>Zoom</button></div></div>`;
    }
    const chips = [['all', 'All'], ['none', `Not marked (${left})`], ['kh', 'Kingdom Hall'], ['zoom', 'Zoom']]
      .map(([f, l]) => `<button class="chip" data-f="${f}" aria-pressed="${mem.filter === f}">${l}</button>`).join('');
    return `${UI.bar('Mark attendance', UI.typeName(m.type), UI.livePill(state, ctx.live))}
      <div class="sticky">${UI.tiles(state.totals)}
        ${m.finalized ? finalBanner() : ''}
        <input class="search" type="search" id="q" placeholder="Search a name" value="${UI.esc(mem.q || '')}" aria-label="Search a name" autocomplete="off">
        <div class="chips" role="group" aria-label="Show">${chips}</div>
      </div>
      <div class="list">${html}</div>`;
  }

  function columns(state, ctx) {
    const m = state.meeting;
    const lock = '';
    const lanes = LANES.map((l) => `<div class="lane"><button data-lane="${l}" data-d="-1" aria-label="One fewer in ${l}" ${lock}>−</button><span>${cap(l)}<b class="st-num">${m.lanes[l]}</b></span><button class="plus" data-lane="${l}" data-d="1" aria-label="One more in ${l}" ${lock}>+</button></div>`).join('');
    return `${UI.bar('Count attendance', UI.typeName(m.type), UI.livePill(state, ctx.live))}
      <div class="pad countpad">
        ${m.finalized ? finalBanner() : ''}
        <div class="bigtotal"><div class="k">Kingdom Hall</div><div class="v st-num">${state.totals.hall}</div></div>
        ${state.countMode === 'overall' ? `<div class="st-card"><h3 class="st-card__title">Kingdom Hall</h3>
          <p class="st-card__hint">Type the overall count for the hall.</p>
          <div class="zstep"><button data-hall="-1" aria-label="One fewer at the Kingdom Hall">−</button><input id="hallIn" data-live type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" value="${m.hall || 0}" aria-label="Kingdom Hall total"><button class="plus" data-hall="1" aria-label="One more at the Kingdom Hall">+</button></div></div>` : lanes}
        <div class="st-card"><h3 class="st-card__title" style="display:flex;gap:var(--space-3);align-items:center">${UI.disc(window.AttendanceArt.remoteArt, 'st-disc--sm')}Zoom</h3>
          <p class="st-card__hint">The Zoom host adds up the "(n)" names and types the total.</p>
          <div class="zstep"><button data-zoom="-1" aria-label="One fewer on Zoom" ${lock}>−</button><input id="zoomIn" data-live type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" value="${m.zoom}" aria-label="Zoom total" ${lock}><button class="plus" data-zoom="1" aria-label="One more on Zoom" ${lock}>+</button></div>
        </div>
        ${ctx.wide && ctx.who && ctx.who.local ? '' /* the banner above already says it */ : `<p class="dim small" style="text-align:center">No publisher list yet, so counting is by column.${ctx.who && ctx.who.local ? ' <button class="st-btn st-btn--quiet" data-go="setup">Add a list</button>' : ''}</p>`}
      </div>`;
  }

  const setHall = (ctx, value) => ctx.act('/api/hall', { value: Math.min(MAX_ZOOM, Math.max(0, value)) });
  const setZoom = (ctx, value) => ctx.act('/api/zoom', { value: Math.min(MAX_ZOOM, Math.max(0, value)) });

  views.mark = {
    render({ state, ctx }) {
      const mem = ctx.memory('mark');
      if (!mem.filter) mem.filter = 'all';
      return state.mode === 'names' ? names(state, ctx) : columns(state, ctx);
    },

    async onClick(b, ctx) {
      const state = ctx.state;
      const m = state.meeting;
      const mem = ctx.memory('mark');
      if (b.dataset.f) { mem.filter = b.dataset.f; ctx.redraw(); return; }
      const tapId = ctx.newTapId();
      if (b.dataset.mark) {
        const x = m.marks[b.dataset.id];
        await ctx.act('/api/mark', { id: b.dataset.id, where: x && x.where === b.dataset.mark ? null : b.dataset.mark, tapId });
      } else if (b.dataset.inc) {
        const x = m.marks[b.dataset.inc];
        await ctx.act('/api/mark', { id: b.dataset.inc, where: x.where, n: Math.min(20, x.n + 1), tapId });
      } else if (b.dataset.dec) {
        const x = m.marks[b.dataset.dec];
        await ctx.act('/api/mark', x.n > 1 ? { id: b.dataset.dec, where: x.where, n: x.n - 1, tapId } : { id: b.dataset.dec, where: null, tapId });
      } else if (b.dataset.unnamed) {
        await ctx.act('/api/unnamed', { delta: Number(b.dataset.unnamed), tapId });
      } else if (b.dataset.add) {
        const input = document.getElementById('newName');
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        if (await ctx.act('/api/visitor', { name, where: b.dataset.add })) {
          const again = document.getElementById('newName');
          if (again) again.value = '';
        }
      } else if (b.dataset.lane) {
        await ctx.act('/api/tap', { lane: b.dataset.lane, delta: Number(b.dataset.d), tapId });
      } else if (b.dataset.hall) {
        await setHall(ctx, (m.hall || 0) + Number(b.dataset.hall));
      } else if (b.dataset.zoom) {
        await setZoom(ctx, m.zoom + Number(b.dataset.zoom));
      }
    },

    onInput(el, ctx) {
      if (el.id === 'q') { ctx.memory('mark').q = el.value; ctx.redraw(); }
      if (el.id === 'zoomIn' || el.id === 'hallIn') {
        const digits = el.value.replace(/\D/g, '');
        if (digits !== el.value) el.value = digits;
      }
    },

    onChange(el, ctx) {
      if (el.id === 'zoomIn') setZoom(ctx, parseInt(el.value, 10) || 0);
      if (el.id === 'hallIn') setHall(ctx, parseInt(el.value, 10) || 0);
    },

    onKeydown(el, ctx, e) {
      if (el.id === 'hallIn' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        setHall(ctx, (ctx.state.meeting.hall || 0) + (e.key === 'ArrowUp' ? 1 : -1));
      }
      if (el.id === 'zoomIn' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        setZoom(ctx, ctx.state.meeting.zoom + (e.key === 'ArrowUp' ? 1 : -1));
      }
      if (el.id === 'newName' && e.key === 'Enter') {
        e.preventDefault();
        document.querySelector('[data-add="kh"]').click();
      }
    },
  };
})();
