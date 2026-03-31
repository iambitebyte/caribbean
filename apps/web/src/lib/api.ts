import axios from 'axios';
import { NodeInfo } from "@/types"
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
