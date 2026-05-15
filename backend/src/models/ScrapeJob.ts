import { Schema, model, Document } from 'mongoose'

export interface IScrapeJob extends Document {
  site: string
  status: 'running' | 'completed' | 'failed'
  moviesFound: number
  scrapeErrors: string[]
  startedAt: Date
  completedAt?: Date
}

const scrapeJobSchema = new Schema<IScrapeJob>({
  site: { type: String, required: true },
  status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
  moviesFound: { type: Number, default: 0 },
  scrapeErrors: [String],
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
})

export const ScrapeJob = model<IScrapeJob>('ScrapeJob', scrapeJobSchema)
