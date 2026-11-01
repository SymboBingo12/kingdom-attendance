'use strict';

// Home: the one place everyone lands. Phones see Mark attendance and History; the AV computer also gets the
// AV desk, the publisher list and Settings. With no list yet, the AV computer is offered to add one.

(function () {
  const UI = window.AppUI;
  const ART = window.AttendanceUiArt;
  const views = (window.AppViews = window.AppViews || {});

  const card = (go, iconName, title, sub, { main = false, delay = 0 } = {}) =>
    `<button class="navcard${main ? ' main' : ''} st-arrive" style="--arrive-delay:${delay}ms" data-go="${go}"><span class="ico">${UI.icon(iconName)}</span><span><b>${UI.esc(title)}</b><small>${UI.esc(sub)}</small></span>${UI.icon('chev', 'chev')}</button>`;

  views.home = {
    render({ state, ctx }) {
      const av = ctx.who && ctx.who.local;
      const named = state.mode === 'names';
      const marked = Object.keys(state.meeting.marks || {}).length;
      const first = !named && av
        ? `<div class="st-card st-card--raised" style="display:grid;gap:var(--space-3)">
            <div style="display:flex;gap:var(--space-4);align-items:center">${UI.disc(ART.listArt)}<div><b style="font-size:var(--text-lg)">Add your publisher list</b><p class="dim small" style="margin:4px 0 0">Mark each person at the Kingdom Hall or on Zoom, like your attendance sheet.</p></div></div>
            <button class="st-btn st-btn--primary st-btn--main st-btn--block" data-go="setup">Add the list</button>
            <button class="st-btn st-btn--quiet" data-go="mark">Count by Left, Center and Right instead</button></div>`
        : '';
      return `
        <header class="st-hero st-arrive"><div class="st-hero__art art-grain st-rest">${UI.art(ART.attendanceHeroArt)}</div>
          <div class="st-hero__title"><small>${UI.esc(state.congregation || 'Kingdom Attendance')}</small><h1>${UI.typeName(state.meeting.type)}</h1></div></header>
        <div class="home-meta"><span class="dim small">${UI.longDate(state.meeting.date)}</span>${UI.livePill(state, ctx.live)}</div>
        <div class="pad">
          ${first}
          ${UI.tiles(state.totals)}
          <nav class="nav" aria-label="Kingdom Attendance">
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
