import { Schema, model } from 'mongoose'

const schema = new Schema({
  tmdbId:    { type: String, required: true, unique: true },
  blockedAt: { type: Date, default: Date.now },
})

export const BlockedContent = model('BlockedContent', schema)
