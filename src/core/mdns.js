'use strict';

const { Bonjour } = require('bonjour-service');

// Announces "<hostname>.local" on the hall network so phones can open http://attendance.local:4590
// instead of an IP address. Failures are reported to onError and never crash the app.
function advertise({ hostname, port, onError = () => {} }) {
  const bonjour = new Bonjour({}, onError);
  try {
    bonjour.publish({ name: 'Kingdom Attendance', type: 'http', port, host: `${hostname}.local` });
  } catch (err) {
    onError(err);
  }
  return {
    hostname: `${hostname}.local`,
    stop: () => new Promise((resolve) => {
      try {
        bonjour.unpublishAll(() => {
          bonjour.destroy();
          resolve();
        });
      } catch {
        resolve();
      }
    }),
  };
}

module.exports = { advertise };
