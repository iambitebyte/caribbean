export interface NodeInfo {
  id: string;
  name: string;
  tags: string[];
  connected: boolean;
  lastSeen: Date;
  status?: NodeStatus;
  openclawStatus?: string;
}

export interface NodeStatus {
  version: string;
  uptime: number;
  cpu: {
    percent: number;
  };
  agents: {
    active: number;
    max: number;
    list: string[];
  };
  skills: string[];
  openclawGateway?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
