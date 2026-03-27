#!/usr/bin/env node

import { Command } from 'commander';
import { CaribbeanServer } from './index.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

const program = new Command();
const CONFIG_PATH = join(homedir(), '.caribbean', 'server.json');
const PID_PATH = join(homedir(), '.caribbean', 'server.pid');

function writePid(pid: number): void {
  writeFileSync(PID_PATH, pid.toString());
}

function readPid(): number | null {
  if (!existsSync(PID_PATH)) return null;
  const pid = parseInt(readFileSync(PID_PATH, 'utf-8'), 10);
  return isNaN(pid) ? null : pid;
}

function removePid(): void {
  if (existsSync(PID_PATH)) {
    unlinkSync(PID_PATH);
  }
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function waitForProcessExit(pid: number, timeout: number): Promise<boolean> {
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

program
  .name('caribbean-server')
  .description('Caribbean Server - Cluster management hub')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize server configuration')
  .option('--port <number>', 'WebSocket port', '8080')
  .option('--token <token>', 'Authentication token')
  .action((options) => {
    const config = {
      websocket: {
        port: parseInt(options.port, 10),
        path: '/ws/agent',
        maxConnections: 1000
      },
      api: {
        port: 3000,
        host: '0.0.0.0',
        webDistPath: join(process.cwd(), 'dist/web')
      },
      database: {
        type: 'sqlite',
        path: './data/caribbean.db'
      },
      auth: {
        enabled: !!options.token,
        tokens: options.token ? [options.token] : [],
        user: undefined,
        jwtSecret: undefined
      }
    };

    const configDir = dirname(CONFIG_PATH);
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`\n✓ Server configuration created at ${CONFIG_PATH}`);
    console.log(`\nConfiguration:`);
    console.log(`  WebSocket Port: ${config.websocket.port}`);
    console.log(`  API Port: ${config.api.port}`);
    console.log(`  Web UI: http://localhost:${config.api.port}`);
    console.log(`  Auth Enabled: ${config.auth.enabled}`);
    console.log(`\nNext steps:`);
    console.log(`  caribbean-server start`);
  });

program
  .command('start')
  .description('Start the server')
  .option('--config <path>', 'Config file path', CONFIG_PATH)
  .option('--port <number>', 'Override WebSocket port')
  .action(async (options) => {
    let config;

    try {
      const configContent = readFileSync(options.config, 'utf-8');
      config = JSON.parse(configContent);
    } catch (error) {
      console.error(`Failed to read config file: ${options.config}`);
      console.error('Run `caribbean-server init` first.');
      process.exit(1);
    }

    if (options.port) {
      config.websocket.port = parseInt(options.port, 10);
    }

    const existingPid = readPid();
    if (existingPid && processExists(existingPid)) {
      console.error(`Server is already running (PID: ${existingPid})`);
      console.error('Use `caribbean-server stop` to stop it first.');
      process.exit(1);
    }

    if (existingPid) {
      removePid();
    }

    const server = new CaribbeanServer(config);

    await server.start();
    writePid(process.pid);

    process.on('SIGINT', () => {
      console.log('\n[Server] Shutting down...');
      server.stop();
      removePid();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n[Server] Shutting down...');
      server.stop();
      removePid();
      process.exit(0);
    });
  });

program
  .command('status')
  .description('Show server status')
  .option('--config <path>', 'Config file path', CONFIG_PATH)
  .action((options) => {
    try {
      const configContent = readFileSync(options.config, 'utf-8');
      const config = JSON.parse(configContent);

      console.log('\nServer Configuration:');
      console.log(`  WebSocket Port: ${config.websocket.port}`);
      console.log(`  WebSocket Path: ${config.websocket.path}`);
      console.log(`  Max Connections: ${config.websocket.maxConnections}`);
      console.log(`  API Port: ${config.api.port}`);
      console.log(`  Web UI: http://${config.api.host}:${config.api.port}`);
      console.log(`  Auth Enabled: ${config.auth.enabled}`);
      if (config.auth.user) {
        console.log(`  Username: ${config.auth.user.username}`);
        console.log(`  Password: ${'*'.repeat(config.auth.user.password.length)}`);
      }
    } catch (error) {
      console.error(`Failed to read config file: ${options.config}`);
      process.exit(1);
    }
  });

program
  .command('set-auth')
  .description('Set username and password for web UI authentication')
  .option('--config <path>', 'Config file path', CONFIG_PATH)
  .option('--username <username>', 'Username')
  .option('--password <password>', 'Password')
  .option('--disable', 'Disable authentication')
  .action((options) => {
    try {
      let configContent;
      try {
        configContent = readFileSync(options.config, 'utf-8');
      } catch (error) {
        console.error(`Failed to read config file: ${options.config}`);
        console.error('Run `caribbean-server init` first.');
        process.exit(1);
      }

      const config = JSON.parse(configContent);

      if (options.disable) {
        config.auth.enabled = false;
        config.auth.user = undefined;
        config.auth.jwtSecret = undefined;
      } else if (options.username && options.password) {
        config.auth.enabled = true;
        config.auth.user = {
          username: options.username,
          password: options.password
        };
        config.auth.jwtSecret = 'caribbean-jwt-secret-' + Date.now();
      } else {
        console.error('Error: Please provide --username and --password, or use --disable to remove authentication.');
        process.exit(1);
      }

      writeFileSync(options.config, JSON.stringify(config, null, 2));

      if (options.disable) {
        console.log('\n✓ Authentication disabled');
        console.log(`\nConfiguration updated at ${options.config}`);
      } else {
        console.log('\n✓ Authentication enabled');
        console.log(`  Username: ${options.username}`);
        console.log(`  Password: ${'*'.repeat(options.password.length)}`);
        console.log(`\nConfiguration updated at ${options.config}`);
      }

      console.log('\nNote: You may need to restart the server for changes to take effect.');
      console.log('Run: caribbean-server restart');
    } catch (error) {
      console.error('Failed to set authentication:', error);
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Stop the server')
  .action(async () => {
    const pid = readPid();

    if (!pid) {
      console.log('Server is not running (no PID file found)');
      return;
    }

    if (!processExists(pid)) {
      console.log('Server is not running (stale PID file)');
      removePid();
      return;
    }

    console.log(`Stopping server (PID: ${pid})...`);
    process.kill(pid, 'SIGTERM');

    const exited = await waitForProcessExit(pid, 10000);

    if (exited) {
      console.log('Server stopped gracefully');
    } else {
      console.log('Force stopping server...');
      process.kill(pid, 'SIGKILL');
      await waitForProcessExit(pid, 1000);
      console.log('Server stopped (forced)');
    }

    removePid();
  });

program
  .command('restart')
  .description('Restart the server')
  .option('--config <path>', 'Config file path', CONFIG_PATH)
  .action(async (options) => {
    const pid = readPid();

    if (pid && processExists(pid)) {
      console.log(`Stopping server (PID: ${pid})...`);
      process.kill(pid, 'SIGTERM');
      await waitForProcessExit(pid, 10000);

      if (processExists(pid)) {
        console.log('Force stopping server...');
        process.kill(pid, 'SIGKILL');
        await waitForProcessExit(pid, 1000);
      }

      removePid();
    }

    console.log('Starting server...');

    let config;
    try {
      const configContent = readFileSync(options.config, 'utf-8');
      config = JSON.parse(configContent);
    } catch (error) {
      console.error(`Failed to read config file: ${options.config}`);
      console.error('Run `caribbean-server init` first.');
      process.exit(1);
    }

    const server = new CaribbeanServer(config);
    await server.start();
    writePid(process.pid);

    process.on('SIGINT', () => {
      console.log('\n[Server] Shutting down...');
      server.stop();
      removePid();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n[Server] Shutting down...');
      server.stop();
      removePid();
      process.exit(0);
    });
  });

program.parse();
