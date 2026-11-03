'use strict';

// Home: the one place everyone lands. Phones see Mark attendance and History; the AV computer also gets the
// AV desk, the publisher list and Settings. With no list yet, the AV computer is offered to add one.

(function () {
  const UI = window.AppUI;
  const ART = window.AttendanceUiArt;
  const M = window.AttendanceModel;
  const views = (window.AppViews = window.AppViews || {});

  const card = (go, iconName, title, sub, { main = false, delay = 0 } = {}) =>
    `<button class="navcard${main ? ' main' : ''} st-arrive" style="--arrive-delay:${delay}ms" data-go="${go}"><span class="ico">${UI.icon(iconName)}</span><span><b>${UI.esc(title)}</b><small>${UI.esc(sub)}</small></span>${UI.icon('chev', 'chev')}</button>`;

  const stat = (cls, label, value, extra = '') => `<div class="stat ${cls}"><div class="k">${label}</div><div class="v st-num">${value}</div>${extra}</div>`;
  const meter = (label, part, whole, text) => `<div class="grow"><b>${UI.esc(label)}</b><span class="st-num">${text}</span><div class="meter"><i style="width:${whole ? Math.round((part / whole) * 100) : 0}%"></i></div></div>`;
  const action = (go, iconName, title, sub) => `<button class="act" data-go="${go}"><span class="ico">${UI.icon(iconName)}</span><span><b>${UI.esc(title)}</b><small>${UI.esc(sub)}</small></span></button>`;

  // Desktop: the meeting beside its picture, the numbers in a row, then progress and quick actions.
  function wide(state, ctx, av, named) {
    const m = state.meeting;
    const t = state.totals;
    const when = UI.longDate(m.date);
    if (av && !named) {
      return `<section class="welcome">${UI.disc(ART.listArt, 'st-rest st-arrive')}<div>
          <div class="dim">${UI.esc(state.congregation || 'Kingdom Hall Attendance')} · ${when}</div><h2>Add your publisher list</h2>
          <p>Upload your attendance sheet once. Then attendants mark each person at the Kingdom Hall or on Zoom, and History keeps every name for the circuit overseer.</p>
          <div class="row2"><button class="st-btn st-btn--primary st-btn--main" data-go="setup">Add the list</button><button class="st-btn st-btn--secondary st-btn--main" data-go="mark">Count by Left, Center and Right instead</button></div></div></section>
        <section class="stats three">${stat('kh', 'Kingdom Hall', t.hall)}${stat('zm', 'Zoom', t.zoom)}${stat('', 'Total', t.total)}</section>`;
    }
    const marked = M.countMarked(state.roster, m.marks || {});
    const people = state.roster.length;
    const progress = named
      ? M.groupsOf(state.roster).map(([g, ps]) => { const k = M.countMarked(ps, m.marks); return meter(g, k, ps.length, `${k} of ${ps.length}`); }).join('')
      : ['left', 'center', 'right'].map((l) => meter(l[0].toUpperCase() + l.slice(1), m.lanes[l], t.hall, m.lanes[l])).join('');
    return `<section class="herocard"><div><div class="eyebrow">${UI.esc(state.congregation || 'Kingdom Hall Attendance')}</div><h2>${UI.typeName(m.type)}</h2>
          <div class="meta"><span>${when}</span>${UI.livePill(state, ctx.live)}</div>
          <div class="cta"><button class="st-btn st-btn--primary st-btn--main" data-go="mark">${UI.icon('mark')}Mark attendance</button>${av ? `<button class="st-btn st-btn--secondary st-btn--main" data-go="desk">${UI.icon('desk')}AV desk</button>` : ''}</div></div>
        <div class="artframe art-grain st-rest st-arrive">${UI.art(ART.attendanceHeroArt)}</div></section>
      <section class="stats${named ? '' : ' three'}">${stat('kh', 'Kingdom Hall', t.hall)}${stat('zm', 'Zoom', t.zoom)}${stat('', 'Total', t.total)}
        ${named ? stat('', 'Marked', `${marked}<span class="of"> of ${people}</span>`, `<div class="meter"><i style="width:${people ? Math.round((marked / people) * 100) : 0}%"></i></div>`) : ''}</section>
      <section class="cols2">
        <div class="panel"><h3>${named ? 'By group' : 'By column'}</h3>${progress}</div>
        <div class="panel"><h3>Quick actions</h3>
          ${action('mark', 'mark', 'Mark attendance', named ? `${people - marked} ${people - marked === 1 ? 'person' : 'people'} not marked yet` : 'Count Left, Center and Right')}
          ${av ? action('desk', 'desk', 'Finalize and make the video', 'Near the end of the meeting') : ''}
          ${action('history', 'down', 'Report for the circuit overseer', 'Excel, in your attendance-sheet layout')}
        </div>
      </section>`;
  }

  views.home = {
    render({ state, ctx }) {
      const av = ctx.who && ctx.who.local;
      const named = state.mode === 'names';
      if (ctx.wide) return `<div class="pad">${wide(state, ctx, av, named)}</div>`;
      const marked = Object.keys(state.meeting.marks || {}).length;
      const first = !named && av
        ? `<div class="st-card st-card--raised" style="display:grid;gap:var(--space-3)">
            <div style="display:flex;gap:var(--space-4);align-items:center">${UI.disc(ART.listArt)}<div><b style="font-size:var(--text-lg)">Add your publisher list</b><p class="dim small" style="margin:4px 0 0">Mark each person at the Kingdom Hall or on Zoom, like your attendance sheet.</p></div></div>
            <button class="st-btn st-btn--primary st-btn--main st-btn--block" data-go="setup">Add the list</button>
            <button class="st-btn st-btn--quiet" data-go="mark">Count by Left, Center and Right instead</button></div>`
        : '';
      return `
        <div class="pad">
          <div class="artframe art-grain st-rest st-arrive">${UI.art(ART.attendanceHeroArt)}</div>
          <header class="ptitle"><small>${UI.esc(state.congregation || 'Kingdom Hall Attendance')} · ${UI.longDate(state.meeting.date)}</small>
            <div><h1>${UI.typeName(state.meeting.type)}</h1>${UI.livePill(state, ctx.live)}</div></header>
          ${first}
          ${UI.tiles(state.totals)}
          <nav class="nav" aria-label="Kingdom Hall Attendance">
            ${card('mark', 'mark', 'Mark attendance', named ? `Tap KH or Zoom beside each name · ${marked} marked` : 'Count Left, Center and Right', { main: true, delay: 40 })}
            ${card('history', 'history', 'History', 'Past meetings and the report for the circuit overseer', { delay: 80 })}
            ${av ? card('desk', 'desk', 'AV desk', 'Finalize, the video, and connecting phones', { delay: 120 }) : ''}
            ${av && named ? card('list', 'list', 'Publisher list', `${state.roster.length} people · add, remove or upload a new list`, { delay: 160 }) : ''}
            ${av ? card('settings', 'settings', 'Settings', 'Congregation, M³ folder, phones, OBS dock, updates', { delay: 200 }) : ''}
          </nav>
          ${av ? '' : '<p class="dim small" style="text-align:center">Finalize and the publisher list are on the AV computer.</p>'}
        </div>`;
    },
  };

  // The PIN, asked once on each phone; the phone remembers it.
  views.pin = {
    render({ pinErr }) {
      return `<form class="pad pinpad" id="pinForm">
        <div class="st-empty"><div class="st-empty__art st-arrive">${UI.disc(ART.markArt, 'st-disc--lg')}</div><h3>Enter the PIN</h3><p>It's shown on the AV computer, under Settings → Phones.</p></div>
        <input class="field pinin st-num" id="pinIn" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="PIN" placeholder="····" autofocus>
        <p class="err" role="alert">${UI.esc(pinErr || '')}</p>
        <button class="st-btn st-btn--primary st-btn--main st-btn--block" type="submit">Open</button>
      </form>`;
    },
    onInput(el) { if (el.id === 'pinIn') el.value = el.value.replace(/\D/g, ''); },
    onSubmit(form, ctx) { ctx.submitPin(form.querySelector('#pinIn').value.trim()); },
  };
})();
