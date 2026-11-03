'use strict';

// The Google Cloud OAuth client this app signs in with (a "Desktop app" client). The values below are
// placeholders until the project owner creates the client; KA_GOOGLE_CLIENT_ID / KA_GOOGLE_CLIENT_SECRET override them.
// For a desktop app the "secret" is not confidential (Google documents this), but Google's token endpoint still asks for it.

module.exports = {
  clientId: process.env.KA_GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  clientSecret: process.env.KA_GOOGLE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
};
