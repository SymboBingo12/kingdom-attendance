'use strict';

const { Bonjour } = require('bonjour-service');

const RECHECK_MS = 10 * 1000;

// bonjour-service would announce every address the PC has, read once at start. Keep only the
// current hall address: an old one (a hotspot used earlier) or IPv6 makes phones hang.
const onlyAddress = (records, address) => records.filter((r) => r.type !== 'AAAA' && (r.type !== 'A' || r.data === address));

// Announces "<hostname>.local" on the hall network so phones can open http://attendance.local:4590
// instead of an IP address. When the PC moves to another network it is announced again with
// the new address. Failures are reported to onError and never crash the app.
function advertise({ hostname, port, getAddress, name = 'Kingdom Attendance', onError = () => {} }) {
  const bonjour = new Bonjour({}, onError);
  let address = null;

  function publish() {
    address = getAddress();
    if (!address) return;
    try {
      const service = bonjour.publish({ name, type: 'http', port, host: `${hostname}.local`, disableIPv6: true });
      const all = service.records.bind(service);
      const announced = address;
      service.records = () => onlyAddress(all(), announced);
    } catch (err) {
      onError(err);
    }
  }

  const unpublish = () => new Promise((resolve) => {
    try { bonjour.unpublishAll(() => resolve()); } catch { resolve(); }
  });

  publish();
  let busy = false;
  const timer = setInterval(async () => {
    if (busy || getAddress() === address) return;
    busy = true;
    await unpublish();
    publish();
    busy = false;
  }, RECHECK_MS);
  timer.unref();

  return {
    hostname: `${hostname}.local`,
    stop: async () => {
      clearInterval(timer);
      await unpublish();
      try { bonjour.destroy(); } catch { /* already closed */ }
    },
  };
}

module.exports = { advertise, onlyAddress };
