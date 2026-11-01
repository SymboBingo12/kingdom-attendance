'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { groupsOf, visible, countMarked, sidebar } = require('../web/app/model');

const people = [
  { id: 'p1', name: 'Santos, Ana', group: 'Publishers' },
  { id: 'p2', name: 'Navarro, Ella', group: 'CLMS' },
  { id: 'p3', name: 'Reyes, Mark & Joy', group: 'Publishers' },
  { id: 'v1', name: 'Lim, Grace', group: 'VISITORS' },
];
const marks = { p1: { where: 'kh', n: 1 }, v1: { where: 'zoom', n: 1 } };

test('groups keep the order they first appear in the list', () => {
  assert.deepEqual(groupsOf(people).map(([g, ps]) => `${g}:${ps.map((p) => p.id).join('+')}`), ['Publishers:p1+p3', 'CLMS:p2', 'VISITORS:v1']);
});

test('filters: all, not marked, Kingdom Hall, Zoom', () => {
  const ids = (filter, q = '') => people.filter((p) => visible(p, marks, q, filter)).map((p) => p.id);
  assert.deepEqual(ids('all'), ['p1', 'p2', 'p3', 'v1']);
  assert.deepEqual(ids('none'), ['p2', 'p3']);
  assert.deepEqual(ids('kh'), ['p1']);
  assert.deepEqual(ids('zoom'), ['v1']);
});

test('search ignores case and spaces at the ends', () => {
  assert.deepEqual(people.filter((p) => visible(p, marks, '  REYES ', 'all')).map((p) => p.id), ['p3']);
  assert.deepEqual(people.filter((p) => visible(p, marks, 'santos', 'none')).map((p) => p.id), []);
});

test('counts how many on a list are marked', () => {
  assert.equal(countMarked(people, marks), 2);
  assert.equal(countMarked(people.slice(1, 3), marks), 0);
});

test('sidebar: phones and other computers get Home, Mark and History only', () => {
  const s = sidebar({ av: false, named: true, count: 26, route: 'mark' });
  assert.deepEqual(s.items.map((i) => i.to), ['home', 'mark', 'history']);
  assert.equal(s.items.find((i) => i.current).to, 'mark');
  assert.equal(s.addList, false);
  assert.equal(s.noListBanner, false);
  assert.equal(s.pin, false);
});

test('sidebar: the AV computer with a list gets the AV section and a list count badge', () => {
  const s = sidebar({ av: true, named: true, count: 26, route: 'settings' });
  assert.deepEqual(s.items.map((i) => i.to), ['home', 'mark', 'history', 'desk', 'list', 'settings']);
  assert.deepEqual(s.items.filter((i) => i.av).map((i) => i.to), ['desk', 'list', 'settings']);
  assert.equal(s.items.find((i) => i.to === 'list').badge, 26);
  assert.equal(s.items.find((i) => i.current).to, 'settings');
  assert.equal(s.addList, false);
  assert.equal(s.noListBanner, false);
  assert.equal(s.pin, true);
});

test('sidebar: with no list, the AV computer sees "Add publisher list" and a banner on every page but the upload', () => {
  const s = sidebar({ av: true, named: false, count: 0, route: 'home' });
  assert.equal(s.addList, true);
  assert.equal(s.noListBanner, true);
  const list = s.items.find((i) => i.to === 'list');
  assert.equal(list.badge, null);
  assert.equal(list.go, 'setup');
  assert.equal(sidebar({ av: true, named: false, count: 0, route: 'setup' }).noListBanner, false);
  assert.equal(sidebar({ av: true, named: false, count: 0, route: 'setup' }).items.find((i) => i.current).to, 'list');
  assert.equal(sidebar({ av: true, named: true, count: 3, route: 'setup' }).items.find((i) => i.current).to, 'list');
});
