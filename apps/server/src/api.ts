import { FastifyInstance } from 'fastify';
import type { NodeInfo } from '@caribbean/shared';

export interface ApiServerConfig {
  port: number;
  host: string;
}

export class ApiServer {
  private fastify: FastifyInstance;
  private config: ApiServerConfig;
  private getNodeInfo: (nodeId: string) => NodeInfo | undefined;
  private getAllNodes: () => NodeInfo[];
  private sendCommand: (nodeId: string, action: string, params: Record<string, unknown>) => string;

  constructor(
    config: ApiServerConfig,
    getNodeInfo: (nodeId: string) => NodeInfo | undefined,
    getAllNodes: () => NodeInfo[],
    sendCommand: (nodeId: string, action: string, params: Record<string, unknown>) => string
  ) {
    this.config = config;
    this.getNodeInfo = getNodeInfo;
    this.getAllNodes = getAllNodes;
    this.sendCommand = sendCommand;
    this.fastify = require('fastify')({ logger: false });
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.fastify.get('/api/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    this.fastify.get('/api/nodes', async () => {
      return {
        nodes: this.getAllNodes(),
        count: this.getAllNodes().length
      };
    });

    this.fastify.get<{ Params: { id: string } }>('/api/nodes/:id', async (request, reply) => {
      const { id } = request.params;
      const node = this.getNodeInfo(id);
      
      if (!node) {
        reply.code(404).send({ error: 'Node not found' });
        return;
      }
      
      return node;
    });

    this.fastify.get<{ Params: { id: string } }>('/api/nodes/:id/status', async (request, reply) => {
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

    this.fastify.post<{ Params: { id: string }, Body: { action: string; params?: Record<string, unknown> } }>(
      '/api/nodes/:id/command',
      async (request, reply) => {
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
      }
    );

    this.fastify.get('/api/stats', async () => {
      const nodes = this.getAllNodes();
      const connected = nodes.filter(n => n.connected);
      
      return {
        total: nodes.length,
        connected: connected.length,
        disconnected: nodes.length - connected.length,
        totalMemory: connected.reduce((sum, n) => sum + (n.status?.memory.total || 0), 0),
        usedMemory: connected.reduce((sum, n) => sum + (n.status?.memory.used || 0), 0),
        totalAgents: connected.reduce((sum, n) => sum + (n.status?.agents.active || 0), 0)
      };
    });
  }

  async start(): Promise<void> {
    await this.fastify.listen({
      port: this.config.port,
      host: this.config.host
    });
    console.log(`[API] REST API listening on http://${this.config.host}:${this.config.port}`);
  }

  async stop(): Promise<void> {
    await this.fastify.close();
  }
}
