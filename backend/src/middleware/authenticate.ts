import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export interface AuthRequest extends Request {
  adminId?: string
  cookies: Record<string, string>
  headers: Record<string, string | string[] | undefined> & { authorization?: string }
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const token: string | undefined =
    req.cookies?.token ?? (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined)

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { adminId: string }
    req.adminId = payload.adminId
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
