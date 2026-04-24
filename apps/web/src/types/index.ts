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

export interface OpenClawGatewayStatus {
  status: 'running' | 'stopped' | 'error';
  version?: string;
  pid?: number;
  port?: number;
  doctorWarnings?: DoctorWarning[];
  troubles?: Trouble[];
  healthy: boolean;
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
  cpu: {
    percent: number;
  };
  memory: {
    used: number;
    total: number;
    percent: number;
  };
  agents: {
    active: number;
    max: number;
    list: string[];
  };
  skills: string[];
  openclawGateway?: string | OpenClawGatewayStatus;
  openclawVersion?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export type NotificationChannel = 'telegram';

export interface Notification {
  id: string;
  channel: NotificationChannel;
  userId: string;
  messageTemplate: string;
  instanceIds: string[];
  nodes?: NodeInfo[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationDto {
  channel: NotificationChannel;
  userId: string;
  messageTemplate: string;
  instanceIds: string[];
}

export interface UpdateNotificationDto {
  channel?: NotificationChannel;
  userId?: string;
  messageTemplate?: string;
  instanceIds?: string[];
}
