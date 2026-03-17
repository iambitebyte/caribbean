import type { NodeStatus } from '@caribbean/shared';

export type MessageType = 'heartbeat' | 'command' | 'connect' | 'disconnect' | 'ack';

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
    nodeId: string;
    name: string;
    tags: string[];
    version: string;
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

export type Message = HeartbeatMessage | CommandMessage | ConnectMessage | DisconnectMessage | AckMessage;
