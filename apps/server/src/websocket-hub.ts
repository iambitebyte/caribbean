import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { NodeManager } from './node-manager.js';
import type { Message, CommandMessage, ConnectMessage, HeartbeatMessage, AckMessage } from '@caribbean/protocol';

export interface WebSocketServerConfig {
  port: number;
  path: string;
  maxConnections: number;
  authToken?: string;
}

export class WebSocketHub {
  private wss: WebSocketServer | null = null;
  private nodeManager: NodeManager;
  private config: WebSocketServerConfig;
  private clients: Map<string, any> = new Map();

  constructor(config: WebSocketServerConfig, nodeManager: NodeManager) {
    this.config = config;
    this.nodeManager = nodeManager;
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

  private handleConnect(
    ws: WebSocket,
    message: ConnectMessage,
    setNodeId: (id: string) => void
  ): void {
    const { nodeId, name, tags, version } = message.payload;
    console.log(`[Server] Node connecting: ${name} (${nodeId}) v${version}`);

    this.nodeManager.registerNode(nodeId, name, tags);
    this.clients.set(nodeId, ws);
    setNodeId(nodeId);

    const ack: AckMessage = {
      type: 'ack',
      timestamp: new Date().toISOString(),
      id: randomUUID(),
      success: true
    };
    this.sendToNode(nodeId, ack);
  }

  private handleHeartbeat(message: HeartbeatMessage): void {
    const { nodeId, status } = message.payload;
    this.nodeManager.updateNodeStatus(nodeId, status);
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
