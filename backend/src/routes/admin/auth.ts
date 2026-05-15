import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { Admin } from '../../models/Admin'
import { env } from '../../config/env'
import { loginRateLimiter } from '../../middleware/rateLimiter'

const router = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

router.post('/login', loginRateLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  const { email, password } = parsed.data
  const admin = await Admin.findOne({ email: email.toLowerCase() })
  if (!admin) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const valid = await bcrypt.compare(password, admin.passwordHash)
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const token = jwt.sign({ adminId: admin._id.toString() }, env.JWT_SECRET, { expiresIn: '24h' })

  res.cookie('token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
  })

  res.json({ message: 'Logged in' })
})

router.post('/logout', (_req, res) => {
  res.clearCookie('token')
  res.json({ message: 'Logged out' })
})

export { router as adminAuthRouter }
