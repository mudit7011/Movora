import jwt from 'jsonwebtoken'

export function generateTestToken(adminId = 'test-admin-id-000000000000'): string {
  return jwt.sign(
    { adminId },
    process.env.JWT_SECRET ?? 'test-secret-minimum-32-characters-here!!',
    { expiresIn: '1h' }
  )
}
