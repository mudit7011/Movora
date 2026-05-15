import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import { Admin } from '../src/models/Admin'
import { env } from '../src/config/env'

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    console.error('Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpass npx ts-node scripts/seed-admin.ts')
    process.exit(1)
  }

  await mongoose.connect(env.MONGODB_URI)

  const existing = await Admin.findOne({ email: email.toLowerCase() })
  if (existing) {
    console.log(`Admin already exists: ${email}`)
    await mongoose.disconnect()
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await Admin.create({ email: email.toLowerCase(), passwordHash, role: 'superadmin' })
  console.log(`✅ Admin created: ${email}`)
  await mongoose.disconnect()
}

seedAdmin().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
