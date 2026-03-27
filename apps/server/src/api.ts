import Fastify from 'fastify';
import cors from '@fastify/cors';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { NodeInfo } from '@caribbean/shared';
import { verifyToken, generateToken } from './auth.js';

export interface ApiServerConfig {
  port: number;
  host: string;
  webDistPath?: string;
  auth?: {
    enabled: boolean;
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
  private getDatabaseNodes?: () => Promise<NodeInfo[]>;
  private updateNodeName?: (nodeId: string, name: string) => Promise<void>;
  private authEnabled: boolean;

  constructor(
    config: ApiServerConfig,
    getNodeInfo: (nodeId: string) => NodeInfo | undefined,
    getAllNodes: () => NodeInfo[],
    sendCommand: (nodeId: string, action: string, params: Record<string, unknown>) => string,
    getDatabaseNodes?: () => Promise<NodeInfo[]>,
    updateNodeName?: (nodeId: string, name: string) => Promise<void>
  ) {
    this.config = config;
    this.getNodeInfo = getNodeInfo;
    this.getAllNodes = getAllNodes;
    this.sendCommand = sendCommand;
    this.getDatabaseNodes = getDatabaseNodes;
    this.updateNodeName = updateNodeName;
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
    if (!this.authEnabled) return;

    this.fastify.addHook('onRequest', async (request: any, reply: any) => {
      const path = request.routerPath;

      if (path === '/api/login' || path === '/api/health' || path?.startsWith('/api/auth/')) {
        return;
      }

      if (path?.startsWith('/api/')) {
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
      }
    });
  }

  private setupRoutes(): void {
    this.fastify.get('/api/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
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

    this.fastify.get('/api/nodes/:id/status', async (request: any, reply: any) => {
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

    this.fastify.get('/api/stats', async () => {
      const nodes = this.getAllNodes();
      const connected = nodes.filter(n => n.connected);

      return {
        total: nodes.length,
        connected: connected.length,
        disconnected: nodes.length - connected.length
      };
    });
  }

  private setupStaticFiles(): void {
    if (!this.config.webDistPath) return;

    const indexPath = join(this.config.webDistPath, 'index.html');

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
    console.log(`[API] REST API listening on http://${this.config.host}:${this.config.port}`);
    
    if (this.config.webDistPath) {
      const indexPath = join(this.config.webDistPath, 'index.html');
      if (existsSync(indexPath)) {
        console.log(`[API] Web UI available at http://${this.config.host}:${this.config.port}`);
      }
    }
  }

  async stop(): Promise<void> {
    await this.fastify.close();
  }
}
