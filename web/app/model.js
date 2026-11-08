'use strict';

// List logic shared by the views (and tested in Node): grouping, the search and filter chips, counts.

(function (root) {
  function groupsOf(people) {
    const m = new Map();
    for (const p of people) {
      if (!m.has(p.group)) m.set(p.group, []);
      m.get(p.group).push(p);
    }
    return [...m.entries()];
  }

  // filter: 'all' | 'none' (not marked) | 'kh' | 'zoom'
  function visible(person, marks, q, filter) {
    const query = String(q || '').trim().toLowerCase();
    if (query && !person.name.toLowerCase().includes(query)) return false;
    const mark = marks[person.id];
    if (filter === 'none') return !mark;
    if (filter === 'kh' || filter === 'zoom') return !!mark && mark.where === filter;
    return true;
  }

  const countMarked = (people, marks) => people.filter((p) => marks[p.id]).length;

  // The desktop sidebar: which screens it lists, which one is lit, and the "no list yet" prompts.
  // av: this is the AV computer; named: there is a publisher list; listMode: counting is by list (the "add your list" prompts only show then); route: the screen showing now.
  function sidebar({ av, named, count, route, listMode = true }) {
    const lit = route === 'setup' ? 'list' : route;
    const items = [
      { to: 'home', label: 'Home' },
      { to: 'mark', label: 'Mark attendance' },
      { to: 'history', label: 'History' },
    ];
    if (av) {
      items.push(
        { to: 'desk', label: 'AV desk', av: true },
        { to: 'list', label: 'Publisher list', av: true, go: named ? 'list' : 'setup', badge: named ? count : null },
        { to: 'settings', label: 'Settings', av: true },
      );
    }
    for (const i of items) { i.go = i.go || i.to; i.current = i.to === lit; }
    return { items, addList: !!av && listMode && !named, noListBanner: !!av && listMode && !named && lit !== 'list', pin: !!av };
  }

  const api = { groupsOf, visible, countMarked, sidebar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AttendanceModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
