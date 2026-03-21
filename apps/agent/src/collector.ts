import type { NodeStatus, MemoryInfo, CpuInfo, AgentsInfo } from '@caribbean/shared';
import os from 'os';
import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export class StatusCollector {
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
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
    const cpus = os.cpus();
    const usage = os.loadavg();
    const percent = Math.min(100, Math.round((usage[0] / cpus.length) * 100));

    return { percent };
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

  private collectOpenClawGatewayStatus(): string {
    try {
      const gatewayPort = 8000;
      const gatewayUrl = `http://localhost:${gatewayPort}/api/gateway/status`;
      
      execSync(`curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 5 "${gatewayUrl}"`, {
        stdio: 'ignore'
      });
      
      return 'running';
    } catch {
      return 'stopped';
    }
  }
}
