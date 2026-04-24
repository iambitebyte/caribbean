import Fastify from 'fastify';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from '@fastify/cors';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { createRequire } from 'module';
import type { NodeInfo, Notification, CreateNotificationDto } from '@openclaw-caribbean/shared';
import { verifyToken, generateToken } from './auth.js';
import { createLogger } from '@openclaw-caribbean/shared';

const logger = createLogger('API');

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const CONFIG_PATH = join(homedir(), '.caribbean', 'server.json');

export interface ApiServerConfig {
  port: number;
  host: string;
  webDistPath?: string;
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

export class ApiServer {
  private fastify: any;
  private config: ApiServerConfig;
  private getNodeInfo: (nodeId: string) => NodeInfo | undefined;
  private getAllNodes: () => NodeInfo[];
  private sendCommand: (nodeId: string, action: string, params: Record<string, unknown>) => string;
  private getCommandResult?: (commandId: string) => { success: boolean; error?: string; data?: unknown; timestamp: string } | undefined;
  private clearCommandResult?: (commandId: string) => void;
  private getDatabaseNodes?: () => Promise<NodeInfo[]>;
  private updateNodeName?: (nodeId: string, name: string) => Promise<void>;
  private deleteNode?: (nodeId: string) => Promise<void>;
  private authEnabled: boolean;
  private updateAgentToken?: (token: string | undefined) => void;
  private getAllNotifications?: () => Promise<Notification[]>;
  private getNotification?: (id: string) => Promise<Notification | null>;
  private saveNotification?: (notification: Notification) => Promise<void>;
  private deleteNotification?: (id: string) => Promise<void>;
  private getNodeStatusHistory?: (nodeId: string, limit?: number) => Promise<any[]>;

  constructor(
    config: ApiServerConfig,
    getNodeInfo: (nodeId: string) => NodeInfo | undefined,
    getAllNodes: () => NodeInfo[],
    sendCommand: (nodeId: string, action: string, params: Record<string, unknown>) => string,
    getCommandResult?: (commandId: string) => { success: boolean; error?: string; data?: unknown; timestamp: string } | undefined,
    clearCommandResult?: (commandId: string) => void,
    getDatabaseNodes?: () => Promise<NodeInfo[]>,
    updateNodeName?: (nodeId: string, name: string) => Promise<void>,
    deleteNode?: (nodeId: string) => Promise<void>,
    updateAgentToken?: (token: string | undefined) => void,
    getAllNotifications?: () => Promise<Notification[]>,
    getNotification?: (id: string) => Promise<Notification | null>,
    saveNotification?: (notification: Notification) => Promise<void>,
    deleteNotification?: (id: string) => Promise<void>,
    getNodeStatusHistory?: (nodeId: string, limit?: number) => Promise<any[]>
  ) {
    this.config = config;
    this.getNodeInfo = getNodeInfo;
    this.getAllNodes = getAllNodes;
    this.sendCommand = sendCommand;
    this.getCommandResult = getCommandResult;
    this.clearCommandResult = clearCommandResult;
    this.getDatabaseNodes = getDatabaseNodes;
    this.updateNodeName = updateNodeName;
    this.deleteNode = deleteNode;
    this.updateAgentToken = updateAgentToken;
    this.getAllNotifications = getAllNotifications;
    this.getNotification = getNotification;
    this.saveNotification = saveNotification;
    this.deleteNotification = deleteNotification;
    this.getNodeStatusHistory = getNodeStatusHistory;
    this.authEnabled = !!config.auth?.enabled && !!config.auth?.user;
    this.fastify = Fastify({ logger: false });
    this.fastify.register(cors, {
      origin: true,
      credentials: true
    });
    this.setupAuthMiddleware();
    this.setupRoutes();
    this.setupStaticFiles();
  }

  private setupAuthMiddleware(): void {
    this.fastify.addHook('onRequest', async (request: any, reply: any) => {
      const path = request.routerPath;

      if (path === '/api/login' || path === '/api/health' ||
          path?.startsWith('/api/auth/') || path?.startsWith('/api/settings/')) {
        return;
      }

      if (!this.authEnabled || !path?.startsWith('/api/')) {
        return;
      }

      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      const token = authHeader.substring(7);
      const jwtSecret = this.config.auth?.jwtSecret;
      const payload = verifyToken(token, jwtSecret);

      if (!payload) {
        reply.code(401).send({ error: 'Invalid or expired token' });
        return;
      }

      request.user = payload;
    });
  }

