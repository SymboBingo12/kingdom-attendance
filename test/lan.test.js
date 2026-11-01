'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { pickLanAddress } = require('../src/core/server');

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
