import type { NodeInfo, NodeStatus } from '@caribbean/shared';
import { randomUUID } from 'crypto';

export class NodeManager {
  private nodes: Map<string, NodeInfo> = new Map();
  private nodeStatus: Map<string, NodeStatus> = new Map();

  // Generate a unique ID for a new node
  generateNodeId(): string {
    return randomUUID();
  }

  registerNode(nodeId: string, name: string, tags: string[], clientIp?: string): void {
    const existingNode = this.nodes.get(nodeId);

    if (existingNode) {
      existingNode.connected = true;
      existingNode.lastSeen = new Date();
      existingNode.clientIp = clientIp || existingNode.clientIp;
      console.log(`[Server] Node reconnected: ${existingNode.name} (${nodeId})`);
    } else {
      const node: NodeInfo = {
        id: nodeId,
        name,
        tags,
        connected: true,
        lastSeen: new Date(),
        clientIp
      };
      this.nodes.set(nodeId, node);
      console.log(`[Server] Node registered: ${name} (${nodeId})`);
    }
  }

  updateNodeStatus(nodeId: string, status: NodeStatus): void {
    this.nodeStatus.set(nodeId, status);
    const node = this.nodes.get(nodeId);
    if (node) {
      node.lastSeen = new Date();
      node.status = status;
    }
  }

  disconnectNode(nodeId: string, reason: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.connected = false;
      node.openclawStatus = 'unknown';
      console.log(`[Server] Node disconnected: ${node.name} (${nodeId}) - ${reason}`);
    }
  }

  removeNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      this.nodes.delete(nodeId);
      this.nodeStatus.delete(nodeId);
      console.log(`[Server] Node removed: ${node.name} (${nodeId})`);
    }
  }

  getNode(nodeId: string): NodeInfo | undefined {
    return this.nodes.get(nodeId);
  }

  getAllNodes(): NodeInfo[] {
    return Array.from(this.nodes.values());
  }

  getConnectedNodes(): NodeInfo[] {
    return this.getAllNodes().filter(node => node.connected);
  }

  getNodeCount(): number {
    return this.nodes.size;
  }

  getConnectedCount(): number {
    return this.getConnectedNodes().length;
  }
}
