import type { NodeStatus } from '@openclaw-caribbean/shared';

export type MessageType = 'heartbeat' | 'command' | 'connect' | 'disconnect' | 'ack' | 'connected' | 'result';

export interface BaseMessage {
  type: MessageType;
  timestamp: string;
}

export interface HeartbeatMessage extends BaseMessage {
  type: 'heartbeat';
  payload: {
    nodeId: string;
    timestamp: string;
    status: NodeStatus;
  };
}

export interface CommandMessage extends BaseMessage {
  type: 'command';
  id: string;
  action: string;
  params: Record<string, unknown>;
}

export interface ConnectMessage extends BaseMessage {
  type: 'connect';
  payload: {
    nodeId?: string; // Optional - if not provided, server will generate one
    name: string;
    tags: string[];
    version: string;
    clientIp?: string;
  };
}

export interface ConnectedMessage extends BaseMessage {
  type: 'connected';
  payload: {
    nodeId: string; // The generated or confirmed node ID
  };
}

export interface DisconnectMessage extends BaseMessage {
  type: 'disconnect';
  payload: {
    nodeId: string;
    reason: string;
  };
}

export interface AckMessage extends BaseMessage {
  type: 'ack';
  id: string;
  success: boolean;
  error?: string;
}

export interface ResultMessage extends BaseMessage {
  type: 'result';
  id: string;
  success: boolean;
  error?: string;
  data?: unknown;
}

export type Message = HeartbeatMessage | CommandMessage | ConnectMessage | ConnectedMessage | DisconnectMessage | AckMessage | ResultMessage;
