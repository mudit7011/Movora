import mongoose from 'mongoose'
import { env } from '../config/env'

export async function connectDB(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI)
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect()
}
