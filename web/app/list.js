'use strict';

// The publisher list (AV computer only): add it the first time (upload Excel or CSV, paste names, or try
// made-up names), check what was read, then keep it up to date. Past meetings keep their own copy of the names.

(function () {
  const UI = window.AppUI;
  const ART = window.AttendanceUiArt;
  const M = window.AttendanceModel;
  const views = (window.AppViews = window.AppViews || {});

  const SAMPLE = ['PUBLISHERS', 'Santos, Ana', 'Santos, Ben', 'Reyes, Mark & Joy', 'Cruz, Lea', 'Garcia, Paolo', 'Bautista, Rose', 'Mendoza, Carl',
    'Villanueva, Nina & Tom', 'Aquino, Liza', 'Ramos, Dino', 'Flores, Mae', 'Torres, Jun', 'UNBAPTIZED PUBLISHERS', 'Navarro, Ella', 'Castillo, Ian',
    'INVITED', 'Lim, Grace', 'Dela Rosa, Kim', 'Ocampo family'];
  const PUBLISHERS = 'Publishers';
  const UNBAPTIZED = 'Unbaptized publishers';
  const INVITED = 'Invited';
  const WHERE = { kh: 'Kingdom Hall', zoom: 'Zoom' };

  // Pasted lines go to the AV computer as a one-column CSV, so it reads them with the same rules as a file.
  const linesToCsv = (lines) => lines.map((l) => `"${String(l).replace(/"/g, '""')}"`).join('\n');

  async function preview(ctx, body, filename, from) {
    const mem = ctx.memory('setup');
    try {
      const res = await fetch('/api/roster/preview', { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-filename': encodeURIComponent(filename) }, body });
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

  const pasteBox = () => `<textarea class="field" id="paste" placeholder="Santos, Ana&#10;Reyes, Mark &amp; Joy&#10;&#10;UNBAPTIZED PUBLISHERS&#10;Navarro, Ella"></textarea>`;

  // Desktop: one drop area with every way in. Used by the first-time screen and the list's left column.
  function uploadArea(mem) {
    return `<div class="drop">${UI.disc(ART.listArt, 'st-disc--lg st-rest')}
        <b>Drag your attendance sheet here</b>
        <span class="dim">An Excel file (.xlsx) like your attendance sheet, or a CSV</span>
        <label class="st-btn st-btn--primary st-btn--main">Choose a file…<input type="file" id="file" accept=".xlsx,.csv" hidden></label>
        ${mem.pasting ? `${pasteBox()}<button class="st-btn st-btn--secondary" data-act="usePaste">Use these names</button>
          <span class="dim small">One name per line. A line in capitals such as <b>UNBAPTIZED PUBLISHERS</b> or <b>INVITED</b> starts a new group.</span>` : ''}
        <div class="orrow">${mem.pasting ? '' : '<button class="st-btn st-btn--secondary" data-act="paste">Type or paste names</button>'}<a class="st-btn st-btn--quiet" href="/api/roster/template.csv" download>${UI.icon('down')}Blank template</a><button class="st-btn st-btn--quiet" data-act="sample">Try made-up names</button></div>
        <span class="dim small">Next you check what was read (which sheet, how many people per group), then press <b>Use this list</b>. It stays on this computer until you upload a new one.</span>
      </div>`;
  }

  function setup(ctx) {
    const mem = ctx.memory('setup');
    if (ctx.wide) return `${UI.bar('Add your publisher list', 'Once, on this computer. Attendants then mark each person KH or Zoom.')}<div class="pad">${uploadArea(mem)}</div>`;
    return `${UI.bar('Add your publisher list')}
      <div class="pad">
        <div class="st-empty"><div class="st-empty__art st-arrive st-rest">${UI.disc(ART.listArt, 'st-disc--lg')}</div>
          <h3>One list, used every meeting</h3><p>Upload it once. It stays on this computer until you upload a new one or change a name.</p></div>
        <label class="st-btn st-btn--primary st-btn--main st-btn--block">Choose a file…<input type="file" id="file" accept=".xlsx,.csv" hidden></label>
        <p class="dim small" style="text-align:center;margin:-8px 0 0">An Excel file (.xlsx) like your attendance sheet, or a CSV</p>
        ${mem.pasting ? `${pasteBox()}
          <button class="st-btn st-btn--secondary st-btn--block" data-act="usePaste">Use these names</button>
          <p class="dim small">One name per line. A line in capitals such as <b>UNBAPTIZED PUBLISHERS</b> or <b>INVITED</b> starts a new group.</p>`
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
    const found = M.groupsOf(state.roster);
    const peopleOf = (g) => (found.find(([name]) => name === g) || [g, []])[1];
    // Publishers, then Unbaptized publishers, then any other group in the file; Invited always closes the list.
    const others = found.map(([g]) => g).filter((g) => ![PUBLISHERS, UNBAPTIZED, INVITED].includes(g));
    const order = [PUBLISHERS, UNBAPTIZED, ...others, INVITED];
    const remove = (p) => (mem.confirm === p.id
      ? `<button class="st-btn st-btn--danger" data-remove="${p.id}">Remove</button><button class="st-btn st-btn--quiet" data-act="keep">Keep</button>`
      : `<button class="st-btn st-btn--quiet" data-ask="${p.id}" aria-label="Remove ${UI.esc(p.name)}">Remove</button>`);
    const row = (p) => {
      const label = p.group === INVITED ? [p.size > 1 ? p.size : '', WHERE[p.where] || ''].filter(Boolean).join(' · ') : '';
      const tag = label ? `<span class="tag ${p.where === 'zoom' ? 'zm' : 'kh'}">${label}</span>` : '';
      return `<div class="prow"><span class="nm">${UI.esc(p.name)}</span>${tag}${remove(p)}</div>`;
    };
    const section = (g) => {
      const ps = peopleOf(g);
      let html = `<div class="ghead"><b>${UI.esc(g)}</b><span>${ps.length}</span></div>`;
      if (g === INVITED) {
        html += `<div class="add-row" id="invitedForm"><input class="field" id="invName" maxlength="80" placeholder="Name or family group" autocomplete="off">
          <input class="field" id="invCount" type="number" min="1" max="20" value="1" inputmode="numeric" aria-label="How many people" style="flex:0 0 76px">
          <select class="field" id="invWhere" aria-label="Where they attend"><option value="kh">Kingdom Hall</option><option value="zoom">Zoom</option></select>
          <button class="st-btn st-btn--secondary" data-act="addInvited">Add</button></div>
          <p class="dim small">Type the name or family group and how many they are. They are marked for today's meeting right away.</p>`;
      }
      if (ps.length) html += `<div class="pgrid narrow">${ps.map(row).join('')}</div>`;
      else if (g !== INVITED) html += '<p class="dim small">No one yet.</p>';
      return html;
    };
    const body = order.map(section).join('');
    const addRow = `<div class="add-row"><input class="field" id="listName" maxlength="80" placeholder="Add a name" autocomplete="off">
          <select class="field" id="listGroup" aria-label="Group">${order.filter((g) => g !== INVITED).map((g) => `<option>${UI.esc(g)}</option>`).join('')}</select>
          <button class="st-btn st-btn--secondary" data-act="addToList">Add</button></div>`;
    if (ctx.wide) {
      return `${UI.bar('Publisher list', `${state.roster.length} people · past meetings keep the names as they were`)}
        <div class="pad listgrid">
          <section class="panel"><h3>Upload a new list</h3>${uploadArea(ctx.memory('setup'))}</section>
          <section class="panel"><h3>The list now</h3>${addRow}<div>${body}</div></section>
        </div>`;
    }
    return `${UI.bar('Publisher list', `${state.roster.length} people`)}
      <div class="pad">
        ${addRow}
        <button class="st-btn st-btn--secondary st-btn--block" data-go="setup">Upload a new list</button>
        ${UI.banner('', 'info', "Past meetings don't change", 'Each finalized meeting keeps the names as they were that day.')}
        <div>${body}</div>
      </div>`;
  }

  // Dropped on the desktop's drop area (or anywhere on these screens).
  async function dropped(file, ctx) {
    if (!/\.(xlsx|csv)$/i.test(file.name)) { ctx.note('Drop an Excel file (.xlsx) or a CSV.'); return; }
    await preview(ctx, await file.arrayBuffer(), file.name, file.name);
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
    onDrop: dropped,
  };

  views.list = {
    render({ state, ctx }) {
      if (!state.roster.length) { ctx.go('setup'); return ''; }
      return listScreen(state, ctx);
    },
    async onClick(b, ctx) {
      const mem = ctx.memory('list');
      // The desktop's upload column works like the first-time screen.
      if (['paste', 'usePaste', 'sample'].includes(b.dataset.act)) return views.setup.onClick(b, ctx);
      if (b.dataset.ask) { mem.confirm = b.dataset.ask; ctx.redraw(); return; }
      if (b.dataset.act === 'keep') { mem.confirm = null; ctx.redraw(); return; }
      if (b.dataset.remove) { mem.confirm = null; await ctx.act('/api/roster/remove', { id: b.dataset.remove }); return; }
      if (b.dataset.act === 'addInvited') {
        const input = document.getElementById('invName');
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        const size = Math.min(20, Math.max(1, parseInt(document.getElementById('invCount').value, 10) || 1));
        const person = await ctx.api.post('/api/roster/add', { name, group: INVITED, size, where: document.getElementById('invWhere').value }).catch((err) => { ctx.note(err.message); return null; });
        if (person) ctx.note(`${person.name} added.`, 'ok');
        return;
      }
      if (b.dataset.act === 'addToList') {
        const input = document.getElementById('listName');
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        const person = await ctx.api.post('/api/roster/add', { name, group: document.getElementById('listGroup').value }).catch((err) => { ctx.note(err.message); return null; });
        if (person) { ctx.note(`${person.name} added.`, 'ok'); }
      }
    },
    onChange(el, ctx) { if (el.id === 'file') return views.setup.onChange(el, ctx); },
    onDrop: dropped,
    onKeydown(el, ctx, e) {
      if (el.id === 'listName' && e.key === 'Enter') { e.preventDefault(); document.querySelector('[data-act="addToList"]').click(); }
      if ((el.id === 'invName' || el.id === 'invCount') && e.key === 'Enter') { e.preventDefault(); document.querySelector('[data-act="addInvited"]').click(); }
    },
  };
})();
