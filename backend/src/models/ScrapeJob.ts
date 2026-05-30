import { Schema, model, Document } from 'mongoose'

export interface IScrapeJob extends Document {
  site: string
  label: string
  status: 'running' | 'completed' | 'failed'
  added: number
  skipped: number
  addedTitles: string[]
  scrapeErrors: string[]
  startedAt: Date
  completedAt?: Date
}

const scrapeJobSchema = new Schema<IScrapeJob>({
  site:         { type: String, required: true },
  label:        { type: String, default: '' },
  status:       { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
  added:        { type: Number, default: 0 },
  skipped:      { type: Number, default: 0 },
  addedTitles:  [String],
  scrapeErrors: [String],
  startedAt:    { type: Date, default: Date.now },
  completedAt:  Date,
})

export const ScrapeJob = model<IScrapeJob>('ScrapeJob', scrapeJobSchema)
