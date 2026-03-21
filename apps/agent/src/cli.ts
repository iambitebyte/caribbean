#!/usr/bin/env node

import { Command } from 'commander';
import { randomUUID } from 'crypto';
import { Agent } from './index.js';
import { OpenClawConfigFixer } from './config-fixer.js';
import { StatusCollector } from './collector.js';
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
    console.log(`🔗 Health: ${gatewayStatus.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    
    if (gatewayStatus.version) {
      console.log(`🏷️  Version: ${gatewayStatus.version}`);
    }
    
    if (gatewayStatus.port) {
      console.log(`🔌 Port: ${gatewayStatus.port}`);
    }

    if (gatewayStatus.doctorWarnings && gatewayStatus.doctorWarnings.length > 0) {
      console.log('\n⚠️  Doctor Warnings:');
      gatewayStatus.doctorWarnings.forEach((warning, index) => {
        const emoji = warning.severity === 'error' ? '❌' : warning.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`  ${emoji} [${index + 1}] ${warning.type}`);
        console.log(`     ${warning.message}`);
        if (warning.suggestion) {
          console.log(`     💡 Suggestion: ${warning.suggestion}`);
        }
      });
    } else {
      console.log('\n✅ No doctor warnings found');
    }

    if (gatewayStatus.troubles && gatewayStatus.troubles.length > 0) {
      console.log('\n🚨 Troubles:');
      gatewayStatus.troubles.forEach((trouble, index) => {
        const emoji = trouble.severity === 'error' ? '❌' : trouble.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`  ${emoji} [${index + 1}] ${trouble.type}`);
        console.log(`     ${trouble.message}`);
      });
    } else {
      console.log('\n✅ No troubles found');
    }

    if (!gatewayStatus.healthy) {
      console.log('\n💡 Run `caribbean-agent fix-openclaw` to automatically fix common issues.');
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
