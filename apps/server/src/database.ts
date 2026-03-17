import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import type { NodeInfo } from '@caribbean/shared';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        status TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_connected ON nodes(connected);
      CREATE INDEX IF NOT EXISTS idx_status_history_node_id ON status_history(node_id);
      CREATE INDEX IF NOT EXISTS idx_status_history_timestamp ON status_history(timestamp);
    `);
  }

  async saveNode(node: NodeInfo): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();
    const tagsJson = JSON.stringify(node.tags);
    const statusJson = node.status ? JSON.stringify(node.status) : null;

    await this.db.run(
      `INSERT OR REPLACE INTO nodes (id, name, tags, connected, last_seen, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        node.id,
        node.name,
        tagsJson,
        node.connected ? 1 : 0,
        node.lastSeen.toISOString(),
        statusJson,
        now
      ]
    );

    if (node.status) {
      await this.db.run(
        `INSERT INTO status_history (node_id, status, timestamp)
         VALUES (?, ?, ?)`,
        [
          node.id,
          statusJson,
          now
        ]
      );
    }
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

  async getNodeStatusHistory(nodeId: string, limit: number = 100): Promise<any[]> {
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
      timestamp: new Date(row.timestamp)
    }));
  }

  async deleteNode(nodeId: string): Promise<void> {
    if (!this.db) return;

    await this.db.run(
      `DELETE FROM nodes WHERE id = ?`,
      [nodeId]
    );
  }

  async cleanupOldHistory(days: number = 7): Promise<void> {
    if (!this.db) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString();

    await this.db.run(
      `DELETE FROM status_history WHERE timestamp < ?`,
      [cutoffIso]
    );
  }

  private rowToNodeInfo(row: any): NodeInfo {
    return {
      id: row.id,
      name: row.name,
      tags: JSON.parse(row.tags || '[]'),
      connected: row.connected === 1,
      lastSeen: new Date(row.last_seen),
      status: row.status ? JSON.parse(row.status) : undefined
    };
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}
