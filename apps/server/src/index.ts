import { NodeManager } from './node-manager.js';
import { WebSocketHub } from './websocket-hub.js';
import { ApiServer } from './api.js';
import { DatabaseManager } from './database.js';
import { createLogger, setDebugMode } from '@openclaw-caribbean/shared';

const logger = createLogger('Server');

export interface ServerConfig {
  websocket: {
    port: number;
    path: string;
    maxConnections: number;
  };
  api?: {
    port: number;
    host: string;
    webDistPath?: string;
  };
  database?: {
    type: 'sqlite' | 'postgresql';
    path?: string;
    url?: string;
  };
  auth?: {
    enabled: boolean;
    tokens: string[];
    user?: {
      username: string;
      password: string;
    };
    jwtSecret?: string;
  };
}

export class CaribbeanServer {
  private nodeManager: NodeManager;
  private websocketHub: WebSocketHub;
  private apiServer: ApiServer | null = null;
  private database: DatabaseManager | null = null;
  private config: ServerConfig;
  private debug: boolean;

  constructor(config: ServerConfig, debug: boolean = false) {
    this.config = config;
    this.debug = debug;
    setDebugMode(debug);
    this.nodeManager = new NodeManager();

    // Create database first, before WebSocketHub (needed for notification service)
    if (this.config.database) {
      this.database = new DatabaseManager(this.config.database);
    }

    this.websocketHub = new WebSocketHub(
      {
        ...this.config.websocket,
        authToken: this.config.auth?.enabled
          ? this.config.auth.tokens[0]
          : undefined
      },
      this.nodeManager,
      this.database,
      this.debug,
      async (nodeId: string) => {
        if (this.database) {
          const node = this.nodeManager.getNode(nodeId);
          if (node) {
            await this.database.saveNode(node);
          }
        }
      }
    );

    if (this.database) {
      (this.websocketHub as any).database = this.database;
    }

    if (this.config.api) {
      this.apiServer = new ApiServer(
        {
          ...this.config.api,
          auth: this.config.auth
        },
        (nodeId) => this.nodeManager.getNode(nodeId),
        () => this.nodeManager.getAllNodes(),
        (nodeId, action, params) => this.websocketHub.sendCommand(nodeId, action, params),
        (commandId) => this.websocketHub.getCommandResult(commandId),
        (commandId) => this.websocketHub.clearCommandResult(commandId),
        async () => {
          if (this.database) {
            return await this.database.getAllNodes();
          }
          return [];
        },
        async (nodeId: string, name: string) => {
          if (this.database) {
            await this.database.updateNodeName(nodeId, name);
            const node = this.nodeManager.getNode(nodeId);
            if (node) {
              node.name = name;
            }
            await this.database.saveNode(node!);
          }
        },
        async (nodeId: string) => {
          if (this.database) {
            await this.database.deleteNode(nodeId);
            this.nodeManager.removeNode(nodeId);
          }
        },
        (token: string | undefined) => this.websocketHub.updateAgentToken(token),
        async () => {
          if (this.database) {
            return await this.database.getAllNotifications();
          }
          return [];
        },
        async (id: string) => {
          if (this.database) {
            return await this.database.getNotification(id);
          }
          return null;
        },
        async (notification) => {
          if (this.database) {
            await this.database.saveNotification(notification);
          }
        },
        async (id: string) => {
          if (this.database) {
            await this.database.deleteNotification(id);
          }
        },
        async (nodeId: string, limit?: number) => {
          if (this.database) {
            return await this.database.getNodeStatusHistory(nodeId, limit);
          }
          return [];
        }
      );
    }
  }

  async start(): Promise<void> {
    logger.startup('Starting Caribbean Server...');

    if (this.database) {
      await this.database.connect();
      logger.startup('Database connected');
    }

    await this.websocketHub.start();

    if (this.apiServer) {
      await this.apiServer.start();
    }

    logger.startup('Caribbean Server is running');
    logger.startup(`WebSocket: ws://0.0.0.0:${this.config.websocket.port}${this.config.websocket.path}`);

    setInterval(() => {
      this.logStatus();
    }, 60000);
  }

  stop(): void {
    logger.startup('Stopping Caribbean Server...');

    this.websocketHub.stop();
    if (this.apiServer) {
      this.apiServer.stop();
    }
    if (this.database) {
      this.database.disconnect();
    }
  }

  getNodeManager(): NodeManager {
    return this.nodeManager;
  }

  getWebSocketHub(): WebSocketHub {
    return this.websocketHub;
  }

  getDatabase(): DatabaseManager | null {
    return this.database;
  }

  private logStatus(): void {
    const total = this.nodeManager.getNodeCount();
    const connected = this.nodeManager.getConnectedCount();
    logger.debug(`Status: ${connected}/${total} nodes connected`);
  }
}
