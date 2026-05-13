import type { IncomingMessage, Server } from "node:http";
import type { Socket } from "node:net";

import { BadRequestError } from "@/lib/api/errors";
import { getLogger } from "@/lib/logger";

import { RealtimeHub } from "./hub";
import { createWebSocketAcceptKey } from "./protocol";

const logger = getLogger("realtime.server");
const DEFAULT_REALTIME_PATH = "/api/realtime";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface RealtimeServerOptions {
  path?: string;
  hub?: RealtimeHub;
}

export function attachRealtimeServer(
  server: Server,
  options: RealtimeServerOptions = {},
): RealtimeHub {
  const path = options.path ?? DEFAULT_REALTIME_PATH;
  const hub = options.hub ?? new RealtimeHub();

  server.on("upgrade", (req, socket, head) => {
    if (!isRealtimeRequest(req, path)) return;
    const netSocket = socket as Socket;

    try {
      const campaignId = getCampaignId(req);
      if (head.length > 0) {
        throw new BadRequestError("WebSocket upgrade body non supportato.");
      }
      completeHandshake(req, netSocket);
      hub.add(netSocket, campaignId);
    } catch (err) {
      logger.warn({ err, path }, "websocket upgrade rejected");
      rejectUpgrade(netSocket);
    }
  });

  logger.info({ path }, "realtime websocket server attached");
  return hub;
}

function isRealtimeRequest(req: IncomingMessage, path: string): boolean {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);
  return url.pathname === path;
}

function completeHandshake(req: IncomingMessage, socket: Socket): void {
  const upgrade = req.headers.upgrade;
  const key = req.headers["sec-websocket-key"];
  const version = req.headers["sec-websocket-version"];

  if (typeof upgrade !== "string" || upgrade.toLowerCase() !== "websocket") {
    throw new BadRequestError("Header Upgrade WebSocket mancante.");
  }
  if (typeof key !== "string" || key.trim().length === 0) {
    throw new BadRequestError("Header Sec-WebSocket-Key mancante.");
  }
  if (version !== "13") {
    throw new BadRequestError("Versione WebSocket non supportata.");
  }

  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${createWebSocketAcceptKey(key)}`,
      "",
      "",
    ].join("\r\n"),
  );
}

function getCampaignId(req: IncomingMessage): string {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const campaignId = url.searchParams.get("campaign_id") ?? url.searchParams.get("campaignId");
  if (!campaignId || !UUID_RE.test(campaignId)) {
    throw new BadRequestError(
      "Parametro campaign_id UUID richiesto per il canale realtime.",
    );
  }
  return campaignId;
}

function rejectUpgrade(socket: Socket): void {
  socket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  socket.destroy();
}
