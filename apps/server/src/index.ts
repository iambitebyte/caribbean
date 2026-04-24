import { NodeManager } from './node-manager.js';
import { WebSocketHub } from './websocket-hub.js';
import { ApiServer } from './api.js';
import { DatabaseManager } from './database.js';

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

  constructor(config: ServerConfig) {
    this.config = config;
    this.nodeManager = new NodeManager();
    this.websocketHub = new WebSocketHub(
      {
        ...this.config.websocket,
        authToken: this.config.auth?.enabled
          ? this.config.auth.tokens[0]
          : undefined
      },
      this.nodeManager,
      null,
      async (nodeId: string) => {
        if (this.database) {
          const node = this.nodeManager.getNode(nodeId);
          if (node) {
            await this.database.saveNode(node);
          }
        }
      }
    );

    if (this.config.database) {
      this.database = new DatabaseManager(this.config.database);
    }

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
        }
      );
    }
  }

  async start(): Promise<void> {
    console.log('[Server] Starting Caribbean Server...');

    if (this.database) {
      await this.database.connect();
      console.log('[Server] Database connected');
    }

    await this.websocketHub.start();

    if (this.apiServer) {
      await this.apiServer.start();
    }

    console.log('[Server] Caribbean Server is running');
    console.log(`[Server] WebSocket: ws://0.0.0.0:${this.config.websocket.port}${this.config.websocket.path}`);

    setInterval(() => {
      this.logStatus();
    }, 60000);
  }

  stop(): void {
    console.log('[Server] Stopping Caribbean Server...');

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
    console.log(`[Server] Status: ${connected}/${total} nodes connected`);
  }
}
