"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamRouter = void 0;
const express_1 = require("express");
exports.streamRouter = (0, express_1.Router)();
exports.streamRouter.get('/', (_req, res) => {
    res.status(404).json({ error: 'Stream not found' });
});
exports.streamRouter.delete('/cache', (_req, res) => {
    res.json({ ok: true });
});
