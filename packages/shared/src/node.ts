export interface NodeStatus {
  version: string;
  uptime: number;
  memory: MemoryInfo;
  cpu: CpuInfo;
  agents: AgentsInfo;
  skills: string[];
  openclawGateway?: string;
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

export interface NodeInfo {
  id: string;
  name: string;
  tags: string[];
  connected: boolean;
  lastSeen: Date;
  status?: NodeStatus;
  openclawStatus?: string;
}
