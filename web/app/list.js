'use strict';

// The publisher list (AV computer only): add it the first time (upload Excel or CSV, paste names, or try
// made-up names), check what was read, then keep it up to date. Past meetings keep their own copy of the names.

(function () {
  const UI = window.AppUI;
  const ART = window.AttendanceUiArt;
  const M = window.AttendanceModel;
  const views = (window.AppViews = window.AppViews || {});

  const SAMPLE = ['PUBLISHERS', 'Santos, Ana', 'Santos, Ben', 'Reyes, Mark & Joy', 'Cruz, Lea', 'Garcia, Paolo', 'Bautista, Rose', 'Mendoza, Carl',
    'Villanueva, Nina & Tom', 'Aquino, Liza', 'Ramos, Dino', 'Flores, Mae', 'Torres, Jun', 'BIBLE STUDENTS', 'Navarro, Ella', 'Castillo, Ian',
    'VISITORS', 'Lim, Grace', 'INVITED THRU ZOOM', 'Dela Rosa, Kim', 'Ocampo family'];

  // Pasted lines go to the AV computer as a one-column CSV, so it reads them with the same rules as a file.
  const linesToCsv = (lines) => lines.map((l) => `"${String(l).replace(/"/g, '""')}"`).join('\n');

  async function preview(ctx, body, filename, from) {
    const mem = ctx.memory('setup');
    try {
      const res = await fetch('/api/roster/preview', { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-filename': filename }, body });
      const data = await res.json();
      if (!res.ok) { ctx.note(data.error || "That file couldn't be read."); return; }
      const best = data.sheets.reduce((a, b) => (b.people.length > a.people.length ? b : a), data.sheets[0]);
      mem.sheets = data.sheets;
      mem.sheet = best.name;
      mem.from = data.sheets.length > 1 ? best.name : from;
      ctx.go('setup/check');
    } catch {
      ctx.note('No connection to the AV computer.');
    }
  }

  function setup(ctx) {
    const mem = ctx.memory('setup');
    return `${UI.bar('Add your publisher list')}
      <div class="pad">
        <div class="st-empty"><div class="st-empty__art st-arrive st-rest">${UI.disc(ART.listArt, 'st-disc--lg')}</div>
          <h3>One list, used every meeting</h3><p>Upload it once. It stays on this computer until you upload a new one or change a name.</p></div>
        <label class="st-btn st-btn--primary st-btn--main st-btn--block">Choose a file…<input type="file" id="file" accept=".xlsx,.csv" hidden></label>
        <p class="dim small" style="text-align:center;margin:-8px 0 0">An Excel file (.xlsx) like your attendance sheet, or a CSV</p>
        ${mem.pasting ? `<textarea class="field" id="paste" placeholder="Santos, Ana&#10;Reyes, Mark &amp; Joy&#10;&#10;VISITORS&#10;Lim, Grace"></textarea>
          <button class="st-btn st-btn--secondary st-btn--block" data-act="usePaste">Use these names</button>
          <p class="dim small">One name per line. A line in capitals such as <b>VISITORS</b> starts a new group.</p>`
          : '<button class="st-btn st-btn--secondary st-btn--block" data-act="paste">Type or paste names</button>'}
        <div class="row2"><button class="st-btn st-btn--quiet" data-act="sample">Try made-up names</button><a class="st-btn st-btn--quiet" href="/api/roster/template.csv" download>${UI.icon('down')}Blank template</a></div>
      </div>`;
  }

  function check(state, ctx) {
    const mem = ctx.memory('setup');
    if (!mem.sheets) { ctx.go('setup'); return ''; }
    const people = mem.sheets.find((s) => s.name === mem.sheet).people;
    const groups = M.groupsOf(people).map(([g, ps]) => `<div class="st-row"><span class="st-row__label">${UI.esc(g)}<small>${UI.esc(ps.slice(0, 2).map((x) => x.name).join(' · '))}${ps.length > 2 ? ' …' : ''}</small></span><span class="st-row__meta st-num">${ps.length}</span></div>`).join('');
    return `${UI.bar('Check the list', `From ${mem.from}`, '', { to: 'setup', label: 'Back' })}
      <div class="pad">
        <h2 class="sec" style="font-size:var(--text-xl);color:var(--coral)">${people.length} ${people.length === 1 ? 'person' : 'people'} found</h2>
        ${mem.sheets.length > 1 ? `<label class="lbl">Which sheet is the list?<select class="field" id="sheet" style="width:100%">${mem.sheets.map((s) => `<option ${s.name === mem.sheet ? 'selected' : ''}>${UI.esc(s.name)}</option>`).join('')}</select></label>` : ''}
        <div class="st-list st-list--cards">${groups || '<p class="dim">No names found. Try another sheet or file.</p>'}</div>
        <p class="dim small">Households such as "Mark &amp; Joy" start at 2. Totals and blank rows are left out.</p>
        <button class="st-btn st-btn--primary st-btn--main st-btn--block" data-act="useList" ${people.length ? '' : 'disabled'}>Use this list</button>
      </div>`;
  }

  function listScreen(state, ctx) {
    const mem = ctx.memory('list');
    const groups = M.groupsOf(state.roster);
    const body = groups.map(([g, ps]) => `<div class="ghead"><b>${UI.esc(g)}</b><span>${ps.length}</span></div>` + ps.map((p) => (
      `<div class="prow"><span class="nm">${UI.esc(p.name)}</span>${mem.confirm === p.id
        ? `<button class="st-btn st-btn--danger" data-remove="${p.id}">Remove</button><button class="st-btn st-btn--quiet" data-act="keep">Keep</button>`
        : `<button class="st-btn st-btn--quiet" data-ask="${p.id}" aria-label="Remove ${UI.esc(p.name)}">Remove</button>`}</div>`)).join('')).join('');
    return `${UI.bar('Publisher list', `${state.roster.length} people`)}
      <div class="pad">
        <div class="add-row"><input class="field" id="listName" maxlength="80" placeholder="Add a name" autocomplete="off">
          <select class="field" id="listGroup" aria-label="Group">${groups.map(([g]) => `<option>${UI.esc(g)}</option>`).join('')}</select>
          <button class="st-btn st-btn--secondary" data-act="addToList">Add</button></div>
        <button class="st-btn st-btn--secondary st-btn--block" data-go="setup">Upload a new list</button>
        ${UI.banner('', 'info', "Past meetings don't change", 'Each finalized meeting keeps the names as they were that day.')}
        <div>${body}</div>
      </div>`;
  }

  async function useList(ctx) {
    const mem = ctx.memory('setup');
    const people = mem.sheets.find((s) => s.name === mem.sheet).people;
    const m = ctx.state.meeting;
    if (!m.finalized && Object.keys(m.marks || {}).length && !window.confirm("Today's marks will be cleared. Use this list?")) return;
    if (await ctx.act('/api/roster', { people })) { mem.sheets = null; ctx.go('home'); }
  }

  views.setup = {
    render({ state, ctx, arg }) { return arg === 'check' ? check(state, ctx) : setup(ctx); },
    async onClick(b, ctx) {
      const mem = ctx.memory('setup');
      const a = b.dataset.act;
      if (a === 'paste') { mem.pasting = true; ctx.redraw(); }
      else if (a === 'usePaste') {
        const lines = (document.getElementById('paste').value || '').split(/\r?\n/);
        await preview(ctx, linesToCsv(lines), 'pasted.csv', 'what you typed');
      } else if (a === 'sample') await preview(ctx, linesToCsv(SAMPLE), 'sample.csv', 'the made-up list');
      else if (a === 'useList') await useList(ctx);
    },
    async onChange(el, ctx) {
      const mem = ctx.memory('setup');
      if (el.id === 'file' && el.files[0]) {
        const f = el.files[0];
        await preview(ctx, await f.arrayBuffer(), f.name, f.name);
      }
      if (el.id === 'sheet') { mem.sheet = el.value; mem.from = el.value; ctx.redraw(); }
    },
  };

  views.list = {
    render({ state, ctx }) {
      if (state.mode !== 'names') { ctx.go('setup'); return ''; }
      return listScreen(state, ctx);
    },
    async onClick(b, ctx) {
      const mem = ctx.memory('list');
      if (b.dataset.ask) { mem.confirm = b.dataset.ask; ctx.redraw(); return; }
      if (b.dataset.act === 'keep') { mem.confirm = null; ctx.redraw(); return; }
      if (b.dataset.remove) { mem.confirm = null; await ctx.act('/api/roster/remove', { id: b.dataset.remove }); return; }
      if (b.dataset.act === 'addToList') {
        const input = document.getElementById('listName');
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        const person = await ctx.api.post('/api/roster/add', { name, group: document.getElementById('listGroup').value }).catch((err) => { ctx.note(err.message); return null; });
        if (person) { ctx.note(`${person.name} added.`, 'ok'); }
      }
    },
    onKeydown(el, ctx, e) {
      if (el.id === 'listName' && e.key === 'Enter') { e.preventDefault(); document.querySelector('[data-act="addToList"]').click(); }
    },
  };
})();
