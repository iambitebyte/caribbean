import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writePid, readPid, removePid, processExists } from '../daemon.js'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'caribbean-test-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('writePid / readPid / removePid', () => {
  it('writes and reads a PID', () => {
    const pidPath = join(tmpDir, 'test.pid')
    writePid(pidPath, 12345)
    expect(readPid(pidPath)).toBe(12345)
  })

  it('creates parent directory if missing', () => {
    const pidPath = join(tmpDir, 'nested', 'dir', 'test.pid')
    writePid(pidPath, 99999)
    expect(readPid(pidPath)).toBe(99999)
  })

  it('returns null for missing file', () => {
    const pidPath = join(tmpDir, 'missing.pid')
    expect(readPid(pidPath)).toBeNull()
  })

  it('returns null for invalid content', () => {
    const pidPath = join(tmpDir, 'bad.pid')
    writeFileSync(pidPath, 'not-a-number')
    expect(readPid(pidPath)).toBeNull()
  })

  it('removes PID file', () => {
    const pidPath = join(tmpDir, 'remove.pid')
    writePid(pidPath, 1)
    removePid(pidPath)
    expect(readPid(pidPath)).toBeNull()
  })

  it('removePid is a no-op for missing file', () => {
    const pidPath = join(tmpDir, 'missing.pid')
    expect(() => removePid(pidPath)).not.toThrow()
  })
})

describe('processExists', () => {
  it('returns true for current process', () => {
    expect(processExists(process.pid)).toBe(true)
  })

  it('returns false for an impossible PID', () => {
    expect(processExists(999999999)).toBe(false)
  })
})
