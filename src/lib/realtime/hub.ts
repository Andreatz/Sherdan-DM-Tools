import type { Socket } from "node:net";

import { getLogger } from "@/lib/logger";

import {
  createConnectionId,
  decodeClientFrames,
  encodeCloseFrame,
  encodePongFrame,
  encodeTextFrame,
} from "./protocol";

const logger = getLogger("realtime.hub");

export type RealtimeServerMessage =
  | {
      type: "connected";
      connectionId: string;
      campaignId: string;
      serverTime: string;
    }
  | {
      type: "pong";
      serverTime: string;
    }
  | {
      type: "campaign_event";
      campaignId: string;
      event: string;
      payload: unknown;
      serverTime: string;
    };

interface RealtimeConnection {
  id: string;
  campaignId: string;
  socket: Socket;
  remaining: Buffer;
}

export class RealtimeHub {
  private readonly connections = new Map<string, RealtimeConnection>();
  private readonly campaignConnections = new Map<string, Set<string>>();

  get connectionCount(): number {
    return this.connections.size;
  }

  campaignConnectionCount(campaignId: string): number {
    return this.campaignConnections.get(campaignId)?.size ?? 0;
  }

  add(socket: Socket, campaignId: string): string {
    const id = createConnectionId();
    const connection: RealtimeConnection = {
      id,
      campaignId,
      socket,
      remaining: Buffer.alloc(0),
    };

    this.connections.set(id, connection);
    this.addToCampaign(campaignId, id);
    socket.setNoDelay(true);
    socket.on("data", (chunk) => this.handleData(connection, chunk));
    socket.on("close", () => this.remove(id));
    socket.on("error", (err) => {
      if (!this.connections.has(id) || isSocketReset(err)) {
        logger.debug({ connectionId: id }, "websocket socket closed");
        return;
      }
      logger.warn({ err, connectionId: id }, "websocket connection error");
      this.remove(id);
    });

    this.send(id, {
      type: "connected",
      connectionId: id,
      campaignId,
      serverTime: new Date().toISOString(),
    });

    logger.debug({ connectionId: id, campaignId }, "websocket connected");
    return id;
  }

  send(connectionId: string, message: RealtimeServerMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.socket.destroyed) return;
    connection.socket.write(encodeTextFrame(JSON.stringify(message)));
  }

  close(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    connection.socket.write(encodeCloseFrame());
    connection.socket.end();
    this.remove(connectionId);
  }

  broadcastCampaign(
    campaignId: string,
    event: string,
    payload: unknown,
    options: { excludeConnectionId?: string } = {},
  ): number {
    const connectionIds = this.campaignConnections.get(campaignId);
    if (!connectionIds) return 0;

    let sent = 0;
    for (const connectionId of connectionIds) {
      if (connectionId === options.excludeConnectionId) continue;
      this.send(connectionId, {
        type: "campaign_event",
        campaignId,
        event,
        payload,
        serverTime: new Date().toISOString(),
      });
      sent += 1;
    }
    return sent;
  }

  private handleData(connection: RealtimeConnection, chunk: Buffer): void {
    try {
      const decoded = decodeClientFrames(Buffer.concat([connection.remaining, chunk]));
      connection.remaining = decoded.remaining;

      for (const ping of decoded.pings) {
        connection.socket.write(encodePongFrame(ping));
      }

      for (const message of decoded.messages) {
        this.handleMessage(connection, message);
      }

      if (decoded.closeRequested) {
        this.close(connection.id);
      }
    } catch (err) {
      logger.warn({ err, connectionId: connection.id }, "invalid websocket frame");
      this.close(connection.id);
    }
  }

  private handleMessage(connection: RealtimeConnection, raw: string): void {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isPingMessage(parsed)) {
        this.send(connection.id, {
          type: "pong",
          serverTime: new Date().toISOString(),
        });
      }
    } catch {
      // Client messages are optional in the first realtime slice. Ignore
      // malformed input instead of turning telemetry into a fatal path.
    }
  }

  private remove(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection && this.connections.delete(connectionId)) {
      this.removeFromCampaign(connection.campaignId, connectionId);
      logger.debug(
        { connectionId, campaignId: connection.campaignId },
        "websocket disconnected",
      );
    }
  }

  private addToCampaign(campaignId: string, connectionId: string): void {
    const existing = this.campaignConnections.get(campaignId);
    if (existing) {
      existing.add(connectionId);
      return;
    }
    this.campaignConnections.set(campaignId, new Set([connectionId]));
  }

  private removeFromCampaign(campaignId: string, connectionId: string): void {
    const existing = this.campaignConnections.get(campaignId);
    if (!existing) return;
    existing.delete(connectionId);
    if (existing.size === 0) {
      this.campaignConnections.delete(campaignId);
    }
  }
}

function isPingMessage(value: unknown): value is { type: "ping" } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).type === "ping"
  );
}

function isSocketReset(err: Error): boolean {
  return (err as NodeJS.ErrnoException).code === "ECONNRESET";
}
