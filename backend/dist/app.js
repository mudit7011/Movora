"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const env_1 = require("./config/env");
const routes_1 = require("./routes");
const rateLimiter_1 = require("./middleware/rateLimiter");
function createApp() {
    const app = (0, express_1.default)();
    app.set('trust proxy', 1);
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({
        origin: env_1.env.FRONTEND_URL,
        credentials: true,
    }));
    app.use(express_1.default.json());
    app.use((0, cookie_parser_1.default)());
    app.use(rateLimiter_1.publicRateLimiter);
    app.use('/api', routes_1.routes);
    return app;
}
