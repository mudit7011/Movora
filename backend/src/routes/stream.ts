import { Router } from 'express'

export const streamRouter = Router()

streamRouter.get('/', (_req, res) => {
  res.status(404).json({ error: 'Stream not found' })
})

streamRouter.delete('/cache', (_req, res) => {
  res.json({ ok: true })
})
