'use strict';

// The Google Cloud OAuth client this app signs in with (a "Desktop app" client).
// The real values are not kept in git. They come from, in order:
//   1. KA_GOOGLE_CLIENT_ID / KA_GOOGLE_CLIENT_SECRET in the environment,
//   2. src/core/google/config.local.js (git-ignored; the release workflow writes it from GitHub secrets).
// For a desktop app the "secret" is not confidential (Google documents this), but Google's token endpoint still asks for it,
// and it is still kept out of the repository.

let local = {};
try {
  local = require('./config.local');
} catch { /* no local file: Connect Google stays disabled until one is provided */ }

module.exports = {
  clientId: process.env.KA_GOOGLE_CLIENT_ID || local.clientId || 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  clientSecret: process.env.KA_GOOGLE_CLIENT_SECRET || local.clientSecret || 'YOUR_CLIENT_SECRET',
};
