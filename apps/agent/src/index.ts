import { randomUUID } from 'crypto';
import { WebSocketClient } from './websocket.js';
import { StatusCollector } from './collector.js';

export interface AgentConfig {
  server: {
    url: string;
    reconnectInterval?: number;
    heartbeatInterval?: number;
  };
  node: {
    id?: string;
    name: string;
    tags?: string[];
  };
  openclaw?: {
    configPath?: string;
    apiPort?: number;
  };
  auth?: {
    token?: string;
  };
}

export class Agent {
  private wsClient: WebSocketClient;
  private collector: StatusCollector;
  private nodeId: string;

  constructor(config: AgentConfig, debug: boolean = false) {
    this.nodeId = config.node.id || randomUUID();
    this.collector = new StatusCollector();

    this.wsClient = new WebSocketClient(
      {
        url: config.server.url,
        reconnectInterval: config.server.reconnectInterval,
        heartbeatInterval: config.server.heartbeatInterval,
        nodeId: this.nodeId,
        name: config.node.name,
        tags: config.node.tags || [],
        version: '0.1.0',
        authToken: config.auth?.token
      },
      () => this.collector.collect(),
      debug
    );
  }

  async start(): Promise<void> {
    if (this.wsClient['debug']) {
      console.log('[Agent] [DEBUG] ===== Starting Caribbean Agent =====');
      console.log('[Agent] [DEBUG] Node ID:', this.nodeId);
      console.log('[Agent] [DEBUG] Agent version: 0.1.0');
    }
    console.log(`[Agent] Starting node ${this.nodeId}`);
    if (this.wsClient['debug']) {
      console.log('[Agent] [DEBUG] Initiating WebSocket connection...');
    }
    this.wsClient.connect();
  }

  stop(): void {
    console.log('[Agent] Stopping');
    this.wsClient.disconnect();
  }

  getNodeId(): string {
    return this.nodeId;
  }
}
