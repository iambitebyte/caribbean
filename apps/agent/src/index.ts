import { randomUUID } from 'crypto';
import { WebSocketClient } from './websocket.js';
import { StatusCollector } from './collector.js';
import { createLogger, setDebugMode } from '@openclaw-caribbean/shared';

const logger = createLogger('Agent');

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
    setDebugMode(debug);

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
    logger.debug('===== Starting Caribbean Agent =====');
    logger.debug(`Node ID: ${this.nodeId}`);
    logger.debug('Agent version: 0.1.0');
    logger.startup(`Starting node ${this.nodeId}`);
    logger.debug('Initiating WebSocket connection...');
    this.wsClient.connect();
  }

  stop(): void {
    logger.startup('Stopping');
    this.wsClient.disconnect();
  }

  getNodeId(): string {
    return this.nodeId;
  }
}
