import WebSocket from 'ws';
import { execSync } from 'child_process';
import type { Message } from '@openclaw-caribbean/protocol';
import type { NodeStatus } from '@openclaw-caribbean/shared';
import os from 'os';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createLogger, isDebugMode } from '@openclaw-caribbean/shared';

const logger = createLogger('Agent');

export interface WebSocketClientConfig {
  url: string;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  nodeId: string;
  name: string;
  tags: string[];
  version: string;
  authToken?: string;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketClientConfig>;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private statusCollector: () => NodeStatus;

  constructor(
    config: WebSocketClientConfig,
    statusCollector: () => NodeStatus,
    _debug: boolean = false
  ) {
    this.config = {
      url: config.url,
      reconnectInterval: config.reconnectInterval || 5000,
      heartbeatInterval: config.heartbeatInterval || 30000,
      nodeId: config.nodeId,
      name: config.name,
      tags: config.tags || [],
      version: config.version || '0.1.0',
      authToken: config.authToken || ''
    };
    this.statusCollector = statusCollector;
  }

  private debugLog(...args: unknown[]): void {
    if (isDebugMode()) {
      console.log('[Agent] [DEBUG]', ...args);
    }
  }

  connect(): void {
    this.debugLog('===== Starting WebSocket Connection =====');
    this.debugLog('Target URL:', this.config.url);
    this.debugLog('Node ID:', this.config.nodeId);
    this.debugLog('Node Name:', this.config.name);
    this.debugLog('Node Tags:', this.config.tags);
    this.debugLog('Version:', this.config.version);
    this.debugLog('Reconnect Interval:', this.config.reconnectInterval, 'ms');
    this.debugLog('Heartbeat Interval:', this.config.heartbeatInterval, 'ms');
    this.debugLog('Auth Token:', this.config.authToken ? '***' + this.config.authToken.slice(-4) : 'None');
    this.debugLog('Local IP:', this.getLocalIp());

    this.disconnect();

    const headers: Record<string, string> = {};
    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }
    this.debugLog('Request Headers:', JSON.stringify(headers, null, 2));

    const system = this.getSystemType();
    this.debugLog('System:', system);

    const url = this.config.url;
    this.debugLog('Creating WebSocket instance...');
    this.ws = new WebSocket(url, { headers });

    this.debugLog('WebSocket instance created, readyState:', this.getReadyStateName(this.ws.readyState));

    this.ws.on('open', () => {
      this.debugLog('===== WebSocket OPEN Event =====');
      this.debugLog('Connection established successfully');
      this.debugLog('Connected to:', this.config.url);
      this.debugLog('Current readyState:', this.getReadyStateName(this.ws?.readyState || 0));
      this.sendConnect();
      this.startHeartbeat();
      this.sendImmediateHeartbeat();
    });

    this.ws.on('message', (data: Buffer) => {
      this.debugLog('===== WebSocket MESSAGE Event =====');
      this.debugLog('Message size:', data.length, 'bytes');
      this.debugLog('Raw message:', data.toString());
      try {
        const message: Message = JSON.parse(data.toString());
        this.debugLog('Parsed message type:', message.type);
        this.debugLog('Parsed message timestamp:', message.timestamp);
        this.handleMessage(message);
      } catch (error) {
        logger.error('Failed to parse message');
        logger.error('Parse error:', error);
      }
    });

    this.ws.on('error', (error) => {
      this.debugLog('===== WebSocket ERROR Event =====');
      this.debugLog('Error type:', error.name);
      this.debugLog('Error message:', error.message);
      this.debugLog('Error stack:', error.stack);
      this.debugLog('Current readyState:', this.getReadyStateName(this.ws?.readyState || 0));
      this.debugLog('WebSocket URL:', this.config.url);
    });

