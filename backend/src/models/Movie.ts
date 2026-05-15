import { Schema, model, Document } from 'mongoose'

interface Source {
  serverName: string
  url: string
  type: 'iframe' | 'direct'
  quality: string
  isWorking: boolean
  lastChecked: Date
}

interface CastMember {
  name: string
  character?: string
  photo?: string
}

export interface IMovie extends Document {
  tmdbId: string
  title: string
  titleHindi?: string
  slug: string
  type: 'movie'
  language: string[]
  genres: string[]
  releaseYear: number
  rating: number
  runtime: number
  synopsis: string
  posterUrl: string
  backdropUrl: string
  trailerKey?: string
  cast: CastMember[]
  sources: Source[]
  scrapedFrom: string
  createdAt: Date
  updatedAt: Date
}

const sourceSchema = new Schema<Source>({
  serverName: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, enum: ['iframe', 'direct'], required: true },
  quality: { type: String, default: 'HD' },
  isWorking: { type: Boolean, default: true },
  lastChecked: { type: Date, default: Date.now },
})

const movieSchema = new Schema<IMovie>(
  {
    tmdbId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    titleHindi: String,
    slug: { type: String, required: true, unique: true },
    type: { type: String, default: 'movie' },
    language: [String],
    genres: [String],
    releaseYear: Number,
    rating: Number,
    runtime: Number,
    synopsis: String,
    posterUrl: String,
    backdropUrl: String,
    trailerKey: String,
    cast: [{ name: String, character: String, photo: String }],
    sources: [sourceSchema],
    scrapedFrom: String,
  },
  { timestamps: true }
)

movieSchema.index({ title: 'text', synopsis: 'text' })
movieSchema.index({ genres: 1 })
movieSchema.index({ language: 1 })
movieSchema.index({ releaseYear: 1 })
movieSchema.index({ rating: -1 })

export const Movie = model<IMovie>('Movie', movieSchema)
