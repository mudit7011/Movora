"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const app_1 = require("./app");
const connection_1 = require("./db/connection");
const env_1 = require("./config/env");
function ensureChromium() {
    try {
        (0, child_process_1.execSync)('npx playwright install chromium', { stdio: 'inherit' });
    }
    catch (e) {
        console.warn('[Playwright] Browser install failed, scraper may not work:', e);
    }
}
async function start() {
    ensureChromium();
    await (0, connection_1.connectDB)();
    const app = (0, app_1.createApp)();
    app.listen(Number(env_1.env.PORT), () => {
        console.log(`Backend running on http://localhost:${env_1.env.PORT}`);
    });
}
start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
