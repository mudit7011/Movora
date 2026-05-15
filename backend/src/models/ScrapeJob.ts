import { Schema, model, Document } from 'mongoose'

export interface IScrapeJob extends Omit<Document, 'errors'> {
  site: string
  status: 'running' | 'completed' | 'failed'
  moviesFound: number
  errors: string[]
  startedAt: Date
  completedAt?: Date
}

const scrapeJobSchema = new Schema<IScrapeJob>(
  {
    site: { type: String, required: true },
    status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
    moviesFound: { type: Number, default: 0 },
    errors: [String],
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
  },
  { suppressReservedKeysWarning: true }
)

export const ScrapeJob = model<IScrapeJob>('ScrapeJob', scrapeJobSchema)
