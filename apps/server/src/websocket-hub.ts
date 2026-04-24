import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { NodeManager } from './node-manager.js';
import { DatabaseManager } from './database.js';
import { NotificationService } from './notification-service.js';
import type { Message, CommandMessage, ConnectMessage, ConnectedMessage, HeartbeatMessage, AckMessage, ResultMessage } from '@openclaw-caribbean/protocol';

export interface WebSocketServerConfig {
  port: number;
  path: string;
  maxConnections: number;
  authToken?: string;
}

export class WebSocketHub {
  private wss: WebSocketServer | null = null;
  private nodeManager: NodeManager;
  private database: DatabaseManager | null = null;
  private config: WebSocketServerConfig;
  private clients: Map<string, WebSocket> = new Map();
  private onNodeUpdate?: (nodeId: string) => Promise<void>;
  private commandResults: Map<string, { success: boolean; error?: string; data?: unknown; timestamp: string }> = new Map();
  private notificationService: NotificationService | null = null;
  private debug: boolean;

  constructor(
    config: WebSocketServerConfig,
    nodeManager: NodeManager,
    database: DatabaseManager | null,
    debug: boolean = false,
    onNodeUpdate?: (nodeId: string) => Promise<void>
  ) {
    this.config = config;
    this.nodeManager = nodeManager;
    this.database = database;
    this.debug = debug;
    this.onNodeUpdate = onNodeUpdate;

    // Initialize notification service if database is available
    if (database) {
      this.notificationService = new NotificationService(database, this, debug);
    }
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({
        port: this.config.port,
        path: this.config.path,
        maxPayload: 1024 * 1024
      });

      this.wss.on('connection', (ws, req) => {
        if (this.clients.size >= this.config.maxConnections) {
          ws.close(1008, 'Max connections reached');
          return;
        }

        if (this.config.authToken) {
          const authHeader = req.headers['authorization'];
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log(`[Server] Rejecting connection: missing or invalid authorization header`);
            ws.close(1008, 'Unauthorized');
            return;
          }

          const token = authHeader.substring(7);
          if (token !== this.config.authToken) {
            console.log(`[Server] Rejecting connection: invalid token`);
            ws.close(1008, 'Unauthorized');
            return;
          }
        }

        console.log(`[Server] New connection from ${req.socket.remoteAddress}`);

        let nodeId: string | null = null;

        ws.on('message', (data: Buffer) => {
          try {
            const message: Message = JSON.parse(data.toString());
            this.handleMessage(ws, message, (id) => { nodeId = id; });
          } catch (error) {
            console.error('[Server] Failed to parse message:', error);
          }
        });

        ws.on('close', () => {
          if (nodeId) {
            this.nodeManager.disconnectNode(nodeId, 'Connection closed');
            this.clients.delete(nodeId);

            // Clean up notification service tracking
            if (this.notificationService) {
              this.notificationService.removeNodeStatus(nodeId);
            }

            if (this.database) {
              this.database.updateNodeDisconnected(nodeId).catch(err => {
                console.error('[Server] Failed to update node disconnected status:', err);
              });
            }

            if (this.onNodeUpdate) {
              this.onNodeUpdate(nodeId).catch(err => {
                console.error('[Server] Failed to sync node disconnect to database:', err);
              });
            }
          }
        });

        ws.on('error', (error) => {
          console.error('[Server] WebSocket error:', error);
        });
      });

      this.wss.on('listening', () => {
        console.log(`[Server] WebSocket server listening on ws://0.0.0.0:${this.config.port}${this.config.path}`);
        resolve();
      });

