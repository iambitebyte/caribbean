import WebSocket from 'ws';
import { execSync } from 'child_process';
import type { Message } from '@caribbean/protocol';
import type { NodeStatus } from '@caribbean/shared';
import os from 'os';

export interface WebSocketClientConfig {
  url: string;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  nodeId: string;
  name: string;
  tags: string[];
  version: string;
  authToken?: string;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketClientConfig>;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private statusCollector: () => NodeStatus;

  constructor(
    config: WebSocketClientConfig,
    statusCollector: () => NodeStatus
  ) {
    this.config = {
      url: config.url,
      reconnectInterval: config.reconnectInterval || 5000,
      heartbeatInterval: config.heartbeatInterval || 30000,
      nodeId: config.nodeId,
      name: config.name,
      tags: config.tags || [],
      version: config.version || '0.1.0',
      authToken: config.authToken || ''
    };
    this.statusCollector = statusCollector;
  }

  connect(): void {
    this.disconnect();

    const headers: Record<string, string> = {};
    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    const url = this.config.url;
    this.ws = new WebSocket(url, { headers });

    this.ws.on('open', () => {
      console.log(`[Agent] Connected to ${this.config.url}`);
      this.sendConnect();
      this.startHeartbeat();
      this.sendImmediateHeartbeat();
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const message: Message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('[Agent] Failed to parse message:', error);
      }
    });

    this.ws.on('error', (error) => {
      console.error('[Agent] WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('[Agent] Disconnected');
      this.stopHeartbeat();
      this.scheduleReconnect();
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopHeartbeat();
    this.stopReconnect();
  }

  private sendConnect(): void {
    const message = {
      type: 'connect',
      timestamp: new Date().toISOString(),
      payload: {
        nodeId: this.config.nodeId,
        name: this.config.name,
        tags: this.config.tags,
        version: this.config.version,
        clientIp: this.getLocalIp()
      }
    };
    this.send(message);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  private sendHeartbeat(): void {
    const message = {
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
      payload: {
        nodeId: this.config.nodeId,
        timestamp: new Date().toISOString(),
        status: this.statusCollector()
      }
    };
    this.send(message);
  }

  private sendImmediateHeartbeat(): void {
    console.log('[Agent] Sending immediate heartbeat with openclaw status check');
    this.sendHeartbeat();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.stopReconnect();
    this.reconnectTimer = setTimeout(() => {
      console.log('[Agent] Attempting to reconnect...');
      this.connect();
    }, this.config.reconnectInterval);
  }

  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private send(message: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private getLocalIp(): string {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
      const iface = interfaces[name];
      if (!iface) continue;
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          return alias.address;
        }
      }
    }
    return '127.0.0.1';
  }

  private handleMessage(message: Message): void {
    console.log('[Agent] Received message:', message.type);

    switch (message.type) {
      case 'command':
        this.handleCommand(message);
        break;
      case 'ack':
        console.log('[Agent] ACK received:', message.id, message.success);
        break;
      default:
        console.log('[Agent] Unknown message type:', message.type);
    }
  }

  private async handleCommand(message: Message & { type: 'command' }): Promise<void> {
    console.log('[Agent] Executing command:', message.action, message.params);

    try {
      await this.executeCommand(message.action, message.params);

      const ackMessage = {
        type: 'ack',
        timestamp: new Date().toISOString(),
        id: message.id,
        success: true
      };
      this.send(ackMessage);
    } catch (error) {
      const ackMessage = {
        type: 'ack',
        timestamp: new Date().toISOString(),
        id: message.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      this.send(ackMessage);
    }
  }

  private async executeCommand(action: string, params: Record<string, unknown>): Promise<void> {
    switch (action) {
      case 'restart_agent':
        console.log('[Agent] Restarting agent:', params);
        break;
      case 'update_config':
        console.log('[Agent] Updating config:', params);
        break;
      case 'openclaw_gateway_start':
        console.log('[Agent] Starting OpenClaw gateway...');
        execSync('openclaw gateway start', { timeout: 30000 });
        console.log('[Agent] OpenClaw gateway started successfully');
        this.sendHeartbeat();
        break;
      case 'openclaw_gateway_stop':
        console.log('[Agent] Stopping OpenClaw gateway...');
        execSync('openclaw gateway stop', { timeout: 30000 });
        console.log('[Agent] OpenClaw gateway stopped successfully');
        this.sendHeartbeat();
        break;
      default:
        throw new Error(`Unknown command: ${action}`);
    }
  }
}
