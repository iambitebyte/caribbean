#!/usr/bin/env node

import { Command } from 'commander';
import { randomUUID } from 'crypto';
import { Agent } from './index.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

const program = new Command();
const CONFIG_PATH = join(homedir(), '.caribbean', 'agent.json');
const PID_PATH = join(homedir(), '.caribbean', 'agent.pid');

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

    const existingPid = readPid();
    if (existingPid && processExists(existingPid)) {
      console.error(`Agent is already running (PID: ${existingPid})`);
      console.error('Use `caribbean-agent stop` to stop it first.');
      process.exit(1);
    }

    if (existingPid) {
      removePid();
    }

    const agent = new Agent(config);
    await agent.start();
    writePid(process.pid);

    process.on('SIGINT', () => {
      console.log('\n[Agent] Shutting down...');
      agent.stop();
      removePid();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n[Agent] Shutting down...');
      agent.stop();
      removePid();
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

program
  .command('stop')
  .description('Stop the agent')
  .action(async () => {
    const pid = readPid();

    if (!pid) {
      console.log('Agent is not running (no PID file found)');
      return;
    }

    if (!processExists(pid)) {
      console.log('Agent is not running (stale PID file)');
      removePid();
      return;
    }

    console.log(`Stopping agent (PID: ${pid})...`);
    process.kill(pid, 'SIGTERM');

    const exited = await waitForProcessExit(pid, 10000);

    if (exited) {
      console.log('Agent stopped gracefully');
    } else {
      console.log('Force stopping agent...');
      process.kill(pid, 'SIGKILL');
      await waitForProcessExit(pid, 1000);
      console.log('Agent stopped (forced)');
    }

    removePid();
  });

program
  .command('restart')
  .description('Restart the agent')
  .option('--config <path>', 'Config file path', CONFIG_PATH)
  .action(async (options) => {
    const pid = readPid();

    if (pid && processExists(pid)) {
      console.log(`Stopping agent (PID: ${pid})...`);
      process.kill(pid, 'SIGTERM');
      await waitForProcessExit(pid, 10000);

      if (processExists(pid)) {
        console.log('Force stopping agent...');
        process.kill(pid, 'SIGKILL');
        await waitForProcessExit(pid, 1000);
      }

      removePid();
    }

    console.log('Starting agent...');

    let config;

    try {
      const configContent = readFileSync(options.config, 'utf-8');
      config = JSON.parse(configContent);
    } catch (error) {
      console.error(`Failed to read config file: ${options.config}`);
      console.error('Run `caribbean-agent init` first.');
      process.exit(1);
    }

    const agent = new Agent(config);
    await agent.start();
    writePid(process.pid);

    process.on('SIGINT', () => {
      console.log('\n[Agent] Shutting down...');
      agent.stop();
      removePid();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n[Agent] Shutting down...');
      agent.stop();
      removePid();
      process.exit(0);
    });
  });

program.parse();
