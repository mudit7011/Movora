describe('env config', () => {
  it('throws when MONGODB_URI is missing', () => {
    const original = process.env.MONGODB_URI
    delete process.env.MONGODB_URI
    jest.resetModules()
    expect(() => require('../src/config/env')).toThrow()
    if (original !== undefined) process.env.MONGODB_URI = original
  })
})
