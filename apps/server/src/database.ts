import { open, Database } from 'sqlite';
import type { NodeInfo } from '@caribbean/shared';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import sqlite3 from 'sqlite3';

export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql';
  path?: string;
  url?: string;
}

export class DatabaseManager {
  private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.config.type === 'sqlite') {
      const dbPath = this.config.path || './data/caribbean.db';
      const dbDir = dirname(dbPath);

      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
      }

      this.db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      await this.initSchema();
    }
  }

  private async initSchema(): Promise<void> {
    if (!this.db) return;

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tags TEXT,
        connected INTEGER DEFAULT 0,
        last_seen TEXT,
        status TEXT,
        openclaw_status TEXT DEFAULT 'unknown',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        status TEXT NOT NULL,
        openclaw_status TEXT DEFAULT 'unknown',
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_connected ON nodes(connected);
      CREATE INDEX IF NOT EXISTS idx_nodes_openclaw_status ON nodes(openclaw_status);
      CREATE INDEX IF NOT EXISTS idx_status_history_node_id ON status_history(node_id);
      CREATE INDEX IF NOT EXISTS idx_status_history_timestamp ON status_history(timestamp);
    `);

    // 初始化后，清理过多的历史记录
    await this.cleanupHistory();
  }

  async cleanupHistory(): Promise<void> {
    if (!this.db) return;

    // 只保留每个节点的最近 5 条历史记录
    await this.db.exec(`
      DELETE FROM status_history 
      WHERE id NOT IN (
        SELECT id FROM status_history AS sh
        WHERE sh.node_id = status_history.node_id
        ORDER BY sh.id DESC
        LIMIT 5
      )
    `);

    console.log('[Database] History cleaned - keeping only last 5 records per node');
  }

  async saveNode(node: NodeInfo): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();
    const tagsJson = JSON.stringify(node.tags);
    const statusJson = node.status ? JSON.stringify(node.status) : null;

    await this.db.run(
      `INSERT OR REPLACE INTO nodes (id, name, tags, connected, last_seen, status, openclaw_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        node.id,
        node.name,
        tagsJson,
        node.connected ? 1 : 0,
        node.lastSeen.toISOString(),
        statusJson,
        node.openclawStatus || 'unknown',
        now
      ]
    );

    // 只保留每个节点的最近 5 条历史记录
    if (node.status && statusJson) {
      await this.saveNodeHistory(node.id, statusJson, node.openclawStatus || 'unknown');
    }
  }

  async saveNodeHistory(nodeId: string, statusJson: string, openclawStatus: string): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();

    await this.db.run(
      `INSERT OR REPLACE INTO status_history (node_id, status, openclaw_status, timestamp)
       VALUES (?, ?, ?, ?)`,
      [nodeId, statusJson, openclawStatus || 'unknown', now]
    );

    // 清理旧的历史记录，只保留最近 5 条
    await this.cleanupHistory();
  }

  async updateNodeHeartbeat(nodeId: string): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();

    // 收到心跳只更新 last_seen 和 updated_at，不改变 connected 状态
    await this.db.run(
      `UPDATE nodes SET last_seen = ?, updated_at = ? WHERE id = ?`,
      [now, now, nodeId]
    );
  }

  async getNode(nodeId: string): Promise<NodeInfo | null> {
    if (!this.db) return null;

    const row = await this.db.get(
      `SELECT * FROM nodes WHERE id = ?`,
      [nodeId]
    ) as any;

    if (!row) return null;

    return this.rowToNodeInfo(row);
  }

  async getAllNodes(): Promise<NodeInfo[]> {
    if (!this.db) return [];

    const rows = await this.db.all(
      `SELECT * FROM nodes ORDER BY name`
    ) as any[];

    return rows.map(row => this.rowToNodeInfo(row));
  }

  async getNodeStatusHistory(nodeId: string, limit: number = 5): Promise<any[]> {
    if (!this.db) return [];

    const rows = await this.db.all(
      `SELECT * FROM status_history 
       WHERE node_id = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [nodeId, limit]
    ) as any[];

    return rows.map(row => ({
      id: row.id,
      nodeId: row.node_id,
      status: JSON.parse(row.status),
      openclawStatus: row.openclaw_status,
      timestamp: new Date(row.timestamp)
    }));
  }

  async updateNodeName(nodeId: string, name: string): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();

    await this.db.run(
      `UPDATE nodes SET name = ?, updated_at = ? WHERE id = ?`,
      [name, now, nodeId]
    );
  }

  async updateNodeConnected(nodeId: string): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();

    await this.db.run(
      `UPDATE nodes SET connected = 1, last_seen = ?, updated_at = ? WHERE id = ?`,
      [now, now, nodeId]
    );
  }

  async updateNodeDisconnected(nodeId: string): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();

    await this.db.run(
      `UPDATE nodes SET connected = 0, openclaw_status = 'unknown', updated_at = ? WHERE id = ?`,
      [now, nodeId]
    );
  }

  async deleteNode(nodeId: string): Promise<void> {
    if (!this.db) return;

    await this.db.run(
      `DELETE FROM nodes WHERE id = ?`,
      [nodeId]
    );
  }

  private rowToNodeInfo(row: any): NodeInfo {
    return {
      id: row.id,
      name: row.name,
      tags: JSON.parse(row.tags || '[]'),
      connected: row.connected === 1,
      lastSeen: new Date(row.last_seen),
      status: row.status ? JSON.parse(row.status) : undefined,
      openclawStatus: row.openclaw_status || 'unknown'
    };
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}
