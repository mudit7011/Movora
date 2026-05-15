import { Router } from 'express'
import { ScrapeJob } from '../../models/ScrapeJob'
import { authenticate } from '../../middleware/authenticate'

const router = Router()
router.use(authenticate)

router.post('/trigger', async (_req, res) => {
  try {
    const job = await ScrapeJob.create({ site: 'manual', status: 'running', startedAt: new Date() })
    res.status(202).json({ jobId: job._id, message: 'Scrape job queued' })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/jobs', async (_req, res) => {
  try {
    const jobs = await ScrapeJob.find().sort({ startedAt: -1 }).limit(20)
    res.json(jobs)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

export { router as adminScrapeRouter }
