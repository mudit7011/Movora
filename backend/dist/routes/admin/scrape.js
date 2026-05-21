"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminScrapeRouter = void 0;
const express_1 = require("express");
const ScrapeJob_1 = require("../../models/ScrapeJob");
const authenticate_1 = require("../../middleware/authenticate");
const router = (0, express_1.Router)();
exports.adminScrapeRouter = router;
router.use(authenticate_1.authenticate);
router.post('/trigger', async (_req, res) => {
    try {
        const job = await ScrapeJob_1.ScrapeJob.create({ site: 'manual', status: 'running', startedAt: new Date() });
        res.status(202).json({ jobId: job._id, message: 'Scrape job queued' });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/jobs', async (_req, res) => {
    try {
        const jobs = await ScrapeJob_1.ScrapeJob.find().sort({ startedAt: -1 }).limit(20);
        res.json(jobs);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
