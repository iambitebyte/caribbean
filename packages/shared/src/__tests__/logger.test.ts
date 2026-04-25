import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Logger, createLogger, setDebugMode, isDebugMode } from '../logger.js'

describe('Logger', () => {
  beforeEach(() => {
    setDebugMode(false)
    vi.restoreAllMocks()
  })

  describe('setDebugMode / isDebugMode', () => {
    it('defaults to false', () => {
      expect(isDebugMode()).toBe(false)
    })

    it('can be enabled and disabled', () => {
      setDebugMode(true)
      expect(isDebugMode()).toBe(true)
      setDebugMode(false)
      expect(isDebugMode()).toBe(false)
    })
  })

  describe('info', () => {
    it('logs with prefix', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const logger = new Logger('Test')
      logger.info('hello')
      expect(spy).toHaveBeenCalledWith('[Test] hello')
    })
  })

  describe('warn', () => {
    it('logs warning with prefix', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const logger = new Logger('Test')
      logger.warn('careful')
      expect(spy).toHaveBeenCalledWith('[Test] careful')
    })
  })

  describe('error', () => {
    it('logs error with prefix', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const logger = new Logger('Test')
      logger.error('oops')
      expect(spy).toHaveBeenCalledWith('[Test] oops')
    })
  })

  describe('startup', () => {
    it('logs with prefix', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const logger = new Logger('Test')
      logger.startup('ready')
      expect(spy).toHaveBeenCalledWith('[Test] ready')
    })
  })

  describe('debug', () => {
    it('does not log when debug mode is off', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const logger = new Logger('Test')
      logger.debug('hidden')
      expect(spy).not.toHaveBeenCalled()
    })

    it('logs when debug mode is on', () => {
      setDebugMode(true)
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const logger = new Logger('Test')
      logger.debug('visible')
      expect(spy).toHaveBeenCalledWith('[Test] [DEBUG] visible')
    })
  })

  describe('createLogger', () => {
    it('creates a Logger instance', () => {
      const logger = createLogger('Factory')
      expect(logger).toBeInstanceOf(Logger)
    })
  })
})
