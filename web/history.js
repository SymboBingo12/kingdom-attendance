'use strict';

(function () {
  const { createApi, pinStore } = window.AttendanceApi;
  const rows = document.getElementById('rows');
  const api = createApi({ getPin: pinStore.get });
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  const pin = pinStore.get();
  if (pin) document.getElementById('csv').href = `/api/history.csv?pin=${encodeURIComponent(pin)}`;

  function cell(text, cls) {
    const td = document.createElement('td');
    td.textContent = text;
    if (cls) td.className = cls;
    return td;
  }

  api.get('/api/history').then((list) => {
    rows.textContent = '';
    if (!list.length) {
      const tr = document.createElement('tr');
      tr.append(Object.assign(cell('No finalized meetings yet.', 'empty'), { colSpan: 5 }));
      rows.append(tr);
      return;
    }
    for (const m of list) {
      const [y, mo, d] = m.date.split('-').map(Number);
      const hall = m.lanes.left + m.lanes.center + m.lanes.right;
      const tr = document.createElement('tr');
      tr.append(
        cell(fmt.format(new Date(y, mo - 1, d))),
        cell(m.type === 'weekend' ? 'Weekend' : 'Midweek'),
        cell(String(hall)),
        cell(String(m.zoom)),
        cell(String(hall + m.zoom), 'total'),
      );
      rows.append(tr);
    }
  }).catch((err) => {
    rows.innerHTML = '';
    const tr = document.createElement('tr');
    tr.append(Object.assign(cell(`Couldn't load history: ${err.message}`, 'empty'), { colSpan: 5 }));
    rows.append(tr);
  });
})();
