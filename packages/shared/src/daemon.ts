import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, openSync } from 'fs';
import { dirname } from 'path';

export function writePid(pidPath: string, pid: number): void {
  const dir = dirname(pidPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(pidPath, pid.toString());
}

export function readPid(pidPath: string): number | null {
  if (!existsSync(pidPath)) return null;
  const pid = parseInt(readFileSync(pidPath, 'utf-8'), 10);
  return isNaN(pid) ? null : pid;
}

export function removePid(pidPath: string): void {
  if (existsSync(pidPath)) {
    unlinkSync(pidPath);
  }
}

export function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function waitForProcessExit(pid: number, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (!processExists(pid)) {
        clearInterval(interval);
        resolve(true);
      }
      if (Date.now() - start > timeout) {
        clearInterval(interval);
        resolve(false);
      }
    }, 100);
  });
}

export interface SpawnDaemonOptions {
  pidPath: string;
  logPath: string;
  spawnArgs: string[];
}

export function spawnDaemon(options: SpawnDaemonOptions): number {
  const dir = dirname(options.logPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const logFile = openSync(options.logPath, 'a');

  const child = spawn(process.execPath, options.spawnArgs, {
    detached: true,
    stdio: ['ignore', logFile, logFile],
  });

  child.unref();

  writePid(options.pidPath, child.pid!);

  return child.pid!;
}

export async function stopDaemon(pidPath: string, name: string): Promise<void> {
  const pid = readPid(pidPath);

  if (!pid) {
    console.log(`${name} is not running (no PID file found)`);
    return;
  }

  if (!processExists(pid)) {
    console.log(`${name} is not running (stale PID file)`);
    removePid(pidPath);
    return;
  }

  console.log(`Stopping ${name} (PID: ${pid})...`);
  process.kill(pid, 'SIGTERM');

  const exited = await waitForProcessExit(pid, 10000);

  if (exited) {
    console.log(`${name} stopped gracefully`);
  } else {
    console.log(`Force stopping ${name}...`);
    process.kill(pid, 'SIGKILL');
    await waitForProcessExit(pid, 1000);
    console.log(`${name} stopped (forced)`);
  }

  removePid(pidPath);
}
