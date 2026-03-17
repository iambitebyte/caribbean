import type { NodeInfo, NodeStatus } from '@caribbean/shared';

export class NodeManager {
  private nodes: Map<string, NodeInfo> = new Map();
  private nodeStatus: Map<string, NodeStatus> = new Map();

  registerNode(nodeId: string, name: string, tags: string[]): void {
    const node: NodeInfo = {
      id: nodeId,
      name,
      tags,
      connected: true,
      lastSeen: new Date()
    };
    this.nodes.set(nodeId, node);
    console.log(`[Server] Node registered: ${name} (${nodeId})`);
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
      console.log(`[Server] Node disconnected: ${node.name} (${nodeId}) - ${reason}`);
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
