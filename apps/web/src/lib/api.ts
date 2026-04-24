import axios from 'axios';
import { NodeInfo, Notification, CreateNotificationDto, UpdateNotificationDto } from "@/types"
import { tokenManager } from './auth';

const API_BASE_URL = "/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use(
  (config) => {
    const token = tokenManager.getToken();
    if (token && config.url !== '/login') {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      error._isAuthError = true;
      tokenManager.removeToken();
    }
    return Promise.reject(error);
  }
);

export async function fetchAuthStatus(): Promise<{ enabled: boolean }> {
  const response = await apiClient.get('/auth/status');
  return response.data;
}

export async function login(username: string, password: string) {
  const response = await apiClient.post('/login', { username, password });
  return response.data;
}

export async function fetchNodes(): Promise<NodeInfo[]> {
  const response = await apiClient.get('/nodes');
  return response.data.nodes || [];
}

export async function fetchDatabaseNodes(): Promise<NodeInfo[]> {
  const response = await apiClient.get('/nodes/database');
  return response.data.nodes || [];
}

export async function updateNodeName(nodeId: string, name: string): Promise<void> {
  await apiClient.patch(`/nodes/${nodeId}/name`, { name });
}

export async function deleteNode(nodeId: string): Promise<void> {
  await apiClient.delete(`/nodes/${nodeId}`);
}

export async function fetchNode(id: string): Promise<NodeInfo | null> {
  const response = await apiClient.get(`/nodes/${id}`);
  return response.data;
}

export async function fetchStats() {
  const response = await apiClient.get('/stats');
  return response.data;
}

export async function sendNodeCommand(
  nodeId: string,
  action: string,
  params: Record<string, unknown> = {}
): Promise<{ success: boolean; commandId: string; nodeId: string; action: string }> {
  const response = await apiClient.post(`/nodes/${nodeId}/command`, { action, params });
  return response.data;
}

export async function getCommandResult(
  commandId: string
): Promise<{ success: boolean; error?: string; data?: unknown; timestamp: string }> {
  const response = await apiClient.get(`/commands/${commandId}/result`);
  return response.data;
}

export async function getNodeConfig(nodeId: string): Promise<unknown> {
  const commandResponse = await sendNodeCommand(nodeId, 'read_config', {});
  
  const maxRetries = 10;
  const retryDelay = 500;

  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, retryDelay));
    
    try {
      const result = await getCommandResult(commandResponse.commandId);
      if (result.success && result.data) {
        return (result.data as { config: unknown }).config;
      }
      if (!result.success) {
        throw new Error(result.error || 'Failed to get config');
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('Timeout waiting for command result');
}

export async function getNodeLogs(nodeId: string): Promise<string> {
  const commandResponse = await sendNodeCommand(nodeId, 'read_logs', {});

  const maxRetries = 10;
  const retryDelay = 500;

  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, retryDelay));

    try {
      const result = await getCommandResult(commandResponse.commandId);
      if (result.success && result.data) {
        return (result.data as { logs: string }).logs;
      }
      if (!result.success) {
        throw new Error(result.error || 'Failed to get logs');
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('Timeout waiting for command result');
}

export async function fetchSettings(): Promise<{
  auth: {
    enabled: boolean;
    username?: string;
    agentTokenSet: boolean;
  };
}> {
  const response = await apiClient.get('/settings');
  return response.data;
}

export async function updateAuthSettings(data: {
  enabled?: boolean;
  username?: string;
  password?: string;
  agentToken?: string;
}): Promise<{ success: boolean; token?: string }> {
  const response = await apiClient.post('/settings/auth', data);
  return response.data;
}

export async function fetchVersion(): Promise<{ version: string }> {
  const response = await apiClient.get('/version');
  return response.data;
}

export async function fetchNotifications(): Promise<Notification[]> {
  const response = await apiClient.get('/notifications');
  return response.data.notifications || [];
}

export async function createNotification(data: CreateNotificationDto): Promise<Notification> {
  const response = await apiClient.post('/notifications', data);
  return response.data.notification;
}

export async function updateNotification(id: string, data: UpdateNotificationDto): Promise<Notification> {
  const response = await apiClient.patch(`/notifications/${id}`, data);
  return response.data.notification;
}

export async function deleteNotification(id: string): Promise<void> {
  await apiClient.delete(`/notifications/${id}`);
}

export async function testNotification(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const response = await apiClient.post(`/notifications/${id}/test`);
  return response.data;
}

export async function getNodeStatusHistory(nodeId: string, limit: number = 10): Promise<{ nodeId: string; history: any[]; count: number }> {
  const response = await apiClient.get(`/nodes/${nodeId}/status-history?limit=${limit}`);
  return response.data;
}