  private setupRoutes(): void {
    this.fastify.get('/api/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    this.fastify.get('/api/version', async () => {
      return { version };
    });

    this.fastify.get('/api/auth/status', async () => {
      return { enabled: this.authEnabled };
    });

    this.fastify.get('/api/settings', async () => {
      return {
        auth: {
          enabled: this.authEnabled,
          username: this.config.auth?.user?.username,
          agentTokenSet: !!(this.config.auth?.tokens && this.config.auth.tokens.length > 0)
        }
      };
    });

    this.fastify.post('/api/settings/auth', async (request: any, reply: any) => {
      const { enabled, username, password, agentToken } = request.body;

      try {
        const configContent = readFileSync(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(configContent);

        if (enabled !== undefined) {
          if (enabled) {
            if (!username || !password) {
              reply.code(400).send({ error: 'Username and password are required to enable auth' });
              return;
            }
            config.auth.enabled = true;
            config.auth.user = { username, password };
            config.auth.jwtSecret = 'caribbean-jwt-secret-' + Date.now();
          } else {
            config.auth.enabled = false;
            config.auth.user = undefined;
            config.auth.jwtSecret = undefined;
          }
        }

        if (agentToken !== undefined) {
          if (agentToken && agentToken.trim() !== '') {
            config.auth.tokens = [agentToken.trim()];
          } else {
            config.auth.tokens = [];
          }
        }

        writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

        this.updateAuthConfig(config.auth);

        const result: { success: boolean; token?: string } = { success: true };
        if (config.auth.enabled && config.auth.user && config.auth.jwtSecret) {
          result.token = generateToken({ username: config.auth.user.username }, config.auth.jwtSecret);
        }
        return result;
      } catch (error) {
        logger.error('Failed to update settings:', error);
        reply.code(500).send({ error: 'Failed to update settings' });
      }
    });

    this.fastify.post('/api/login', async (request: any, reply: any) => {
      if (!this.authEnabled) {
        reply.code(400).send({ error: 'Authentication is not enabled' });
        return;
      }

      const { username, password } = request.body;

      if (!username || !password) {
        reply.code(400).send({ error: 'Username and password are required' });
        return;
      }

      if (username !== this.config.auth?.user?.username || password !== this.config.auth?.user?.password) {
        reply.code(401).send({ error: 'Invalid username or password' });
        return;
      }

      const jwtSecret = this.config.auth?.jwtSecret;
      const token = generateToken({ username }, jwtSecret);

      return {
        success: true,
        token,
        username
      };
    });

    this.fastify.get('/api/nodes', async () => {
      return {
        nodes: this.getAllNodes(),
        count: this.getAllNodes().length
      };
    });

    this.fastify.get('/api/nodes/database', async () => {
      if (this.getDatabaseNodes) {
        const nodes = await this.getDatabaseNodes();
        return {
          nodes,
          count: nodes.length
        };
      }
      return {
        nodes: [],
        count: 0,
        error: 'Database not available'
      };
    });

    this.fastify.get('/api/nodes/:id', async (request: any, reply: any) => {
      const { id } = request.params;
      const node = this.getNodeInfo(id);
      
      if (!node) {
        reply.code(404).send({ error: 'Node not found' });
        return;
      }
      
      return node;
    });

    this.fastify.get('/api/nodes/:id/status', async (request: any, reply:any) => {
      const { id } = request.params;
      const node = this.getNodeInfo(id);

      if (!node) {
        reply.code(404).send({ error: 'Node not found' });
        return;
      }

      return {
        nodeId: id,
        status: node.status,
        lastSeen: node.lastSeen,
        connected: node.connected
      };
    });

    this.fastify.get('/api/nodes/:id/status-history', async (request: any, reply: any) => {
      const { id } = request.params;
      const { limit } = request.query as { limit?: string };

      if (!this.getNodeStatusHistory) {
        reply.code(501).send({ error: 'Database not available' });
        return;
      }

      try {
        const limitNum = Number(limit || 10);
        const history = await this.getNodeStatusHistory(id, limitNum);
        return {
          nodeId: id,
          history,
          count: history.length
        };
      } catch (error) {
        logger.error('Failed to fetch status history:', error);
        reply.code(500).send({ error: 'Failed to fetch status history' });
      }
    });

    this.fastify.patch('/api/nodes/:id/name', async (request: any, reply: any) => {
      const { id } = request.params;
      const { name } = request.body;

      if (!name || name.trim() === '') {
        reply.code(400).send({ error: 'Name is required' });
        return;
      }

      const node = this.getNodeInfo(id);
      if (!node) {
        reply.code(404).send({ error: 'Node not found' });
        return;
      }

      if (this.updateNodeName) {
        try {
          await this.updateNodeName(id, name.trim());
          reply.send({ success: true, nodeId: id, name: name.trim() });
        } catch (error) {
          reply.code(500).send({ 
            error: error instanceof Error ? error.message : 'Failed to update node name' 
          });
        }
      } else {
        reply.code(501).send({ error: 'Database not available' });
      }
    });

    this.fastify.post('/api/nodes/:id/command', async (request: any, reply: any) => {
      const { id } = request.params;
      const { action, params = {} } = request.body;

      try {
        const commandId = this.sendCommand(id, action, params);
        return {
          success: true,
          commandId,
          nodeId: id,
          action
        };
      } catch (error) {
        reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    this.fastify.get('/api/commands/:id/result', async (request: any, reply: any) => {
      const { id } = request.params;

      if (!this.getCommandResult) {
        reply.code(501).send({ error: 'Command result retrieval not available' });
        return;
      }

      const result = this.getCommandResult(id);

      if (!result) {
        reply.code(404).send({ error: 'Command result not found' });
        return;
      }

      if (this.clearCommandResult) {
        this.clearCommandResult(id);
      }

      return result;
    });

    this.fastify.delete('/api/nodes/:id', async (request: any, reply: any) => {
      const { id } = request.params;

      if (this.deleteNode) {
        try {
          await this.deleteNode(id);
          reply.send({ success: true, nodeId: id });
        } catch (error) {
          reply.code(500).send({
            error: error instanceof Error ? error.message : 'Failed to delete node'
          });
        }
      } else {
        reply.code(501).send({ error: 'Database not available' });
      }
    });

    this.fastify.get('/api/stats', async () => {
      const nodes = this.getAllNodes();
      const connected = nodes.filter(n => n.connected);

      return {
        total: nodes.length,
        connected: connected.length,
        disconnected: nodes.length - connected.length
      };
    });

    // Notification endpoints
    this.fastify.get('/api/notifications', async () => {
      if (!this.getAllNotifications) {
        return { notifications: [], count: 0, error: 'Database not available' };
      }

      try {
        const notifications = await this.getAllNotifications();
        const nodes = await this.getDatabaseNodes?.() || [];

        const notificationsWithNodes = notifications.map(notification => ({
          ...notification,
          nodes: nodes.filter(n => notification.instanceIds.includes(n.id))
        }));

        return {
          notifications: notificationsWithNodes,
          count: notificationsWithNodes.length
        };
      } catch (error) {
        logger.error('Failed to fetch notifications:', error);
        return { notifications: [], count: 0, error: 'Failed to fetch notifications' };
      }
    });

    this.fastify.get('/api/notifications/:id', async (request: any, reply: any) => {
      if (!this.getNotification) {
        reply.code(501).send({ error: 'Database not available' });
        return;
      }

      const { id } = request.params;
      const notification = await this.getNotification(id);

      if (!notification) {
        reply.code(404).send({ error: 'Notification not found' });
        return;
      }

      const nodes = await this.getDatabaseNodes?.() || [];
      return {
        ...notification,
        nodes: nodes.filter(n => notification.instanceIds.includes(n.id))
      };
    });

    this.fastify.post('/api/notifications', async (request: any, reply: any) => {
      if (!this.saveNotification) {
        reply.code(501).send({ error: 'Database not available' });
        return;
      }

      const { channel, userId, messageTemplate, instanceIds } = request.body;

      if (!channel || !userId || !messageTemplate || !instanceIds) {
        reply.code(400).send({ error: 'Missing required fields' });
        return;
      }

      try {
        const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const notification: Notification = {
          id,
          channel,
          userId,
          messageTemplate,
          instanceIds,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await this.saveNotification(notification);

        const nodes = await this.getDatabaseNodes?.() || [];
        return {
          success: true,
          notification: {
            ...notification,
            nodes: nodes.filter(n => instanceIds.includes(n.id))
          }
        };
      } catch (error) {
        logger.error('Failed to create notification:', error);
        reply.code(500).send({ error: 'Failed to create notification' });
      }
    });

    this.fastify.patch('/api/notifications/:id', async (request: any, reply: any) => {
      if (!this.getNotification || !this.saveNotification) {
        reply.code(501).send({ error: 'Database not available' });
        return;
      }

      const { id } = request.params;
      const { channel, userId, messageTemplate, instanceIds } = request.body;

      try {
        const existing = await this.getNotification(id);
        if (!existing) {
          reply.code(404).send({ error: 'Notification not found' });
          return;
        }

        const updated: Notification = {
          ...existing,
          channel: channel ?? existing.channel,
          userId: userId ?? existing.userId,
          messageTemplate: messageTemplate ?? existing.messageTemplate,
          instanceIds: instanceIds ?? existing.instanceIds,
          updatedAt: new Date()
        };

        await this.saveNotification(updated);

        const nodes = await this.getDatabaseNodes?.() || [];
        return {
          success: true,
          notification: {
            ...updated,
            nodes: nodes.filter(n => updated.instanceIds.includes(n.id))
          }
        };
      } catch (error) {
        logger.error('Failed to update notification:', error);
        reply.code(500).send({ error: 'Failed to update notification' });
      }
    });

    this.fastify.delete('/api/notifications/:id', async (request: any, reply: any) => {
      if (!this.deleteNotification) {
        reply.code(501).send({ error: 'Database not available' });
        return;
      }

      const { id } = request.params;

      try {
        await this.deleteNotification(id);
        reply.send({ success: true, notificationId: id });
      } catch (error) {
        logger.error('Failed to delete notification:', error);
        reply.code(500).send({ error: 'Failed to delete notification' });
      }
    });

    this.fastify.post('/api/notifications/:id/test', async (request: any, reply: any) => {
      if (!this.getNotification) {
        reply.code(501).send({ error: 'Database not available' });
        return;
      }

      const { id } = request.params;

      try {
        const notification = await this.getNotification(id);
        if (!notification) {
          reply.code(404).send({ error: 'Notification not found' });
          return;
        }

        // TODO: Implement actual notification sending logic
        // For now, return success as a placeholder
        logger.debug('Test notification would be sent:', notification);

        return {
          success: true,
          message: 'Test notification sent (placeholder - implement actual sending logic)'
        };
      } catch (error) {
        logger.error('Failed to test notification:', error);
        reply.code(500).send({ error: 'Failed to test notification' });
      }
    });
  }

  private setupStaticFiles(): void {
    const webDistPath = this.config.webDistPath || join(dirname(fileURLToPath(import.meta.url)), 'web');

    const indexPath = join(webDistPath, 'index.html');

    this.fastify.get('/', async (request: any, reply: any) => {
      if (existsSync(indexPath)) {
        reply.type('text/html').send(readFileSync(indexPath, 'utf-8'));
      } else {
        reply.code(404).send({ error: 'Web UI not found. Run: cd apps/web && pnpm build && cp -r dist ../server/dist/web' });
      }
    });

    this.fastify.get('/*', async (request: any, reply: any) => {
      const filePath = join(this.config.webDistPath!, request.url.replace(/^\//, ''));
      
      if (existsSync(filePath)) {
        const ext = filePath.split('.').pop();
        const contentTypes: Record<string, string> = {
          'html': 'text/html',
          'css': 'text/css',
          'js': 'application/javascript',
          'json': 'application/json',
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'svg': 'image/svg+xml',
          'ico': 'image/x-icon',
          'woff': 'font/woff',
          'woff2': 'font/woff2',
          'ttf': 'font/ttf',
          'eot': 'application/vnd.ms-fontobject'
        };
        
        reply.type(contentTypes[ext || 'html'] || 'application/octet-stream').send(readFileSync(filePath));
      } else {
        reply.code(404).send({ error: 'File not found' });
      }
    });
  }

  async start(): Promise<void> {
    await this.fastify.listen({
      port: this.config.port,
      host: this.config.host
    });
    logger.startup(`REST API listening on http://${this.config.host}:${this.config.port}`);

    if (this.config.webDistPath) {
      const indexPath = join(this.config.webDistPath, 'index.html');
      if (existsSync(indexPath)) {
        logger.startup(`Web UI available at http://${this.config.host}:${this.config.port}`);
      }
    }
  }

  async stop(): Promise<void> {
    await this.fastify.close();
  }

  private readConfig() {
    try {
      const configContent = readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      logger.error('Failed to read config:', error);
      return null;
    }
  }

  updateAuthConfig(authConfig: any): void {
    this.config.auth = authConfig;
    this.authEnabled = !!authConfig?.enabled && !!authConfig?.user;

    if (this.updateAgentToken) {
      const agentToken = (authConfig?.tokens && authConfig.tokens.length > 0)
        ? authConfig.tokens[0]
        : undefined;
      this.updateAgentToken(agentToken);
    }
  }
}
