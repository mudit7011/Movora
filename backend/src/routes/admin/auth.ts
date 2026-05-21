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

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
}

router.post('/login', loginRateLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  try {
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

    res.cookie('token', token, { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 })
    res.json({ message: 'Logged in', token })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/logout', (_req, res) => {
  res.clearCookie('token', cookieOptions)
  res.json({ message: 'Logged out' })
})

export { router as adminAuthRouter }