    this.ws.on('close', (code, reason) => {
      this.debugLog('===== WebSocket CLOSE Event =====');
      this.debugLog('Close code:', code);
      this.debugLog('Close reason:', reason.toString());
      this.debugLog('Close code meaning:', this.getCloseCodeMeaning(code));
      this.debugLog('Current readyState:', this.getReadyStateName(this.ws?.readyState || 0));
      logger.debug('Disconnected');
      this.stopHeartbeat();
      this.scheduleReconnect();
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopHeartbeat();
    this.stopReconnect();
  }

  private sendConnect(): void {
    this.debugLog('===== Sending CONNECT Message =====');
    const message = {
      type: 'connect',
      timestamp: new Date().toISOString(),
      payload: {
        nodeId: this.config.nodeId,
        name: this.config.name,
        tags: this.config.tags,
        version: this.config.version,
        clientIp: this.getLocalIp(),
        system: this.getSystemType()
      }
    };
    this.debugLog('Connect message:', JSON.stringify(message, null, 2));
    this.send(message);
    this.debugLog('Connect message sent');
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  private sendHeartbeat(): void {
    this.debugLog('===== Sending HEARTBEAT Message =====');
    const message = {
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
      payload: {
        nodeId: this.config.nodeId,
        timestamp: new Date().toISOString(),
        status: this.statusCollector()
      }
    };
    this.debugLog('Heartbeat message:', JSON.stringify(message, null, 2));
    this.send(message);
    this.debugLog('Heartbeat message sent');
  }

  private sendImmediateHeartbeat(): void {
    logger.debug('Sending immediate heartbeat with openclaw status check');
    this.sendHeartbeat();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.debugLog('===== Scheduling Reconnection =====');
    this.debugLog('Reconnect interval:', this.config.reconnectInterval, 'ms');
    this.debugLog('Will reconnect to:', this.config.url);
    this.stopReconnect();
    this.reconnectTimer = setTimeout(() => {
      logger.debug('Attempting to reconnect...');
      this.connect();
    }, this.config.reconnectInterval);
    this.debugLog('Reconnect timer set');
  }

  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private send(message: unknown): void {
    const readyState = this.ws?.readyState;
    const readyStateName = this.getReadyStateName(readyState || 0);
    this.debugLog('===== Sending Message =====');
    this.debugLog('Current readyState:', readyStateName);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const messageStr = JSON.stringify(message);
      this.debugLog('Message length:', messageStr.length, 'bytes');
      this.ws.send(messageStr);
      this.debugLog('Message sent successfully');
    } else {
      this.debugLog('Cannot send message - WebSocket not OPEN');
    }
  }

  private getLocalIp(): string {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
      const iface = interfaces[name];
      if (!iface) continue;
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          return alias.address;
        }
      }
    }
    return '127.0.0.1';
  }

  private getSystemType(): 'windows' | 'mac' | 'linux' {
    const platform = os.platform();
    if (platform === 'win32') return 'windows';
    if (platform === 'darwin') return 'mac';
    return 'linux';
  }

  private getReadyStateName(state: number): string {
    const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
    return states[state] || `UNKNOWN(${state})`;
  }

  private getCloseCodeMeaning(code: number): string {
    const codes: Record<number, string> = {
      1000: 'Normal Closure',
      1001: 'Going Away',
      1002: 'Protocol Error',
      1003: 'Unsupported Data',
      1004: '(Reserved)',
      1005: 'No Status Received',
      1006: 'Abnormal Closure',
      1007: 'Invalid frame payload data',
      1008: 'Policy Violation',
      1009: 'Message Too Big',
      1010: 'Missing Extension',
      1011: 'Internal Error',
      1012: 'Service Restart',
      1013: 'Try Again Later',
      1014: 'Bad Gateway',
      1015: 'TLS Handshake',
      4000: 'Unknown'
    };
    return codes[code] || `Unknown code ${code}`;
  }

  private handleMessage(message: Message): void {
    this.debugLog('===== Handling Received Message =====');
    this.debugLog('Message type:', message.type);
    this.debugLog('Message timestamp:', message.timestamp);

    switch (message.type) {
      case 'heartbeat':
      case 'connect':
      case 'connected':
      case 'disconnect':
        this.debugLog('Message payload:', JSON.stringify(message.payload, null, 2));
        break;
      case 'command':
        this.debugLog('Command ID:', message.id);
        this.debugLog('Command action:', message.action);
        this.debugLog('Command params:', JSON.stringify(message.params, null, 2));
        this.debugLog('Processing command message');
        this.handleCommand(message);
        break;
      case 'ack':
        this.debugLog('===== ACK Message Received =====');
        this.debugLog('ACK ID:', message.id);
        this.debugLog('ACK Success:', message.success);
        if (!message.success && message.error) {
          this.debugLog('ACK Error:', message.error);
        }
        break;
      default:
        this.debugLog('Unknown message type:', (message as Message).type);
    }
  }

  private async handleCommand(message: Message & { type: 'command' }): Promise<void> {
    this.debugLog('===== Executing Command =====');
    this.debugLog('Command ID:', message.id);
    this.debugLog('Command action:', message.action);
    this.debugLog('Command params:', JSON.stringify(message.params, null, 2));
    this.debugLog('Command timestamp:', message.timestamp);

    try {
      const result = await this.executeCommand(message.action, message.params);

      this.debugLog('Command executed successfully, sending result');
      const resultMessage = {
        type: 'result',
        timestamp: new Date().toISOString(),
        id: message.id,
        success: true,
        data: result
      };
      this.send(resultMessage);
    } catch (error) {
      this.debugLog('Command execution failed, sending error result');
      this.debugLog('Execution error:', error);
      const resultMessage = {
        type: 'result',
        timestamp: new Date().toISOString(),
        id: message.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      this.send(resultMessage);
    }
  }

  private async executeCommand(action: string, params: Record<string, unknown>): Promise<unknown> {
    switch (action) {
      case 'restart_agent':
        logger.debug('Restarting agent:', params);
        return { message: 'Restart command received' };
      case 'update_config':
        logger.debug('Updating config:', params);
        return { message: 'Update config command received' };
      case 'openclaw_gateway_start':
        logger.startup('Starting OpenClaw gateway...');
        execSync('openclaw gateway start', { timeout: 30000 });
        logger.startup('OpenClaw gateway started successfully');
        this.sendHeartbeat();
        return { message: 'Gateway started successfully' };
      case 'openclaw_gateway_stop':
        logger.startup('Stopping OpenClaw gateway...');
        execSync('openclaw gateway stop', { timeout: 30000 });
        logger.startup('OpenClaw gateway stopped successfully');
        this.sendHeartbeat();
        return { message: 'Gateway stopped successfully' };
      case 'read_config':
        logger.debug('Reading openclaw.json config...');
        const configPath = join(process.env.HOME || '', '.openclaw', 'openclaw.json');
        if (!existsSync(configPath)) {
          throw new Error('Config file not found');
        }
        const configContent = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        logger.debug('Config read successfully');
        return { config };
      case 'read_logs':
        logger.debug('Reading openclaw logs...');
        const logs = execSync('openclaw logs | tail -n 20', { encoding: 'utf-8', timeout: 5000 });
        logger.debug('Logs read successfully');
        return { logs: logs.trim() };
      case 'gateway_health_check':
        logger.debug('Running gateway health check...');
        const healthOutput = execSync('openclaw gateway call health', { encoding: 'utf-8', timeout: 10000 });
        const healthJsonMatch = healthOutput.match(/\{[\s\S]*\}/);
        if (!healthJsonMatch) {
          throw new Error('No JSON found in health response');
        }
        const healthData = JSON.parse(healthJsonMatch[0]);
        logger.debug('Health check completed, ok:', healthData.ok);
        this.sendHeartbeat();
        return { health: healthData };
      case 'message':
        logger.debug('Sending message via OpenClaw...');
        const channel = params.channel as string;
        const target = params.target as string;
        const message = params.message as string;

        if (!channel || !target || !message) {
          throw new Error('Missing required parameters: channel, target, message');
        }

        logger.debug(`Sending message to ${target} via ${channel}: "${message}"`);
        const messageOutput = execSync(
          `openclaw message send --channel ${channel} --target ${target} --message "${message}"`,
          { encoding: 'utf-8', timeout: 30000 }
        );
        logger.debug('Message sent successfully');
        logger.debug('Output:', messageOutput.trim());
        return { success: true, output: messageOutput.trim() };
      default:
        throw new Error(`Unknown command: ${action}`);
    }
  }
}
