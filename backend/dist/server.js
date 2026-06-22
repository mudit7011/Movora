"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const connection_1 = require("./db/connection");
const env_1 = require("./config/env");
const Movie_1 = require("./models/Movie");
async function start() {
    await (0, connection_1.connectDB)();
    const app = (0, app_1.createApp)();
    app.listen(Number(env_1.env.PORT), () => {
        console.log(`Backend running on http://localhost:${env_1.env.PORT}`);
    });
    // Force-build DB indexes (browse-query perf). Runs in background so startup
    // isn't blocked; logs the result to Render so we can confirm they built.
    console.log('[indexes] syncing…');
    Movie_1.Movie.syncIndexes()
        .then(() => console.log('[indexes] synced OK'))
        .catch((e) => console.error('[indexes] sync FAILED:', e));
}
start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
