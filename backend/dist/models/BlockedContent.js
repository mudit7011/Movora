"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockedContent = void 0;
const mongoose_1 = require("mongoose");
const schema = new mongoose_1.Schema({
    tmdbId: { type: String, required: true, unique: true },
    blockedAt: { type: Date, default: Date.now },
});
exports.BlockedContent = (0, mongoose_1.model)('BlockedContent', schema);
