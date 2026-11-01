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

  const api = { groupsOf, visible, countMarked };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AttendanceModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