      this.wss.on('error', (error) => {
        console.error('[Server] WebSocket server error:', error);
      });
    });
  }

  stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  private handleMessage(
    ws: WebSocket,
    message: Message,
    setNodeId: (id: string) => void
  ): void {
    console.log(`[Server] Received message: ${message.type}`);

    switch (message.type) {
      case 'connect':
        this.handleConnect(ws, message as ConnectMessage, setNodeId);
        break;
      case 'heartbeat':
        this.handleHeartbeat(message as HeartbeatMessage);
        break;
      case 'ack':
        this.handleAck(message as AckMessage);
        break;
      case 'result':
        this.handleResult(message as ResultMessage);
        break;
      default:
        console.log(`[Server] Unknown message type: ${message.type}`);
    }
  }

  private async handleConnect(
    ws: WebSocket,
    message: ConnectMessage,
    setNodeId: (id: string) => void
  ): Promise<void> {
    const { nodeId, name, tags, version, clientIp, system } = message.payload;

    // Generate a new node ID if not provided
    let actualNodeId = nodeId;
    if (!actualNodeId) {
      actualNodeId = this.nodeManager.generateNodeId();
    }

    // Check if node already exists in database
    const existingNode = this.database ? await this.database.getNode(actualNodeId) : null;

    // Use database name/tags if exists, otherwise use client-provided ones
    const nodeName = existingNode ? existingNode.name : name;
    const nodeTags = existingNode ? existingNode.tags : tags;
    const nodeClientIp = existingNode ? (clientIp || existingNode.clientIp) : clientIp;
    const nodeSystem = system || existingNode?.system;

    this.nodeManager.registerNode(actualNodeId, nodeName, nodeTags, nodeClientIp, nodeSystem);
    this.clients.set(actualNodeId, ws);
    setNodeId(actualNodeId);

    // Send the connected message back to client
    const connected: ConnectedMessage = {
      type: 'connected',
      timestamp: new Date().toISOString(),
      payload: {
        nodeId: actualNodeId
      }
    };
    this.sendToNode(actualNodeId, connected);

    // Initialize notification service with current gateway status (if available in heartbeat)
    // This will be updated on first heartbeat

    // Trigger database sync - only update connected status if node exists
    if (this.database) {
      if (existingNode) {
        await this.database.updateNodeConnected(actualNodeId, nodeClientIp);
      } else {
        const node = this.nodeManager.getNode(actualNodeId);
        if (node) {
          await this.database.saveNode(node);
        }
      }
    }

    if (this.onNodeUpdate) {
      this.onNodeUpdate(actualNodeId).catch(err => {
        console.error('[Server] Failed to sync node to database:', err);
      });
    }
  }

  private handleHeartbeat(message: HeartbeatMessage): void {
    const { nodeId, status } = message.payload;
    const node = this.nodeManager.getNode(nodeId);

    // Get the current gateway status
    const currentGatewayStatus = this.getGatewayStatus(status);

    // Check for status changes and send notifications
    if (this.notificationService && node) {
      this.notificationService.checkAndNotify(
        nodeId,
        node.name,
        currentGatewayStatus,
        this.nodeManager.getConnectedNodes()
      ).catch(err => {
        console.error('[Server] Failed to check and send notifications:', err);
      });
    }

    this.nodeManager.updateNodeStatus(nodeId, status);

    // Trigger immediate database sync on heartbeat
    if (this.onNodeUpdate) {
      this.onNodeUpdate(nodeId).catch(err => {
        console.error('[Server] Failed to sync node to database:', err);
      });
    }
  }

  private getGatewayStatus(status: any): string {
    if (!status) return 'unknown';
    if (typeof status.openclawGateway === 'string') {
      return status.openclawGateway;
    }
    if (status.openclawGateway?.status) {
      return status.openclawGateway.status;
    }
    return 'unknown';
  }

  private handleAck(message: AckMessage): void {
    console.log(`[Server] ACK received: ${message.id} - ${message.success ? 'success' : 'failed'}`);
    if (!message.success && message.error) {
      console.error(`[Server] Error: ${message.error}`);
    }
  }

  private handleResult(message: ResultMessage): void {
    console.log(`[Server] Result received: ${message.id} - ${message.success ? 'success' : 'failed'}`);
    this.commandResults.set(message.id, {
      success: message.success,
      error: message.error,
      data: message.data,
      timestamp: message.timestamp
    });
    if (!message.success && message.error) {
      console.error(`[Server] Error: ${message.error}`);
    }
  }

  sendCommand(nodeId: string, action: string, params: Record<string, unknown>): string {
    const command: CommandMessage = {
      type: 'command',
      timestamp: new Date().toISOString(),
      id: randomUUID(),
      action,
      params
    };

    const ws = this.clients.get(nodeId);
    if (!ws) {
      throw new Error(`Node ${nodeId} not connected`);
    }

    ws.send(JSON.stringify(command));
    console.log(`[Server] Command sent to ${nodeId}: ${action}`);
    return command.id;
  }

  broadcastToDashboard(data: unknown): void {
    for (const [nodeId, ws] of this.clients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'dashboard:broadcast', data }));
      }
    }
  }

  getCommandResult(commandId: string) {
    return this.commandResults.get(commandId);
  }

  clearCommandResult(commandId: string): void {
    this.commandResults.delete(commandId);
  }

  updateAgentToken(token: string | undefined): void {
    this.config.authToken = token;
  }

  private sendToNode(nodeId: string, message: unknown): void {
    const ws = this.clients.get(nodeId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}
