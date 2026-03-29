import type { NodeStatus, MemoryInfo, CpuInfo, AgentsInfo, OpenClawGatewayStatus, DoctorWarning, Trouble } from '@caribbean/shared';
import os from 'os';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { createOSUtils } from 'node-os-utils';

export class StatusCollector {
  private startTime: Date;
  private cpuPercent: number = 0;
  private cpuPollingTimer: NodeJS.Timeout | null = null;
  private osUtils = createOSUtils();

  constructor() {
    this.startTime = new Date();
    this.startCpuMonitoring();
  }

  private startCpuMonitoring(): void {
    const poll = async () => {
      try {
        const result = await this.osUtils.cpu.usage();
        if (result.success && result.data !== null && result.data !== undefined) {
          this.cpuPercent = Math.round(result.data);
        }
      } catch {
        this.cpuPercent = 0;
      }
    };

    poll();
    this.cpuPollingTimer = setInterval(poll, 5000);
  }

  destroy(): void {
    if (this.cpuPollingTimer) {
      clearInterval(this.cpuPollingTimer);
      this.cpuPollingTimer = null;
    }
  }

  collect(): NodeStatus {
    return {
      version: '0.1.0',
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      memory: this.collectMemory(),
      cpu: this.collectCpu(),
      agents: this.collectAgents(),
      skills: this.collectSkills(),
      openclawGateway: this.collectOpenClawGatewayStatus()
    };
  }

  private collectMemory(): MemoryInfo {
    const totalMem = os.totalmem() / (1024 * 1024 * 1024);

    if (process.platform === 'darwin') {
      return this.collectMacOSMemory(totalMem);
    }

    return this.collectDefaultMemory(totalMem);
  }

  private collectMacOSMemory(totalMem: number): MemoryInfo {
    try {
      const vmstat = execSync('vm_stat', { timeout: 3000 }).toString();
      const pageSize = 16384;

      const extractPages = (pattern: RegExp): number => {
        const match = vmstat.match(pattern);
        return match ? parseInt(match[1], 10) : 0;
      };

      const active = extractPages(/Pages active:\s*(\d+)/);
      const wired = extractPages(/Pages wired down:\s*(\d+)/);
      const compressed = extractPages(/Pages occupied by compressor:\s*(\d+)/);

      const usedBytes = (active + wired + compressed) * pageSize;
      const usedMem = usedBytes / (1024 * 1024 * 1024);
      const percent = Math.round((usedMem / totalMem) * 100);

      return {
        used: Number(usedMem.toFixed(2)),
        total: Number(totalMem.toFixed(2)),
        percent
      };
    } catch {
      return this.collectDefaultMemory(totalMem);
    }
  }

  private collectDefaultMemory(totalMem: number): MemoryInfo {
    const freeMem = os.freemem() / (1024 * 1024 * 1024);
    const usedMem = totalMem - freeMem;
    const percent = Math.round((usedMem / totalMem) * 100);

    return {
      used: Number(usedMem.toFixed(2)),
      total: Number(totalMem.toFixed(2)),
      percent
    };
  }

  private collectCpu(): CpuInfo {
    return { percent: this.cpuPercent };
  }

