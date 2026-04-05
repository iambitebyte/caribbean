import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { DoctorWarning, Trouble } from '@openclaw-caribbean/shared';

export interface ConfigFixResult {
  success: boolean;
  message: string;
  warningsFixed: number;
  troublesFixed: number;
}

export class OpenClawConfigFixer {
  private configPath: string;

  constructor() {
    this.configPath = join(process.env.HOME || '', '.openclaw', 'openclaw.json');
  }

  fixIssues(warnings: DoctorWarning[], troubles: Trouble[]): ConfigFixResult {
    if (!existsSync(this.configPath)) {
      return {
        success: false,
        message: 'Configuration file not found',
        warningsFixed: 0,
        troublesFixed: 0
      };
    }

    let config: any;
    try {
      config = JSON.parse(readFileSync(this.configPath, 'utf-8'));
    } catch (error) {
      return {
        success: false,
        message: `Failed to parse configuration: ${error instanceof Error ? error.message : String(error)}`,
        warningsFixed: 0,
        troublesFixed: 0
      };
    }

    let warningsFixed = 0;
    let troublesFixed = 0;

    for (const warning of warnings) {
      if (this.fixWarning(warning, config)) {
        warningsFixed++;
      }
    }

    for (const trouble of troubles) {
      if (this.fixTrouble(trouble, config)) {
        troublesFixed++;
      }
    }

    try {
      writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
      return {
        success: true,
        message: `Configuration updated: ${warningsFixed} warnings fixed, ${troublesFixed} troubles fixed`,
        warningsFixed,
        troublesFixed
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to write configuration: ${error instanceof Error ? error.message : String(error)}`,
        warningsFixed,
        troublesFixed
      };
    }
  }

  private fixWarning(warning: DoctorWarning, config: any): boolean {
    let fixed = false;

    switch (warning.type) {
      case 'telegram_group_policy':
        if (!config.channels) {
          config.channels = {};
        }
        if (!config.channels.telegram) {
          config.channels.telegram = {};
        }
        
        if (config.channels.telegram.groupPolicy === 'allowlist' && 
            (!config.channels.telegram.groupAllowFrom || config.channels.telegram.groupAllowFrom.length === 0)) {
          config.channels.telegram.groupPolicy = 'open';
          fixed = true;
        }
        break;

      case 'no_skills':
        if (!config.skills || config.skills.length === 0) {
          config.skills = ['shell', 'github', 'tmux', 'browser'];
          fixed = true;
        }
        break;

      case 'no_agents':
        if (!config.agents) {
          config.agents = {};
        }
        if (!config.agents.list || config.agents.list.length === 0) {
          config.agents.list = ['reef', 'navigator', 'shell'];
          fixed = true;
        }
        break;
    }

    return fixed;
  }

  private fixTrouble(trouble: Trouble, config: any): boolean {
    let fixed = false;

    switch (trouble.type) {
      case 'gateway_port_missing':
        if (!config.gateway) {
          config.gateway = {};
        }
        if (!config.gateway.port) {
          config.gateway.port = 8000;
          fixed = true;
        }
        break;

      case 'auth_missing':
        if (!config.apiKey) {
          config.apiKey = this.generateApiKey();
          fixed = true;
        }
        break;
    }

    return fixed;
  }

  private generateApiKey(): string {
    return `api_key_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!existsSync(this.configPath)) {
      errors.push('Configuration file does not exist');
      return { valid: false, errors };
    }

    try {
      const config = JSON.parse(readFileSync(this.configPath, 'utf-8'));

      if (!config.gateway) {
        errors.push('Missing gateway configuration');
      } else {
        if (typeof config.gateway.port !== 'number') {
          errors.push('Gateway port must be a number');
        }
        if (config.gateway.port < 1 || config.gateway.port > 65535) {
          errors.push('Gateway port must be between 1 and 65535');
        }
      }

      if (!config.agents) {
        errors.push('Missing agents configuration');
      } else {
        if (!Array.isArray(config.agents.list)) {
          errors.push('Agents list must be an array');
        }
      }

      if (!config.skills || !Array.isArray(config.skills)) {
        errors.push('Skills must be an array');
      }

    } catch (error) {
      errors.push(`Configuration parse error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  backupConfig(): string {
    const backupPath = `${this.configPath}.backup`;
    if (existsSync(this.configPath)) {
      const content = readFileSync(this.configPath, 'utf-8');
      writeFileSync(backupPath, content, 'utf-8');
    }
    return backupPath;
  }
}