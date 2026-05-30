"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScrapeJob = void 0;
const mongoose_1 = require("mongoose");
const scrapeJobSchema = new mongoose_1.Schema({
    site: { type: String, required: true },
    label: { type: String, default: '' },
    status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
    added: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    addedTitles: [String],
    scrapeErrors: [String],
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
});
exports.ScrapeJob = (0, mongoose_1.model)('ScrapeJob', scrapeJobSchema);
