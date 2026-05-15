describe('env config', () => {
  it('throws when MONGODB_URI is missing', () => {
    const original = process.env.MONGODB_URI
    try {
      delete process.env.MONGODB_URI
      jest.resetModules()
      expect(() => require('../src/config/env')).toThrow()
    } finally {
      if (original !== undefined) process.env.MONGODB_URI = original
    }
  })
})
