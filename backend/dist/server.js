"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const connection_1 = require("./db/connection");
const env_1 = require("./config/env");
async function start() {
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
