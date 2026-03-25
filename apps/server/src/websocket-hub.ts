import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { NodeManager } from './node-manager.js';
import { DatabaseManager } from './database.js';
import type { Message, CommandMessage, ConnectMessage, ConnectedMessage, HeartbeatMessage, AckMessage } from '@caribbean/protocol';

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

  constructor(
    config: WebSocketServerConfig, 
    nodeManager: NodeManager, 
    database: DatabaseManager | null,
    onNodeUpdate?: (nodeId: string) => Promise<void>
  ) {
    this.config = config;
    this.nodeManager = nodeManager;
    this.database = database;
    this.onNodeUpdate = onNodeUpdate;
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
      default:
        console.log(`[Server] Unknown message type: ${message.type}`);
    }
  }

  private async handleConnect(
    ws: WebSocket,
    message: ConnectMessage,
    setNodeId: (id: string) => void
  ): Promise<void> {
    const { nodeId, name, tags, version, clientIp } = message.payload;

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

    this.nodeManager.registerNode(actualNodeId, nodeName, nodeTags, nodeClientIp);
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
    this.nodeManager.updateNodeStatus(nodeId, status);

    // Trigger immediate database sync on heartbeat
    if (this.onNodeUpdate) {
      this.onNodeUpdate(nodeId).catch(err => {
        console.error('[Server] Failed to sync node to database:', err);
      });
    }
  }

  private handleAck(message: AckMessage): void {
    console.log(`[Server] ACK received: ${message.id} - ${message.success ? 'success' : 'failed'}`);
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

  private sendToNode(nodeId: string, message: unknown): void {
    const ws = this.clients.get(nodeId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}
