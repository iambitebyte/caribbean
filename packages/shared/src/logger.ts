let debugMode = false;

export function setDebugMode(debug: boolean) {
  debugMode = debug;
}

export function isDebugMode(): boolean {
  return debugMode;
}

export class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  debug(message: string, ...args: any[]) {
    if (debugMode) {
      console.log(`[${this.prefix}] [DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    console.log(`[${this.prefix}] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(`[${this.prefix}] ${message}`, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(`[${this.prefix}] ${message}`, ...args);
  }

  startup(message: string, ...args: any[]) {
    console.log(`[${this.prefix}] ${message}`, ...args);
  }
}

export function createLogger(prefix: string): Logger {
  return new Logger(prefix);
}
