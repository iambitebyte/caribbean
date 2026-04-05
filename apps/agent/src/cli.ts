#!/usr/bin/env node

import { Command } from 'commander';
import { randomUUID } from 'crypto';
import { Agent } from './index.js';
import { OpenClawConfigFixer } from './config-fixer.js';
import { StatusCollector } from './collector.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { createRequire } from 'module';
import {
  readPid,
  writePid,
  removePid,
  processExists,
  spawnDaemon,
  stopDaemon,
} from '@openclaw-caribbean/shared';
import type { DoctorWarning, Trouble } from '@openclaw-caribbean/shared';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();
const CONFIG_PATH = join(homedir(), '.caribbean', 'agent.json');
const PID_PATH = join(homedir(), '.caribbean', 'agent.pid');
const LOG_PATH = join(homedir(), '.caribbean', 'agent.log');

program
  .name('caribbean-agent')
  .description('Caribbean Agent - Node monitoring and management')
  .version(version);

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
  .option('--foreground', 'Run in foreground')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const configPath = options.config;

    if (!options.foreground) {
      const existingPid = readPid(PID_PATH);
      if (existingPid && processExists(existingPid)) {
        console.error(`Agent is already running (PID: ${existingPid})`);
        console.error('Use `caribbean-agent stop` to stop it first.');
        process.exit(1);
      }
      if (existingPid) removePid(PID_PATH);

      const args = [process.argv[1], 'start', '--foreground'];
      if (configPath !== CONFIG_PATH) args.push('--config', configPath);
      if (options.server) args.push('--server', options.server);
      if (options.debug) args.push('--debug');

      const pid = spawnDaemon({
        pidPath: PID_PATH,
        logPath: LOG_PATH,
        spawnArgs: args,
      });

      console.log(`Agent started in background (PID: ${pid})`);
      console.log(`Log file: ${LOG_PATH}`);
      return;
    }

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
        const configContent = readFileSync(configPath, 'utf-8');
        config = JSON.parse(configContent);
      } catch (error) {
        console.error(`Failed to read config file: ${configPath}`);
        console.error('Run `caribbean-agent init` first.');
        process.exit(1);
      }
    }

    const agent = new Agent(config, options.debug);
    await agent.start();

    process.on('SIGINT', () => {
      console.log('\n[Agent] Shutting down...');
      agent.stop();
      removePid(PID_PATH);
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n[Agent] Shutting down...');
      agent.stop();
      removePid(PID_PATH);
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

      const pid = readPid(PID_PATH);
      const running = pid !== null && processExists(pid);

      console.log('\nAgent Status:');
      console.log(`  Running: ${running ? `Yes (PID: ${pid})` : 'No'}`);
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
    await stopDaemon(PID_PATH, 'Agent');
  });

program
  .command('restart')
  .description('Restart the agent')
  .option('--config <path>', 'Config file path', CONFIG_PATH)
  .option('--server <url>', 'Override server URL')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    await stopDaemon(PID_PATH, 'Agent');

    const configPath = options.config;
    const args = [process.argv[1], 'start', '--foreground'];
    if (configPath !== CONFIG_PATH) args.push('--config', configPath);
    if (options.server) args.push('--server', options.server);
    if (options.debug) args.push('--debug');

    const pid = spawnDaemon({
      pidPath: PID_PATH,
      logPath: LOG_PATH,
      spawnArgs: args,
    });

    console.log(`Agent restarted in background (PID: ${pid})`);
    console.log(`Log file: ${LOG_PATH}`);
  });

program
  .command('logs')
  .description('Show agent logs')
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

program
  .command('openclaw-status')
  .description('Check OpenClaw gateway status and configuration')
  .action(() => {
    console.log('\n🔍 Checking OpenClaw Gateway Status...\n');

    const collector = new StatusCollector();
    const status = collector.collect();
    const gatewayStatus = status.openclawGateway;

    if (!gatewayStatus) {
      console.log('❌ OpenClaw gateway status not available');
      return;
    }

    if (typeof gatewayStatus === 'string') {
      console.log(`Status: ${gatewayStatus}`);
      console.log('\nCannot perform detailed check. OpenClaw gateway is not running.');
      return;
    }

    console.log(`📊 Gateway Status: ${gatewayStatus.status}`);

    if (gatewayStatus.version) {
      console.log(`🏷️  Version: ${gatewayStatus.version}`);
    }

    if (gatewayStatus.port) {
      console.log(`🔌 Port: ${gatewayStatus.port}`);
    }
  });

program
  .command('fix-openclaw')
  .description('Automatically fix common OpenClaw configuration issues')
  .option('--dry-run', 'Show what would be fixed without making changes')
  .option('--backup', 'Create a backup before fixing')
  .action((options) => {
    console.log('\n🔧 Fixing OpenClaw Configuration Issues...\n');

    const collector = new StatusCollector();
    const status = collector.collect();
    const gatewayStatus = status.openclawGateway;

    if (!gatewayStatus || typeof gatewayStatus === 'string') {
      console.log(`❌ OpenClaw gateway is not running (${gatewayStatus || 'unknown status'})`);
      console.log('   Please start OpenClaw gateway first.');
      return;
    }

    const warnings = gatewayStatus.doctorWarnings || [];
    const troubles = gatewayStatus.troubles || [];

    if (warnings.length === 0 && troubles.length === 0) {
      console.log('✅ No issues to fix. OpenClaw configuration looks good!');
      return;
    }

    console.log(`Found ${warnings.length} warnings and ${troubles.length} troubles.\n`);

    if (options.dryRun) {
      console.log('🔍 Dry run mode - showing what would be fixed:\n');
      
      warnings.forEach(warning => {
        console.log(`⚠️  Warning: ${warning.type}`);
        console.log(`   ${warning.message}`);
        if (warning.suggestion) {
          console.log(`   💡 Would apply: ${warning.suggestion}`);
        }
      });

      troubles.forEach(trouble => {
        console.log(`🚨 Trouble: ${trouble.type}`);
        console.log(`   ${trouble.message}`);
      });

      console.log('\nRun without --dry-run to apply fixes.');
      return;
    }

    const fixer = new OpenClawConfigFixer();

    if (options.backup) {
      const backupPath = fixer.backupConfig();
      console.log(`💾 Backup created at: ${backupPath}\n`);
    }

    const result = fixer.fixIssues(warnings, troubles);

    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log('\n🔄 Please restart OpenClaw gateway for changes to take effect.');
    } else {
      console.log(`❌ Failed to fix issues: ${result.message}`);
    }
  });

program
  .command('validate-openclaw')
  .description('Validate OpenClaw configuration file')
  .action(() => {
    console.log('\n🔍 Validating OpenClaw Configuration...\n');

    const fixer = new OpenClawConfigFixer();
    const result = fixer.validateConfig();

    if (result.valid) {
      console.log('✅ OpenClaw configuration is valid!');
    } else {
      console.log('❌ OpenClaw configuration has errors:\n');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
  });

program.parse();
