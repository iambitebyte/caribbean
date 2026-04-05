#!/usr/bin/env node

import { Command } from 'commander';
import { CaribbeanServer } from './index.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import {
  readPid,
  writePid,
  removePid,
  processExists,
  spawnDaemon,
  stopDaemon,
} from '@openclaw-caribbean/shared';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');
const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_WEB_DIST_PATH = join(__dirname, 'web');

const program = new Command();
const CONFIG_PATH = join(homedir(), '.caribbean', 'server.json');
const PID_PATH = join(homedir(), '.caribbean', 'server.pid');
const LOG_PATH = join(homedir(), '.caribbean', 'server.log');

program
  .name('caribbean-server')
  .description('Caribbean Server - Cluster management hub')
  .version(version);

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
        webDistPath: DEFAULT_WEB_DIST_PATH
      },
      database: {
        type: 'sqlite',
        path: join(homedir(), '.caribbean', 'data', 'caribbean.db')
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
  .option('--foreground', 'Run in foreground')
  .action(async (options) => {
    const configPath = options.config;

    if (!options.foreground) {
      const existingPid = readPid(PID_PATH);
      if (existingPid && processExists(existingPid)) {
        console.error(`Server is already running (PID: ${existingPid})`);
        console.error('Use `caribbean-server stop` to stop it first.');
        process.exit(1);
      }
      if (existingPid) removePid(PID_PATH);

      const args = [process.argv[1], 'start', '--foreground'];
      if (configPath !== CONFIG_PATH) args.push('--config', configPath);
      if (options.port) args.push('--port', options.port);

      const pid = spawnDaemon({
        pidPath: PID_PATH,
        logPath: LOG_PATH,
        spawnArgs: args,
      });

      console.log(`Server started in background (PID: ${pid})`);
      console.log(`Log file: ${LOG_PATH}`);
      return;
    }

    let config;
    try {
      const configContent = readFileSync(configPath, 'utf-8');
      config = JSON.parse(configContent);
    } catch (error) {
      console.error(`Failed to read config file: ${configPath}`);
      console.error('Run `caribbean-server init` first.');
      process.exit(1);
    }

    if (options.port) {
      config.websocket.port = parseInt(options.port, 10);
    }

    const server = new CaribbeanServer(config);
    await server.start();

    process.on('SIGINT', () => {
      console.log('\n[Server] Shutting down...');
      server.stop();
      removePid(PID_PATH);
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n[Server] Shutting down...');
      server.stop();
      removePid(PID_PATH);
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

      const pid = readPid(PID_PATH);
      const running = pid !== null && processExists(pid);

      console.log('\nServer Status:');
      console.log(`  Running: ${running ? `Yes (PID: ${pid})` : 'No'}`);
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
    await stopDaemon(PID_PATH, 'Server');
  });

program
  .command('restart')
  .description('Restart the server')
  .option('--config <path>', 'Config file path', CONFIG_PATH)
  .option('--port <number>', 'Override WebSocket port')
  .action(async (options) => {
    await stopDaemon(PID_PATH, 'Server');

    const configPath = options.config;
    const args = [process.argv[1], 'start', '--foreground'];
    if (configPath !== CONFIG_PATH) args.push('--config', configPath);
    if (options.port) args.push('--port', options.port);

    const pid = spawnDaemon({
      pidPath: PID_PATH,
      logPath: LOG_PATH,
      spawnArgs: args,
    });

    console.log(`Server restarted in background (PID: ${pid})`);
    console.log(`Log file: ${LOG_PATH}`);
  });

program
  .command('logs')
  .description('Show server logs')
  .option('--lines <number>', 'Number of lines to show', '50')
  .action((options) => {
    if (!existsSync(LOG_PATH)) {
      console.log('No log file found');
      return;
    }
    const content = readFileSync(LOG_PATH, 'utf-8');
    const n = parseInt(options.lines, 10);
    const lines = content.split('\n').slice(-n);
    console.log(lines.join('\n'));
  });

program.parse();
