import "dotenv/config";

import { createServer } from "node:http";

import next from "next";

import { getLogger } from "@/lib/logger";
import { attachRealtimeServer, realtimeHub } from "@/lib/realtime";

const logger = getLogger("server");
const args = new Set(process.argv.slice(2));
const dev = args.has("--dev")
  ? true
  : args.has("--prod")
    ? false
    : process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = Number(process.env.PORT ?? "3000");

async function main(): Promise<void> {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = createServer((req, res) => {
    void handle(req, res);
  });

  attachRealtimeServer(server, { hub: realtimeHub });

  server.listen(port, hostname, () => {
    logger.info(
      {
        url: `http://${hostname}:${port}`,
        mode: dev ? "development" : "production",
      },
      "Sherdan DM Tools server ready",
    );
  });
}

main().catch((err) => {
  logger.fatal({ err }, "server startup failed");
  process.exit(1);
});
