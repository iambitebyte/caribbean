import type { Notification, NodeInfo } from '@openclaw-caribbean/shared';
import { WebSocketHub } from './websocket-hub.js';
import { DatabaseManager } from './database.js';

export class NotificationService {
  private database: DatabaseManager;
  private websocketHub: WebSocketHub;
  private previousGatewayStatus: Map<string, string> = new Map();
  private debug: boolean;

  constructor(database: DatabaseManager, websocketHub: WebSocketHub, debug: boolean = false) {
    this.database = database;
    this.websocketHub = websocketHub;
    this.debug = debug;
  }

  /**
   * Check if the gateway status changed from 'running' to 'unknown' or 'stopped'
   * and send notifications if configured.
   */
  async checkAndNotify(nodeId: string, nodeName: string, currentStatus: string, connectedNodes: NodeInfo[]): Promise<void> {
    const previousStatus = this.previousGatewayStatus.get(nodeId);

    if (this.debug) {
      console.log(`[Notification] Status check for ${nodeName} (${nodeId}): previous='${previousStatus}', current='${currentStatus}'`);
    }

    // Only notify if:
    // 1. Previous status was 'running'
    // 2. Current status is 'unknown' or 'stopped'
    // 3. Status actually changed
    if (previousStatus === 'running' && (currentStatus === 'unknown' || currentStatus === 'stopped')) {
      console.log(`[Notification] Gateway status changed from 'running' to '${currentStatus}' for node ${nodeName} (${nodeId})`);
      await this.sendShutdownNotifications(nodeId, nodeName, currentStatus, connectedNodes);
    }

    // Update the previous status
    this.previousGatewayStatus.set(nodeId, currentStatus);
  }

  /**
   * Initialize previous status for a node (call when node connects)
   */
  initNodeStatus(nodeId: string, status: string): void {
    if (!this.previousGatewayStatus.has(nodeId)) {
      this.previousGatewayStatus.set(nodeId, status);
    }
  }

  /**
   * Remove node status tracking (call when node disconnects)
   */
  removeNodeStatus(nodeId: string): void {
    this.previousGatewayStatus.delete(nodeId);
  }

  private async sendShutdownNotifications(downNodeId: string, downNodeName: string, status: string, connectedNodes: NodeInfo[]): Promise<void> {
    try {
      const notifications = await this.database.getAllNotifications();

      if (notifications.length === 0) {
        return;
      }

      for (const notification of notifications) {
        // Find which instances from this notification are currently online
        const onlineInstances = connectedNodes.filter(n =>
          notification.instanceIds.includes(n.id) && n.connected
        );

        if (onlineInstances.length === 0) {
          if (this.debug) {
            console.log(`[Notification] No online instances for notification ${notification.id} - skipping`);
          }
          continue;
        }

        // Prepare the message with the node name
        const message = notification.messageTemplate.replace(/\$\{name\}/g, downNodeName);

        console.log(`[Notification] Sending shutdown notification via ${notification.channel} to user ${notification.userId}: "${message}"`);
        if (this.debug) {
          console.log(`[Notification] Via instances: ${onlineInstances.map(n => n.name).join(', ')}`);
        }

        // Send the message through each online instance
        for (const instance of onlineInstances) {
          try {
            this.websocketHub.sendCommand(
              instance.id,
              'message',
              {
                channel: notification.channel,
                target: notification.userId,
                message
              }
            );
            if (this.debug) {
              console.log(`[Notification] Sent to instance ${instance.name} (${instance.id})`);
            }
          } catch (error) {
            console.error(`[Notification] Failed to send to instance ${instance.name} (${instance.id}):`, error);
          }
        }
      }
    } catch (error) {
      console.error('[Notification] Failed to send shutdown notifications:', error);
    }
  }
}
