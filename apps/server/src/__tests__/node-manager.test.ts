import { describe, it, expect } from 'vitest'
import { NodeManager } from '../node-manager.js'

describe('NodeManager', () => {
  let manager: NodeManager

  beforeEach(() => {
    manager = new NodeManager()
  })

  describe('registerNode', () => {
    it('creates a new node', () => {
      const nodeId = manager.generateNodeId()
      manager.registerNode(nodeId, 'node-1', ['tag1'], '192.168.1.1', 'linux')

      const node = manager.getNode(nodeId)
      expect(node).toBeDefined()
      expect(node!.name).toBe('node-1')
      expect(node!.connected).toBe(true)
      expect(node!.clientIp).toBe('192.168.1.1')
      expect(node!.system).toBe('linux')
    })

    it('reconnects existing node preserving name', () => {
      const nodeId = manager.generateNodeId()
      manager.registerNode(nodeId, 'node-1', ['tag1'], '192.168.1.1', 'linux')

      manager.registerNode(nodeId, 'node-1-new', [], '10.0.0.1', 'mac')

      const node = manager.getNode(nodeId)
      expect(node!.name).toBe('node-1')
      expect(node!.clientIp).toBe('10.0.0.1')
      expect(node!.system).toBe('mac')
      expect(node!.connected).toBe(true)
    })

    it('tracks node count', () => {
      expect(manager.getNodeCount()).toBe(0)
      manager.registerNode(manager.generateNodeId(), 'a', [])
      manager.registerNode(manager.generateNodeId(), 'b', [])
      expect(manager.getNodeCount()).toBe(2)
    })
  })

  describe('updateNodeStatus', () => {
    it('updates status and lastSeen', () => {
      const nodeId = manager.generateNodeId()
      manager.registerNode(nodeId, 'node-1', [])

      manager.updateNodeStatus(nodeId, {
        cpu: { percent: 50 },
        memory: { percent: 60, total: 16384, used: 9830 },
        uptime: 3600
      })

      const node = manager.getNode(nodeId)
      expect(node!.status).toBeDefined()
      expect(node!.status!.cpu!.percent).toBe(50)
    })
  })

  describe('disconnectNode', () => {
    it('marks node as disconnected', () => {
      const nodeId = manager.generateNodeId()
      manager.registerNode(nodeId, 'node-1', [])

      manager.disconnectNode(nodeId, 'timeout')

      const node = manager.getNode(nodeId)
      expect(node!.connected).toBe(false)
      expect(node!.openclawStatus).toBe('unknown')
    })
  })

  describe('removeNode', () => {
    it('removes node entirely', () => {
      const nodeId = manager.generateNodeId()
      manager.registerNode(nodeId, 'node-1', [])

      manager.removeNode(nodeId)

      expect(manager.getNode(nodeId)).toBeUndefined()
      expect(manager.getNodeCount()).toBe(0)
    })
  })

  describe('getConnectedNodes / getConnectedCount', () => {
    it('filters connected nodes only', () => {
      const id1 = manager.generateNodeId()
      const id2 = manager.generateNodeId()
      manager.registerNode(id1, 'online', [])
      manager.registerNode(id2, 'offline', [])
      manager.disconnectNode(id2, 'test')

      expect(manager.getConnectedCount()).toBe(1)
      expect(manager.getConnectedNodes()[0].name).toBe('online')
    })
  })
})
