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
      serverTime: string;
    }
  | {
      type: "pong";
      serverTime: string;
    };

interface RealtimeConnection {
  id: string;
  socket: Socket;
  remaining: Buffer;
}

export class RealtimeHub {
  private readonly connections = new Map<string, RealtimeConnection>();

  get connectionCount(): number {
    return this.connections.size;
  }

  add(socket: Socket): string {
    const id = createConnectionId();
    const connection: RealtimeConnection = {
      id,
      socket,
      remaining: Buffer.alloc(0),
    };

    this.connections.set(id, connection);
    socket.setNoDelay(true);
    socket.on("data", (chunk) => this.handleData(connection, chunk));
    socket.on("close", () => this.remove(id));
    socket.on("error", (err) => {
      logger.warn({ err, connectionId: id }, "websocket connection error");
      this.remove(id);
    });

    this.send(id, {
      type: "connected",
      connectionId: id,
      serverTime: new Date().toISOString(),
    });

    logger.debug({ connectionId: id }, "websocket connected");
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
    if (this.connections.delete(connectionId)) {
      logger.debug({ connectionId }, "websocket disconnected");
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
