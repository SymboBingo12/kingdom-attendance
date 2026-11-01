'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi, newTapId } = require('../web/shared/api');

function stubFetch(responder) {
  const calls = [];
  global.fetch = async (url, opts = {}) => {
    calls.push({ url, opts });
    return responder(url, opts);
  };
  return calls;
}

const json = (status, body) => ({ ok: status < 400, status, json: async () => body });

test('post sends the PIN and returns the new state', async () => {
  const calls = stubFetch(() => json(200, { totals: { hall: 1 } }));
  const api = createApi({ getPin: () => '4821' });
  const state = await api.post('/api/tap', { lane: 'left', delta: 1 });
  assert.equal(state.totals.hall, 1);
  assert.equal(calls[0].opts.method, 'POST');
  assert.equal(calls[0].opts.headers['x-pin'], '4821');
  assert.deepEqual(JSON.parse(calls[0].opts.body), { lane: 'left', delta: 1 });
});

test('a 401 asks for the PIN and rejects', async () => {
  stubFetch(() => json(401, { error: 'Wrong PIN' }));
  let asked = 0;
  const api = createApi({ getPin: () => '', onPinNeeded: () => { asked++; } });
  await assert.rejects(api.post('/api/tap', {}), { status: 401, message: 'Wrong PIN' });
  assert.equal(asked, 1);
});

test('a network error rejects without trying again (no silent double taps)', async () => {
  const calls = stubFetch(() => { throw new TypeError('Failed to fetch'); });
  const api = createApi({ getPin: () => '1' });
  await assert.rejects(api.post('/api/tap', {}), { status: 0, message: 'No connection to the AV computer.' });
  assert.equal(calls.length, 1);
});

test('server errors come back with their message', async () => {
  stubFetch(() => json(409, { error: 'Attendance is finalized. Unlock to change it.' }));
  const api = createApi({ getPin: () => '1' });
  await assert.rejects(api.post('/api/tap', {}), { status: 409, message: 'Attendance is finalized. Unlock to change it.' });
});

test('tap ids are unique', () => {
  const ids = new Set(Array.from({ length: 1000 }, newTapId));
  assert.equal(ids.size, 1000);
});
