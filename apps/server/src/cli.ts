#!/usr/bin/env node

import { Command } from 'commander';
import { CaribbeanServer } from './index.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

const program = new Command();
const CONFIG_PATH = join(homedir(), '.caribbean', 'server.json');

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
        host: '0.0.0.0'
      },
      web: {
        port: 3000,
        title: 'Caribbean Dashboard'
      },
      database: {
        type: 'sqlite',
        path: './data/caribbean.db'
      },
      auth: {
        enabled: !!options.token,
        tokens: options.token ? [options.token] : []
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
    console.log(`  Web Port: ${config.web.port}`);
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

    const server = new CaribbeanServer(config);
    
    await server.start();

    process.on('SIGINT', () => {
      console.log('\n[Server] Shutting down...');
      server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n[Server] Shutting down...');
      server.stop();
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
      console.log(`  Web Port: ${config.web.port}`);
      console.log(`  Auth Enabled: ${config.auth.enabled}`);
    } catch (error) {
      console.error(`Failed to read config file: ${options.config}`);
      process.exit(1);
    }
  });

program.parse();
