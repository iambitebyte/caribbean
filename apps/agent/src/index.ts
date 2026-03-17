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

  constructor(config: AgentConfig) {
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
      () => this.collector.collect()
    );
  }

  async start(): Promise<void> {
    console.log(`[Agent] Starting node ${this.nodeId}`);
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
