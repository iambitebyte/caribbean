import { open, Database } from 'sqlite';
import type { NodeInfo, Notification, CreateNotificationDto } from '@openclaw-caribbean/shared';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import sqlite3 from 'sqlite3';
import { createLogger } from '@openclaw-caribbean/shared';

const logger = createLogger('Database');

function extractGatewayStatus(node: NodeInfo): string {
  if (!node.status?.openclawGateway) return 'unknown';
  const gw = node.status.openclawGateway;
  return typeof gw === 'string' ? gw : gw.status;
}

export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql';
  path?: string;
  url?: string;
}

export interface Migration {
  version: number;
  name: string;
  up: string;
}

export class DatabaseManager {
  private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.config.type === 'sqlite') {
      const dbPath = this.config.path;
      if (!dbPath) throw new Error('SQLite path is required');
      const dbDir = dirname(dbPath);

      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
      }

      this.db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      await this.initSchema();
      await this.runMigrations();
    }
  }

  private async initSchema(): Promise<void> {
    if (!this.db) return;

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

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

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        user_id TEXT NOT NULL,
        message_template TEXT NOT NULL,
        instance_ids TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(channel);
    `);

    // 初始化后，清理过多的历史记录
    await this.cleanupHistory();
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) return;

    const migrations = this.getMigrations();

    for (const migration of migrations) {
      const executed = await this.db.get(
        `SELECT version FROM migrations WHERE version = ?`,
        [migration.version]
      );

      if (!executed) {
        logger.startup(`Running migration: ${migration.name}`);
        await this.db.exec(migration.up);
        await this.db.run(
          `INSERT INTO migrations (version, name) VALUES (?, ?)`,
          [migration.version, migration.name]
        );
        logger.startup(`Migration completed: ${migration.name}`);
      }
    }
  }

  private getMigrations(): Migration[] {
    return [
      {
        version: 1,
        name: 'add_client_ip_column',
        up: `ALTER TABLE nodes ADD COLUMN client_ip TEXT;`
      },
      {
        version: 2,
        name: 'add_system_column',
        up: `ALTER TABLE nodes ADD COLUMN system TEXT;`
      },
      {
        version: 3,
        name: 'add_openclaw_version_column',
        up: `ALTER TABLE nodes ADD COLUMN openclaw_version TEXT;`
      },
      {
        version: 4,
        name: 'add_notifications_table',
        up: `
          CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            channel TEXT NOT NULL,
            user_id TEXT NOT NULL,
            message_template TEXT NOT NULL,
            instance_ids TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(channel);
        `
      }
    ];
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

    logger.debug('History cleaned - keeping only last 5 records per node');
  }

  async saveNode(node: NodeInfo): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();
    const tagsJson = JSON.stringify(node.tags);
    const statusJson = node.status ? JSON.stringify(node.status) : null;

    // Check if node exists
    const existingNode = await this.db.get(
      `SELECT id, name FROM nodes WHERE id = ?`,
      [node.id]
    );

    if (existingNode) {
      // Update existing node - only update necessary fields, preserve name
      await this.db.run(
        `UPDATE nodes SET tags = ?, connected = ?, last_seen = ?, status = ?, openclaw_status = ?, client_ip = ?, system = ?, openclaw_version = ?, updated_at = ? WHERE id = ?`,
        [
          tagsJson,
          node.connected ? 1 : 0,
          node.lastSeen.toISOString(),
          statusJson,
          node.openclawStatus || 'unknown',
          node.clientIp || null,
          node.system || null,
          node.status?.openclawVersion || node.openclawVersion || null,
          now,
          node.id
        ]
      );
    } else {
      // Insert new node
      await this.db.run(
        `INSERT INTO nodes (id, name, tags, connected, last_seen, status, openclaw_status, client_ip, system, openclaw_version, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          node.id,
          node.name,
          tagsJson,
          node.connected ? 1 : 0,
          node.lastSeen.toISOString(),
          statusJson,
          node.openclawStatus || 'unknown',
          node.clientIp || null,
          node.system || null,
          node.status?.openclawVersion || node.openclawVersion || null,
          now
        ]
      );
    }

    // 只保留每个节点的最近 5 条历史记录
    if (node.status && statusJson) {
      await this.saveNodeHistory(node.id, statusJson, extractGatewayStatus(node));
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

  async updateNodeConnected(nodeId: string, clientIp?: string): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();

    if (clientIp) {
      await this.db.run(
        `UPDATE nodes SET connected = 1, last_seen = ?, client_ip = ?, updated_at = ? WHERE id = ?`,
        [now, clientIp, now, nodeId]
      );
    } else {
      await this.db.run(
        `UPDATE nodes SET connected = 1, last_seen = ?, updated_at = ? WHERE id = ?`,
        [now, now, nodeId]
      );
    }
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
      openclawStatus: row.openclaw_status || 'unknown',
      clientIp: row.client_ip || undefined,
      system: row.system || undefined,
      openclawVersion: row.openclaw_version || undefined
    };
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  // Notification methods

  async saveNotification(notification: Notification & { createdAt?: Date; updatedAt?: Date }): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();
    const instanceIdsJson = JSON.stringify(notification.instanceIds);

    const existing = await this.db.get(
      `SELECT id FROM notifications WHERE id = ?`,
      [notification.id]
    );

    if (existing) {
      await this.db.run(
        `UPDATE notifications SET channel = ?, user_id = ?, message_template = ?, instance_ids = ?, updated_at = ? WHERE id = ?`,
        [notification.channel, notification.userId, notification.messageTemplate, instanceIdsJson, now, notification.id]
      );
    } else {
      await this.db.run(
        `INSERT INTO notifications (id, channel, user_id, message_template, instance_ids, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [notification.id, notification.channel, notification.userId, notification.messageTemplate, instanceIdsJson, now, now]
      );
    }
  }

  async getAllNotifications(): Promise<Notification[]> {
    if (!this.db) return [];

    const rows = await this.db.all(
      `SELECT * FROM notifications ORDER BY created_at DESC`
    ) as any[];

    return rows.map(row => ({
      id: row.id,
      channel: row.channel,
      userId: row.user_id,
      messageTemplate: row.message_template,
      instanceIds: JSON.parse(row.instance_ids || '[]'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  async getNotification(id: string): Promise<Notification | null> {
    if (!this.db) return null;

    const row = await this.db.get(
      `SELECT * FROM notifications WHERE id = ?`,
      [id]
    ) as any;

    if (!row) return null;

    return {
      id: row.id,
      channel: row.channel,
      userId: row.user_id,
      messageTemplate: row.message_template,
      instanceIds: JSON.parse(row.instance_ids || '[]'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  async deleteNotification(id: string): Promise<void> {
    if (!this.db) return;

    await this.db.run(
      `DELETE FROM notifications WHERE id = ?`,
      [id]
    );
  }
}
