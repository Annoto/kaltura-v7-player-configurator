// Entry point for the standalone executable build.
// Embeds the UI so the exe is fully self-contained (no external files needed).
global.__ANNOTO_HTML__ = require('./index_html.cjs');
require('../server.js');