  private collectAgents(): AgentsInfo {
    try {
      const configPath = join(process.env.HOME || '', '.openclaw', 'config.yaml');
      const config = readFileSync(configPath, 'utf-8');
      
      const activeMatch = config.match(/agents:\s*\n\s*active:\s*(\d+)/);
      const maxMatch = config.match(/agents:\s*\n\s*max:\s*(\d+)/);
      
      const active = activeMatch ? parseInt(activeMatch[1], 10) : 0;
      const max = maxMatch ? parseInt(maxMatch[1], 10) : 10;
      
      const listMatch = config.match(/agents:\s*\n\s*list:\s*\[([^\]]+)\]/);
      const list = listMatch 
        ? listMatch[1].split(',').map(s => s.trim().replace(/"/g, ''))
        : ['reef', 'navigator', 'shell'];

      return { active, max, list };
    } catch {
      return { active: 3, max: 10, list: ['reef', 'navigator', 'shell'] };
    }
  }

  private collectSkills(): string[] {
    try {
      const configPath = join(process.env.HOME || '', '.openclaw', 'config.yaml');
      const config = readFileSync(configPath, 'utf-8');
      
      const skillsMatch = config.match(/skills:\s*\[([^\]]+)\]/);
      
      if (skillsMatch) {
        return skillsMatch[1].split(',').map(s => s.trim().replace(/"/g, ''));
      }
    } catch {
      return ['shell', 'github', 'tmux', 'browser'];
    }
    
    return ['shell', 'github', 'tmux', 'browser'];
  }

  private collectOpenClawGatewayStatus(): OpenClawGatewayStatus | string {
    try {
      const statusOutput = execSync('openclaw gateway status', {
        encoding: 'utf-8',
        timeout: 5000
      });

      const runningMatch = statusOutput.match(/Runtime:\s*(\w+)/i);
      const status = runningMatch ? runningMatch[1].toLowerCase() : 'stopped';

      if (status !== 'running') {
        return 'stopped';
      }

      const detailedStatus = this.collectDetailedOpenClawStatus(statusOutput);
      return detailedStatus;
    } catch (error) {
      return 'stopped';
    }
  }

  private collectDetailedOpenClawStatus(statusOutput: string): OpenClawGatewayStatus {
    const status: OpenClawGatewayStatus = {
      status: 'running',
      healthy: true,
      doctorWarnings: [],
      troubles: []
    };

    try {
      const versionMatch = statusOutput.match(/OpenClaw\s+([\d.]+)/);
      if (versionMatch) {
        status.version = versionMatch[1];
      }

      const portMatch = statusOutput.match(/port=(\d+)/);
      if (portMatch) {
        status.port = parseInt(portMatch[1], 10);
      }

      const configPath = join(process.env.HOME || '', '.openclaw', 'openclaw.json');
      if (existsSync(configPath)) {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));

        const doctorWarnings = this.collectDoctorWarnings(config);
        status.doctorWarnings = doctorWarnings;

        if (doctorWarnings.some(w => w.severity === 'error')) {
          status.healthy = false;
        }
      }

      const troubles = this.collectTroubles();
      status.troubles = troubles;

      if (troubles.some(t => t.severity === 'error')) {
        status.healthy = false;
      }

    } catch (error) {
      status.status = 'error';
      status.healthy = false;
      status.doctorWarnings?.push({
        type: 'config_error',
        message: `Failed to read openclaw config: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error'
      });
    }

    return status;
  }

  private collectDoctorWarnings(config: any): DoctorWarning[] {
    const warnings: DoctorWarning[] = [];

    try {
      if (config.channels?.telegram?.groupPolicy === 'allowlist') {
        const allowFrom = config.channels?.telegram?.groupAllowFrom || config.channels?.telegram?.allowFrom;
        if (!allowFrom || (Array.isArray(allowFrom) && allowFrom.length === 0)) {
          warnings.push({
            type: 'telegram_group_policy',
            message: 'channels.telegram.groupPolicy is "allowlist" but groupAllowFrom (and allowFrom) is empty',
            suggestion: 'Add sender IDs to channels.telegram.groupAllowFrom or channels.telegram.allowFrom, or set groupPolicy to "open"',
            severity: 'warning'
          });
        }
      }

      if (!config.skills || (Array.isArray(config.skills) && config.skills.length === 0)) {
        warnings.push({
          type: 'no_skills',
          message: 'No skills configured',
          suggestion: 'Add skills to the configuration to enable OpenClaw functionality',
          severity: 'warning'
        });
      }

      if (!config.agents || !config.agents.list || config.agents.list.length === 0) {
        warnings.push({
          type: 'no_agents',
          message: 'No agents configured',
          suggestion: 'Add agents to the configuration to enable task execution',
          severity: 'warning'
        });
      }
    } catch (error) {
      warnings.push({
        type: 'doctor_check_error',
        message: `Failed to check doctor warnings: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error'
      });
    }

    return warnings;
  }

  private collectTroubles(): Trouble[] {
    const troubles: Trouble[] = [];

    try {
      const configPath = join(process.env.HOME || '', '.openclaw', 'openclaw.json');
      if (!existsSync(configPath)) {
        troubles.push({
          type: 'config_missing',
          message: 'OpenClaw configuration file not found',
          severity: 'error'
        });
        return troubles;
      }

      const config = JSON.parse(readFileSync(configPath, 'utf-8'));

      if (!config.gateway || !config.gateway.port) {
        troubles.push({
          type: 'gateway_port_missing',
          message: 'Gateway port not configured',
          severity: 'error'
        });
      }

      if (!config.apiKey && !config.jwt) {
        troubles.push({
          type: 'auth_missing',
          message: 'No authentication configured (apiKey or jwt)',
          severity: 'warning'
        });
      }

      const pidFile = join(process.env.HOME || '', '.openclaw', 'gateway.pid');
      if (!existsSync(pidFile)) {
        troubles.push({
          type: 'pid_file_missing',
          message: 'Gateway PID file not found',
          severity: 'warning'
        });
      }
    } catch (error) {
      troubles.push({
        type: 'trouble_check_error',
        message: `Failed to check troubles: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error'
      });
    }

    return troubles;
  }
}
