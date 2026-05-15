import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

let mongoServer: MongoMemoryServer

export async function setupTestDB(): Promise<void> {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
}

export async function teardownTestDB(): Promise<void> {
  await mongoose.disconnect()
  await mongoServer.stop()
}

export async function clearTestDB(): Promise<void> {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }
}
