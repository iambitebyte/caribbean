export interface OpenClawGatewayStatus {
  status: 'running' | 'stopped' | 'error';
  version?: string;
  pid?: number;
  port?: number;
  doctorWarnings?: DoctorWarning[];
  troubles?: Trouble[];
  healthy: boolean;
  healthCheck?: {
    ok: boolean;
    ts?: number;
    durationMs?: number;
    error?: string;
  };
}

export interface DoctorWarning {
  type: string;
  message: string;
  suggestion?: string;
  severity: 'error' | 'warning' | 'info';
}

export interface Trouble {
  type: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface NodeStatus {
  version: string;
  uptime: number;
  memory: MemoryInfo;
  cpu: CpuInfo;
  agents: AgentsInfo;
  skills: string[];
  openclawGateway?: string | OpenClawGatewayStatus;
  openclawVersion?: string;
}

export interface MemoryInfo {
  used: number;
  total: number;
  percent: number;
}

export interface CpuInfo {
  percent: number;
}

export interface AgentsInfo {
  active: number;
  max: number;
  list: string[];
}

export type SystemType = 'windows' | 'mac' | 'linux';

export interface NodeInfo {
  id: string;
  name: string;
  tags: string[];
  connected: boolean;
  lastSeen: Date;
  status?: NodeStatus;
  openclawStatus?: string;
  clientIp?: string;
  system?: SystemType;
  openclawVersion?: string;
}
