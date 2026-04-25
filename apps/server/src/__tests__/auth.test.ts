import { describe, it, expect } from 'vitest'
import { generateToken, verifyToken } from '../auth.js'

describe('auth', () => {
  describe('generateToken', () => {
    it('returns a string', () => {
      const token = generateToken({ username: 'admin' })
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })

    it('uses custom secret', () => {
      const token = generateToken({ username: 'admin' }, 'my-secret')
      expect(typeof token).toBe('string')
    })
  })

  describe('verifyToken', () => {
    it('returns payload for valid token', () => {
      const token = generateToken({ username: 'admin' }, 'test-secret')
      const payload = verifyToken(token, 'test-secret')
      expect(payload).not.toBeNull()
      expect(payload!.username).toBe('admin')
    })

    it('returns null for invalid token', () => {
      const payload = verifyToken('invalid-token', 'test-secret')
      expect(payload).toBeNull()
    })

    it('returns null for wrong secret', () => {
      const token = generateToken({ username: 'admin' }, 'secret-a')
      const payload = verifyToken(token, 'secret-b')
      expect(payload).toBeNull()
    })
  })
})
