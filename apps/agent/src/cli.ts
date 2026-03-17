#!/usr/bin/env node

import { Command } from 'commander';
import { randomUUID } from 'crypto';
import { Agent } from './index.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

const program = new Command();
const CONFIG_PATH = join(homedir(), '.caribbean', 'agent.json');

program
  .name('caribbean-agent')
  .description('Caribbean Agent - Node monitoring and management')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize agent configuration')
  .option('--server <url>', 'Server WebSocket URL', 'ws://localhost:8080/ws/agent')
  .option('--name <name>', 'Node name', `node-${randomUUID().slice(0, 8)}`)
  .option('--token <token>', 'Authentication token')
  .action((options) => {
    const configDir = join(homedir(), '.caribbean');
    const config = {
      server: {
        url: options.server,
        reconnectInterval: 5000,
        heartbeatInterval: 30000
      },
      node: {
        id: randomUUID(),
        name: options.name,
        tags: []
      },
      openclaw: {
        configPath: join(homedir(), '.openclaw', 'config.yaml'),
        apiPort: 8080
      },
      auth: {
        token: options.token || ''
      }
    };

    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
      process.stdout.write(`Creating config directory: ${configDir}\n`);
    }

    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`\n✓ Agent configuration created at ${CONFIG_PATH}`);
    console.log(`\nNode ID: ${config.node.id}`);
    console.log(`Node Name: ${config.node.name}`);
    console.log(`\nNext steps:`);
    console.log(`  caribbean-agent start`);
  });

program
  .command('start')
  .description('Start the agent')
  .option('--server <url>', 'Override server URL')
  .option('--config <path>', 'Config file path', CONFIG_PATH)
  .action(async (options) => {
    let config;

    if (options.server) {
      config = {
        server: { url: options.server },
        node: {
          id: randomUUID(),
          name: `node-${randomUUID().slice(0, 8)}`,
          tags: []
        }
      };
    } else {
      try {
        const configContent = readFileSync(options.config, 'utf-8');
        config = JSON.parse(configContent);
      } catch (error) {
        console.error(`Failed to read config file: ${options.config}`);
        console.error('Run `caribbean-agent init` first.');
        process.exit(1);
      }
    }

    const agent = new Agent(config);
    await agent.start();

    process.on('SIGINT', () => {
      console.log('\n[Agent] Shutting down...');
      agent.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n[Agent] Shutting down...');
      agent.stop();
      process.exit(0);
    });
  });

program
  .command('status')
  .description('Show agent status')
  .option('--config <path>', 'Config file path', CONFIG_PATH)
  .action((options) => {
    try {
      const configContent = readFileSync(options.config, 'utf-8');
      const config = JSON.parse(configContent);
      
      console.log('\nAgent Status:');
      console.log(`  Node ID: ${config.node.id}`);
      console.log(`  Node Name: ${config.node.name}`);
      console.log(`  Server: ${config.server.url}`);
      console.log(`  Tags: ${config.node.tags?.join(', ') || 'none'}`);
    } catch (error) {
      console.error(`Failed to read config file: ${options.config}`);
      process.exit(1);
    }
  });

program.parse();
