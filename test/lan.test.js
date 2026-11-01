'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { pickLanAddress, buildUrls } = require('../src/core/server');
const { onlyAddress } = require('../src/core/mdns');

const v4 = (address, internal = false) => ({ family: 'IPv4', address, internal });

test('the phone link uses the Wi-Fi address, not a Windows "no network" 169.254 address', () => {
  const ifaces = {
    'Ethernet 2': [v4('169.254.83.107')],
    Loopback: [v4('127.0.0.1', true)],
    'Wi-Fi': [{ family: 'IPv6', address: 'fe80::1', internal: false }, v4('192.168.1.23')],
  };
  assert.equal(pickLanAddress(ifaces), '192.168.1.23');
});

test('with no usable network there is no IP link', () => {
  assert.equal(pickLanAddress({ Ethernet: [v4('169.254.1.2')], Loopback: [v4('127.0.0.1', true)] }), null);
});

// Many Android phones can't open ".local" names at all, so the QR code and the links people
// are given use the IP address; attendance.local is only offered as a short name.
test('the one link uses the IP address, with attendance.local as the short name', () => {
  const u = buildUrls({ port: 4590, ip: '192.168.1.23', hostname: 'attendance.local' });
  assert.equal(u.count, 'http://192.168.1.23:4590/');
  assert.equal(u.named, 'http://attendance.local:4590/');
  assert.equal(u.dock, 'http://localhost:4590/desk');
});

test('with no network the links fall back to the short name, then to this computer', () => {
  assert.equal(buildUrls({ port: 4590, ip: null, hostname: 'attendance.local' }).count, 'http://attendance.local:4590/');
  assert.equal(buildUrls({ port: 80, ip: null, hostname: null }).count, 'http://localhost/');
});

// The name must point at the address the PC has now, never an old network's (a hotspot used
// earlier) or an IPv6 address the server doesn't listen on.
test('attendance.local is announced with only the current IPv4 address', () => {
  const records = [
    { type: 'SRV', name: 'x', data: {} },
    { type: 'A', name: 'attendance.local', data: '172.20.10.7' },
    { type: 'A', name: 'attendance.local', data: '192.168.1.23' },
    { type: 'AAAA', name: 'attendance.local', data: 'fe80::1' },
  ];
  assert.deepEqual(onlyAddress(records, '192.168.1.23').map((r) => r.type + ' ' + (r.type === 'A' ? r.data : '')), ['SRV ', 'A 192.168.1.23']);
  assert.deepEqual(onlyAddress(records, null).map((r) => r.type), ['SRV']);
});
